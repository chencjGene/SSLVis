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

    def run(self, k=6, evaluate=True, simplifying=False, step=None):
        if step is None:
            step = self.base_config["step"]
        self._init_model(k=k, evaluate=evaluate, simplifying=simplifying)
        if step >= 1:
            self.model.data.label_instance(
                json.loads(open(os.path.join(self.model.selected_dir, "dog_idxs.txt"), "r").read().strip("\n")), [5, 5])
            self.model.data.label_instance([697], [5])
        
            # self._init_model(k=k, evaluate=True, simplifying=simplifying)
            self.model._training(rebuild=False, evaluate=False, simplifying=False)
        
        # if step >= 1.4:
        #     self.model.data.label_instance([5146, 2339], [4, 6])
        #     self.model._training(rebuild=False, evaluate=False, simplifying=False)

        categories = [1 for i in range(10)]
        if step >= 2:
            c = json.loads(open(os.path.join(self.model.selected_dir, "local_1_idxs.txt"), "r").read().strip("\n"))
            self.model.local_search_k(c, [1, 2, 3, 4], categories, simplifying=False, evaluate=True)

        if step >= 3:
            e = json.loads(open(os.path.join(self.model.selected_dir, "local_2_idxs.txt"), "r").read().strip("\n"))
            self.model.local_search_k(e, [1, 2, 3, 4], categories, simplifying=True, evaluate=True)
        
        if step >= 4:
            edge_list = [[31,1156], [31, 1864], [31, 4525], [31, 10133], [31, 11113]]
            self.model.data.remove_edge(edge_list)
            self.model._training(rebuild=False, evaluate=True, simplifying=False)

        if step >= 5:
            all_labeled_idxs = self.model.data.labeled_idx
            labeled_y = self.model.data.y[all_labeled_idxs]
            cat_idxs = all_labeled_idxs[labeled_y == 3]
            pickle_save_data(os.path.join(self.model.selected_dir, "step-5-add-data.pkl"), cat_idxs)
            cat_idxs = pickle_load_data(os.path.join(self.model.selected_dir, "step-5-add-data.pkl"))
            self.model.add_data(cat_idxs, 3)
            self.model._training(rebuild=False, evaluate=True, simplifying=False)
            self.model._influence_matrix(rebuild=True)
            self.model.adaptive_evaluation_unasync()
        self.model.adaptive_evaluation()
        return

        # if step >= 4:
        #     self.model._training(rebuild=False, evaluate=False, simplifying=False)

        # if not evaluate:
        #     self.model.adaptive_evaluation_unasync()