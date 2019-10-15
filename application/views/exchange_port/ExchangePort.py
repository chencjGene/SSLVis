import numpy as np
import os
import abc
from flask import jsonify

from ..data_utils import Data

class ExchangePortClass(object):
    def __init__(self, dataname=None):
        self.dataname = dataname
        if self.dataname is None:
            self.data = None
        else:
            self.data = Data(self.dataname)

    def reset_dataname(self, dataname):
        self.dataname = dataname
        if self.dataname is None:
            self.data = None
        else:
            self.data = Data(self.dataname)

    def get_manifest(self):
        manifest = [1]
        return jsonify(manifest)

    def get_graph(self):
        graph = self.data.get_graph_data()
        return jsonify(graph)