import numpy as np
import os
import abc
from ctypes import *
from flask import jsonify
import _thread as thread
import scipy.cluster.vq as vq
import copy
import time

from ..model_utils import SSLModel
from ..utils.config_utils import config
from ..graph_utils.anchor import getAnchors, updateAnchors, fisheyeAnchors, get_area
import pickle
from ..graph_utils.IncrementalTSNE import IncrementalTSNE


class ExchangePortClass(object):
    def __init__(self, dataname=None):
        self.dataname = dataname
        self.running = False
        self.current_ids = []
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

    def init_model(self, k, filter_threshold):
        self.model.init(k=k, filter_threshold=filter_threshold)

    def setK(self, k):
        self.model.setK(k=k)

    def get_manifest(self):
        manifest = {
            "k": self.model.n_neighbor,
            "filter_threshold": self.model.filter_threshold,
            "label_names": self.model.data.class_names,
            "labeled_num": self.model.data.selected_labeled_num,
            "all_num": self.model.data.selected_total_num
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

    def get_graph(self, filter_threshold=None):
        raw_graph, process_data, influence_matrix, propagation_path, degree \
            = self.model.get_graph_and_process_data(filter_threshold=filter_threshold)
        train_x, train_y = self.model.get_full_data()
        removed_ids = self.model.data.get_removed_idxs()
        buf_path = self.model.data.selected_dir
        ground_truth = self.model.data.get_train_ground_truth()

        graph = getAnchors(train_x, train_y, ground_truth,
                           process_data, influence_matrix, propagation_path, self.dataname,
                           buf_path, degree, removed_ids)
        self.current_ids = []
        for id in graph["nodes"]:
            self.current_ids.append(int(id))
        return jsonify(graph)

    def local_update_k(self, selected_idxs):
        res = self.model.local_search_k(selected_idxs)
        return jsonify(res)

    def get_loss(self):
        loss = self.model.get_loss()
        return jsonify(loss.tolist())

    def get_ent(self):
        ent = self.model.get_ent()
        return jsonify(ent.tolist())

    def get_flows(self, selected_idxs):
        label_sums, flows = self.model.get_flows(selected_idxs)
        selected_flows = np.zeros(flows.shape).astype(int)
        mat = {
            "label_sums": label_sums.tolist(),
            "flows": flows.tolist(),
            "selected_flows": selected_flows.tolist()
        }
        return jsonify(mat)

    def get_selected_flows(self, data):
        selected_flows, selected_idxs = self.model.get_selected_flows(data)
        mat = {
            "selected_flows": selected_flows.tolist(),
            "selected_idxs": selected_idxs.tolist()
        }
        return jsonify(mat)

    def get_labels(self):
        labels = self.model.data.class_names
        return jsonify(labels)

    def get_image_path(self, id):
        train_idx = self.model.data.get_train_idx()
        real_id = train_idx[id]
        img_dir = os.path.join(config.image_root, self.dataname)
        img_path = os.path.join(img_dir, str(real_id) + ".jpg")
        return img_path

    def update_graph(self, area, level):
        all_time = {"get_meta_data":0, "update_anchor":0, "jsonify":0}
        start = time.time()
        raw_graph, process_data, influence_matrix, propagation_path, degree \
            = self.model.get_graph_and_process_data()
        train_x, train_y = self.model.get_full_data()
        ground_truth = self.model.data.get_train_ground_truth()
        removed_ids = self.model.data.get_removed_idxs()
        now = time.time()
        all_time["get_meta_data"] += now-start
        start = now
        graph = updateAnchors(train_x, train_y, ground_truth,
                           process_data, influence_matrix, self.dataname, area, level,
                           self.model.data.selected_dir, propagation_path, degree, removed_ids)
        self.current_ids = []
        for id in graph["nodes"]:
            self.current_ids.append(int(id))
        now = time.time()
        all_time["update_anchor"] += now - start
        start = now
        json_res = jsonify(graph)
        now = time.time()
        all_time["jsonify"] += now - start
        start = now
        print(all_time)
        return json_res

    def get_area(self, must_show_nodes, width, height):
        # get meta data
        raw_graph, process_data, influence_matrix, propagation_path,degree \
            = self.model.get_graph_and_process_data()
        train_x, train_y = self.model.get_data()
        buf_path = os.path.join(self.model.data.selected_dir, "anchors" + config.pkl_ext)
        ground_truth = self.model.data.get_train_ground_truth()

        return jsonify(get_area(must_show_nodes, width, height, train_x, train_y, raw_graph, process_data, influence_matrix, propagation_path, ground_truth, buf_path))

    def update_delete_and_change_label(self, data):
        self.model.data.editing_data(data)
        remain_ids = []
        for id in self.current_ids:
            if id not in data["deleted_idxs"]:
                remain_ids.append(id)
        return self.fisheye(remain_ids, data["area"], data["level"], data["wh"])

    def fisheye(self,must_show_nodes, area, level, wh):
        # get meta data
        raw_graph, process_data, influence_matrix, propagation_path, degree \
            = self.model.get_graph_and_process_data()
        train_x, train_y = self.model.get_full_data()
        buf_path = self.model.data.selected_dir
        ground_truth = self.model.data.get_train_ground_truth()
        removed_ids = self.model.data.get_removed_idxs()

        graph = fisheyeAnchors(must_show_nodes, area, level, wh, train_x, train_y, raw_graph, process_data,
                               influence_matrix, propagation_path, ground_truth, buf_path, degree, removed_ids)
        self.current_ids = []
        for id in graph["nodes"]:
            self.current_ids.append(int(id))
        return jsonify(graph)

    def get_feature_distance(self, uid, vid):
        train_x, _ = self.model.get_data()
        return np.linalg.norm(train_x[uid] - train_x[vid], 2)

    def get_feature(self, id):
        train_x, _ = self.model.get_data()
        return train_x[id].tolist()

    def get_history(self):
        history_data = self.model.get_history()
        return jsonify(history_data)
    
    def set_history(self, id):
        history_data = self.model.set_history(id)
        return jsonify(history_data)

    def retrain(self):
        res = self.model.retrain()
        return jsonify(res)