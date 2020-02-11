import numpy as np
import numpy.random as random
import os
from sklearn.cluster import KMeans
import pickle
from scipy.spatial import distance_matrix
from matplotlib import pyplot as plt
import math
import time
import math

from ..utils.config_utils import config
from ..graph_utils.IncrementalTSNE import IncrementalTSNE
from ..graph_utils.ConstraintTSNE import ConstraintTSNE
from ..graph_utils.DensityBasedSampler import DensityBasedSampler
from ..graph_utils.BlueNoiseSampler import BlueNoiseSampC as BlueNoiseSampler
from sklearn.manifold import TSNE
from ..graph_utils.RandomSampler import random_sample

class Anchors:
    def __init__(self, dataname):
        # path value
        self.dataset = dataname
        self.anchor_path = None
        self.cur_anchor_path = None
        # # added by Changjian
        self.data_root = os.path.join(config.data_root, self.dataset)
        self.tsne_path = os.path.join(self.data_root, "tsne.npy")
        
        # model
        self.model = None
        self.data = None

        # variables
        self.tsne = None

    # added by Changjian
    # link this class to SSLModel and Data
    def link_model(self, sslmodel):
        self.model = sslmodel
        self.data = sslmodel.data

    def get_pred_labels(self):
        labels = self.model.get_pred_labels()
        bins = np.bincount(labels + 1)
        print(bins)
        return labels

    def get_train_x_tsne(self):
        if os.path.exists(self.tsne_path):
            self.tsne = np.load(self.tsne_path)
            return 
        else:
            self.init_train_x_tsne()

    def init_train_x_tsne(self):
        train_x = self.data.get_full_train_X()
        train_y_final = self.get_pred_labels()
        self.tsne = IncrementalTSNE(n_components=2, verbose=True, init="random",
                                        early_exaggeration=1).fit_transform(train_x, labels=train_y_final,
                                                                        label_alpha=0.3)
        np.save(self.tsne_path, self.tsne)

    def tsne_evaluation(self, train_x_tsne, pred_labels):
        # TODO: changjian: 这里应该是有现有代码，但是我没有找到，暂时没有写
        pass

    def get_hierarchical_sampling(self):
        pass

    def construct_hierarchical_sampling(self):
        pass

    def get_data_area(self, ids = None, train_x_tsne = None):
        pass

    def get_data_selection(self, area, level, old_nodes_ids, must_have_nodes):
        pass

    def re_tsne(self, selection, fixed_ids, fixed_tsne):
        pass

    def convert_to_dict(self):
        pass
