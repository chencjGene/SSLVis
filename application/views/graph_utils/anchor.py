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


class AnchorClusterNode:
    def __init__(self):
        self.kmeans_centroid = -1
        self.anchor_idx = -1
        self.connection = {}
        self.is_leaf = False
        self.min_dis = 1e100
        self.children = []
        self.parent = None

    def getChildrenNum(self):
        if self.is_leaf:
            return 1
        children_num = 0
        for child in self.children:
            children_num += child.getChildrenNum()
        return children_num


class AnchorCluster:
    def __init__(self, raw_graph, train_x, train_y, dataname, k):
        self.raw_graph = raw_graph
        self.train_x = train_x
        self.train_y = train_y
        self.dataname = dataname
        self.k = k
        self.root = []
        self.cluster_buffer_path = os.path.join(config.buffer_root,
                                                self.dataname + '_clusters_k=' + str(self.k) + config.pkl_ext)
        if os.path.exists(self.cluster_buffer_path):
            self.load_cluster()
        else:
            print("Get Hierarchical clusters: {}".format(self.cluster_buffer_path))
            self.HierarchyCluster(np.arange(0, train_x.shape[0]), first=True)
            self.save_cluster()

    def HierarchyCluster(self, cluster_idxes, children=None, first=False):
        node_num = cluster_idxes.shape[0]
        dim = self.train_x.shape[1]
        if node_num < self.k * 3:
            self.root = children
            return

        # assign x
        x = np.zeros((node_num, dim))
        for i in range(node_num):
            x[i] = self.train_x[cluster_idxes[i]]

        # kmeans
        n_clutsers = int(node_num / self.k)
        kmeans = KMeans(n_clusters=n_clutsers, random_state=0, n_jobs=20, max_iter=100, verbose=1,
                        algorithm="elkan").fit(x)
        labels = kmeans.labels_
        centroids = kmeans.cluster_centers_
        clusters = [AnchorClusterNode() for i in range(n_clutsers)]
        for i in range(n_clutsers):
            cluster = clusters[i]
            cluster.kmeans_centroid = centroids[i]
        for i in range(node_num):
            label = int(labels[i])

            if first:
                indptr = self.raw_graph.indptr
                indices = self.raw_graph.indices
                weight = self.raw_graph.data

                matrix_begin = indptr[i]
                matrix_end = indptr[i + 1]

                child = AnchorClusterNode()
                clusters[label].children.append(child)
                child.parent = clusters[label]
                child.is_leaf = True
                child.anchor_idx = i

                dis = np.linalg.norm(self.train_x[i] - clusters[label].kmeans_centroid, 2)
                if dis < clusters[label].min_dis:
                    clusters[label].min_dis = dis
                    clusters[label].anchor_idx = i

                # label_summary = clusters[label]["nodes_label"]
                # class_label = int(train_y[i])
                # if class_label not in label_summary.keys():
                #     label_summary[class_label] = 0
                # label_summary[class_label] += 1
                for j in range(matrix_begin, matrix_end):
                    neighbor_id = int(indices[j])
                    neighbor_label = int(labels[neighbor_id])
                    child.connection[indices[j]] = {
                        "weight": weight[j],
                        "label": labels[indices[j]],
                        "anchor_idx": indices[j]
                    }
                    if label != neighbor_label:
                        if neighbor_label not in clusters[label].connection.keys():
                            clusters[label].connection[neighbor_label] = 0
                        clusters[label].connection[neighbor_label] += weight[j]
            else:
                child = children[i]
                clusters[label].children.append(child)
                child.parent = clusters[label]
                dis = np.linalg.norm(self.train_x[child.anchor_idx] - clusters[label].kmeans_centroid, 2)
                if dis < clusters[label].min_dis:
                    clusters[label].min_dis = dis
                    clusters[label].anchor_idx = child.anchor_idx
                for child_idx, w in child.connection.items():
                    val = w["weight"]
                    neighbor_label = int(labels[child_idx])
                    if label != neighbor_label:
                        if neighbor_label not in clusters[label].connection.keys():
                            clusters[label].connection[neighbor_label] = 0
                        clusters[label].connection[neighbor_label] += val
        for i in range(n_clutsers):
            cluster = clusters[i]
            new_connection = {}
            for label, val in cluster.connection.items():
                new_connection[label] = {
                    "weight": val,
                    "label": label,
                    "anchor_idx": clusters[label].anchor_idx
                }
            cluster.connection = new_connection
        idxes = np.array([c.anchor_idx for c in clusters])
        self.HierarchyCluster(idxes, clusters)

    def save_cluster(self):
        cluster_buffer_path = os.path.join(config.buffer_root,
                                           self.dataname + '_clusters_k=' + str(self.k) + config.pkl_ext)
        with open(cluster_buffer_path, 'wb+') as f:
            pickle.dump(self.root, f)

    def load_cluster(self):
        with open(self.cluster_buffer_path, 'rb') as f:
            self.root = pickle.load(f)


