import numpy as np
import os
import abc
from scipy import sparse
from anytree import Node
from anytree.exporter import DictExporter

from sklearn.neighbors.unsupervised import NearestNeighbors

from application.views.utils.config_utils import config
from application.views.utils.helper_utils import pickle_save_data, json_load_data,\
    pickle_load_data, json_save_data, check_dir
from application.views.utils.log_utils import logger

from .model_helper import build_laplacian_graph

class Data(object):
    '''
    1. read data from buffer
    2. manage history state
    '''
    def __init__(self, dataname, labeled_num=None, total_num=None, seed=123):
        self.dataname = dataname
        self.data_root = os.path.join(config.data_root, self.dataname)

        self.X = None
        self.y = None
        self.train_idx = []
        self.valid_idx = []
        self.test_idx = []
        self.labeled_idx = []
        self.class_name = []

        self.selected_labeled_num = labeled_num
        self.selected_total_num = total_num
        self.seed = seed
        self.selected_dir = None
        self.rest_idxs = None

        self._load_data()

    def _load_data(self):
        processed_data_filename = os.path.join(self.data_root, config.processed_dataname)
        processed_data = pickle_load_data(processed_data_filename)
        self.X = processed_data[config.X_name]
        self.y = processed_data[config.y_name]
        self.y = np.array(self.y).astype(int)
        self.train_idx = processed_data[config.train_idx_name]
        self.valid_idx = processed_data[config.valid_idx_name]
        self.test_idx = processed_data[config.test_idx_name]
        self.labeled_idx = processed_data[config.labeled_idx_name]
        self.unlabeled_idx = processed_data[config.unlabeled_idx_name]
        self.class_names = processed_data[config.class_name]
        self.add_info = processed_data[config.add_info_name]

        if self.selected_labeled_num is None and self.selected_total_num is None:
            self.selected_labeled_num = self.add_info.get("default_selected_labeled_num", None)
            self.selected_total_num = self.add_info.get("default_selected_total_num", None)
            self.seed = self.add_info.get("default_seed", 123)

        # produce unlabeled data
        assert(self.selected_labeled_num is not None and self.selected_total_num is not None)
        dir_name = "labeled-" + str(self.selected_labeled_num) + \
            ".total-" + str(self.selected_total_num) + ".seed-" + str(self.seed)
        logger.info(dir_name)
        dir_path = os.path.join(self.data_root, dir_name)
        check_dir(dir_path)
        self.selected_dir = dir_path
        idx_info_path = os.path.join(dir_path, "idx_info.pkl")
        if os.path.exists(idx_info_path):
            logger.info("idx info exists in: {}".format(idx_info_path))
            idx_info = pickle_load_data(idx_info_path)
            self.train_idx = idx_info["train_idx"]
            self.selected_labeled_idx = idx_info["selected_labeled_idx"]
            self.rest_idxs = np.array(range(len(self.train_idx)))
            return
        # selected_labeled_idx = np.random.choice(self.labeled_idx, self.selected_labeled_num, replace=False)
        # class balance selection
        selected_labeled_num_in_each_class = np.zeros(len(self.class_names))
        class_num = len(selected_labeled_num_in_each_class)
        num_per_class = self.selected_labeled_num // class_num
        selected_labeled_num_in_each_class = (np.ones(class_num) * num_per_class).astype(int)
        rest_num = self.selected_labeled_num - num_per_class * class_num
        if rest_num > 0:
            idx = np.random.choice(class_num, rest_num, replace=False)
            selected_labeled_num_in_each_class[idx] += 1
        selected_labeled_idx = []
        labeled_y = self.y[self.labeled_idx]
        for i in range(class_num):
            labeled_idx_in_this_class = self.labeled_idx[labeled_y==i]
            selected_labeled_idx_in_this_class = \
                np.random.choice(labeled_idx_in_this_class, selected_labeled_num_in_each_class[i], replace=False)
            selected_labeled_idx = selected_labeled_idx + selected_labeled_idx_in_this_class.tolist()
        selected_labeled_idx = np.array(selected_labeled_idx)
        selected_labeled_idx.sort()

        # get unlabeled idx
        rest_selected_labeled_num = self.selected_total_num - self.selected_labeled_num
        rest_selected_labeled_idx = np.random.choice(self.unlabeled_idx,
                                                     rest_selected_labeled_num,
                                                     replace=False)
        train_idx = np.hstack((selected_labeled_idx, rest_selected_labeled_idx))
        train_idx.sort()
        self.train_idx = train_idx
        self.selected_labeled_idx = selected_labeled_idx
        idx_info = {
            "selected_labeled_idx": selected_labeled_idx,
            "train_idx": train_idx
        }
        pickle_save_data(idx_info_path, idx_info)

    def case_set_rest_idxs(self):
        gt = self.get_train_ground_truth()
        self.rest_idxs = np.array(range(len(gt)))[gt!=-1]
        print("rest_idxs len: ", len(self.rest_idxs))

    def get_rest_idxs(self):
        return self.rest_idxs.copy()

    def get_train_num(self):
        return len(self.train_idx)

    def get_class_names(self):
        return self.class_names

    def get_train_X(self):
        return self.X[np.array(self.train_idx)].copy()[self.rest_idxs]

    def get_train_label(self):
        y = np.ones(self.X.shape[0]) * -1
        y[np.array(self.selected_labeled_idx)] = self.y[np.array(self.selected_labeled_idx)]
        y = y[np.array(self.train_idx)]
        return y.astype(int)[self.rest_idxs]

    def get_train_idx(self):
        return self.train_idx.copy()[self.rest_idxs]

    def get_train_ground_truth(self):
        return self.y[np.array(self.train_idx)].copy().astype(int)[self.rest_idxs]

    def get_test_X(self):
        return self.X[np.array(self.test_idx)].copy()

    def get_test_ground_truth(self):
        return self.y[np.array(self.test_idx)].copy().astype(int)

    def remove_instance(self, idxs):
        None

    def label_instance(self, idxs, labels):
        None

