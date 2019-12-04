import numpy as np
import os
from sklearn.cluster import KMeans
import pickle

from ..utils.config_utils import config
from ..graph_utils.layout import anchorGraph

class AnchorClusterNode:
    def __init__(self):
        self.kmeans_centroid = -1
        self.anchor_idx = -1
        self.connection = {}
        self.is_leaf = False
        self.min_dis = 1e100
        self.children = []
        self.parent = None

class AnchorCluster:
    def __init__(self, raw_graph, train_x, train_y, dataname, k):
        self.raw_graph = raw_graph
        self.train_x = train_x
        self.train_y = train_y
        self.dataname = dataname
        self.k = k
        self.root = []
        self.cluster_buffer_path = os.path.join(config.buffer_root, self.dataname + '_clusters_k=' + str(self.k) + config.pkl_ext)
        if os.path.exists(self.cluster_buffer_path):
            self.load_cluster()
        else:
            self.HierarchyCluster(np.arange(0, train_x.shape[0]), first=True)
            self.save_cluster()

    def HierarchyCluster(self, cluster_idxes, children = None, first = False):
        node_num = cluster_idxes.shape[0]
        dim = self.train_x.shape[1]
        if node_num < self.k:
            self.root = children
            return

        # assign x
        x = np.zeros((node_num, dim))
        for i in range(node_num):
            x[i] = self.train_x[cluster_idxes[i]]

        # kmeans
        n_clutsers = int(node_num/self.k)
        kmeans = KMeans(n_clusters=n_clutsers, random_state=0, n_jobs=20, max_iter=100, verbose=1, algorithm="elkan").fit(x)
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
                        "weight":weight[j],
                        "label":labels[indices[j]],
                        "anchor_idx":indices[j]
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
                    "weight":val,
                    "label":label,
                    "anchor_idx":clusters[label].anchor_idx
                }
            cluster.connection = new_connection
        idxes = np.array([c.anchor_idx for c in clusters])
        self.HierarchyCluster(idxes, clusters)

    def save_cluster(self):
        cluster_buffer_path = os.path.join(config.buffer_root, self.dataname + '_clusters_k=' + str(self.k) + config.pkl_ext)
        with open(cluster_buffer_path, 'wb+') as f:
            pickle.dump(self.root, f)

    def load_cluster(self):
        with open(self.cluster_buffer_path, 'rb') as f:
            self.root = pickle.load(f)

def getAnchors(train_x, train_y, raw_graph, dataname, k = 1000):

    clusters = AnchorCluster(raw_graph, train_x, train_y, dataname, k).root
    anchorGraph.root = clusters
    anchorGraph.now = clusters
    anchorGraph.now_level = 0
    graph = anchorGraph.getNowGraph()
    # for i, cluster in enumerate(clusters.root):
    #     nodes = anchor_graph["node"]
    #     links = anchor_graph["link"]
    #     if cluster["anchor_idx"] == -1:
    #         print("anchor = -1!!!!!!!!!!!!!!!!")
    #         continue
    #     nodes[cluster["anchor_idx"]] = {
    #         "id": cluster["anchor_idx"],
    #         "x": -1,
    #         "y": -1,
    #         "cluster_id": i,
    #         "degree":len(cluster["connection"].keys())
    #     }
    #     for cluster_id, w in cluster["connection"].items():
    #         if w<4000:
    #             continue
    #         if i < cluster_id:
    #             links.append([cluster["anchor"], clusters[cluster_id]["anchor"]])
    return graph

def getClusters(train_x, train_y, raw_graph, dataname, k):
    cluster_buffer_path = os.path.join(config.buffer_root, dataname+'_clusters_k='+str(k)+config.pkl_ext)
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