import numpy as np 
import os 
from scipy import sparse
from scipy.sparse import csgraph
from scipy.sparse import linalg as splinalg
from scipy.stats import entropy
from sklearn.utils.extmath import safe_sparse_dot

def local_update(selected_idxs, F, graph_matrix, affinity_matrix, train_y, alpha=0.2, max_iter=30,
                tol=0.01, process_record=False, normalized=False):
    # TODO: make it more efficient
    y = np.array(train_y)
    # label construction
    # construct a categorical distribution for classification only
    classes = np.unique(y)
    classes = (classes[classes != -1])
    process_data = None

    D = affinity_matrix.sum(axis=0).getA1() - affinity_matrix.diagonal()
    D = np.sqrt(D)
    D[D == 0] = 1
    affinity_matrix.setdiag(0)

    n_samples, n_classes = len(y), len(classes)

    if (alpha is None or alpha <= 0.0 or alpha >= 1.0):
        raise ValueError('alpha=%s is invalid: it must be inside '
                         'the open interval (0, 1)' % alpha)
    y = np.asarray(y)
    unlabeled = y == -1
    labeled = (y > -1)

    # initialize distributions
    selected_idxs = np.array(selected_idxs)
    selected_num = len(selected_idxs)
    label_distributions_ = F
    label_distributions_[selected_idxs, :] = \
        np.zeros((selected_num, n_classes))
    for label in classes:
        label_distributions_[y == label, classes == label] = 1

    # TODO
    y_static_labeled = np.copy(label_distributions_[selected_idxs, :])
    y_static = y_static_labeled * (1 - alpha)
    print("y_static:", y_static.shape)

    l_previous = F
    l_previous = np.zeros((selected_num, n_classes))

    unlabeled = unlabeled[:, np.newaxis]
    if sparse.isspmatrix(graph_matrix):
        graph_matrix = graph_matrix.tocsr()

    # init unselected instances
    # Fs = label_distributions_[selected_idxs, :]
    # Fs_previous = l_previous[selected_idxs, :]
    
    selected_graph_matrix = graph_matrix[selected_idxs, :]

    for _ in range(max_iter):
        if np.abs(label_distributions_ - l_previous).sum() < tol:
            break
        l_previous = label_distributions_.copy()
        label_distributions_a = safe_sparse_dot(
            selected_graph_matrix, label_distributions_)
        print("label_distributions_a:", label_distributions_a.shape)

        label_distributions_[selected_idxs, :] = np.multiply(
                    alpha, label_distributions_a) + y_static
        n_iter_ += 1


def local_search_k():
    None

def add_edge():
    None

def remove_edge():
    None