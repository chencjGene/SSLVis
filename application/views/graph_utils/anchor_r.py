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
from sklearn.neighbors import BallTree


class Anchors:
    def __init__(self):
        # path value
        self.hierarchy_info_path = None
        # # added by Changjian
        self.tsne_path = None
        
        # model
        self.model = None
        self.data = None

        # variables
        self.tsne = None
        self.full_x = None
        self.entropy = None

    # added by Changjian
    # link this class to SSLModel and Data
    def link_model(self, sslmodel):
        self.model = sslmodel
        self.data = sslmodel.data
        self.selected_dir = self.model.data.selected_dir
        self.hierarchy_info_path = os.path.join(self.selected_dir, "hierarchy_info" + config.pkl_ext)
        self.tsne_path = os.path.join(self.selected_dir, "tsne.npy")
        self.full_x = self.data.get_full_train_X()
        self.entropy = self.get_entropy(self.model.process_data)

    def get_pred_labels(self):
        labels = self.model.get_pred_labels()
        bins = np.bincount(labels + 1)
        print(bins)
        return labels

    def get_train_x_tsne(self):
        if os.path.exists(self.tsne_path):
            self.tsne = np.load(self.tsne_path)
            return self.tsne
        else:
            self.init_train_x_tsne()
            return self.tsne

    def init_train_x_tsne(self):
        train_x = self.data.get_full_train_X()
        train_y_final = self.get_pred_labels()
        self.tsne = IncrementalTSNE(n_components=2, verbose=True, init="random",
                                        early_exaggeration=1).fit_transform(train_x, labels=train_y_final,
                                                                        label_alpha=0.3)
        np.save(self.tsne_path, self.tsne)

    def tsne_evaluation(self, train_x_tsne):
        while not self.model.simplification_end():
            True
        node_num = train_x_tsne.shape[0]
        influence_matrix = self.model.simplified_affinity_matrix
        all_distance = 0
        indptr = influence_matrix.indptr
        indices = influence_matrix.indices
        for i in range(node_num):
            begin = indptr[i]
            end = indptr[i + 1]
            for j in indices[begin:end]:
                all_distance += np.linalg.norm(train_x_tsne[i] - train_x_tsne[j], 2)
        print("Edge length sum:", all_distance)

    def get_hierarchical_sampling(self):
        if os.path.exists(self.hierarchy_info_path):
            with open(self.hierarchy_info_path, "rb") as f:
                return pickle.load(f)
        else:
            hierarchical_info = self.construct_hierarchical_sampling(self.full_x, self.entropy, target_num=500)
            with open(self.hierarchy_info_path, "wb") as f:
                pickle.dump(hierarchical_info, f)
            return hierarchical_info

    def construct_hierarchical_sampling(self, train_x: np.ndarray, entropy: np.ndarray, target_num: int):
        node_num = train_x.shape[0]
        min_rate = 0.25

        sampling_scale = node_num / target_num
        levels_number = int(math.ceil(math.log(sampling_scale, 1 / min_rate))) + 1

        level_infos = [{} for i in range(levels_number)]
        level_infos[-1]['index'] = np.array(range(node_num))
        level_infos[-1]['next'] = None

        number_scale_each_level = sampling_scale ** (1.0 / (levels_number - 1))
        sample_number = node_num
        level_selection = np.arange(node_num)
        for level_id in range(levels_number - 2, -1, -1):
            sample_number = round(sample_number / number_scale_each_level)
            if level_id == 0:
                sample_number = target_num
            print("Level", level_id, "Sampling number", sample_number)
            sampler = DensityBasedSampler(n_samples=sample_number)
            last_selection = level_selection
            tmp_selection = sampler.fit_sample(data=train_x[last_selection], return_others=False,
                                                 mixed_degree=entropy[last_selection])
            level_selection = last_selection[tmp_selection]
            tree = BallTree(train_x[level_selection])
            neighbors_nn = tree.query(train_x[level_infos[level_id+1]['index']], 1, return_distance=False)
            level_next = [[] for next_id in range(level_selection.shape[0])]
            for index_id, index in enumerate(neighbors_nn.reshape(-1)):
                level_next[index].append(index_id)
            level_infos[level_id] = {
                'index': level_selection,
                'next': level_next
            }

        return level_infos

    def get_entropy(self, process_data):
        iter_num = process_data.shape[0]
        node_num = process_data.shape[1]
        entropy = np.ones((node_num))
        for i in range(node_num):
            sort_res = process_data[iter_num - 1][i][np.argsort(process_data[iter_num - 1][i])[-2:]]
            entropy[i] = sort_res[1] - sort_res[0]
        return entropy

    def get_data_area(self, ids = None, train_x_tsne = None):
        pass

    def get_data_selection(self, area, level, old_nodes_ids, must_have_nodes):
        pass

    def re_tsne(self, selection, fixed_ids, fixed_tsne):
        pass

    def convert_to_dict(self):
        pass
