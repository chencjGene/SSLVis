import numpy as np
import os
from scipy import sparse
from scipy.sparse import csgraph
from scipy.stats import entropy
from time import time
from time import sleep
from tqdm import tqdm
import warnings
import copy


from sklearn.neighbors import kneighbors_graph
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.utils.extmath import safe_sparse_dot
from sklearn.neighbors.unsupervised import NearestNeighbors
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics.pairwise import euclidean_distances, paired_distances

from ..utils.config_utils import config
from ..utils.log_utils import logger
from ..utils.helper_utils import check_exist, \
    pickle_load_data, pickle_save_data, flow_statistic, async, async_once
from ..utils.embedder_utils import Embedder

from .data import Data, GraphData
from .LSLabelSpreading import LSLabelSpreading
from .model_helper import propagation, approximated_influence, exact_influence
from .model_update import local_search_k
from .model_helper import build_laplacian_graph

DEBUG = False

def change_local(selected_idxs, neighbors, affinity_matrix, local_k):
    from scipy import sparse
    selected_num = len(selected_idxs)
    instance_num = neighbors.shape[0]
    indptr = [i * local_k for i in range(selected_num + 1)]
    indices = neighbors[selected_idxs][:, :local_k].reshape(-1).tolist()
    data = neighbors[selected_idxs][:, :local_k].reshape(-1)
    data = (data * 0 + 1.0).tolist()
    selected_affinity_matrix = sparse.csr_matrix((data, indices, indptr),
                                                 shape=(selected_num, instance_num)).toarray()
    affinity_matrix = affinity_matrix.toarray()
    affinity_matrix[selected_idxs, :] = selected_affinity_matrix
    affinity_matrix = sparse.csr_matrix(affinity_matrix)

    # affinity_matrix = affinity_matrix + affinity_matrix.T
    affinity_matrix = sparse.csr_matrix((np.ones(len(affinity_matrix.data)).tolist(),
                                         affinity_matrix.indices, affinity_matrix.indptr),
                                        shape=(instance_num, instance_num))
    return affinity_matrix

