import numpy as np
import os
import matplotlib.pyplot as plt
from scipy.stats import entropy
import shutil

from sklearn.semi_supervised import LabelSpreading
from sklearn.metrics import accuracy_score

from application.views.utils.config_utils import config
from application.views.utils.helper_utils import check_dir
from application.views.utils.embedder_utils import Embedder
from application.views.model_utils.model import SSLModel

def main():
    lizard = [52, 225, 232, 415, 561, 615, 1009, 1026, 1224, 1246, 1478, 1514, 1657, 1933, 2009, 2065, 2160, 2629, 2920, 2925, 3005, 3112, 3281, 3435, 3717, 3979, 3981, 3997, 4428, 4463, 4505, 4522, 4649, 4720, 4773, 4827, 4914, 5045, 5055, 5142, 5211, 5480, 5491, 5493, 5606, 5631, 6038, 6281, 6594, 6706, 6774, 6819, 6909, 6929, 6942, 7171, 7362, 7503, 7681, 7686, 7897, 7992, 8041, 8067, 8194, 8294, 8405, 8428, 8559, 8579, 8621, 8632, 8948, 9076, 9286, 9346, 9422, 9571, 9783, 9812, 9897, 10124, 10196, 10329, 10432, 10452, 10627, 10814, 10841, 10914, 10989, 11025, 11201, 11248, 11337, 11385, 11515, 11645, 11730, 11844,11959, 12174, 12298, 12439, 12446, 12559, 12958, 13052, 13158, 13294, 13296, 13436, 13699, 13882, 14089, 14259, 14486, 14643, 14685, 14953, 15010, 15252, 15368, 15417, 15593, 15769, 15779, 15795, 15851, 15879, 15995, 16115, 16125, 16177, 16217, 16500, 16527, 16604, 16721, 16749, 16794, 16955, 16996, 17050, 17253, 17266, 17698, 17754, 17834, 17836, 17989, 18033, 18119, 18158, 18192, 18211, 18407, 18496, 18500, 18535, 18785, 18829, 18980, 19008, 19241, 19306, 19477, 19529, 19798, 19825, 19943]
    snake = [56, 240, 689, 1032, 1048, 1513, 2043, 2061, 2134, 2302, 2944, 3408, 3568, 3642, 3813, 4434, 4614, 4635, 4799, 4814, 5036, 5109, 5516, 6174, 6243, 6382, 6442, 6451, 6499, 6719, 6729, 6852, 6980, 7274, 7481, 7994, 8076, 8668, 9152, 9787, 9990, 10015, 10071, 10247, 10279, 10529, 10629, 10772, 10788, 10908, 10976, 11410, 11554, 11948, 12002, 12006, 12817, 13020, 13441, 13464, 13532, 13877, 14098, 14316, 14335, 14337, 14428, 14810, 15620, 15662, 15831, 17106, 17225, 17229, 17415, 18360, 18870, 19103, 19244, 19590, 19704]
    d = SSLModel(config.stl, labeled_num=50, total_num=20000, seed=123)
    print("use buffer")
    test_X = d.data.get_test_X()
    print("test_X.shape", test_X.shape)
    d.init(k=6, evaluate=True, simplifying=False)
    train_pred = np.load(os.path.join(d.selected_dir, "train_pred.npy"))
    print("initial ent", entropy(train_pred.T + 1e-20).mean())
    train_labels = train_pred.argmax(axis=1)
    train_gt = d.data.get_train_ground_truth()

    np.random.seed(seed=123)
    selected_lizard = np.random.choice(lizard, 5, replace=False)
    selected_snake = np.random.choice(snake, 5, replace=False)
    d.data.label_instance(selected_lizard, [10, 10, 10, 10, 10])
    d.data.label_instance(selected_snake, [11, 11, 11, 11, 11])
    train_y = d.data.get_train_label()
    print(np.bincount(train_y + 1))
    test_gt = d.data.get_test_ground_truth()
    print(np.bincount(test_gt))
    d._training(evaluate=True, simplifying=False)
    selected_idxs = [14, 15, 29, 110, 163, 194, 243, 281, 311, 323, 343, 352, 427, 471, 500, 534, 535, 554, 572, 596,
                     681, 808, 822, 858, 864, 865, 1025, 1076, 1104, 1121, 1216, 1225, 1288, 1300, 1310, 1347, 1355,
                     1394, 1401, 1524, 1594, 1615, 1814, 1872, 2045, 2067, 2097, 2132, 2177, 2243, 2279, 2325, 2328,
                     2340, 2372, 2447, 2462, 2524, 2559, 2580, 2602, 2647, 2783, 2795, 2829, 2938, 3011, 3051, 3097,
                     3099, 3120, 3125, 3235, 3296, 3321, 3323, 3398, 3431, 3539, 3551, 3559, 3614, 3674, 3693, 3712,
                     3723, 3737, 3800, 3831, 3875, 3922, 3948, 4050, 4242, 4265, 4303, 4380, 4650, 4715, 4890, 4913,
                     4939, 4949, 4954, 4968, 5038, 5054, 5112, 5146, 5190, 5216, 5286, 5295, 5301, 5346, 5372, 5374,
                     5451, 5498, 5571, 5724, 5779, 5799, 5805, 5847, 5851, 5871, 5880, 5887, 5919, 5945, 5949, 5984,
                     6013, 6092, 6094, 6159, 6280, 6296, 6313, 6471, 6484, 6496, 6502, 6520, 6523, 6647, 6689, 6699,
                     6728, 6771, 6834, 6904, 6908, 6939, 7018, 7024, 7045, 7090, 7132, 7135, 7161, 7192, 7267, 7297,
                     7298, 7323, 7325, 7341, 7390, 7517, 7630, 7731, 7830, 7998, 8129, 8140, 8167, 8196, 8290, 8322,
                     8358, 8370, 8392, 8396, 8599, 8643, 8671, 8715, 8743, 8768, 8789, 8806, 8810, 8829, 8876, 8932,
                     8944, 8953, 8967, 9047, 9101, 9115, 9135, 9154, 9159, 9164, 9200, 9219, 9242, 9292, 9329, 9399,
                     9510, 9534, 9544, 9553, 9600, 9709, 9791, 9922, 9986, 10025, 10066, 10106, 10117, 10158, 10161,
                     10219, 10220, 10232, 10236, 10238, 10250, 10293, 10382, 10409, 10422, 10489, 10525, 10526, 10560,
                     10593, 10637, 10654, 10660, 10698, 10735, 10749, 10812, 10915, 10955, 10994, 11061, 11194, 11254,
                     11265, 11296, 11349, 11383, 11399, 11439, 11475, 11511, 11573, 11581, 11708, 11724, 11760, 11785,
                     11837, 11878, 11895, 11925, 11952, 11981, 11996, 12009, 12024, 12032, 12040, 12115, 12345, 12347,
                     12363, 12415, 12448, 12469, 12604, 12606, 12641, 12677, 12750, 12760, 12769, 12775, 12782, 12798,
                     12924, 12988, 13031, 13044, 13049, 13098, 13134, 13142, 13226, 13230, 13259, 13403, 13415, 13427,
                     13561, 13592, 13609, 13690, 13742, 13778, 13813, 13826, 13831, 13838, 13891, 13964, 14309, 14359,
                     14429, 14500, 14555, 14558, 14671, 14721, 14737, 14817, 14820, 14847, 14902, 14918, 14968, 15008,
                     15108, 15132, 15151, 15266, 15279, 15283, 15302, 15328, 15369, 15381, 15389, 15390, 15393, 15472,
                     15606, 15617, 15626, 15883, 15888, 15962, 15969, 15974, 15978, 15984, 16031, 16045, 16056, 16084,
                     16122, 16173, 16178, 16230, 16240, 16267, 16300, 16306, 16326, 16361, 16407, 16410, 16411, 16546,
                     16548, 16578, 16668, 16687, 16709, 16747, 16754, 16762, 16775, 16829, 16874, 16990, 16991, 16995,
                     17044, 17068, 17202, 17217, 17288, 17306, 17322, 17371, 17399, 17400, 17431, 17450, 17630, 17661,
                     17706, 17707, 17792, 17865, 17943, 18075, 18137, 18221, 18229, 18256, 18351, 18356, 18448, 18510,
                     18618, 18632, 18668, 18739, 18790, 18864, 18916, 19083, 19158, 19163, 19302, 19386, 19416, 19439,
                     19451, 19466, 19492, 19572, 19580, 19589, 19641, 19782, 19814, 19886, 19997]
    selected_idxs = np.array(selected_idxs)
    idxs = train_labels[selected_idxs] == 3
    idxs[train_labels[selected_idxs]==4] = True
    selected_c3_idxs = selected_idxs[idxs]
    d.local_search_k(selected_c3_idxs, simplifying=False, k_list=list(range(1,3))); exit()

