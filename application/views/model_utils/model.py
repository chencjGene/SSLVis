import numpy as np
import os

from .data import Data

from ..utils.config_utils import config

class SSLModel(object):
    def __init__(self, dataname):
        self.dataname = dataname
        self.data_root = os.path.join(config.data_root, self.dataname)

        self.data = Data(self.dataname)

    def get_graph_data(self):
        return self.data.get_graph_data()