class SSLModel(object):
    def __init__(self, dataname, labeled_num=None, total_num=None, seed=123):
        self.dataname = dataname
        self.data_root = os.path.join(config.data_root, self.dataname)

        self.model = None
        self.embed_X = None
        self.n_neighbor = None
        # signal is used to indicate that all data should be updated
        self.signal_state = False
        self._propagation = propagation
        self.alpha = 0.2

        self.data = GraphData(self.dataname, labeled_num, total_num)
        # self.data.case_set_rest_idxs()
        self.selected_dir = self.data.selected_dir
        self.n_neighbor = 6
        self.filter_threshold = 0.7
        logger.info("n_neighbor: {}".format(self.n_neighbor))

        self.simplified_affinity_matrix = None
        self.propagation_path_from = None
        self.propagation_path_to = None
        # self._get_signal_state()

    def init(self, k=None, filter_threshold=None, evaluate=True, simplifying=True):
        if k is not None:
            self.n_neighbor = k
        if filter_threshold is not None:
            self.filter_threshold = filter_threshold
        logger.info("n_neighbor and filter_threshold has been updated: {} {}".format(
            self.n_neighbor, self.filter_threshold
        ))
        print("n_neighbor and filter_threshold has been updated: {} {}".format(
            self.n_neighbor, self.filter_threshold
        ))
        self.propagation_path_from = None
        self.propagation_path_to = None
        self.simplified_affinity_matrix = None
        # # # TODO: for debug
        # self.case_labeling()
        # self.case_labeling2()
        self._training(evaluate=evaluate, simplifying=simplifying)

        # self._training(evaluate=False, simplifying=False)
        # # # TODO: for debug
        # train_pred = self.labels[-1]
        # train_gt = self.data.get_train_ground_truth()
        # affinity_matrix = self.data.affinity_matrix
        # for k, i in [[2, 5]]:
        #     # for k,i in [[2,5]]:
        #     inds = train_gt == i
        #     inds[train_pred == i] = False
        #     selected_idxs = np.array(range(len(inds)))[inds]
        #     affinity_matrix = change_local(selected_idxs, self.data.get_neighbors(), affinity_matrix, k)
        # self.data.affinity_matrix = affinity_matrix
        # self._training(rebuild=False, evaluate=True, simplifying=True)


        logger.info("init finished")

    def setK(self, k=None):
        if k is not None:
            self.n_neighbor = k

    def _clean_buffer(self):
        self.simplified_affinity_matrix = None
        self.propagation_path_from = None
        self.propagation_path_to = None

    def _training(self, rebuild=True, evaluate=False, simplifying=True):
        self._clean_buffer()
        affinity_matrix = self.data.get_graph(self.n_neighbor, rebuild=rebuild)
        laplacian = build_laplacian_graph(affinity_matrix)
        train_y = self.data.get_train_label()
        train_gt = self.data.get_train_ground_truth()
        train_gt = np.array(train_gt)
        pred_dist, loss, ent, process_data, unnorm_dist = \
            self._propagation(laplacian, affinity_matrix, train_y,
                              alpha=self.alpha, process_record=True,
                              normalized=True)
        # labels = [int(np.argmax(process_data[j][id])) if np.max(process_data[j][id]) > 1e-4 else -1 for j in
        #           range(iter_num)]
        iter = len(loss)
        self.n_iters = iter
        # get labels and flows
        self.labels = process_data.argmax(axis=2)
        self.unnorm_dist = unnorm_dist
        max_process_data = process_data.max(axis=2)
        self.labels[max_process_data == 0] = -1
        logger.info("unpropagated instance num: {}".format(sum(self.labels[-1]==-1)))
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
        # self.evaluate(); exit()


        if simplifying:
            # get simplififed matrix asynchronously
            self.simplify_influence_matrix()

        if evaluate:
            # self.evaluate()
            self.adaptive_evaluation()
            # self.adaptive_evaluation_bkp()
            # self.adaptive_evaluation_v2()

        # record_state
        self.data.record_state(self.pred_dist)

        logger.info("_training finished")

    def _influence_matrix(self):
        affinity_matrix = self.data.get_graph(self.n_neighbor)
        laplacian = build_laplacian_graph(affinity_matrix)
        train_y = self.data.get_train_label()
        logger.info("begin load influence matrix")
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
                                   laplacian, self.alpha, train_y, self.n_iters)
        pickle_save_data(influence_matrix_path, self.influence_matrix)
        return

    @async_once
    def simplify_influence_matrix(self, threshold=0.7):
        self._influence_matrix()
        logger.info("begin simplify influence matrix")
        affinity_matrix = self.data.get_graph()
        laplacian = build_laplacian_graph(affinity_matrix).tocsr()
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
        # TODO remove paopagation 2020.2.15
        propagation_path_from, propagation_path_to = self.get_path_to_label(self.process_data, simplified_affinity_matrix)
        self.simplified_affinity_matrix = simplified_affinity_matrix
        self.propagation_path_from = propagation_path_from
        self.propagation_path_to = propagation_path_to
        logger.info("end async function")

    def simplification_end(self, sleep_time = 0.2):
        if self.simplified_affinity_matrix is not None:
            return True
        else:
            logger.info("simplification has not finished. sleep {}s".format(sleep_time))
            sleep(sleep_time)
            return False

    def local_search_k(self, selected_idxs, k_list=None, selected_categories=None, simplifying=True):
        if k_list is None:
            k_list = list(range(1,10))
        if selected_categories is not None:
            old_selected_idxs = selected_idxs.copy() 
            selected_idxs = []
            train_pred = self.label[-1]
            for idx in old_selected_idxs:
                if selected_categories[train_pred[i]]:
                    selected_idxs.append(idx)
            logger.info("bincount info: {}".format(str(np.bincount(train_pred[np.array(selected_idxs)]))))
        train_gt = self.data.get_train_ground_truth()
        train_y = self.data.get_train_label()
        neighbors = self.data.get_neighbors()
        affinity_matrix = self.data.get_graph()
        affinity_matrix.setdiag(0)
        affinity_matrix, pred = local_search_k(k_list, self.n_neighbor, 
            selected_idxs, self.unnorm_dist, affinity_matrix, 
            train_y, neighbors, train_gt)
        # logger.info("searched affinity_matrix diff: {}".format(
        #     np.abs(self.affinity_matrix - affinity_matrix).sum()
        # ))
        laplacian_matrix = build_laplacian_graph(affinity_matrix)
        pred_y = pred.argmax(axis=1)
        acc = accuracy_score(train_gt, pred_y)
        logger.info("model accuracy without full update: {}".format(acc))
        # self.affinity_matrix = affinity_matrix
        # self.laplacian = laplacian_matrix
        self.data.affinity_matrix = affinity_matrix
        self._training(rebuild=False, evaluate=True, simplifying=simplifying)
        return pred

    def get_path_to_label(self, process_data, influence_matrix):
        iternum = process_data.shape[0]
        nodenum = process_data.shape[1]
        propagation_path_from = [[] for i in range(nodenum)]
        propagation_path_to = [[] for i in range(nodenum)]
        edge_indices = influence_matrix.indices
        edge_indptr = influence_matrix.indptr
        for node_id in range(nodenum):
            start_idx = edge_indptr[node_id]
            end_idx = edge_indptr[node_id+1]
            for target_id in edge_indices[start_idx:end_idx]:
                propagation_path_from[int(node_id)].append(int(target_id))
                propagation_path_to[int(target_id)].append(int(node_id))
        return propagation_path_from, propagation_path_to

    @async_once
    def evaluate(self, n_neighbor = -1):
        train_X = self.data.get_train_X()
        test_X = self.data.get_test_X()
        test_y = self.data.get_test_ground_truth()
        pred = self.pred_dist
        nn_fit = self.data.get_neighbors_model()
        weight_matrices = nn_fit.kneighbors(test_X, self.n_neighbor if n_neighbor==-1 else n_neighbor, return_distance=False)
        probabilities = np.array([
                np.sum(pred[weight_matrix], axis=0)
                for weight_matrix in weight_matrices])
        normalizer = np.atleast_2d(np.sum(probabilities, axis=1)).T
        probabilities /= normalizer
        acc = accuracy_score(test_y, probabilities.argmax(axis=1))
        logger.info("test accuracy: {}".format(acc))
        return probabilities.argmax(axis=1)

    def adaptive_evaluation_unasync(self, pred=None):
        affinity_matrix = self.data.get_graph()
        affinity_matrix.setdiag(0)
        if pred is None:
            pred = self.pred_dist
        test_X = self.data.get_test_X()
        test_y = self.data.get_test_ground_truth()
        test_neighbors = self.data.get_test_neighbors()
        logger.info("neighbor_result got!")
        estimate_k = 3
        s = 0
        labels = []
        rest_idxs = self.data.get_rest_idxs()
        m = self.data.get_new_id_map()
        adaptive_ks = []
        for i in tqdm(range(test_X.shape[0])):
            j_in_this_row = test_neighbors[i, :]
            j_in_this_row = j_in_this_row[j_in_this_row != -1]
            estimated_idxs = j_in_this_row[:estimate_k]
            estimated_idxs = [m[i] for i in estimated_idxs]
            adaptive_k = affinity_matrix[estimated_idxs, :].sum() / estimate_k
            selected_idxs = j_in_this_row[:int(adaptive_k)]
            selected_idxs = [m[i] for i in selected_idxs]
            p = pred[selected_idxs].sum(axis=0)
            labels.append(p.argmax())
            s += adaptive_k
            adaptive_ks.append(adaptive_k)

        acc = accuracy_score(test_y, labels)
        logger.info("test accuracy: {}".format(acc))
        print(s / test_X.shape[0])
        return labels, np.array(adaptive_ks)

    @async_once
    def adaptive_evaluation(self, pred=None):
        affinity_matrix = self.data.get_graph()
        affinity_matrix.setdiag(0)
        if pred is None:
            pred = self.pred_dist
        test_X = self.data.get_test_X()
        test_y = self.data.get_test_ground_truth()
        test_neighbors = self.data.get_test_neighbors()
        logger.info("neighbor_result got!")
        estimate_k = 3
        s = 0
        labels = []
        rest_idxs = self.data.get_rest_idxs()
        m = self.data.get_new_id_map()
        adaptive_ks = []
        for i in tqdm(range(test_X.shape[0])):
            j_in_this_row = test_neighbors[i, :]
            j_in_this_row = j_in_this_row[j_in_this_row != -1]
            estimated_idxs = j_in_this_row[:estimate_k]
            estimated_idxs = [m[i] for i in estimated_idxs]
            adaptive_k = affinity_matrix[estimated_idxs, :].sum() / estimate_k
            selected_idxs = j_in_this_row[:int(adaptive_k)]
            selected_idxs = [m[i] for i in selected_idxs]
            p = pred[selected_idxs].sum(axis=0)
            labels.append(p.argmax())
            s += adaptive_k
            adaptive_ks.append(adaptive_k)

        acc = accuracy_score(test_y, labels)
        logger.info("test accuracy: {}".format(acc))
        print(s / test_X.shape[0])
        return labels, np.array(adaptive_ks)

    @async_once
    def adaptive_evaluation_bkp(self):
        train_X = self.data.get_train_X()
        affinity_matrix = self.data.get_graph()
        affinity_matrix.setdiag(0)
        pred = self.pred_dist
        test_X = self.data.get_test_X()
        test_y = self.data.get_test_ground_truth()
        # nn_fit = self.data.get_neighbors_model()
        nn_fit = NearestNeighbors(n_jobs=-4).fit(train_X)
        logger.info("nn construction finished!")
        neighbor_result = nn_fit.kneighbors_graph(test_X,
                                            100,
                                            mode="distance")
        logger.info("neighbor_result got!")
        estimate_k = 5
        s = 0
        rest_idxs = self.data.get_rest_idxs()
        # removed_idxs = self.remv
        labels = []
        for i in tqdm(range(test_X.shape[0])):
            start = neighbor_result.indptr[i]
            end = neighbor_result.indptr[i + 1]
            j_in_this_row = neighbor_result.indices[start:end]
            data_in_this_row = neighbor_result.data[start:end]
            sorted_idx = data_in_this_row.argsort()
            assert (len(sorted_idx) == 100)
            j_in_this_row = j_in_this_row[sorted_idx]
            estimated_idxs = j_in_this_row[:estimate_k]
            estimated_idxs = np.array([i for i in estimated_idxs if i in rest_idxs])
            adaptive_k = affinity_matrix[estimated_idxs, :].sum() / estimate_k
            selected_idxs = j_in_this_row[:int(adaptive_k)]
            p = pred[selected_idxs].sum(axis=0)
            labels.append(p.argmax())
            s += adaptive_k
            # print(adaptive_k)
        acc = accuracy_score(test_y, labels)
        logger.info("test accuracy: {}".format(acc))
        print(s/test_X.shape[0])

    @async_once
    def adaptive_evaluation_v2(self):
        train_X = self.data.get_train_X()
        affinity_matrix = self.data.get_graph()
        pred = self.pred_dist
        test_X = self.data.get_test_X()
        label_cnt = pred.shape[1]
        test_y = self.data.get_test_ground_truth()
        nn_fit = self.data.get_neighbors_model()
        logger.info("nn construction finished!")
        max_k = 31
        neighbor_result = nn_fit.kneighbors_graph(test_X,
                                                  max_k,
                                                  mode="distance")
        s = 0
        low_bound = 3
        degree = self.get_in_out_degree(affinity_matrix)[:,1]
        degree = np.sqrt(1/degree)
        labels = []
        logger.info("begin test")
        neighbors = []
        neighbors_pred = []
        fs = []
        ks = []
        f_tests = []
        for test_node_id in range(test_X.shape[0]):
            start = neighbor_result.indptr[test_node_id]
            end = neighbor_result.indptr[test_node_id + 1]
            j_in_this_row = neighbor_result.indices[start:end]
            data_in_this_row = neighbor_result.data[start:end]
            sorted_idx = data_in_this_row.argsort()
            assert (len(sorted_idx) == max_k)
            j_in_this_row = j_in_this_row[sorted_idx]
            min_f = np.finfo(np.float).max
            min_k = 0
            min_f_test = np.zeros((label_cnt))
            sims = []
            for k in range(low_bound,max_k):
                estimated_idxs = j_in_this_row[:k]
                # get f_test
                neighbor_tmp = pred[estimated_idxs]*degree[estimated_idxs].reshape((k,1))
                f_test = np.sum(neighbor_tmp, axis=0)
                d_test = np.sqrt(k)
                f_test *= d_test/k
                # get label similarity
                f = 0
                f_tmp = f_test / d_test - neighbor_tmp
                f = np.sum(np.diagonal(np.dot(f_tmp, f_tmp.T)))
                f = f / k
                sims.append(f)
                if f < min_f:
                    min_f = f
                    min_k = k
                    min_f_test = f_test
            s += min_k
            p = min_f_test
            labels.append(int(p.argmax()))
            fs.append(min_f)
            ks.append(min_k)
            neighbors.append(j_in_this_row.tolist())
            neighbors_pred.append(np.argmax(pred[j_in_this_row], axis=1).tolist())
            f_tests.append(min_f_test)
        print(confusion_matrix(test_y, labels))
        acc = accuracy_score(test_y, labels)
        logger.info("test accuracy: {}".format(acc))
        print(s / test_X.shape[0])
        return np.array(labels), np.array(fs), np.array(ks), np.array(neighbors), np.array(neighbors_pred), f_tests


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
            self.propagation_path_from = None
            self.propagation_path_to = None
            self.simplified_affinity_matrix = None
        if (self.propagation_path_from == None) or (self.simplified_affinity_matrix == None):
            # self.simplified_affinity_matrix, self.propagation_path = self.simplify_influence_matrix(threshold=self.filter_threshold)
            while not self.simplification_end():
                pass
        return self.graph, self.process_data, self.simplified_affinity_matrix, self.propagation_path_from, self.propagation_path_to, self.get_in_out_degree(self.simplified_affinity_matrix)

    def get_pred_labels(self):
        return self.labels[-1].copy()

    def get_loss(self):
        return self.loss

    def get_ent(self):
        return self.ent

    def get_flows(self, idxs):
        self.selected_idxs = idxs
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
        idxs = np.array([i for i in idxs if i in self.selected_idxs])
        print("selected instances num", len(idxs))
        iter = len(self.labels)
        selected_flows = np.zeros((iter-1, len(self.class_list), len(self.class_list)))
        for i in range(iter-1):
            selected_flows[i] = flow_statistic(self.labels[i][idxs], \
                self.labels[i+1][idxs], self.class_list)
        return selected_flows, idxs

    def editing_data(self, data):
        self.data.editing_data(data)
        self.data.update_graph(data["deleted_idxs"])
        self._training(rebuild=False, evaluate=True)

    def get_data(self):
        train_X = self.data.get_train_X()
        train_y = self.data.get_train_label()
        return train_X, train_y

    def get_full_data(self):
        train_X = self.data.get_full_train_X()
        train_y = self.data.get_full_train_label()
        return train_X, train_y

    def get_history(self):
        return self.data.return_state()
    
    def set_history(self, id):
        return self.data.change_state(id)

    def retrain(self):
        self._training()
        return self.data.return_state()

    def add_new_categories(self, name, idxs=None):
        label = self.data.add_new_categories(name)
        if idxs is not None:
            labels = [label for i in idxs]
            self.data.label_instance(idxs, labels)
        self._training(rebuild=False, evaluate=True)

    def case_labeling(self):
        lizard = [52, 225, 232, 415, 561, 615, 1009, 1026, 1224, 1246, 1478, 1514, 1657, 1933, 2009, 2065, 2160, 2629,
                  2920, 2925, 3005, 3112, 3281, 3435, 3717, 3979, 3981, 3997, 4428, 4463, 4505, 4522, 4649, 4720, 4773,
                  4827, 4914, 5045, 5055, 5142, 5211, 5480, 5491, 5493, 5606, 5631, 6038, 6281, 6594, 6706, 6774, 6819,
                  6909, 6929, 6942, 7171, 7362, 7503, 7681, 7686, 7897, 7992, 8041, 8067, 8194, 8294, 8405, 8428, 8559,
                  8579, 8621, 8632, 8948, 9076, 9286, 9346, 9422, 9571, 9783, 9812, 9897, 10124, 10196, 10329, 10432,
                  10452, 10627, 10814, 10841, 10914, 10989, 11025, 11201, 11248, 11337, 11385, 11515, 11645, 11730,
                  11844, 11959, 12174, 12298, 12439, 12446, 12559, 12958, 13052, 13158, 13294, 13296, 13436, 13699,
                  13882, 14089, 14259, 14486, 14643, 14685, 14953, 15010, 15252, 15368, 15417, 15593, 15769, 15779,
                  15795, 15851, 15879, 15995, 16115, 16125, 16177, 16217, 16500, 16527, 16604, 16721, 16749, 16794,
                  16955, 16996, 17050, 17253, 17266, 17698, 17754, 17834, 17836, 17989, 18033, 18119, 18158, 18192,
                  18211, 18407, 18496, 18500, 18535, 18785, 18829, 18980, 19008, 19241, 19306, 19477, 19529, 19798,
                  19825, 19943]
        snake = [56, 240, 689, 1032, 1048, 1513, 2043, 2061, 2134, 2302, 2944, 3408, 3568, 3642, 3813, 4434, 4614, 4635,
                 4799, 4814, 5036, 5109, 5516, 6174, 6243, 6382, 6442, 6451, 6499, 6719, 6729, 6852, 6980, 7274, 7481,
                 7994, 8076, 8668, 9152, 9787, 9990, 10015, 10071, 10247, 10279, 10529, 10629, 10772, 10788, 10908,
                 10976, 11410, 11554, 11948, 12002, 12006, 12817, 13020, 13441, 13464, 13532, 13877, 14098, 14316,
                 14335, 14337, 14428, 14810, 15620, 15662, 15831, 17106, 17225, 17229, 17415, 18360, 18870, 19103,
                 19244, 19590, 19704]
        np.random.seed(seed=123)
        selected_lizard = np.random.choice(lizard, 5, replace=False)
        selected_snake = np.random.choice(snake, 5, replace=False)
        self.data.label_instance(selected_lizard, [10, 10, 10, 10, 10])
        self.data.label_instance(selected_snake, [11, 11, 11, 11, 11])
        self.data.add_new_categories("lizard")
        self.data.add_new_categories("snake")

    def case_labeling2(self):
        # self.data.label_instance([2243, 10489], [5,5])
        self.data.label_instance([2243, 7657], [5,5])
