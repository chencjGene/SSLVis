import numpy as np
import os
import abc


from application.views.utils.config_utils import config
from application.views.utils.helper_utils import pickle_save_data, json_load_data,\
    pickle_load_data, json_save_data


class Data(object):
    def __init__(self, dataname):
        self.dataname = dataname
        self.data_root = os.path.join(config.data_root, self.dataname)

        self.X = None
        self.y = None
        self.train_idx = []
        self.valid_idx = []
        self.test_idx = []
        self.labeled_idx = []
        self.class_names = []
        self._load_data()

    def _load_data(self):
        processed_data_filename = os.path.join(self.data_root, config.processed_dataname)
        processed_data = pickle_load_data(processed_data_filename)
        self.class_names = processed_data["class_name"]
        self.X = processed_data[config.X_name]
        self.y = processed_data[config.y_name]
        self.y = np.array(self.y)
        self.train_idx = processed_data[config.train_idx_name]
        self.valid_idx = processed_data[config.valid_idx_name]
        self.test_idx = processed_data[config.test_idx_name]
        self.labeled_idx = processed_data[config.labeled_idx_name]

    def get_train_X(self):
        return self.X[np.array(self.train_idx)].copy()

    def get_train_label(self):
        y = np.ones(self.X.shape[0]) * -1
        y[np.array(self.labeled_idx)] = self.y[np.array(self.labeled_idx)]
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