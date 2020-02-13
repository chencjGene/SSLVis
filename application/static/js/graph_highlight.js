let GraphHighlight = function (parent) {
    let that = this;

    // parent
    let view = null;

    let lasso = null;
    let if_lasso = false;
    let lasso_btn_path = null;
    let fisheye_btn_path = null;
    let edit_btn_path = null;
    let btn_select_color = "#560731";

    that._init = function () {
        that.set_view(parent);
        lasso = d3.lasso()
            .closePathSelect(true)
            .closePathDistance(100);
        lasso_btn_path = d3.select("#lasso-btn").select("path");
        fisheye_btn_path = d3.select("#fisheye-btn").select("path");
        edit_btn_path = d3.select("#apply-delete-btn").select("path");

        
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

        $("#fisheye-btn")
            .click(function () {
                let is_show_path = view.get_is_show_path();
                if(is_show_path){
                    that.hide_selection_nodes_path();
                    $("#fisheye-btn").css("background-color", "gray");
                    fisheye_btn_path.attr("stroke", "white").attr("fill", "white");
                }
                else {
                    is_show_path = true;
                    if(if_lasso){
                        that._change_lasso_mode();
                    }
                    that.show_selection_nodes_path();
                    $("#fisheye-btn").css("background-color", btn_select_color);
                    fisheye_btn_path.attr("stroke", "white").attr("fill", "white");
                }
            });

        $("#home-btn")
            .click(function () {
                view.data_manager.graph_home();
            });

        $("#refresh-btn")
            .click(function () {
                //TODO DG
                let selected_idxs = view.get_highlights();
                console.log("click apply-delete-btn", selected_idxs);
                view.data_manager.local_update_k(selected_idxs);
            });

        that.add_btn_style();
    };

    that.add_btn_style = function() {
        let btn_ids = ["apply-delete-btn", "lasso-btn", "fisheye-btn", "home-btn", "refresh-btn"];
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
        for(let node_id of new_selection_tmp){
            if(view.get_visible_items()[node_id] === true) new_selection.push(node_id);
        }
        if(new_selection.length === 0){
            console.log("lasso size = 0");
            return
        }
        that.highlight(view.get_nodes(), new_selection);
    };

    that.highlight = function(nodes, select_ids) {
        view.data_manager.update_image_view(select_ids);
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
        }
        else {
            view.fetch_points(select_ids, new_ids, "highlight", select_ids);
        }
    };

    that.show_selection_nodes_path = function () {
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
            if(d.path === -1){
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
                    nodes[id].path = data[id];
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
                let predict_label = d.label[d.label.length-1];
                for (let source_node of d.path) {
                    let s = source_node;
                        let e = d.id;
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
            let must_show_nodes = [];
            for(let node_id in path_nodes){
                if(nodes[node_id] === undefined) new_nodes.push(parseInt(node_id));
                must_show_nodes.push(parseInt(node_id))
            }
            // focus_node = JSON.parse(JSON.stringify(path_nodes));
            if(new_nodes.length === 0){
                console.log("no new nodes added");
                view.data_manager.show_path_node(selection_nodes);
            }
            else {
                console.log("fetch nodes");
                view.fetch_points(must_show_nodes, new_nodes, "showpath", selection_nodes);
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

    that.init = function () {
        that._init();
    }.call();
};