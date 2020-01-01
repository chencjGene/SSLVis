import numpy as np
import os
from scipy import sparse
from scipy.sparse import csgraph
from scipy.stats import entropy
from time import time
from tqdm import tqdm
import warnings

from sklearn.neighbors import kneighbors_graph
from sklearn.metrics import accuracy_score
from sklearn.utils.extmath import safe_sparse_dot
from sklearn.neighbors.unsupervised import NearestNeighbors
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics.pairwise import euclidean_distances, paired_distances

from ..utils.config_utils import config
from ..utils.log_utils import logger
from ..utils.helper_utils import check_exist, \
    pickle_load_data, pickle_save_data
from ..utils.embedder_utils import Embedder

from .data import Data
from .LSLabelSpreading import LSLabelSpreading
from .model_helper import propagation, approximated_influence, exact_influence

DEBUG = True


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
        self.alpha = 0.5

        self.data = Data(self.dataname, labeled_num, total_num)
        self.selected_dir = self.data.selected_dir
        # self.n_neighbor = int(np.sqrt(self.data.get_train_num()))
        self.n_neighbor = 7
        logger.info("n_neighbor: {}".format(self.n_neighbor))

        self._get_signal_state()
        self._init()

    def _init(self):
        # self._training_old(self.n_neighbor)
        self._preprocess_neighbors()
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

    def _training(self):
        # load neighbors information
        neighbors_path = os.path.join(self.selected_dir, "neighbors.npy")
        neighbors_weight_path = os.path.join(self.selected_dir,
                                             "neighbors_weight.npy")
        neighbors = np.load(neighbors_path)
        neighbors_weight = np.load(neighbors_weight_path)
        instance_num = neighbors.shape[0]
        train_y = self.data.get_train_label()
        train_y = np.array(train_y)

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

        train_gt = self.data.get_train_ground_truth()
        train_gt = np.array(train_gt)
        pred_dist, loss, process_data = \
            self._propagation(laplacian, affinity_matrix, train_y,
                              alpha=self.alpha, process_record=True,
                              normalized=False)
        self.loss = loss
        self.process_data = process_data
        self.pred_dist = pred_dist
        self.graph = affinity_matrix
        iter = len(loss)
        print(process_data.shape)
        pred_y = pred_dist.argmax(axis=1)
        acc = accuracy_score(train_gt, pred_y)
        logger.info("model accuracy: {}, iter: {}".format(acc, iter))

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
            approximated_influence(pred_dist, affinity_matrix,
                                   laplacian, self.alpha, train_y)
        pickle_save_data(influence_matrix_path, self.influence_matrix)
        return

    def simplify_influence_matrix(self, threshold=0.7):
        logger.info("begin simplify influence matrix")
        simplified_affinity_matrix = self.influence_matrix.copy() * 0
        for i in range(simplified_affinity_matrix.shape[0]):
            start = self.influence_matrix.indptr[i]
            end = self.influence_matrix.indptr[i + 1]
            data_in_this_row = self.influence_matrix.data[start:end]
            sorted_idx = data_in_this_row.argsort()[::-1]
            max_idx = []
            for k in range(len(sorted_idx)):
                max_idx.append(sorted_idx[k])
                if (data_in_this_row[max_idx].sum() /
                        data_in_this_row.sum() > threshold):
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
        simplified_F, L, _ = self._propagation(simplified_laplacian_matrix,
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

        return simplified_affinity_matrix

    def _projection(self):
        # this function is disabled
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

    def get_graph_and_process_data(self):
        return self.graph, self.process_data, self.simplify_influence_matrix(threshold=0.7)

    def get_loss(self):
        return self.loss

    def get_data(self):
        train_X = self.data.get_train_X()
        train_y = self.data.get_train_label()
        return train_X, train_y
