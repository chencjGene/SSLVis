import numpy as np
import os
from sklearn.cluster import KMeans
import pickle
from scipy.spatial import distance_matrix
import math
import time
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
        print(top_num, '<===>', target_num)
        retsne = top_num != target_num

    if retsne:
        if train_x_tsne is None:
            # train_x_tsne = IncrementalTSNE(n_components=2, n_jobs=20).fit_transform(train_x)
            train_x_tsne = TSNE(n_components=2, verbose=True, method='exact').fit_transform(train_x)

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
        init_samples_x_tsne = train_x_tsne[selection]
        samples_y = train_y[selection]
        samples_truth = ground_truth[selection]
        clusters = level_infos[0]['clusters']
        samples_x_tsne = init_samples_x_tsne#IncrementalTSNE(n_components=2, n_jobs=20, init=init_samples_x_tsne, n_iter=250, exploration_n_iter=0).fit_transform(samples_x)

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
            "truth": samples_truth[i],
            "path":propagation_path[id]
        }

    # added by changjian, 201912241926
    # added edges. A quick and dirty manner
    # edge_matrix = influence_matrix[selection][:, selection]
    # edges = []
    # for i in range(edge_matrix.shape[0]):
    #     start = edge_matrix.indptr[i]
    #     end = edge_matrix.indptr[i + 1]
    #     j_in_this_row = edge_matrix.indices[start:end]
    #     for idx, j in enumerate(j_in_this_row):
    #         edges.append({
    #             "s": int(selection[j]),
    #             "e": int(selection[i])
    #         })

    graph = {
        "nodes": samples_nodes,
        # "edges": edges
    }
    return graph

def updateAnchors(train_x, train_y, ground_truth, process_data, influence_matrix, dataname, area, level, buf_path, propagation_path):
    all_time = {
        "read_file":0,
        "format_data":0
    }
    start = time.time()
    with open(buf_path, "rb") as f:
        train_x_tsne, level_infos = pickle.load(f)
        if level >= len(level_infos):
            level = len(level_infos) - 1
        _selection = level_infos[level]['index']
        _pos = train_x_tsne[_selection]
        selection = []
        for i, ind in enumerate(_selection):
            if area['x'] <= _pos[i][0] <= area['x'] + area['width'] and area['y'] <= _pos[i][1] <= area['y'] + area['height']:
                selection.append(ind)
        samples_x = train_x[selection]
        init_samples_x_tsne = train_x_tsne[selection]
        samples_y = train_y[selection]
        samples_truth = ground_truth[selection]
        clusters = level_infos[level]['clusters']
        samples_x_tsne = init_samples_x_tsne#IncrementalTSNE(n_components=2, n_jobs=20, init=init_samples_x_tsne, n_iter=250,
                                         #exploration_n_iter=0).fit_transform(samples_x)
    now = time.time()
    all_time["read_file"] += now-start
    start = now
    samples_x_tsne = samples_x_tsne.tolist()
    samples_y = samples_y.tolist()
    samples_truth = samples_truth.tolist()
    samples_nodes = {}
    for i in range(len(selection)):
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
            "truth": samples_truth[i],
            "path": propagation_path[id]
        }
    now = time.time()
    all_time["format_data"] += now - start
    start = now
    print(all_time)
    # added by changjian, 201912241926
    # added edges. A quick and dirty manner
    # edge_matrix = influence_matrix[selection][:, selection]
    # edges = []
    # for i in range(edge_matrix.shape[0]):
    #     start = edge_matrix.indptr[i]
    #     end = edge_matrix.indptr[i + 1]
    #     j_in_this_row = edge_matrix.indices[start:end]
    #     for idx, j in enumerate(j_in_this_row):
    #         edges.append({
    #             "s": int(selection[j]),
    #             "e": int(selection[i])
    #         })

    graph = {
        "nodes": samples_nodes,
        # "edges": edges
    }
    return graph

def get_area(must_show_nodes, width, height, train_x, train_y, raw_graph, process_data, influence_matrix, propagation_path, ground_truth, buf_path):
    # get new area, new level
    new_area = {
        "x": -1,
        "y": -1,
        "width": -1,
        "height": -1
    }
    with open(buf_path, "rb") as f:
        train_x_tsne, level_infos = pickle.load(f)
        selection = must_show_nodes
        init_samples_x_tsne = train_x_tsne[selection]
        samples_x_tsne = init_samples_x_tsne
        must_min_x = np.min(samples_x_tsne[:, 0])
        must_min_y = np.min(samples_x_tsne[:, 1])
        must_max_x = np.max(samples_x_tsne[:, 0])
        must_max_y = np.max(samples_x_tsne[:, 1])
        min_x = must_min_x
        min_y = must_min_y
        max_x = must_max_x
        max_y = must_max_y
        new_area["x"] = min_x
        new_area["y"] = min_y
        new_area["width"] = max_x - min_x
        new_area["height"] = max_y - min_y
        new_wh = new_area["width"] / new_area["height"]
        old_wh = width / height
        if old_wh > new_wh:
            min_x -= (new_area["height"] * old_wh - new_area["width"]) / 2
            max_x += (new_area["height"] * old_wh - new_area["width"]) / 2
            new_area["x"] = min_x
            new_area["width"] = max_x - min_x
        elif old_wh < new_wh:
            min_y -= (new_area["width"] / old_wh - new_area["height"]) / 2
            max_y += (new_area["width"] / old_wh - new_area["height"]) / 2
            new_area["y"] = min_y
            new_area["height"] = max_y - min_y
        print(new_area)

    return {
        "area":new_area
    }

def fisheyeAnchors(must_show_nodes, area, level, train_x, train_y, raw_graph, process_data, influence_matrix, propagation_path, ground_truth, buf_path):
    with open(buf_path, "rb") as f:
        train_x_tsne, level_infos = pickle.load(f)
        selection = must_show_nodes
        samples_x = train_x[selection]
        init_samples_x_tsne = train_x_tsne[selection]
        samples_y = train_y[selection]
        samples_truth = ground_truth[selection]
        samples_x_tsne = init_samples_x_tsne

        # get new graph
        if level >= len(level_infos):
            level = len(level_infos) - 1
        _selection = level_infos[level]['index']
        _pos = train_x_tsne[_selection]
        selection = []
        for i, ind in enumerate(_selection):
            if area['x'] <= _pos[i][0] <= area['x'] + area['width'] and area['y'] <= _pos[i][1] <= area['y'] + area[
                'height']:
                selection.append(ind)
        # add must_have_nodes
        selection = list(dict.fromkeys(selection+must_show_nodes))

        samples_x = train_x[selection]
        init_samples_x_tsne = train_x_tsne[selection]
        samples_y = train_y[selection]
        samples_truth = ground_truth[selection]
        clusters = level_infos[level]['clusters']
        samples_x_tsne = init_samples_x_tsne  # IncrementalTSNE(n_components=2, n_jobs=20, init=init_samples_x_tsne, n_iter=250,
        # exploration_n_iter=0).fit_transform(samples_x)


    samples_x_tsne = samples_x_tsne.tolist()
    samples_y = samples_y.tolist()
    samples_truth = samples_truth.tolist()
    samples_nodes = {}
    for i in range(len(selection)):
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
            "truth": samples_truth[i],
            "path": propagation_path[id]
        }

    graph = {
        "nodes": samples_nodes,
    }
    return graph