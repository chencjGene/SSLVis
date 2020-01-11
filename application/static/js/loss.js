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

    // data
    let nodes = null;
    let links = null;

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
        that._update_view();
    };

    that._init_view = function () {

    };

    that._update_data = function (state) {
        let label_sums = state.label_sums;
        let flows = state.flows;
        let iters = label_sums.length;
        let class_num = label_sums[0].length;
        // crete nodes
        let _nodes = [];
        for (let i = 0; i < iters; i++){
            for (let j = 0; j < class_num; j++){
                _nodes.push({
                    "name": i + "_" + j
                })
            }
        }
        // create links
        let _links = [];
        for (let i = 0; i < (iters - 1); i++){
            let flow = flows[i];
            for (let j = 0; j < class_num; j++){
                for (let k = 0; k < class_num; k++){
                    if(flow[j][k] > 0){
                        _links.push({
                        "source":i * class_num + j,
                        "target":(i + 1) * class_num + k,
                        "names": [i + "_" + j, (i+1) + "_" + k],
                        "value": flow[j][k]
                    })
                    }
                }
            }
        }

        // create sankey diagram
        let sankey = d3.sankey()
            .nodeWidth(4)
            .nodePadding(0)
            .extent([[0,5], [layout_width, layout_height - 5]]);
        let res = sankey({
            nodes: _nodes.map(d => Object.assign({}, d)),
            links: _links.map(d => Object.assign({}, d))
        });
        nodes = res.nodes;
        links = res.links;
        console.log(nodes, links);
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
