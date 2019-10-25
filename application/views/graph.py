import os
from flask import abort, session
from flask import render_template, jsonify
from flask import Blueprint, request
from .graph_utils.layout import stress_majorization_solve
from .utils.config_utils import config
import json

from .exchange_port import *

graph = Blueprint("graph", __name__)

@graph.route("/graph/GetManifest", methods=["GET", "POST"])
def app_get_manifest():
    # extract info from request
    dataname = request.args["dataset"]
    set_dataname(dataname)
    return get_manifest()

@graph.route("/graph/GetGraph", methods=["GET", "POST"])
def app_get_graph():
    return get_graph()

@graph.route('/graph/StressMajorization', methods=["POST"])
def app_stress_majorization():
    data = json.loads(request.form['data'])
    L = data['L']
    W = data['W']
    D = data['D']
    C = data['C']
    X = data['X']
    res = stress_majorization_solve(L, W, D, C, X)
    return jsonify(res)