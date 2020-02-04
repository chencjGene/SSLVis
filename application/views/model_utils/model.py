import numpy as np
import os
from scipy import sparse
from scipy.sparse import csgraph
from scipy.stats import entropy
from time import time
from tqdm import tqdm
import warnings
import copy

from sklearn.neighbors import kneighbors_graph
from sklearn.metrics import accuracy_score
from sklearn.utils.extmath import safe_sparse_dot
from sklearn.neighbors.unsupervised import NearestNeighbors
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics.pairwise import euclidean_distances, paired_distances

from ..utils.config_utils import config
from ..utils.log_utils import logger
from ..utils.helper_utils import check_exist, \
    pickle_load_data, pickle_save_data, flow_statistic
from ..utils.embedder_utils import Embedder

from .data import Data
from .LSLabelSpreading import LSLabelSpreading
from .model_helper import propagation, approximated_influence, exact_influence
from .model_update import local_search_k

DEBUG = False


def build_laplacian_graph(affinity_matrix):
    instance_num = affinity_matrix.shape[0]
    laplacian = csgraph.laplacian(affinity_matrix, normed=True)
    laplacian = -laplacian
    if sparse.isspmatrix(laplacian):
        diag_mask = (laplacian.row == laplacian.col)
        laplacian.data[diag_mask] = 0.0
    else:
        laplacian.flat[::instance_num + 1] = 0.0  # set diag to 0.0
    return laplacian


