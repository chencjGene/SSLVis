import numpy as np
import os
import json

from .case_base import CaseBase
from ..utils.config_utils import config
from ..utils.helper_utils import pickle_save_data, pickle_load_data

class CaseOCT(CaseBase):
    def __init__(self):
        dataname = config.oct
        super(CaseOCT, self).__init__(dataname)

        self.step = self.base_config


    def run(self, k=None, evaluate=False, simplifying=False, step=None, use_buffer = False):
        if step is None:
            step = self.base_config["step"]
        
        if k is None:
            k = self.base_config["k"]
        self.model.step = step
        self.step = step
        self.model.step = 0
        if (not use_buffer) or (not os.path.exists(os.path.join(self.model.selected_dir, "case-step" + str(step) + ".pkl"))):
            self._init_model(k=k, evaluate=evaluate, simplifying=False)
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)
        else:
            self.model.step = step
            self.model = self.load_model(
                os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"))
            return self.model
        self.pred_result[0] = self.model.get_pred_labels()

        categories = [1 for i in range(12)]
        categories[11] = False
        self.model.adaptive_evaluation(step=0)

        if step >= 1:
            self.model.step += 1
            no_update = [5682,5684,1228,1482,8601,1714, 6377, 3475]
            neighbors = self.model.data.get_neighbors(5, True)[no_update].flatten().tolist()
            no_update = list(set(neighbors))
            print("no update neighbors:{}".format(no_update))
            self.model.data.actions = []
            c = json.loads(open(os.path.join(self.model.selected_dir, "local_1_idxs.txt"), "r").read().strip("\n"))
            c = list(set(c)-set(no_update))
            self.model.local_search_k(c, [1, 2, 3, 4], categories, simplifying=False, evaluate=evaluate, record=False)
        
        # if step >= 2:
            self.model.data.actions = []
            e = json.loads(open(os.path.join(self.model.selected_dir, "local_2_idxs.txt"), "r").read().strip("\n"))
            e = list(set(e) - set(no_update))
            self.model.local_search_k(e, [1, 2, 3, 4], categories, simplifying=True, evaluate=evaluate)

            self.pred_result[1] = self.model.get_pred_labels()
            save = (self.model, self.model.data)
            self.model.adaptive_evaluation(step=1)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)

        if step >= 2:
            self.model.step += 1
            self.model.data.actions = []
            remove_edges = json.loads(open(os.path.join(self.model.selected_dir, "removed_edges.txt"), "r").read().strip("\n"))
            # remove_edges_vis = []
            self.model.data.remove_edge(remove_edges)

            self.model._training(rebuild=False, evaluate=True, simplifying=True)
            self.pred_result[3] = self.model.get_pred_labels()
            self.model.adaptive_evaluation(step=2)
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)


        if step >= 3:
            self.model.step += 1
            train_pred_step_1 = self.model.get_pred_labels()
            train_gt = self.model.data.get_train_ground_truth()
            affinity_matrix = self.model.data.affinity_matrix
            for i in range(len(train_pred_step_1)):
                # for i in selected_idxs:
                #     if i in selected_idxs:
                #         continue
                if train_pred_step_1[i] != train_gt[i]:
                    nei_idx = affinity_matrix[i, :].indices
                    for s in nei_idx:
                        if train_gt[i] != train_gt[s]:
                            affinity_matrix[i, s] = 0
                            affinity_matrix[s, i] = 0
        
            self.model.data.affinity_matrix = self.model.data.correct_unconnected_nodes(affinity_matrix)
            self.model._training(rebuild=False, evaluate=evaluate, simplifying=simplifying)
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)

        if step >= 4:
            self.model.step += 1
            train_pred_step_2 = self.model.get_pred_labels()
            # untrain_idxs = [i for i in self.model.data.unlabeled_idx if i not in self.model.data.train_idx]
            # unused_idxs = [i for i in untrain_idxs if i not in self.model.data.test_idx]
            # processed_data_filename = os.path.join(self.model.data_root, config.processed_dataname)
            # processed_data = pickle_load_data(processed_data_filename)
            # unused_idxs = unused_idxs + processed_data[config.test_idx_name].tolist()
            # unused_idxs = np.array(unused_idxs)
            # idx_2 = unused_idxs[self.model.data.y[unused_idxs] == 2]
            # np.random.seed(12)
            # idx_2 = np.random.choice(idx_2, 500, replace=False)
            # pickle_save_data(os.path.join(self.model.selected_dir, "step-3-add-data.pkl"), idx_2)
            idx_2 = pickle_load_data(os.path.join(self.model.selected_dir, "step-3-add-data.pkl"))
            self.model.data.add_data_oct(idx_2, train_pred_step_2, 2)
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)

        if step >=3:
            self.model._training(rebuild=False, evaluate=evaluate, simplifying=simplifying)

        # if not evaluate:
        #     self.model.adaptive_evaluation_unasync()


        return self.model