def test_API():
    d = SSLModel(config.stl, labeled_num=50, total_num=20000, seed=123)
    d.case_labeling()
    d.init(k=6, evaluate=True, simplifying=False)

def change_local(selected_idxs, neighbors, affinity_matrix, local_k):
    from scipy import sparse
    selected_num = len(selected_idxs)
    instance_num = neighbors.shape[0]
    indptr = [i * local_k for i in range(selected_num + 1)]
    indices = neighbors[selected_idxs][:, :local_k].reshape(-1).tolist()
    data = neighbors[selected_idxs][:, :local_k].reshape(-1)
    data = (data * 0 + 1.0).tolist()
    selected_affinity_matrix = sparse.csr_matrix((data, indices, indptr),
                                                 shape=(selected_num, instance_num)).toarray()
    affinity_matrix = affinity_matrix.toarray()
    affinity_matrix[selected_idxs, :] = selected_affinity_matrix
    affinity_matrix = sparse.csr_matrix(affinity_matrix)

    affinity_matrix = affinity_matrix + affinity_matrix.T
    affinity_matrix = sparse.csr_matrix((np.ones(len(affinity_matrix.data)).tolist(),
                                         affinity_matrix.indices, affinity_matrix.indptr),
                                        shape=(instance_num, instance_num))
    return affinity_matrix

