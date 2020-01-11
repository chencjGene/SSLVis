/*
* added by Changjian Chen, 20191015
* */

let ControlLayout = function (container) {
    let that = this;
    that.container = container;

    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let layout_width = width - 20;
    let layout_height = height - 20;

    let slider = null;
    console.log("Loss view", "layout width", layout_width, "layout height", layout_height);
    if (layout_width < 0) {
        console.log("error");
    }

    let data_manager = null;

    that.controlInstanceView = null;
    that.controlInfoView = null;

    that._init = function () {
        svg = container.select("#loss-view-svg");
        slider = svg.select("#loss-view-slider");
    };


    that.set_data_manager = function (_data_manager) {
        data_manager = _data_manager;
    };

    that.component_update = function (state) {
        console.log("loss component update");
        that._update_data(state);
        that._init_view();
        that._update_view();
    };

    that._init_view = function () {

    };

    that._update_data = function (state) {
        // TODO: update data
    };

    that.setIter = function (newiter) {
        if (newiter >= loss.length) {
            console.log(newiter, "is larger than ", loss.length - 1);
            return;
        }
        that._update_view();
        that.controlInstanceView.setIter(newiter);
        that.controlInfoView.setIter(newiter);
    };

    that._update_view = function () {
        that._create();
        that._update();
        that._remove();
    };

    that._create = function () {

    };

    that._update = function () {
        // TODO:
    };

    that._remove = function () {

    };

    that.init = function () {
        that._init();
    }.call();

};
