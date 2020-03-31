import numpy as np
import os
from scipy import sparse
from scipy.sparse import csgraph, csr_matrix
from scipy.sparse import linalg as splinalg
from scipy.stats import entropy
from scipy.stats import linregress
from time import time, sleep
from tqdm import tqdm
import warnings

from sklearn.utils.extmath import safe_sparse_dot
from sklearn.neighbors.unsupervised import NearestNeighbors
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics.pairwise import euclidean_distances, paired_distances

from ..utils.log_utils import logger
import concurrent.futures
from ..utils.helper_utils import *


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


def propagation(graph_matrix, affinity_matrix, train_y, alpha=0.2, max_iter=15,
                tol=1e-12, process_record=False, normalized=False, k=6):
    t0 = time()
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
    label_distributions_ = np.zeros((n_samples, n_classes))
    for label in classes:
        label_distributions_[y == label, classes == label] = 1

    y_static_labeled = np.copy(label_distributions_)
    y_static = y_static_labeled * (1 - alpha)

    l_previous = np.zeros((n_samples, n_classes))

    unlabeled = unlabeled[:, np.newaxis]
    if sparse.isspmatrix(graph_matrix):
        graph_matrix = graph_matrix.tocsr()

    all_loss = []
    all_entropy = []

    if process_record:
        label = label_distributions_.copy()
        if normalized:
            normalizer = np.sum(label, axis=1)[:, np.newaxis]
            normalizer = normalizer + 1e-20
            label /= normalizer
        process_data = [label]
        ent = entropy(label.T + 1e-20)
        all_entropy.append(ent.sum())

    n_iter_ = 1
    # print("graph_matrix.shape:", graph_matrix.shape)
    # print("label_distributions_.shape:", label_distributions_.shape)
    for _ in range(max_iter):
        if not (n_iter_ > 6 and k <= 3): # for case
            if np.abs(label_distributions_ - l_previous).sum() < tol:
                break
        # else:
        #     if n_iter_ > 10:
        #         break

        l_previous = label_distributions_.copy()
        label_distributions_a = safe_sparse_dot(
            graph_matrix, label_distributions_)

        if not (n_iter_ > 6 and k <= 3): # for case
            label_distributions_ = np.multiply(
                alpha, label_distributions_a) + y_static
        n_iter_ += 1
        if process_record:
            label = label_distributions_.copy()
            if normalized:
                normalizer = np.sum(label, axis=1)[:, np.newaxis]
                normalizer = normalizer + 1e-20
                label /= normalizer
            process_data.append(label)
            ent = entropy(label.T + 1e-20)
            all_entropy.append(ent.sum())

        # record loss
        t = ((l_previous / D[:, np.newaxis]) ** 2).sum(axis=1)
        loss = safe_sparse_dot(affinity_matrix.sum(axis=1).T, t) * 0.5 + \
               safe_sparse_dot(affinity_matrix.sum(axis=0), t) * 0.5 - \
               np.dot(l_previous.reshape(-1),
                      label_distributions_a.reshape(-1))
        # loss[0, 0]: read the only-one value in a numpy.matrix variable
        loss = loss[0, 0] + alpha / (1 - alpha) * paired_distances(label_distributions_[labeled],
                                                                   y_static_labeled[labeled]).sum()
        all_loss.append(loss)

    else:
        warnings.warn(
            'max_iter=%d was reached without convergence.' % max_iter,
            category=ConvergenceWarning
        )
        # n_iter_ += 1

    unnorm_dist = label_distributions_.copy()

    if normalized:
        normalizer = np.sum(label_distributions_, axis=1)[:, np.newaxis]
        normalizer = normalizer + 1e-20
        label_distributions_ /= normalizer

    all_loss.append(all_loss[-1])
    all_loss = np.array(all_loss)
    all_entropy = np.array(all_entropy)
    assert np.isnan(all_entropy).sum() == 0
    assert np.isinf(all_entropy).sum() == 0

    if process_data is not None:
        process_data = np.array(process_data)

        labels = process_data.argmax(axis=2)
        max_process_data = process_data.max(axis=2)
        labels[max_process_data == 0] = -1

        # remove unnecessary iterations
        assert n_iter_ == len(process_data), "{}, {}".format(n_iter_, len(process_data))
        new_iter_num = n_iter_ - 1
        if not (n_iter_ > 6 and k <= 3): # for case
            for new_iter_num in range(n_iter_ - 1, 0, -1):
                if sum(labels[new_iter_num - 1] != labels[n_iter_- 1]) != 0:
                    break

        process_data[new_iter_num] = process_data[n_iter_ - 1]
        process_data = process_data[:new_iter_num + 1]
        all_loss[new_iter_num] = all_loss[n_iter_ - 1]
        all_loss = all_loss[:new_iter_num + 1]
        all_entropy[new_iter_num] = all_entropy[n_iter_ - 1]
        all_entropy = all_entropy[:new_iter_num + 1]

    print("propagation time:", time() - t0)

    return label_distributions_, all_loss, all_entropy, process_data, unnorm_dist