def traversal():
    d = SSLModel(config.stl, labeled_num=50, total_num=20000, seed=123)
    neighbors = np.load(os.path.join(d.selected_dir, "neighbors.npy"))
    d.case_labeling()
    d.init(k=6, evaluate=False, simplifying=False)
    back_up_affinity_matrix = d.data.affinity_matrix.copy()
    test_pred = d.adaptive_evaluation()
    train_pred = d.labels[-1]
    test_pred = np.array(test_pred)
    test_pred = test_pred.copy()
    test_gt = d.data.get_test_ground_truth()
    train_gt = d.data.get_train_ground_truth()
    f = open(os.path.join(d.selected_dir, "tra.txt"), "w")
    for k in [2,3,4,5]:
    # for k in [2]:
        for i in range(12):
            inds = train_gt == i
            inds[train_pred == i] = False
            selected_idxs = np.array(range(len(inds)))[inds]
            affinity_matrix = change_local(selected_idxs, neighbors, back_up_affinity_matrix,
                                           k)
            d.data.affinity_matrix = affinity_matrix
            d._training(rebuild=False, evaluate=False, simplifying=False)
            new_test_pred = np.array(d.adaptive_evaluation())
            acc = accuracy_score(test_gt, new_test_pred)
            ent = entropy(d.pred_dist.T + 1e-20).mean()
            s = "k: {}, i: {}, acc: {}, ent: {}, edge_sum: {}".format(k,i,acc,ent,
                                                                      affinity_matrix.toarray().sum())
            print(s)
            f.writelines(s + "\n")
            # exit()
        # exit()

def playground():
    d = SSLModel(config.stl, labeled_num=50, total_num=20000, seed=123)
    neighbors = np.load(os.path.join(d.selected_dir, "neighbors.npy"))
    d.case_labeling()
    d.init(k=6, evaluate=False, simplifying=False)
    back_up_affinity_matrix = d.data.affinity_matrix.copy()
    # test_pred = d.adaptive_evaluation()
    # test_pred = np.array(test_pred)
    # test_pred = test_pred.copy()
    train_pred = d.labels[-1]
    test_gt = d.data.get_test_ground_truth()
    train_gt = d.data.get_train_ground_truth()
    affinity_matrix = back_up_affinity_matrix.copy()
    # for k,i in [[2,7], [2,6],[2,5]]:
    # for k,i in [[2,7], [2,6],[2,5]]:
    for k,i in [[2,5]]:
        inds = train_gt == i
        inds[train_pred == i] = False
        selected_idxs = np.array(range(len(inds)))[inds]
        affinity_matrix = change_local(selected_idxs, neighbors, affinity_matrix,
                                       k)
    for i in [2,3,5,6]:
        inds = train_gt == i
        inds[train_pred == i] = False
        selected_idxs = np.array(range(len(inds)))[inds]
        for idx in selected_idxs:
            nei_idx = affinity_matrix[idx, :].indices
            for s in nei_idx:
                if train_gt[s] != i:
                    affinity_matrix[idx, s] = 0
    d.data.affinity_matrix = affinity_matrix
    d._training(rebuild=False, evaluate=False, simplifying=False)
    new_test_pred = np.array(d.adaptive_evaluation())
    acc = accuracy_score(test_gt, new_test_pred)
    ent = entropy(d.pred_dist.T + 1e-20).mean()
    s = "k: {}, i: {}, acc: {}, ent: {}, edge_sum: {}".format(k, i, acc, ent,
                                                              affinity_matrix.toarray().sum())
    print(s)
def remove_edge():
    d = SSLModel(config.stl, labeled_num=50, total_num=20000, seed=123)
    neighbors = np.load(os.path.join(d.selected_dir, "neighbors.npy"))
    d.case_labeling()
    d.init(k=6, evaluate=False, simplifying=False)
    back_up_affinity_matrix = d.data.affinity_matrix.copy()
    test_pred = d.adaptive_evaluation()
    train_pred = d.labels[-1]
    test_pred = np.array(test_pred)
    test_pred = test_pred.copy()
    test_gt = d.data.get_test_ground_truth()
    train_gt = d.data.get_train_ground_truth()
    for i in [5]:
        affinity_matrix = back_up_affinity_matrix.copy()
        inds = train_gt == i
        inds[train_pred == i] = False
        selected_idxs = np.array(range(len(inds)))[inds]
        for idx in selected_idxs:
            nei_idx = affinity_matrix[idx, :].indices
            for s in nei_idx:
                if train_gt[s] != i:
                    affinity_matrix[idx, s] = 0
        d.data.affinity_matrix = affinity_matrix
        d._training(rebuild=False, evaluate=False, simplifying=False)
        new_test_pred = np.array(d.adaptive_evaluation())


if __name__ == '__main__':
    playground()