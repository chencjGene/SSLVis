import os
from flask import abort, session
from flask import render_template, jsonify
from flask import Blueprint, request

from .utils.config_utils import config

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

