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

    // other consts
    let btn_select_color = "#560731";
    let color_unlabel = UnlabeledColor;
    let color_label = CategoryColor;
    let edge_color = UnlabeledColor;
    let AnimationDuration = 1000;
    let pathGenerator = d3.line().curve(d3.curveCardinal.tension(0.5));

    // draw containter
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
        path_group = that.main_group.append("g").attr("id", "graph-path-g");
        nodes_group = that.main_group.append("g").attr("id", "graph-tsne-point-g");
        golds_group = that.main_group.append("g").attr("id", "graph-gold-g");
        glyph_group = that.main_group.append("g").attr("id", "graph-glyph-g");
        that.width = $('#graph-view-svg').width();
        that.height = $('#graph-view-svg').height();

        // add marker to svg
        that._add_marker();

        //add plugin
        transform_plg = new GraphTransform(that);
        highlight_plg = new GraphHighlight(that);

        // init zoom
        transform_plg.set_zoom();
    };

    that.set_data_manager = function(new_data_manager) {
        that.data_manager = new_data_manager;
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
        glyphs = state.glyphs || [];
        // path
        path = [];
        path_nodes = {};
        let path_keys = [];//remove duplicates
        for(let target_id of state.path){
            for(let source_id of nodes[target_id].path){
                let key = source_id+","+target_id;
                if(path_keys.indexOf(key) > -1) continue;
                path.push([nodes[source_id], nodes[target_id]]);
                path_keys.push(key);
                path_nodes[source_id] = true;
                path_nodes[target_id] = true;
            }
        }
        // glyphs
        // glyphs = that.get_top_k_uncertainty(nodes, 20);
        // // removed by Changjian for reducing visual clutter
        // for(let node_id of Object.keys(path_nodes).map(d => parseInt(d))){
        //     if(glyphs.indexOf(node_id) === -1) glyphs.push(node_id);
        // }
        //iter
        iter = Object.values(nodes)[0].label.length-1;
    };

    that._update_view = function() {
        return new Promise(async function (resolve, reject) {
            // rescale
            if(rescale) that._center_tsne(nodes);
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
            console.log("transform");
            await transform_plg._update_transform(area);
            console.log("update");
            await that._update();
            console.log("create");
            await that._create();

            nodes_in_group = nodes_group.selectAll("circle");
            golds_in_group = golds_group.selectAll("path");
            glyph_in_group = glyph_group.selectAll(".pie-chart");
            path_in_group = path_group.selectAll("path");
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
                    return d.label[iter]===-1?color_unlabel:color_label[d.label[iter]];
                })
                .attr("opacity", d => that.opacity(d.id))
                .attr("d", d => star_path(10 * that.zoom_scale, 4 * that.zoom_scale, that.center_scale_x(d.x), that.center_scale_y(d.y)))
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
                .attr("stroke", edge_color)
                .attr("marker-mid", d => "url(#arrow-gray)")
                .attr("fill", "none")
                .transition()
                .duration(AnimationDuration)
                .attr("d", function (d) {
                    let begin = [that.center_scale_x(d[0].x), that.center_scale_y(d[0].y)];
                    let end = [that.center_scale_x(d[1].x), that.center_scale_y(d[1].y)];
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
                     that.highlight([d.id]);
                })
                .transition()
                .duration(AnimationDuration)
                .attr("opacity", d => that.opacity(d.id))
                .on("end", resolve);

            golds_in_group.enter()
                .append("path")
                .attr("id", d => "gold-" + d.id)
                .attr("d", d => star_path(10 * that.zoom_scale, 4 * that.zoom_scale, that.center_scale_x(d.x), that.center_scale_y(d.y)))
                .attr("fill", function (d) {
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
                    let eid = d.id;
                    let nodes = d3.select(this);
                    that.data_manager.update_image_view(nodes);
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
                .attr("opacity", d => that.opacity(d.id));

            path_in_group.enter()
                .append("path")
                .attr("stroke-width", 2.0 * that.zoom_scale)
                .attr("stroke", edge_color)
                .attr("opacity", 0)
                .attr("marker-mid", d => "url(#arrow-gray)")
                .attr("fill", "none")
                .attr("d", function (d) {
                    let begin = [that.center_scale_x(d[0].x), that.center_scale_y(d[0].y)];
                    let end = [that.center_scale_x(d[1].x), that.center_scale_y(d[1].y)];
                    let mid = curve_mid(begin, end);
                    return pathGenerator([begin,mid, end]);
                })
                .on("mouseover", function (d) {
                            console.log(d);
                            d3.select(this).style("stroke-width", 4.0 * that.zoom_scale);
                        })
                .on("mouseout", function (d) {
                        d3.select(this).style("stroke-width", 2.0 * that.zoom_scale);
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
            return 0.0
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

    that.maintain_size = function (transform_event) {
        that.zoom_scale = 1.0 / transform_event.k;
        nodes_in_group.attr("r", d => that.r(d.id));
        golds_in_group.attr("d", d => star_path(10 * that.zoom_scale, 4 * that.zoom_scale, that.center_scale_x(d.x), that.center_scale_y(d.y)))
            .attr("stroke-width", 1.5*that.zoom_scale);
        path_in_group.attr("d", function (d) {
            let begin = [that.center_scale_x(d[0].x), that.center_scale_y(d[0].y)];
            let end = [that.center_scale_x(d[1].x), that.center_scale_y(d[1].y)];
            let mid = curve_mid(begin, end);
            return pathGenerator([begin,mid, end]);
            })
            .attr("stroke-width", 1.7 * that.zoom_scale);
        // edges_group.selectAll("line").style('stroke-width', that.zoom_scale);
        // that.main_group.select("#group-propagation").selectAll("path").style('stroke-width', 2.0 * that.zoom_scale);
        // main_group.select("#single-propagate").selectAll("polyline").style('stroke-width', 2.0 * that.zoom_scale);
        let arc = d3.arc().outerRadius(11 * that.zoom_scale).innerRadius(7 * that.zoom_scale);
        glyph_in_group.selectAll("path").attr("d", arc);
    };

    that.get_visible_items = function() {
        return visible_items;
    };

    that.get_nodes = function() {
        return nodes;
    };

    that.get_nodes_in_group = function() {
        return nodes_in_group;
    };

    that.lasso_or_zoom = function(mode) {
        if(mode === "lasso"){
            transform_plg.remove_zoom();
            highlight_plg.set_lasso();
        }
        else if(mode === "zoom"){
            highlight_plg.remove_lasso();
            transform_plg.set_zoom();
        }
    };

    that.get_area = function(){
        return area;
    };

    that.fetch_points = function (select_ids, new_nodes, type = "highlight", data) {
        transform_plg.fetch_points(select_ids, new_nodes, type, data);
    };

    that.highlight = function(ids){
        highlight_plg.highlight(nodes, ids);
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
            await that._remove();
    };

    that.get_level = function(){
        return transform_plg.get_level();
    };

    that.get_wh = function(){
        return that.width / that.height;
    }

    // that.get_area = function(){
    //     return transform_plg.get_area();
    // };

    that.init = function () {
        that._init();
    }.call();
};