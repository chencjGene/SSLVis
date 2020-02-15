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
from ..utils.log_utils import logger
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
        self.old_nodes_id = []
        self.old_nodes_tsne = None
        self.hierarchy_info = None
        self.remove_ids = []
        self.data_degree = None
        self.home = None

    # added by Changjian
    # link this class to SSLModel and Data
    def link_model(self, sslmodel):
        self.model = sslmodel
        self.data = sslmodel.data
        self.selected_dir = self.model.data.selected_dir
        self.hierarchy_info_path = os.path.join(self.selected_dir, "hierarchy_info" + config.pkl_ext)
        self.tsne_path = os.path.join(self.selected_dir, "tsne.npy")
        self.full_x = self.data.get_full_train_X()
        self.old_nodes_id = []
        self.old_nodes_tsne = None
        self.entropy = None
        self.tsne = None
        self.hierarchy_info = None
        self.data_degree = None

    def get_pred_labels(self):
        labels = self.model.get_pred_labels()
        bins = np.bincount(labels + 1)
        print(bins)
        return labels

    def get_train_x_tsne(self):
        if os.path.exists(self.tsne_path):
            self.tsne = np.load(self.tsne_path)
            self.tsne = np.round(self.tsne, 2)
            return self.tsne
        else:
            self.init_train_x_tsne()
            self.tsne = np.round(self.tsne, 2)
            return self.tsne

    def init_train_x_tsne(self):
        logger.info("begin tsne init")
        train_x = self.data.get_full_train_X()
        train_y_final = self.get_pred_labels()
        self.tsne = IncrementalTSNE(n_components=2, verbose=True, init="random",
                                        early_exaggeration=1).fit_transform(train_x, labels=train_y_final,
                                                                        label_alpha=0.3)
        np.save(self.tsne_path, self.tsne)
        logger.info("finish tsne init")

    def tsne_evaluation(self, train_x_tsne):
        logger.info("begin tsne evaluation")
        # self.wait_for_simplify()
        node_num = train_x_tsne.shape[0]
        influence_matrix = self.data.get_graph()
        all_distance = 0
        indptr = influence_matrix.indptr
        indices = influence_matrix.indices
        for i in range(node_num):
            begin = indptr[i]
            end = indptr[i + 1]
            for j in indices[begin:end]:
                all_distance += np.linalg.norm(train_x_tsne[i] - train_x_tsne[j], 2)
        logger.info("finish tsne evaluation")
        print("Edge length sum:", all_distance)

    def wait_for_simplify(self):
        logger.info("waiting for simplify...")
        while not self.model.simplification_end():
            True
        logger.info("simplify end")

    def get_hierarchical_sampling(self):
        if os.path.exists(self.hierarchy_info_path):
            with open(self.hierarchy_info_path, "rb") as f:
                self.hierarchy_info = pickle.load(f)
        else:
            if self.entropy == None:
                self.entropy = self.get_entropy(self.model.process_data)
            hierarchical_info = self.construct_hierarchical_sampling(self.full_x, self.entropy, target_num=500)
            with open(self.hierarchy_info_path, "wb") as f:
                pickle.dump(hierarchical_info, f)
            self.hierarchy_info = hierarchical_info
        return self.hierarchy_info

    def construct_hierarchical_sampling(self, train_x: np.ndarray, entropy: np.ndarray, target_num: int):
        logger.info("construct hierarchical sampling")
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
        logger.info("level num:{}".format(levels_number))
        for level_id in range(levels_number - 2, -1, -1):
            sample_number = round(sample_number / number_scale_each_level)
            if level_id == 0:
                sample_number = target_num
            logger.info("Level:{}, Sampling number:{}".format(level_id, sample_number))
            sampler = DensityBasedSampler(n_samples=sample_number)
            last_selection = level_selection
            tmp_selection = sampler.fit_sample(data=train_x[last_selection], return_others=False,
                                                 mixed_degree=entropy[last_selection])
            level_selection = last_selection[tmp_selection]
            logger.info("construct ball tree...")
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
        logger.info("get entropy")
        for i in range(node_num):
            sort_res = process_data[iter_num - 1][i][np.argsort(process_data[iter_num - 1][i])[-2:]]
            entropy[i] = sort_res[1] - sort_res[0]
        logger.info("finish entropy")
        return entropy

    def get_data_area(self, ids = None, train_x_tsne = None):
        assert ids is not None or train_x_tsne is not None
        if ids is not None:
            data = self.get_train_x_tsne()[ids]
        else:
            data = train_x_tsne
        min_x = float(np.min(data[:,0]))
        min_y = float(np.min(data[:,1]))
        max_x = float(np.max(data[:,0]))
        max_y = float(np.max(data[:,1]))
        area = {
            "x": min_x,
            "y": min_y,
            "width": max_x-min_x,
            "height": max_y-min_y
        }
        return area

    def get_data_selection(self, area, level, must_have_nodes):
        logger.info("selecting data...")
        # get level info
        if self.hierarchy_info is None:
            level_infos = self.get_hierarchical_sampling()
        else:
            level_infos = self.hierarchy_info

        # get data
        train_x = self.full_x
        train_x_tsne = self.tsne

        # get old data
        old_nodes_ids = self.old_nodes_id
        old_nodes_tsne = self.old_nodes_tsne

        # get new graph
        if level >= len(level_infos):
            level = len(level_infos) - 1
        if level == 0:
            _selection = level_infos[level]['index']
            _pos = train_x_tsne[_selection]
        else:
            _selection = []
            last_level = level_infos[level-1]['index']
            last_next = level_infos[level-1]['next']
            last_pos = train_x_tsne[last_level]
            tmp_cnt = 0
            for i, ind in enumerate(last_level):
                if int(ind) in old_nodes_ids:
                    pos = old_nodes_tsne[old_nodes_ids.index(int(ind))]
                else:
                    pos = last_pos[i]
                if area['x'] <= pos[0] <= area['x'] + area['width'] and area['y'] <= pos[1] <= area['y'] + area[
                    'height']:
                    tmp_cnt+=1
                    _selection += level_infos[level]["index"][last_next[i]].tolist()
            _pos = train_x_tsne[_selection]
        tmp_selection = []
        tmp_cnt = 0
        for ind in _selection:
            if int(ind) in old_nodes_ids:
                idx = old_nodes_ids.index(int(ind))
                pos = old_nodes_tsne[idx]
            else:
                pos = train_x_tsne[ind]
            if area['x'] <= pos[0] <= area['x'] + area['width'] and area['y'] <= pos[1] <= area['y'] + area[
                'height']:
                tmp_cnt += 1
                tmp_selection.append(ind)
        _selection = tmp_selection

        selection = []
        new_nodes = []
        for i, ind in enumerate(_selection):
                if int(ind) in old_nodes_ids:
                    selection.append(int(ind))
                else:
                    new_nodes.append(int(ind))

        for node_id in must_have_nodes:
            if int(node_id) not in selection:
                if int(node_id) in old_nodes_ids:
                    selection.append(int(node_id))
                else:
                    new_nodes.append(int(node_id))

        for id in self.remove_ids:
            if id in selection:
                selection.remove(id)
            if id in new_nodes:
                new_nodes.remove(id)
        old_cnt = len(selection)
        # add must_have_nodes
        selection = list(dict.fromkeys(selection + new_nodes))
        return selection, old_cnt

    def re_tsne(self, selection, fixed_cnt = 0):
        logger.info("re tsne")
        # get data
        train_x = self.full_x
        train_x_tsne = self.tsne

        # get old data
        old_nodes_ids = self.old_nodes_id
        old_nodes_tsne = self.old_nodes_tsne

        samples_x = train_x[selection]
        init_samples_x_tsne = np.copy(train_x_tsne[selection])

        for i in range(fixed_cnt):
            init_samples_x_tsne[i] = old_nodes_tsne[old_nodes_ids.index(selection[i])]
        samples_x_tsne = IncrementalTSNE(n_components=2, n_jobs=20, init=init_samples_x_tsne, n_iter=250,
                                         exploration_n_iter=0).fit_transform(samples_x,
                                                                             skip_num_points=fixed_cnt)
        logger.info("tsne done")
        return samples_x_tsne

    def get_init_tsne(self, selection):
        return self.tsne[selection]

    def get_nodes(self):
        self.remove_ids = self.model.data.get_removed_idxs()
        self.tsne = self.get_train_x_tsne()
        self.hierarchy_info = self.get_hierarchical_sampling()
        selection = np.array(self.hierarchy_info[0]["index"]).tolist()
        # TODO  2020.2.15 change to init tsne
        # tsne = self.re_tsne(selection)
        tsne = self.get_init_tsne(selection)

        self.old_nodes_id = selection
        self.old_nodes_tsne = tsne
        graph = self.convert_to_dict(selection, tsne)
        graph["area"] = self.get_data_area(train_x_tsne=tsne)
        self.home = graph
        self.home_tsne = self.old_nodes_tsne
        self.home_tsne_ids = self.old_nodes_id
        return graph

    def update_nodes(self, area, level, must_show_nodes = []):
        self.remove_ids = self.model.data.get_removed_idxs()
        selection, old_cnt = self.get_data_selection(area, level, must_show_nodes)
        # TODO  2020.2.15 change to init tsne
        # tsne = self.re_tsne(selection, old_cnt)
        tsne = self.get_init_tsne(selection)
        self.old_nodes_id = selection
        self.old_nodes_tsne = tsne
        graph = self.convert_to_dict(selection, tsne)
        graph["area"] = self.get_data_area(train_x_tsne=tsne)
        return graph

    def get_home(self):
        self.old_nodes_id = self.home_tsne_ids
        self.old_nodes_tsne = self.home_tsne
        return self.home

    def convert_to_dict(self, selection, tsne):
        logger.info("convert to dict")
        propagation_path_from = self.model.propagation_path_from
        propagation_path_to = self.model.propagation_path_to
        ground_truth = self.model.data.get_full_train_ground_truth()
        samples_truth = ground_truth[selection]
        if self.data_degree is None:
            self.data_degree = self.model.get_in_out_degree(self.data.get_graph())
        degree = self.data_degree
        m = self.data.get_new_id_map()
        m_reverse = self.data.get_new_map_reverse()
        # selection = [m[i] for i in selection]
        def mapfunc(id):
            return int(m_reverse[id])
        labels = self.model.labels
        print("labels.shape:", labels.shape)
        process_data = self.model.process_data

        samples_x_tsne = np.round(tsne, 2).tolist()
        samples_truth = samples_truth.tolist()
        samples_nodes = {}
        sample_num = len(selection)
        for i in range(sample_num):
            id = int(selection[i])
            iter_num = process_data.shape[0]
            scores = [np.round(process_data[j][m[id]], 2).tolist() for j in range(iter_num)]
            samples_nodes[id] = {
                "id": id,
                "x": samples_x_tsne[i][0],
                "y": samples_x_tsne[i][1],
                "label": labels[:,m[id]].tolist(),
                "score": scores,
                "truth": samples_truth[i],
                "from":-1 if propagation_path_from is None else list(map(mapfunc, propagation_path_from[m[id]])),
                "to": -1 if propagation_path_to is None else list(map(mapfunc, propagation_path_to[m[id]])),
                "in_degree": int(degree[m[id]][1]),
                "out_degree": int(degree[m[id]][0])
            }
        graph = {
            "nodes":samples_nodes
        }
        logger.info("convert done")
        return graph

    def get_path(self, ids):
        self.wait_for_simplify()
        propagation_path_from = self.model.propagation_path_from
        propagation_path_to = self.model.propagation_path_to
        res = {}
        m = self.data.get_new_id_map()
        m_reverse = self.data.get_new_map_reverse()

        # selection = [m[i] for i in selection]
        def mapfunc(id):
            return int(m_reverse[id])
        for id in ids:
            res[id] = {
                "from": list(map(mapfunc, propagation_path_from[m[id]])),
                "to": list(map(mapfunc, propagation_path_to[m[id]]))
            }
        return res