def exact_influence(F, affinity_matrix, laplacian_matrix, alpha, train_y):
    t0 = time()
    influence_matrix = affinity_matrix.copy() * 0
    instance_num = affinity_matrix.shape[0]
    for i in tqdm(range(instance_num)):
        start = affinity_matrix.indptr[i]
        end = affinity_matrix.indptr[i + 1]
        j_in_this_row = affinity_matrix.indices[start:end]
        for idx, j in enumerate(j_in_this_row):
            if i == j:
                continue
            left_one_aff = affinity_matrix.copy()
            left_one_aff.data[start:end][idx] = 0
            left_one_lap = build_laplacian_graph(left_one_aff)
            left_one_F, left_one_L, _, _, _ = propagation(left_one_lap,
                                                          left_one_aff,
                                                          train_y,
                                                          alpha=alpha,
                                                          normalized=False)
            left_one_dis = ((left_one_F[i] - F[i]) ** 2).sum() / (F[i, :] ** 2).sum()
            influence_matrix[i, j] = left_one_dis
    time_cost = time() - t0
    logger.info("time cost is {}".format(time_cost))
    return influence_matrix


def approximated_influence(F, affinity_matrix, laplacian_matrix, alpha, train_y, n_iters):
    t0 = time()
    logger.info("begin calculating approximated influence. n_iters: {}".format(n_iters))
    logger.info("begin calculating inverse matrix")
    # inv_K = splinalg.inv(sparse.identity(affinity_matrix.shape[0])
    #                      - alpha * laplacian_matrix)
    alpha_lap = alpha * laplacian_matrix
    inv_K = sparse.identity(affinity_matrix.shape[0])
    for n_iter in range(n_iters):
        inv_K = safe_sparse_dot(inv_K, alpha_lap) + sparse.identity(affinity_matrix.shape[0])
    logger.info("got inverse matrix")
    tmp = affinity_matrix.copy()
    D = tmp.sum(axis=0).getA1() - tmp.diagonal()
    D = np.sqrt(D)
    D[D == 0] = 1
    influence_matrix = affinity_matrix.copy() * 0
    instance_num = affinity_matrix.shape[0]
    for i in tqdm(range(instance_num)):
        start = affinity_matrix.indptr[i]
        end = affinity_matrix.indptr[i + 1]
        j_in_this_row = affinity_matrix.indices[start:end]
        for idx, j in enumerate(j_in_this_row):
            if i == j:
                continue
            appro_dis = alpha * alpha * (1 - alpha) * (1 - alpha)
            appro_dis = appro_dis / D[i] / D[i] / D[j] / D[j] * (inv_K[i, i] ** 2)
            appro_dis = appro_dis * (F[j, :] ** 2).sum() / (F[i, :] ** 2).sum()
            influence_matrix[i, j] = appro_dis
    time_cost = time() - t0
    logger.info("time cost is {}".format(time_cost))
    return influence_matrix

