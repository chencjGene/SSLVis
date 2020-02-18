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

from cases.STL.local_update_k import change_local

def max_sim_num():
    d = SSLModel(config.stl, labeled_num=50, total_num=20000, seed=123)
    train_neighbors = np.load(os.path.join(d.selected_dir, "neighbors.npy"))
    d.case_labeling()
    d.init(k=6, evaluate=False, simplifying=False)
    back_up_affinity_matrix = d.data.affinity_matrix.copy()
    train_pred = d.labels[-1]
    test_pred = d.adaptive_evaluation()
    # test_pred = np.array(test_pred)
    # test_pred = test_pred.copy()
    test_gt = d.data.get_test_ground_truth()
    train_gt = d.data.get_train_ground_truth()
    affinity_matrix = d.data.affinity_matrix

    sim_num = np.zeros(len(train_gt)).astype(int)
    for i in range(len(train_gt)):
        if train_pred[i] != train_gt[i]:
            idxs = train_neighbors[i, 1:6]
            count = 0
            for idx in idxs:
                if train_gt[idx] != train_gt[i]:
                    break
                count = count + 1
            sim_num[i] = count

    print(np.bincount(sim_num))

    for i in range(1,6):
        selected_idx = np.array(range(len(train_gt)))[sim_num == i]
        affinity_matrix = change_local(selected_idx, train_neighbors, affinity_matrix, i+1)
    d.data.affinity_matrix = affinity_matrix
    d._training(rebuild=False, evaluate=False, simplifying=False)
    new_test_pred = np.array(d.adaptive_evaluation())

if __name__ == '__main__':
    max_sim_num()