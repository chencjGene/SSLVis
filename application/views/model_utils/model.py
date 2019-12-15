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
from ..utils.helper_utils import check_exist, pickle_load_data, pickle_save_data
from ..utils.embedder_utils import Embedder

from .data import Data
from .LSLabelSpreading import LSLabelSpreading

class SSLModel(object):
    def __init__(self, dataname):
        self.dataname = dataname
        self.data_root = os.path.join(config.data_root, self.dataname)

        self.model = None
        self.embed_X = None
        self.n_neighbor = 200
        self.max_neighbors = 1000
        # signal is used to indicate that all data should be updated
        self.signal_state = False

        self.data = Data(self.dataname)
        self.selected_dir = self.data.selected_dir

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
        neighbors_weight_path = os.path.join(self.selected_dir, "neighbors_weight.npy")
        if os.path.exists(neighbors_path) and os.path.exists(neighbors_weight_path):
            logger.info("neighbors and neighbor_weight exist!!!")
            return
        logger.info("neighbors and neighbor_weight do not exist, preprocessing!")
        train_X = self.data.get_train_X()
        train_y = self.data.get_train_label()
        train_y = np.array(train_y)
        logger.info("data shape: {}, labeled_num: {}"
                    .format(str(train_X.shape), sum(train_y != -1)))
        nn_fit = NearestNeighbors(self.n_neighbor, n_jobs=-4).fit(train_X)
        logger.info("nn construction finished!")
        neighbor_result = nn_fit.kneighbors_graph(nn_fit._fit_X,
                                                   self.max_neighbors,
                                                  # 2,
                                                   mode="distance")
        logger.info("neighbor_result got!")
        neighbors = np.zeros((train_X.shape[0], self.max_neighbors)).astype(int)
        neighbors_weight = np.zeros((train_X.shape[0], self.max_neighbors))
        for i in range(train_X.shape[0]):
            start = neighbor_result.indptr[i]
            end = neighbor_result.indptr[i+1]
            j_in_this_row = neighbor_result.indices[start:end]
            data_in_this_row = neighbor_result.data[start:end]
            sorted_idx = data_in_this_row.argsort()
            assert(len(sorted_idx) == self.max_neighbors)
            j_in_this_row = j_in_this_row[sorted_idx]
            data_in_this_row = data_in_this_row[sorted_idx]
            neighbors[i,:] = j_in_this_row
            neighbors_weight[i,:] = data_in_this_row

        logger.info("preprocessed neighbors got!")

        # save neighbors information
        np.save(neighbors_path, neighbors)
        np.save(neighbors_weight_path, neighbors_weight)

    def _training(self):
        # load neighbors information
        neighbors_path = os.path.join(self.selected_dir, "neighbors.npy")
        neighbors_weight_path = os.path.join(self.selected_dir, "neighbors_weight.npy")
        neighbors = np.load(neighbors_path)
        neighbors_weight = np.load(neighbors_weight_path)
        instance_num = neighbors.shape[0]

        # get knn graph in a csr form
        indptr = [i * self.n_neighbor for i in range(instance_num+1)]
        logger.info("get indptr")
        indices = neighbors[:,:self.n_neighbor].reshape(-1).tolist()
        logger.info("get indices")
        data = neighbors_weight[:,:self.n_neighbor].reshape(-1)
        logger.info("get data")
        data = (data * 0 + 1.0).tolist()
        logger.info("get data in connectivity")
        affinity_matrix = sparse.csr_matrix((data, indices, indptr),
                                            shape=(instance_num, instance_num))
        logger.info("affinity_matrix construction finished!!")
        laplacian = csgraph.laplacian(affinity_matrix, normed=True)
        laplacian = -laplacian
        if sparse.isspmatrix(laplacian):
            diag_mask = (laplacian.row == laplacian.col)
            laplacian.data[diag_mask] = 0.0
        else:
            laplacian.flat[::instance_num + 1] = 0.0  # set diag to 0.0

        train_gt = self.data.get_train_ground_truth()
        train_gt = np.array(train_gt)
        pred_dist, loss, process_data = self._propagation(laplacian, affinity_matrix, process_record=True)
        self.loss = loss
        self.process_data = process_data
        self.graph = affinity_matrix
        iter = len(loss)
        print(process_data.shape)
        pred_y = pred_dist.argmax(axis=1)
        acc = accuracy_score(train_gt, pred_y)
        logger.info("model accuracy: {}, iter: {}".format(acc, iter))


    def _propagation(self, graph_matrix, affinity_matrix, process_record=False, alpha=0.2, max_iter=30,
                     tol=1e-3):
        train_y = self.data.get_train_label()
        y = np.array(train_y)
        # label construction
        # construct a categorical distribution for classification only
        classes = np.unique(y)
        classes = (classes[classes != -1])
        process_data = None


        # D = affinity_matrix.sum(axis=0).getA1() - affinity_matrix.diagonal()
        # affinity_matrix = affinity_matrix.tocoo(copy=True)
        # D = np.sqrt(D)
        # D[D==0] = 1


        n_samples, n_classes = len(y), len(classes)

        if (alpha is None or alpha <= 0.0 or alpha >= 1.0):
            raise ValueError('alpha=%s is invalid: it must be inside '
                             'the open interval (0, 1)' % alpha)
        y = np.asarray(y)
        unlabeled = y == -1
        labeled = (y > -1)

        # initialize distributions
        label_distributions_ = np.zeros((n_samples, n_classes))
        for label in classes:
            label_distributions_[y == label, classes == label] = 1

        y_static_labeled = np.copy(label_distributions_)
        y_static = y_static_labeled * (1 - alpha)

        l_previous = np.zeros((n_samples, n_classes))

        unlabeled = unlabeled[:, np.newaxis]
        if sparse.isspmatrix(graph_matrix):
            graph_matrix = graph_matrix.tocsr()

        if process_record:
            process_data = [label_distributions_]

        n_iter_ = 0
        all_loss = []
        label_distributions_a = safe_sparse_dot(
            graph_matrix, label_distributions_)
        loss = (label_distributions_ ** 2).sum() - \
               np.dot(label_distributions_.reshape(-1),
                      label_distributions_a.reshape(-1))
        loss = loss + paired_distances(label_distributions_[labeled],
                                       y_static_labeled[labeled]).sum()
        all_loss.append(loss)

        for _ in range(max_iter):
            if np.abs(label_distributions_ - l_previous).sum() < tol:
                break

            l_previous = label_distributions_
            label_distributions_a = safe_sparse_dot(
                graph_matrix, label_distributions_)

            label_distributions_ = np.multiply(
                alpha, label_distributions_a) + y_static
            n_iter_ += 1
            if process_record:
                process_data.append(label_distributions_)

            # loss = entropy(label_distributions_.T).sum()
            loss = (label_distributions_**2).sum() - \
                   np.dot(label_distributions_.reshape(-1),
                          label_distributions_a.reshape(-1))
            loss = loss + paired_distances(label_distributions_[labeled],
                                           y_static_labeled[labeled]).sum()
            all_loss.append(loss)

        else:
            warnings.warn(
                'max_iter=%d was reached without convergence.' % max_iter,
                category=ConvergenceWarning
            )
            n_iter_ += 1

        normalizer = np.sum(label_distributions_, axis=1)[:, np.newaxis]
        label_distributions_ /= normalizer

        all_loss = np.array(all_loss)

        if process_data is not None:
            process_data = np.array(process_data)

        return label_distributions_, all_loss, process_data

    def _training_old(self, n_neighbor):
        ssl_model_filepath = os.path.join(self.data_root, config.ssl_model_buffer_name)
        if check_exist(ssl_model_filepath) \
            and (not self.signal_state):
            logger.info("loading ssl model from buffer")
            self.model = pickle_load_data(ssl_model_filepath)
            return

        # training ssl model from scratch
        train_X = self.data.get_train_X()
        train_y = self.data.get_train_label()
        train_y = np.array(train_y)
        train_gt = self.data.get_train_ground_truth()
        train_gt = np.array(train_gt)
        logger.info("data shape: {}, labeled_num: {}"
                    .format(str(train_X.shape), sum(train_y != -1)))
        self.model = LSLabelSpreading(kernel="knn", n_neighbors=n_neighbor, n_jobs=-4)
        graph = self.model.get_graph(train_X, train_y)
        logger.info("got graph")
        self.model.fit(train_X, train_y)
        logger.info("model fitting finished")
        # pred_y = self.model.predict(train_X)
        pred_y = self.model.label_distributions_.argmax(axis=1)
        acc = accuracy_score(train_gt, pred_y)
        logger.info("model accuracy: {}".format(acc))

        # save ssl model buffer
        pickle_save_data(ssl_model_filepath, self.model)
        return

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
        return self.graph, self.process_data

    def get_loss(self):
        return self.loss
