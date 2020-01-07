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

    def reset_model(self, dataname, labeled_num=None, total_num=None):
        self.dataname = dataname
        if self.dataname is None:
            self.model = None
        else:
            self.model = SSLModel(self.dataname, labeled_num, total_num)

    def get_manifest(self):
        manifest = {
            "k": self.model.n_neighbor,
            "filter_threshold": self.model.filter_threshold
        }
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
        raw_graph, process_data, influence_matrix \
            = self.model.get_graph_and_process_data()
        train_x, train_y = self.model.get_data()
        # indptr = raw_graph.indptr
        # indices = raw_graph.indices
        # is_connected = []
        # for i in range(train_x.shape[0]):
        #     if train_y[i] != -1:
        #         is_connected.append(2)
        #         continue
        #     begin = indptr[i]
        #     end = indptr[i+1]
        #     find = False
        #     for idx in indices[begin:end]:
        #         if train_y[idx] != -1:
        #             find = True
        #             break
        #     if find:
        #         is_connected.append(1)
        #     else:
        #         is_connected.append(0)
        # is_connected = np.array(is_connected)
        # print("not connected:", is_connected[is_connected==0].shape[0])
        # print("connected:", is_connected[is_connected == 1].shape[0])
        # print("labeled:", is_connected[is_connected == 2].shape[0])
        # print(is_connected)
        buf_path = self.model.data.selected_dir
        ground_truth = self.model.data.get_train_ground_truth()
        graph = getAnchors(train_x, train_y, ground_truth,
                           process_data, influence_matrix, self.dataname,
                           os.path.join(buf_path, "anchors"+config.pkl_ext))
        return jsonify(graph)

    def get_loss(self):
        loss = self.model.get_loss()
        return jsonify(loss.tolist())

    def get_ent(self):
        ent = self.model.get_ent()
        print("Get ent:", ent)
        return jsonify(ent.tolist())

    def get_labels(self):
        labels = self.model.data.class_names
        return jsonify(labels)

    def get_image_path(self, id):
        train_idx = self.model.data.get_train_idx()
        real_id = train_idx[id]
        img_dir = os.path.join(config.image_root, self.dataname)
        img_path = os.path.join(img_dir, str(real_id) + ".jpg")
        return img_path