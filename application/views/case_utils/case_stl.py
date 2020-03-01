import numpy as np
import os
import json

from .case_base import CaseBase
from ..utils.config_utils import config

class CaseSTL(CaseBase):
    def __init__(self):
        dataname = config.stl
        super(CaseSTL, self).__init__(dataname)

    def run(self, k=6, evaluate=False, simplifying=False):
        step = self.base_config["step"]
        
        if step >= 1:
            self.model.data.label_instance(
                json.loads(open(os.path.join(self.model.selected_dir, "dog_idxs.txt"), "r").read().strip("\n")), [5, 5])
            self.model.data.label_instance([697], [5])
        
        self._init_model(k=k, evaluate=evaluate, simplifying=simplifying)

        categories = [1 for i in range(12)]
        categories[11] = False
        if step >= 2:
            c = json.loads(open(os.path.join(self.model.selected_dir, "local_1_idxs.txt"), "r").read().strip("\n"))
            self.model.local_search_k(c, [1, 2, 3, 4], categories, simplifying=True, evaluate=False)
        
        if step >= 3:
            e = json.loads(open(os.path.join(self.model.selected_dir, "local_2_idxs.txt"), "r").read().strip("\n"))
            self.model.local_search_k(e, [1, 2, 3, 4], categories, simplifying=True, evaluate=False)
        
        if step >= 4:
            edge_list = [[31,1156], [31, 1864], [31, 4525], [31, 10133], [31, 11113]]
            self.model.data.remove_edge(edge_list)

        if step >= 5:
            all_labeled_idxs = self.model.data.labeled_idx
            labeled_y = self.model.data.y[all_labeled_idxs]
            cat_idxs = all_labeled_idxs[labeled_y == 3]
            self.model.add_data(cat_idxs, 3)

        if step >= 4:
            self.model._training(rebuild=False, evaluate=False, simplifying=False)

        if not evaluate:
            self.model.adaptive_evaluation_unasync()