class SSLModel(object):
    def __init__(self, dataname, labeled_num=None, total_num=None):
        self.dataname = dataname
        self.data_root = os.path.join(config.data_root, self.dataname)

        self.model = None
        self.embed_X = None
        self.n_neighbor = None
        self.max_neighbors = 1000
        # signal is used to indicate that all data should be updated
        self.signal_state = False
        self._propagation = propagation
        self.alpha = 0.2

        self.data = Data(self.dataname, labeled_num, total_num)
        self.selected_dir = self.data.selected_dir
        # self.n_neighbor = int(np.sqrt(self.data.get_train_num()))
        self.n_neighbor = 7
        self.filter_threshold = 0.7
        logger.info("n_neighbor: {}".format(self.n_neighbor))

        self.simplified_affinity_matrix = None
        self.propagation_path = None
        # self._get_signal_state()
        # self._init()

    def init(self, k=None, filter_threshold=None):
        if k is not None:
            self.n_neighbor = k
        if filter_threshold is not None:
            self.filter_threshold = filter_threshold
        logger.info("n_neighbor and filter_threshold has been updated: {} {}".format(
            self.n_neighbor, self.filter_threshold
        ))
        self._preprocess_neighbors()
        self._construct_graph()
        self._training()
        # self._projection()

    def _get_signal_state(self):
        signal_filepath = os.path.join(self.selected_dir, config.signal_filename)
        if check_exist(signal_filepath):
            self.signal_state = True
            logger.info("signal file exists, set signal_state")
        # delete signal file
        if check_exist(signal_filepath):
            os.remove(signal_filepath)
        return

    def _preprocess_neighbors(self):
        neighbors_path = os.path.join(self.selected_dir, "neighbors.npy")
        neighbors_weight_path = os.path.join(self.selected_dir,
                                             "neighbors_weight.npy")
        if os.path.exists(neighbors_path) and \
                os.path.exists(neighbors_weight_path):
            logger.info("neighbors and neighbor_weight exist!!!")
            return
        logger.info("neighbors and neighbor_weight "
                    "do not exist, preprocessing!")
        train_X = self.data.get_train_X()
        train_y = self.data.get_train_label()
        train_y = np.array(train_y)
        self.max_neighbors = min(len(train_y), self.max_neighbors)
        logger.info("data shape: {}, labeled_num: {}"
                    .format(str(train_X.shape), sum(train_y != -1)))
        nn_fit = NearestNeighbors(self.n_neighbor, n_jobs=-4).fit(train_X)
        logger.info("nn construction finished!")
        neighbor_result = nn_fit.kneighbors_graph(nn_fit._fit_X,
                                                  self.max_neighbors,
                                                  # 2,
                                                  mode="distance")
        logger.info("neighbor_result got!")
        neighbors = np.zeros((train_X.shape[0],
                              self.max_neighbors)).astype(int)
        neighbors_weight = np.zeros((train_X.shape[0], self.max_neighbors))
        for i in range(train_X.shape[0]):
            start = neighbor_result.indptr[i]
            end = neighbor_result.indptr[i + 1]
            j_in_this_row = neighbor_result.indices[start:end]
            data_in_this_row = neighbor_result.data[start:end]
            sorted_idx = data_in_this_row.argsort()
            assert (len(sorted_idx) == self.max_neighbors)
            j_in_this_row = j_in_this_row[sorted_idx]
            data_in_this_row = data_in_this_row[sorted_idx]
            neighbors[i, :] = j_in_this_row
            neighbors_weight[i, :] = data_in_this_row

        logger.info("preprocessed neighbors got!")

        # save neighbors information
        np.save(neighbors_path, neighbors)
        np.save(neighbors_weight_path, neighbors_weight)

    def _construct_graph(self):
        # load neighbors information
        neighbors_path = os.path.join(self.selected_dir, "neighbors.npy")
        neighbors_weight_path = os.path.join(self.selected_dir,
                                             "neighbors_weight.npy")
        neighbors = np.load(neighbors_path)
        self.neighbors = neighbors
        neighbors_weight = np.load(neighbors_weight_path)
        instance_num = neighbors.shape[0]
        train_y = self.data.get_train_label()
        train_y = np.array(train_y)
        self.train_y = train_y

        # get knn graph in a csr form
        indptr = [i * self.n_neighbor for i in range(instance_num + 1)]
        logger.info("get indptr")
        indices = neighbors[:, :self.n_neighbor].reshape(-1).tolist()
        logger.info("get indices")
        data = neighbors_weight[:, :self.n_neighbor].reshape(-1)
        logger.info("get data")
        data = (data * 0 + 1.0).tolist()
        logger.info("get data in connectivity")
        affinity_matrix = sparse.csr_matrix((data, indices, indptr),
                                            shape=(instance_num, instance_num))
        affinity_matrix = affinity_matrix + affinity_matrix.T
        affinity_matrix = sparse.csr_matrix((np.ones(len(affinity_matrix.data)).tolist(),
                                             affinity_matrix.indices, affinity_matrix.indptr),
                                            shape=(instance_num, instance_num))
        logger.info("affinity_matrix construction finished!!")
        laplacian = build_laplacian_graph(affinity_matrix)
        self.affinity_matrix = affinity_matrix
        self.laplacian = laplacian


    def _training(self):
        affinity_matrix = self.affinity_matrix
        laplacian = self.laplacian
        train_y = self.train_y
        train_gt = self.data.get_train_ground_truth()
        train_gt = np.array(train_gt)
        pred_dist, loss, ent, process_data, unnorm_dist = \
            self._propagation(laplacian, affinity_matrix, train_y,
                              alpha=self.alpha, process_record=True,
                              normalized=True)
        # labels = [int(np.argmax(process_data[j][id])) if np.max(process_data[j][id]) > 1e-4 else -1 for j in
        #           range(iter_num)]
        iter = len(loss)
        # get labels and flows
        self.labels = process_data.argmax(axis=2)
        self.unnorm_dist = unnorm_dist
        max_process_data = process_data.max(axis=2)
        self.labels[max_process_data <1e-4] = -1
        class_list = np.unique(train_y)
        class_list.sort()
        self.class_list = class_list
        self.flows = np.zeros((iter-1, len(class_list), len(class_list)))
        for i in range(iter-1):
            self.flows[i] = flow_statistic(self.labels[i], self.labels[i+1], class_list)
        self.loss = loss
        self.process_data = process_data
        self.ent = ent
        self.pred_dist = pred_dist
        self.graph = affinity_matrix
        print(process_data.shape)
        pred_y = pred_dist.argmax(axis=1)
        acc = accuracy_score(train_gt, pred_y)
        logger.info("model accuracy: {}, iter: {}".format(acc, iter))
        logger.info("model entropy: {}".format(entropy(pred_dist.T + 1e-20).mean()))
        
        self.evaluate()

        influence_matrix_path = os.path.join(self.selected_dir,
                                             "{}_{}_influence_matrix.pkl"
                                             .format(self.alpha, self.n_neighbor))
        if os.path.exists(influence_matrix_path) and (not DEBUG):
            logger.info("influence_matrix exist!!!")
            self.influence_matrix = pickle_load_data(influence_matrix_path)
            return
        logger.info("influence matrix  "
                    "do not exist, preprocessing!")
        self.influence_matrix = \
            approximated_influence(self.unnorm_dist, affinity_matrix,
                                   laplacian, self.alpha, train_y)
        pickle_save_data(influence_matrix_path, self.influence_matrix)
        return

    def local_search_k(self, selected_idxs):
        k_list = list(range(1,40))
        train_gt = self.data.get_train_ground_truth()
        affinity_matrix, pred = local_search_k(k_list, self.n_neighbor, 
            selected_idxs, self.unnorm_dist, self.affinity_matrix, 
            self.train_y, self.neighbors, train_gt)
        logger.info("searched affinity_matrix diff: {}".format(
            np.abs(self.affinity_matrix - affinity_matrix).sum()
        ))
        laplacian_matrix = build_laplacian_graph(affinity_matrix)
        pred_y = pred.argmax(axis=1)
        acc = accuracy_score(train_gt, pred_y)
        logger.info("model accuracy without full update: {}".format(acc))
        self.affinity_matrix = affinity_matrix
        self.laplacian = laplacian_matrix
        self._training()
        return {"test": "success"}

    def simplify_influence_matrix(self, threshold=0.7):
        logger.info("begin simplify influence matrix")
        laplacian = self.laplacian.tocsr()
        unnorm_dist = self.unnorm_dist
        n_samples, n_classes = unnorm_dist.shape
        y = np.asarray(self.data.get_train_label())
        classes = np.unique(y)
        classes = (classes[classes != -1])
        unlabeled = y == -1
        labeled = (y > -1)
        # initialize distributions
        label_distributions_ = np.zeros((n_samples, n_classes))
        for label in classes:
            label_distributions_[y == label, classes == label] = 1
        y_static_labeled = np.copy(label_distributions_)
        y_static = y_static_labeled * (1 - self.alpha)

        simplified_affinity_matrix = self.influence_matrix.copy() * 0
        for i in range(simplified_affinity_matrix.shape[0]):
            start = self.influence_matrix.indptr[i]
            end = self.influence_matrix.indptr[i + 1]
            data_in_this_row = self.influence_matrix.data[start:end]
            j_in_this_row = self.influence_matrix.indices[start:end]
            sorted_idx = data_in_this_row.argsort()[::-1]
            max_idx = []
            for k in range(len(sorted_idx)):
                max_idx.append(sorted_idx[k])
                # # Strategy 2
                # if (data_in_this_row[max_idx].sum() /
                #         data_in_this_row.sum() > threshold):
                #     break
                # Strategy 1
                v = np.zeros(self.unnorm_dist.shape[1])
                for _k in max_idx:
                    v = v + self.alpha * laplacian[i, j_in_this_row[_k]] * unnorm_dist[j_in_this_row[_k]]
                v = v + y_static[i]
                err = np.sqrt(((v-unnorm_dist[i])**2).sum())
                err_percent = err / np.sqrt((unnorm_dist[i]**2).sum())
                if err_percent < (1 - self.filter_threshold):
                    break
            for k in max_idx:
                simplified_affinity_matrix.data[start:end][k] = 1
        # remove in-degree of labeled instances
        train_y = self.data.get_train_label()
        labeled_idx = train_y != -1
        logger.info("labeled num: {}".format(sum(labeled_idx)))
        simplified_affinity_matrix[labeled_idx] *= 0
        # test
        simplified_laplacian_matrix = \
            build_laplacian_graph(simplified_affinity_matrix)
        simplified_F, L, _, _, _ = self._propagation(simplified_laplacian_matrix,
                                               simplified_affinity_matrix,
                                               np.array(self.data.get_train_label()),
                                               alpha=self.alpha,
                                               normalized=False)
        mis_match_idx = simplified_F.argmax(axis=1) != self.pred_dist.argmax(axis=1)
        logger.info("sparse percent: {}".format(simplified_affinity_matrix.sum() / \
                                                len(self.influence_matrix.data)))
        logger.info("simplification error: {}"
                    .format(sum(mis_match_idx) / self.pred_dist.shape[0]))
        ground_truth = self.data.get_train_ground_truth()
        logger.info("pre acc: {}"
                    .format(accuracy_score(self.pred_dist.argmax(axis=1), ground_truth)))
        logger.info("now acc: {}".format(accuracy_score(simplified_F.argmax(axis=1), ground_truth)))
        simplified_affinity_matrix.eliminate_zeros()
        propagation_path = self.get_path_to_label(self.process_data, simplified_affinity_matrix)
        return simplified_affinity_matrix, propagation_path

    def _find_path(self, path_stack, stack_len, edge_indices, edge_indptr, propagation_path, path_stack_flag):
        if stack_len == 0:
            return
        top_node = path_stack[stack_len-1]
        propagation_path[top_node].append(copy.copy(path_stack))
        edge_start_idx = edge_indptr[top_node]
        edge_end_idx = edge_indptr[top_node+1]
        for edge_idx in range(edge_start_idx, edge_end_idx):
            edge_id = int(edge_indices[edge_idx])
            if path_stack_flag[edge_id]:
                continue
            path_stack.append(edge_id)
            path_stack_flag[edge_id] = True
            self._find_path(path_stack, stack_len+1, edge_indices, edge_indptr, propagation_path, path_stack_flag)
        path_stack.pop()
        path_stack_flag[top_node] = False

    def get_path_to_label(self, process_data, influence_matrix):
        iternum = process_data.shape[0]
        nodenum = process_data.shape[1]
        propagation_path = [[] for i in range(nodenum)]
        influence_matrix_trans = influence_matrix.transpose(copy = True).tocsr()
        edge_indices = influence_matrix_trans.indices
        edge_indptr = influence_matrix_trans.indptr
        labeled_idx = []
        for i, label in enumerate(self.data.get_train_label()):
            if label > -1:
                labeled_idx.append(i)
        for labeled in labeled_idx:
            path_stack_flag = {}
            for i in range(nodenum):
                path_stack_flag[i] = False
            path_stack_flag[int(labeled)] = True
            self._find_path([int(labeled)], 1, edge_indices, edge_indptr, propagation_path, path_stack_flag)
        propagation_path_cnt = 0
        for node_paths in propagation_path:
            propagation_path_cnt += len(node_paths)
        print("propagation path num:", propagation_path_cnt)
        return propagation_path

    def evaluate(self):
        train_X = self.data.get_train_X()
        test_X = self.data.get_test_X()
        test_y = self.data.get_test_ground_truth()
        pred = self.pred_dist
        logger.info("test_X.shape: {}".format(str(test_X.shape)))
        nn_fit = NearestNeighbors(self.n_neighbor, n_jobs=-4).fit(train_X)
        weight_matrices = nn_fit.kneighbors(test_X, return_distance=False)
        probabilities = np.array([
                np.sum(pred[weight_matrix], axis=0)
                for weight_matrix in weight_matrices])
        normalizer = np.atleast_2d(np.sum(probabilities, axis=1)).T
        probabilities /= normalizer
        acc = accuracy_score(test_y, probabilities.argmax(axis=1))
        logger.info("test accuracy: {}".format(acc))

    def _projection(self):
        # TODO: this function is disabled
        projection_filepath = os.path.join(self.data_root, config.projection_buffer_name)
        if check_exist(projection_filepath) \
                and (not self.signal_state):
            logger.info("loading projection result from buffer")
            self.model = pickle_load_data(projection_filepath)
            return

        # get projection from scratch
        train_X = self.data.get_train_X()
        train_y = self.data.get_train_label()
        train_y = np.array(train_y)
        train_gt = self.data.get_train_ground_truth()
        train_gt = np.array(train_gt)
        embedder = Embedder("tsne", n_components=2, random_state=123)
        self.embed_X = embedder.fit_transform(train_X, train_y)
        logger.info("get projection result")

        # save projection buffer
        pickle_save_data(projection_filepath, self.embed_X)
        return

    def get_in_out_degree(self, influence_matrix):
        edge_indices = influence_matrix.indices
        edge_indptr = influence_matrix.indptr
        node_num = edge_indptr.shape[0]-1

        degree = np.zeros((node_num, 2))
        for node_id in range(node_num):
            start_idx = edge_indptr[node_id]
            end_idx = edge_indptr[node_id+1]
            degree[node_id][1] += end_idx-start_idx
            for target_id in edge_indices[start_idx:end_idx]:
                degree[target_id][0] += 1
        return degree

    def get_graph_and_process_data(self, filter_threshold=None):
        if filter_threshold is not None:
            self.filter_threshold = filter_threshold
            self.propagation_path = None
            self.simplified_affinity_matrix = None
        if (self.propagation_path == None) or (self.simplified_affinity_matrix == None):
            self.simplified_affinity_matrix, self.propagation_path = self.simplify_influence_matrix(threshold=self.filter_threshold)
        return self.graph, self.process_data, self.simplified_affinity_matrix, self.propagation_path, self.get_in_out_degree(self.simplified_affinity_matrix)

    def get_loss(self):
        return self.loss

    def get_ent(self):
        return self.ent

    def get_flows(self, idxs):
        iter = len(self.labels)
        selected_flows = np.zeros((iter-1, len(self.class_list), len(self.class_list)))
        for i in range(iter-1):
            selected_flows[i] = flow_statistic(self.labels[i][idxs], \
                self.labels[i+1][idxs], self.class_list)
        label_sums = np.zeros((self.labels.shape[0], selected_flows.shape[1]))
        for i in range(self.labels.shape[0]):
            labels = self.labels[i][idxs]
            bins = np.bincount(labels + 1)
            missed_num = label_sums[i].shape[0] - len(bins)
            label_sums[i,:] = np.concatenate((bins, np.zeros(missed_num)))
        return label_sums, selected_flows

    def get_selected_flows(self, data):
        _, iter_prev, cls_prev, iter_next, cls_next = data.split("-")
        iter_prev, cls_prev, iter_next, cls_next = \
            [int(iter_prev), int(cls_prev) - 1, int(iter_next), int(cls_next) - 1]
        print(iter_prev, cls_prev, iter_next, cls_next)

        print("total instance num", len(self.labels[0]))
        idxs = []
        for i in range(len(self.labels[0])):
            if (self.labels[iter_prev][i] == cls_prev and \
                self.labels[iter_next][i] == cls_next):
                idxs.append(i)
        idxs = np.array(idxs)
        print("selected instances num", len(idxs))
        iter = len(self.labels)
        selected_flows = np.zeros((iter-1, len(self.class_list), len(self.class_list)))
        for i in range(iter-1):
            selected_flows[i] = flow_statistic(self.labels[i][idxs], \
                self.labels[i+1][idxs], self.class_list)
        return selected_flows, idxs
        
    def get_data(self):
        train_X = self.data.get_train_X()
        train_y = self.data.get_train_label()
        return train_X, train_y
