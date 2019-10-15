from flask import Flask, jsonify, send_file, session, \
    request, render_template, send_from_directory
from flask_session import Session
from datetime import timedelta
from .views.admin import admin
from .views.graph import graph


def create_app():
    app = Flask(__name__)
    app.config['SESSION_TYPE'] = 'filesystem'
    Session(app)

    app.config.from_object("config.DevelopmentConfig")

    app.register_blueprint(admin)
    app.register_blueprint(graph)

    # # this manner is somewhere wrong
    # app.config.update(
    #     DEBUG=True,
    #     SERVER_NAME = "0.0.0.0:8000"
    # )

    return app