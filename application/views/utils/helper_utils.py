import pickle
import numpy as np
import os
import json
from sklearn.metrics import confusion_matrix, roc_auc_score, \
    precision_recall_curve, auc, roc_curve
from threading import Thread
from time import sleep


def async(f):
    def wrapper(*args, **kwargs):
        thr = Thread(target=f, args=args, kwargs=kwargs)
        thr.start()

    return wrapper


# Pickle loading and saving
def pickle_save_data(filename, data):
    try:
        pickle.dump(data, open(filename, "wb"))
    except Exception as e:
        print(e, end=" ")
        print("So we use the highest protocol.")
        pickle.dump(data, open(filename, "wb"), protocol=4)
    return True


def pickle_load_data(filename):
    try:
        mat = pickle.load(open(filename, "rb"))
    except Exception as e:
        mat = pickle.load(open(filename, "rb"))
    return mat


# json loading and saving
def json_save_data(filename, data):
    open(filename, "w").write(json.dumps(data))
    return True


def json_load_data(filename, encoding=None):
    return json.load(open(filename, "r", encoding=encoding))


# directory
def check_dir(dirname):
    if not os.path.exists(dirname):
        os.makedirs(dirname)
    return True


def check_exist(filename):
    return os.path.exists(filename)


# normalization
def unit_norm_for_each_col(X):
    X -= X.min(axis=0)
    X /= X.max(axis=0)
    return X


def flow_statistic(flow_in, flow_out, class_list):
    assert len(flow_in) == len(flow_out)
    class_num = len(class_list)
    m = np.ones((class_num, class_num))
    _flow_in = np.array(flow_in)
    _flow_out = np.array(flow_out)
    for i in range(class_num):
        for j in range(class_num):
            m[i, j] = sum(_flow_out[_flow_in == class_list[i]] == class_list[j])
    return m


# metrics
def accuracy(y_true, y_pred, weights=None):
    score = (y_true == y_pred)
    return np.average(score, weights=weights)


def TPR95(x, y):
    return 0
    # x = x / x.max()
    # gap = (x.max() - x.min()) / 10000000
    # total = 0.0
    # flag = 1
    # for delta in np.arange(x.min(), x.max(), gap):
    #     # tpr = np.sum(np.sum(x > delta)) / len(x
    #     y_pred = (x > delta).astype(int)
    #     tn, fp, fn, tp = confusion_matrix(y,y_pred).ravel()
    #     tpr = tp / (tp+fn)
    #     if tpr < 0.9505:
    #         return fp / (fp + tn)


def DetectionError(x, y):
    return 0
    # x = x / x.max()
    # gap = (x.max() - x.min()) / 10000000
    # total = 0.0
    # for delta in np.arange(x.min(), x.max(), gap):
    #     # tpr = np.sum(np.sum(x > delta)) / len(x
    #     y_pred = (x > delta).astype(int)
    #     tn, fp, fn, tp = confusion_matrix(y,y_pred).ravel()
    #     tpr = tp / (tp+fn)
    #     if tpr < 0.9505:
    #         return (sum(y_pred!=y) / len(y))


def AUROC(x, y):
    x = x / x.max()
    return roc_auc_score(y, x)


def AUPR(x, y):
    x = x / x.max()
    precision, recall, thresholds = precision_recall_curve(y, x)
    area = auc(recall, precision)
    return area


def TOP_K(x, y, k=200):
    x = x / x.max()
    idx = x.argsort()[::-1][:k]
    return sum(y[idx] == 1) / k


def OoD_metrics(x, y):
    tpr95 = TPR95(x, y)
    detection_error = DetectionError(x, y)
    auroc = AUROC(x, y)
    aupr = AUPR(x, y)
    top_10 = TOP_K(x, y, k=10)
    top_50 = TOP_K(x, y, k=50)
    top_100 = TOP_K(x, y, k=100)
    top_200 = TOP_K(x, y, k=200)
    print("FPR at 95%TPR\tDetection Error\tAUROC\tAUPR\ttop_10_prec\ttop_50_prec\ttop_100_prec\ttop_200_prec")
    print("{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}"
          .format(tpr95, detection_error, auroc, aupr, top_10, top_50, top_100, top_200))
