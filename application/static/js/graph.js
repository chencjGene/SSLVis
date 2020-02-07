/*
* added by Changjian Chen, 20191015
* */

let GraphLayout = function (container) {
    let that = this;
    that.container = container;

    // data loader
    let data_manager = null;

    // container const
    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let layout_width = width - 20;
    let layout_height = height - 20;

    // other consts
    let color_unlabel = UnlabeledColor;
    let color_label = CategoryColor;
    let edge_color = UnlabeledColor;
    let AnimationDuration = 1000;
    let pathGenerator = d3.line().curve(d3.curveCardinal.tension(0.5));

    // draw containter
    let svg = null;
    let main_group = null;
    let path_group = null;
    let nodes_group = null;
    let golds_group = null;
    let glyph_group = null;
    let path_in_group = null;
    let nodes_in_group = null;
    let golds_in_group = null;
    let glyph_in_group = null;

    // meta data
    let nodes = {};
    let path = [];
    let path_nodes = {};
    let is_show_path = false;
    let highlights = [];
    let area = null;
    let rescale = false;
    let glyphs = [];
    let iter = -1;
    let visible_items = {};

    // from area to main_group
    let center_scale_x = null;
    let center_scale_y = null;
    let center_scale_x_reverse = null;
    let center_scale_y_reverse = null;

    that._init = function () {
        // container init
        svg = container.selectAll('#graph-view-svg')
            .attr("width", width)
            .attr("height", height);
        main_group = svg.append('g').attr('id', 'main_group');
        path_group = main_group.append("g").attr("id", "graph-path-g");
        nodes_group = main_group.append("g").attr("id", "graph-tsne-point-g");
        golds_group = main_group.append("g").attr("id", "graph-gold-g");
        glyph_group = main_group.append("g").attr("id", "graph-glyph-g");
        width = $('#graph-view-svg').width();
        height = $('#graph-view-svg').height();

        // add marker to svg
        that._add_marker();
    };

    that.set_data_manager = function(new_data_manager) {
        data_manager = new_data_manager;
    };

    that.component_update = async function(state) {
        console.log("get graph state:", state);
        that._update_data(state);
        await that._update_view();
    };

    that._update_data = function(state) {
        nodes = state.nodes;
        is_show_path = state.is_show_path;
        highlights = state.highlights;
        area = state.area;
        rescale = state.rescale;
        visible_items = state.visible_items;
        // path
        path = [];
        path_nodes = {};
        let path_keys = [];//remove duplicates
        for(let target_id of state.path){
            for(let source_id of nodes[target_id]){
                let key = source_id+","+target_id;
                if(path_keys.indexOf(key) > -1) continue;
                path.push([nodes[source_id], nodes[target_id]]);
                path_keys.push(key);
                path_nodes[source_id] = true;
                path_nodes[target_id] = true;
            }
        }
        // glyphs
        glyphs = that.get_top_k_uncertainty(nodes, 20);
        //iter
        iter = Object.values(nodes)[0].label.length-1;
    };

    that._update_view = function() {
        return new Promise(async function (resolve, reject) {
            // rescale
            if(rescale) that._center_tsne();
            //
            let nodes_ary = Object.values(nodes);
            let golds_ary = nodes_ary.filter(d => d.label[0] > -1);
            let glyphs_ary = nodes_ary.filter(d => glyphs.indexOf(d.id)>-1);
            let path_ary = path;

            nodes_in_group = nodes_group.selectAll("circle")
                .data(nodes_ary, d => d.id);
            golds_in_group = golds_group.selectAll("path")
                .data(golds_ary, d => d.id);
            glyph_in_group = glyph_group.selectAll(".pie-chart")
                .data(glyphs_ary, d => d.id);
            path_in_group = path_group.selectAll("path")
                .data(path_ary, d => d[0].id+","+d[1].id);

            //
            console.log("remove");
            await that._remove();
            //TODO transform
            console.log("update");
            await that._update();
            console.log("create");
            await that._create();
            resolve();
        })
    };

    that._add_marker = function () {
        if ($("#markers marker").length !== 0) return;
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

    that._center_tsne = function() {
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
        let x_width = (xRange[1] - xRange[0]) * scale;
        let y_height = (yRange[1] - yRange[0]) * scale;
        center_scale_x = d3.scaleLinear().domain(xRange).range([(width - x_width) / 2, (width + x_width) / 2]);
        center_scale_y = d3.scaleLinear().domain(yRange).range([(height - y_height) / 2, (height + y_height) / 2]);
        center_scale_x_reverse = d3.scaleLinear().domain([(width - x_width) / 2, (width + x_width) / 2]).range(xRange);
        center_scale_y_reverse = d3.scaleLinear().domain([(height - y_height) / 2, (height + y_height) / 2]).range(yRange);
    };

    that._remove = function () {
        return new Promise(function (resolve, reject) {
            nodes_in_group.exit()
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", 0)
                .remove()
               .on("end", resolve);

            golds_in_group.exit()
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", 0)
                .remove()
                .on("end", resolve);

            glyph_in_group.exit()
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", 0)
                .remove()
                .on("end", resolve);

            path_in_group.exit()
                .transition()
                .duration(AnimationDuration)
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
                    return color_label[d.label[iter]];
                })
                .attr("opacity", d => that.opacity(d.id))
                .attr("r", d => that.r(d.id))
                .attr("cx", d => center_scale_x(d.x))
                .attr("cy", d => center_scale_y(d.y))
                .on("end", resolve);

            golds_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("fill", function (d) {
                    return color_label[d.label[iter]];
                })
                .attr("opacity", d => that.opacity(d.id))
                .attr("d", d => star_path(10 * that.zoom_scale, 4 * that.zoom_scale, center_scale_x(d.x), center_scale_y(d.y)))
                .on("end", resolve);

            let pie = d3.pie().value(d => d);
            let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
            glyph_in_group
                .transition()
                .duration(AnimationDuration)
                .attr("transform", d =>"translate("+center_scale_x(d.x)+","+center_scale_y(d.y)+")")
                .attr("opacity", d => that.opacity(d.id))
                .on("end", resolve);
            glyph_in_group.selectAll("path")
                .data(d => pie(d.score[iter]))
                .append("path")
                .attr("d", arc)
                .attr("fill", (d,i) => color_label[i]);

            path_in_group
                .attr("stroke-width", 2.0 * that.zoom_scale)
                .attr("stroke", edge_color)
                .attr("marker-mid", d => "url(#arrow-gray)")
                .attr("fill", "none")
                .transition()
                .duration(AnimationDuration)
                .attr("d", function (d) {
                    let begin = [center_scale_x(d[0].datum().x), center_scale_y(d[0].datum().y)];
                    let end = [center_scale_x(d[1].datum().x), center_scale_y(d[1].datum().y)];
                    let mid = curve_mid(begin, end);
                    return pathGenerator([begin,mid, end]);
                })
                .attr("opacity", d => that.opacity_path(d))
                .on("end", resolve);


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
                .attr("cx", d => center_scale_x(d.x))
                .attr("cy", d => center_scale_y(d.y))
                .attr("r", d => that.r(d.id))
                .attr("opacity", 0)
                .attr("fill", function (d) {
                    return color_label[d.label[iter]];
                })
                .on("mouseover", function (d) {
                    // check if hided
                    if(visible_items[d.id] === false) return;
                    console.log(d)
                    if((path_nodes[d.id]!==undefined)){
                        return
                    }
                    let node = d3.select(this);
                    node.attr("r", 5 * that.zoom_scale);
                    // that._update_click_menu();
                    if (focus_node_change_switch) {
                        focus_node_id = d.id;
                        console.log("focus_node_id:" + focus_node_id);
                    }
                })
                .on("mouseout", function (d) {
                    // check if hided
                    if(visible_items[d.id] === false) return;
                    let node = d3.select(this);
                    node.attr("r", d => that.r(d.id));

                    if (focus_node_change_switch) {
                        focus_node_id = null;
                        console.log("focus_node_id = null");
                    }
                })
                .on("click", function (d) {
                    // check if hided
                    if(visible_items[d.id] === false) return;
                     that.update_selection_nodes([d.id]);
                })
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => that.opacity(d.id))
                .on("end", resolve);

            golds_in_group.enter()
                .append("path")
                .attr("id", d => "gold-" + d.id)
                .attr("d", d => star_path(10 * that.zoom_scale, 4 * that.zoom_scale, center_scale_x(d.x), center_scale_y(d.y)))
                .attr("fill", function (d) {
                    return color_label[d.label[iter]];
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
                    let eid = d.id;
                    let nodes = d3.select(this);
                    data_manager.update_image_view(nodes);
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
                .attr("transform", d =>"translate("+center_scale_x(d.x)+","+center_scale_y(d.y)+")")
                .attr("opacity", 0)
                .selectAll("path")
                .data(d => pie(d.score[iter]))
                .enter()
                .append("path")
                .attr("id", d => "score-pie-"+d.id)
                .attr("d", arc)
                .attr("fill", (d,i) => color_label[i]);
            glyph_in_group.enter()
                .selectAll("g")
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => that.opacity(d.id));

            path_in_group.enter()
                .append("path")
                .attr("stroke-width", 2.0 * that.zoom_scale)
                .attr("stroke", edge_color)
                .attr("opacity", 0)
                .attr("marker-mid", d => "url(#arrow-gray)")
                .attr("fill", "none")
                .attr("d", function (d) {
                    let begin = [center_scale_x(d[0].datum().x), center_scale_y(d[0].datum().y)];
                    let end = [center_scale_x(d[1].datum().x), center_scale_y(d[1].datum().y)];
                    let mid = curve_mid(begin, end);
                    return pathGenerator([begin,mid, end]);
                })
                .on("mouseover", function (d) {
                            console.log(d);
                            d3.select(this).style("stroke-width", 4.0 * that.zoom_scale);
                            focus_edge_id = d;
                            console.log("focus_edge_id = " + focus_edge_id);
                            focus_edge_node = this;

                        })
                .on("mouseout", function (d) {
                        if (focus_edge_change_switch) {
                            focus_edge_id = null;
                            console.log("focus_edge_id = null");
                            focus_edge_node = null;
                            d3.select(this).style("stroke-width", 2.0 * that.zoom_scale);
                        }
                    })
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => that.opacity_path(d))
                .on("end", resolve);

            if((nodes_in_group.enter().size() === 0) && (golds_in_group.enter().size() === 0)
                && (glyph_in_group.enter().size() === 0) &&(path_in_group.enter().size() === 0)){
                console.log("no create");
                resolve();
            }

        })
    };

    that.r = function(id) {
        if(is_show_path){
            if(path_nodes[id] !== undefined){
                return 5*that.zoom_scale;
            }
            return 3.5*that.zoom_scale
        }
        else {
            if( highlights.indexOf(id) > -1){
                return 5*that.zoom_scale;
            }
            return 3.5*that.zoom_scale
        }
    };

    that.opacity = function(id) {
        if(is_show_path){
            if( path_nodes[id] !== undefined){
                return 1;
            }
            else if(visible_items[id] === false){
                return 0;
            }
            return 0.2
        }
        else {
            if(visible_items[id] === false){
                return 0;
            }
            return 1
        }
    };

    that.opacity_path = function(path) {
        if(is_show_path){
            return 1;
        }
        else{
            return 0;
        }
    };

    that.init = function () {
        that._init();
    }.call();
};