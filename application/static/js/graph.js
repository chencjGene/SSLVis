/*
* added by Changjian Chen, 20191015
* */

let GraphLayout = function (container) {
    let that = this;
    that.container = container;

    // data loader
    that.data_manager = null;

    // container const
    let bbox = that.container.node().getBoundingClientRect();
    that.width = bbox.width;
    that.height = bbox.height;
    let layout_width = that.width - 20;
    let layout_height = that.height - 20;
    that.zoom_scale = 1;
    let star_inner_r = 6;
    let star_outer_r = 15;
    let path_width_scale = 1.75;
    let path_begin_width = 2*path_width_scale;
    let path_end_width = 0;
    let path_mid_width = (path_begin_width+path_end_width)/2;
    let bundling_force_S = 0.02;
    let bundling_elect_scale = 6;

    // other consts
    let btn_select_color = "#560731";
    let color_unlabel = UnlabeledColor;
    let color_label = CategoryColor;
    let edge_color = UnlabeledColor;
    let AnimationDuration = 10;
    let create_ani = AnimationDuration;
    let update_ani = AnimationDuration;
    let remove_ani = AnimationDuration * 0.1;
    let pathGenerator = d3.line().curve(d3.curveCardinal.tension(0.5));
    let path_curve = 1;

    // draw containter
    let path_group = null;
    let nodes_group = null;
    let golds_group = null;
    let glyph_group = null;
    let path_in_group = null;
    let nodes_in_group = null;
    let golds_in_group = null;
    let glyph_in_group = null;
    let legend_group = null;
    let img_in_group = null;
    that.selection_group = null;
    that.snapshot_group = null;

    // meta data
    let nodes = {};
    that.linked_nodes = null;
    let nodes_in_this_level = [];
    let path = [];
    let path_nodes = {};
    let is_show_path = false;
    let highlights = [];
    let area = null;
    let rescale = false;
    let glyphs = [];
    let iter = -1;
    let visible_items = {};
    let aggregate = [];
    let rect_nodes = [];
    let imgs = [];

    //edit info
    let add_labeled_nodes = [];
    let add_labeled_label = [];
    let delete_edges = [];

    that.selection_box_id_count = 0;
    that.selection_box = [
        // {x:100, y:100, width:300, height:300}
    ];
    that.snapshot_edge = [];
    let edge_filter_threshold = 0;
    that.focus_nodes = [];
    that.multi_step_in = 2;
    that.multi_step_out = 1;
    let path_line = d3.line()
			.x(function(d){ return d.x; })
                        .y(function(d){ return d.y; })
                        .curve(d3.curveLinear);

    // from area to main group
    that.center_scale_x = null;
    that.center_scale_y = null;
    that.center_scale_x_reverse = null;
    that.center_scale_y_reverse = null;

    that.svg = null;
    that.main_group = null;

    // plugin
    let transform_plg = null;
    let highlight_plg = null;
    let if_lasso = false;

    that._init = function () {
        // container init
        that.svg = container.selectAll('#graph-view-svg')
            .attr("width", that.width)
            .attr("height", that.height);
        that.main_group = that.svg.append('g').attr('id', 'main_group');
        legend_group = that.main_group.append("g").attr("id", "legend-group-g");
        path_group = that.main_group.append("g").attr("id", "graph-path-g");
        nodes_group = that.main_group.append("g").attr("id", "graph-tsne-point-g");
        golds_group = that.main_group.append("g").attr("id", "graph-gold-g");
        glyph_group = that.main_group.append("g").attr("id", "graph-glyph-g");
        that.label_group = that.main_group.append("g").attr("id", "graph-label-g");
        that.selection_group = that.main_group.append("g").attr("id", "graph-selection-g");
        that.snapshot_group = that.svg.append("g").attr("id", "snapshot-group");
        that.width = $('#graph-view-svg').width();
        that.height = $('#graph-view-svg').height();

        // add marker to svg
        that._add_marker();

        //add plugin
        transform_plg = new GraphTransform(that);
        highlight_plg = new GraphHighlight(that);
        that.highlight_plg = highlight_plg;

        // init zoom
        transform_plg.set_zoom();
    };

    that.set_data_manager = function(new_data_manager) {
        that.data_manager = new_data_manager;
    };

    that.component_update = async function(state) {
        console.log("get graph state:", state);
        that._update_data(state);
        that.data_manager.update_image_view(highlights);
        await that._update_view();
    };

    that._update_data = function(state) {
        nodes_in_this_level = state.nodes;
        nodes = JSON.parse(JSON.stringify(nodes_in_this_level));
        nodes = Object.values(nodes);
        is_show_path = state.is_show_path;
        highlights = state.highlights;
        area = state.area;
        rescale = state.rescale;
        visible_items = state.visible_items;
        glyphs = state.glyphs;
        aggregate = state.aggregate;
        rect_nodes = state.rect_nodes;
        edge_filter_threshold = state.edge_filter_threshold;
        edge_type_range = state.edge_type_range;
        all_path = state.path;
        path = [];
        add_labeled_nodes = state.edit_state.labeled_idxs;
        add_labeled_label = state.edit_state.labels;
        delete_edges = state.edit_state.deleted_edges.map(d => d[0]+","+d[1]);

        
        for (let type of edge_type_range){
            let path_in_this_type = all_path[type]
                .filter(d => d[2] > edge_filter_threshold[0] && d[2] < edge_filter_threshold[1]);
            path = path.concat(path_in_this_type);
            // get in/out nodes
            if (type === "in" || type === "out"){
                nodes = nodes.concat(all_path[type + "_nodes"]);
                // highlights = highlights.concat(all_path[type + "_nodes"].map(d => d.id));
                highlights = highlights.concat([].concat.apply([], path_in_this_type.map(d => [d[0].id, d[1].id])));
            }
        }
        // add focus nodes
        nodes = nodes.concat(that.focus_nodes);
        nodes = delRepeatDictArr(nodes);
        highlights = highlights.delRepeat();

        if (that.focus_nodes.length === 1 && that.selection_box.length === 0){
            // get multiple connected path
            let new_path = get_multiple_connected_path(that.focus_nodes[0], that.data_manager.state.complete_graph,
                    that.multi_step_in, that.multi_step_out, edge_filter_threshold);
            path = path.concat(new_path);
            path = delRepeatPath(path);

            that.linked_nodes = [];
            path.forEach(d => {
                that.linked_nodes.push(d[0]);
                that.linked_nodes.push(d[1]);
            });
            that.linked_nodes = that.linked_nodes.concat(that.focus_nodes);
            that.linked_nodes = delRepeatDictArr(that.linked_nodes);
            nodes = nodes.concat(that.linked_nodes);
            nodes = delRepeatDictArr(nodes);
        }

        // }
        // glyphs
        // glyphs = that.get_top_k_uncertainty(nodes, 20);
        // // removed by Changjian for reducing visual clutter
        // for(let node_id of Object.keys(path_nodes).map(d => parseInt(d))){
        //     if(glyphs.indexOf(node_id) === -1) glyphs.push(node_id);
        // }

        //iter
        iter = Object.values(nodes)[0].label.length-1;
    };

    that.setIter = async function (newiter) {
        iter = newiter;
        await that._update_view(false);
    };

    // for debug
    that.set_path = function(){
        path = that.all_path["in"];
        console.log("path", path);
    };

    that._update_view = function() {
        return new Promise(async function (resolve, reject) {
            // rescale
            if(rescale) that._center_tsne(nodes);
            //
            // let nodes_ary = Object.values(nodes);
            let nodes_ary = nodes;
            let golds_ary = nodes_ary.filter(d => d.label[0] > -1 || add_labeled_nodes.indexOf(d.id) > -1);
            let glyphs_ary = nodes_ary.filter(d => glyphs.indexOf(d.id)>-1);
            let path_ary = path;

            let nodes_dict = {};
            for(let node of nodes){
                nodes_dict[node.id] = node;
            }
            for(let path of path_ary){
                let alabel = nodes_dict[path[0].id].label[iter];
                let blabel = nodes_dict[path[1].id].label[iter];
                path.edge_type = alabel+","+blabel;
            }
            let fbundling = d3.ForceEdgeBundling(bundling_force_S, bundling_elect_scale)
				.nodes(nodes_dict)
				.edges(path_ary.map(function (d) {
                    return {
				        "source":d[0].id,
                        "target":d[1].id,
                        "edge_type":d.edge_type
				    }
                }).filter(d => d.source !== d.target));
            let res = fbundling();
            for(let line of res){
                for(let path_node_id = 0; path_node_id < line.length; path_node_id++){
                    if(path_node_id === 0 || path_node_id === line.length-1){
                        let tmp = line[path_node_id];
                        line[path_node_id] = {};
                        line[path_node_id].x = tmp.x;
                        line[path_node_id].y = tmp.y;
                    }
                    line[path_node_id].x  = that.center_scale_x(line[path_node_id].x);
                    line[path_node_id].y  = that.center_scale_y(line[path_node_id].y);
                }
            }
            path_ary = path_ary.map((d,i) => d.concat([res[i]]));
            let ori_res = deepCopy(res);
            ori_res.forEach(d => {
                for(let i = 0; i < d.length; i++){
                    d[i].x = that.center_scale_x_reverse(d[i].x);
                    d[i].y = that.center_scale_y_reverse(d[i].y);
                }
            })
            path_ary = path_ary.map((d,i) => d.concat([ori_res[i]]));
            that.path_ary = path_ary;
            if (that.focus_nodes.length === 1 && that.selection_box.length === 0){
                imgs = label_layout(that.linked_nodes, path_ary, that.zoom_scale);
            }

            console.log("path_ary", path_ary);
            console.log("bundling res", path_ary);
            nodes_in_group = nodes_group.selectAll("circle")
                .data(nodes_ary, d => d.id);
            golds_in_group = golds_group.selectAll("path")
                .data(golds_ary, d => d.id);
            glyph_in_group = glyph_group.selectAll(".pie-chart")
                .data(glyphs_ary, d => d.id);
            path_in_group = path_group.selectAll("path")
                .data(path_ary, d => d[0].id+","+d[1].id);
            img_in_group = that.label_group.selectAll("image")
                .data(imgs, d => d.node.id);
                
            //
            // that.show_select_rect();
            console.log("remove");
            await that._remove();
            console.log("transform");
            await transform_plg._update_transform(area);
            console.log("update");
            await that._update();
            console.log("create");
            await that._create();
            console.log("create end");

            nodes_in_group = nodes_group.selectAll("circle");
            golds_in_group = golds_group.selectAll("path");
            glyph_in_group = glyph_group.selectAll(".pie-chart");
            path_in_group = path_group.selectAll("path");

            if(highlight_plg.if_lasso()){
                highlight_plg.set_lasso();
            }

            resolve();
        })
    };

    that._add_marker = function () {
        if ($("#markers marker").length !== 0) return;
        that.svg.select("#markers").append("marker")
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

    that._remove = function () {
        return new Promise(function (resolve, reject) {
            nodes_in_group.exit()
                .transition()
                .duration(remove_ani)
                .attr("opacity", 0)
                .remove()
               .on("end", resolve);

            golds_in_group.exit()
                .transition()
                .duration(remove_ani)
                .attr("opacity", 0)
                .remove()
                .on("end", resolve);

            glyph_in_group.exit()
                .transition()
                .duration(remove_ani)
                .attr("opacity", 0)
                .remove()
                .on("end", resolve);

            path_in_group.exit()
                .transition()
                .duration(remove_ani)
                .attr("opacity", 0)
                .remove()
                .on("end", resolve);

            img_in_group.exit()
                .transition()
                .duration(remove_ani)
                .attr("opacity", 0)
                .remove()
                .on("end", resolve);

            if((nodes_in_group.exit().size()===0) && (golds_in_group.exit().size() === 0)
                && (glyph_in_group.exit().size() === 0) && (path_in_group.exit().size() === 0)){
                console.log("no remove");
                resolve();
            }

        })
    };

    that._update = function () {
        return new Promise(function (resolve, reject) {
            nodes_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                })
                .attr("opacity", d => that.opacity(d.id))
                .attr("r", d => that.r(d.id))
                .attr("cx", d => that.center_scale_x(d.x))
                .attr("cy", d => that.center_scale_y(d.y))
                .on("end", resolve);

            golds_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("fill", function (d) {
                    let added_idx = add_labeled_nodes.indexOf(d.id);
                    if(added_idx > -1){
                        let label = add_labeled_label[added_idx];
                        return label===-1?color_unlabel:color_label[label];
                    }
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                })
                .attr("opacity", d => that.opacity(d.id))
                .attr("d", d => star_path(star_outer_r * that.zoom_scale, star_inner_r * that.zoom_scale, that.center_scale_x(d.x), that.center_scale_y(d.y)))
                .on("end", resolve);

            let pie = d3.pie().value(d => d);
            let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
            glyph_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("transform", d =>"translate("+that.center_scale_x(d.x)+","+that.center_scale_y(d.y)+")")
                .attr("opacity", d => that.opacity(d.id))
                .on("end", resolve);
            glyph_in_group.selectAll("path")
                .append("path")
                .attr("d", arc)
                .attr("fill", (d,i) => color_label[i]);

            path_in_group
                .attr("stroke-width", 2.0 * that.zoom_scale)
                .attr("fill", d => "url(#path"  + d[0].id + "-" + d[1].id + ")")
                .attr("stroke", "none")
                // .attr("marker-mid", d => "url(#arrow-gray)")
                // .attr("fill", "none")
                .transition()
                .duration(AnimationDuration)
                .attr("d", function (d) {
                    return bezier_tapered(d[3][0], d[3][1], d[3][2], path_begin_width * that.zoom_scale,
                        path_mid_width * that.zoom_scale, path_end_width * that.zoom_scale);
                    return "M{0} {1}, Q {2} {3}, {4} {5}".format(
                        d[3][0].x, d[3][0].y,
                        d[3][1].x, d[3][1].y,
                        d[3][2].x, d[3][2].y);
                    return path_line(d[3]);

                    let begin = [that.center_scale_x(d[0].x), that.center_scale_y(d[0].y)];
                    let end = [that.center_scale_x(d[1].x), that.center_scale_y(d[1].y)];
                    let begin_dict={x:begin[0], y:begin[1]};
                    let end_dict={x:end[0], y:end[1]};
                    // return variableWidthPath(begin_dict, end_dict, 8, 2);
                    let dis = Math.sqrt(Math.pow(begin[0]-end[0], 2) + Math.pow(begin[1]-end[1], 2));
                    let radius = dis*path_curve;
                    let mid = curve_mid(begin, end, radius);
                    let path = d3.path();
                    path.moveTo(begin[0], begin[1]);
                    path.arcTo(mid[0], mid[1], end[0], end[1], radius);
                    return path.toString();
                })
                .attr("opacity", d => that.opacity_path(d))
                .on("end", resolve);

            img_in_group
                .attr("x", function(d){
                    if (d.quad === 1 || d.quad === 2){
                        return that.center_scale_x(d.node.x) - d.w * that.scale * that.zoom_scale;
                    }
                    return that.center_scale_x(d.node.x);
                })
                .attr("y", function(d){
                    if (d.quad === 2 || d.quad === 3){
                        return that.center_scale_y(d.node.y) - d.h * that.scale * that.zoom_scale;
                    }
                    return that.center_scale_y(d.node.y);
                })
                .attr("width", d => d.w * that.scale * that.zoom_scale)
                .attr("height", d => d.h * that.scale * that.zoom_scale)


            if((nodes_in_group.size()===0) && (golds_in_group.size() === 0)
                && (glyph_in_group.size() === 0) &&(path_in_group.size() === 0)){
                console.log("no update");
                resolve();
            }
        })
    };

    that._create = function () {
        return new Promise(function (resolve, reject) {
            nodes_in_group.enter()
                .append("circle")
                .attr("id", d => "id-" + d.id)
                .attr("class", "node-dot")
                .attr("cx", d => that.center_scale_x(d.x))
                .attr("cy", d => that.center_scale_y(d.y))
                .attr("r", d => that.r(d.id))
                .attr("opacity", 0)
                .attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                })
                .on("mouseover", function (d) {
                    // check if hided
                    if(visible_items[d.id] === false) return;
                    if((path_nodes[d.id]!==undefined)){
                        return
                    }
                    let node = d3.select(this);
                    node.attr("r", 5 * that.zoom_scale);
                })
                .on("mouseout", function (d) {
                    // check if hided
                    if(visible_items[d.id] === false) return;
                    let node = d3.select(this);
                    node.attr("r", d => that.r(d.id));
                })
                .on("mousedown", function(d){
                    console.log("mousedown", d.id);
                    that.data_manager.update_edit_state(d.id, "instance");
                })
                .on("click", function (d) {
                    // check if hided
                    if(visible_items[d.id] === false) return;
                    //  that.highlight([d.id]);
                    // that.focus_nodes = [d];
                    // that.show_edges();
                    that.highlight([d.id]);
                })
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => that.opacity(d.id))
                .on("end", resolve);

            golds_in_group.enter()
                .append("path")
                .attr("id", d => "gold-" + d.id)
                .attr("d", d => star_path(star_outer_r * that.zoom_scale, star_inner_r * that.zoom_scale, that.center_scale_x(d.x), that.center_scale_y(d.y)))
                .attr("fill", function (d) {
                    let added_idx = add_labeled_nodes.indexOf(d.id);
                    if(added_idx > -1){
                        let label = add_labeled_label[added_idx];
                        return label===-1?color_unlabel:color_label[label];
                    }

                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                })
                .attr("stroke", "white")
                .attr("stroke-width", 1.5*that.zoom_scale)
                .attr("opacity", 0)
                .on("mouseover", function (d) {
                    // check if hided
                    if(visible_items[d.id] === false) return;
                    console.log("Label node id:", d.id)
                })
                .on("click", function (d) {
                    // check if hided
                    if(visible_items[d.id] === false) return;
                     that.highlight([d.id]);
                })
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => that.opacity(d.id))
                .on("end", resolve);

            let pie = d3.pie().value(d => d);
            let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
            glyph_in_group.enter()
                .append("g")
                .attr("class", "pie-chart")
                .each(function (d) {
                    let node = d3.select(this);
                    d.piechart = node;
                })
                .attr("transform", d =>"translate("+that.center_scale_x(d.x)+","+that.center_scale_y(d.y)+")")
                .attr("opacity", 0)
                .selectAll("path")
                .data(d => pie(d.score[iter]))
                .enter()
                .append("path")
                .attr("d", arc)
                .attr("fill", (d,i) => color_label[i]);
            glyph_in_group.enter()
                .selectAll("g")
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => that.opacity(d.id))
                .on("end", resolve);

            const gradient = path_in_group.enter()
                .append("linearGradient")
                .attr("gradientUnits", "userSpaceOnUse")
                .attr("id", d => "path" + d[0].id + "-" + d[1].id)
                .attr("x1", d => that.center_scale_x(d[0].x))
                .attr("y1", d => that.center_scale_y(d[0].y))
                .attr("x2", d => that.center_scale_x(d[1].x))
                .attr("y2", d => that.center_scale_y(d[1].y));
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d => d[0].label[iter]===-1?color_unlabel:color_label[d[0].label[iter]]);
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d => d[1].label[iter]===-1?color_unlabel:color_label[d[1].label[iter]]);

            path_in_group.enter()
                .append("path")
                .attr("class", "propagation-path")
                .attr("stroke-width", 2.0 * that.zoom_scale)
                .attr("stroke", "none")
                .attr("fill", d => "url(#path"  + d[0].id + "-" + d[1].id + ")")
                .attr("opacity", 0)
                // .attr("marker-mid", d => "url(#arrow-gray)")
                // .attr("fill", "none")
                .attr("d", function (d) {
                    return bezier_tapered(d[3][0], d[3][1], d[3][2], path_begin_width * that.zoom_scale,
                        path_mid_width * that.zoom_scale, path_end_width * that.zoom_scale);
                    return "M{0} {1}, Q {2} {3}, {4} {5}".format(
                        d[3][0].x, d[3][0].y,
                        d[3][1].x, d[3][1].y,
                        d[3][2].x, d[3][2].y);
                    return path_line(d[3])
                    let begin = [that.center_scale_x(d[0].x), that.center_scale_y(d[0].y)];
                    let end = [that.center_scale_x(d[1].x), that.center_scale_y(d[1].y)];
                    let begin_dict={x:begin[0], y:begin[1]};
                    let end_dict={x:end[0], y:end[1]};
                    // return variableWidthPath(begin_dict, end_dict, 8, 2);
                    let dis = Math.sqrt(Math.pow(begin[0]-end[0], 2) + Math.pow(begin[1]-end[1], 2));
                    let radius = dis*path_curve;
                    let mid = curve_mid(begin, end, radius);
                    let path = d3.path();
                    path.moveTo(begin[0], begin[1]);
                    path.arcTo(mid[0], mid[1], end[0], end[1], radius);
                    return path.toString();
                })
                .on("mouseover", function (d) {
                            console.log(d);
                            d3.select(this).attr("d", function (d) {
                                return bezier_tapered(d[3][0], d[3][1], d[3][2], path_begin_width * that.zoom_scale * 3,
                        path_mid_width * that.zoom_scale * 3, path_end_width * that.zoom_scale * 3);
                            });
                        })
                .on("mouseout", function (d) {
                        d3.select(this).attr("d", function (d) {
                                return bezier_tapered(d[3][0], d[3][1], d[3][2], path_begin_width * that.zoom_scale,
                        path_mid_width * that.zoom_scale, path_end_width * that.zoom_scale);
                            });
                    })
                .on("mousedown", function (d) {
                    console.log("mousedown", d);
                    that.data_manager.update_edit_state(d, "delete edge");
                })
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => that.opacity_path(d))
                .on("end", resolve);

            img_in_group.enter()
                .append("image")
                .attr("class", "label-image")
                .attr("xlink:href", d => d.url)
                .attr("x", function(d){
                    if (d.quad === 1 || d.quad === 2){
                        return that.center_scale_x(d.node.x)  - d.w * that.scale * that.zoom_scale;
                    }
                    return that.center_scale_x(d.node.x);
                })
                .attr("y", function(d){
                    if (d.quad === 2 || d.quad === 3){
                        return that.center_scale_y(d.node.y)  - d.h * that.scale * that.zoom_scale;
                    }
                    return that.center_scale_y(d.node.y);
                })
                .attr("width", d => d.h * that.scale * that.zoom_scale)
                .attr("height", d => d.h * that.scale * that.zoom_scale);

            if((nodes_in_group.enter().size() === 0) && (golds_in_group.enter().size() === 0)
                && (glyph_in_group.enter().size() === 0) &&(path_in_group.enter().size() === 0)){
                console.log("no create");
                resolve();
            }

        })
    };

    that.r = function(id) {
        if( highlights.indexOf(id) > -1){
            return 5 * that.zoom_scale;
        }
        return 3.5 * that.zoom_scale
        
    };

    that.opacity = function(id) {
        if(is_show_path){
            if( path_nodes[id] !== undefined){
                return 1;
            }
            else if(visible_items[id] === false){
                return 0;
            }
            return 0.0
        }
        else {
            if(highlights.length === 0){
                if(visible_items[id] === false){
                    return 0;
                }
                return 1
            }
            else {
                if(visible_items[id] === false){
                    return 0;
                }
                if(highlights.indexOf(id) === -1){
                    return 0.3
                }
                return 1
            }
        }
    };

    that.show_select_rect = function () {
        let min_x = 100000;
        let max_x = -100000;
        let min_y = 100000;
        let max_y = -100000;
        let rect_id = "path-select-rect";
        let rect = null;
        if(is_show_path){
            for(let node_id of rect_nodes){
                let node = nodes[node_id];
                min_x = Math.min(that.center_scale_x(node.x), min_x);
                min_y = Math.min(that.center_scale_y(node.y), min_y);
                max_x = Math.max(that.center_scale_x(node.x), max_x);
                max_y = Math.max(that.center_scale_y(node.y), max_y);
            }
            if(legend_group.select("#"+rect_id).size() === 0){
                rect = legend_group.append("rect").attr("id", rect_id);
            }
            let margin = 15 * that.zoom_scale;
            min_x-=margin;
            min_y-=margin;
            max_x+=margin;
            max_y+=margin;
            rect = legend_group.select("#"+rect_id);
            rect.attr("x", min_x)
                .attr("y", min_y)
                .attr("rx", 5)
                .attr("ry", 5)
                .attr("width", max_x-min_x)
                .attr("height", max_y-min_y)
                .attr("fill-opacity", 0)
                .attr("stroke-width", "2px")
                .attr("stroke", "rgb(127,127,127)")
                .attr("stroke-dasharray", 10)
                .attr("opacity", 0)
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", 1);
        }
        else {
            legend_group.select("#"+rect_id)
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", 0);
        }

    };

    that.opacity_path = function(path) {
        let key = path[0].id+","+path[1].id;
        // if deleted:
        if(delete_edges.indexOf(key) > -1){
            return 0
        }
        return 1;
    };

    that._center_tsne = function(nodes) {
        let nodes_ary = Object.values(nodes);
        let xRange = d3.extent(nodes_ary, function (d) {
                    return d.x
                });
        var yRange = d3.extent(nodes_ary, function (d) {
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
        that.scale = scale;
        let x_width = (xRange[1] - xRange[0]) * scale;
        let y_height = (yRange[1] - yRange[0]) * scale;
        that.center_scale_x = d3.scaleLinear().domain(xRange).range([(width - x_width) / 2, (width + x_width) / 2]);
        that.center_scale_y = d3.scaleLinear().domain(yRange).range([(height - y_height) / 2, (height + y_height) / 2]);
        that.center_scale_x_reverse = d3.scaleLinear().domain([(width - x_width) / 2, (width + x_width) / 2]).range(xRange);
        that.center_scale_y_reverse = d3.scaleLinear().domain([(height - y_height) / 2, (height + y_height) / 2]).range(yRange);
};

    that.update_zoom_scale = function(new_zoom_scale) {
        that.zoom_scale = new_zoom_scale;
    };

    that.maintain_size = function (transform_event, animation = false) {
        that.zoom_scale = 1.0 / transform_event.k;
        if(animation){
            nodes_in_group
            .transition()
            .duration(AnimationDuration)
            .attr("r", d => that.r(d.id));
        golds_in_group
            .transition()
            .duration(AnimationDuration)
            .attr("d", d => star_path(star_outer_r * that.zoom_scale, star_inner_r * that.zoom_scale, that.center_scale_x(d.x), that.center_scale_y(d.y)))
            .attr("stroke-width", 1.5*that.zoom_scale);
        path_in_group
            .transition()
            .duration(AnimationDuration)
            .attr("d", function (d) {
                return bezier_tapered(d[3][0], d[3][1], d[3][2], path_begin_width * that.zoom_scale,
                        path_mid_width * that.zoom_scale, path_end_width * that.zoom_scale);
                return "M{0} {1}, Q {2} {3}, {4} {5}".format(
                        d[3][0].x, d[3][0].y,
                        d[3][1].x, d[3][1].y,
                        d[3][2].x, d[3][2].y);
                return path_line(d[3]);
                let begin = [that.center_scale_x(d[0].x), that.center_scale_y(d[0].y)];
                    let end = [that.center_scale_x(d[1].x), that.center_scale_y(d[1].y)];
                    let begin_dict={x:begin[0], y:begin[1]};
                    let end_dict={x:end[0], y:end[1]};
                    // return variableWidthPath(begin_dict, end_dict, 8, 2);
                    let dis = Math.sqrt(Math.pow(begin[0]-end[0], 2) + Math.pow(begin[1]-end[1], 2));
                    let radius = dis*path_curve;
                    let mid = curve_mid(begin, end, radius);
                    let path = d3.path();
                    path.moveTo(begin[0], begin[1]);
                    path.arcTo(mid[0], mid[1], end[0], end[1], radius);
                    return path.toString();
            })
            .attr("stroke-width", 1.7 * that.zoom_scale);
        let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
        glyph_in_group.selectAll("path")
            .transition()
            .duration(AnimationDuration)
            .attr("d", arc);
        }
        else {
            nodes_in_group
            .attr("r", d => that.r(d.id));
        golds_in_group
            .attr("d", d => star_path(star_outer_r * that.zoom_scale, star_inner_r * that.zoom_scale, that.center_scale_x(d.x), that.center_scale_y(d.y)))
            .attr("stroke-width", 1.5*that.zoom_scale);
        path_in_group

            .attr("d", function (d) {
                return bezier_tapered(d[3][0], d[3][1], d[3][2], path_begin_width * that.zoom_scale,
                        path_mid_width * that.zoom_scale, path_end_width * that.zoom_scale);
                return "M{0} {1}, Q {2} {3}, {4} {5}".format(
                        d[3][0].x, d[3][0].y,
                        d[3][1].x, d[3][1].y,
                        d[3][2].x, d[3][2].y);
                return path_line(d[3]);
            let begin = [that.center_scale_x(d[0].x), that.center_scale_y(d[0].y)];
                    let end = [that.center_scale_x(d[1].x), that.center_scale_y(d[1].y)];
                    let begin_dict={x:begin[0], y:begin[1]};
                    let end_dict={x:end[0], y:end[1]};
                    // return variableWidthPath(begin_dict, end_dict, 8, 2);
                    let dis = Math.sqrt(Math.pow(begin[0]-end[0], 2) + Math.pow(begin[1]-end[1], 2));
                    let radius = dis*path_curve;
                    let mid = curve_mid(begin, end, radius);
                    let path = d3.path();
                    path.moveTo(begin[0], begin[1]);
                    path.arcTo(mid[0], mid[1], end[0], end[1], radius);
                    return path.toString();
            })
            .attr("stroke-width", 1.7 * that.zoom_scale);
        let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
        glyph_in_group.selectAll("path")
            .attr("d", arc);
        
        img_in_group
        .attr("x", function(d){
            if (d.quad === 1 || d.quad === 2){
                return that.center_scale_x(d.node.x) - d.w * that.scale * that.zoom_scale;
            }
            return that.center_scale_x(d.node.x);
        })
        .attr("y", function(d){
            if (d.quad === 2 || d.quad === 3){
                return that.center_scale_y(d.node.y) - d.h * that.scale * that.zoom_scale;
            }
            return that.center_scale_y(d.node.y);
        })
        .attr("width", d => d.w * that.scale * that.zoom_scale)
        .attr("height", d => d.h * that.scale * that.zoom_scale)
            // 
            that._update_selection_box();
        }

    };

    that.get_visible_items = function() {
        return visible_items;
    };

    that.get_nodes = function() {
        return nodes_in_this_level;
    };

    that.get_nodes_in_group = function() {
        return nodes_in_group;
    };

    that.lasso_or_zoom = function(mode) {
        if(mode === "lasso"){
            highlight_plg.remove_select_edge();
            transform_plg.remove_zoom();
            highlight_plg.set_lasso();
        }
        else if(mode === "zoom"){
            highlight_plg.remove_select_edge();
            highlight_plg.remove_lasso();
            transform_plg.set_zoom();
        }
        else if(mode === "edge-select"){
            transform_plg.remove_zoom();
            highlight_plg.remove_lasso();
            highlight_plg.set_select_edge();
        }
        else if (mode == "rect"){
            transform_plg.remove_zoom();
            highlight_plg.remove_lasso();
            highlight_plg.remove_select_edge();
            that.set_rect_selection();
        }
    };

    that.get_area = function(){
        return area;
    };

    that.fetch_points = function (select_ids, new_nodes, type = "highlight", data) {
        transform_plg.fetch_points(select_ids, new_nodes, type, data);
    };

    that.highlight = function(ids) {
        // highlight_plg.highlight(nodes, ids);
        that.focus_nodes = ids.map(d => DataLoader.state.complete_graph[d]);
        that.show_edges();
    };

    that.get_highlights = function() {
        return highlights;
    };

    that.get_is_show_path = function() {
        return is_show_path;
    };

    that.remove_all = async function() {
        nodes_in_group = nodes_group.selectAll("circle")
                .data([], d => d.id);
            golds_in_group = golds_group.selectAll("path")
                .data([], d => d.id);
            glyph_in_group = glyph_group.selectAll(".pie-chart")
                .data([], d => d.id);
            path_in_group = path_group.selectAll("path")
                .data([], d => d[0].id+","+d[1].id);
            img_in_group = that.label_group.selectAll("image")
                .data(imgs, d => d.id);
            await that._remove();
    };

    that.show_iter = function() {
        nodes_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                })
    };

    that.show_ground_truth = function() {
        nodes_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("fill", function (d) {
                    return d.truth===-1?color_unlabel:color_label[d.truth];
                })
    };

    that.mouse_on_image = function(id) {
        nodes_in_group.attr("r", d => d.id === id? 7*that.zoom_scale:that.r(d.id));
    };

    that.mouse_out_image = function() {
        nodes_in_group.attr("r", d => that.r(d.id));
    };

    that.get_level = function(){
        return transform_plg.get_level();
    };

    that.get_wh = function(){
        return that.width / that.height;
    };

    that.draw_aggregate = function(){

        // let clusters = {};
        // let mnodes = Object.values(nodes);
        // for(let i=0; i<mnodes.length; i++){
        //     let node = mnodes[i];
        //     let cluster_id = aggregate[i];
        //     if(clusters[cluster_id] === undefined){
        //         clusters[cluster_id] = [];
        //     }
        //     clusters[cluster_id].push(node.id);
        // }
        // clusters = Object.values(clusters);
        nodes_in_group.attr("fill", function (d, j) {
            return color_label[aggregate[d.id]];
        })
        // draw clusters
        // that.main_group.append("g").selectAll("polygon")
        //     .data(Object.values(clusters))
        //     .enter().append("polygon")
        //     .attr("points",function(d) {
        //         let convexhull = new ConvexHullGrahamScan();
        //         for(let node of d){
        //             convexhull.addPoint(node.x, node.y)
        //         }
        //         let hullPoints = convexhull.getHull();
        //         return hullPoints.map(function(d) {
        //             return [that.center_scale_x(d.x),that.center_scale_y(d.y)].join(",");
        //         }).join(" ");
        //     })
        //     .attr("fill-opacity", 0)
        //     .attr("stroke-width", 2)
        //     .attr("stroke", "rgb(127,127,127)");
    };

    that.get_transform = function() {
        return transform_plg.get_transform();
    };

    that.highlight_edges = function(edge_data) {
        let edge_keys = [];
        for(let edge of edge_data){
            let key = edge[0]+','+edge[1];
            edge_keys.push(key)
        }
        path_in_group.attr("stroke-width", function (d) {
            let key = d[0].id+","+d[1].id;
            if(edge_keys.indexOf(key) > -1){
                return 4.0 * that.zoom_scale
            }
            else return 2.0 * that.zoom_scale
        })
    };

    // debug
    that.update_path_width_scale = async function(scale) {
        path_width_scale = scale;
        path_begin_width = 2*path_width_scale;
        path_end_width = 0;
        path_mid_width = (path_begin_width+path_end_width)/2;
        await that._update_view()
    };

    that.update_bundling_S = async function(S) {
        bundling_force_S = S;
        await that._update_view();
    };

    that.update_bundling_elec = async function(elect) {
        bundling_elect_scale = elect;
        await that._update_view();
    };

    // that.get_area = function(){
    //     return transform_plg.get_area();
    // };

    that.init = function () {
        that._init();
    }.call();
};