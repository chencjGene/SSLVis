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

    console.log("Loss view", "layout width", layout_width, "layout height", layout_height);
    if (layout_width < 0) {
        console.log("error");
    }

    let svg = null;
    let node_group = null;
    let link_group = null;

    let data_manager = null;

    // data
    let nodes = null;
    let links = null;
    let colors = [UnlabeledColor].concat(CategoryColor);

    that.controlInstanceView = null;
    that.controlInfoView = null;

    that._init = function () {
        svg = container.append("svg")
            .attr("id", "loss-view-svg")
            .attr("width", layout_width)
            .attr("height", layout_height);
        node_group = svg.append("g")
            .attr("id", "node_group")
            .attr("transform", "translate(" + 0 + ", " + 0 + ")");
        link_group = svg.append("g")
            .attr("id", "link_group")
            .attr("transform", "translate(" + 0 + ", " + 0 + ")");
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

        // scale
        let scale_func = function(v){
            return Math.pow(v, 0.6);
        };

        for (let j = 0; j < class_num; j++){
            label_sums[0][j] = scale_func(label_sums[0][j]);
        }

        for (let i = 0; i < (iters - 1); i++){
            let present_vec = label_sums[i];
            let next_vec = new Array(class_num).fill(0);
            for (let j = 0; j < class_num; j++){
                let next_sum = oneD_sum(flows[i][j]);
                next_sum += 0.00001;
                for (let k = 0; k < class_num; k++){
                    flows[i][j][k] /= next_sum;
                    flows[i][j][k] *= present_vec[j];
                }
            }
            for (let k = 0; k < class_num; k++){
                for (let j = 0; j < class_num; j++){
                    next_vec[k] += flows[i][j][k];
                }
            }
            console.log(next_vec);
            label_sums[i+1] = next_vec;
        }

        // test
        for (let i = 0; i < (iters - 1); i++){
            console.log(twoD_sum(flows[i]));
        }

        // crete nodes
        let _nodes = [];
        for (let i = 0; i < iters; i++){
            for (let j = 0; j < class_num; j++){
                if (label_sums[i][j] > 0){
                    _nodes.push({
                        "name": i + "_" + j,
                        "color": colors[j],
                        "class": j
                    })
                }
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
                        "source":i + "_" + j,
                        "target":(i + 1) + "_" + k,
                        "names": [i + "_" + j, (i+1) + "_" + k],
                        "value": flow[j][k],
                        "source_class": j,
                        "target_class": k
                    })
                    }
                }
            }
        }

        // create sankey diagram
        let sankey = d3.sankey()
            .nodeId(d => d.name)
            .nodeWidth(20)
            .nodePadding(1)
            .extent([[5,5], [layout_width, layout_height - 5]])
            .nodeSort((a, b) => (a.class - b.class));
        let res = sankey({
            nodes: _nodes.map(d => Object.assign({}, d)),
            links: _links.map(d => Object.assign({}, d))
        });
        nodes = res.nodes;
        links = res.links.filter(d => d.source_class!=d.target_class);
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
        // create nodes
        node_group
            .selectAll(".dist-node")
            .data(nodes)
            .enter()
            .append("rect")
            .attr("class", "dist-node")
            .attr("id", d => d.name)
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", d => d.x1 - d.x0)
            .style("fill", d => d.color);

        // create links
        let links_g = link_group.selectAll(".dist-link")
            .data(links)
            .enter()
            .append("g")
            .attr("class", "dist-link");
        const gradient = links_g.append("linearGradient")
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("id", function(d){
                 d.uid = d.source.name + "_" + d.target.name;
                 return d.uid;
            })
            .attr("x1", d => d.source.x1)
            .attr("x2", d => d.target.x0);
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d => d.source.color);
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d => d.target.color);
        links_g.append("path")
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke", d => "url(#" + d.uid +")")
            .attr("stroke-width", d => Math.max(...[1.5, d.width]))
            .attr("stroke-opacity", 0.4)
            .style("fill-opacity", 0);
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
