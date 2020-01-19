import os
from flask import abort, session
from flask import render_template, jsonify
from flask import Blueprint, request
from .utils.config_utils import config
import json
import time

from .exchange_port import *

dist = Blueprint("dist", __name__)


@dist.route("/dist/GetFlows", methods=["POST", "GET"])
def app_get_flows():
    return get_flows()

@dist.route("/dist/GetSelectedFlows", methods=["POST", "GET"])
def app_get_selected_flows():
    return None