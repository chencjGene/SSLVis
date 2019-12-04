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
        self.now_level = 0

    def getNowGraph(self):
        nodes = {}
        links = []
        for node in self.now:
            now_dict = {
                "id": node.anchor_idx,
                "x":-1,
                "y":-1,
                "degree":0
            }
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
        return {
            "node":nodes,
            "link":links
        }



anchorGraph = AnchorGraph()

if __name__ == '__main__':
    with open('tmp.bak', 'rb') as f:
        L, W, D, C, X = pickle.load(f)
        res = stress_majorization_solve(L, W, D, C, X)
