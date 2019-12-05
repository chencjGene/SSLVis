import numpy as np
import os
import abc
from ctypes import *
from flask import jsonify
import scipy.cluster.vq as vq

from ..model_utils import SSLModel
from ..utils.config_utils import config
from ..graph_utils.anchor import getAnchors

class ExchangePortClass(object):
    def __init__(self, dataname=None):
        self.dataname = dataname
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
        # TODO: How to define k?
        k = 50
        anchor_graph = getAnchors(train_x, train_y, raw_graph, process_data, self.dataname, k)
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
        return jsonify(anchor_graph)

    def get_loss(self):
        loss = self.model.get_loss()
        return jsonify(loss)