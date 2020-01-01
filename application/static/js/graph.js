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
    let graph_data = null;
    let data_manager = null;

    let svg = null;
    let edges_group = null;
    let nodes_group = null;
    let golds_group = null;
    let edges_in_group = null;
    let nodes_in_group = null;
    let golds_in_group = null;

    let main_group = null;
    let zoom_scale = 1;
    let drag_transform = null;
    let drag = null;
    let zoom = null;

    let lasso = d3.lasso()
        .closePathSelect(true)
        .closePathDistance(100);

    let iter = 0;

    let show_ground_truth = false;

    that._init = function(){
        svg = container.selectAll('#graph-view-svg')
            .attr("width", width)
            .attr("height", height);
        main_group = svg.append('g').attr('id', 'main_group');

        zoom = d3.zoom()
                    .scaleExtent([0.1, 10])
                    .on("zoom", zoomed);

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
        }

        d3.select("body").on('keydown',function(){
            if(d3.event.altKey){
                svg.on("mousedown", null);
                svg.on(".drag", null);
                svg.on(".dragend", null);
                svg.call(zoom);
            }
        }).on('keyup',function(){
            if (d3.event.keyCode == 18) {
                svg.on('.zoom', null);
                svg.call(lasso);
            }
        });
        edges_group = main_group.append("g").attr("id", "graph-view-link-g");
        nodes_group = main_group.append("g").attr("id", "graph-view-tsne-point");
        golds_group = main_group.append("g").attr("id", "golds-g");
    };

    that.lasso_start = function() {
        lasso.items()
            .attr("r",3.5) // reset size
            .classed("not_possible",true)
            .classed("selected",false);

        svg.select("#group-propagation").remove();
        nodes_in_group.attr("opacity", 1);
                golds_in_group.attr("opacity", 1);
                edges_in_group.attr("opacity", 0.4);
    };

    that.lasso_draw = function() {
        // Style the possible dots
        lasso.possibleItems()
            .classed("not_possible",false)
            .classed("possible",true);
        //
        // // Style the not possible dot
        lasso.notPossibleItems()
            .classed("not_possible",true)
            .classed("possible",false);

    };

    that.lasso_end = function() {
        lasso.items()
            .classed("not_possible",false)
            .classed("possible",false);

        // Style the selected dots
        lasso.selectedItems()
            .classed("selected",true)
            // .attr("r",7);

        // Reset the style of the not selected dots
        lasso.notSelectedItems()
            .attr("r",3.5);

        let focus_node = lasso.selectedItems().data();
        let focus_node_ids = focus_node.map(d => d.id);
        if(focus_node.length===0){
            // console.log("No node need focus.");
            return
        }
        data_manager.update_image_view(focus_node_ids);
        console.log("focus nodes:", focus_node);

        let propagate_svg = main_group.insert("g", ":first-child").attr("id", "group-propagation");
        let edges = that._edge_reformulation(graph_data.edges);
        for(let d of focus_node){
            if(d.label[iter] === -1 || d.label[0] !== -1) continue;
                let eid = d.id;
                let predict_label = d.label[d.label.length-1];
                let path_stack = [eid];
                let path_keys = [];
                function findpaths() {
                    if(path_stack.length===0) return;
                    let now_node = path_stack[path_stack.length-1];
                    if(graph_data.nodes[now_node].truth === predict_label){
                        for(let i=1; i<path_stack.length; i++){
                            let path_key = path_stack[i-1]+","+path_stack[i];
                            if(path_keys.indexOf(path_key) === -1){
                                path_keys.push(path_key)
                            }
                        }
                    }
                    if (edges[now_node] !== undefined){
                        for(let next_node of edges[now_node].e){
                            if(graph_data.nodes[next_node].label[iter] !== predict_label) continue;
                            if(path_stack.indexOf(next_node) !== -1) continue;
                            path_stack.push(next_node);
                            findpaths();
                        }
                    }
                    path_stack.pop();
                }
                findpaths();
                let path = [];
                let path_nodes = {};
                for(let path_key of path_keys){
                    let keys = path_key.split(",");
                    let e = parseInt(keys[0]);
                    let s = parseInt(keys[1]);
                    path_nodes[e] = true;
                    path_nodes[s] = true;
                    path.push([e, s]);
                }

                // de-highlight
                nodes_in_group.attr("opacity", d => path_nodes[d.id]===true?1:0.2);
                golds_in_group.attr("opacity", d => path_nodes[d.id]===true?1:0.2);
                svg.select("#single-propagate").remove();
                for(let line of path){
                    svg.select("#graph-view-link-g")
                            .selectAll("line")
                            .each(function (d) {
                                let tline = d3.select(this);
                                if(d.e === line[0] && d.s === line[1]){
                                    line.push(tline);
                                }
                                else {
                                    tline.attr("opacity", 0.2);
                                }
                            });
                }
                // console.log("find path", path);
                propagate_svg
                    .append("g")
                    .attr("class", "single-propagate")
                    .selectAll("polyline")
                    .data(path)
                    .enter()
                    .append("polyline")
                    .attr("stroke-width", 2)
                    .attr("stroke", color_label[predict_label])
                    .attr("opacity", 1)
                    .attr("marker-mid", "url(#arrow-"+predict_label+")")
                    .attr("fill", "none")
                    .attr("points", function (d) {
                        let begin = [Math.round(parseFloat(d[2].attr("x1")),2), Math.round(parseFloat(d[2].attr("y1")),2)];
                        let end = [Math.round(parseFloat(d[2].attr("x2")),2), Math.round(parseFloat(d[2].attr("y2")),2)];
                        let mid = [(begin[0]+end[0])/2, (begin[1]+end[1])/2];
                        return begin[0]+","+begin[1]+" "+mid[0]+","+mid[1]+" "+end[0]+","+end[1];
                    });
        }

    };

    that.set_data_manager = function(_data_manager){
        data_manager = _data_manager;
    };

    that.component_update = function(state){
        console.log("graph component update");
        that._update_data(state);
        that._update_view();
    };

    that._update_data = function(state){
        graph_data = state.graph_data;
        console.log("graph_data", graph_data);
        that._draw_legend();
    };

    that._draw_legend = function() {
        $.post('/graph/GetLabels', {}, function (d) {
                let labels = d;
                let label_num = labels.length;
                d3.select("#graph-legend-g").remove();
                let legend_area = d3.select("#graph-legend").append("g")
                    .attr("id", "graph-legend-g");
                let legend_start_x = 10;
                let legend_start_y = 10;
                let x_delta = 140;
                let legend_delta = 55;
                let rect_width = 45;
                let rect_height = 30;
                let text_start_x = legend_start_x+rect_width+5;
                let text_start_y = legend_start_y+20;
                let half = Math.floor(label_num/2);
                for(let i=-1; i<label_num; i++){
                    legend_area.append("rect")
                        .attr("x", function () {
                            if(i<0) return legend_start_x;
                            else return Math.floor(i/half)*x_delta+legend_start_x;
                        })
                        .attr("y", legend_start_y+(i%half+1)*legend_delta)
                        .attr("width", rect_width)
                        .attr("height", rect_height)
                        .attr("fill", function () {
                            if(i===-1) return color_unlabel;
                            else return color_label[i];
                        });
                    legend_area.append("text")
                        .attr("x", function () {
                            if(i<0) return text_start_x;
                            else return Math.floor(i/half)*x_delta+text_start_x;
                        })
                        .attr("y", text_start_y+(i%half+1)*legend_delta)
                        .attr("text-anchor", "start")
                        .attr("font-size", "17")
                        .text(function () {
                            if(i===-1) return "unlabel";
                            else return labels[i]
                        })
                }


        })
    };

    that.setIter = function(newiter) {
        iter = newiter;
        that._update_view();
    };

    that._center_tsne = function centering(){
            let avx = 0;
            let avy = 0;
            let scale = 10000;
            let nodes = Object.values(graph_data.nodes);
            let nodenum = nodes.length;
            width = $('#graph-view-svg').width();
            height = $('#graph-view-svg').height();
            for(let node of nodes){
                avx += node.x;
                avy += node.y;
            }
            avx /= nodenum;
            avy /= nodenum;
            let delx = width/2-avx;
            let dely = height/2 - avy;
            for (let node of nodes){
                node.x += delx;
                node.y += dely;
                let xscale = (width/2)/Math.abs(node.x-width/2);
                let yscale = (height/2)/Math.abs(node.y-height/2);
                scale = Math.min(scale, xscale, yscale);
            }
            scale *= 0.85;
            for(let node of nodes){
                node.x = width/2 + (node.x-width/2)*scale;
                node.y = height/2 + (node.y-height/2)*scale;
            }
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
                .attr("refX", 6)
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
        let edges = that._edge_reformulation(graph_data.edges);
        let golds = nodes.filter(d => d.label[0]>-1);
        let links_data = graph_data.edges;
        let nodes_data = graph_data.nodes;
        width = $('#graph-view-svg').width();
        height = $('#graph-view-svg').height();

        nodes_in_group = nodes_group.selectAll("circle")
            .data(nodes);
        nodes_in_group.enter()
            .append("circle")
            .attr("id", d => "id-" + d.id)
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", 4)
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
                if(d.label[iter] === -1 || d.label[0] !== -1) return;
                console.log("Node:", d);
                let eid = d.id;
                let predict_label = d.label[d.label.length-1];
                let path_stack = [eid];
                let path_keys = [];
                function findpaths() {
                    if(path_stack.length===0) return;
                    let now_node = path_stack[path_stack.length-1];
                    if(graph_data.nodes[now_node].truth === predict_label){
                        for(let i=1; i<path_stack.length; i++){
                            let path_key = path_stack[i-1]+","+path_stack[i];
                            if(path_keys.indexOf(path_key) === -1){
                                path_keys.push(path_key)
                            }
                        }
                    }
                    if (edges[now_node] !== undefined) {
                        for(let next_node of edges[now_node].e){
                            if(graph_data.nodes[next_node].label[iter] !== predict_label) continue;
                            if(path_stack.indexOf(next_node) !== -1) continue;
                            path_stack.push(next_node);
                            findpaths();
                        }
                    }
                    path_stack.pop();
                }
                findpaths();
                let path = [];
                let path_nodes = {};
                for(let path_key of path_keys){
                    let keys = path_key.split(",");
                    let e = parseInt(keys[0]);
                    let s = parseInt(keys[1]);
                    path_nodes[e] = true;
                    path_nodes[s] = true;
                    path.push([e, s]);
                }

                // de-highlight
                nodes_in_group.attr("opacity", d => path_nodes[d.id]===true?1:0.2);
                golds_in_group.attr("opacity", d => path_nodes[d.id]===true?1:0.2);

                svg.select("#single-propagate").remove();
                for(let line of path){
                    svg.select("#graph-view-link-g")
                            .selectAll("line")
                            .each(function (d) {
                                let tline = d3.select(this);
                                if(d.e === line[0] && d.s === line[1]){
                                    line.push(tline);
                                }
                                else {
                                    tline.attr("opacity", 0.2);
                                }
                            });
                }
                console.log("Found paths:", path);
                let single_node_propagate = main_group.insert("g", ":first-child")
                    .attr("id", "single-propagate")
                    .selectAll("polyline")
                    .data(path)
                    .enter()
                    .append("polyline")
                    .attr("stroke-width", 2)
                    .attr("stroke", color_label[predict_label])
                    .attr("opacity", 1)
                    .attr("marker-mid", "url(#arrow-"+predict_label+")")
                    .attr("fill", "none")
                    .attr("points", function (d) {
                        let begin = [Math.round(parseFloat(d[2].attr("x1")),2), Math.round(parseFloat(d[2].attr("y1")),2)];
                        let end = [Math.round(parseFloat(d[2].attr("x2")),2), Math.round(parseFloat(d[2].attr("y2")),2)];
                        let mid = [(begin[0]+end[0])/2, (begin[1]+end[1])/2];
                        return begin[0]+","+begin[1]+" "+mid[0]+","+mid[1]+" "+end[0]+","+end[1];
                    });

                // added by changjian, 20191226
                // showing image content
                data_manager.update_image_view(eid);
            })
            .on("mouseout", function (d) {
                svg.select("#single-propagate").remove();
                nodes_in_group.attr("opacity", 1);
                golds_in_group.attr("opacity", 1);
                edges_in_group.attr("opacity", 0.4);
            });

        golds_in_group = golds_group.selectAll("path")
                .data(golds);
        golds_in_group.enter()
                .append("path")
                .attr("id", d => "gold-" + d.id)
                .attr("d", d => star_path(10,4,d.x, d.y))
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
                });


        edges_in_group = edges_group.selectAll("line")
                .data(links_data);
        edges_in_group.enter()
                .append("line")
                .attr("x1", d => nodes_data[d["s"]].x)
                .attr("y1", d => nodes_data[d["s"]].y)
                .attr("x2", d => nodes_data[d["e"]].x)
                .attr("y2", d => nodes_data[d["e"]].y)
                .attr("stroke-width", 1)
                .attr("stroke", "gray")
                .attr("opacity", 0.4);

        // remove lasso
        svg.select(".lasso").remove();
        lasso.items(nodes_in_group)
            .targetArea(svg)
            .on("start", that.lasso_start)
            .on("draw", that.lasso_draw)
            .on("end", that.lasso_end);
        svg.call(lasso);
    };

    that._update = function() {
        nodes_in_group.attr("cx", d => d.x)
            .attr("cy", d => d.y)
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

        golds_in_group.attr("d", d => star_path(10,4,d.x, d.y))
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

        let nodes_data = graph_data.nodes;
        edges_in_group.attr("x1", d => nodes_data[d["s"]].x)
                .attr("y1", d => nodes_data[d["s"]].y)
                .attr("x2", d => nodes_data[d["e"]].x)
                .attr("y2", d => nodes_data[d["e"]].y)
    };

    that._remove = function() {
        nodes_in_group.exit().remove();
        edges_in_group.exit().remove();
        golds_in_group.exit().remove();
    };

    that._update_view = function(){
        // add svg defs
        that._add_marker();
        //change coordinates
        that._center_tsne();

        //update view
        that._create();
        that._update();
        that._remove();

    };

    that.init = function(){
        that._init();
    }.call();

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

