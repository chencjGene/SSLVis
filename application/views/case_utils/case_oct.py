import numpy as np
import os
import json

from .case_base import CaseBase
from ..utils.config_utils import config

class CaseOCT(CaseBase):
    def __init__(self):
        dataname = config.oct
        super(CaseOCT, self).__init__(dataname)

    def run(self, k=6, evaluate=False, simplifying=False, step=None):
        if step is None:
            step = self.base_config["step"]

        self._init_model(k=k, evaluate=evaluate, simplifying=simplifying)

        categories = [1 for i in range(12)]
        categories[11] = False

        if step >= 1:
            c = json.loads(open(os.path.join(self.model.selected_dir, "local_1_idxs.txt"), "r").read().strip("\n"))
            self.model.local_search_k(c, [1, 2, 3, 4], categories, simplifying=simplifying, evaluate=evaluate)

        if step >= 2:
            e = json.loads(open(os.path.join(self.model.selected_dir, "local_2_idxs.txt"), "r").read().strip("\n"))
            self.model.local_search_k(e, [1, 2, 3, 4], categories, simplifying=simplifying, evaluate=evaluate)

        if step >= 3:
            None

        if step >= 4:
            None

        if step >=3:
            self.model._training(rebuild=False, evaluatee=evaluate, simplifying=simplifying)

        if not evaluate:
            self.model.adaptive_evaluation_unasync()