def _calculate_edge_incluence(local_i_idx, j, local_F, local_graph, local_alpha_lap, alpha, local_D, n_iters, local_influence_matrix, neighbors):
            t0 = time()
            class_cnt = local_F.shape[1]
            # for i in selected_ids:
            start = local_graph.indptr[local_i_idx]
            end = local_graph.indptr[local_i_idx + 1]

            local_N = local_graph.shape[0]
            param = alpha / np.sqrt(local_D[local_i_idx] * local_D[j])
                # init F0
            F0_data = param * (local_F[j].copy())
            F0_indices = np.arange(0, class_cnt)
            F0_indptr = np.array([0] * (local_i_idx + 1) + [class_cnt] * (local_N - local_i_idx))
            F0 = csr_matrix((F0_data, F0_indices, F0_indptr), shape=(local_N, class_cnt), dtype=float)
            deltaF = F0.copy()
            matrix_time = time()-t0
            t0 = time()
            for n_iter in range(n_iters):
                    deltaF = safe_sparse_dot(local_alpha_lap, deltaF) + F0
            appro_dis = (deltaF[local_i_idx, :].toarray() ** 2).sum() / (local_F[local_i_idx, :] ** 2).sum()
            appro_dis = 1e-15 if appro_dis < 1e-15 else appro_dis
            sparse_dot_time = time()-t0
            # influence_matrix[i_idx, neighbors[j]] = appro_dis
            return appro_dis, matrix_time, sparse_dot_time



def calculate_influence_matrix_local(args):
    t0 = time()
    all_matrix_time = 0
    all_sparse_time = 0
    edge_cnt = 0
    graphs, selected_ids, start_idx, end_idx, propagation_path_from, propagation_path_to, F, affinity_matrix, alpha_lap, alpha, D, n_iters, local_influence_matrix, k_neighbors, flags = args
    # print(start_idx, end_idx, selected_ids[start_idx:end_idx])
    indptr = local_influence_matrix.indptr
    data = local_influence_matrix.data
    indices = local_influence_matrix.indices
    for to_id in selected_ids[start_idx:end_idx]:
        neighbors = list(k_neighbors[to_id])
        local_graph = affinity_matrix[neighbors, :][:, neighbors]
        local_i_idx = neighbors.index(to_id)
        start = local_graph.indptr[local_i_idx]
        end = local_graph.indptr[local_i_idx + 1]
        j_in_this_row = local_graph.indices[start:end]

        local_D = D[neighbors]
        local_F = F[neighbors, :]
        local_alpha_lap = alpha_lap[neighbors, :][:, neighbors]
        for j_idx, from_idx in enumerate(j_in_this_row):
            from_id = neighbors[from_idx]
            if flags[to_id, from_id] == 0:
                appro_dis, matrix_time, sparse_dot_time = _calculate_edge_incluence(local_i_idx, from_idx, local_F, local_graph, local_alpha_lap, alpha, local_D,
                                                                                    n_iters, local_influence_matrix, neighbors)
                idx = indices[indptr[to_id]: indptr[to_id+1]].tolist().index(from_id)
                data[indptr[to_id]+idx] = appro_dis
                # flags[to_id, from_id] = 1
                all_matrix_time += matrix_time
                all_sparse_time += sparse_dot_time
            # square(alpha_lap, deltaF, F0)
            edge_cnt+=1
    # for from_id in selected_ids[start_idx:end_idx]:
    #     for to_id in propagation_path_to[from_id]:
    #         if flags[to_id, from_id] == 0:
    #             neighbors = list(k_neighbors[to_id])
    #             local_graph = affinity_matrix[neighbors, :][:, neighbors]
    #             local_i_idx = neighbors.index(to_id)
    #             start = local_graph.indptr[local_i_idx]
    #             end = local_graph.indptr[local_i_idx + 1]
    #             j_in_this_row = local_graph.indices[start:end]
    #
    #             local_D = D[neighbors]
    #             local_F = F[neighbors, :]
    #             local_alpha_lap = alpha_lap[neighbors, :][:, neighbors]
    #             from_idx = neighbors.index(from_id)
    #             appro_dis, matrix_time, sparse_dot_time = _calculate_edge_incluence(local_i_idx, from_idx, local_F,
    #                                                                                 local_graph, local_alpha_lap, alpha,
    #                                                                                 local_D,
    #                                                                                 n_iters, local_influence_matrix,
    #                                                                                 neighbors)
    #             local_influence_matrix[to_id, from_id] = appro_dis
    #             flags[to_id, from_id] = 1
    #             all_matrix_time += matrix_time
    #             all_sparse_time += sparse_dot_time
            # square(alpha_lap, deltaF, F0)
            edge_cnt += 1
        # i_idx += 1
    calculate_time = time()-t0
    print("calculate time:{}".format(calculate_time))
    print(start_idx, end_idx, time()-t0, all_matrix_time, all_sparse_time, edge_cnt)