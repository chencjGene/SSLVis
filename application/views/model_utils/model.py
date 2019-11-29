import numpy as np
import os

from sklearn.neighbors import kneighbors_graph
from sklearn.metrics import accuracy_score

from ..utils.config_utils import config
from ..utils.log_utils import logger
from ..utils.helper_utils import check_exist, pickle_load_data, pickle_save_data
from ..utils.embedder_utils import Embedder

from .data import Data
from .LSLabelSpreading import LSLabelSpreading

class SSLModel(object):
    def __init__(self, dataname):
        self.dataname = dataname
        self.data_root = os.path.join(config.data_root, self.dataname)

        self.model = None
        self.embed_X = None
        self.n_neighbor = 200
        # signal is used to indicate that all data should be updated
        self.signal_state = False

        self.data = Data(self.dataname)

        self._get_signal_state()
        self._init()

    def _init(self):
        self._training(self.n_neighbor)
        self._projection()

    def _get_signal_state(self):
        signal_filepath = os.path.join(self.data_root, config.signal_filename)
        if check_exist(signal_filepath):
            self.signal_state = True
            logger.info("signal file exists, set signal_state")
        # delete signal file
        if check_exist(signal_filepath):
            os.remove(signal_filepath)
        return

    def _training(self, n_neighbor):
        ssl_model_filepath = os.path.join(self.data_root, config.ssl_model_buffer_name)
        if check_exist(ssl_model_filepath) \
            and (not self.signal_state):
            logger.info("loading ssl model from buffer")
            self.model = pickle_load_data(ssl_model_filepath)
            return

        # training ssl model from scratch
        train_X = self.data.get_train_X()
        train_y = self.data.get_train_label()
        train_y = np.array(train_y)
        train_gt = self.data.get_train_ground_truth()
        train_gt = np.array(train_gt)
        logger.info("data shape: {}, labeled_num: {}"
                    .format(str(train_X.shape), sum(train_y != -1)))
        self.model = LSLabelSpreading(kernel="knn", n_neighbors=n_neighbor, n_jobs=-4)
        graph = self.model.get_graph(train_X, train_y)
        logger.info("got graph")
        self.model.fit(train_X, train_y)
        logger.info("model fitting finished")
        # pred_y = self.model.predict(train_X)
        pred_y = self.model.label_distributions_.argmax(axis=1)
        acc = accuracy_score(train_gt, pred_y)
        logger.info("model accuracy: {}".format(acc))


        # save ssl model buffer
        pickle_save_data(ssl_model_filepath, self.model)
        return

    def _projection(self):
        projection_filepath = os.path.join(self.data_root, config.projection_buffer_name)
        if check_exist(projection_filepath) \
            and (not self.signal_state):
            logger.info("loading projection result from buffer")
            self.model = pickle_load_data(projection_filepath)
            return

        # get projection from scratch
        train_X = self.data.get_train_X()
        train_y = self.data.get_train_label()
        train_y = np.array(train_y)
        train_gt = self.data.get_train_ground_truth()
        train_gt = np.array(train_gt)
        embedder = Embedder("tsne", n_components=2, random_state=123)
        self.embed_X = embedder.fit_transform(train_X, train_y)
        logger.info("get projection result")

        # save projection buffer
        pickle_save_data(projection_filepath, self.embed_X)
        return

    def get_graph_data(self):
        return 0