class GraphData(Data):
    def __init__(self, dataname, labeled_num=None, total_num=None, seed=123):
        super(GraphData, self).__init__(dataname, labeled_num, total_num, seed)
        
        self.max_neighbors = 1000
        self.affinity_matrix = None
        self.state_idx = 0
        self.state = {}
        self.state_data = {}
        self.current_state = None

    def _preprocess_neighbors(self):
        neighbors_model_path = os.path.join(self.selected_dir, "neighbors_model.pkl")
        neighbors_path = os.path.join(self.selected_dir, "neighbors.npy")
        neighbors_weight_path = os.path.join(self.selected_dir,
                                             "neighbors_weight.npy")
        if os.path.exists(neighbors_model_path) and \
            os.path.exists(neighbors_path) and \
            os.path.exists(neighbors_weight_path):
            logger.info("neighbors and neighbor_weight exist!!!")
            return
        logger.info("neighbors and neighbor_weight "
                    "do not exist, preprocessing!")
        train_X = self.get_train_X()
        train_y = self.get_train_label()
        train_y = np.array(train_y)
        self.max_neighbors = min(len(train_y), self.max_neighbors)
        logger.info("data shape: {}, labeled_num: {}"
                    .format(str(train_X.shape), sum(train_y != -1)))
        nn_fit = NearestNeighbors(7, n_jobs=-4).fit(train_X)
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
        pickle_save_data(neighbors_model_path, nn_fit)
        np.save(neighbors_path, neighbors)
        np.save(neighbors_weight_path, neighbors_weight)

    def get_graph(self, n_neighbor=None):
        if self.affinity_matrix is None:
            self._construct_graph(n_neighbor)
        return self.affinity_matrix.copy()

    def _construct_graph(self, n_neighbor=None):
        # create neighbors buffer
        self._preprocess_neighbors()

        # load neighbors information
        neighbors_path = os.path.join(self.selected_dir, "neighbors.npy")
        neighbors_weight_path = os.path.join(self.selected_dir,
                                             "neighbors_weight.npy")
        neighbors = np.load(neighbors_path)
        neighbors_weight = np.load(neighbors_weight_path)
        self.neighbors = neighbors
        instance_num = neighbors.shape[0]
        train_y = self.get_train_label()
        train_y = np.array(train_y)
        self.train_y = train_y

        # get knn graph in a csr form
        indptr = [i * n_neighbor for i in range(instance_num + 1)]
        logger.info("get indptr")
        indices = neighbors[:, :n_neighbor].reshape(-1).tolist()
        logger.info("get indices")
        data = neighbors_weight[:, :n_neighbor].reshape(-1)
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
        self.affinity_matrix = affinity_matrix

        # init action trail
        self.state = Node(str(self.state_idx))
        self.state_idx = self.state_idx + 1
        self.current_state = self.state
        self.state_data[self.current_state.name] = {
            "affinity_matrix": self.affinity_matrix.copy(),
            "train_y": self.get_train_label(),
            "node": self.current_state
        }

        return affinity_matrix

    def get_neighbors_model(self):
        neighbors_model_path = os.path.join(self.selected_dir, "neighbors_model.pkl")
        if os.path.exists(neighbors_model_path):
            self._preprocess_neighbors()
        neighbors_model = pickle_load_data(neighbors_model_path)
        return neighbors_model

    def record_state(self):
        new_state = Node(self.state_idx, parent=self.current_state)
        self.state_idx = self.state_idx + 1
        self.current_state = new_state 
        self.state_data[self.current_state.name] = {
            "affinity_matrix": self.affinity_matrix.copy(),
            "train_y": self.get_train_label(),
            "node": self.current_state
        }
    
    def return_state(self):
        # root = {"id": self.state.name}
        # visiting_state = [self.state]
        # visiting_node = [root]
        # while len(visiting_node):
        #     state = visiting_state[0]
        #     visiting_state = visiting_state[1:]
        #     node = visiting_node[0]
        #     visiting_node = visiting_node[1:]
        #     node["entropy"] = 1
        #     node["children"] = []
        #     children = state.children 
        #     for c in children:
        #         node[children].append({
        #             "id": c.name
        #         })
        # TODO: add data
        dict_exporter = DictExporter()
        tree = dict_exporter.export(self.state)
        return tree

    def change_state(self, id):
        None
                

    def add_edge(self, added_edges):
        None
    
    def remove_edge(self, added_edges):
        None
    
    