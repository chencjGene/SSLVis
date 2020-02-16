import numpy as np
import os
import abc
from scipy import sparse
from anytree import Node
from anytree.exporter import DictExporter
from scipy.stats import entropy
from tqdm import tqdm

from sklearn.neighbors.unsupervised import NearestNeighbors

from application.views.utils.config_utils import config
from application.views.utils.helper_utils import pickle_save_data, json_load_data, \
    pickle_load_data, json_save_data, check_dir
from application.views.utils.log_utils import logger

from .model_helper import build_laplacian_graph

DEBUG = False


class Data(object):
    '''
    1. read data from buffer
    2. manage history state
    '''

    def __init__(self, dataname, labeled_num=None, total_num=None, seed=123):
        self.dataname = dataname
        self.data_root = os.path.join(config.data_root, self.dataname)

        self.X = None
        self.y = None
        self.train_idx = []
        self.valid_idx = []
        self.test_idx = []
        self.labeled_idx = []
        self.class_name = []
        self.removed_idxs = []

        self.selected_labeled_num = labeled_num
        self.selected_total_num = total_num
        self.seed = seed
        self.selected_dir = None
        self.rest_idxs = None

        self._load_data()

        # change test data for STL
        if self.dataname.split("-")[0].lower() == config.stl.lower():
            logger.info("using patch")
            # lizard = [6145, 36868, 98318, 94224, 77841, 47122, 24595, 38935, 20504, 26648, 59425, 86052, 71717, 77861, 24619, 100397, 34865, 53297, 81970, 26676, 100403, 55, 38971, 88128, 59463, 59464, 30793, 86087, 51275, 71762, 63572, 43099, 102492, 22621, 57438, 47199, 88158, 39009, 94309, 45158, 100455, 53352, 104549, 84077, 6256, 100464, 71799, 100477, 92285, 6273, 77953, 45187, 59524, 36997, 57478, 86147, 94341, 86153, 32911, 49296, 61588, 28827, 80027, 104603, 71839, 8352, 69793, 51363, 18596, 6309, 8357, 43175, 10414, 6319, 61618, 80051, 104631, 51384, 96440, 82109, 18622, 49342, 12480, 73918, 39106, 84159, 18628, 55493, 35014, 71879, 88263, 57546, 63691, 39121, 24787, 8405, 35030, 73942, 82133, 84185, 80092, 61661, 67806, 12514, 61666, 37094, 12527, 73968, 86255, 18674, 22774, 100599, 20728, 20729, 28921, 61691, 47356, 76031, 14592, 26887, 65799, 69897, 69898, 49419, 20751, 49423, 94487, 74010, 55582, 39204, 59686, 96554, 8491, 92459, 20781, 16687, 35119, 63797, 37175, 12605, 24893, 92479, 43331, 96579, 8518, 98631, 53578, 41291, 10572, 61771, 12622, 80205, 90448, 96594, 69971, 6484, 88404, 6494, 94559, 53602, 74086, 96614, 65898, 80234, 98671, 41328, 102773, 35190, 94582, 14715, 45438, 53631, 70015, 98690, 63875, 37257, 72081, 12691, 94614, 8600, 12700, 100767, 41382, 41387, 16816, 12725, 14780, 59840, 18884, 22981, 49614, 68046, 92624, 88530, 90579, 55764, 76245, 82388, 94679, 86489, 16859, 10716, 23005, 33246, 45533, 18917, 57833, 25068, 51696, 37362, 55796, 80379, 16894, 25088, 64001, 84482, 96771, 76292, 6664, 57864, 27153, 82449, 21011, 33299, 43539, 84497, 74264, 27162, 78362, 27164, 100892, 61984, 78370, 41508, 8743, 8747, 45611, 74283, 43566, 55854, 29238, 80441, 102969, 31291, 84543, 19010, 31301, 76357, 8775, 41547, 88651, 94795, 16974, 37454, 68175, 94797, 35410, 96844, 72278, 47703, 8793, 21083, 98912, 35425, 27233, 103008, 43621, 60005, 33383, 68200, 17000, 60011, 37484, 76395, 68208, 55925, 37496, 90744, 43642, 86655, 17028, 8842, 47754, 8845, 37518, 64141, 49810, 31379, 47764, 98964, 31382, 2711, 31384, 60056, 15003, 41630, 82590, 29349, 41638, 35502, 47792, 84656, 103088, 88757, 10942, 53954, 90819, 94916, 72393, 88780, 99020, 66258, 92882, 33493, 103126, 53981, 6880, 103138, 64227, 80611, 90851, 33511, 68329, 17131, 39660, 41708, 24572, 74479, 76532, 29431, 43771, 80638, 17152, 58113, 41733, 41738, 76555, 21262, 54031, 37651, 41754, 97054, 88866, 19237, 8999, 97064, 97065, 99111, 45868, 64302, 11057, 33585, 78644, 60213, 76598, 99129, 103225, 47934, 76610, 6979, 41795, 6982, 25415, 70472, 52042, 70477, 41808, 19289, 31577, 95072, 13155, 7012, 15204, 31598, 103280, 43890, 23415, 74617, 78714, 93050, 66431, 103301, 74633, 66445, 17298, 21394, 11156, 41879, 19355, 58268, 23453, 45985, 56230, 7081, 86953, 72621, 76718, 11185, 9138, 13235, 29620, 97201, 15289, 25530, 17343, 95171, 52164, 101315, 27590, 68550, 52170, 99274, 17357, 101327, 9171, 62421, 80856, 31705, 52188, 29664, 25579, 33778, 33786, 5117, 84990, 5119, 7167, 25601, 19464, 13321, 11276, 48141, 72719, 85010, 101395, 50197, 103445, 66585, 35867, 48155, 11293, 50205, 66591, 15393, 64545, 7206, 95272, 54314, 19499, 17456, 62520, 97336, 103484, 50237, 23614, 54333, 87104, 31813, 23625, 64587, 19540, 11349, 42072, 25692, 97375, 62562, 78946, 44133, 60518, 89191, 33896, 9324, 46190, 60529, 85106, 91249, 89205, 9336, 48249, 46207, 72841, 23691, 87195, 15516, 50336, 42146, 27813, 74919, 21673, 36012, 9389, 21677, 74924, 87216, 44209, 62642, 64693, 29878, 44217, 25786, 52414, 83136, 27846, 101578, 85195, 33997, 72909, 101582, 54482, 9429, 70875, 74973, 60640, 91362, 68836, 99557, 50406, 52454, 81130, 27889, 99569, 50423, 42237, 25856, 40195, 44298, 23819, 62731, 93452, 81167, 13585, 95505, 34069, 56598, 60700, 70940, 87324, 40224, 42282, 83242, 21805, 50481, 103731, 83254, 87350, 91447, 54586, 56638, 40255, 56641, 101697, 64836, 32076, 17742, 32078, 46414, 89430, 7511, 46426, 23902, 46430, 85346, 32106, 75115, 56685, 50545, 38264, 11643, 40315, 11645, 21886, 64893, 81280, 52609, 93568, 32136, 73097, 87434, 30091, 89481, 25998, 46478, 69011, 71063, 13727, 23967, 79268, 85412, 77222, 83367, 87468, 62894, 62897, 66993, 48563, 54707, 71089, 66998, 75185, 99769, 89536, 34242, 7620, 15824, 38365, 58845, 40415, 79332, 101863, 89577, 42483, 38388, 83444, 83448, 36346, 48637, 97795, 58885, 71177, 3594, 50698, 24080, 17937, 91664, 69140, 103956, 83482, 50717, 85535, 28194, 20006, 20007, 50727, 71207, 85543, 40491, 93737, 79407, 93743, 97840, 38459, 40507, 91708, 24126, 48704, 54850, 77379, 13893, 17994, 38476, 5712, 69208, 13914, 48730, 69210, 32351, 104034, 46692, 5735, 36455, 22121, 36456, 77416, 44652, 89707, 101995, 24176, 44659, 61045, 46710, 69239, 81525, 54906, 59003, 95866, 77437, 102010, 38528, 87680, 28290, 104066, 42628, 85637, 5767, 95881, 11915, 5772, 65163, 93835, 97942, 56985, 79514, 81565, 28320, 56992, 69284, 63141, 42663, 54952, 9899, 67246, 22192, 69297, 79539, 65205, 46775, 26296, 52920, 71354, 79544, 95930, 59069, 65215, 36545, 77505, 67269, 14023, 52937, 52938, 59082, 32460, 102094, 5840, 73426, 26323, 65235, 42712, 11996, 102111, 26341, 55013, 98022, 57340, 61167, 5873, 61170, 42740, 87797, 55031, 52984, 38650, 81659, 87805, 83710, 44799, 83717, 40712, 61193, 75531, 46860, 28429, 102158, 26384, 12049, 7956, 57112, 5914, 59162, 48928, 93984, 75562, 14123, 100148, 5944, 40768, 16196, 30533, 26436, 73541, 102215, 22346, 30542, 46926, 75600, 5969, 61270, 83799, 51037, 46942, 94053, 59240, 61288, 38764, 61293, 104302, 63345, 100212, 8054, 28535, 77691, 98171, 61310, 8064, 96129, 94086, 98184, 49033, 10122, 59274, 73612, 92045, 96143, 81809, 44946, 59285, 12186, 24475, 8094, 63395, 104357, 69548, 63408, 61361, 90032, 73654, 34745, 65466, 69561, 96187, 92094, 28607, 36801, 51139, 59337, 83915, 81868, 16333, 67539, 57300, 94167, 20441, 24541, 32736, 98277, 53223, 92137, 85994, 10226, 30708, 69620, 51194, 12284]
            # snake = [16394, 10254, 38934, 30743, 53275, 79903, 94247, 61484, 16430, 84015, 51251, 59454, 98367, 16453, 55367, 67665, 14418, 67668, 53334, 86104, 36959, 53345, 51299, 98406, 49265, 16502, 49276, 49278, 34942, 80003, 94345, 77963, 30863, 57489, 24723, 51350, 8347, 69801, 32941, 102577, 88246, 78007, 78011, 88257, 18627, 69833, 102601, 10443, 10448, 57553, 92375, 14557, 53472, 39146, 51436, 10486, 84217, 69885, 78079, 35076, 20766, 28961, 57634, 16679, 90419, 82228, 33081, 31036, 10557, 100673, 33096, 78154, 78155, 16716, 14670, 26959, 94544, 47439, 80216, 88414, 10599, 24935, 27000, 92547, 16774, 104844, 88466, 61846, 84377, 100761, 74140, 70045, 88477, 20895, 100768, 88481, 82339, 6565, 57766, 78246, 86439, 47536, 25009, 35256, 86462, 65987, 8646, 27078, 65996, 84430, 74195, 20952, 88536, 76253, 86493, 82406, 16872, 49641, 25067, 102906, 94716, 80390, 53770, 18957, 82445, 84493, 12828, 21020, 53788, 78366, 45600, 61985, 104996, 57893, 21042, 33336, 68154, 80442, 33343, 19012, 16967, 86600, 6729, 76362, 64079, 29267, 41558, 33368, 82523, 23133, 70238, 16991, 68193, 27247, 17008, 72307, 14966, 78454, 98952, 74379, 98958, 55953, 17042, 74385, 80536, 70298, 17054, 96927, 84641, 29348, 10919, 94889, 6826, 82602, 90800, 10929, 19123, 80568, 58041, 55997, 58050, 45764, 25295, 23261, 74467, 56063, 29442, 66306, 62214, 37644, 101143, 88857, 51998, 41765, 49965, 101167, 43824, 21305, 49979, 11069, 39742, 86856, 64331, 62289, 93010, 99156, 58198, 72539, 88927, 7021, 97139, 95100, 66433, 52102, 88969, 68498, 88980, 99220, 58265, 84895, 86950, 17321, 21417, 19379, 37814, 89015, 78782, 11202, 80835, 13252, 84933, 99275, 46041, 74713, 89054, 80863, 99295, 25573, 66536, 54251, 101362, 41971, 39926, 76799, 74754, 58372, 87049, 33810, 31767, 80922, 93214, 9252, 87080, 99369, 9259, 89131, 27703, 46137, 60475, 89147, 29757, 35923, 93273, 54363, 42079, 54374, 33897, 89198, 58479, 99444, 58490, 95355, 103546, 46206, 87191, 31899, 103593, 56493, 7345, 36017, 81076, 44216, 50360, 93374, 7360, 9408, 33986, 40131, 48321, 101585, 103634, 77016, 103643, 36065, 46306, 15589, 48358, 11503, 62710, 77060, 89354, 68876, 89363, 75031, 7459, 48422, 62759, 50473, 62766, 91442, 73012, 21818, 95547, 50492, 15677, 30013, 15683, 103762, 75092, 50524, 79200, 58723, 28004, 44389, 71016, 60781, 64877, 83311, 64881, 79218, 52603, 5501, 60800, 54660, 44428, 15757, 28047, 28048, 46483, 83347, 62873, 7578, 97689, 40348, 28065, 73121, 95650, 17828, 56740, 64932, 56743, 69032, 17833, 69042, 64948, 36277, 97721, 85435, 67006, 26052, 34252, 44492, 32206, 64982, 26085, 56807, 67047, 21995, 85484, 50670, 40434, 58867, 97797, 67080, 32271, 28181, 69148, 36381, 30239, 75303, 60970, 50733, 40494, 60974, 87598, 40498, 79413, 71228, 48702, 28241, 22100, 79444, 50779, 69213, 9824, 36453, 89701, 97901, 28284, 32384, 61056, 95882, 104081, 59027, 87699, 67221, 102045, 91810, 67235, 16043, 16057, 14010, 38586, 89793, 104132, 11980, 16076, 48844, 44755, 36565, 20186, 77533, 20191, 24287, 87775, 34534, 102128, 73463, 79611, 5884, 102139, 98047, 34561, 91912, 38665, 89868, 16142, 65297, 5907, 26390, 100118, 26395, 71451, 32548, 48936, 91947, 53044, 102198, 20279, 63292, 96062, 24384, 24387, 28485, 20294, 46919, 79689, 55117, 16206, 40785, 48980, 48996, 5995, 18283, 65387, 30574, 73579, 92011, 16243, 65403, 20354, 44930, 44932, 96136, 14217, 63371, 57236, 98212, 10150, 12200, 53166, 30641, 94132, 83894, 51129, 10181, 20421, 94157, 61392, 71633, 81887, 53219, 73704, 69614, 71669, 83958]
            # full_lizard = np.array(lizard)
            # np.random.seed(self.seed)
            # np.random.shuffle(full_lizard)
            # lizard = full_lizard[:504]
            # full_snake = np.array(snake)
            # np.random.shuffle(full_snake)
            # snake = full_snake[:500]
            # np.save(os.path.join(self.data_root, "lizard.npy"), lizard)
            # np.save(os.path.join(self.data_root, "snake.npy"), snake)
            lizard = np.load(os.path.join(os.path.join(self.data_root, "lizard.npy")))
            snake = np.load(os.path.join(os.path.join(self.data_root, "snake.npy")))
            self.test_idx = np.concatenate((self.test_idx, lizard, snake))
            self.y[lizard] = 10
            self.y[snake] = 11

    def _load_data(self):
        processed_data_filename = os.path.join(self.data_root, config.processed_dataname)
        processed_data = pickle_load_data(processed_data_filename)
        self.X = processed_data[config.X_name]
        self.y = processed_data[config.y_name]
        self.y = np.array(self.y).astype(int)
        self.train_idx = processed_data[config.train_idx_name]
        self.valid_idx = processed_data[config.valid_idx_name]
        self.test_idx = processed_data[config.test_idx_name]
        self.labeled_idx = processed_data[config.labeled_idx_name]
        self.unlabeled_idx = processed_data[config.unlabeled_idx_name]
        self.class_names = processed_data[config.class_name]
        self.add_info = processed_data[config.add_info_name]

        if self.selected_labeled_num is None and self.selected_total_num is None:
            self.selected_labeled_num = self.add_info.get("default_selected_labeled_num", None)
            self.selected_total_num = self.add_info.get("default_selected_total_num", None)
            self.seed = self.add_info.get("default_seed", 123)

        # produce unlabeled data
        assert (self.selected_labeled_num is not None and self.selected_total_num is not None)
        dir_name = "labeled-" + str(self.selected_labeled_num) + \
                   ".total-" + str(self.selected_total_num) + ".seed-" + str(self.seed)
        logger.info(dir_name)
        dir_path = os.path.join(self.data_root, dir_name)
        check_dir(dir_path)
        self.selected_dir = dir_path
        idx_info_path = os.path.join(dir_path, "idx_info.pkl")
        if os.path.exists(idx_info_path):
            logger.info("idx info exists in: {}".format(idx_info_path))
            idx_info = pickle_load_data(idx_info_path)
            self.train_idx = idx_info["train_idx"]
            self.selected_labeled_idx = idx_info["selected_labeled_idx"]
            self.rest_idxs = np.array(range(len(self.train_idx)))
            return
        # selected_labeled_idx = np.random.choice(self.labeled_idx, self.selected_labeled_num, replace=False)
        # class balance selection
        selected_labeled_num_in_each_class = np.zeros(len(self.class_names))
        class_num = len(selected_labeled_num_in_each_class)
        num_per_class = self.selected_labeled_num // class_num
        selected_labeled_num_in_each_class = (np.ones(class_num) * num_per_class).astype(int)
        rest_num = self.selected_labeled_num - num_per_class * class_num
        if rest_num > 0:
            idx = np.random.choice(class_num, rest_num, replace=False)
            selected_labeled_num_in_each_class[idx] += 1
        selected_labeled_idx = []
        labeled_y = self.y[self.labeled_idx]
        for i in range(class_num):
            labeled_idx_in_this_class = self.labeled_idx[labeled_y == i]
            selected_labeled_idx_in_this_class = \
                np.random.choice(labeled_idx_in_this_class, selected_labeled_num_in_each_class[i], replace=False)
            selected_labeled_idx = selected_labeled_idx + selected_labeled_idx_in_this_class.tolist()
        selected_labeled_idx = np.array(selected_labeled_idx)
        selected_labeled_idx.sort()

        # get unlabeled idx
        rest_selected_labeled_num = self.selected_total_num - self.selected_labeled_num
        rest_selected_labeled_idx = np.random.choice(self.unlabeled_idx,
                                                     rest_selected_labeled_num,
                                                     replace=False)
        train_idx = np.hstack((selected_labeled_idx, rest_selected_labeled_idx))
        train_idx.sort()
        self.train_idx = train_idx
        self.selected_labeled_idx = selected_labeled_idx
        idx_info = {
            "selected_labeled_idx": selected_labeled_idx,
            "train_idx": train_idx
        }
        pickle_save_data(idx_info_path, idx_info)

    def case_set_rest_idxs(self):
        gt = self.get_train_ground_truth()
        self.rest_idxs = np.array(range(len(gt)))[gt != -1]
        print("rest_idxs len: ", len(self.rest_idxs))

    def get_rest_idxs(self):
        return self.rest_idxs.copy()

    def get_new_id_map(self):
        m = {}
        for i in range(len(self.rest_idxs)):
            m[self.rest_idxs[i]] = i
        return m

    def get_new_map_reverse(self):
        m = {}
        for i in range(len(self.rest_idxs)):
            m[i] = self.rest_idxs[i]
        return m

    def get_removed_idxs(self):
        return self.removed_idxs

    def get_train_num(self):
        return len(self.train_idx)

    def get_class_names(self):
        return self.class_names

    def get_train_X(self):
        return self.X[np.array(self.train_idx)].copy()[self.rest_idxs]

    def get_train_label(self):
        y = np.ones(self.X.shape[0]) * -1
        y[np.array(self.selected_labeled_idx)] = self.y[np.array(self.selected_labeled_idx)]
        y = y[np.array(self.train_idx)]
        # y[5300] = 5
        return y.astype(int)[self.rest_idxs]

    def get_full_train_X(self):
        return self.X[np.array(self.train_idx)].copy()

    def get_full_train_label(self):
        y = np.ones(self.X.shape[0]) * -1
        y[np.array(self.selected_labeled_idx)] = self.y[np.array(self.selected_labeled_idx)]
        y = y[np.array(self.train_idx)]
        return y.astype(int)

    def get_full_train_idx(self):
        return self.train_idx.copy(0)

    def get_train_idx(self):
        return self.train_idx.copy()[self.rest_idxs]

    def get_full_train_ground_truth(self):
        return self.y[np.array(self.train_idx)].copy().astype(int)

    def get_train_ground_truth(self):
        return self.y[np.array(self.train_idx)].copy().astype(int)[self.rest_idxs]

    def get_test_X(self):
        return self.X[np.array(self.test_idx)].copy()

    def get_test_ground_truth(self):
        return self.y[np.array(self.test_idx)].copy().astype(int)

    def remove_instance(self, idxs):
        self.rest_idxs = [i for i in self.rest_idxs if i not in idxs]
        self.removed_idxs += idxs
        logger.info("rest data: {}".format(len(self.rest_idxs)))

    def label_instance(self, idxs, labels):
        for i in range(len(idxs)):
            idx = idxs[i]
            label = labels[i]
            # self.train_y[idx] = label
            self.y[self.train_idx[idx]] = label
            self.selected_labeled_idx = np.append(self.selected_labeled_idx, self.train_idx[idx])
        labeled_num = sum(self.train_y != -1)
        logger.info("labeled data num: {}".format(labeled_num))


