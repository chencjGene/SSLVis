import numpy as np
import os
import abc


from application.views.utils.config_utils import config
from application.views.utils.helper_utils import pickle_save_data, json_load_data,\
    pickle_load_data, json_save_data, check_dir
from application.views.utils.log_utils import logger


class Data(object):
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
            return
        # selected_labeled_idx = np.random.choice(self.labeled_idx, self.selected_labeled_num, replace=False)
        # class balance selection
        selected_labeled_num_in_each_class = np.zeros(len(self.class_name))
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

    def get_train_num(self):
        return len(self.train_idx)

    def get_class_names(self):
        return self.class_names

    def get_train_X(self):
        return self.X[np.array(self.train_idx)].copy()

    def get_train_label(self):
        y = np.ones(self.X.shape[0]) * -1
        y[np.array(self.selected_labeled_idx)] = self.y[np.array(self.selected_labeled_idx)]
        y = y[np.array(self.train_idx)]
        return y.astype(int)

    def get_train_ground_truth(self):
        return self.y[np.array(self.train_idx)].copy().astype(int)

    def get_test_X(self):
        return self.X[np.array(self.test_idx)].copy()

    def get_test_ground_truth(self):
        return self.y[np.array(self.test_idx)].copy().astype(int)

    # def get_graph_data(self):
    #     X, label, ground_truth = read_data(self.data_root, "train")
    #     idx = np.array(range(X.shape[0]))
    #     np.random.shuffle(idx)
    #     idx = idx[:500]
    #     X = X[idx]
    #     label = label[idx]
    #     ground_truth = ground_truth[idx]
    #     print("X.shape", X.shape)
    #     A = kneighbors_graph(X, 10, mode="connectivity", include_self=True)
    #     connect = A.toarray()
    #
    #     node = [{"id":i, "c":int(label[i]), "p":int(ground_truth[i])} for i in range(500)]
    #     link = []
    #     for i in range(500):
    #         for j in range(500):
    #             if connect[i][j] > 0:
    #                 link.append([i,j, float(np.dot(X[i], X[j]))])
    #
    #     graph = {
    #         "node": node,
    #         "link": link
    #     }
    #
    #     return graph