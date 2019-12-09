import scipy.linalg._matfuncs_sqrtm as sqrtm
from scipy.optimize import root
import scipy.optimize._minimize as minimize
import scipy
import numpy as np
import pickle
import numpy.linalg as la
import random
import copy
import json
import math
import sys
import time
import os

def stress_majorization_solve(L, W, D, C, X):
    def stress(X, W, D):
        n = X.shape[0]
        stress = 0
        for uidx in range(n):
            for vidx in range(n):
                if uidx >= vidx:
                    stress += W[uidx][vidx]*math.pow(np.linalg.norm(X[uidx]-X[vidx])-D[uidx][vidx], 2)
        return stress
    def getB(W, D, X):
        n = X.shape[0]
        B = np.zeros((n, 2))
        for uidx in range(n):
            for vidx in range(n):
                if uidx >= vidx:
                    continue
                u = X[uidx]
                v = X[vidx]
                arg = 2*W[uidx][vidx]*D[uidx][vidx]/np.linalg.norm(u-v, 2)
                B[uidx] += arg*(u-v)
                B[vidx] += arg*(v-u)
        return B

    def objf(x, L, C, B):
        n = L.shape[0]
        return (np.dot(L, x.reshape((n, 2)))-C-B).reshape((2*n))

        # save
    savetpl = (L, W, D, C, X)
    with open('tmp.bak', 'wb+') as f:
        pickle.dump(savetpl, f)
    # to numpy
    L = np.array(L)
    W = np.array(W)
    D = np.array(D)
    n = W.shape[0]
    C = np.array(C)
    X = np.array(X)
    maxiter = 20
    alltime = {
        'getb':0,
        'root':0,
        'stress':0
    }
    for i in range(maxiter):
        lasttime = time.time()
        B = getB(W, D, X)

        alltime['getb'] += time.time()-lasttime
        lasttime = time.time()
        res = root(objf, x0=X.reshape((n*2)), args = (L, C, B), method = "lm")
        alltime['root'] += time.time() - lasttime
        X = res['x'].reshape((n, 2))
        lasttime = time.time()
        print(i, X[1])
        alltime['stress'] += time.time() - lasttime
    print(alltime)
    with open('save.bak', 'wb+') as savefile:
        pickle.dump(X, savefile)
    return X.tolist()

def class_to_dict(node, nodes):
    node_dict = {
        "anchor_idx": node.anchor_idx,
        "connection": node.connection
    }
    return node_dict

class AnchorGraph:
    def __init__(self):
        self.root = []
        self.now = []
        self.action_stack = []
        self.now_level = 0
        self.process_data = None
        self.now_graph = None

    def getNowGraph(self, update = False):
        if update is False:
            return self.now_graph
        iter_cnt = self.process_data.shape[0]
        nodes = {}
        links = []
        process = [{} for i in range(iter_cnt)]
        for node in self.now:
            now_dict = {
                "id": node.anchor_idx,
                "x":-1,
                "y":-1,
                "degree":0,
                "weight":node.getChildrenNum()
            }
            for i in range(iter_cnt):
                label_score = self.process_data[i][node.anchor_idx]
                max_score = label_score.max()
                if max_score < 1e-4:
                    process[i][node.anchor_idx] = [-1, max_score]
                else:
                    process[i][node.anchor_idx] = [int(label_score.argmax()), max_score]
            now_dict["id"] = node.anchor_idx
            for neighbor_anchor_idx, val in node.connection.items():
                neighbor_anchor = val["anchor_idx"]
                weight = val["weight"]
                for tnode in self.now:
                    if tnode.anchor_idx == neighbor_anchor:
                        now_dict["degree"] += 1
                        if node.anchor_idx < neighbor_anchor:
                            links.append([node.anchor_idx, tnode.anchor_idx, weight])
                        break
            nodes[node.anchor_idx] = now_dict
        self.now_graph = {
            "node":nodes,
            "link":links,
            "process":process
        }
        return self.now_graph

    def zoom_in(self, anchor_idxes):
        new_now = []
        for anchor_idx in anchor_idxes:
            find = False
            for now_node in self.now:
                if now_node.anchor_idx == anchor_idx:
                    if now_node.is_leaf:
                        print("Can't zoom in!!!!!!")
                        print("Now level:", self.now_level)
                        return self.getNowGraph(update=False), 0
                    new_now += now_node.children
                    find =True
            assert find
        self.action_stack.append((self.now, self.now_graph))
        self.now = new_now
        self.now_level += 1
        print("Now level:", self.now_level)
        return self.getNowGraph(update=True), 1

    def zoom_out(self):
        if self.now_level == 0:
            print("Can't zoom out !!!!!!!!!!!")
            print("Now level:", self.now_level)

            return self.getNowGraph(update=False), 0
        self.now, self.now_graph = self.action_stack.pop()
        self.now_level -= 1
        print("Now level:", self.now_level)

        return self.getNowGraph(update=False), 1




anchorGraph = AnchorGraph()

if __name__ == '__main__':
    with open('tmp.bak', 'rb') as f:
        L, W, D, C, X = pickle.load(f)
        res = stress_majorization_solve(L, W, D, C, X)