class GraphData(Data):
    def __init__(self, dataname, labeled_num=None, total_num=None, seed=123):
        super(GraphData, self).__init__(dataname, labeled_num, total_num, seed)

        self.max_neighbors = 200
        self.affinity_matrix = None
        self.state_idx = 0
        self.state = {}
        self.state_data = {}
        self.current_state = None

        # init action trail
        self.state = Node("root")
        self.current_state = self.state

    def _preprocess_neighbors(self):
        neighbors_model_path = os.path.join(self.selected_dir, "neighbors_model.pkl")
        neighbors_path = os.path.join(self.selected_dir, "neighbors.npy")
        neighbors_weight_path = os.path.join(self.selected_dir,
                                             "neighbors_weight.npy")
        test_neighbors_path = os.path.join(self.selected_dir, "test_neighbors.npy")
        test_neighbors_weight_path = os.path.join(self.selected_dir, "test_neighbors_weight.npy")
        if os.path.exists(neighbors_model_path) and \
                os.path.exists(neighbors_path) and \
                os.path.exists(test_neighbors_path) and DEBUG == False:
            logger.info("neighbors and neighbor_weight exist!!!")
            self.neighbors = np.load(neighbors_path)
            self.test_neighbors = np.load(test_neighbors_path)
            return
        logger.info("neighbors and neighbor_weight "
                    "do not exist, preprocessing!")
        train_X = self.get_train_X()
        train_num = train_X.shape[0]
        train_y = self.get_train_label()
        train_y = np.array(train_y)
        test_X = self.get_test_X()
        test_num = test_X.shape[0]
        self.max_neighbors = min(len(train_y), self.max_neighbors)
        logger.info("data shape: {}, labeled_num: {}"
                    .format(str(train_X.shape), sum(train_y != -1)))
        nn_fit = NearestNeighbors(7, n_jobs=-4).fit(train_X)
        logger.info("nn construction finished!")
        neighbor_result = nn_fit.kneighbors_graph(nn_fit._fit_X,
                                                  self.max_neighbors,
                                                  # 2,
                                                  mode="distance")
        test_neighbors_result = nn_fit.kneighbors_graph(test_X,
                                                        self.max_neighbors,
                                                        mode="distance")
        logger.info("neighbor_result got!")
        self.neighbors, neighbors_weight = self.csr_to_impact_matrix(neighbor_result,
                                                                     train_num, self.max_neighbors)
        self.test_neighbors, test_neighbors_weight = self.csr_to_impact_matrix(test_neighbors_result,
                                                                               test_num, self.max_neighbors)

        logger.info("preprocessed neighbors got!")

        # save neighbors information
        pickle_save_data(neighbors_model_path, nn_fit)
        np.save(neighbors_path, self.neighbors)
        np.save(neighbors_weight_path, neighbors_weight)
        np.save(test_neighbors_path, self.test_neighbors)
        np.save(test_neighbors_weight_path, test_neighbors_weight)

    def csr_to_impact_matrix(self, neighbor_result, instance_num, max_neighbors):
        neighbors = np.zeros((instance_num, max_neighbors)).astype(int)
        neighbors_weight = np.zeros((instance_num, self.max_neighbors))
        for i in range(instance_num):
            start = neighbor_result.indptr[i]
            end = neighbor_result.indptr[i + 1]
            j_in_this_row = neighbor_result.indices[start:end]
            data_in_this_row = neighbor_result.data[start:end]
            sorted_idx = data_in_this_row.argsort()
            assert (len(sorted_idx) == self.max_neighbors)
            j_in_this_row = j_in_this_row[sorted_idx]
            data_in_this_row = data_in_this_row[sorted_idx]
            neighbors[i, :] = j_in_this_row
            neighbors_weight[i, :] = data_in_this_row
        return neighbors, neighbors_weight

    def get_graph(self, n_neighbor=None, rebuild=False):
        if self.affinity_matrix is None or rebuild is True:
            self._construct_graph(n_neighbor)
        n_components, labels = sparse.csgraph.connected_components(csgraph=self.affinity_matrix, return_labels=True)
        logger.info("n_components: {}".format(n_components))
        train_y = self.get_train_label()
        unp = []
        for i in range(n_components):
            y_in_this_component = train_y[labels==i]
            if not any(y_in_this_component > -1):
                idxs = self.get_rest_idxs()[labels==i]
                unp = unp + idxs.tolist()
        logger.info("connected components without labeled data - instance num: {}".format(len(unp)))
        return self.affinity_matrix.copy()

    def _construct_graph(self, n_neighbor=None):
        # create neighbors buffer
        self._preprocess_neighbors()

        # # load neighbors information
        # neighbors_path = os.path.join(self.selected_dir, "neighbors.npy")
        # neighbors_weight_path = os.path.join(self.selected_dir,
        #                                      "neighbors_weight.npy")
        # neighbors = np.load(neighbors_path)
        # neighbors_weight = np.load(neighbors_weight_path)
        neighbors = self.neighbors
        instance_num = neighbors.shape[0]
        train_y = self.get_train_label()
        train_y = np.array(train_y)
        self.train_y = train_y
        print("train_y", train_y.shape)

        # get knn graph in a csr form
        indptr = [i * n_neighbor for i in range(instance_num + 1)]
        logger.info("get indptr")
        indices = neighbors[:, :n_neighbor].reshape(-1).tolist()
        logger.info("get indices")
        data = neighbors[:, :n_neighbor].reshape(-1)
        logger.info("get data")
        data = (data * 0 + 1.0).tolist()
        logger.info("get data in connectivity")
        affinity_matrix = sparse.csr_matrix((data, indices, indptr),
                                            shape=(instance_num, instance_num))
        affinity_matrix = affinity_matrix + affinity_matrix.T
        affinity_matrix = sparse.csr_matrix((np.ones(len(affinity_matrix.data)).tolist(),
                                             affinity_matrix.indices, affinity_matrix.indptr),
                                            shape=(instance_num, instance_num))
        logger.info("affinity_matrix construction finished!!")
        self.affinity_matrix = affinity_matrix

        return affinity_matrix

    def get_neighbors_model(self):
        neighbors_model_path = os.path.join(self.selected_dir, "neighbors_model.pkl")
        if os.path.exists(neighbors_model_path):
            self._preprocess_neighbors()
        neighbors_model = pickle_load_data(neighbors_model_path)
        return neighbors_model

    def get_neighbors(self):
        return self.neighbors

    def record_state(self, pred):
        new_state = Node(self.state_idx, parent=self.current_state)
        self.state_idx = self.state_idx + 1
        self.current_state = new_state
        self.state_data[self.current_state.name] = {
            "affinity_matrix": self.affinity_matrix.copy(),
            "train_idx": self.get_train_idx(),
            "train_y": self.get_train_label(),
            "state": self.current_state,
            "pred": pred
        }
        self.print_state()

    # this function is for DEBUG
    def print_state(self):
        dict_exporter = DictExporter()
        tree = dict_exporter.export(self.state)
        print(tree)
        print("current state:", self.current_state.name)

    def return_state(self):
        max_count = 1
        history = []
        for i in range(self.state_idx):
            data = self.state_data[i]
            margin = entropy(data["pred"].T + 1e-20).mean()
            margin = round(margin, 3)
            # get changes
            dist = [0, 0, 0, 0]
            pre_data_state = data["state"].parent
            if pre_data_state.name != "root":
                pre_data = self.state_data[pre_data_state.name]
                now_affinity = data["affinity_matrix"]
                pre_affinity = pre_data["affinity_matrix"]
                # added edges
                dist[0] = (now_affinity[pre_affinity == 0] == 1).sum()
                # removed edges
                dist[1] = (now_affinity[pre_affinity == 1] == 0).sum()
                # removed instances
                dist[2] = len(pre_data["train_idx"]) - len(data["train_idx"])
                # label changes
                pre_label = pre_data["pred"].argmax(axis=1)
                pre_label[pre_data["pred"].max(axis=1) < 1e-8] = -1
                label = data["pred"].argmax(axis=1)
                label[data["pred"].argmax(axis=1) < 1e-8] = -1
                dist[3] = sum(label != pre_label)
            dist = [int(k) for k in dist]
            # update max_count
            if max(dist) > max_count:
                max_count = max(dist)
            children = data["state"].children
            children_idx = [int(i.name) for i in children]
            history.append({
                "dist": dist,
                "margin": margin,
                "children": children_idx,
                "id": i
            })

        # update dist
        for i in range(self.state_idx):
            state = history[i]
            unnorm_dist = state["dist"].copy()
            state["dist"] = [i / max_count for i in unnorm_dist]
            state["unnorm_dist"] = unnorm_dist
        return {
            "history": history,
            "current_id": int(self.current_state.name)
        }

    def change_state(self, id):
        state = self.state_data[id]["state"]
        self.current_state = state
        self.print_state()
        return self.return_state()

    def get_test_neighbors(self):
        return self.test_neighbors

    def add_edge(self, added_edges):
        None

    def remove_edge(self, added_edges):
        None

    def editing_data(self, data):
        self.remove_instance(data["deleted_idxs"])
        self.label_instance(data["labeled_idxs"], data["labels"])
        self.remove_edge(data["deleted_edges"])

    def update_graph(self, deleted_idxs):
        logger.info("begin update graph according to editing info")
        rest_idxs = self.get_rest_idxs()
        remove_idxs = self.get_removed_idxs()
        logger.info("total len: {}".format(len(rest_idxs) + len(remove_idxs)))
        self.affinity_matrix = self.affinity_matrix[rest_idxs, :]
        self.affinity_matrix = self.affinity_matrix[:, rest_idxs]
        # update neighbors info
        self.neighbors[remove_idxs, :] = -1
        for idx in tqdm(deleted_idxs):
            self.neighbors[self.neighbors == idx] = -1
            self.test_neighbors[self.test_neighbors == idx] = -1

        logger.info("affinity_matrix shape after updating: {}".format(str(self.affinity_matrix.shape)))
