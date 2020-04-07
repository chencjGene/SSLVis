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
    let path_end_width = 0.8;
    let path_mid_width = (path_begin_width+path_end_width)/2;
    let bundling_force_S = 0.02;
    let bundling_elect_scale = 6;
    let is_local_k = false;

    // other consts
    let btn_select_color = "#560731";
    let color_unlabel = UnlabeledColor;
    let color_label = CategoryColor;
    let edge_color = UnlabeledColor;
    let AnimationDuration = 300;
    let create_ani = AnimationDuration;
    let update_ani = AnimationDuration;
    let remove_ani = AnimationDuration * 0.1;
    let pathGenerator = d3.line().curve(d3.curveCardinal.tension(0.5));
    let path_curve = 1;
    let uncertainty_type = 4;
    let unccertainty_line_stroke_width = 2;
    let uncertainty_hat_fill = "rgb(127, 127, 127)";
    let uncertainty_glyph_radius = 9+4;
    let uncertainty_glyph_hat = 3;

    // draw containter
    let path_group = null;
    let nodes_group = null;
    let golds_group = null;
    let glyph_group = null;
    let gradient_group = null;
    let edge_summary_group = null;
    let path_in_group = null;
    let nodes_in_group = null;
    let golds_in_group = null;
    let glyph_in_group = null;
    let edge_summary_in_group = null;
    let legend_group = null;
    let img_in_group = null;
    let tmp_show_imgs = null;
    let gradient_in_group = null;
    that.selection_group = null;
    that.snapshot_group = null;
    that.vonoroi_group = null;
    that.vonoroi_in_group = null;

    // meta data
    let nodes = {};
    that.linked_nodes = [];
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
    that.vonoroi_data = {"edges": [], "cells": []};
    let nodes_dict = null;
    that.if_focus_selection_box = false;
    let re_focus_selection_box = false;
    let edges_summary = [];
    let show_voronoi = false;
    let outliers = {};


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
    that.multi_step_in = 0;
    that.multi_step_out = 0;
    that.step_count = [0, 0, [0]];
    let path_line = d3.line()
			.x(function(d){ return d.x; })
                        .y(function(d){ return d.y; })
                        .curve(d3.curveLinear);

    // from area to main group
    that.center_scale_x = null;
    that.center_scale_y = null;
    that.center_scale_x_reverse = null;
    that.center_scale_y_reverse = null;
    that.center_scale = null;

    that.svg = null;
    that.main_group = null;

    // plugin
    let transform_plg = null;
    let highlight_plg = null;
    let if_lasso = false;

    that.set_step_in = function(n){
        that.multi_step_in = n;
        that.data_manager.update_graph_view();
    }

    that.set_step_out = function(n){
        that.multi_step_out = n;
        that.data_manager.update_graph_view();
    }

    that._init = function () {
        // container init
        that.svg = container.selectAll('#graph-view-svg')
            .attr("width", that.width)
            .attr("height", that.height);
        that.main_group = that.svg.append('g').attr('id', 'main_group');
        gradient_group = that.main_group.append('defs').attr("id", "gradient-group");
        legend_group = that.main_group.append("g").attr("id", "legend-group-g");
        path_group = that.main_group.append("g").attr("id", "graph-path-g");
        nodes_group = that.main_group.append("g").attr("id", "graph-tsne-point-g");
        golds_group = that.main_group.append("g").attr("id", "graph-gold-g");
        glyph_group = that.main_group.append("g").attr("id", "graph-glyph-g");
        edge_summary_group = that.main_group.append("g").attr("id", "edge-summary-g");
        that.label_group = that.main_group.append("g").attr("id", "graph-label-g");
        that.selection_group = that.main_group.append("g").attr("id", "graph-selection-g");
        that.snapshot_group = that.svg.append("g").attr("id", "snapshot-group");
        that.vonoroi_group = that.main_group.append("g").attr("id", "vonoroi-group");
        tmp_show_imgs = that.main_group.append("g").attr("id", "tmp-graph-label-g");
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

        // init legend
        // that._draw_legend();
    };

    that._draw_legend = function() {
        let legend_group = that.svg.append("g").attr("id", "legend-group");
        // draw rect
        legend_group.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 350)
            .attr("height", 65)
            .attr("stroke", "none")
            .attr("fill", "white");
        legend_group.append("rect")
            .attr("x", 40)
            .attr("y", 15)
            .attr("width", 310)
            .attr("height", 30)
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("fill", "none");
        // draw tapered
        let tapered_group = legend_group.append("g").attr("id", "tapered-legend");
        let tapered_path = "M 50 25 Q 125 12.5, 200 29.5 L 200 30.5 Q 125 17.5, 50 35 Z";
        let arrow_path = "M 230 30 L 280 30 L 330 30 ";
        tapered_group.append("path")
            .attr("d", tapered_path)
            .attr("fill", "rgb(127, 127, 127)")
            .attr("stroke", "none");
        tapered_group.append("text")
            .attr("x", 210)
            .attr("y", 37)
            .attr("font-weight", 400)
            .attr("font-size", 20)
            .attr("text-anchor", "start")
            .text("=");
        tapered_group.append("path")
            .attr("d", arrow_path)
            .attr("marker-end", d => "url(#arrow-gray)")
            .attr("stroke", "rgb(127, 127, 127)")
            .attr("stroke-width", 2);


    };

    that.set_data_manager = function(new_data_manager) {
        that.data_manager = new_data_manager;
        that.svg.on("click", function () {
            if($("#select-edge-btn").css("background-color") === "rgba(0, 0, 0, 0)" || $("#select-edge-btn").css("background-color") === "rgb(255, 255, 255)"){
                // that.data_manager.highlight_nodes([]);
                console.log("click svg");
                that.highlight([]);
            }

        })
    };

    that.component_update = async function(state) {
        console.log("get graph state:", state);
        that._update_data(state);
        await that.data_manager.update_image_view(highlights);
        await that._update_view(state);
    };

    that._update_data = function(state) {
        nodes_in_this_level = state.nodes;
        outliers = state.outliers;
        nodes_dict = state.nodes;
        nodes = JSON.parse(JSON.stringify(nodes_in_this_level));
        nodes = Object.values(nodes);
        is_show_path = state.is_show_path;
        highlights = state.highlights;
        area = state.area;
        rescale = state.rescale;
        visible_items = state.visible_items;
        that.if_focus_selection_box = state.if_focus_selection_box;
        re_focus_selection_box = state.re_focus_selection_box;
        let old_glyphs = JSON.parse(JSON.stringify(glyphs));
        glyphs = state.glyphs;
        let old_tmp_glyphs = [];
        for(let glyph_id of glyphs){
            if(old_glyphs.indexOf(glyph_id) > -1){
                old_tmp_glyphs.push(glyph_id);
            }
        }
        old_glyphs = old_tmp_glyphs;
        aggregate = state.aggregate;
        rect_nodes = state.rect_nodes;
        edge_filter_threshold = state.edge_filter_threshold;
        that.edge_filter_threshold = edge_filter_threshold;
        edge_type_range = state.edge_type_range;
        all_path = state.path;
        path = [];
        add_labeled_nodes = state.edit_state.labeled_idxs;
        add_labeled_label = state.edit_state.labels;
        delete_edges = state.edit_state.deleted_edges.map(d => d[0]+","+d[1]);
        edges_summary = [];
        let label_cnt = state.label_names.length+1;
        if(that.if_focus_selection_box) {
            let graph = that.data_manager.state.complete_graph;
            for(let selection_box of that.selection_box){
                let summary = [];
                for(let i=0;i<label_cnt;i++) summary.push({in:0, out:0, idx:i});
                for(let node of selection_box.nodes){
                    for(let from_id of node.from){
                        summary[graph[from_id].label[iter]+1].in++;
                    }
                    for(let to_id of node.to){
                        summary[graph[to_id].label[iter]+1].out++;
                    }
                }
                let tmp = [];
                for(let item of summary){
                    if(item.in !== 0 || item.out!==0){
                        tmp.push(item)
                    }
                }
                summary = tmp;
                edges_summary.push(summary)
            }
        }


        // rescale
        if(rescale) that._center_tsne(nodes);

        
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

        that.step_count =highlights.length === 0 ? [0, 0, [0]] : get_step_count_statistic(highlights, that.data_manager.state.complete_graph);

        that.linked_nodes = [];
        imgs = [];
        if (that.focus_nodes.length === 1 && that.selection_box.length === 0){
            // get statistic
            that.step_count = get_multiple_connected_static(that.focus_nodes[0], that.data_manager.state.complete_graph,
                edge_filter_threshold);
            // get multiple connected path
            let new_path = get_multiple_connected_path(that.focus_nodes[0], that.data_manager.state.complete_graph,
                    that.multi_step_in, that.multi_step_out, edge_filter_threshold);
            path = path.concat(new_path);
            path = delRepeatPath(path);

            path.forEach(d => {
                that.linked_nodes.push(d[0]);
                that.linked_nodes.push(d[1]);
            });
            that.linked_nodes = that.linked_nodes.concat(that.focus_nodes);
            that.linked_nodes = delRepeatDictArr(that.linked_nodes);
            nodes = nodes.concat(that.linked_nodes);
            nodes = delRepeatDictArr(nodes);
        }
        else if (that.selection_box.length === 0){

        }

        
        highlights = highlights.concat(that.linked_nodes.map(d => d.id));
        highlights = highlights.delRepeat();

        // show path when no highlights
        if(highlights.length === 0){
            // path = [];
            // let golds = nodes.filter(d => d.label[0] > -1);
            // for(let gold_node of golds){
            //     let gold_node_cnt = 0;
            //     for(let i=0; i<gold_node.to.length; i++){
            //         let source_id = gold_node.id;
            //         let target_id = gold_node.to[i];
            //         let edge_weight = gold_node.to_weight[i];
            //         if(state.nodes[target_id] !== undefined && source_id !== target_id && edge_weight >= edge_filter_threshold[0] && edge_weight <= edge_filter_threshold[1]){
            //             let target = state.nodes[target_id];
            //             path.push([gold_node, target, edge_weight]);
            //             gold_node_cnt++;
            //         }
            //         if(gold_node_cnt === 2) break;
            //     }
            // }

            // let all_path = [];
            // for (let i = 0; i < nodes.length; i++){
            //     let from_list = nodes[i].from;
            //     let from_weight = nodes[i].from_weight;
            //     let to_list = nodes[i].to;
            //     let to_weight = nodes[i].to_weight;
            //     for (let j = 0; j < from_list.length; j++){
            //         if (nodes_dict[from_list[j]] != undefined){
            //             let path = [nodes_dict[from_list[j]], nodes[i], from_weight[j]];
            //             all_path.push(path);
            //         }
            //     }
            //     for (let j = 0; j < to_list.length; j++){
            //         if (nodes_dict[to_list[j]] != undefined){
            //             let path = [nodes[i], nodes_dict[to_list[j]], to_weight[j]];
            //             all_path.push(path);
            //         }
            //     }
            // }
            // path = delRepeatPath(all_path);
            // path = path.filter(d => d[2] > edge_filter_threshold[0] && d[2] < edge_filter_threshold[1]);
            // path = path.filter(d => d[0].label.slice(-1)[0] != d[1].label.slice(-1)[0]);
        }

        // remove path of length 0
        let tmp_path = [];
        for(let one_path of path){
            let source = one_path[0];
            let target = one_path[1];
            if((source.x !== target.x) || (source.y !== target.y)){
                tmp_path.push(one_path)
            }
        }
        path = tmp_path;

        // remove glyps not in highligth
        if(highlights.length > 0){
            glyphs = glyphs.filter(d => highlights.indexOf(d) > 0)
        }
        // remove glyphs overlap
        let tmp_glyphs = old_glyphs;
        for(let glyph_id of glyphs){
            let glyph_node = state.nodes[glyph_id];
            let source = {
                x: that.center_scale_x(glyph_node.x),
                y: that.center_scale_y(glyph_node.y)
            };
            let overlap = false;
            for(let remain_glyph_id of tmp_glyphs){
                let remain_glyph_node = state.nodes[remain_glyph_id];
                let target = {
                    x: that.center_scale_x(remain_glyph_node.x),
                    y: that.center_scale_y(remain_glyph_node.y)
                };
                let distance = that.get_distance(source, target);
                if(distance < (uncertainty_glyph_radius*2) * that.zoom_scale ){
                    overlap = true;
                    break;
                }
            }
            if(!overlap){
                tmp_glyphs.push(glyph_id);
            }
        }
        glyphs = tmp_glyphs;

        if(show_voronoi){
            let voronoi_nodes = nodes.filter(d => outliers[d.id] === undefined);
            that.vonoroi_data = that.cal_vonoroi(voronoi_nodes);
        }
        else {
            that.vonoroi_data = {
                edges:[],
                cells:[]
            }
        }

        // }
        // glyphs
        // glyphs = that.get_top_k_uncertainty(nodes, 20);
        // // removed by Changjian for reducing visual clutter
        // for(let node_id of Object.keys(path_nodes).map(d => parseInt(d))){
        //     if(glyphs.indexOf(node_id) === -1) glyphs.push(node_id);
        // }

        //iter
        iter = that.data_manager.iter;
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

    that._update_view = function(state) {
        return new Promise(async function (resolve, reject) {
            if(that.if_focus_selection_box && re_focus_selection_box){
                that._get_focus_selection_scale();
                nodes = JSON.parse(JSON.stringify(state.nodes));
                nodes = Object.values(nodes);
            }
            //
            // let nodes_ary = Object.values(nodes);
            let nodes_ary = nodes;
            let golds_ary = nodes_ary.filter(d => d.label[0] > -1 || add_labeled_nodes.indexOf(d.id) > -1);
            let glyphs_ary = nodes_ary.filter(d => glyphs.indexOf(d.id)>-1);
            let path_ary = path;

            let nodes_dict = {};
            for(let node of nodes){
                nodes_dict[node.id] = {
                    id:node.id,
                    x:that.if_focus_selection_box?node.focus_x:that.center_scale_x(node.x),
                    y:that.if_focus_selection_box?node.focus_y:that.center_scale_y(node.y),
                    label:node.label
                };
            }
            for(let path of path_ary){
                if(nodes_dict[path[0].id] === undefined || nodes_dict[path[1].id] === undefined) continue;
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
                }
            }
            path_ary = path_ary.map((d,i) => d.concat([res[i]]));
            let ori_res = deepCopy(res);
            ori_res.forEach(d => {
                for(let i = 0; i < d.length; i++){
                    d[i].x = that.center_scale_x_reverse(d[i].x);
                    d[i].y = that.center_scale_y_reverse(d[i].y);
                }
            });
            path_ary = path_ary.map((d,i) => d.concat([ori_res[i]]));
            that.path_ary = path_ary;
            if (that.focus_nodes.length === 1 && that.selection_box.length === 0){
                imgs = label_layout(that.linked_nodes, path_ary, that.zoom_scale);
            }
            else if (that.selection_box.length === 0){
                imgs = label_layout(that.focus_nodes, [], that.zoom_scale);
            }
            for(let path of path_ary){
                if(path[3] === undefined){
                    console.log("get")
                }
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
            that.vonoroi_in_group = that.vonoroi_group.selectAll("g.voronoi-cell")
                .data(that.vonoroi_data.cells, d => d.id);
            gradient_in_group = gradient_group.selectAll("linearGradient")
                .data(path_ary, d => d[0].id+","+d[1].id);
            edge_summary_in_group = edge_summary_group.selectAll(".edge-summary")
                .data(edges_summary);
                
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
            gradient_in_group = gradient_group.selectAll("linearGradient");
            edge_summary_in_group = edge_summary_group.selectAll(".edge-summary");

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
                .attr("d", "M-1,4 L3,2 L-1,0")
                .attr("stroke", "rgb(127,127,127)")
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
                .on("end", resolve)
                .remove();

            gradient_in_group.exit()
                .transition()
                .duration(remove_ani)
                .on("end", resolve)
                .remove();

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

            that.vonoroi_in_group.exit()
                .transition()
                .duration(remove_ani)
                .attr("opacity", 0)
                .remove()
                .on("end", resolve);

            edge_summary_in_group.exit()
                .transition()
                .duration(remove_ani)
                .attr("opacity", 0)
                .remove()
                .on("end", resolve);

            if((nodes_in_group.exit().size()===0) && (golds_in_group.exit().size() === 0)
                && (glyph_in_group.exit().size() === 0) && (path_in_group.exit().size() === 0)&&(edge_summary_in_group.exit().size() === 0)){
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
                .attr("cx", d => that.if_focus_selection_box?d.focus_x:that.center_scale_x(d.x))
                .attr("cy", d => that.if_focus_selection_box?d.focus_y:that.center_scale_y(d.y))
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
                .attr("d", d => star_path(star_outer_r * that.zoom_scale, star_inner_r * that.zoom_scale,
                    that.if_focus_selection_box?d.focus_x:that.center_scale_x(d.x), that.if_focus_selection_box?d.focus_y:that.center_scale_y(d.y)))
                .on("end", resolve);

            glyph_in_group
                // .transition()
                // .duration(AnimationDuration)
                .attr("transform", d =>"translate("+(that.if_focus_selection_box?d.focus_x:that.center_scale_x(d.x))+","+(that.if_focus_selection_box?d.focus_y:that.center_scale_y(d.y))+")")
                .attr("opacity", d => that.opacity(d.id))
                .on("end", resolve);
            that.uncertainty_glyph_update();

            gradient_in_group
                .attr("x1", d => that.if_focus_selection_box?d[0].focus_x:that.center_scale_x(d[0].x))
                .attr("y1", d => that.if_focus_selection_box?d[0].focus_y:that.center_scale_y(d[0].y))
                .attr("x2", d => that.if_focus_selection_box?d[1].focus_x:that.center_scale_x(d[1].x))
                .attr("y2", d => that.if_focus_selection_box?d[1].focus_y:that.center_scale_y(d[1].y))
                .each(function (d) {
                    let linearGradient = d3.select(this);
                    linearGradient.select(".stop-1")
                        .attr("stop-color", d[0].label[iter]===-1?color_unlabel:color_label[d[0].label[iter]]);
                    linearGradient.select(".stop-2")
                        .attr("stop-color", d[0].label[iter]===-1?color_unlabel:color_label[d[0].label[iter]]);
                    linearGradient.select(".stop-3")
                        .attr("stop-color", d[1].label[iter]===-1?color_unlabel:color_label[d[1].label[iter]]);
                    linearGradient.select(".stop-4")
                        .attr("stop-color", d[1].label[iter]===-1?color_unlabel:color_label[d[1].label[iter]]);
                });

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
                    return that.if_focus_selection_box?d.focus_x:that.center_scale_x(d.node.x);
                })
                .attr("y", function(d){
                    if (d.quad === 2 || d.quad === 3){
                        return that.center_scale_y(d.node.y) - d.h * that.scale * that.zoom_scale;
                    }
                    return that.if_focus_selection_box?d.focus_y:that.center_scale_y(d.node.y);
                })
                .attr("width", d => d.w * that.scale * that.zoom_scale)
                .attr("height", d => d.h * that.scale * that.zoom_scale);

            // that.vonoroi_in_group
            //     .selectAll(".voronoi-edge")
            //     .attr("d", d => that.get_cell_path(d, that.scale));

            that.vonoroi_in_group
                .selectAll(".voronoi-edge")
                .attr("d", d => that.get_skeleton_path(d, that.scale));
            // that.vonoroi_in_group
            //     .selectAll("circile")
            //     .attr("cx", d => that.center_scale_x(d.site.data[0]))
            //     .attr("cy", d => that.center_scale_y(d.site.data[1]));

            edge_summary_in_group
                .attr("transform", function (d, i) {
                    let class_cnt = d.length;
                    let bar_width = 8*that.zoom_scale;
                    let small_inner_bounder = 1.5*that.zoom_scale;
                    let large_inner_bounder = 3*that.zoom_scale;
                    let outer_bounder = 3*that.zoom_scale;
                    let chart_height = 50*that.zoom_scale;
                    let chart_width = bar_width*(2*class_cnt)+large_inner_bounder*(class_cnt-1)+small_inner_bounder*class_cnt+outer_bounder*2;
                    return "translate("+(that.selection_box[i].x+that.selection_box[i].width/2-chart_width/2)+","+(that.selection_box[i].y-chart_height)+")"
                })
                .each(function (d) {
                    let group = d3.select(this);
                    let class_cnt = d.length;
                    let bar_width = 8*that.zoom_scale;
                    let small_inner_bounder = 1.5*that.zoom_scale;
                    let large_inner_bounder = 3*that.zoom_scale;
                    let outer_bounder = 3*that.zoom_scale;
                    let chart_width = bar_width*(2*class_cnt)+large_inner_bounder*(class_cnt-1)+small_inner_bounder*class_cnt+outer_bounder*2;
                    let chart_height = 50*that.zoom_scale;
                    let max_num = 0;
                    group.select("line")
                        .attr("x1", 0)
                        .attr("y1", chart_height*0.8)
                        .attr("x2", chart_width)
                        .attr("y2", chart_height*0.8)
                        .attr("stroke-width", that.zoom_scale)
                        .attr("stroke", "black");
                    for(let i=0;i<d.length;i++){
                        max_num = Math.max(max_num, d[i].in, d[i].out);
                    }
                    for(let i=0; i<d.length; i++){
                        group.select("#edge-bar-in-"+i)
                            .attr("x", outer_bounder+(bar_width*2+small_inner_bounder+large_inner_bounder)*i)
                            .attr("y", chart_height*0.8-chart_height*0.7*d[i].in/max_num)
                            .attr("width", bar_width)
                            .attr("height", chart_height*0.7*d[i].in/max_num)
                            .attr("fill", d[i].idx===0?color_unlabel:color_label[d[i].idx-1]);
                        group.select("#edge-bar-out-"+i)
                            .attr("x", outer_bounder+(bar_width*2+small_inner_bounder+large_inner_bounder)*i+bar_width+small_inner_bounder)
                            .attr("y", chart_height*0.8-chart_height*0.7*d[i].out/max_num)
                            .attr("width", bar_width)
                            .attr("height", chart_height*0.7*d[i].out/max_num)
                            .attr("fill", d[i].idx===0?color_unlabel:color_label[d[i].idx-1]);
                    }
            });


            if((nodes_in_group.size()===0) && (golds_in_group.size() === 0)
                && (glyph_in_group.size() === 0) &&(path_in_group.size() === 0) && (edge_summary_in_group.size() === 0)){
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
                .attr("cursor", "default")
                .attr("class", "node-dot")
                .attr("cx", d => that.if_focus_selection_box?d.focus_x:that.center_scale_x(d.x))
                .attr("cy", d => that.if_focus_selection_box?d.focus_y:that.center_scale_y(d.y))
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
                    node.attr("r", (glyphs.indexOf(d.id)>-1?9:5) * that.zoom_scale);
                    return;
                    let source = {
                        x:that.center_scale_x(d.x),
                        y:that.center_scale_y(d.y)
                    };
                    // let overlap nodes disappear
                    // nodes_in_group.attr("opacity", function (dd) {
                    //     let target = {
                    //         x: that.center_scale_x(dd.x),
                    //         y: that.center_scale_y(dd.y)
                    //     };
                    //     if(dd.id !== d.id && (that.get_distance(source, target)*that.zoom_scale < 4)){
                    //         return 0
                    //     }
                    //     return that.opacity(dd)
                    // })
                    // let overlap nodes
                    let magnity = 5;
                    let max_r = 15;
                    nodes_in_group.each(function (dd) {
                        if(d.id === dd.id) return;

                        let target = {
                            x: that.center_scale_x(dd.x),
                            y: that.center_scale_y(dd.y)
                        };
                        let distance = that.get_distance(source, target);
                        if(distance*that.zoom_scale < max_r){
                            let target_node = d3.select(this);
                            let alpha = distance/max_r;
                            let scale = (magnity + 1) * alpha / (magnity * alpha + 1);
                            scale = Math.max(8 / max_r, scale);
                            if(dd.x === d.x || dd.y === d.y){
                                target.x += 0.1;
                                target.y += 0.1;
                            }
                            let new_x = source.x + scale * max_r * (target.x-source.x) / distance;
                            let new_y = source.y + scale * max_r * (target.y-source.y) / distance;
                            target_node
                                .transition()
                                .duration(500)
                                .attr("cx", new_x)
                                .attr("cy", new_y);
                        }
                    })

                })
                .on("mouseout", function (d) {
                    // check if hided
                    if(visible_items[d.id] === false) return;
                    let node = d3.select(this);
                    node.attr("r", d => that.r(d.id));
                    return;
                    nodes_in_group.transition()
                                .duration(500)
                                .attr("cx", d => that.center_scale_x(d.x))
                                .attr("cy", d => that.center_scale_y(d.y));
                })
                .on("mousedown", function(d){
                    let node = this;
                    console.log("mousedown", d.id);
                    that.data_manager.update_edit_state(d.id, "instance", node);
                })
                .on("click", function (d) {

                    // check if hided
                    d3.event.stopPropagation();
                    if(visible_items[d.id] === false) return;
                    if(is_local_k){
                        d3.event.stopPropagation();
                        let new_highlights = JSON.parse(JSON.stringify(highlights));
                        new_highlights.push(d.id);
                        that.data_manager.highlight_nodes(new_highlights);
                        return;
                    }
                    // that.data_manager.highlight_nodes([d.id]);
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
                .attr("cursor", "default")
                .attr("d", d => star_path(star_outer_r * that.zoom_scale, star_inner_r * that.zoom_scale,
                    that.if_focus_selection_box?d.focus_x:that.center_scale_x(d.x), that.if_focus_selection_box?d.focus_y:that.center_scale_y(d.y)))
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
                    d3.event.stopPropagation();
                    if(visible_items[d.id] === false) return;
                    if(is_local_k){
                        d3.event.stopPropagation();
                        let new_highlights = JSON.parse(JSON.stringify(highlights));
                        new_highlights.push(d.id);
                        that.data_manager.highlight_nodes(new_highlights);
                        return;
                    }
                    that.highlight([d.id]);
                })
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => that.opacity(d.id))
                .on("end", resolve);

            let pie = d3.pie().value(d => d);
            let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
            let glyphgs = glyph_in_group.enter()
                .append("g")
                .attr("class", "pie-chart")
                .each(function (d) {
                    let node = d3.select(this);
                    // d.piechart = node;
                })
                .attr("transform", d =>"translate("+(that.if_focus_selection_box?d.focus_x:that.center_scale_x(d.x))+","+(that.if_focus_selection_box?d.focus_y:that.center_scale_y(d.y))+")")
                .attr("opacity", 0);
            // glyphgs.selectAll("path")
            //     .data(d => pie(d.score[iter]))
            //     .enter()
            //     .append("path")
            //     .attr("class", "glyph-path")
            //     .attr("d", arc)
            //     .attr("fill", (d,i) => color_label[i]);

            that.uncertainty_glyph_create(glyphgs);

            glyphgs
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => that.opacity(d.id))
                .on("end", resolve);

            let gradient = gradient_in_group.enter()
                .append("linearGradient")
                .attr("gradientUnits", "userSpaceOnUse")
                .attr("id", d => "path" + d[0].id + "-" + d[1].id)
                .attr("x1", d => that.if_focus_selection_box?d[0].focus_x:that.center_scale_x(d[0].x))
                .attr("y1", d => that.if_focus_selection_box?d[0].focus_y:that.center_scale_y(d[0].y))
                .attr("x2", d => that.if_focus_selection_box?d[1].focus_x:that.center_scale_x(d[1].x))
                .attr("y2", d => that.if_focus_selection_box?d[1].focus_y:that.center_scale_y(d[1].y));
            gradient.append("stop")
                .attr("class", "stop-1")
                .attr("offset", "0%")
                .attr("stop-color", d => d[0].label[iter]===-1?color_unlabel:color_label[d[0].label[iter]]);
            gradient.append("stop")
                .attr("class", "stop-2")
                .attr("offset", "45%")
                .attr("stop-color", d => d[0].label[iter]===-1?color_unlabel:color_label[d[0].label[iter]]);
            gradient.append("stop")
                .attr("class", "stop-3")
                .attr("offset", "55%")
                .attr("stop-color", d => d[1].label[iter]===-1?color_unlabel:color_label[d[1].label[iter]]);
            gradient.append("stop")
                .attr("class", "stop-4")
                .attr("offset", "100%")
                .attr("stop-color", d => d[1].label[iter]===-1?color_unlabel:color_label[d[1].label[iter]]);

            path_in_group.enter()
                .append("path")
                .attr("class", "propagation-path")
                .attr("cursor", "default")
                .attr("stroke", "none")
                .attr("fill", d => "url(#path"  + d[0].id + "-" + d[1].id + ")")
                .attr("opacity", 0)
                // .attr("marker-mid", d => "url(#arrow-gray)")
                // .attr("fill", "none")
                .attr("d", function (d) {
                    return bezier_tapered(d[3][0], d[3][1], d[3][2], path_begin_width * that.zoom_scale,
                        path_mid_width * that.zoom_scale, path_end_width * that.zoom_scale);
                })
                .on("mouseover", function (d) {
                            console.log(d);
                            that.highlight_paths(d[0].id+","+d[1].id);
                            let imgs = label_layout([d[0], d[1]], [d], that.zoom_scale);
                            console.log("imgs ", imgs);
                            tmp_show_imgs.selectAll("*").remove();
                            tmp_show_imgs.selectAll("image").data(imgs).enter()
                                .append("image")
                                .attr("class", "label-image")
                                .attr("xlink:href", d => d.url)
                                .attr("x", function(d){
                                    if (d.quad === 1 || d.quad === 2){
                                        return (that.if_focus_selection_box?d.focus_x:that.center_scale_x(d.node.x))  - d.w * that.scale * that.zoom_scale;
                                    }
                                    return that.if_focus_selection_box?d.focus_x:that.center_scale_x(d.node.x);
                                })
                                .attr("y", function(d){
                                    if (d.quad === 2 || d.quad === 3){
                                        return (that.if_focus_selection_box?d.focus_y:that.center_scale_y(d.node.y))  - d.h * that.scale * that.zoom_scale;
                                    }
                                    return that.if_focus_selection_box?d.focus_y:that.center_scale_y(d.node.y);
                                })
                                .attr("width", d => d.h * that.scale * that.zoom_scale)
                                .attr("height", d => d.h * that.scale * that.zoom_scale);
                        })
                .on("mouseout", function (d) {
                        that.remove_path_highlight();
                        tmp_show_imgs.selectAll("*").remove();
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
                    return that.if_focus_selection_box?d.focus_x:that.center_scale_x(d.node.x);
                })
                .attr("y", function(d){
                    if (d.quad === 2 || d.quad === 3){
                        return that.center_scale_y(d.node.y)  - d.h * that.scale * that.zoom_scale;
                    }
                    return that.if_focus_selection_box?d.focus_y:that.center_scale_y(d.node.y);
                })
                .attr("width", d => d.h * that.scale * that.zoom_scale)
                .attr("height", d => d.h * that.scale * that.zoom_scale);
            
            let v_g = that.vonoroi_in_group.enter()
                .append("g");
            v_g.each(function (d) {
                let group = d3.select(this);
                // show entire path
                // for(let edge_id of d.halfedges){
                //     group.append("path")
                //         .datum(edge_id)
                //         .attr("class", "voronoi-edge")
                //         .attr("d", d => that.get_cell_path(d, that.scale))
                //         .style("fill", "none")
                //         .style("stroke-width", 2)
                //         .style("stroke", "#a9a9a9")
                //         .on("mouseover", function (d) {
                //             console.log(that.vonoroi_data.edges[d])
                //         });
                // }
                // show skeleton
                for(let edge of d.skeleton){
                    group.append("path")
                        .datum(edge)
                        .attr("class", "voronoi-edge")
                        .attr("d", d => that.get_skeleton_path(d, that.scale))
                        .style("fill", "none")
                        .style("stroke-width", 2)
                        .style("stroke", "#a9a9a9")
                        .on("mouseover", function (d) {
                            console.log(d)
                        });
                }
            });
            // v_g.append("path")
            //     .attr("d", d => that.get_cell_path(d, that.scale))
            //     .style("fill", "none")
            //     .style("stroke-width", 2)
            //     .style("stroke", "#a9a9a9");
            // v_g.append("circle")
            //     .attr("cx", d => that.center_scale_x(d.site.data[0]))
            //     .attr("cy", d => that.center_scale_y(d.site.data[1]))
            //     .attr("r", 3)
            //     .style("fill", "black");
            let sub_v_g = v_g.append("g")
                .attr("transform", d => "translate("+(that.center_scale_x(d.site.data[0]))+","+(that.center_scale_y(d.site.data[1]))+")")
                .each(function (_d) {
                    let d = _d.summary;
                    let group = d3.select(this);
                    let class_cnt = d.length;
                    let bar_width = 4*that.zoom_scale;
                    let small_inner_bounder = 1.5*that.zoom_scale * 0;
                    let large_inner_bounder = 3*that.zoom_scale * 0;
                    let outer_bounder = 3*that.zoom_scale;
                    let chart_width = bar_width*(2*class_cnt)+large_inner_bounder*(class_cnt-1)+small_inner_bounder*class_cnt+outer_bounder*2;
                    let chart_height = 50*that.zoom_scale;
                    let max_num = 0;
                    for(let i=0;i<d.length;i++){
                        max_num = Math.max(max_num, d[i].in, d[i].out);
                    }
                    scale_function = function(x){
                        return Math.pow(x, 0.5);
                    }
                    // group.append("line")
                    //     .attr("x1", 0)
                    //     .attr("y1", chart_height*0.8)
                    //     .attr("x2", chart_width)
                    //     .attr("y2", chart_height*0.8)
                    //     .attr("stroke-width", that.zoom_scale)
                    //     .attr("stroke", "black");
                    for(let i=0; i<d.length;i++ ){
                        group.append("rect")
                            .attr("class", "edge-summary-rect")
                            .attr("id", "edge-bar-in-"+i)
                            .attr("x", outer_bounder+(bar_width*2+small_inner_bounder+large_inner_bounder)*i)
                            .attr("y", chart_height*0.8-chart_height*0.7*scale_function(d[i].in/max_num))
                            .attr("width", bar_width)
                            .attr("height", chart_height*0.7*scale_function(d[i].in/max_num))
                            .attr("fill", color_label[d[i].idx]);
                        group.append("rect")
                            .attr("class", "edge-summary-rect")
                            .attr("id", "edge-bar-out-"+i)
                            .attr("x", outer_bounder+(bar_width*2+small_inner_bounder+large_inner_bounder)*i+bar_width+small_inner_bounder)
                            .attr("y", chart_height*0.8-chart_height*0.7*scale_function(d[i].out/max_num))
                            .attr("width", bar_width)
                            .attr("height", chart_height*0.7*scale_function(d[i].out/max_num))
                            .attr("fill", color_label[d[i].idx]);
                    }
                });


                

            edge_summary_in_group.enter()
                .append("g")
                .attr("class", "edge-summary")
                .attr("transform", function (d,i) {
                    let class_cnt = d.length;
                    let bar_width = 8*that.zoom_scale;
                    let small_inner_bounder = 1.5*that.zoom_scale;
                    let large_inner_bounder = 3*that.zoom_scale;
                    let outer_bounder = 3*that.zoom_scale;
                    let chart_height = 50*that.zoom_scale;
                    let chart_width = bar_width*(2*class_cnt)+large_inner_bounder*(class_cnt-1)+small_inner_bounder*class_cnt+outer_bounder*2;
                    return "translate("+(that.selection_box[i].x+that.selection_box[i].width/2-chart_width/2)+","+(that.selection_box[i].y-chart_height)+")"
                })
                .each(function (d) {
                    let group = d3.select(this);
                    let class_cnt = d.length;
                    let bar_width = 8*that.zoom_scale;
                    let small_inner_bounder = 1.5*that.zoom_scale;
                    let large_inner_bounder = 3*that.zoom_scale;
                    let outer_bounder = 3*that.zoom_scale;
                    let chart_width = bar_width*(2*class_cnt)+large_inner_bounder*(class_cnt-1)+small_inner_bounder*class_cnt+outer_bounder*2;
                    let chart_height = 50*that.zoom_scale;
                    let max_num = 0;
                    for(let i=0;i<d.length;i++){
                        max_num = Math.max(max_num, d[i].in, d[i].out);
                    }
                    group.append("line")
                        .attr("x1", 0)
                        .attr("y1", chart_height*0.8)
                        .attr("x2", chart_width)
                        .attr("y2", chart_height*0.8)
                        .attr("stroke-width", that.zoom_scale)
                        .attr("stroke", "black");
                    for(let i=0; i<d.length;i++ ){
                        group.append("rect")
                            .attr("class", "edge-summary-rect")
                            .attr("id", "edge-bar-in-"+i)
                            .attr("x", outer_bounder+(bar_width*2+small_inner_bounder+large_inner_bounder)*i)
                            .attr("y", chart_height*0.8-chart_height*0.7*d[i].in/max_num)
                            .attr("width", bar_width)
                            .attr("height", chart_height*0.7*d[i].in/max_num)
                            .attr("fill", d[i].idx===0?color_unlabel:color_label[d[i].idx-1]);
                        group.append("rect")
                            .attr("class", "edge-summary-rect")
                            .attr("id", "edge-bar-out-"+i)
                            .attr("x", outer_bounder+(bar_width*2+small_inner_bounder+large_inner_bounder)*i+bar_width+small_inner_bounder)
                            .attr("y", chart_height*0.8-chart_height*0.7*d[i].out/max_num)
                            .attr("width", bar_width)
                            .attr("height", chart_height*0.7*d[i].out/max_num)
                            .attr("fill", d[i].idx===0?color_unlabel:color_label[d[i].idx-1]);
                    }
                });

            if((nodes_in_group.enter().size() === 0) && (golds_in_group.enter().size() === 0)
                && (glyph_in_group.enter().size() === 0) &&(path_in_group.enter().size() === 0) && (img_in_group.enter().size() === 0) && (edge_summary_group.enter().size() === 0)){
                console.log("no create");
                resolve();
            }

        })
    };

    that._get_focus_selection_scale = function() {
        function center(nodes, width, height) {
            let m_center = {x:0, y:0};
            for(let node of nodes){
                m_center.x += node.x;
                m_center.y += node.y;
            }
            m_center.x /= nodes.length;
            m_center.y /= nodes.length;
            let delta = {
                x:width/2 - m_center.x,
                y:height/2 - m_center.y
            };
            for(let node of nodes){
                node.x += delta.x;
                node.y += delta.y;
            }
        }
        function fd(nodes, width, height) {
        let simulate = d3.forceSimulation(nodes)
             .force("charge", d3.forceManyBody().strength(100))
            .force("collision", d3.forceCollide(d => d.r).strength(1))
            .force("center", d3.forceCenter(width/2, height/2));
        console.log("begin tick");
        simulate.stop();
        for(let i=0; i<500; i++){
            simulate.tick();
        }
    }
        function scalefd(nodes, width, height) {
            let min_x = 1000000;
            let max_x = -1000000;
            let min_y = 1000000;
            let max_y = -1000000;
            for(let node of nodes){
                min_x = Math.min(min_x, node.x-node.r);
                max_x = Math.max(max_x, node.x+node.r);
                min_y = Math.min(min_y, node.y-node.r);
                max_y = Math.max(max_y, node.y+node.r);
            }
            let scale = Math.min(width/(max_x-min_x), height/(max_y-min_y));
            console.log(scale);
            scale *= 0.85;
            //scale = 1;
            for(let node of nodes){
                node.r *= scale;
                node.x *= scale;
                node.y *= scale;
            }
            fd(nodes, width, height);
            center(nodes, width, height);
            return scale
        }
        let selection_boxes = that.selection_box.map(function (d) {
            return {
                "x": d.x,
                "y":d.y,
                "rx":d.rx,
                "ry":d.ry,
                "tao":d.tao,
                "F1":JSON.parse(JSON.stringify(d.F1)),
                "F2":JSON.parse(JSON.stringify(d.F2)),
                "s":d.s,
                "d":d.d,
                "id":d.id,
                "r":Math.max(d.rx, d.ry)
            }
        });
        fd(selection_boxes, that.width, that.height);
        let scale = scalefd(selection_boxes, that.width, that.height);

        // set nodes new position
        console.log("selection boxes:", selection_boxes);
        for(let i=0; i<selection_boxes.length; i++){
            for(let node of that.selection_box[i].nodes){
                let delta_x = (that.center_scale_x(node.x)-(that.selection_box[i].x))*scale;
                let delta_y = (that.center_scale_y(node.y)-(that.selection_box[i].y))*scale;
                node.focus_x = selection_boxes[i].x + delta_x;
                node.focus_y = selection_boxes[i].y + delta_y;

            }
        }

        // set new selection position
        for(let i=0; i<selection_boxes.length; i++){
            that.selection_box[i].rx *= scale;
            that.selection_box[i].ry *= scale;
            that.selection_box[i].s *= scale;
            that.selection_box[i].d *= scale;
            that.selection_box[i].x = selection_boxes[i].x;
            that.selection_box[i].y = selection_boxes[i].y;
            that.selection_box[i].F1 = {
                x:that.selection_box[i].x-that.selection_box[i].d/2*Math.cos(that.selection_box[i].tao),
                y:that.selection_box[i].y-that.selection_box[i].d/2*Math.sin(that.selection_box[i].tao)
            };
            that.selection_box[i].F2 = {
                x:that.selection_box[i].x+that.selection_box[i].d/2*Math.cos(that.selection_box[i].tao),
                y:that.selection_box[i].y+that.selection_box[i].d/2*Math.sin(that.selection_box[i].tao)
            }
        }
        for(let i=0; i<selection_boxes.length; i++){
            for(let node of that.selection_box[i].nodes){
                let flag = inbox(that.selection_box[i], node.focus_x, node.focus_y);
                if(flag === false){
                    console.log("err");
                }
            }
        }
    };

    that.r = function(id) {

        if(glyphs.indexOf(id) > -1 && uncertainty_type >1){
            return 7 * that.zoom_scale;
        }
        else if( highlights.indexOf(id) > -1){
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
            if(highlights.length === 0 && glyphs.length > 10){
                if(visible_items[id] === false){
                    return 0;
                }
                if(glyphs.indexOf(id) > -1){
                    return 1
                }
                return 0.3
            }
            else if(highlights.length === 0){
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
        if(highlights.length === 0 && glyphs.length > 10){
            return 0.3
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
        // console.log("xRange", xRange);
        // console.log("yRange", yRange);
        if (xRange[0] == xRange[1]) {
                    xRange[0] -= 10;
                    xRange[1] += 10;
                }
        if (yRange[0] == yRange[1]) {
                    yRange[0] -= 10;
                    yRange[1] += 10;
                }
        that.xRange = xRange;
        that.yRange = yRange;
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
        transform_plg.set_zoom_slider_value(transform_event.k);
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
        glyph_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("transform", d =>"translate("+that.center_scale_x(d.x)+","+that.center_scale_y(d.y)+")")
                .attr("opacity", d => that.opacity(d.id));
            that.uncertainty_glyph_update();
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
        glyph_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("transform", d =>"translate("+that.center_scale_x(d.x)+","+that.center_scale_y(d.y)+")")
                .attr("opacity", d => that.opacity(d.id));
            that.uncertainty_glyph_update();
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
        // that.vonoroi_in_group
        //     .select("circle")
        //     .attr("cx", d => that.center_scale_x(d.site.data[0]))
        //     .attr("cy", d => that.center_scale_y(d.site.data[1]));

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

    that.highlight = async function(ids) {
        // highlight_plg.highlight(nodes, ids);
        highlights = ids.map(d => DataLoader.state.complete_graph[d]);
        that.focus_nodes = ids.map(d => DataLoader.state.complete_graph[d]);
        await that.show_edges();
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
            that.vonoroi_in_group = that.vonoroi_group.selectAll("g")
                .data(that.vonoroi_data.cells, d => d.id);
            gradient_in_group = gradient_group.selectAll("linearGradient")
                .data([], d => d[0].id+","+d[1].id);
            edge_summary_in_group = edge_summary_group.selectAll(".edge-summary").data(edges_summary);

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

    that.highlight_paths = function(path_keys) {
        let highlight_nodes = {};
        if(typeof path_keys === "string"){
            path_keys = [path_keys];
        }
        path_in_group.attr("opacity", function (d) {
            let key = d[0].id+","+d[1].id;

            if(path_keys.indexOf(key) > -1) {
                highlight_nodes[d[0].id] = true;
                highlight_nodes[d[1].id] = true;
                return that.opacity_path(d)
            }
            else return 0.3;
        });
        nodes_in_group.attr("opacity", function (d) {
            if(highlight_nodes[d.id] === true){
                return that.opacity(d.id);
            }
            else return 0.3;
        });
        golds_in_group.attr("opacity", function (d) {
            if(highlight_nodes[d.id] === true){
                return that.opacity(d.id);
            }
            else return 0.3;
        });
    };

    that.remove_path_highlight = function() {
        path_in_group.attr("opacity", function (d) {
            return that.opacity_path(d)
        });
         nodes_in_group.attr("opacity", d => that.opacity(d.id));
         golds_in_group.attr("opacity", d => that.opacity(d.id));
    };

    that.highlight_nodes = function(nodes_id) {
        if(typeof nodes_id === "number"){
            nodes_id = [nodes_id];
        }
        let node_dict = {};
        for(let id of nodes_id){
            node_dict[id] = true;
        }
        nodes_in_group.attr("opacity", function (d) {
            if(node_dict[d.id] === true){
                return that.opacity(d.id);
            }
            else return 0.3;
        });
        golds_in_group.attr("opacity", function (d) {
            if(node_dict[d.id] === true){
                return that.opacity(d.id);
            }
            else return 0.3;
        })
    };

    that.remove_node_highlight = function() {
         nodes_in_group.attr("opacity", d => that.opacity(d.id));
         golds_in_group.attr("opacity", d => that.opacity(d.id));
    };

    that.uncertainty_glyph_create = function(glyphgs) {
        if(uncertainty_type === 1){
            let pie = d3.pie().value(d => d);
            let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
            glyphgs.selectAll("path")
                .data(d => pie(d.score[iter]))
                .enter()
                .append("path")
                .attr("d", arc)
                .attr("fill", (d,i) => color_label[i]);
        }
        else if(uncertainty_type === 2){
            let uncertainty_values = glyphgs
                .append("g")
                .attr("class", "uncertainty-value");
            uncertainty_values.append("path")
                .attr("class", "uncertainty-value-path")
                .attr("d", function (d) {
                    let uncertainty = d.entropy;
                    let angle = Math.PI/2*uncertainty;
                    let arc = d3.arc()
                        .innerRadius(uncertainty_glyph_radius * that.zoom_scale)
                        .outerRadius(uncertainty_glyph_radius * that.zoom_scale)
                        .startAngle(-angle)
                        .endAngle(angle);
                    return arc();
                })
                .attr("stroke", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                })
                .attr("stroke-width", unccertainty_line_stroke_width * that.zoom_scale);
            uncertainty_values.append("path")
                .attr("class", "uncertainty-value-hat-left")
                .attr("d", function (d) {
                    return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                        0, -uncertainty_glyph_radius * that.zoom_scale,
                        uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                        -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                    )
                })
                .attr("transform", function (d) {
                    let uncertainty = d.entropy;
                    let angle = 90*uncertainty;
                    return "rotate({0})".format(-angle);
                })
                .attr("stroke", "none")
                .attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                });
            uncertainty_values.append("path")
                .attr("class", "uncertainty-value-hat-right")
                .attr("d", function (d) {
                    return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                        0, -uncertainty_glyph_radius * that.zoom_scale,
                        uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                        -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                    )
                })
                .attr("transform", function (d) {
                    let uncertainty = d.entropy;
                    let angle = 90*uncertainty;
                    return "rotate({0})".format(angle);
                })
                .attr("stroke", "none")
                .attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                });
        }
        else if(uncertainty_type === 3){
            let pie = d3.pie().value(d => d);
            // let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
            // glyphgs.selectAll("path")
            //     .data(function (d) {
            //         let data = pie(d.score[iter]);
            //         for(let one_arc of data){
            //             one_arc.startAngle = one_arc.startAngle/2 - Math.PI/2;
            //             one_arc.endAngle = one_arc.endAngle/2 - Math.PI/2;
            //         }
            //         return data
            //     })
            //     .enter()
            //     .append("path")
            //     .attr("d", arc)
            //     .attr("fill", (d,i) => color_label[i]);

            let arc = d3.arc().innerRadius((uncertainty_glyph_radius-4) * that.zoom_scale)
                        .outerRadius((uncertainty_glyph_radius) * that.zoom_scale);
            let uncertainty_values = glyphgs
                .append("g")
                .attr("class", "uncertainty-value");
            uncertainty_values.selectAll("path")
                .data(function (d) {
                    let data = pie(d.score[iter]);
                    let uncertainty = d.entropy;
                    let angle = Math.PI/2*uncertainty;
                    let scale = angle/Math.PI;
                    for(let one_arc of data){
                        one_arc.startAngle = one_arc.startAngle*scale - angle;
                        one_arc.endAngle = one_arc.endAngle*scale - angle;
                    }
                    return data
                })
                .enter()
                .append("path")
                .attr("class", "uncertainty-value-path")
                .attr("d", function (d) {
                    return arc(d);
                    // let uncertainty = d.entropy;
                    // let angle = Math.PI/2*uncertainty;
                    // let arc = d3.arc()
                    //     .innerRadius(uncertainty_glyph_radius * that.zoom_scale)
                    //     .outerRadius(uncertainty_glyph_radius * that.zoom_scale)
                    //     .startAngle(-angle)
                    //     .endAngle(angle);
                    // return arc();
                })
                .attr("fill", (d,i) => color_label[i]);
                // .attr("stroke", function (d) {
                //     return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                // })
                // .attr("stroke-width", unccertainty_line_stroke_width * that.zoom_scale);

            uncertainty_values.append("path")
                .attr("class", "uncertainty-value-hat-left")
                .attr("d", function (d) {
                    return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                        0, -uncertainty_glyph_radius * that.zoom_scale,
                        uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                        -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                    )
                })
                .attr("transform", function (d) {
                    let uncertainty = d.entropy;
                    let angle = 90*uncertainty;
                    return "rotate({0})".format(-angle);
                })
                .attr("stroke", "none")
                .attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                });
            uncertainty_values.append("path")
                .attr("class", "uncertainty-value-hat-right")
                .attr("d", function (d) {
                    return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                        0, -uncertainty_glyph_radius * that.zoom_scale,
                        uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                        -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                    )
                })
                .attr("transform", function (d) {
                    let uncertainty = d.entropy;
                    let angle = 90*uncertainty;
                    return "rotate({0})".format(angle);
                })
                .attr("stroke", "none")
                .attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                });
        }
        else if(uncertainty_type === 4){
            let pie = d3.pie().value(d => d);
            // let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
            // glyphgs.selectAll("path")
            //     .data(function (d) {
            //         let data = pie(d.score[iter]);
            //         for(let one_arc of data){
            //             one_arc.startAngle = one_arc.startAngle/2 - Math.PI/2;
            //             one_arc.endAngle = one_arc.endAngle/2 - Math.PI/2;
            //         }
            //         return data
            //     })
            //     .enter()
            //     .append("path")
            //     .attr("d", arc)
            //     .attr("fill", (d,i) => color_label[i]);

            let arc = d3.arc().innerRadius((uncertainty_glyph_radius-4) * that.zoom_scale)
                        .outerRadius((uncertainty_glyph_radius) * that.zoom_scale);
            let uncertainty_values = glyphgs
                .append("g")
                .attr("class", "uncertainty-value");
            uncertainty_values.selectAll("path")
                .data(function (d) {
                    let data = pie(d.score[iter]);
                    // let uncertainty = d.entropy;
                    // let angle = Math.PI/2*uncertainty;
                    // let scale = angle/Math.PI;
                    for(let one_arc of data){
                        one_arc.startAngle = one_arc.startAngle/2 - Math.PI/2;
                        one_arc.endAngle = one_arc.endAngle/2 - Math.PI/2;
                    }
                    return data
                })
                .enter()
                .append("path")
                .attr("class", "uncertainty-value-path")
                .attr("d", function (d) {
                    return arc(d);
                    // let uncertainty = d.entropy;
                    // let angle = Math.PI/2*uncertainty;
                    // let arc = d3.arc()
                    //     .innerRadius(uncertainty_glyph_radius * that.zoom_scale)
                    //     .outerRadius(uncertainty_glyph_radius * that.zoom_scale)
                    //     .startAngle(-angle)
                    //     .endAngle(angle);
                    // return arc();
                })
                .attr("fill", (d,i) => color_label[i]);
                // .attr("stroke", function (d) {
                //     return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                // })
                // .attr("stroke-width", unccertainty_line_stroke_width * that.zoom_scale);

            uncertainty_values.append("path")
                .attr("class", "uncertainty-value-hat-left")
                .attr("d", function (d) {
                    return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                        0, -uncertainty_glyph_radius * that.zoom_scale,
                        uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                        -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                    )
                })
                .attr("transform", function (d) {
                    let uncertainty = d.entropy;
                    let angle = 90*uncertainty;
                    return "rotate({0})".format(-angle);
                })
                .attr("stroke", "none")
                .attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                });
            uncertainty_values.append("path")
                .attr("class", "uncertainty-value-hat-right")
                .attr("d", function (d) {
                    return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                        0, -uncertainty_glyph_radius * that.zoom_scale,
                        uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                        -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                    )
                })
                .attr("transform", function (d) {
                    let uncertainty = d.entropy;
                    let angle = 90*uncertainty;
                    return "rotate({0})".format(angle);
                })
                .attr("stroke", "none")
                .attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                });
            uncertainty_values.append("circle")
                .attr("cursor", "default")
                .attr("class", "node-dot")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", d => that.r(d.id))
                .attr("opacity", d => that.opacity(d.id))
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
                    node.attr("r", (glyphs.indexOf(d.id)>-1?9:5) * that.zoom_scale);

                })
                .on("mouseout", function (d) {
                    // check if hided
                    if(visible_items[d.id] === false) return;
                    let node = d3.select(this);
                    node.attr("r", d => that.r(d.id));
                    return;
                })
                .on("mousedown", function(d){
                    let node = this;
                    console.log("mousedown", d.id);
                    that.data_manager.update_edit_state(d.id, "instance", node);
                })
                .on("click", function (d) {
                    // check if hided
                    d3.event.stopPropagation();
                    if(visible_items[d.id] === false) return;
                    // that.data_manager.highlight_nodes([d.id]);
                    //  that.highlight([d.id]);
                    // that.focus_nodes = [d];
                    // that.show_edges();
                    that.highlight([d.id]);
                })
        }
    };

    that.uncertainty_glyph_update = function() {
        if(uncertainty_type === 1){
            let pie = d3.pie().value(d => d);
            let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
            glyph_in_group.selectAll("path")
                .append("path")
                .attr("d", arc)
                .attr("fill", (d,i) => color_label[i]);
        }
        else if(uncertainty_type === 2){
            let pie = d3.pie().value(d => d);
            let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
            glyph_in_group.selectAll(".glyph-path")
                    .attr("d", arc)
                    .attr("fill", (d,i) => color_label[i]);
            glyph_in_group
                    .selectAll(".uncertainty-value")
                    .select("path")
                    .attr("d", function (d) {
                        let uncertainty = d.entropy;
                        let angle = Math.PI/2*uncertainty;
                        let arc = d3.arc()
                            .innerRadius(uncertainty_glyph_radius * that.zoom_scale)
                            .outerRadius(uncertainty_glyph_radius * that.zoom_scale)
                            .startAngle(-angle)
                            .endAngle(angle);
                        return arc();
                    })
                    .attr("stroke", function (d) {
                        return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                    })
                    .attr("stroke-width", unccertainty_line_stroke_width * that.zoom_scale);
            glyph_in_group
                    .selectAll(".uncertainty-value-hat-left")
                    .attr("d", function (d) {
                        return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                            0, -uncertainty_glyph_radius * that.zoom_scale,
                            uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                            -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                        )
                    })
                    .attr("transform", function (d) {
                        let uncertainty = d.entropy;
                        let angle = 90*uncertainty;
                        return "rotate({0})".format(-angle);
                    });
            glyph_in_group
                    .selectAll(".uncertainty-value-hat-right")
                    .attr("d", function (d) {
                        return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                            0, -uncertainty_glyph_radius * that.zoom_scale,
                            uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                            -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                        )
                    })
                    .attr("transform", function (d) {
                        let uncertainty = d.entropy;
                        let angle = 90*uncertainty;
                        return "rotate({0})".format(angle);
                    });
        }
        else if(uncertainty_type === 3){
            let arc = d3.arc().innerRadius((uncertainty_glyph_radius-4) * that.zoom_scale)
                        .outerRadius((uncertainty_glyph_radius) * that.zoom_scale);
            // let uncertainty_values = glyphgs
            //     .append("g")
            //     .attr("class", "uncertainty-value");
             glyph_in_group
                    .selectAll(".uncertainty-value-path")
                    .attr("d", function (d) {
                        return arc(d);
                    });

            glyph_in_group
                    .selectAll(".uncertainty-value-hat-left")
                    .attr("d", function (d) {
                        return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                            0, -uncertainty_glyph_radius * that.zoom_scale,
                            uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                            -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                        )
                    })
                    .attr("transform", function (d) {
                        let uncertainty = d.entropy;
                        let angle = 90*uncertainty;
                        return "rotate({0})".format(-angle);
                    });
            glyph_in_group
                    .selectAll(".uncertainty-value-hat-right")
                    .attr("d", function (d) {
                        return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                            0, -uncertainty_glyph_radius * that.zoom_scale,
                            uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                            -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                        )
                    })
                    .attr("transform", function (d) {
                        let uncertainty = d.entropy;
                        let angle = 90*uncertainty;
                        return "rotate({0})".format(angle);
                    });
        }
        else if(uncertainty_type === 4){
            let arc = d3.arc().innerRadius((uncertainty_glyph_radius-4) * that.zoom_scale)
                        .outerRadius((uncertainty_glyph_radius) * that.zoom_scale);
            // let uncertainty_values = glyphgs
            //     .append("g")
            //     .attr("class", "uncertainty-value");
             glyph_in_group
                    .selectAll(".uncertainty-value-path")
                    //  .transition()
                    // .duration(AnimationDuration)
                    .attr("d", function (d) {
                        return arc(d);
                    });

            glyph_in_group
                    .selectAll(".uncertainty-value-hat-left")
                    // .transition()
                    // .duration(AnimationDuration)
                    .attr("d", function (d) {
                        return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                            0, -uncertainty_glyph_radius * that.zoom_scale,
                            uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                            -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                        )
                    })
                    .attr("transform", function (d) {
                        let uncertainty = d.entropy;
                        let angle = 90*uncertainty;
                        return "rotate({0})".format(-angle);
                    });
            glyph_in_group
                    .selectAll(".uncertainty-value-hat-right")
                    // .transition()
                    // .duration(AnimationDuration)
                    .attr("d", function (d) {
                        return "M {0} {1} L {2} {3} L {4} {5} Z".format(
                            0, -uncertainty_glyph_radius * that.zoom_scale,
                            uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale,
                            -uncertainty_glyph_hat* that.zoom_scale, -uncertainty_glyph_radius * that.zoom_scale - uncertainty_glyph_hat*1.7* that.zoom_scale
                        )
                    })
                    .attr("transform", function (d) {
                        let uncertainty = d.entropy;
                        let angle = 90*uncertainty;
                        return "rotate({0})".format(angle);
                    });

            glyph_in_group
                .selectAll(".node-dot")
                .attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                })
                .attr("opacity", d => that.opacity(d.id))
                .attr("r", d => that.r(d.id))
                .attr("cx", 0)
                .attr("cy", 0)
        }
    };

    that.extend_local_update = function() {
        let highlights_id = highlights;
        // TODO : extend algorithm
        let new_highlights = JSON.parse(JSON.stringify(highlights_id));
        for(let id of highlights_id){
            let in_nodes = nodes_dict[id].from;
            for(let neighbor_id of in_nodes){
                if(new_highlights.indexOf(neighbor_id) === -1){
                    new_highlights.push(neighbor_id);
                }
            }
        }
        console.log("Extend nodes:", new_highlights);
        is_local_k = true;
        that.data_manager.highlight_nodes(new_highlights);
    };

    that.set_is_local_k = function(flag) {
        is_local_k = flag;
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

    that.update_uncertainty_radius = async function(radius, hat) {
        uncertainty_glyph_radius = radius;
        uncertainty_glyph_hat = hat;
        await that._update_view()
    };

    that.update_uncertainty_type = async function(type) {
        uncertainty_type = type;
        uncertainty_glyph_radius = type===2?9:13;
        d3.selectAll(".pie-chart").remove();
        await that._update_view();
    };

    that.if_show_voronoi = function(flag){
        show_voronoi = flag;
        that.data_manager.update_graph_view()
    };

    that.if_show_outliers = function(flag) {
        if(flag) {
            nodes_in_group.attr("fill", d => outliers[d.id]?"black":(d.label[iter]===-1?color_unlabel:color_label[d.label[iter]]))
        }
        else {
            nodes_in_group.attr("fill", function (d) {
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
            })
        }
    };



    // that.get_area = function(){
    //     return transform_plg.get_area();
    // };

    that.init = function () {
        that._init();
    }.call();
};