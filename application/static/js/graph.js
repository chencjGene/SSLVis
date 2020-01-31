/*
* added by Changjian Chen, 20191015
* */

let GraphLayout = function (container) {
    let that = this;
    that.container = container;

    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let layout_width = width - 20;
    let layout_height = height - 20;
    let color_unlabel = UnlabeledColor;
    let color_label = CategoryColor;
    let btn_select_color = "#560731";
    let btn_unselect_color = "#ffffff";
    let edge_color = UnlabeledColor;

    let graph_data = null;
    let data_manager = null;

    let svg = null;
    let edges_group = null;
    let nodes_group = null;
    let golds_group = null;
    let edges_in_group = null;
    let nodes_in_group = null;
    let golds_in_group = null;
    let lasso_btn_path = null;

    let AnimationDuration = 1000;

    let main_group = null;
    let wait_list_group = null;
    let zoom_scale = 1;
    let old_transform = {
        x:0,
        y:0,
        k:1,
        toString: function () {
                        let self = this;
                        return 'translate(' + self.x + "," + self.y + ") scale(" + self.k + ")";
                    }
    };
    let current_level = 0;
    let drag_transform = null;
    let drag = null;
    let zoom = null;
    let if_lasso = false;
    let now_area = {
        x:-100,
        y:-100,
        width:200,
        height:200
    };
    let lasso = d3.lasso()
        .closePathSelect(true)
        .closePathDistance(100);

    let iter = 0;

    let show_ground_truth = false;
    let center_scale_x = null;
    let center_scale_y = null;
    let center_scale_x_reverse = null;
    let center_scale_y_reverse = null;

    let click_menu_settings = null;
    let click_node_menu = null;
    let click_edge_menu = null;
    let lasso_result = [];
    let delete_node_list = [];
    let update_label_list = {};
    // TODO: remove in the future
    let label_names = [];

    let is_focus_mode = false;
    let focus_node = {};
    let focus_edge_id = null;
    let focus_node_id = null;
    let focus_node_change_switch = true;
    let focus_edge_node = null;
    let focus_edge_change_switch = true;
    let send_zoom_timeout = 1000;
    let send_zoom_cnt = 0;
    let send_zoom_request = {};

    let path_nodes = {};
    let new_nodes = [];
    let path = [];
    let uncertain_nodes = [];

    that._init = function () {
        svg = container.selectAll('#graph-view-svg')
            .attr("width", width)
            .attr("height", height);
        svg.attr("oncontextmenu", "DataLoader.graph_view.context_menu(evt)");
        main_group = svg.append('g').attr('id', 'main_group');
        wait_list_group = svg.append('g').attr('id', 'wait_list_group').style("display", "none")
            .attr("transform", `translate(${45},2)`);
        d3.select("#apply-delete-btn").on("click", function () {
            if (if_lasso) {
                d3.select("#lasso-btn").style("background", "white");
                lasso_btn_path.attr("stroke", "black").attr("fill", "black");
                $("#lasso-btn").click();
            }

            if (wait_list_group.style("display") === "none") {
                wait_list_group.style("display", "block");
                d3.select("#apply-delete-btn").style("background", "rgb(86, 7, 49)");
                d3.selectAll(".apply-delete-btn-path").style("fill", "white");
            } else {
                wait_list_group.style("display", "none");
                d3.select("#apply-delete-btn").style("background", "gray");
                d3.selectAll(".apply-delete-btn-path").style("fill", "white");
            }
        }).on("mouseover", function () {
            if (wait_list_group.style("display") === "none") {
                d3.select("#apply-delete-btn").style("background", "gray");
                d3.selectAll(".apply-delete-btn-path").style("fill", "white");
            }
        }).on("mousemove", function () {
            if (wait_list_group.style("display") === "none") {
                d3.select("#apply-delete-btn").style("background", "gray");
                d3.selectAll(".apply-delete-btn-path").style("fill", "white");
            }
        }).on("mouseout", function () {
            if (wait_list_group.style("display") === "none") {
                d3.select("#apply-delete-btn").style("background", "white");
                d3.selectAll(".apply-delete-btn-path").style("fill", "black");
            }
        });

        that._update_wait_list_group();


        // d3.select("#my-graph-right").on("mouseover", function () {
        //     wait_list_group.style("display", "none");
        // });

        zoom = d3.zoom()
            .scaleExtent([0.6, 128])
            // .translateExtent([[-100, -100], [100, 100]])
            .on('start', function () {
                d3.selectAll(".iw-contextMenu").style("display", "none");
                that._reset_focus();
                focus_node_change_switch = true;
                focus_edge_change_switch = true;
            })
            .on("zoom", zoomed)
            .on("end", zoom_end);

        drag_transform = {'x': 0, 'y': 0};
        drag = d3.drag()
            .subject(function (d) {
                return {
                    x: d.x,
                    y: d.y
                };
            })
            .on("start", function (d) {
                // it's important that we suppress the mouseover event on the node being dragged. Otherwise it will absorb the mouseover event and the underlying node will not detect it
                d3.select(this).attr('pointer-events', 'none');
            })
            .on("drag", function (d) {
                drag_transform.x += d3.event.dx;
                drag_transform.y += d3.event.dy;
                main_group.attr("cx", function (e) {
                    return e.x + drag_transform.x;
                })
                    .attr("cy", function (e) {
                        return e.y + drag_transform.y;
                    });
            })
            .on("end", function (d) {
                // now restore the mouseover event or we won't be able to drag a 2nd time
                d3.select(this).attr('pointer-events', '');
            });

        function zoomed() {
            main_group.attr("transform", d3.event.transform); // updated for d3 v4
            that._maintain_size(d3.event.transform);
            let target_level = current_level;
            let current_level_scale = Math.pow(2, target_level);
            while (d3.event.transform.k > 2 * current_level_scale) {
                current_level_scale *= 2;
                target_level += 1;
            }
            while (d3.event.transform.k < current_level_scale / 1.5 && target_level > 0) {
                current_level_scale /= 2;
                target_level -= 1;
            }
            current_level = target_level;
            // console.log(d3.event.transform);
            if (old_transform === null) {
                old_transform = d3.event.transform;
            }
            d3.selectAll(".iw-contextMenu").style("display", "none");
        }

        function zoom_end() {
            main_group.attr("transform", d3.event.transform); // updated for d3 v4
            that._maintain_size(d3.event.transform);
            let target_level = current_level;
            let current_level_scale = Math.pow(2, target_level);
            while (d3.event.transform.k > 2 * current_level_scale) {
                current_level_scale *= 2;
                target_level += 1;
            }
            while (d3.event.transform.k < current_level_scale / 1.5 && target_level > 0) {
                current_level_scale /= 2;
                target_level -= 1;
            }
            current_level = target_level;

            if (old_transform === null || d3.event.transform.k !== old_transform.k || Math.abs(d3.event.transform.x - old_transform.x) > 1 || Math.abs(d3.event.transform.y - old_transform.y) > 1) {
                svg = container.select("#graph-view-svg");
                width = $('#graph-view-svg').width();
                height = $('#graph-view-svg').height();
                // main_group.select('#debug-shouxing')
                //     .attr('x', -d3.event.transform.x / d3.event.transform.k)
                //     .attr('y', -d3.event.transform.y / d3.event.transform.k)
                //     .attr('width', width / d3.event.transform.k)
                //     .attr('height', height / d3.event.transform.k);
                let start_x = center_scale_x_reverse(-d3.event.transform.x / d3.event.transform.k);
                let start_y = center_scale_y_reverse(-d3.event.transform.y / d3.event.transform.k);
                let end_x = center_scale_x_reverse((width - d3.event.transform.x) / d3.event.transform.k);
                let end_y = center_scale_y_reverse((height - d3.event.transform.y) / d3.event.transform.k);

                let area = {
                    'x': start_x,
                    'y': start_y,
                    'width': end_x - start_x,
                    'height': end_y - start_y
                };
                console.log(d3.event.transform, area, current_level);
                let send_zoom_idx = send_zoom_cnt++;
                send_zoom_request[send_zoom_idx] = true;
                for(let i=0;i<send_zoom_idx;i++){
                    send_zoom_request[i] = false;
                }
                setTimeout(function () {
                    if(send_zoom_request[send_zoom_idx]){
                        console.log(send_zoom_idx);
                        DataLoader.update_graph_notify(area, target_level);

                    }
                }, send_zoom_timeout);
                now_area = area;
            }
            old_transform = d3.event.transform;
        }

        svg.on("mousedown", function () {
            console.log(d3.event.button);
            is_focus_mode = false;
            d3.selectAll(".iw-contextMenu").style("display", "none");
            // svg.select("#group-propagation").remove();
            nodes_in_group.attr("opacity", 1);
            golds_in_group.attr("opacity", 1);
            // edges_in_group.attr("opacity", 0.4);

            // svg.select("#single-propagate").remove();
            nodes_in_group.attr("opacity", 1);
            golds_in_group.attr("opacity", 1);
        });

        svg.on(".drag", null);
        svg.on(".dragend", null);
        svg.call(zoom);

        $("#lasso-btn").click(function () {
            if (wait_list_group.style("display") === "block") {
                $("#apply-delete-btn").click();
                d3.select("#apply-delete-btn").style("background", "white");
                d3.selectAll(".apply-delete-btn-path").style("fill", "black");
            }
            that._change_lasso_mode();
        }).on("mouseover", function () {
            if (d3.select("#lasso-btn").style("background-color") === "rgba(0, 0, 0, 0)"
                || d3.select("#lasso-btn").style("background-color") === "white"
                || d3.select("#lasso-btn").style("background-color") === "rgb(255, 255, 255)") {
                d3.select("#lasso-btn").style("background", "gray");
                lasso_btn_path.attr("stroke", "white").attr("fill", "white");
            }
        }).on("mousemove", function () {
            if (d3.select("#lasso-btn").style("background-color") === "rgba(0, 0, 0, 0)"
                || d3.select("#lasso-btn").style("background-color") === "white"
                || d3.select("#lasso-btn").style("background-color") === "rgb(255, 255, 255)") {
                d3.select("#lasso-btn").style("background", "gray");
                lasso_btn_path.attr("stroke", "white").attr("fill", "white");
            }
        }).on("mouseout", function () {
            if (d3.select("#lasso-btn").style("background-color") === "gray") {
                d3.select("#lasso-btn").style("background", "white");
                lasso_btn_path.attr("stroke", "black").attr("fill", "black");
            }
        });

        edges_group = main_group.append("g").attr("id", "graph-view-link-g");
        nodes_group = main_group.append("g").attr("id", "graph-view-tsne-point");
        golds_group = main_group.append("g").attr("id", "golds-g");
        lasso_btn_path = d3.select("#lasso-btn").select("path");

        click_menu_settings = {
            'mouseClick': 'right',
            'triggerOn': 'click'
        };

        that._update_click_menu();
        that._draw_labels_glyph();
    };

    that._reset_focus = function() {
        path_nodes = {};
        svg.select("#group-propagation").remove();
        svg.select("#score-pie-chart-g").remove();
        svg.select("#uncertain-pie-chart-g").selectAll("path").attr("opacity", 1);
        nodes_in_group.attr("opacity", 1);
        golds_in_group.attr("opacity", 1);
        // edges_in_group.attr("opacity", 0.4);

        svg.select("#single-propagate").remove();
        nodes_in_group.attr("opacity", 1);
        golds_in_group.attr("opacity", 1);
    };

    that._draw_labels_glyph = function () {
        let glyph_svg = d3.select("#label-glyph-svg");
        glyph_svg.append("path")
            .attr("d", star_path(10, 4, 10 + 20, 10 + 20))
            .attr("fill-opacity", 0)
            .attr("stroke-width", 1)
            .attr("stroke", "black");

        glyph_svg.append("circle")
            .attr("cx", 10 + 140)
            .attr("cy", 10 + 20)
            .attr("r", 5)
            .attr("fill-opacity", 0)
            .attr("stroke-width", 1)
            .attr("stroke", "black");

        glyph_svg.append("text")
            .attr("x", 10 + 35)
            .attr("y", 10 + 23)
            .attr("text-anchor", "start")
            .attr("font-size", 13)
            .attr("fill", FontColor)
            .text("labeled data");

        glyph_svg.append("text")
            .attr("x", 10 + 150)
            .attr("y", 10 + 23)
            .attr("text-anchor", "start")
            .attr("font-size", 13)
            .attr("fill", FontColor)
            .text("unlabeled data");
    };

    that._maintain_size = function (transform_event) {
        zoom_scale = 1.0 / transform_event.k;
        nodes_group.selectAll("circle").attr("r", d => (uncertain_nodes.indexOf(d.id)===-1?3.5:5)*zoom_scale);
        golds_group.selectAll("path").attr("d", d => star_path(10 * zoom_scale, 4 * zoom_scale, center_scale_x(d.x), center_scale_y(d.y)));
        edges_group.selectAll("line").style('stroke-width', zoom_scale);
        main_group.select("#group-propagation").selectAll("polyline").style('stroke-width', 2.0 * zoom_scale);
        main_group.select("#single-propagate").selectAll("polyline").style('stroke-width', 2.0 * zoom_scale);
        let arc = d3.arc().outerRadius(11 * zoom_scale).innerRadius(7 * zoom_scale);
        main_group.select("#score-pie-chart-g").selectAll("path").attr("d", arc);
        main_group.select("#uncertain-pie-chart-g").selectAll("path").attr("d", arc);
    };

    that.lasso_start = function () {
        that._reset_focus();
        lasso.items()
            .attr("r", d => (uncertain_nodes.indexOf(d.id)===-1?3.5:5)*zoom_scale) // reset size
            .classed("not_possible", true)
            .classed("selected", false);
    };

    that.lasso_draw = function () {
        // Style the possible dots
        lasso.possibleItems()
            .classed("not_possible", false)
            .classed("possible", true)
            .attr("r", 5 * zoom_scale);
        //
        // // Style the not possible dot
        lasso.notPossibleItems()
            .classed("not_possible", true)
            .classed("possible", false)
            .attr("r", d => (uncertain_nodes.indexOf(d.id)===-1?3.5:5)*zoom_scale);

    };

    that.lasso_end = function () {
        lasso.items()
            .classed("not_possible", false)
            .classed("possible", false);

        // Style the selected dots
        lasso.selectedItems()
            .classed("selected", true)
            .attr("r", 5 * zoom_scale);

        // Reset the style of the not selected dots
        lasso.notSelectedItems()
            .attr("r", d => (uncertain_nodes.indexOf(d.id)===-1?3.5:5)*zoom_scale);

        let focus_node_data = lasso.selectedItems().data();
        let focus_node_ids = focus_node_data.map(d => d.id);
        lasso_result = focus_node_ids;
        focus_edge_id = null;
        console.log("focus_edge_id = null");
        focus_edge_node = null;
        // that._update_click_menu();
        if (focus_node_data.length === 0) {
            // console.log("No node need focus.");
            return
        }
        is_focus_mode = true;
        data_manager.update_image_view(lasso.selectedItems());
        console.log("focus nodes:", focus_node_data);


        let path_keys = [];
        path = [];
        path_nodes = {};
        new_nodes = [];
        let new_area = null;

        for (let d of focus_node_data) {
            if (d.label[iter] === -1 || d.label[0] !== -1) continue;
            console.log("Node:", d);
            let eid = d.id;
            let predict_label = d.label[iter];
            for (let onepath of d.path) {
                if (onepath.length === 1) continue;
                for (let i = 0; i < onepath.length - 1; i++) {
                    let s = onepath[i];
                    let e = onepath[i + 1];
                    let key = s + "," + e;
                    if (path_keys.indexOf(key) === -1) {
                        path_keys.push(key);
                        let keys = key.split(",");
                        let e = parseInt(keys[0]);
                        let s = parseInt(keys[1]);
                        path_nodes[e] = true;
                        path_nodes[s] = true;
                        path.push([e, s, predict_label]);
                    }
                }
            }
        }
        let must_show_nodes = [];
        for(let node_id in path_nodes){
            if(graph_data.nodes[node_id] === undefined) new_nodes.push(parseInt(node_id));
            must_show_nodes.push(parseInt(node_id))
        }
        focus_node = JSON.parse(JSON.stringify(path_nodes));
        $.post("/graph/getArea", {
                    "must_show_nodes":JSON.stringify(must_show_nodes),
                    "width":width,
                    "height":height
                }, function (data) {
                    // get k and level
                    width = $("#graph-view-svg").width();
                    height = $("#graph-view-svg").height();
                    new_area = data.area;
                    let main_group_min_x = center_scale_x(new_area.x);
                    let main_group_min_y = center_scale_y(new_area.y);
                    let main_group_max_x = center_scale_x(new_area.x+new_area.width);
                    let main_group_max_y = center_scale_y(new_area.y+new_area.height);
                    let maingroup_k = Math.min(width/(main_group_max_x-main_group_min_x), height/(main_group_max_y-main_group_min_y));
                    let target_level = current_level;
                    let current_level_scale = Math.pow(2, target_level);
                    while (maingroup_k > 2 * current_level_scale) {
                        current_level_scale *= 2;
                        target_level += 1;
                    }
                    while (maingroup_k < current_level_scale / 1.5 && target_level > 0) {
                        current_level_scale /= 2;
                        target_level -= 1;
                    }
                    current_level = target_level;
                    zoom_scale = 1.0 / maingroup_k;
                    console.log("current level", current_level, "current area", new_area);
                    let old_nodes = {};
                    for(let node_id of must_show_nodes){
                            if(graph_data.nodes[node_id] !== undefined){
                                let node = graph_data.nodes[node_id];
                                old_nodes[node.id] = {
                                    id:node.id,
                                    x:node.x,
                                    y:node.y
                                }
                            }
                        }
                    data_manager.update_fisheye_graph_node(must_show_nodes, old_nodes, new_nodes, new_area, current_level, width/height, "group");
                });
    };

    that._change_lasso_mode = function () {
        if (if_lasso) {
            if_lasso = false;
            $("#lasso-btn").css("background-color", "gray");
            lasso_btn_path.attr("stroke", "white").attr("fill", "white");
            svg.on(".drag", null);
            svg.on(".dragend", null);
            svg.call(zoom);
            svg.selectAll('.lasso').remove();
        } else {
            if_lasso = true;
            $("#lasso-btn").css("background-color", btn_select_color);
            lasso_btn_path.attr("stroke", "white").attr("fill", "white");
            svg.on('.zoom', null);
            svg.select(".lasso").remove();
            svg.call(lasso);
        }
    };

    that.set_data_manager = function (_data_manager) {
        data_manager = _data_manager;
    };

    that.component_update = async function (state, rescale) {
        console.log("graph component update");
        that._update_data(state);
        if(state.top_k_uncertain !== undefined){
            console.log("get top k uncertain:", state.top_k_uncertain);
            uncertain_nodes = state.top_k_uncertain;
        }

        await that._update_view(rescale, state);

        if(state.fisheye !== undefined){
            await that._draw_uncertain_pie_chart(0.2);
        }
        else {
            await that._draw_uncertain_pie_chart(1);
        }

        if(state.fisheye === "single"){
            await that._single_show_path();
        }
        else if(state.fisheye === "group"){
            await that._group_show_path();
        }
    };

    that._update_data = function (state) {
        graph_data = state.graph_data;
        // TODO: remove in the future
        label_names = state.label_names;
        iter = Object.values(graph_data.nodes)[0].label.length - 1;
        console.log("iter", iter);
        that._update_delete_node_list();
        // that._update_click_menu();
        console.log("graph_data", graph_data);
        // remove in the future
        that._draw_legend();
    };

    // TODO: remove in the future
    that._draw_legend = function () {
        // $.post('/graph/GetLabels', {}, function (d) {
        let labels = ["unlabeled"].concat(label_names);
        // labels.unshift("unlabel");
        let label_num = labels.length;
        let legend_svg = d3.select("#category-encoding");
        legend_svg.select("#graph-legend-g").remove();
        let legend_area = legend_svg.append("g")
            .attr("id", "graph-legend-g");
        let legend_width = $("#category-encoding").parent().width();
        let padding = 10;
        let delta = 15;
        let text_delta = 5;
        let legend_delta = 55;
        let rect_width = 20;
        let rect_height = 20;
        let text_width = 45;
        let x_item_num = Math.floor((legend_width - padding * 2) / (rect_width + text_width + delta + text_delta));
        let y_item_num = Math.ceil(label_num / x_item_num);
        let legend_height = y_item_num * (rect_height + delta) - rect_height + padding * 2;
        legend_svg.attr("height", legend_height);
        for (let i = 0; i < label_num; i++) {
            legend_area.append("rect")
                .attr("x", padding + (i % x_item_num) * (rect_width + text_width + delta + text_delta))
                .attr("y", padding + Math.floor(i / x_item_num) * (rect_height + delta))
                .attr("width", rect_width)
                .attr("height", rect_height)
                .attr("fill", function () {
                    if (i === 0) return color_unlabel;
                    else return color_label[i - 1];
                });
            legend_area.append("text")
                .attr("x", padding + (i % x_item_num) * (rect_width + text_width + delta + text_delta) + rect_width + text_delta)
                .attr("y", padding + Math.floor(i / x_item_num) * (rect_height + delta) + 14)
                .attr("text-anchor", "start")
                .attr("font-size", "13")
                .attr("fill", FontColor)
                .text(function () {
                    return labels[i]
                })
        }
        // })
    };

    that.setIter = function (newiter) {
        iter = newiter;
        that._update_view(false);
    };

    that._center_tsne = function centering(rescale) {
        let nodes = Object.values(graph_data.nodes);
        if (rescale) {
            let xRange = d3.extent(nodes, function (d) {
                return d.x
            });
            var yRange = d3.extent(nodes, function (d) {
                return d.y
            });
            if (xRange[0] == xRange[1]) {
                xRange[0] -= 10;
                xRange[1] += 10;
            }
            if (yRange[0] == yRange[1]) {
                yRange[0] -= 10;
                yRange[1] += 10;
            }
            let width = $('#graph-view-svg').width();
            let height = $('#graph-view-svg').height();

            let scale = Math.min(width / (xRange[1] - xRange[0]),
                height / (yRange[1] - yRange[0]));
            scale *= 0.85;
            let x_width = (xRange[1] - xRange[0]) * scale;
            let y_height = (yRange[1] - yRange[0]) * scale;
            center_scale_x = d3.scaleLinear().domain(xRange).range([(width - x_width) / 2, (width + x_width) / 2]);
            center_scale_y = d3.scaleLinear().domain(yRange).range([(height - y_height) / 2, (height + y_height) / 2]);
            center_scale_x_reverse = d3.scaleLinear().domain([(width - x_width) / 2, (width + x_width) / 2]).range(xRange);
            center_scale_y_reverse = d3.scaleLinear().domain([(height - y_height) / 2, (height + y_height) / 2]).range(yRange);
        }
        // for(let node of nodes){
        //     node.x = center_scale_x(node.x);
        //     node.y = center_scale_y(node.y);
        // }
    };

    that._edge_reformulation = function (edges) {
        let new_edges = {};
        for (let edge of edges) {
            if (new_edges[edge.s] === undefined) {
                new_edges[edge.s] = {
                    s: [],
                    e: []
                };
            }
            if (new_edges[edge.e] === undefined) {
                new_edges[edge.e] = {
                    s: [],
                    e: []
                };
            }
            new_edges[edge.s].s.push(edge.e);
            new_edges[edge.e].e.push(edge.s);
        }
        return new_edges
    };

    that._add_marker = function () {
        if ($("#markers marker").length !== 0) return;
        svg = container.select("#graph-view-svg");
        for (let i = 0; i < color_label.length; i++) {
            let color = color_label[i];
            svg.select("#markers").append("marker")
                .attr("id", "arrow-" + i)
                .attr("refX", 2)
                .attr("refY", 2)
                .attr("markerWidth", 10)
                .attr("markerHeight", 10)
                .attr("orient", "auto")
                .attr("markerUnits", "strokeWidth")
                .append("path")
                .attr("d", "M0,4 L4,2 L0,0")
                .attr("stroke", color)
                .attr("fill", "transparent")
                .attr("stroke-width", 1);
        }
        svg.select("#markers").append("marker")
                .attr("id", "arrow-gray")
                .attr("refX", 2)
                .attr("refY", 2)
                .attr("markerWidth", 10)
                .attr("markerHeight", 10)
                .attr("orient", "auto")
                .attr("markerUnits", "strokeWidth")
                .append("path")
                .attr("d", "M0,4 L4,2 L0,0")
                .attr("stroke", edge_color)
                .attr("fill", "transparent")
                .attr("opacity", 1)
                .attr("stroke-width", 1);
    };

    that._update_transform = function(new_area) {
        return new Promise(function (resolve, reject) {
            width = $("#graph-view-svg").width();
            height = $("#graph-view-svg").height();
            let main_group_min_x = center_scale_x(new_area.x);
            let main_group_min_y = center_scale_y(new_area.y);
            let main_group_max_x = center_scale_x(new_area.x + new_area.width);
            let main_group_max_y = center_scale_y(new_area.y + new_area.height);
            let maingroup_k = Math.min(width/(main_group_max_x-main_group_min_x), height/(main_group_max_y-main_group_min_y));
            if(old_transform === null){
                old_transform = {
                    toString: function () {
                        let self = this;
                        return 'translate(' + self.x + "," + self.y + ") scale(" + self.k + ")";
                    }
                };
            }
            old_transform.k = maingroup_k;
            old_transform.x = width/2-(main_group_min_x+main_group_max_x)/2*maingroup_k;
            old_transform.y = height/2-(main_group_min_y+main_group_max_y)/2*maingroup_k;
            main_group
                .transition()
                .duration(AnimationDuration)
                .attr("transform", old_transform)
                .on("end", function () {
                    resolve();
                });
            that._maintain_size(old_transform);
            now_area = new_area;
        });
    };

    that._distance = function(a, b){
        return Math.sqrt(Math.pow(a.x-b.x, 2) + Math.pow(a.y-b.y, 2))
    };

    that._single_show_path = function(){
        return new Promise(function (resolve, reject) {
            nodes_in_group = nodes_group.selectAll("circle");
                    golds_in_group = golds_group.selectAll("path");
                    // de-highlight
                    nodes_in_group
                        .transition()
                        .duration(AnimationDuration)
                        .attr("opacity", d => path_nodes[d.id]===true?1:0.2)
                        .attr("r", d => ((path_nodes[d.id] === true)||(uncertain_nodes.indexOf(d.id)>-1)?5:1)*zoom_scale);
                    golds_in_group
                        .transition()
                        .duration(AnimationDuration)
                        .attr("d", d => star_path(10 * zoom_scale, 4 * zoom_scale, center_scale_x(d.x), center_scale_y(d.y)))
                        .attr("opacity", d => path_nodes[d.id]===true?1:0.2);

                    svg.select("#single-propagate").remove();
                    nodes_in_group.each(function (d) {
                        let node = d3.select(this);
                        if(path_nodes[d.id]===true){
                            path_nodes[d.id] = node;
                        }
                    });
                    that._draw_score_pie_chart(Object.keys(path_nodes));
                    // let all_in_old_area = true;
                    // for(let new_node of new_nodes){
                    //     let x = path_nodes[new_node].datum().x;
                    //     let y = path_nodes[new_node].datum().y;
                    //     if((x<now_area.x)||(x>now_area.x+now_area.width)||(y<now_area.y)||(y>now_area.y+now_area.height)){
                    //         all_in_old_area = false;
                    //         break;
                    //     }
                    // }
                    // if(all_in_old_area){
                    //     maingroup_k = Math.min(width/(main_group_max_x-main_group_min_x), height/(main_group_max_y-main_group_min_y));
                    // }
                    // let show_width = (main_group_max_x-main_group_min_x)*maingroup_k;
                    // let show_height = (main_group_max_y-main_group_min_y)*maingroup_k;


                    let single_node_propagate = main_group.insert("g", ":first-child")
                            .attr("id", "single-propagate")
                            .selectAll("polyline")
                            .data(path)
                            .enter()
                            .append("polyline")
                            .on("mouseover", function (d) {
                                console.log(d);
                                if (focus_edge_change_switch) {
                                    focus_edge_id = d;
                                    console.log("focus_edge_id = " + focus_edge_id);
                                    focus_edge_node = this;
                                    d3.select(this).style("stroke-width", 4.0 * zoom_scale);
                                }
                                $.post("/graph/feature_distance", {
                                    path:JSON.stringify(d)
                                }, function (data) {
                                    console.log("Distance between",d[0],d[1],"is:",data.distance);
                                })
                                // that._update_click_menu();
                            })
                            .on("mouseout", function (d) {
                                if (focus_edge_change_switch) {
                                    focus_edge_id = null;
                                    console.log("focus_edge_id = null");
                                    focus_edge_node = null;
                                    d3.select(this).style("stroke-width", 2.0 * zoom_scale);
                                }
                            })
                            .attr("class", "edge-line")
                            .attr("stroke-width", 2 * zoom_scale)
                            .attr("stroke", edge_color)
                            .attr("opacity", 0)
                            .attr("marker-mid", d => "url(#arrow-gray)")
                            .attr("fill", "none")
                            .attr("points", function (d) {
                                let begin = [center_scale_x(path_nodes[d[0]].datum().x), center_scale_y(path_nodes[d[0]].datum().y)];
                                let end = [center_scale_x(path_nodes[d[1]].datum().x), center_scale_y(path_nodes[d[1]].datum().y)];
                                let mid = [(begin[0]+end[0])/2, (begin[1]+end[1])/2];
                                return begin[0]+","+begin[1]+" "+mid[0]+","+mid[1]+" "+end[0]+","+end[1];
                            });
                            single_node_propagate.transition()
                            .duration(AnimationDuration)
                            .attr("opacity", 1)
                                .on("end", resolve);
                        // $('.edge-line').contextMenu(click_edge_menu, click_menu_settings);
                        $('#single-propagate').contextMenu(click_edge_menu, click_menu_settings);
        });
    };

    that._group_show_path = function(){
        return new Promise(function (resolve, reject) {
            nodes_in_group = nodes_group.selectAll("circle");
            golds_in_group = golds_group.selectAll("path");

            // de-highlight
            nodes_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => path_nodes[d.id]===true?1:0.2)
                .attr("r", d => ((path_nodes[d.id] === true)||(uncertain_nodes.indexOf(d.id)>-1)?5:1)*zoom_scale);
            golds_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => path_nodes[d.id]===true?1:0.2);
            nodes_in_group.each(function (d) {
                            let node = d3.select(this);
                            if(path_nodes[d.id]===true){
                                path_nodes[d.id] = node;
                            }
                        });
            that._draw_score_pie_chart(Object.keys(path_nodes));
            let propagate_svg = main_group.insert("g", ":first-child").attr("id", "group-propagation");
            propagate_svg.append("g")
                .attr("class", "single-propagate")
                .selectAll("polyline")
                .data(path)
                .enter()
                .append("polyline")
                .attr("stroke-width", 2.0 * zoom_scale)
                .attr("stroke", edge_color)
                .attr("opacity", 0)
                .attr("marker-mid", d => "url(#arrow-gray)")
                .attr("fill", "none")
                .attr("points", function (d) {
                            let begin = [center_scale_x(path_nodes[d[0]].datum().x), center_scale_y(path_nodes[d[0]].datum().y)];
                                let end = [center_scale_x(path_nodes[d[1]].datum().x), center_scale_y(path_nodes[d[1]].datum().y)];
                                let mid = [(begin[0]+end[0])/2, (begin[1]+end[1])/2];
                                return begin[0]+","+begin[1]+" "+mid[0]+","+mid[1]+" "+end[0]+","+end[1];
                        })
                .on("mouseover", function (d) {
                            console.log(d);
                            focus_edge_id = d;
                            console.log("focus_edge_id = " + focus_edge_id);
                            focus_edge_node = this;
                            d3.select(this).style("stroke-width", 4.0 * zoom_scale);
                        })
                .on("mouseout", function (d) {
                        if (focus_edge_change_switch) {
                            focus_edge_id = null;
                            console.log("focus_edge_id = null");
                            focus_edge_node = null;
                            d3.select(this).style("stroke-width", 2.0 * zoom_scale);
                        }
                    })
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", 1)
                .on("end", resolve);
            $('.single-propagate').contextMenu(click_edge_menu, click_menu_settings);
        });
    };

    that._create = async function () {
        return new Promise(function (resolve, reject) {
            svg = container.select("#graph-view-svg");

            nodes_in_group.enter()
                .append("circle")
                .attr("id", d => "id-" + d.id)
                .attr("class", "node-dot")
                .attr("cx", d => center_scale_x(d.x))
                .attr("cy", d => center_scale_y(d.y))
                .attr("r", d => (uncertain_nodes.indexOf(d.id)===-1?3.5:5)*zoom_scale)
                .attr("opacity", 0)
                .attr("fill", function (d) {
                    if (show_ground_truth) {
                        if (d.truth === -1) return color_unlabel;
                        else return color_label[d.truth];
                    } else {
                        if (d.label[iter] === -1) return color_unlabel;
                        else return color_label[d.label[iter]];
                    }
                })
                .on("mouseover", function (d) {
                    if((uncertain_nodes.indexOf(d.id)!==-1)||(path_nodes[d.id]!==undefined)){
                        return
                    }
                    let node = d3.select(this);
                    node.attr("r", 5 * zoom_scale);
                    // that._update_click_menu();
                    if (focus_node_change_switch) {
                        focus_node_id = d.id;
                        console.log("focus_node_id:" + focus_node_id);
                    }
                    console.log(d.id)
                })
                .on("mouseout", function (d) {
                    if((uncertain_nodes.indexOf(d.id)!==-1)||(path_nodes[d.id]!==undefined)){
                        return
                    }
                    let node = d3.select(this);
                    node.attr("r", 3.5 * zoom_scale);

                    if (focus_node_change_switch) {
                        focus_node_id = null;
                        console.log("focus_node_id = null");
                    }
                })
                .on("click", function (d) {
                    is_focus_mode = true;
                    focus_node = {};
                    lasso_result = [d.id];
                    focus_edge_id = null;
                    console.log("focus_edge_id = null");
                    focus_edge_node = null;
                    // that._update_click_menu();
                    let node = d3.select(this);
                    let new_area = null;
                    // added by changjian, 20191226
                    // showing image content
                    data_manager.update_image_view(node);
                    console.log("Node:", d);


                    if (d.label[iter] === -1 || d.label[0] !== -1) return;

                    // get must show nodes
                    let predict_label = d.label[iter];
                    let path_keys = [];
                    path = [];
                    path_nodes = {};
                    new_nodes = [];
                    for (let onepath of d.path) {
                        if (onepath.length === 1) continue;
                        for (let i = 0; i < onepath.length - 1; i++) {
                            let s = onepath[i];
                            let e = onepath[i + 1];
                            let key = s + "," + e;
                            if (path_keys.indexOf(key) === -1) {
                                path_keys.push(key)
                            }
                        }
                    }
                    for (let path_key of path_keys) {
                        let keys = path_key.split(",");
                        let e = parseInt(keys[0]);
                        let s = parseInt(keys[1]);
                        path_nodes[e] = true;
                        path_nodes[s] = true;
                        path.push([e, s, predict_label]);
                    }
                    focus_node = JSON.parse(JSON.stringify(path_nodes));
                    let must_show_nodes = [];
                    for(let node_id in path_nodes){
                        if(graph_data.nodes[node_id] === undefined) new_nodes.push(parseInt(node_id));
                        must_show_nodes.push(parseInt(node_id))
                    }
                    $.post("/graph/getArea", {
                        "must_show_nodes":JSON.stringify(must_show_nodes),
                        "width":width,
                        "height":height
                    }, function (data) {
                        // get k and level
                        new_area = data.area;
                        let main_group_min_x = center_scale_x(new_area.x);
                        let main_group_min_y = center_scale_y(new_area.y);
                        let main_group_max_x = center_scale_x(new_area.x + new_area.width);
                        let main_group_max_y = center_scale_y(new_area.y + new_area.height);
                        let maingroup_k = Math.min(width / (main_group_max_x - main_group_min_x), height / (main_group_max_y - main_group_min_y)) * 0.8;
                        let target_level = current_level;
                        let current_level_scale = Math.pow(2, target_level);
                        while (maingroup_k > 2 * current_level_scale) {
                            current_level_scale *= 2;
                            target_level += 1;
                        }
                        while (maingroup_k < current_level_scale / 1.5 && target_level > 0) {
                            current_level_scale /= 2;
                            target_level -= 1;
                        }
                        current_level = target_level;
                        zoom_scale = 1.0 / maingroup_k;
                        let old_nodes = {};
                        for(let node_id of must_show_nodes){
                            if(graph_data.nodes[node_id] !== undefined){
                                let node = graph_data.nodes[node_id];
                                old_nodes[node.id] = {
                                    id:node.id,
                                    x:node.x,
                                    y:node.y
                                }
                            }
                        }
                        data_manager.update_fisheye_graph_node(must_show_nodes, old_nodes, new_nodes, new_area, current_level, width/height, "single");
                    });
                })
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", function (d) {
                    return (is_focus_mode && (!focus_node[d.id])) ? 0.2 : 1;
                })
                .on("end", resolve);
            golds_in_group.enter()
                .append("path")
                .attr("id", d => "gold-" + d.id)
                .attr("d", d => star_path(10 * zoom_scale, 4 * zoom_scale, center_scale_x(d.x), center_scale_y(d.y)))
                .attr("fill", function (d) {
                    if (show_ground_truth) {
                        if (d.truth === -1) return color_unlabel;
                        else return color_label[d.truth];
                    } else {
                        if (d.label[iter] === -1) return color_unlabel;
                        else return color_label[d.label[iter]];
                    }
                })
                .attr("stroke", "white")
                .attr("stroke-width", 1.5)
                .attr("opacity", 0)
                .on("mouseover", function (d) {
                    console.log("Label node id:", d.id)
                })
                .on("click", function (d) {
                    let eid = d.id;
                    let nodes = d3.select(this);
                    data_manager.update_image_view(nodes);
                })
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => (is_focus_mode && (!focus_node[d.id])) ? 0.2 : 1)
                .on("end", resolve);

            // edges_in_group = edges_group.selectAll("line")
            //         .data(links_data);
            // edges_in_group.enter()
            //         .append("line")
            //         .attr("x1", d => center_scale_x(nodes_data[d["s"]].x))
            //         .attr("y1", d => center_scale_y(nodes_data[d["s"]].y))
            //         .attr("x2", d => center_scale_x(nodes_data[d["e"]].x))
            //         .attr("y2", d => center_scale_y(nodes_data[d["e"]].y))
            //         .attr("stroke-width", zoom_scale)
            //         .attr("stroke", "gray")
            //         .attr("opacity", 0.0);
            if((nodes_in_group.enter().size() === 0) && (golds_in_group.enter().size() === 0)){
                console.log("no create");
                resolve();
            }
        });
    };

    that._update_wait_list_group = function () {
        let text_height = 30;
        let images = [];
        wait_list_group.selectAll('#background-rect').remove();
        wait_list_group.append('rect')
            .attr('id', 'background-rect')
            .attr('x', 0)
            .attr('y', 0)
            .style('rx', 10)
            .style('ry', 10)
            .attr('width', 256)
            .attr('height', text_height * 2 + Math.floor((delete_node_list.length - 1) / 4) * 60 + 80)
            .style('fill', 'white')
            .style('stroke', 'gray')
            .style('opacity', 0.8);
        wait_list_group.selectAll('#title-text').remove();
        wait_list_group.append('text')
            .attr('id', 'title-text')
            .attr('x', 128)
            .attr('y', text_height / 2 + 8)
            .text('Deleted images:')
            .attr("text-anchor", "middle")
            .attr('dominant-baseline', "middle")
            .attr("font-size", text_height - 8);
        wait_list_group.selectAll('#wait-btn').remove();
        wait_list_group.append('rect')
            .attr('id', 'wait-btn')
            .attr('x', 128 - 40)
            .attr('y', text_height + Math.floor((delete_node_list.length - 1) / 4) * 60 + 70)
            .style('rx', 10)
            .style('ry', 10)
            .attr('width', 80)
            .attr('height', text_height)
            .style('fill', 'white')
            .style('stroke', 'gray')
            .on("click", function () {
                that._apply_delete_and_update_label();
            }).on("mouseover", function () {
            d3.select("#wait-btn").style("fill", "gray").style("stroke", "black");
            d3.select("#wait-text").style("fill", "white");
        }).on("mousemove", function () {
            d3.select("#wait-btn").style("fill", "gray").style("stroke", "black");
            d3.select("#wait-text").style("fill", "white");
        }).on("mouseout", function () {
            d3.select("#wait-btn").style("fill", "white").style("stroke", "gray");
            d3.select("#wait-text").style("fill", "black");
        });
        wait_list_group.selectAll('#wait-text').remove();
        wait_list_group.append('text')
            .attr('id', 'wait-text')
            .attr('x', 128)
            .attr('y', text_height / 2 + text_height + Math.floor((delete_node_list.length - 1) / 4) * 60 + 70)
            .text('Update')
            .attr("text-anchor", "middle")
            .attr('dominant-baseline', "middle")
            .attr("font-size", text_height - 8)
            .on("click", function () {
                that._apply_delete_and_update_label();
            }).on("mouseover", function () {
            d3.select("#wait-btn").style("fill", "gray").style("stroke", "black");
            d3.select("#wait-text").style("fill", "white");
        }).on("mousemove", function () {
            d3.select("#wait-btn").style("fill", "gray").style("stroke", "black");
            d3.select("#wait-text").style("fill", "white");
        }).on("mouseout", function () {
            d3.select("#wait-btn").style("fill", "white").style("stroke", "gray");
            d3.select("#wait-text").style("fill", "black");
        });

        wait_list_group.selectAll('.close-path').remove();
        wait_list_group.selectAll('#close-path-g').remove();

        let temp_g = wait_list_group.append('g')
            .attr('id', 'close-path-g')
            .attr('transform', 'translate(225, 5) scale(0.025)')
            .on("click", function () {
                wait_list_group.style("display", "none");
                d3.select("#apply-delete-btn").style("background", "white");
                d3.selectAll(".apply-delete-btn-path").style("fill", "black");
                d3.select("#close-circle").style("fill", "white").style("stroke", "gray");
                d3.select("#close-icon").style("fill", "black");
            }).on("mouseover", function () {
                d3.select("#close-circle").style("fill", "gray").style("stroke", "black");
                d3.select("#close-icon").style("fill", "white");
            }).on("mousemove", function () {
                d3.select("#close-circle").style("fill", "gray").style("stroke", "black");
                d3.select("#close-icon").style("fill", "white");
            }).on("mouseout", function () {
                d3.select("#close-circle").style("fill", "white").style("stroke", "gray");
                d3.select("#close-icon").style("fill", "black");
            });
        temp_g.append('circle')
            .attr('id', 'close-circle')
            .attr('class', 'close-path')
            .attr('cx', "500")
            .attr('cy', "500")
            .attr('r', "450")
            .style('fill', 'white')
            .style('stroke', 'gray')
            .style('stroke-width', '60px');
        temp_g.append('path')
            .attr('id', 'close-icon')
            .attr('class', 'close-path')
            .attr('d', "M665.376 313.376L512 466.752l-153.376-153.376-45.248 45.248L466.752 512l-153.376 153.376 45.248 45.248L512 557.248l153.376 153.376 45.248-45.248L557.248 512l153.376-153.376z")
            .style('fill', 'black');

        wait_list_group.selectAll('.grid-image').remove();

        for (let d of delete_node_list) {
            images.push(d);
        }

        let img_grids_g = wait_list_group.selectAll(".grid-image")
            .data(images);

        let enters = img_grids_g.enter()
            .append("g")
            .attr("class", "grid-image")
            .attr("transform", "translate(0,0)");

        enters.append("rect")
            .attr("x", (d, i) => 10 + (i % 4) * 60 - 2)
            .attr("y", (d, i) => text_height + 10 + Math.floor(i / 4) * 60 - 2)
            .attr("width", 54)
            .attr("height", 54)
            .attr("stroke-width", 4)
            .attr("stroke", function (d) {
                if (d.label[iter] === -1) return color_unlabel;
                else return color_label[d.label[iter]];
            })
            .attr("fill-opacity", 0);

        enters.append("image")
            .attr("xlink:href", d => d.url)
            .attr("x", (d, i) => 10 + (i % 4) * 60)
            .attr("y", (d, i) => text_height + 10 + Math.floor(i / 4) * 60)
            .attr("width", 50)
            .attr("height", 50)
            .on("click", function (d, i) {
                d3.select('#id-' + d.id).attr("r", 5);
            });
    };

    that._apply_delete_and_update_label = function () {
        DataLoader.update_delete_and_change_label_notify(delete_node_list, update_label_list, focus_edge_id);
        delete_node_list = [];
        update_label_list = {};
        focus_edge_id = null;
        console.log("focus_edge_id = null");
        focus_edge_node = null;
        that._update_wait_list_group();
    };

    that._update = async function () {
        return new Promise(function (resolve, reject) {
            nodes_in_group
                .attr("fill", function (d) {
                    if (show_ground_truth) {
                        if (d.truth === -1) return color_unlabel;
                        else return color_label[d.truth];
                    } else {
                        if (d.label[iter] === -1) return color_unlabel;
                        else return color_label[d.label[iter]];
                    }
                })
                .transition()
                .duration(AnimationDuration)
                .attr("cx", d => center_scale_x(d.x))
                .attr("cy", d => center_scale_y(d.y))
                .on("end", function () {
                    resolve();
                });

            golds_in_group
                .attr("fill", function (d) {
                    if (show_ground_truth) {
                        if (d.truth === -1) return color_unlabel;
                        else return color_label[d.truth];
                    } else {
                        if (d.label[iter] === -1) return color_unlabel;
                        else return color_label[d.label[iter]];
                    }
                })
                // .transition()
                // .duration(AnimationDuration)
                .attr("d", d => star_path(10 * zoom_scale, 4 * zoom_scale, center_scale_x(d.x), center_scale_y(d.y)));
            // let nodes_data = graph_data.nodes;
            // edges_in_group.attr("x1", d => center_scale_x(nodes_data[d["s"]].x))
            //         .attr("y1", d => center_scale_y(nodes_data[d["s"]].y))
            //         .attr("x2", d => center_scale_x(nodes_data[d["e"]].x))
            //         .attr("y2", d => center_scale_y(nodes_data[d["e"]].y))
            if((nodes_in_group.size()===0) && (golds_in_group.size() === 0)){
                console.log("no update");
                resolve();
            }
        })
    };

    that._remove = async function () {
        return new Promise(function (resolve, reject) {
           nodes_in_group.exit()
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", 0)
                .remove();
            // edges_in_group.exit().remove();
            golds_in_group.exit()
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", 0)
                .remove()
                .on("end", function () {
                    resolve();
                });
            if((nodes_in_group.exit().size()===0) && (golds_in_group.exit().size() === 0)){
                console.log("no remove");
                resolve();
            }
        });
    };

    that._update_view = async function (rescale, state) {
        return new Promise(async function (resolve, reject) {
            // add svg defs
            that._add_marker();
            //change coordinates
            that._center_tsne(rescale);


            // for debug shouxing ===========================================
            // svg = container.select("#graph-view-svg");
            // width = $('#graph-view-svg').width();
            // height = $('#graph-view-svg').height();
            // main_group.selectAll('rect').remove();
            // main_group.append('rect')
            //     .attr('id', 'debug-shouxing')
            //     .attr('x', 0)
            //     .attr('y', 0)
            //     .attr('width', width)
            //     .attr('height', height)
            //     .style('fill', 'gray')
            //     .style('opacity', 0.3);
            // =============================================================

            let nodes = Object.values(graph_data.nodes);
            // let edges = that._edge_reformulation(graph_data.edges);
            let golds = nodes.filter(d => d.label[0] > -1);
            // let links_data = graph_data.edges;
            width = $('#graph-view-svg').width();
            height = $('#graph-view-svg').height();

            nodes_in_group = nodes_group.selectAll("circle")
                .data(nodes, d => d.id);
            golds_in_group = golds_group.selectAll("path")
                .data(golds, d => d.id);
            //update view
            console.log("remove");
            await that._remove();
            if(state.fisheye !== undefined){
                await that._update_transform(state.area);
            }
            console.log("update");
            await that._update();
            console.log("create");
            await that._create();

            // remove lasso
            nodes_in_group = nodes_group.selectAll("circle");
            svg.select(".lasso").remove();
            lasso.items(nodes_in_group)
                .targetArea(svg)
                .on("start", that.lasso_start)
                .on("draw", that.lasso_draw)
                .on("end", that.lasso_end);
            svg.call(lasso);
            resolve();
        });

    };

    that._update_click_menu = function () {
        d3.selectAll(".iw-curMenu").remove();

        // $.post('/graph/GetLabels', {}, function (d) {
        let menu = [];
        label_names.forEach(function(d, i){
            var sm = {
                    title:d,
                    name:d,
                    color: color_label[i],
                    className: "iw-mnotSelected label-menu-item",
                    fun:function(){
                        if (lasso_result.indexOf(focus_node_id) !== -1) {
                            for (let id in lasso_result) {
                                update_label_list[lasso_result[id]] = i;
                            }
                            for (let id of lasso_result) {
                                nodes_group.selectAll(`#id-${id}`).style("fill", color_label[i]);
                            }
                        }
                        else {
                            lasso_result = [];
                            update_label_list[focus_node_id] = i;
                            nodes_group.selectAll(`#id-${focus_node_id}`).style("fill", color_label[i]);
                        }

                        that._apply_delete_and_update_label();
                        that._update_wait_list_group();
                        console.log(update_label_list);
                        focus_node_change_switch = true;
                        focus_edge_change_switch = true;
                    }
                };
                menu.push(sm);
            });
        menu.push({
            title: 'Delete',
            name: 'Delete',
            color: '',
            className: "iw-mnotSelected delete-menu-item",
            fun: function () {
                if (lasso_result.indexOf(focus_node_id) !== -1) {
                    for (let _ind of lasso_result) {
                        delete_node_list.push({
                            url: DataLoader.image_url + "?filename=" + _ind + ".jpg",
                            id: _ind,
                            label: d3.select('#id-' + _ind).datum().label
                        });
                    }
                    for (let id of lasso_result) {
                        delete graph_data.nodes[id];
                        nodes_group.selectAll(`#id-${id}`).style("display", "none");
                    }
                    that._update_wait_list_group();
                    console.log(delete_node_list);
                }
                else {
                    delete_node_list.push({
                            url: DataLoader.image_url + "?filename=" + focus_node_id + ".jpg",
                            id: focus_node_id,
                            label: d3.select('#id-' + focus_node_id).datum().label
                        });
                    that._update_wait_list_group();
                    delete graph_data.nodes[focus_node_id];
                    nodes_group.selectAll(`#id-${focus_node_id}`).style("display", "none");
                }
                focus_node_change_switch = true;
                focus_edge_change_switch = true;
            }
        });

        click_node_menu = menu;
        if (menu.length > 0) {
            $('#graph-view-tsne-point').contextMenu(click_node_menu, click_menu_settings);
        }

        // });
        menu = [];
        menu.push({
            title: 'Delete',
            name: 'Delete',
            color: '',
            className: "iw-mnotSelected delete-menu-item",
            fun: function () {
                d3.select(focus_edge_node).style("display", "none");
                that._apply_delete_and_update_label();
                that._update_wait_list_group();
                focus_node_change_switch = true;
                focus_edge_change_switch = true;
            }
        });
        click_edge_menu = menu;
        if (menu.length > 0) {
            $('#graph-view-link-g').contextMenu(click_edge_menu, click_menu_settings);
        }
    };

    that.init = function () {
        that._init();
    }.call();

    that.context_menu = function (e) {
        e.preventDefault();
        if (focus_node_id !== null || focus_edge_id != null) {
            focus_node_change_switch = false;
            focus_edge_change_switch = false;
        }
    };

    that.change_show_mode = function (mode) {
        if (mode === "truth")
            show_ground_truth = true;
        else if (mode === "iter")
            show_ground_truth = false;
        svg.select("#graph-view-tsne-point")
            .selectAll("circle")
            .attr("fill", function (d) {
                if (show_ground_truth) {
                    if (d.truth === -1) return color_unlabel;
                    else return color_label[d.truth];
                } else {
                    if (d.label[iter] === -1) return color_unlabel;
                    else return color_label[d.label[iter]];
                }
            });
    };

    that.change_edge_show_mode = function (mode) {

    };

    that._update_delete_node_list = function () {
        for (let item of delete_node_list) {
            delete graph_data.nodes[item["id"]];
            nodes_group.selectAll(`#id-${item["id"]}`).style("display", "none");
        }
    };

    that._draw_score_pie_chart = function (focus_nodes_id) {
        svg.select("#score-pie-chart-g").remove();
        let pie = d3.pie().value(d => d);
        let arc = d3.arc().outerRadius(11 * zoom_scale).innerRadius(7 * zoom_scale);
        let pie_chart_data = focus_nodes_id.map(d => graph_data.nodes[d]);
        let score_pie_chart_g = main_group.append("g").attr("id", "score-pie-chart-g");
        for(let data of pie_chart_data){
            let one_pie_chart = score_pie_chart_g.append("g")
                .attr("id", "one-score-pie-chart-g")
                .attr("transform", "translate("+center_scale_x(data.x)+","+center_scale_y(data.y)+")");
            one_pie_chart.selectAll("path")
                .data(pie(data.score[iter]))
                .enter()
                .append("path")
                .attr("d", arc)
                .attr("fill", (d,i) => color_label[i])
                .attr("opacity", 0)
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", 1);

        }
    };

    that._draw_uncertain_pie_chart = function (opacity) {
        svg.select("#uncertain-pie-chart-g").remove();
        let pie = d3.pie().value(d => d);
        let arc = d3.arc().outerRadius(11 * zoom_scale).innerRadius(7 * zoom_scale);
        let pie_chart_data = [];
        for(let uncertain_id of uncertain_nodes){
            if(graph_data.nodes[uncertain_id] !== undefined){
                pie_chart_data.push(graph_data.nodes[uncertain_id]);
            }
        }
        console.log("uncertain nodes number:", pie_chart_data.length);
        let score_pie_chart_g = main_group.append("g").attr("id", "uncertain-pie-chart-g");
        for(let data of pie_chart_data){
            let one_pie_chart = score_pie_chart_g.append("g")
                .attr("id", "one-uncertain-pie-chart-g")
                .attr("transform", "translate("+center_scale_x(data.x)+","+center_scale_y(data.y)+")");
            one_pie_chart.selectAll("path")
                .data(pie(data.score[data.score.length-1]))
                .enter()
                .append("path")
                .attr("d", arc)
                .attr("fill", (d,i) => color_label[i])
                .attr("opacity", opacity);

        }
    }
};

