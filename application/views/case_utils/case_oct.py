import numpy as np
import os

from .case_base import CaseBase


class CaseOCT( CaseBase):
    def __init__(self, dataname):
        super(CaseOCT, self).__init__(dataname)

    def run(self, k=6, evaluate=False, simplifying=False):
        step = self.base_config["step"]

        self._init_model(k=k, evaluate=evaluate, simplifying=simplifying)
        
        if not evaluate:
            self.model.adaptive_evaluation_unasync()