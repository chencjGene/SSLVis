import numpy as np
import os
from ..utils.helper_utils import json_load_data, pickle_load_data
from ..utils.config_utils import config

class CaseBase():
    def __init__(self, dataname):
        self.dataname = dataname
        
        self.model = None
        self.base_config = None
        self.step = 0

        self.pred_result = {}

        self._load_base_config()
        
    def connect_model(self, model):
        self.model = model

    def _init_model(self, k=6, evaluate=False, simplifying=False):
        assert self.model is not None 
        self.model.init(k=k, evaluate=evaluate, simplifying=simplifying)

    def _load_base_config(self):
        json_data = json_load_data(os.path.join(config.case_util_root, "case_config.json"))
        self.base_config = json_data[self.dataname]

    def load_model(self, name):
        save = pickle_load_data(name)
        model = save[0]
        model.data = save[1]
        selected_setting = os.path.split(model.selected_dir)[1]
        model.data.selected_dir = os.path.join(config.data_root, model.data.dataname, selected_setting)
        model.selected_dir = model.data.selected_dir
        return model