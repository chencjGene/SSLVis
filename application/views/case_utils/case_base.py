import numpy as np
import os
from ..utils.helper_utils import json_load_data
from ..utils.config_utils import config

class CaseBase():
    def __init__(self, dataname):
        self.dataname = dataname
        
        self.model = None
        self.base_config = None

        self._load_base_config()
        
    def connect_model(self, model):
        self.model = model

    def _init_model(self, k=6, evaluate=False, simplifying=False):
        assert self.model is not None 
        self.model.init(k=k, evaluate=evaluate, simplifying=simplifying)

    def _load_base_config(self):
        json_data = json_load_data(os.path.join(config.case_util_root, "case_config.json"))
        self.base_config = json_data[self.dataname]