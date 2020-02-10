import numpy as np
import numpy.random as random
import os
from sklearn.cluster import KMeans
import pickle
from scipy.spatial import distance_matrix
from matplotlib import pyplot as plt
import math
import time
import math

from ..utils.config_utils import config
from ..graph_utils.IncrementalTSNE import IncrementalTSNE
from ..graph_utils.ConstraintTSNE import ConstraintTSNE
from ..graph_utils.DensityBasedSampler import DensityBasedSampler
from ..graph_utils.BlueNoiseSampler import BlueNoiseSampC as BlueNoiseSampler
from sklearn.manifold import TSNE
from ..graph_utils.RandomSampler import random_sample

class Anchors:
    def __init__(self):
        # path value
        self.dataset = None
        self.anchor_path = None
        self.cur_anchor_path = None
        # model
        self.model = None

    def get_pred_labels(self, train_x):
        pass

    def get_train_x_tsne(self):
        pass

    def init_train_x_tsne(self):
        pass

    def tsne_evaluation(self, train_x_tsne, pred_labels):
        pass

    def get_hierarchical_sampling(self):
        pass

    def construct_hierarchical_sampling(self):
        pass

    def get_data_area(self, ids = None, train_x_tsne = None):
        pass

    def get_data_selection(self, area, level, old_nodes_ids, must_have_nodes):
        pass

    def re_tsne(self, selection, fixed_ids, fixed_tsne):
        pass

    def convert_to_dict(self):
        pass
