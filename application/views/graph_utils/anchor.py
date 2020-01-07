import numpy as np
import os
from sklearn.cluster import KMeans
import pickle
from scipy.spatial import distance_matrix
import math
from ..utils.config_utils import config
from ..graph_utils.IncrementalTSNE import IncrementalTSNE
from ..graph_utils.DensityBasedSampler import DensityBasedSampler
from ..graph_utils.BlueNoiseSampler import BlueNoiseSampC as BlueNoiseSampler
from sklearn.manifold import TSNE
from ..graph_utils.RandomSampler import random_sample

def getAnchors(train_x, train_y, ground_truth, process_data, influence_matrix, propagation_path, dataname, buf_path):
    train_x = np.array(train_x, dtype=np.float64)
    node_num = train_x.shape[0]
    target_num = 500
    retsne = not os.path.exists(buf_path)
    train_x_tsne = None
    if not retsne:
        train_x_tsne, level_infos = pickle.load(open(buf_path, "rb"))
        top_num = len(level_infos[0]['index'])
        retsne = top_num != target_num

    if retsne:
        if train_x_tsne is None:
            train_x_tsne = IncrementalTSNE(n_components=2, n_jobs=20).fit_transform(train_x)

        if node_num > target_num:
            label_idxes = np.argwhere(train_y != -1).flatten()
            label_num = int(label_idxes.shape[0])
            sample_p = np.ones(node_num, dtype=np.float64)
            if label_num < node_num:
                sample_p[label_idxes] = 0
            sum_sample_p = np.sum(sample_p)
            sample_p /= sum_sample_p

            min_rate = 0.25

            sampling_scale = node_num / target_num
            levels_number = int(math.ceil(math.log(sampling_scale, 1 / min_rate))) + 1

            level_infos = [{} for i in range(levels_number)]
            level_infos[-1]['index'] = np.array(range(node_num))
            level_infos[-1]['clusters'] = np.array(range(node_num))
            level_infos[-1]['next'] = None

            number_scale_each_level = sampling_scale ** (1.0 / (levels_number - 1))
            sample_number = node_num
            for level_id in range(levels_number - 2, -1, -1):
                sample_number = round(sample_number / number_scale_each_level)
                if level_id == 0:
                    sample_number = target_num
                level_sample_p = sample_p[level_infos[-1]['index']]
                level_sum_sample_p = np.sum(level_sample_p)
                if level_sum_sample_p == 0:
                    level_sample_p = np.ones_like(level_sample_p)
                    level_sample_p /= np.sum(level_sample_p)
                    level_selection = np.random.choice(len(level_infos[-1]['index']), sample_number, p=level_sample_p,
                                                       replace=False)
                else:
                    level_sample_p /= level_sum_sample_p
                    level_selection = np.random.choice(len(level_infos[-1]['index']), sample_number - label_num, p=level_sample_p,
                                                       replace=False)
                    must_selection = np.argwhere(level_sample_p == 0).flatten()
                    level_selection = np.concatenate((level_selection, must_selection), axis=0)

                level_index = level_infos[-1]['index'][level_selection]
                from sklearn.neighbors import BallTree
                tree = BallTree(train_x[level_index])
                neighbors_nn = tree.query(train_x[level_infos[-1]['index']], 1, return_distance=False)
                level_next = [[] for next_id in range(len(level_index))]
                for index_id, index in enumerate(neighbors_nn.reshape(-1)):
                    level_next[index].append(index_id)

                dis_mat = distance_matrix(train_x[level_index], train_x)
                level_cluster = dis_mat.argmin(axis=0)
                level_infos[level_id] = {
                    'index': level_index,
                    'clusters': level_cluster,
                    'next': level_next
                }
        else:
            level_infos = []
            level_infos.append({})
            level_infos[0]['index'] = np.array(range(node_num))
            level_infos[0]['clusters'] = np.array(range(node_num))
            level_infos[0]['next'] = None

        save = (train_x_tsne, level_infos)

        with open(buf_path, "wb+") as f:
            pickle.dump(save, f)

    with open(buf_path, "rb") as f:
        train_x_tsne, level_infos = pickle.load(f)
        selection = level_infos[0]['index']
        samples_x = train_x[selection]
        samples_x_tsne = train_x_tsne[selection]
        samples_y = train_y[selection]
        samples_truth = ground_truth[selection]
        clusters = level_infos[0]['clusters']

    samples_x_tsne = samples_x_tsne.tolist()
    samples_y = samples_y.tolist()
    samples_truth = samples_truth.tolist()
    samples_nodes = {}
    for i in range(selection.shape[0]):
        id = int(selection[i])
        iter_num = process_data.shape[0]
        labels = [int(np.argmax(process_data[j][id])) if np.max(process_data[j][id]) > 1e-4 else -1 for j in
                  range(iter_num)]
        scores = [float(np.max(process_data[j][id])) for j in range(iter_num)]
        samples_nodes[id] = {
            "id": id,
            "x": samples_x_tsne[i][0],
            "y": samples_x_tsne[i][1],
            "label": labels,
            "score": scores,
            "truth": samples_truth[i]
            # "path":propagation_path[id]
        }

    # added by changjian, 201912241926
    # added edges. A quick and dirty manner
    edge_matrix = influence_matrix[selection][:, selection]
    edges = []
    for i in range(edge_matrix.shape[0]):
        start = edge_matrix.indptr[i]
        end = edge_matrix.indptr[i + 1]
        j_in_this_row = edge_matrix.indices[start:end]
        for idx, j in enumerate(j_in_this_row):
            edges.append({
                "s": int(selection[j]),
                "e": int(selection[i])
            })

    graph = {
        "nodes": samples_nodes,
        "edges": edges
    }
    print("finished")
    return graph
