import numpy as np
import os
import abc

from sklearn.neighbors import kneighbors_graph

from application.views.utils.config_utils import config
from application.views.utils.helper_utils import pickle_save_data, json_load_data, pickle_load_data, json_save_data


def read_data(data_root, data_type="train"):
    filename = os.path.join(data_root, data_type + ".pkl")

    mat = pickle_load_data(filename)

    X = mat["feature"]
    ground_truth = mat["label"]

    label = np.ones(X.shape[0]) * -1
    if data_type == "train":
        sup_set_filename = os.path.join(data_root, "label_map_count_4000_index_0")
        label_key = json_load_data(sup_set_filename)["values"]
        for key in label_key:
            key = int(key)
            label[key] = ground_truth[key]
    else:
        label = ground_truth

    return X, label, ground_truth

class Data(object):
    def __init__(self, dataname):
        self.dataname = dataname
        self.data_root = os.path.join(config.data_root, self.dataname)

        self.X_train = None
        self.y_train = None
        self.X_valid = None
        self.y_valid = None
        self.X_test = None
        self.y_test = None

    def get_graph_data(self):
        X, label, ground_truth = read_data(self.data_root, "train")
        idx = np.array(range(X.shape[0]))
        np.random.shuffle(idx)
        idx = idx[:500]
        X = X[idx]
        label = label[idx]
        ground_truth = ground_truth[idx]
        print("X.shape", X.shape)
        A = kneighbors_graph(X, 10, mode="connectivity", include_self=True)
        connect = A.toarray()

        node = [{"id":i, "c":int(label[i]), "p":int(ground_truth[i])} for i in range(500)]
        link = []
        for i in range(500):
            for j in range(500):
                if connect[i][j] > 0:
                    link.append([i,j, float(np.dot(X[i], X[j]))])

        graph = {
            "node": node,
            "link": link
        }

        return graph