class AnchorGraph():
    def __init__(self):
        self.level = 0
        self.max_level = 1

    def set_value(self, samples_x, samples_x_tsne, samples_y, samples_truth, train_x, train_y, ground_truth,
                  process_data, dataname, clusters, selection):
        self.level = 0
        self.samples_x = samples_x
        self.samples_x_tsne = samples_x_tsne
        self.samples_y = samples_y
        self.samples_truth = samples_truth
        self.train_x = train_x
        self.train_y = train_y
        self.ground_truth = ground_truth
        self.process_data = process_data
        self.dataname = dataname
        self.clusters = clusters
        self.selection = selection

    def zoom_in(self, focus_ides):

        if self.level >= self.max_level:
            return None, 0
        self.level += 1
        node_num = self.clusters.shape[0]
        focus_idxes = []
        for id in focus_ides:
            idx = int(np.argwhere(self.selection == id)[0])
            focus_idxes.append(idx)
        focus_idxes = np.array(focus_idxes)
        mask = []
        for i in range(node_num):
            mask.append(self.clusters[i] in focus_idxes)
        mask = np.array(mask)
        selection = np.argwhere(mask == True).flatten()
        samples_x = self.train_x[selection]
        samples_y = self.train_y[selection]
        samples_truth = self.ground_truth[selection]

        constrain_x = self.samples_x[focus_idxes]
        constrain_y = self.samples_x_tsne[focus_idxes]
        samples_x_tsne = IncrementalTSNE(n_components=2, n_iter=500, n_jobs=20).fit_transform(samples_x,
                                                                                              constraint_X=constrain_x,
                                                                                              constraint_Y=constrain_y)
        samples_x_tsne = samples_x_tsne.tolist()
        samples_y = samples_y.tolist()
        samples_truth = samples_truth.tolist()

        samples_nodes = {}
        for i in range(selection.shape[0]):
            id = int(selection[i])
            iter_num = self.process_data.shape[0]
            labels = [int(np.argmax(self.process_data[j][id])) if np.max(self.process_data[j][id]) > 1e-4 else -1 for j
                      in range(iter_num)]
            scores = [float(np.max(self.process_data[j][id])) for j in range(iter_num)]
            samples_nodes[id] = {
                "id": id,
                "x": samples_x_tsne[i][0],
                "y": samples_x_tsne[i][1],
                "label": labels,
                "score": scores,
                "truth": samples_truth[i]
            }
        graph = {
            "nodes": samples_nodes,
        }
        return graph, 1

    def zoom_out(self):
        if self.level == 0:
            return None, 0
        self.level -= 1
        samples_x_tsne = self.samples_x_tsne.tolist()
        samples_y = self.samples_y.tolist()
        samples_truth = self.samples_truth.tolist()

        samples_nodes = {}
        for i in range(self.selection.shape[0]):
            id = int(self.selection[i])
            iter_num = self.process_data.shape[0]
            labels = [int(np.argmax(self.process_data[j][id])) if np.max(self.process_data[j][id]) > 1e-4 else -1 for j
                      in range(iter_num)]
            scores = [float(np.max(self.process_data[j][id])) for j in range(iter_num)]
            samples_nodes[id] = {
                "id": id,
                "x": samples_x_tsne[i][0],
                "y": samples_x_tsne[i][1],
                "label": labels,
                "score": scores,
                "truth": samples_truth[i]
            }
        graph = {
            "nodes": samples_nodes,
        }
        return graph, 1


anchorGraph = AnchorGraph()


def getAnchors(train_x, train_y, ground_truth, process_data, influence_matrix, dataname, buf_path):
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
            train_x_tsne = TSNE(n_components=2, verbose=True, n_jobs=20, method='exact').fit_transform(train_x)

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

    anchorGraph.set_value(samples_x, samples_x_tsne, samples_y, samples_truth, train_x, train_y, ground_truth,
                          process_data, dataname, clusters, selection)

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


def updateAnchors(train_x, train_y, ground_truth, process_data, influence_matrix, dataname, area, level, buf_path):
    with open(buf_path, "rb") as f:
        train_x_tsne, level_infos = pickle.load(f)
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

    anchorGraph.set_value(samples_x, samples_x_tsne, samples_y, samples_truth, train_x, train_y, ground_truth,
                          process_data, dataname, clusters, selection)

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
            "truth": samples_truth[i]
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
    return graph


def getClusters(train_x, train_y, raw_graph, dataname, k):
    cluster_buffer_path = os.path.join(config.buffer_root, dataname + '_clusters_k=' + str(k) + config.pkl_ext)
    if os.path.exists(cluster_buffer_path):
        with open(cluster_buffer_path, 'rb+') as f:
            clusters = pickle.load(f)
    # else:
    #     weight = raw_graph.data
    #     indices = raw_graph.indices
    #     indptr = raw_graph.indptr
    #     n = raw_graph.shape[0]
    #
    #     # k-means
    #     # TODO: change a kmeans method
    #     centroid, labels = vq.kmeans2(train_x, k=k)
    #     clusters = [{"kmeans_centroid": centroid[i], "nodes": [], "nodes_label": {}, "min_dis": 1e365, "anchor": -1,
    #                  "connection": {}} for i in range(k)]  # kmeans time: 100000data, 49s
    #     for i in range(n):
    #         label = int(labels[i])
    #         clusters[label]["nodes"].append(i)
    #         dis = np.linalg.norm(train_x[i] - clusters[label]["kmeans_centroid"], 2)
    #         if dis < clusters[label]["min_dis"]:
    #             clusters[label]["min_dis"] = dis
    #             clusters[label]["anchor"] = i
    #         matrix_begin = indptr[i]
    #         matrix_end = indptr[i + 1]
    #         label_summary = clusters[label]["nodes_label"]
    #         class_label = int(train_y[i])
    #         if class_label not in label_summary.keys():
    #             label_summary[class_label] = 0
    #         label_summary[class_label] += 1
    #         for j in range(matrix_begin, matrix_end):
    #             neighbor_id = int(indices[j])
    #             neighbor_label = int(labels[neighbor_id])
    #             if label != neighbor_label:
    #                 if neighbor_label not in clusters[label]["connection"].keys():
    #                     clusters[label]["connection"][neighbor_label] = 0
    #                 clusters[label]["connection"][neighbor_label] += 1
    #     with open(cluster_buffer_path, 'wb+') as f:
    #         pickle.dump(clusters, f)
    # return clusters
