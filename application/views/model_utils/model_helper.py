import numpy as np
import os
from scipy import sparse
from scipy.sparse import csgraph
from scipy.sparse import linalg as splinalg
from scipy.stats import entropy
from scipy.stats import linregress
from time import time
from tqdm import tqdm
import warnings

from sklearn.utils.extmath import safe_sparse_dot
from sklearn.neighbors.unsupervised import NearestNeighbors
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics.pairwise import euclidean_distances, paired_distances

from ..utils.log_utils import logger

def build_laplacian_graph(affinity_matrix):
    instance_num = affinity_matrix.shape[0]
    laplacian = csgraph.laplacian(affinity_matrix, normed=True)
    laplacian = -laplacian
    if sparse.isspmatrix(laplacian):
        diag_mask = (laplacian.row == laplacian.col)
        laplacian.data[diag_mask] = 0.0
    else:
        laplacian.flat[::instance_num + 1] = 0.0  # set diag to 0.0
    return laplacian

def propagation(graph_matrix, affinity_matrix, train_y,
                process_record=False, alpha=0.2, max_iter=30,
                tol=1e-3, normalized=True):
        y = np.array(train_y)
        # label construction
        # construct a categorical distribution for classification only
        classes = np.unique(y)
        classes = (classes[classes != -1])
        process_data = None


        D = affinity_matrix.sum(axis=0).getA1() - affinity_matrix.diagonal()
        D = np.sqrt(D)
        D[D==0] = 1
        affinity_matrix.setdiag(0)

        n_samples, n_classes = len(y), len(classes)

        if (alpha is None or alpha <= 0.0 or alpha >= 1.0):
            raise ValueError('alpha=%s is invalid: it must be inside '
                             'the open interval (0, 1)' % alpha)
        y = np.asarray(y)
        unlabeled = y == -1
        labeled = (y > -1)

        # initialize distributions
        label_distributions_ = np.zeros((n_samples, n_classes))
        for label in classes:
            label_distributions_[y == label, classes == label] = 1

        y_static_labeled = np.copy(label_distributions_)
        y_static = y_static_labeled * (1 - alpha)

        l_previous = np.zeros((n_samples, n_classes))

        unlabeled = unlabeled[:, np.newaxis]
        if sparse.isspmatrix(graph_matrix):
            graph_matrix = graph_matrix.tocsr()

        if process_record:
            process_data = [label_distributions_]

        n_iter_ = 0
        all_loss = []
        label_distributions_a = safe_sparse_dot(
            graph_matrix, label_distributions_)
        loss = (label_distributions_ ** 2).sum() - \
               np.dot(label_distributions_.reshape(-1),
                      label_distributions_a.reshape(-1))
        loss = loss + paired_distances(label_distributions_[labeled],
                                       y_static_labeled[labeled]).sum()
        all_loss.append(loss)

        for _ in range(max_iter):
            if np.abs(label_distributions_ - l_previous).sum() < tol:
                break

            l_previous = label_distributions_
            label_distributions_a = safe_sparse_dot(
                graph_matrix, label_distributions_)

            label_distributions_ = np.multiply(
                alpha, label_distributions_a) + y_static
            n_iter_ += 1
            if process_record:
                label = label_distributions_.copy()
                normalizer = np.sum(label, axis=1)[:, np.newaxis]
                normalizer = normalizer + 1e-20
                label /= normalizer
                process_data.append(label)

            # loss = entropy(label_distributions_.T).sum()
            t = ((label_distributions_ / D[:, np.newaxis]) ** 2).sum(axis=1)
            loss = safe_sparse_dot(affinity_matrix.sum(axis=1).T, t) * 0.5 + \
                   safe_sparse_dot(affinity_matrix.sum(axis=0), t) * 0.5 - \
                   np.dot(label_distributions_.reshape(-1),
                          label_distributions_a.reshape(-1))
            # loss[0, 0]: read the only-one value in a numpy.matrix variable
            loss = loss[0,0] + alpha/(1-alpha) * paired_distances(label_distributions_[labeled],
                                           y_static_labeled[labeled]).sum()
            all_loss.append(loss)

        else:
            warnings.warn(
                'max_iter=%d was reached without convergence.' % max_iter,
                category=ConvergenceWarning
            )
            n_iter_ += 1

        if normalized:
            normalizer = np.sum(label_distributions_, axis=1)[:, np.newaxis]
            normalizer = normalizer + 1e-20
            label_distributions_ /= normalizer

        all_loss = np.array(all_loss)

        if process_data is not None:
            process_data = np.array(process_data)

        return label_distributions_, all_loss, process_data


def exact_influence(F, affinity_matrix, laplacian_matrix, alpha, train_y):
    t0 = time()
    influence_matrix = affinity_matrix.copy() * 0
    instance_num = affinity_matrix.shape[0]
    for i in tqdm(range(instance_num)):
        start = affinity_matrix.indptr[i]
        end = affinity_matrix.indptr[i+1]
        j_in_this_row = affinity_matrix.indices[start:end]
        for idx, j in enumerate(j_in_this_row):
            if i == j:
                continue
            left_one_aff = affinity_matrix.copy()
            left_one_aff.data[start:end][idx] = 0
            left_one_lap = build_laplacian_graph(left_one_aff)
            left_one_F, left_one_L, _ = propagation(left_one_lap,
                                                    left_one_aff,
                                                    train_y,
                                                    alpha=alpha,
                                                    normalized=False)
            left_one_dis = ((left_one_F[i] - F[i]) ** 2).sum() / (F[i, :] ** 2).sum()
            influence_matrix[i, j] = left_one_dis
    time_cost = time() - t0
    logger.info("time cost is {}".format(time_cost))
    return influence_matrix


def approximated_influence(F, affinity_matrix, laplacian_matrix, alpha, train_y):
    t0 = time()
    logger.info("begin calculating approximated influence")
    inv_K = splinalg.inv(sparse.identity(affinity_matrix.shape[0])
                         - alpha * laplacian_matrix)
    logger.info("got inverse matrix")
    tmp = affinity_matrix.copy()
    D = tmp.sum(axis=0).getA1() - tmp.diagonal()
    D = np.sqrt(D)
    D[D == 0] = 1
    influence_matrix = affinity_matrix.copy() * 0
    instance_num = affinity_matrix.shape[0]
    for i in tqdm(range(instance_num)):
        start = affinity_matrix.indptr[i]
        end = affinity_matrix.indptr[i+1]
        j_in_this_row = affinity_matrix.indices[start:end]
        for idx, j in enumerate(j_in_this_row):
            if i == j:
                continue
            appro_dis = alpha * alpha * (1 - alpha) * (1 - alpha)
            appro_dis = appro_dis / D[i] / D[i] / D[j] / D[j] * inv_K[i, i]
            appro_dis = appro_dis * (F[j, :] ** 2).sum() / (F[i, :] ** 2).sum()
            influence_matrix[i, j] = appro_dis
    time_cost = time() - t0
    logger.info("time cost is {}".format(time_cost))
    return influence_matrix