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
from ..graph_utils.anchor_r import Anchors
from ..utils.log_utils import logger
from application.views.utils.helper_utils import *
from ..case_utils import get_case_util


class ExchangePortClass(object):
    def __init__(self, dataname=None):
        self.dataname = dataname
        self.running = False
        self.current_ids = []
        self.anchor = Anchors()
        self.video_debug = True
        self.local_update_step = 0
        if self.dataname is None:
            self.model = None
        else:
            self.model = SSLModel(self.dataname)
            self.anchor.link_model(self.model)
            self.case_util = get_case_util(self.dataname)
            self.case_util.connect_model(self.model)

    def reset_dataname(self, dataname):
        self.dataname = dataname
        if self.dataname is None:
            self.model = None
        else:
            self.model = SSLModel(self.dataname)
            self.anchor.link_model(self.model)
            self.case_util = get_case_util(self.dataname)
            self.case_util.connect_model(self.model)

    def reset_model(self, dataname, labeled_num=None, total_num=None):
        self.dataname = dataname
        if self.dataname is None:
            self.model = None
        else:
            self.model = SSLModel(self.dataname, labeled_num, total_num)
            self.anchor.link_model(self.model)
            self.case_util = get_case_util(self.dataname)
            self.case_util.connect_model(self.model)

    def init_model(self, k, filter_threshold):
        if self.case_util.base_config["step"] >= 5:
            config.use_add_tsne = True
        else:
            config.use_add_tsne = False
        self.case_util.run(k=k)

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

    def get_graph(self, filter_threshold=None, wh = 1):
        print(config.use_add_tsne)
        res = self.anchor.get_nodes(wh)
        graph = res["graph"]
        for id in graph["nodes"]:
            self.current_ids.append(int(id))
        res = jsonify(res)
        self.local_update_step = 0
        logger.info("jsonify done")
        return res

    def local_update_k(self, data):
        # self.model.local_update(data["selected_idxs"], local_k=3)
        if self.video_debug:
            assert self.local_update_step <2
            categories = [1 for i in range(10)]
            if self.local_update_step == 0:
                c = json.loads(open(os.path.join(self.model.selected_dir, "local_1_idxs.txt"), "r").read().strip("\n"))
                _, best_k = self.model.local_search_k(c, [1, 2, 3, 4], categories, simplifying=False, evaluate=True)
                self.local_update_step += 1
            else:
                e = json.loads(open(os.path.join(self.model.selected_dir, "local_2_idxs.txt"), "r").read().strip("\n"))
                _, best_k = self.model.local_search_k(e, [1, 2, 3, 4], categories, simplifying=True, evaluate=True)
                self.local_update_step += 1
        else:
            _, best_k = self.model.local_search_k(data["selected_idxs"], list(range(data["range"][0], data["range"][1]+1)), data["selected_categories"])
        best_k = int(best_k)
        graph = self.anchor.get_nodes(data["wh"])
        res = {
            "graph": graph,
            "area": data["area"],
            "level": data["level"],
            "best_k": best_k
        }
        return jsonify(res)
        # return self.fisheye(self.current_ids, data["area"], data["level"], data["wh"])
        # return jsonify(res)

    def add_data(self, data):
        self.model.add_more_similar_data(data)
        graph = self.anchor.get_nodes(data["wh"])
        res = {
            "graph": graph,
            "area": data["area"],
            "level": data["level"]
        }
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
            "selected_flows": selected_flows.tolist(),
            "label_names": self.model.data.get_class_names()
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
        if self.dataname == "stl":
            train_idx = self.model.data.get_full_train_idx()
            real_id = train_idx[id]
            img_dir = os.path.join(config.image_root, self.dataname)
            img_path = os.path.join(img_dir, str(real_id) + ".jpg")
        elif self.dataname == "oct":
            train_idx = self.model.data.get_full_train_idx()
            real_id = train_idx[id]
            img_dir = os.path.join(config.image_root, self.dataname)
            img_path = os.path.join(img_dir, str(real_id) + ".jpg")
            # train_idx = self.model.data.get_full_train_idx()
            # real_id = train_idx[id]
            # paths = self.model.data.add_info["filenames"]
            # img_path = os.path.join(config.image_root, paths[real_id].split("/data/")[2])
        return img_path

    def update_graph(self, area, level):
        all_time = {"get_meta_data":0, "update_anchor":0, "jsonify":0}
        start = time.time()
        now = time.time()
        all_time["get_meta_data"] += now-start
        start = now
        graph = self.anchor.update_nodes(area,level)
        # TODO： current_ids should be maintained in Data class
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
        res = {
            "area":self.anchor.get_data_area(must_show_nodes)
        }
        return jsonify(res)

    def get_home(self):
        res = self.anchor.get_home()
        return jsonify(res)

    def get_path(self, ids):
        return jsonify(self.anchor.get_path(ids))

    def update_delete_and_change_label(self, data):
        self.model.editing_data(data)
        remain_ids = []
        for id in self.current_ids:
            if id not in data["deleted_idxs"]:
                remain_ids.append(id)
        self.anchor.data_degree = None
        graph = self.anchor.get_nodes(data["wh"])
        res = {
            "graph": graph,
            "must_show_ids": remain_ids,
            "area": data["area"],
            "level": data["level"]
        }
        return jsonify(res)
        # return self.fisheye(remain_ids, data["area"], data["level"], data["wh"])

    def add_new_categories(self, data):
        name = data["name"]
        idxs = data["idxs"]
        self.model.add_new_categories(name=name, idxs=idxs)
        remain_ids = self.current_ids.copy()
        return self.fisheye(remain_ids, data["area"], data["level"], data["wh"])

    def fisheye(self,must_show_nodes, area, level, wh):
        # get meta data
        graph = self.anchor.update_nodes(area, level, must_show_nodes)
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
    
    def set_history(self, data):
        history_data = self.model.set_history(data["id"])
        res = self.anchor.get_nodes(1)
        graph = res["graph"]
        for id in graph["nodes"]:
            self.current_ids.append(int(id))
        data = {
            "history": history_data,
            "graph": res,
            "area": data["area"],
            "level": data["level"]
        }
        return jsonify(data)

    def retrain(self):
        res = self.model.retrain()
        return jsonify(res)

    def get_img_neighbors(self, ids, k):
        neighbors = self.model.data.get_neighbors()[ids, 1:k+1].tolist()
        return jsonify(neighbors)

    def get_img_entropy(self, ids):
        entropy = self.anchor.get_entropy()[ids].tolist()
        return jsonify(entropy)

    def get_img_labels(self, ids):
        labels = self.model.labels[:,ids].T.tolist()
        return jsonify(labels)