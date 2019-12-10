import numpy as np
import os
import abc
from ctypes import *
from flask import jsonify
import _thread as thread
import scipy.cluster.vq as vq

from ..model_utils import SSLModel
from ..utils.config_utils import config
from ..graph_utils.anchor import getAnchors
from ..graph_utils.IncrementalTSNE import IncrementalTSNE
from sklearn.manifold import TSNE

class ExchangePortClass(object):
    def __init__(self, dataname=None):
        self.dataname = dataname
        self.running = False
        if self.dataname is None:
            self.model = None
        else:
            self.model = SSLModel(self.dataname)

    def reset_dataname(self, dataname):
        self.dataname = dataname
        if self.dataname is None:
            self.model = None
        else:
            self.model = SSLModel(self.dataname)

    def get_manifest(self):
        manifest = [1]
        return jsonify(manifest)

    def dijktra(self, graph, node_id):
        node_num = graph.shape[0]
        edge_num = graph.data.shape[0]
        weight = graph.data
        indices = graph.indices
        indptr = graph.indptr
        prev = np.zeros((node_num), dtype=np.int32)
        dist = np.zeros((node_num))
        source = node_id
        # ctype init
        dll = np.ctypeslib.load_library("graph", config.lib_root)
        # aryp = np.ctypeslib.ndpointer(dtype=np.uintp, ndim=1, flags='C')
        double_ary = POINTER(c_double)
        int_ary = POINTER(c_int)
        dijkstra = dll.dijkstra
        dijkstra.restype = c_double
        dijkstra.argtypes = [double_ary, int_ary, int_ary, c_int, c_int, c_int, int_ary, double_ary]
        # ctype arg init
        # _weight = (weight.__array_interface__['data'][0] + np.arange(weight.shape[0]) * weight.strides[0]).astype(np.uintp)
        # _indices = (indices.__array_interface__['data'][0] + np.arange(indices.shape[0]) * indices.strides[0]).astype(np.uintp)
        # _indptr = (indptr.__array_interface__['data'][0] + np.arange(indptr.shape[0]) * indptr.strides[0]).astype(np.uintp)
        # _prev = (prev.__array_interface__['data'][0] + np.arange(prev.shape[0]) * prev.strides[0]).astype(np.uintp)
        # _dist = (dist.__array_interface__['data'][0] + np.arange(dist.shape[0]) * dist.strides[0]).astype(np.uintp)
        # res = dijkstra(_weight, _indices, _indptr, c_int(node_num), c_int(edge_num), c_int(source), _prev, _dist)
        res = dijkstra(weight.ctypes.data_as(double_ary), indices.ctypes.data_as(int_ary), indptr.ctypes.data_as(int_ary),
                 c_int(node_num), c_int(edge_num), c_int(int(source)),
                 prev.ctypes.data_as(int_ary), dist.ctypes.data_as(double_ary))
        print(res)
        return dist

    def get_graph(self):
        raw_graph, process_data = self.model.get_graph_and_process_data()
        train_x, train_y = self.model.get_data()
        ground_truth = self.model.data.get_train_ground_truth()
        # TODO: How to define k?
        node_num = train_x.shape[0]
        # k = int(np.sqrt(node_num/51))
        # anchor_graph = getAnchors(train_x, train_y, raw_graph, process_data, self.dataname, k)
        buf_name = "train_x_tsne.npy"
        buf_path = os.path.join(config.buffer_root, buf_name)
        train_x = np.array(train_x, dtype=np.float64)
        if os.path.exists(buf_path) is False:
            def get_all_tsne():
                train_x_tsne = IncrementalTSNE(n_components=2, n_iter=300, n_jobs=20).fit_transform(train_x)
                np.save(buf_path, train_x_tsne)
            if self.running is False:
                self.running = True
                thread.start_new_thread(get_all_tsne, ())
            random_idx = np.random.choice(train_x.shape[0], int(train_x.shape[0] / 20))
            train_x_random = train_x[random_idx]
            train_x_tsne = TSNE(n_components=2).fit_transform(train_x_random)
            train_y = train_y[random_idx]
            ground_truth = ground_truth[random_idx]
        else:
            train_x_tsne = np.load(buf_path)
        train_x_tsne = train_x_tsne.tolist()
        train_y = train_y.tolist()
        ground_truth = ground_truth.tolist()

        graph = {
            "nodes":train_x_tsne,
            "label":train_y,
            "ground_truth":ground_truth
        }

        # graph["node"][0] = {"id":0, "x":-1, "y":-1}
        # for i in range(1, k):
        #     anchor_num = len(graph["node"].keys())
        #     shortest_dis = np.zeros((anchor_num, n))
        #     for j, anchor in enumerate(graph["node"].values()):
        #         shortest_dis[j] = self.dijktra(raw_graph, anchor["id"])
        #     select = shortest_dis.min(axis=0).argmax()
        #     # assert select not in graph["node"].keys()
        #     graph["node"][select] = {"id":select, "x":-1, "y":-1}
        # graph layout
        return jsonify(graph)

    def get_loss(self):
        loss = self.model.get_loss()
        return jsonify(loss.tolist())

    def get_label_num(self):
        raw_graph, process_data = self.model.get_graph_and_process_data()
        return int(process_data.shape[2])