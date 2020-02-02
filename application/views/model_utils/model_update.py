import numpy as np 
import os 
from scipy import sparse
from scipy.sparse import csgraph
from scipy.sparse import linalg as splinalg
from scipy.stats import entropy
from sklearn.utils.extmath import safe_sparse_dot

from application.views.model_utils.model_helper import build_laplacian_graph

def local_update(selected_idxs, F, graph_matrix, affinity_matrix, train_y, alpha=0.2, max_iter=30,
                tol=0.01, process_record=False, normalized=False):
    #: F must be the unnormalized one 
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
    
    if normalized:
        normalizer = np.sum(label_distributions_, axis=1)[:, np.newaxis]
        normalizer = normalizer + 1e-20
        label_distributions_ /= normalizer
    return label_distributions_

def local_search_k(k_list, n_neighbors, selected_idxs, F, initial_affinity_matrix, 
    train_y, neighbors):
    normalizer = np.sum(F, axis=1)[:, np.newaxis] + 1e-20
    norm_F = F / normalizer
    original_ent = entropy(norm_F.T + 1e-20)
    best_affinity_matrix = None
    min_ent = original_ent
    best_k = None
    best_affinity_matrix = None
    selected_num = len(selected_idxs)
    instance_num = len(train_y)
    for local_k in k_list:
        #TODO: construct affinity_matrix based on k and selected_idxs
        # affinity_matrix = None
        indptr = [i * local_k for i in range(selected_num + 1)]
        indices = neighbors[selected_idxs][:, :local_k].reshape(-1).tolist()
        data = neighbors[selected_idxs][:, :local_k].reshape(-1)
        data = (data * 0 + 1.0).tolist()
        selected_affinity_matrix = sparse.csr_matrix((data, indices, indptr),
            shape=(selected_num, instance_num))
        affinity_matrix = initial_affinity_matrix.copy()
        affinity_matrix[selected_affinity_matrix,:] = selected_affinity_matrix        
        
        affinity_matrix = affinity_matrix + affinity_matrix.T
        affinity_matrix = sparse.csr_matrix((np.ones(len(affinity_matrix.data)).tolist(),
                                             affinity_matrix.indices, affinity_matrix.indptr),
                                            shape=(instance_num, instance_num))
        laplacian_matrix = build_laplacian_graph(affinity_matrix)
        pred = local_update(selected_idxs, F, laplacian_matrix, affinity_matrix,
            train_y, normalized=True)
        ent = entropy(pred.T + 1e-20).sum()
        if ent < min_ent:
            min_ent = ent 
            best_k = local_k
            best_affinity_matrix = affinity_matrix
         
    return best_affinity_matrix # return the affinity_matrix

def add_edge():
    None

def remove_edge():
    None