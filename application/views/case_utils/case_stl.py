import numpy as np
import os
import json

from .case_base import CaseBase
from ..utils.config_utils import config
from ..utils.helper_utils import pickle_save_data, pickle_load_data

class CaseSTL(CaseBase):
    def __init__(self):
        dataname = config.stl
        super(CaseSTL, self).__init__(dataname)
        self.step = self.base_config




    def run(self, k=6, evaluate=True, simplifying=False, step=None, use_buffer = False):
        self.model.data.actions = []
        if step is None:
            step = self.base_config["step"]
        self.model.step = step
        self.step = step
        self.model.step = 0
        if (not use_buffer) or (not os.path.exists(os.path.join(self.model.selected_dir, "case-step" + str(step) + ".pkl"))):
            self._init_model(k=k, evaluate=evaluate, simplifying=False)
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)
        else:
            self.model.step = step
            self.model = self.load_model(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"))
            return self.model
        self.pred_result[0] = self.model.get_pred_labels()



        if step >= 1:
            self.model.step += 1
            print("step 1")
            self.model.data.actions = []
            self.model.data.add_new_categories("snake")
            self.model.data.label_instance([6219, 11966, 12467, 7573, 11905], [10, 10, 10, 10, 10])
            self.model._training(rebuild=False, evaluate=evaluate, simplifying=False)
            self.pred_result[1] = self.model.get_pred_labels()
            self.model.adaptive_evaluation(step=1)
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)

        if step >= 2:
            self.model.step += 1
            print("step 2")
            self.model.data.label_instance(
                json.loads(open(os.path.join(self.model.selected_dir, "dog_idxs.txt"), "r").read().strip("\n")), [5, 5, 5])

            # self._init_model(k=k, evaluate=True, simplifying=simplifying)
            self.model._training(rebuild=False, evaluate=evaluate, simplifying=False)
            self.pred_result[2] = self.model.get_pred_labels()
            self.model.adaptive_evaluation(step=2)
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)
        
        # if step >= 1.4:
        #     self.model.data.label_instance([5146, 2339], [4, 6])
        #     self.model._training(rebuild=False, evaluate=False, simplifying=False)


        categories = [1 for i in range(11)]
        if step >= 3:
            self.model.step += 1
            self.model.data.actions = []
            c = json.loads(open(os.path.join(self.model.selected_dir, "local_4_idxs.txt"), "r").read().strip("\n"))
            # self.model.local_search_k(c, range(7, 40), categories, simplifying=False, evaluate=True)
            self.model.local_search_k(c, range(27, 29), categories, simplifying=False, evaluate=True, record=False)

            edge_list = json.loads(open(os.path.join(self.model.selected_dir, "removed_1.txt"), "r").read().strip("\n"))
            self.model.data.remove_edge(edge_list)
            self.model._training(rebuild=False, evaluate=True, simplifying=False)

            self.pred_result[3] = self.model.get_pred_labels()
            self.model.adaptive_evaluation(step=3)
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)



        categories = [1 for i in range(11)]
        if step >= 4:
            self.model.step += 1
            self.model.data.actions = []
            c = json.loads(open(os.path.join(self.model.selected_dir, "local_2_idxs.txt"), "r").read().strip("\n"))
            self.model.local_search_k(c, [1, 2, 3, 4], categories, simplifying=False, evaluate=True, record=False)

        # if step >= 4:
            self.model.data.actions = []
            e = json.loads(open(os.path.join(self.model.selected_dir, "local_1_idxs.txt"), "r").read().strip("\n"))
            self.model.local_search_k(e, [1, 2, 3, 4], categories, simplifying=False, evaluate=True, record=False)

            self.model.data.actions = []
            e = json.loads(open(os.path.join(self.model.selected_dir, "local_3_idxs.txt"), "r").read().strip("\n"))
            self.model.local_search_k(e, [1, 2, 3, 4], categories, simplifying=False, evaluate=True, record=True)


            edge_list = json.loads(open(os.path.join(self.model.selected_dir, "removed_2.txt"), "r").read().strip("\n"))

            self.model.data.remove_edge(edge_list)
            self.model.data.add_edge([[3679, 7302]])
            self.model._training(rebuild=False, evaluate=True, simplifying=False)

            self.pred_result[4] = self.model.get_pred_labels()
            self.model.adaptive_evaluation(step=4)
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)

        # if step >= 6:
        #     self.model.step += 1
        #     edge_list = [[1609, 2555]]
        #     self.model.data.actions = []
        #     self.model.data.remove_edge(edge_list)
        #     self.model._training(rebuild=False, evaluate=True, simplifying=False)
        #     save = (self.model, self.model.data)
        #     pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)

        if step >= 5:
            self.model.data.actions = []
            self.model.step += 1
            # all_labeled_idxs = self.model.data.labeled_idx
            # labeled_y = self.model.data.y[all_labeled_idxs]
            # cat_idxs = all_labeled_idxs[labeled_y == 3]
            # pickle_save_data(os.path.join(self.model.selected_dir, "step-3-add-data.pkl"), cat_idxs)
            cat_idxs = pickle_load_data(os.path.join(self.model.selected_dir, "step-5-add-data.pkl"))
            self.model.add_data(cat_idxs, 3)
            self.model._training(rebuild=False, evaluate=evaluate, simplifying=False)
            self.model._influence_matrix(rebuild=True, prefix="add_")
            self.model.adaptive_evaluation(step=5)
            self.pred_result[5] = self.model.get_pred_labels()
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)
            # self.model.adaptive_evaluation_unasync()


        if step >= 6:
            self.model.data.actions = []
            self.model.step += 1

            self.model.data.label_instance([6673, 7954, 10403, 6396], [8, 0, 5, 5])
            self.model.data.remove_edge([[10523, 4794]])
            self.model._training(rebuild=False, evaluate=evaluate, simplifying=False)
            save = (self.model, self.model.data)
            pickle_save_data(os.path.join(self.model.selected_dir, "case-step" + str(self.model.step) + ".pkl"), save)

            # self.model.data.actions = []
            # e = json.loads(open(os.path.join(self.model.selected_dir, "local_5_idxs.txt"), "r").read().strip("\n"))
            # self.model.local_search_k(e, [1, 2, 3, 4], categories, simplifying=False, evaluate=True, record=True)


        self.model.adaptive_evaluation()
        return self.model

        # if step >= 4:
        #     self.model._training(rebuild=False, evaluate=False, simplifying=False)

        # if not evaluate:
        #     self.model.adaptive_evaluation_unasync()