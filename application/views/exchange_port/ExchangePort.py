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


class ExchangePortClass(object):
    def __init__(self, dataname=None):
        self.dataname = dataname
        self.running = False
        self.current_ids = []
        self.anchor = Anchors()
        if self.dataname is None:
            self.model = None
        else:
            self.model = SSLModel(self.dataname)
            self.anchor.link_model(self.model)

    def reset_dataname(self, dataname):
        self.dataname = dataname
        if self.dataname is None:
            self.model = None
        else:
            self.model = SSLModel(self.dataname)
            self.anchor.link_model(self.model)

    def reset_model(self, dataname, labeled_num=None, total_num=None):
        self.dataname = dataname
        if self.dataname is None:
            self.model = None
        else:
            self.model = SSLModel(self.dataname, labeled_num, total_num)
            self.anchor.link_model(self.model)

    def delete_node(self, d, k, filter_threshold, local_update = True):
        a = [58, 65, 82, 131, 145, 146, 153, 172, 175, 193, 198, 203, 234, 236, 252, 300, 316, 319, 336, 341, 385, 399,
             406,
             450, 480, 481, 536, 560, 617, 618, 645, 672, 716, 768, 791, 820, 828, 878, 883, 905, 911, 913, 939, 948,
             950,
             956, 959, 975, 1021, 1100, 1103, 1134, 1175, 1184, 1202, 1270, 1282, 1327, 1335, 1341, 1380, 1402, 1452,
             1460,
             1461, 1483, 1503, 1512, 1520, 1599, 1636, 1651, 1663, 1670, 1678, 1687, 1703, 1721, 1729, 1743, 1775, 1788,
             1792, 1804, 1809, 1832, 1837, 1843, 1870, 1873, 1876, 1879, 1895, 1924, 1941, 1990, 2001, 2004, 2011, 2028,
             2044, 2104, 2125, 2136, 2153, 2159, 2174, 2180, 2186, 2226, 2232, 2233, 2280, 2292, 2322, 2337, 2344, 2367,
             2403, 2406, 2434, 2458, 2498, 2502, 2509, 2537, 2538, 2551, 2556, 2594, 2608, 2618, 2634, 2638, 2659, 2679,
             2687, 2702, 2732, 2733, 2760, 2777, 2798, 2804, 2805, 2860, 2881, 2896, 2932, 3013, 3032, 3074, 3083, 3091,
             3096, 3097, 3124, 3141, 3157, 3158, 3230, 3232, 3241, 3404, 3415, 3419, 3422, 3469, 3490, 3514, 3518, 3523,
             3524, 3532, 3535, 3537, 3541, 3557, 3591, 3593, 3612, 3626, 3634, 3661, 3665, 3721, 3754, 3756, 3764, 3771,
             3811, 3812, 3827, 3833, 3861, 3885, 3893, 3906, 3924, 3931, 3976, 3984, 3994, 4036, 4072, 4073, 4080, 4133,
             4157, 4185, 4208, 4278, 4282, 4301, 4304, 4336, 4347, 4383, 4397, 4412, 4421, 4445, 4446, 4466, 4492, 4498,
             4531, 4535, 4551, 4567, 4590, 4597, 4695, 4712, 4749, 4751, 4752, 4759, 4771, 4784, 4813, 4837, 4871, 4876,
             4931, 4952, 4975, 4995, 5015, 5018, 5042, 5048, 5066, 5075, 5086, 5108, 5135, 5170, 5183, 5203, 5210, 5224,
             5238, 5261, 5269, 5280, 5298, 5301, 5310, 5314, 5330, 5366, 5382, 5384, 5386, 5408, 5416, 5434, 5513, 5530,
             5541, 5558, 5579, 5585, 5596, 5599, 5612, 5661, 5673, 5772, 5812, 5854, 5888, 5924, 5955, 5959, 5962, 5964,
             5972, 5988, 5993, 6002, 6005, 6070, 6072, 6104, 6148, 6150, 6154, 6160, 6171, 6216, 6222, 6223, 6250, 6262,
             6303, 6308, 6313, 6316, 6362, 6367, 6397, 6402, 6405, 6410, 6418, 6419, 6423, 6425, 6439, 6447, 6453, 6466,
             6471, 6491, 6571, 6606, 6637, 6642, 6684, 6745, 6801, 6814, 6898, 6902, 6951, 6953, 7013, 7020, 7029, 7038,
             7080, 7095, 7111, 7114, 7116, 7134, 7174, 7179, 7187, 7213, 7249, 7284, 7287, 7305, 7335, 7347, 7354, 7355,
             7357, 7361, 7371, 7374, 7376, 7387, 7403, 7432, 7440, 7445, 7464, 7467, 7469, 7470, 7482, 7502, 7513, 7566,
             7619, 7628, 7650, 7671, 7689, 7699, 7705, 7733, 7772, 7779, 7799, 7803, 7814, 7845, 7848, 7887, 7937, 7948,
             7985, 8005, 8073, 8114, 8120, 8123, 8154, 8163, 8197, 8227, 8235, 8260, 8279, 8300, 8333, 8352, 8356, 8357,
             8375, 8434, 8446, 8460, 8474, 8475, 8486, 8518, 8520, 8530, 8548, 8565, 8634, 8636, 8655, 8676, 8686, 8706,
             8708, 8724, 8725, 8737, 8740, 8744, 8750, 8753, 8893, 8906, 8908, 8911, 8965, 8988, 9003, 9107, 9108, 9113,
             9118, 9124, 9133, 9142, 9161, 9189, 9196, 9236, 9253, 9285, 9291, 9300, 9304, 9317, 9326, 9386, 9420, 9423,
             9451, 9518, 9526, 9555, 9557, 9572, 9605, 9630, 9646, 9651, 9674, 9690, 9704, 9735, 9742, 9752, 9754, 9817,
             9855, 9862, 9869, 9881, 9889, 9910, 9914, 9925, 9958, 9960, 9964, 9982, 10022, 10052, 10092, 10098, 10110,
             10144, 10155, 10161, 10169, 10180, 10181, 10184, 10193, 10215, 10221, 10223, 10228, 10229, 10231, 10264,
             10320,
             10324, 10402, 10405, 10408, 10424, 10435, 10436, 10445, 10476, 10481, 10546, 10579, 10617, 10622, 10632,
             10647,
             10659, 10670, 10671, 10672, 10674, 10703, 10709, 10714, 10826, 10849, 10852, 10854, 10855, 10945, 10948,
             10949,
             10967, 11012, 11070, 11082, 11117, 11138, 11164, 11168, 11172, 11173, 11200, 11206, 11209, 11234, 11242,
             11253,
             11316, 11334, 11345, 11357, 11372, 11378, 11384, 11389, 11441, 11459, 11462, 11470, 11488, 11516, 11518,
             11533,
             11543, 11650, 11651, 11669, 11676, 11713, 11721, 11751, 11802, 11813, 11824, 11848, 11881, 11916, 11922,
             11952,
             12004, 12022, 12033, 12038, 12055, 12126, 12169, 12193, 12210, 12216, 12229, 12232, 12261, 12267, 12272,
             12276,
             12364, 12370, 12374, 12378, 12443, 12444, 12458, 12461, 12507, 12523, 12528, 12556, 12574, 12587, 12614,
             12635,
             12642, 12650, 12678, 12681, 12694, 12763, 12767, 12786, 12803, 12808, 12815, 12816, 12822, 12824, 12825,
             12831,
             12841, 12858, 12955, 12987, 13013, 13099, 13117, 13127, 13266, 13360, 13370, 13375, 13384, 13390, 13406,
             13467,
             13491, 13539, 13569, 13597, 13621, 13627, 13650, 13689, 13749, 13755, 13758, 13767, 13806, 13839, 13902,
             13914,
             13940, 13942, 13952, 13963, 13989, 13993, 14001, 14014, 14016, 14017, 14032, 14048, 14051, 14075, 14097,
             14140,
             14175, 14177, 14187, 14209, 14212, 14235, 14262, 14289, 14296, 14310, 14318, 14321, 14330, 14339, 14408,
             14409,
             14427, 14430, 14460, 14461, 14505, 14510, 14519, 14539, 14556, 14569, 14579, 14655, 14660, 14668, 14690,
             14706,
             14740, 14748, 14750, 14780, 14795, 14796, 14819, 14833, 14848, 14851, 14853, 14855, 14859, 14881, 14884,
             14923,
             14924, 14942, 14955, 14957, 14982, 14986, 14992, 15013, 15021, 15073, 15100, 15101, 15128, 15131, 15189,
             15207,
             15223, 15246, 15249, 15254, 15267, 15285, 15291, 15350, 15372, 15383, 15399, 15415, 15429, 15430, 15438,
             15450,
             15456, 15460, 15486, 15493, 15499, 15525, 15526, 15538, 15565, 15576, 15590, 15609, 15615, 15627, 15650,
             15655,
             15690, 15702, 15719, 15756, 15761, 15768, 15787, 15788, 15791, 15845, 15852, 15861, 15900, 15907, 15908,
             15920,
             15931, 15945, 16007, 16037, 16108, 16124, 16132, 16140, 16156, 16159, 16208, 16220, 16233, 16243, 16244,
             16301,
             16309, 16317, 16318, 16370, 16387, 16396, 16441, 16518, 16531, 16536, 16563, 16568, 16601, 16698, 16708,
             16717,
             16724, 16726, 16754, 16765, 16772, 16793, 16803, 16859, 16861, 16915, 16943, 16972, 16997, 16998, 17012,
             17016,
             17018, 17026, 17033, 17052, 17055, 17058, 17071, 17072, 17092, 17107, 17138, 17142, 17160, 17166, 17174,
             17178,
             17206, 17241, 17247, 17275, 17281, 17288, 17312, 17349, 17396, 17401, 17475, 17482, 17522, 17532, 17553,
             17554,
             17575, 17577, 17583, 17586, 17593, 17598, 17602, 17638, 17639, 17650, 17659, 17660, 17688, 17709, 17712,
             17745,
             17753, 17858, 17866, 17891, 17898, 17906, 17931, 17955, 17999, 18008, 18032, 18035, 18083, 18093, 18095,
             18110,
             18120, 18143, 18152, 18163, 18204, 18223, 18226, 18230, 18267, 18269, 18328, 18367, 18390, 18413, 18427,
             18433,
             18453, 18456, 18512, 18519, 18520, 18551, 18553, 18563, 18580, 18603, 18604, 18644, 18715, 18723, 18737,
             18746,
             18764, 18781, 18783, 18812, 18814, 18818, 18889, 18896, 18907, 18912, 18927, 18944, 18945, 18948, 18956,
             18999,
             19009, 19020, 19039, 19065, 19108, 19119, 19134, 19147, 19170, 19189, 19194, 19205, 19209, 19219, 19229,
             19295,
             19298, 19307, 19329, 19345, 19349, 19374, 19394, 19482, 19488, 19490, 19499, 19504, 19522, 19540, 19548,
             19558,
             19562, 19565, 19577, 19606, 19616, 19620, 19622, 19625, 19631, 19644, 19671, 19726, 19750, 19783, 19790,
             19822,
             19885, 19890, 19893, 19901, 19914, 19925, 19926, 19930, 19957, 58, 156, 302, 438, 515, 608, 832, 943, 1654,
             1689, 1763, 2161, 2760, 2855, 2886, 3129, 3186, 3579, 3707, 3810, 4011, 4187, 4709, 4940, 4969, 5362, 5750,
             6562, 6873, 6933, 7491, 7604, 7820, 7891, 8130, 8299, 8340, 8519, 8653, 8679, 8939, 8976, 9324, 9435, 9467,
             9547, 9729, 9859, 10531, 11336, 11667, 11777, 12104, 12376, 12805, 12854, 13513, 14085, 14450, 14459,
             14609,
             15059, 15232, 15321, 15378, 15896, 15918, 16463, 16544, 16670, 17192, 17272, 17301, 17432, 17682, 18062,
             18172,
             18239, 18294, 18729, 19090, 19628, 19887, 19957, 19994, 48, 209, 211, 552, 654, 697, 700, 794, 864, 1011,
             1734,
             1777, 1782, 1787, 1974, 2248, 2355, 2372, 2585, 2772, 2872, 3431, 3458, 3614, 3719, 3831, 3864, 3922, 4150,
             4178, 4196, 4353, 4366, 4949, 5146, 5295, 5498, 5559, 5571, 5703, 6190, 6353, 6484, 6496, 6884, 6979, 7024,
             7640, 7742, 7760, 8037, 8065, 8180, 8196, 8370, 8743, 8835, 8970, 9069, 9225, 9365, 9501, 9553, 9699, 9740,
             9813, 9895, 10099, 10150, 10331, 10421, 10761, 10857, 10872, 10896, 11093, 11121, 11297, 11696, 11728,
             12357,
             12427, 12800, 13226, 13485, 13559, 13571, 14574, 14623, 14820, 14847, 15510, 15606, 15645, 15827, 15841,
             16326,
             16357, 16361, 16521, 16669, 16879, 16991, 17036, 17044, 17202, 17476, 17706, 17939, 17966, 18128, 18168,
             18281,
             18498, 18707, 19037, 19042, 19158, 19232, 19251, 19356, 19369, 19386, 19416, 471, 1285, 1322, 1615, 1620,
             2235,
             3539, 3800, 3923, 4090, 4149, 4204, 4292, 4365, 4595, 4715, 4971, 5291, 5346, 5515, 5636, 5664, 6109, 6437,
             6572, 6663, 6771, 6786, 7373, 7423, 7785, 7874, 8046, 8551, 8599, 8715, 8834, 9121, 9141, 9709, 9927,
             10339,
             10348, 10507, 10913, 10922, 11448, 11740, 11837, 12031, 12090, 12238, 13143, 13468, 13638, 14173, 14878,
             14916,
             15222, 15283, 15389, 15596, 15881, 15974, 15978, 15984, 16205, 16346, 16411, 16589, 16826, 16920, 17009,
             17503,
             17616, 18881, 19341, 19451, 19557, 19782, 19459, 10756, 4101, 6157, 19477, 19483, 4637, 5172, 4148, 5174,
             2615,
             15417, 570, 16955, 18496, 11844, 9284, 5211, 14944, 15970, 4195, 10860, 15982, 2160, 16500, 6774, 10875,
             15995,
             5757, 3717, 18565, 16527, 12439, 17050, 15003, 671, 15009, 4773, 9897, 3243, 689, 18119, 17098, 14544,
             3281,
             17106, 7385, 10988, 5868, 6909, 12030, 13066, 12559, 6929, 16151, 7978, 12087, 835, 19278, 11601, 3416,
             18275,
             868, 17253, 19825, 14710, 11645, 14730, 3979, 6039, 14744, 415, 3488, 8621, 12719, 14259, 1979, 8128,
             14785,
             18885, 11730, 978, 15830, 8156, 9694, 13794, 5606, 14316, 9198, 10745]
        b = [320, 398, 868, 978, 1760, 2040, 2164, 2555, 3112, 3250, 3281, 3642, 3888, 3915, 4095, 4105, 4370, 4637,
             4765,
             5084, 5158, 5177, 5350, 5404, 5491, 5757, 5814, 6253, 6584, 6710, 6727, 6903, 6928, 7084, 8268, 8641, 8846,
             9694, 9751, 10205, 10936, 10988, 11175, 11186, 11243, 11360, 11546, 11645, 11730, 12087, 12201, 12212,
             12719,
             12853, 12916, 13076, 13129, 13241, 13753, 13794, 14303, 14357, 14544, 14719, 14944, 15111, 15231, 15575,
             15854,
             15982, 16050, 16054, 16151, 16329, 16500, 16527, 16822, 16955, 17023, 17050, 17225, 17878, 18275, 18653,
             18802,
             19061, 19085, 19239, 19315, 19977]
        # d = SSLModel(config.stl, labeled_num=50, total_num=20000, seed=123)
        remove_ids = []
        removes = pickle_load_data("./data/STL/other_class.pkl")
        for i, remove in enumerate(removes):
            if i not in [0, 31, 32, 33]:
                remove_ids += remove
        remove_ids = list(set(remove_ids))
        d.data.remove_instance(remove_ids)
        #
        # # map
        m = d.data.get_new_id_map()
        a = [m[id] for id in a if id not in remove_ids]
        b = [m[id] for id in b if id not in remove_ids]
        d.init(k=k, evaluate=True, simplifying=False, filter_threshold = filter_threshold)
        #
        init_labels = d.get_pred_labels()[a]
        categories = [1 for i in range(12)]
        categories[11] = False
        before_train_pred = d.get_pred_labels()
        if local_update:
            d.local_search_k(a, [1, 2, 3, 4], categories, simplifying=False)
            d.local_search_k(b, [1, 2, 3, 4], categories, simplifying=True)
            d.adaptive_evaluation()
        # return acc

    def init_model(self, k, filter_threshold):
        # self.model.init(k=k, filter_threshold=filter_threshold)
        self.delete_node(self.model, k, filter_threshold, local_update = True)

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
        graph = self.anchor.get_nodes(wh)
        for id in graph["nodes"]:
            self.current_ids.append(int(id))
        res = jsonify(graph)
        logger.info("jsonify done")
        return res

    def local_update_k(self, data):
        # self.model.local_update(data["selected_idxs"], local_k=3)
        self.model.local_search_k(data["selected_idxs"], list(range(data["range"][0], data["range"][1]+1)), data["selected_categories"])

        return self.fisheye(self.current_ids, data["area"], data["level"], data["wh"])
        # return jsonify(res)

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
        train_idx = self.model.data.get_full_train_idx()
        real_id = train_idx[id]
        img_dir = os.path.join(config.image_root, self.dataname)
        img_path = os.path.join(img_dir, str(real_id) + ".jpg")
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
        return self.fisheye(remain_ids, data["area"], data["level"], data["wh"])

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
    
    def set_history(self, id):
        history_data = self.model.set_history(id)
        return jsonify(history_data)

    def retrain(self):
        res = self.model.retrain()
        return jsonify(res)
