import os
from flask import abort, session
from flask import render_template, jsonify
from flask import Blueprint, request
from .utils.config_utils import config
import json
import time

from .exchange_port import *

graph = Blueprint("graph", __name__)


@graph.route("/graph/GetManifest", methods=["GET", "POST"])
def app_get_manifest():
    # extract info from request
    dataname = request.args["dataset"]
    dataname = dataname.split("-")
    labeled_num = None
    total_num = None
    if len(dataname) > 1:
        dataname, labeled_num, total_num = dataname
        labeled_num = int(labeled_num)
        total_num = int(total_num)
        print(dataname, labeled_num, total_num)
    set_model(dataname, labeled_num, total_num)
    return get_manifest()


@graph.route("/graph/SetK", methods=["GET", "POST"])
def app_set_k():
    return 1


@graph.route("/graph/SetInfluenceFilter", methods=["GET", "POST"])
def app_set_influence_filter():
    return 1


@graph.route("/graph/GetGraph", methods=["GET", "POST"])
def app_get_graph():
    return get_graph()


@graph.route('/graph/GetLoss', methods=['POST', 'GET'])
def app_get_loss():
    return get_loss()


@graph.route('/graph/GetEnt', methods=['POST', 'GET'])
def app_get_ent():
    return get_ent()

@graph.route('/graph/GetLabels', methods=['POST'])
def app_get_label_num():
    return get_labels()

@graph.route('/graph/SaveLayout', methods=["POST"])
def app_save_layout():
    graph = json.loads(request.form['graph'])
    with open(os.path.join(config.buffer_root, "graph.json"), "w+") as f:
        json.dump(graph, f, indent=4)
    return jsonify({"status": 1})

@graph.route('/graph/update', methods=["GET", "POST"])
def app_update():
    start = time.time()
    dataset = request.args['dataset']
    data = json.loads(request.data)
    area = data['area']
    level = data['level']
    graph = update_graph(area, level)
    end = time.time()
    print("all process time:", end-start)
    return graph

@graph.route('/graph/update_delete_and_change_label', methods=["GET", "POST"])
def app_update_delete_and_change_label():
    start = time.time()
    dataset = request.args['dataset']
    data = json.loads(request.data)
    delete_list = data['delete_list']
    change_list = data['change_list']
    graph = update_delete_and_change_label(delete_list, change_list)
    end = time.time()
    print("all process time:", end-start)
    return graph

@graph.route('/graph/fisheye', methods=["GET", "POST"])
def app_fisheye():
    data = json.loads(request.data)
    nodes = data['nodes']
    return fisheye(nodes)