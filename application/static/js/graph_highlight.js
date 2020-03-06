let GraphHighlight = function (parent) {
    let that = this;

    // parent
    let view = null;

    let lasso = null;
    let if_lasso = false;
    let if_select_edge = false;
    let lasso_btn_path = null;
    let fisheye_btn_path = null;
    let influence_to_btn_path = null;
    let influence_from_btn_path =null;
    let select_edge_btn_path = null;
    let edit_btn_path = null;
    let btn_select_color = "#560731";

    that._init = function () {
        that.set_view(parent);
        lasso = d3.lasso()
            .closePathSelect(true)
            .closePathDistance(100);
        lasso_btn_path = d3.select("#lasso-btn").select("path");
        influence_from_btn_path = d3.select("#influence-from-btn").select("path");
        influence_to_btn_path = d3.select("#influence-to-btn").select("path");
        edit_btn_path = d3.select("#apply-delete-btn").select("path");
        select_edge_btn_path = d3.select("#select-edge-btn").select("path");

        
        d3.select("#apply-delete-btn")
            .on("click", function () {
                let selected_idxs = view.get_highlights();
                console.log("click apply-delete-btn", selected_idxs);
                view.data_manager.delete_idxs(selected_idxs);
            });


        $("#lasso-btn")
            .click(function () {
                that._change_lasso_mode();
            });


        $("#home-btn")
            .click(function () {
                view.data_manager.graph_home();
            });

        $("#refresh-btn")
            .click(function () {
                let selected_idxs = view.get_highlights();
                console.log("click apply-delete-btn", selected_idxs);
                view.data_manager.local_update_k(selected_idxs);
            });

        $("#influence-from-btn")
            .click(function () {
                let is_show_path = view.get_is_show_path();
                if(is_show_path){
                    that.hide_selection_nodes_path();
                    $("#influence-from-btn").css("background-color", "gray");
                    influence_from_btn_path.attr("stroke", "white").attr("fill", "white");
                }
                else {
                    is_show_path = true;
                    if(if_lasso){
                        that._change_lasso_mode();
                    }
                    that.show_selection_nodes_path("from");
                    $("#influence-from-btn").css("background-color", btn_select_color);
                    influence_from_btn_path.attr("stroke", "white").attr("fill", "white");
                }
            });

        $("#influence-to-btn")
            .click(function () {
                let is_show_path = view.get_is_show_path();
                if(is_show_path){
                    that.hide_selection_nodes_path();
                    $("#influence-to-btn").css("background-color", "gray");
                    influence_to_btn_path.attr("stroke", "white").attr("fill", "white");
                }
                else {
                    is_show_path = true;
                    if(if_lasso){
                        that._change_lasso_mode();
                    }
                    that.show_selection_nodes_path("to");
                    $("#influence-to-btn").css("background-color", btn_select_color);
                    influence_to_btn_path.attr("stroke", "white").attr("fill", "white");
                }
            });

        $("#select-edge-btn")
        .click(function () {
                that._change_edge_select_mode();
            });

        that.add_btn_style();
    };

    that.add_btn_style = function() {
        let btn_ids = ["apply-delete-btn", "lasso-btn", "fisheye-btn", "home-btn", "refresh-btn", "influence-to-btn", "influence-from-btn", "select-edge-btn"];
        for(let btn_id of btn_ids){
            let select_id = "#"+btn_id;
            let path = d3.select(select_id).selectAll("path");
            $(select_id)
            .on("mouseover", function () {
            if (d3.select(select_id).style("background-color") === "rgba(0, 0, 0, 0)"
                || d3.select(select_id).style("background-color") === "white"
                || d3.select(select_id).style("background-color") === "rgb(255, 255, 255)") {
                d3.select(select_id).style("background", "gray");
                path.attr("stroke", "white").attr("fill", "white");
            }
        })
            .on("mousemove", function () {
            if (d3.select(select_id).style("background-color") === "rgba(0, 0, 0, 0)"
                || d3.select(select_id).style("background-color") === "white"
                || d3.select(select_id).style("background-color") === "rgb(255, 255, 255)") {
                d3.select(select_id).style("background", "gray");
                path.attr("stroke", "white").attr("fill", "white");
            }
        })
            .on("mouseout", function () {
            if (d3.select(select_id).style("background-color") === "gray") {
                d3.select(select_id).style("background", "white");
                path.attr("stroke", "black").attr("fill", "black");
            }
        });
        }

    };

    that.set_view = function (new_parent) {
        view = new_parent;
    };

    that.set_lasso = function() {
        view.svg.select(".lasso").remove();
        lasso.items(view.get_nodes_in_group())
            .targetArea(view.svg)
            .on("start", that.lasso_start)
            .on("draw", that.lasso_draw)
            .on("end", that.lasso_end);
        view.svg.call(lasso);
    };

    that.remove_lasso = function() {
        view.svg.select(".lasso").remove();
    };

    that.lasso_start = function () {
        lasso.items()
            .attr("r", d => view.r(d.id)) // reset size
            .classed("not_possible", true)
            .classed("selected", false);
    };

    that.lasso_draw = function () {
        // Style the possible dots
        lasso.possibleItems()
            .classed("not_possible", false)
            .classed("possible", true)
            .attr("r", 5 * view.zoom_scale);
        //
        // // Style the not possible dot
        lasso.notPossibleItems()
            .classed("not_possible", true)
            .classed("possible", false)
            .attr("r", d => view.r(d.id));

    };

    that.lasso_end = function () {
        lasso.items()
            .classed("not_possible", false)
            .classed("possible", false);

        // Reset the style of the not selected dots
        lasso.notSelectedItems()
            .attr("r", d => view.r(d.id));

        let new_selection_tmp = lasso.selectedItems().data().map(d => d.id);
        // remove hided lasso items
        let new_selection = [];
        lasso.selectedItems().each(function (d) {
            let node = d3.select(this);
            let opacity = node.attr("opacity");
            let node_id = d.id;
            if((view.get_visible_items()[node_id] === true) && (opacity != 0)) new_selection.push(node_id);
        });
        that.highlight(view.get_nodes(), new_selection);
    };

    that.highlight = function(nodes, select_ids) {
        console.log("Highlight nodes:", select_ids);
        // if(select_ids.length<20)
            // view.data_manager.update_image_view(select_ids); // TODO: disable by changjian
        //first check if all select_id are in nodes
        let all_load = true;
        let new_ids = [];
        for(let id of select_ids){
            if(nodes[id] === undefined){
                new_ids.push(id);
                all_load = false;
            }
        }
        if(all_load === true){
            view.data_manager.show_highlight_node(select_ids);
            // if(select_ids.length){                
            //     view.data_manager.get_selected_flows(select_ids);
            // } // TODO: disabled by changjian
        }
        else {
            view.fetch_points(select_ids, new_ids, "highlight", select_ids);
        }
    };

    that.show_selection_nodes_path = function (mode) {
        let focus_node_data = [];
        let selection_nodes = view.get_highlights();
        let nodes = view.get_nodes();
        for(let id of selection_nodes){
            let node = nodes[id];
            // if(node.label[0] !== -1 || node.label[iter] === -1) continue;
            focus_node_data.push(nodes[id]);
        }
        console.log("show nodes:", focus_node_data);
        // focus_edge_id = null;
        // focus_edge_node = null;
        if (focus_node_data.length === 0) {
            console.log("No node need focus.");
            return
        }

        console.log("focus nodes:", focus_node_data);


        let path_keys = [];
        let path = [];
        let path_nodes = {};
        let new_nodes = [];
        let new_area = null;
        let load_path = false;
        for(let d of focus_node_data){
            if(d.from === -1 || d.to === -1){
                load_path = true;
                break;
            }
        }
        if(load_path){
            $.post("/graph/GetPath", {
                "nodes":JSON.stringify(selection_nodes)
            }, function (data) {
                console.log("get path data:", data);
                for(let id of Object.keys(data)){
                    nodes[id].from = data[id].from;
                    nodes[id].to = data[id].to;
                }
                showpath()
            });
        }
        else {
            showpath()
        }
        function showpath() {
            for (let d of focus_node_data) {
                // if (d.label[iter] === -1 || d.label[0] !== -1) continue;
                console.log("Node:", d);
                for (let source_node of d[mode]) {
                    let s = null;
                        let e = null;
                        if(mode === "from"){
                            s = source_node;
                            e = d.id;
                        }
                        else if(mode === "to"){
                            s = d.id;
                            e = source_node
                        }
                        let key = s + "," + e;
                        if (path_keys.indexOf(key) === -1) {
                            path_keys.push(key);
                            let keys = key.split(",");
                            let e = parseInt(keys[0]);
                            let s = parseInt(keys[1]);
                            path_nodes[e] = true;
                            path_nodes[s] = true;
                            path.push([e, s]);
                        }
                }
            }
            let must_show_nodes = [];
            for(let node_id in path_nodes){
                if(nodes[node_id] === undefined) new_nodes.push(parseInt(node_id));
                must_show_nodes.push(parseInt(node_id))
            }
            // focus_node = JSON.parse(JSON.stringify(path_nodes));
            if(new_nodes.length === 0){
                console.log("no new nodes added");
                view.data_manager.show_path_node(selection_nodes, mode);
            }
            else {
                console.log("fetch nodes");
                view.fetch_points(must_show_nodes, new_nodes, "showpath-"+mode, selection_nodes);
            }
        }

    };

    that.hide_selection_nodes_path = function() {
        view.data_manager.show_path_node([]);
    };

    that._change_lasso_mode = function () {
        if (if_lasso) {
            if_lasso = false;
            $("#lasso-btn").css("background-color", "gray");
            lasso_btn_path.attr("stroke", "white").attr("fill", "white");
            view.lasso_or_zoom("zoom")
        } else {
            if_lasso = true;
            $("#lasso-btn").css("background-color", btn_select_color);
            lasso_btn_path.attr("stroke", "white").attr("fill", "white");
            view.lasso_or_zoom("lasso");
        }
    };

    that._change_edge_select_mode = function () {
        if (if_select_edge) {
            if_select_edge = false;
            $("#select-edge-btn").css("background-color", "gray");
            select_edge_btn_path.attr("stroke", "white").attr("fill", "white");
            view.lasso_or_zoom("zoom")
        } else {
            if_select_edge = true;
            $("#select-edge-btn").css("background-color", btn_select_color);
            select_edge_btn_path.attr("stroke", "white").attr("fill", "white");
            view.lasso_or_zoom("edge-select");
        }
    };

    that.if_lasso = function() {
        return if_lasso;
    };

    that._line_line_intersect = function(line1, line2) {
        function btwn(a, b1, b2) {
          if ((a >= b1) && (a <= b2)) { return true; }
          if ((a >= b2) && (a <= b1)) { return true; }
          return false;
        }
      var x1 = line1.x1, x2 = line1.x2, x3 = line2.x1, x4 = line2.x2;
      var y1 = line1.y1, y2 = line1.y2, y3 = line2.y1, y4 = line2.y2;
      var pt_denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      var pt_x_num = (x1*y2 - y1*x2) * (x3 - x4) - (x1 - x2) * (x3*y4 - y3*x4);
      var pt_y_num = (x1*y2 - y1*x2) * (y3 - y4) - (y1 - y2) * (x3*y4 - y3*x4);
      if (pt_denom == 0) { return "parallel"; }
      else {
        var pt = {'x': pt_x_num / pt_denom, 'y': pt_y_num / pt_denom};
        if (btwn(pt.x, x1, x2) && btwn(pt.y, y1, y2) && btwn(pt.x, x3, x4) && btwn(pt.y, y3, y4)) { return pt; }
        else { return "not in range"; }
      }
    };

    that._path_line_intersections = function(path_d3, line) {

      let pts = [];
      let pathEl = path_d3.node();
      let pathLength = pathEl.getTotalLength();
      let n_segments = Math.round(pathLength/5);
      for (var i=0; i<n_segments; i++) {
        var pos1 = pathEl.getPointAtLength(pathLength * i / n_segments);
        var pos2 = pathEl.getPointAtLength(pathLength * (i+1) / n_segments);
        var line1 = {x1: pos1.x, x2: pos2.x, y1: pos1.y, y2: pos2.y};
        let begin = line.node().getPointAtLength(0);
        let end = line.node().getPointAtLength(line.node().getTotalLength()-1);
        var line2 = {x1: begin.x, x2: end.x,
                     y1: begin.y, y2: end.y};
        var pt = that._line_line_intersect(line1, line2);
        if (typeof(pt) != "string") {
          pts.push(pt);
          return true
        }
      }
      return false;

    };

    that.set_select_edge = function (){
        function draw_line(selection) {
            let xy0,
            path,
            keep = false,
            line = d3.line()
                     .x(function(d){ return d[0]; })
                     .y(function(d){ return d[1]; });

        selection
            .on('mousedown', function(){
                view.main_group.select("#select-edge_path").remove();
                d3.selectAll(".propagation-path")
                    .style("stroke-width", 2.0 * view.zoom_scale);
                keep = true;
                xy0 = d3.mouse(view.main_group.node());
                path = view.main_group
                         .append('path')
                         .attr("id", "select-edge_path")
                         .attr('d', line([xy0, xy0]))
                        .attr("stroke", "black")
                        .attr("stroke-width", 1);
            })
            .on('mouseup', function(){
                keep = false;
                let paths = d3.selectAll(".propagation-path");
                let line = view.main_group.select("#select-edge_path");
                let highlight_paths = [];
                paths.each(function () {
                    let path = d3.select(this);
                    if(that._path_line_intersections(path, line)){
                        highlight_paths.push(path);

                    }
                });
                view.main_group.select("#select-edge_path").remove();
                for(let path of highlight_paths){
                    path.style("stroke-width", 4.0 * view.zoom_scale);
                }
                console.log("find paths:", highlight_paths)
            })
            .on('mousemove', function(){
                if (keep) {
                    Line = line([xy0, d3.mouse(view.main_group.node()).map(function(x){ return x - 1; })]);
                    path.attr('d', Line);
                }
            });
        }
        view.svg.call(draw_line);
    };

    that.remove_select_edge = function() {
        view.main_group.select("#select-edge_path").remove();
        view.svg.on('mousedown', null);
        view.svg.on('mouseup', null);
        view.svg.on('mousemove', null);
    };

    that.init = function () {
        that._init();
    }.call();
};