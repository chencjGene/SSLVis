/*
* added by Changjian Chen, 20191015
* */

let GraphLayout = function (container){
    let that = this;
    that.container = container;

    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let layout_width = width - 20;
    let layout_height = height - 20;
    let color_unlabel = "#A9A9A9";
    let color_label = d3.schemeCategory10;
    color_label[7] = "#ffdb45";
    let btn_select_color = "#560731";
    let btn_unselect_color = "#ffffff";

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

    let main_group = null;
    let zoom_scale = 1;
    let old_transform = null;
    let current_level = 0;
    let drag_transform = null;
    let drag = null;
    let zoom = null;
    let if_lasso = false;

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
    let click_menu = null;
    let lasso_result = [];
    let delete_list = [];
    let update_label_list = [];
    let label_names = [];

    that._init = function(){
        svg = container.selectAll('#graph-view-svg')
            .attr("width", width)
            .attr("height", height);
        svg.attr("oncontextmenu", "DataLoader.graph_view.context_menu(evt)");
        main_group = svg.append('g').attr('id', 'main_group');

        zoom = d3.zoom()
                    .scaleExtent([0.6, 128])
            // .translateExtent([[-100, -100], [100, 100]])
                    .on('start', function () {
                        $('#graph-view-svg').contextMenu('close');
                    })
                    .on("zoom", zoomed)
                    .on("end", zoom_end);

        drag_transform = {'x': 0, 'y': 0};
        drag = d3.drag()
            .subject(function(d) {
                return {
                    x: d.x,
                    y: d.y
                };
            })
            .on("start", function(d){
                // it's important that we suppress the mouseover event on the node being dragged. Otherwise it will absorb the mouseover event and the underlying node will not detect it
                d3.select(this).attr( 'pointer-events', 'none' );
            })
            .on("drag", function(d) {
                drag_transform.x += d3.event.dx;
                drag_transform.y += d3.event.dy;
                main_group.attr("cx", function(e) {return e.x + drag_transform.x;})
                    .attr("cy", function(e) {return e.y + drag_transform.y;});
            })
            .on("end", function(d){
                // now restore the mouseover event or we won't be able to drag a 2nd time
                d3.select(this).attr( 'pointer-events', '' );
            });

        function zoomed() {
            zoom_scale = 1.0 / d3.event.transform.k;
            main_group.attr("transform", d3.event.transform); // updated for d3 v4
            nodes_group.selectAll("circle").attr("r", 3.5 * zoom_scale);
            golds_group.selectAll("path").attr("d", d => star_path(10 * zoom_scale,4 * zoom_scale, center_scale_x(d.x), center_scale_y(d.y)));
            edges_group.selectAll("line").style('stroke-width', zoom_scale);
            main_group.select("#group-propagation").selectAll("polyline").style('stroke-width', 2.0 * zoom_scale);
            main_group.select("#single-propagate").selectAll("polyline").style('stroke-width', 2.0 * zoom_scale);
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
            $('#graph-view-svg').contextMenu('close');
        }

        function zoom_end() {
            zoom_scale = 1.0 / d3.event.transform.k;
            main_group.attr("transform", d3.event.transform); // updated for d3 v4
            nodes_group.selectAll("circle").attr("r", 3.5 * zoom_scale);
            golds_group.selectAll("path").attr("d", d => star_path(10 * zoom_scale,4 * zoom_scale, center_scale_x(d.x), center_scale_y(d.y)));
            edges_group.selectAll("line").style('stroke-width', zoom_scale);
            main_group.select("#group-propagation").selectAll("polyline").style('stroke-width', 2.0 * zoom_scale);
            main_group.select("#single-propagate").selectAll("polyline").style('stroke-width', 2.0 * zoom_scale);
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
                DataLoader.update_graph_notify(area, current_level);
            }
            old_transform = d3.event.transform;
        }

        svg.on("mousedown", function () {
            $('#graph-view-svg').contextMenu('close');
            svg.select("#group-propagation").remove();
            nodes_in_group.attr("opacity", 1);
            golds_in_group.attr("opacity", 1);
            // edges_in_group.attr("opacity", 0.4);

            svg.select("#single-propagate").remove();
            nodes_in_group.attr("opacity", 1);
            golds_in_group.attr("opacity", 1);
        });

        svg.on(".drag", null);
        svg.on(".dragend", null);
        svg.call(zoom);

        $("#lasso-btn").click(function () {
            that._change_lasso_mode();
        });

        edges_group = main_group.append("g").attr("id", "graph-view-link-g");
        nodes_group = main_group.append("g").attr("id", "graph-view-tsne-point");
        golds_group = main_group.append("g").attr("id", "golds-g");
        lasso_btn_path = d3.select("#lasso-btn").select("path");

        click_menu_settings = {
            'mouseClick': 'right',
            'triggerOn':'click'
        };

        that._update_click_menu();
        that._draw_labels_glyph();
    };

    that._draw_labels_glyph = function(){
        let glyph_svg = d3.select("#label-glyph-svg");
        glyph_svg.append("path")
            .attr("d", star_path(10, 4, 10+20, 10+20))
            .attr("fill-opacity", 0)
            .attr("stroke-width", 1)
            .attr("stroke", "black");

        glyph_svg.append("circle")
            .attr("cx", 10+140)
            .attr("cy", 10+20)
            .attr("r", 5)
            .attr("fill-opacity", 0)
            .attr("stroke-width", 1)
            .attr("stroke", "black");

        glyph_svg.append("text")
            .attr("x", 10+35)
            .attr("y", 10+23)
            .attr("text-anchor", "start")
            .attr("font-size", 13)
            .attr("fill", "#969696")
            .text("labeled data");

        glyph_svg.append("text")
            .attr("x", 10+150)
            .attr("y", 10+23)
            .attr("text-anchor", "start")
            .attr("font-size", 13)
            .attr("fill", "#969696")
            .text("unlabeled data");
    };

    that.lasso_start = function() {
        lasso.items()
            .attr("r",3.5 * zoom_scale) // reset size
            .classed("not_possible",true)
            .classed("selected",false);

        svg.select("#group-propagation").remove();
        nodes_in_group.attr("opacity", 1);
                golds_in_group.attr("opacity", 1);
                // edges_in_group.attr("opacity", 0.4);

        svg.select("#single-propagate").remove();
                nodes_in_group.attr("opacity", 1);
                golds_in_group.attr("opacity", 1);
        $('#graph-view-svg').contextMenu('close');
    };

    that.lasso_draw = function() {
        // Style the possible dots
        lasso.possibleItems()
            .classed("not_possible",false)
            .classed("possible",true)
            .attr("r", 5 * zoom_scale);
        //
        // // Style the not possible dot
        lasso.notPossibleItems()
            .classed("not_possible",true)
            .classed("possible",false)
            .attr("r", 3.5 * zoom_scale);

    };

    that.lasso_end = function() {
        lasso.items()
            .classed("not_possible",false)
            .classed("possible",false);

        // Style the selected dots
        lasso.selectedItems()
            .classed("selected",true)
            .attr("r", 5 * zoom_scale);

        // Reset the style of the not selected dots
        lasso.notSelectedItems()
            .attr("r",3.5 * zoom_scale);

        let focus_node = lasso.selectedItems().data();
        let focus_node_ids = focus_node.map(d => d.id);
        lasso_result = focus_node_ids;
        if(focus_node.length===0){
            // console.log("No node need focus.");
            return
        }
        data_manager.update_image_view(lasso.selectedItems());
        console.log("focus nodes:", focus_node);

        let propagate_svg = main_group.insert("g", ":first-child").attr("id", "group-propagation");
        let path_keys = [];
        let path = [];
        let path_nodes = {};
        let new_nodes = [];
        function showpath(){
                nodes_in_group = nodes_group.selectAll("circle");
                golds_in_group = golds_group.selectAll("path");

                    // de-highlight
                nodes_in_group.attr("opacity", d => path_nodes[d.id]===true?1:0.2);
                golds_in_group.attr("opacity", d => path_nodes[d.id]===true?1:0.2);

                nodes_in_group.each(function (d) {
                    let node = d3.select(this);
                    if(path_nodes[d.id]===true){
                        path_nodes[d.id] = node;
                    }
                });
                console.log("Found paths:", path);
                propagate_svg
                    .append("g")
                    .attr("class", "single-propagate")
                    .selectAll("polyline")
                    .data(path)
                    .enter()
                    .append("polyline")
                    .attr("stroke-width", 2.0 * zoom_scale)
                    .attr("stroke", d => color_label[d[2]])
                    .attr("opacity", 1)
                    .attr("marker-mid", d => "url(#arrow-"+d[2]+")")
                    .attr("fill", "none")
                    .attr("points", function (d) {
                        let begin = [parseFloat(path_nodes[d[1]].attr("cx")), parseFloat(path_nodes[d[1]].attr("cy"))];
                        let end = [parseFloat(path_nodes[d[0]].attr("cx")), parseFloat(path_nodes[d[0]].attr("cy"))];
                        let mid = [(begin[0]+end[0])/2, (begin[1]+end[1])/2];
                        return begin[0]+","+begin[1]+" "+mid[0]+","+mid[1]+" "+end[0]+","+end[1];
                    });
        }
        for(let d of focus_node){
                if(d.label[iter] === -1 || d.label[0] !== -1) return;
                console.log("Node:", d);
                let eid = d.id;
                let predict_label = d.label[iter];
                for(let onepath of d.path[iter]){
                    if(onepath.length === 1) continue;
                    for(let i=0; i<onepath.length-1; i++){
                        let s = onepath[i];
                        let e = onepath[i+1];
                        let key = s+","+e;
                        if(path_keys.indexOf(key) === -1){
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
        for(let node_id in path_nodes){
            if(graph_data.nodes[node_id] === undefined) new_nodes.push(parseInt(node_id))
        }
        let all_nodes = Object.keys(graph_data.nodes).concat(new_nodes).map(d => parseInt(d));
        data_manager.update_fisheye_graph_node(all_nodes, showpath);
    };

    that._change_lasso_mode = function() {
        if(if_lasso){
            if_lasso = false;
            $("#lasso-btn").css("background-color", btn_unselect_color);
            lasso_btn_path.attr("stroke", "black").attr("fill", "black");
            svg.on("mousedown", function () {
                svg.select("#group-propagation").remove();
                nodes_in_group.attr("opacity", 1);
                        golds_in_group.attr("opacity", 1);
                        // edges_in_group.attr("opacity", 0.4);

                svg.select("#single-propagate").remove();
                    nodes_in_group.attr("opacity", 1);
                    golds_in_group.attr("opacity", 1);
                });
                svg.on(".drag", null);
                svg.on(".dragend", null);
                svg.call(zoom);
                svg.selectAll('.lasso').remove();
        }
        else {
            if_lasso = true;
            $("#lasso-btn").css("background-color", btn_select_color);
            lasso_btn_path.attr("stroke", "white").attr("fill", "white");
            svg.on('.zoom', null);
            svg.select(".lasso").remove();
            svg.call(lasso);
        }
    };

    that.set_data_manager = function(_data_manager){
        data_manager = _data_manager;
    };

    that.component_update = function(state, rescale){
        console.log("graph component update");
        that._update_data(state);
        that._update_view(rescale);
    };

    that._update_data = function(state){
        graph_data = state.graph_data;
        console.log("graph_data", graph_data);
        that._draw_legend();
    };

    that._draw_legend = function() {
        $.post('/graph/GetLabels', {}, function (d) {
                let labels = d;
                labels.unshift("unlabel");
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
                let text_width = 40;
                let x_item_num = Math.floor((legend_width-padding*2)/(rect_width+text_width+delta+text_delta));
                let y_item_num = Math.ceil(label_num/x_item_num);
                let legend_height = y_item_num*(rect_height+delta)-rect_height+padding*2;
                legend_svg.attr("height", legend_height);
                for(let i=0; i<label_num; i++){
                    legend_area.append("rect")
                        .attr("x", padding + (i%x_item_num)*(rect_width+text_width+delta+text_delta))
                        .attr("y", padding + Math.floor(i/x_item_num)*(rect_height+delta))
                        .attr("width", rect_width)
                        .attr("height", rect_height)
                        .attr("fill", function () {
                            if(i===0) return color_unlabel;
                            else return color_label[i-1];
                        });
                    legend_area.append("text")
                        .attr("x", padding + (i%x_item_num)*(rect_width+text_width+delta+text_delta)+rect_width+text_delta)
                        .attr("y", padding + Math.floor(i/x_item_num)*(rect_height+delta)+14)
                        .attr("text-anchor", "start")
                        .attr("font-size", "13")
                        .attr("fill", "#969696")
                        .text(function () {
                            return labels[i]
                        })
                }
        })
    };

    that.setIter = function(newiter) {
        iter = newiter;
        that._update_view(false);
    };

    that._center_tsne = function centering(rescale){
            let nodes = Object.values(graph_data.nodes);
            if (rescale) {
                let xRange = d3.extent(nodes, function(d){return d.x});
                var yRange = d3.extent(nodes, function(d){return d.y});
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
                center_scale_x = d3.scaleLinear().domain(xRange).range([(width - x_width)  / 2, (width + x_width)  / 2]);
                center_scale_y = d3.scaleLinear().domain(yRange).range([(height - y_height)  / 2, (height + y_height)  / 2]);
                center_scale_x_reverse = d3.scaleLinear().domain([(width - x_width)  / 2, (width + x_width)  / 2]).range(xRange);
                center_scale_y_reverse = d3.scaleLinear().domain([(height - y_height)  / 2, (height + y_height)  / 2]).range(yRange);
            }
            // for(let node of nodes){
            //     node.x = center_scale_x(node.x);
            //     node.y = center_scale_y(node.y);
            // }
        };

    that._edge_reformulation = function(edges) {
        let new_edges = {};
        for(let edge of edges){
            if(new_edges[edge.s] === undefined){
                 new_edges[edge.s] = {
                     s:[],
                     e:[]
                 };
            }
            if(new_edges[edge.e] === undefined){
                 new_edges[edge.e] = {
                     s:[],
                     e:[]
                 };
            }
            new_edges[edge.s].s.push(edge.e);
            new_edges[edge.e].e.push(edge.s);
        }
        return new_edges
    };

    that._add_marker = function() {
        if($("#markers marker").length !== 0) return;
        svg = container.select("#graph-view-svg");
        for(let i=0; i < color_label.length; i++){
            let color = color_label[i];
            svg.select("#markers").append("marker")
                .attr("id", "arrow-"+i)
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
                .attr("stroke-width", 1)
        }
    };

    that._create = function() {
        svg = container.select("#graph-view-svg");
        let nodes = Object.values(graph_data.nodes);
        // let edges = that._edge_reformulation(graph_data.edges);
        let golds = nodes.filter(d => d.label[0]>-1);
        // let links_data = graph_data.edges;
        let nodes_data = graph_data.nodes;
        width = $('#graph-view-svg').width();
        height = $('#graph-view-svg').height();

        nodes_in_group = nodes_group.selectAll("circle")
            .data(nodes, d => d.id);
        nodes_in_group.enter()
            .append("circle")
            .attr("id", d => "id-" + d.id)
            .attr("cx", d => center_scale_x(d.x))
            .attr("cy", d => center_scale_y(d.y))
            .attr("r", 3.5 * zoom_scale)
            .attr("opacity", 1)
            .attr("fill", function (d) {
                if(show_ground_truth){
                    if(d.truth === -1) return color_unlabel;
                    else return color_label[d.truth];
                }
                else {
                    if(d.label[iter] === -1) return color_unlabel;
                    else return color_label[d.label[iter]];
                }
            })
            .on("mouseover", function (d) {
                let node = d3.select(this);
                node.attr("r", 5 * zoom_scale);
            })
            .on("mouseout", function (d) {
                let node = d3.select(this);
                node.attr("r", 3.5 * zoom_scale);
            })
            .on("click", function (d) {
                lasso_result = [d.id];
                let node = d3.select(this);
                // added by changjian, 20191226
                // showing image content
                data_manager.update_image_view(node);

                function showpath(){
                    nodes_in_group = nodes_group.selectAll("circle");
                    golds_in_group = golds_group.selectAll("path");
                    // de-highlight
                    nodes_in_group.attr("opacity", d => path_nodes[d.id]===true?1:0.2);
                    golds_in_group.attr("opacity", d => path_nodes[d.id]===true?1:0.2);

                    svg.select("#single-propagate").remove();
                    nodes_in_group.each(function (d) {
                        let node = d3.select(this);
                        if(path_nodes[d.id]===true){
                            path_nodes[d.id] = node;
                        }
                    });
                    console.log("Found paths:", path);
                    let single_node_propagate = main_group.insert("g", ":first-child")
                        .attr("id", "single-propagate")
                        .selectAll("polyline")
                        .data(path)
                        .enter()
                        .append("polyline")
                        .attr("stroke-width", 2 * zoom_scale)
                        .attr("stroke", color_label[predict_label])
                        .attr("opacity", 1)
                        .attr("marker-mid", "url(#arrow-"+predict_label+")")
                        .attr("fill", "none")
                        .attr("points", function (d) {
                            let begin = [parseFloat(path_nodes[d[1]].attr("cx")), parseFloat(path_nodes[d[1]].attr("cy"))];
                            let end = [parseFloat(path_nodes[d[0]].attr("cx")), parseFloat(path_nodes[d[0]].attr("cy"))];
                            let mid = [(begin[0]+end[0])/2, (begin[1]+end[1])/2];
                            return begin[0]+","+begin[1]+" "+mid[0]+","+mid[1]+" "+end[0]+","+end[1];
                    });
                }
                if(d.label[iter] === -1 || d.label[0] !== -1) return;
                console.log("Node:", d);
                let eid = d.id;
                let predict_label = d.label[iter];
                let path_keys = [];
                let path = [];
                let path_nodes = {};
                let new_nodes = [];
                for(let onepath of d.path[iter]){
                    if(onepath.length === 1) continue;
                    for(let i=0; i<onepath.length-1; i++){
                        let s = onepath[i];
                        let e = onepath[i+1];
                        let key = s+","+e;
                        if(path_keys.indexOf(key) === -1){
                            path_keys.push(key)
                        }
                    }
                }
                for(let path_key of path_keys){
                    let keys = path_key.split(",");
                    let e = parseInt(keys[0]);
                    let s = parseInt(keys[1]);
                    path_nodes[e] = true;
                    path_nodes[s] = true;
                    path.push([e, s]);
                }
                for(let node_id in path_nodes){
                    if(graph_data.nodes[node_id] === undefined) new_nodes.push(parseInt(node_id))
                }

                new_nodes = Object.keys(graph_data.nodes).concat(new_nodes).map(d => parseInt(d));
                data_manager.update_fisheye_graph_node(new_nodes, showpath);
            });

        golds_in_group = golds_group.selectAll("path")
                .data(golds);
        golds_in_group.enter()
                .append("path")
                .attr("id", d => "gold-" + d.id)
                .attr("d", d => star_path(10 * zoom_scale,4 * zoom_scale, center_scale_x(d.x), center_scale_y(d.y)))
                .attr("fill", function(d){
                    if(show_ground_truth){
                        if(d.truth === -1) return color_unlabel;
                        else return color_label[d.truth];
                    }
                    else {
                        if(d.label[iter] === -1) return color_unlabel;
                        else return color_label[d.label[iter]];
                    }
                })
                .on("mouseover", function (d) {
                    console.log("Label node id:", d.id)
                })
                .on("click", function (d) {
                    let eid = d.id;
                    let nodes = d3.select(this);
                    data_manager.update_image_view(nodes);
                });


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
    };

    that._update = function() {
        nodes_in_group.attr("cx", d => center_scale_x(d.x))
            .attr("cy", d => center_scale_y(d.y))
            .attr("fill", function (d) {
                if(show_ground_truth){
                    if(d.truth === -1) return color_unlabel;
                    else return color_label[d.truth];
                }
                else {
                    if(d.label[iter] === -1) return color_unlabel;
                    else return color_label[d.label[iter]];
                }
            });

        golds_in_group.attr("d", d => star_path(10 * zoom_scale,4 * zoom_scale, center_scale_x(d.x), center_scale_y(d.y)))
                .attr("fill", function(d){
                    if(show_ground_truth){
                        if(d.truth === -1) return color_unlabel;
                        else return color_label[d.truth];
                    }
                    else {
                        if(d.label[iter] === -1) return color_unlabel;
                        else return color_label[d.label[iter]];
                    }
                });

        // let nodes_data = graph_data.nodes;
        // edges_in_group.attr("x1", d => center_scale_x(nodes_data[d["s"]].x))
        //         .attr("y1", d => center_scale_y(nodes_data[d["s"]].y))
        //         .attr("x2", d => center_scale_x(nodes_data[d["e"]].x))
        //         .attr("y2", d => center_scale_y(nodes_data[d["e"]].y))
    };

    that._remove = function() {
        nodes_in_group.exit().remove();
        // edges_in_group.exit().remove();
        golds_in_group.exit().remove();
    };

    that._update_view = function(rescale){
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

        //update view
        that._create();
        that._update();
        that._remove();

        // remove lasso
        nodes_in_group = nodes_group.selectAll("circle");
        svg.select(".lasso").remove();
        lasso.items(nodes_in_group)
            .targetArea(svg)
            .on("start", that.lasso_start)
            .on("draw", that.lasso_draw)
            .on("end", that.lasso_end);
        svg.call(lasso);

    };

    that._update_click_menu = function(){
        if (label_names.length === 0) {
            $.post('/graph/GetLabels', {}, function (d) {
                    label_names = d;
                    let menu = [];
                    label_names.forEach(function(d, i){
                        var sm = {
                                title:d,
                                name:d,
                                color: color_label[i],
                                fun:function(){

                                }
                            };
                            menu.push(sm);
                        });
                    menu.push({
                        title: 'Delete',
                        name: 'Delete',
                        color: '',
                        fun: function () {

                        }
                    });

                    click_menu = menu;
                    if (menu.length > 0) {
                        $('#graph-view-svg').contextMenu(click_menu, click_menu_settings);
                    }

            });
        }
        else {
            let menu = [];
            label_names.forEach(function(d, i){
                var sm = {
                        title:d,
                        name:d,
                        color: color_label[i],
                        fun:function(){

                        }
                    };
                    menu.push(sm);
                });
            menu.push({
                title: 'Delete',
                name: 'Delete',
                color: '',
                fun: function () {

                }
            });

            click_menu = menu;
            if (menu.length > 0) {
                $('#graph-view-svg').contextMenu(click_menu, click_menu_settings);
            }
        }
    };

    that.init = function(){
        that._init();
    }.call();

    that.context_menu = function(e) {
        e.preventDefault();
    };

    that.change_show_mode = function(mode) {
        if(mode === "truth")
            show_ground_truth = true;
        else if(mode === "iter")
            show_ground_truth = false;
        svg.select("#graph-view-tsne-point")
            .selectAll("circle")
            .attr("fill", function (d) {
                if(show_ground_truth){
                    if(d.truth === -1) return color_unlabel;
                    else return color_label[d.truth];
                }
                else {
                    if(d.label[iter] === -1) return color_unlabel;
                    else return color_label[d.label[iter]];
                }
            });
    };

    that.change_edge_show_mode = function(mode) {

    };
};

