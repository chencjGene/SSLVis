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
    let slider_width = width - 80;
    let slider_x_shift = 40;
    let slider_hump_length = 20;
    let slider_y_shift = height - 38;
    let slider_height = 6;
    let node_width = 20;

    console.log("Loss view", "layout width", layout_width, "layout height", layout_height);
    if (layout_width < 0) {
        console.log("error");
    }

    let svg = null;
    let node_group = null;
    let link_group = null;
    let slider_group = null;

    let data_manager = null;

    // data
    let nodes = null;
    let links = null;
    let colors = [UnlabeledColor].concat(CategoryColor);
    let slider_delta = null;
    let iter_list = null;
    let total_iters = null;
    let current_iter = 0;

    let draging = null;
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
        slider_group = svg.append("g")
            .attr("id", "slider_group")
            .attr("transform", "translate(" + 0 + ", " + (slider_y_shift) + ")");
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
        current_iter = 0;
        let label_sums = state.label_sums;
        total_iters = label_sums.length;
        iter_list = new Array(total_iters).fill().map((_, i) => i);
        let flows = state.flows;
        let class_num = label_sums[0].length;

        // scale
        let scale_func = function (v) {
            return Math.pow(v, 0.6);
        };

        for (let j = 0; j < class_num; j++) {
            label_sums[0][j] = scale_func(label_sums[0][j]);
        }

        for (let i = 0; i < (total_iters - 1); i++) {
            let present_vec = label_sums[i];
            let next_vec = new Array(class_num).fill(0);
            for (let j = 0; j < class_num; j++) {
                let next_sum = oneD_sum(flows[i][j]);
                next_sum += 0.00001;
                for (let k = 0; k < class_num; k++) {
                    flows[i][j][k] /= next_sum;
                    flows[i][j][k] *= present_vec[j];
                }
            }
            for (let k = 0; k < class_num; k++) {
                for (let j = 0; j < class_num; j++) {
                    next_vec[k] += flows[i][j][k];
                }
            }
            console.log(next_vec);
            label_sums[i + 1] = next_vec;
        }

        // test
        for (let i = 0; i < (total_iters - 1); i++) {
            console.log(twoD_sum(flows[i]));
        }

        // crete nodes
        let _nodes = [];
        for (let i = 0; i < total_iters; i++) {
            for (let j = 0; j < class_num; j++) {
                if (label_sums[i][j] > 0) {
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
        for (let i = 0; i < (total_iters - 1); i++) {
            let flow = flows[i];
            for (let j = 0; j < class_num; j++) {
                for (let k = 0; k < class_num; k++) {
                    if (flow[j][k] > 0) {
                        _links.push({
                            "source": i + "_" + j,
                            "target": (i + 1) + "_" + k,
                            "names": [i + "_" + j, (i + 1) + "_" + k],
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
            .nodeWidth(node_width)
            .nodePadding(1)
            .extent([[slider_x_shift - node_width/2, 5],
                [slider_x_shift + slider_width + node_width/2, slider_y_shift - 15]])
            .nodeSort((a, b) => (a.class - b.class));
        let res = sankey({
            nodes: _nodes.map(d => Object.assign({}, d)),
            links: _links.map(d => Object.assign({}, d))
        });
        nodes = res.nodes;
        links = res.links.filter(d => d.source_class !== d.target_class);

        // slider
        slider_delta = slider_width / (total_iters - 1);
    };

    that.setIter = function (newiter) {
        if (newiter >= total_iters) {
            console.log(newiter, "is larger than ", total_iters - 1);
            return;
        }
        current_iter = newiter;
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
            .attr("id", function (d) {
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
            .attr("stroke", d => "url(#" + d.uid + ")")
            .attr("stroke-width", d => Math.max(...[1.5, d.width]))
            .attr("stroke-opacity", 0.4)
            .style("fill-opacity", 0);

        // create slider
        let xPositionScale = d3
            .scaleLinear()
            .domain([- slider_hump_length/slider_delta, total_iters - 1 + slider_hump_length/slider_delta])
            .range([slider_x_shift - slider_hump_length, slider_x_shift + slider_width + slider_hump_length]);
        let drag_start = function () {
            draging = true;
        };

        let drag_slider = function () {
            let value = d3.event.x;
            if (value < slider_x_shift) value = slider_x_shift;
            if (value > slider_x_shift + slider_width) value = slider_x_shift + slider_width;
            let new_iter = Math.floor((value - slider_x_shift) / slider_delta);
            console.log("slider_delta", slider_delta, "value", value,
                "current_iter:", current_iter, "new_iter:", new_iter);
            if (new_iter < 0) new_iter = 0;
            if (new_iter >= total_iters) new_iter = total_iters - 1;
            svg.select("#loss-slider-left").attr("x2", value);
            if (current_iter !== new_iter) {
                that.setIter(new_iter);
            }
            let circle = d3.select("#loss-view-slider-circle");
            circle.attr("cx", value);

        };

        let drag_slider_end = function () {
            let value = d3.event.x;
            if (value < slider_x_shift) value = slider_x_shift;
            if (value > slider_x_shift + slider_width) value = slider_x_shift + slider_width;

            let circle = d3.select("#loss-view-slider-circle");
            let new_iter = Math.floor((value - slider_x_shift) / slider_delta);
            if (new_iter < 0) new_iter = 0;
            if (new_iter >= total_iters) new_iter = total_iters - 1;
            value = xPositionScale(new_iter);
            svg.select("#loss-slider-left").attr("x2", value);
            circle.attr("cx", value);
            draging = false;
        };
        slider_group.selectAll("#loss-slider-right")
            .data([1])
            .enter()
            .append("line")
            .attr("id", "loss-slider-right")
            .attr("x1", slider_x_shift - slider_hump_length)
            .attr("y1", 0)
            .attr("x2", slider_x_shift + slider_width + slider_hump_length)
            .attr("y2", 0)
            .attr("stroke-width", slider_height)
            .attr("stroke", "#e4e7ed")
            .attr("stroke-linecap", "round");
        slider_group.selectAll("#loss-slider-left")
            .data([1])
            .enter()
            .append("line")
            .attr("id", "loss-slider-left")
            .attr("x1", slider_x_shift - slider_hump_length)
            .attr("y1", 0)
            .attr("x2", xPositionScale(current_iter))
            .attr("y2", 0)
            .attr("stroke-width", slider_height)
            .attr("stroke", "#808080")
            .attr("stroke-linecap", "round");
        slider_group.selectAll("circle")
            .data(iter_list)
            .enter()
            .append("circle")
            .attr("id", "loss-slider-base-circle")
            .attr('cx', (d, i) => {
                return xPositionScale(i)
            })
            .attr('cy', 0)
            .attr("fill", "#808080")
            .attr("r", slider_height + 2)
            .on("click", function (d, i) {
                that.setIter(i);
            });
        slider_group.selectAll("#loss-view-slider-circle")
            .data([1])
            .enter().append("circle")
            .attr("id", "loss-view-slider-circle")
            .attr('cx', xPositionScale(current_iter))
            .attr("cy", 0)
            .attr("fill", "#ffffff")
            .attr("r", slider_height + 4)
            .attr("stroke", "#808080")
            .attr("stroke-width", 3)
            .call(d3.drag().on("start", drag_start).on("drag", drag_slider).on("end", drag_slider_end));
        slider_group.selectAll(".loss-text")
            .data(iter_list)
            .enter()
            .append("text")
            .attr("class", "loss-text")
            .attr("x", (d,i) => xPositionScale(i))
            .attr("y", 0 + 6)
            .attr("text-anchor", "middle")
            .text(d => d);
    };

    that._update = function () {
        slider_group.selectAll("#loss-slider-base-circle")
            .attr("fill", function (d, i) {
                if(i<=current_iter){
                    return "#808080"
                }
                else return "#e4e7ed"
            });
    };

    that._remove = function () {

    };

    that.init = function () {
        that._init();
    }.call();

};
