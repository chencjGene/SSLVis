/*
* added by Changjian Chen, 20200305
* */

function inbox(box, x, y){
    if (x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height){
        return true;
    }
    else{
        return false;
    }
}

GraphLayout.prototype.update_selection_box = function(){
    let that = this;
    that._create_selection_box();
    that._update_selection_box();
    that._remove_selection_box();
};

GraphLayout.prototype.update_snapshot = function(){
    let that = this;
    // update data
    for (let i = 0; i < that.selection_box.length; i++){
        that.selection_box[i].snapshot_edge = {
            "in": 0,
            "out": 0,
            "within": 0,
            "between": new Array(that.selection_box.length).fill(0)
        };
    }
    // edge type: in out within between
    // type in
    let single_paths = that.all_path["in"];
    for (let i = 0; i < single_paths.length; i++){
        let path = single_paths[i];
        let box_id = path[1].box_id;
        that.selection_box[box_id].snapshot_edge["in"] += 1;
    }

    // type out
    single_paths = that.all_path["out"]
    for (let i = 0; i < single_paths.length; i++){
        let path = single_paths[i];
        let box_id = path[0].box_id;
        that.selection_box[box_id].snapshot_edge["out"] += 1;
    }

    // type within
    single_paths = that.all_path["within"]
    for (let i = 0; i < single_paths.length; i++){
        let path = single_paths[i];
        let box_id = path[0].box_id;
        that.selection_box[box_id].snapshot_edge["within"] += 1;
    }

    // type between
    single_paths = that.all_path["between"]
    for (let i = 0; i < single_paths.length; i++){
        let path = single_paths[i];
        let source_box_id = path[0].box_id;
        let target_box_id = path[1].box_idx;
        that.selection_box[source_box_id].snapshot_edge["between"][target_box_id] += 1;
    }

    // get edges
    that.snapshot_edge = [];
    for (let i = 0; i < that.selection_box.length; i++){
        let box = that.selection_box[i];
        let edge = null;

        // in edge
        if (box.snapshot_edge["in"] > 0){
            edge = [box, box, box.snapshot_edge["in"]];
            that.snapshot_edge.push(edge);
        }

        // out edge
        if (box.snapshot_edge["out"] > 0){
            edge = [box, box, box.snapshot_edge["out"]];
            that.snapshot_edge.push(edge);
        }

        // within edge
        if (box.snapshot_edge["within"] > 0){
            edge = [box, box, box.snapshot_edge["within"]];
            that.snapshot_edge.push(edge);
        }

        // between edge
        for (let j = 0; j < that.selection_box.length; j++){
            let count = box.snapshot_edge["between"][j];
            if (count > 0){
                edge = [box, that.selection_box[j], count];
                that.snapshot_edge.push(edge);
            }
        }
    }

    that._create_snapshot();
    that._update_snapshot();
    that._remove_snapshot();
};

GraphLayout.prototype._create_selection_box = function(){
    let that = this;

    let drag = d3.drag()
            .on("start", function(){
                console.log("start dragstarted");
                d3.event.sourceEvent.stopPropagation();
            })
            .on("drag", function(d){
                // d3.select(this).attr("x", d.x = d3.event.x).attr("y", d.y = d3.event.y)
                d.x = d3.event.x;
                d.y = d3.event.y;
                that._update_selection_box();
            })
            .on("end", function(){
                that.show_edges();
            });
    let transform = that.get_transform();
    console.log("get transform:", transform);
    let sg = that.selection_group.selectAll(".selection-box")
        .data(that.selection_box, d => d.id)
        .enter()
        .append("g")
        .attr("class", "selection-box")
        .attr("transform", d => "translate("+(d.x)+","+ (d.y) +")")
        .call(drag);
    sg.append("rect")
        .attr("class", "box")
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("x", d => 0)
        .attr("y", d => 0)
        .style("fill", "white")
        .style("fill-opacity", 0)
        .style("stroke-width", 4 * that.zoom_scale)
        .style("stroke", "gray")
        .style("cursor", "move");
    let resize_box_group = sg.append("g")
        .attr("class", "resize");
    resize_box_group.append("rect")
        .attr("class", "resize-rect")
        .attr("id", "resize_rect_right_bottom")
        .attr("x", d => d.width - 5 * that.zoom_scale)
        .attr("y", d => d.height - 5 * that.zoom_scale)
        .attr("width", 10 * that.zoom_scale)
        .attr("height", 10 * that.zoom_scale)
        .attr("fill", "gray")
        .attr("stroke-width", 0)
        .style("cursor", "nw-resize")
        .call(d3.drag().on("start", function () {
            d3.event.sourceEvent.stopPropagation();
        }).on("drag", function (d) {
                let event = d3.mouse(that.main_group.node());
                d.width = event[0] - d.x;
                d.height= event[1] - d.y;

                that._update_selection_box();
        })).on("end", function(){
            that.show_edges();
        });
    resize_box_group.append("rect")
        .attr("class", "resize-rect")
        .attr("id", "resize_rect_left_top")
        .attr("x", -5 * that.zoom_scale)
        .attr("y", -5 * that.zoom_scale)
        .attr("width", 10  * that.zoom_scale)
        .attr("height", 10  * that.zoom_scale)
        .attr("fill", "gray")
        .attr("stroke-width", 0)
        .style("cursor", "nw-resize")
        .call(d3.drag().on("start", function () {
            d3.event.sourceEvent.stopPropagation();
        }).on("drag", function (d) {
                let event = d3.mouse(that.main_group.node());
                d.width =d.x+d.width- event[0];
                d.height=d.y+d.height-event[1];
                d.x = event[0];
                d.y = event[1];

                that._update_selection_box();
        }));

    let cross_group = sg.append("g")
            .attr("class", "cross")
            .attr("transform", d => "translate("+(d.width - 10 * that.zoom_scale)+","+ (10 * that.zoom_scale) +")")
            .on("mouseover", function(){
                console.log("cross mouse over");
                d3.select(this).selectAll("line")
                    .classed("cross-line-hide", false)
                    .classed("cross-line", true);
            })
            .on("mouseout", function(){
                console.log("cross mouse out");
                d3.select(this).selectAll("line")
                .classed("cross-line-hide", true)
                .classed("cross-line", false);
            })
            .on("click", function(d){
                for(let i = 0; i < that.selection_box.length; i++){
                    if (that.selection_box[i].id === d.id){
                        that.selection_box.splice(i, 1);
                        break;
                    }
                }
                that._remove_selection_box();
                that.show_edges();
            })
    cross_group.append("line")
            .attr("id", "cross-line-1")
            .attr("class", "cross-line-hide")
            .attr("x1", -5 * that.zoom_scale)
            .attr("y1", -5 * that.zoom_scale)
            .attr("x2", 5 * that.zoom_scale)
            .attr("y2", 5 * that.zoom_scale)
            .style("stroke-width", 2  * that.zoom_scale);
    cross_group.append("line")
            .attr("id", "cross-line-2")
            .attr("class", "cross-line-hide")
            .attr("x1", -5 * that.zoom_scale)
            .attr("y1", 5 * that.zoom_scale)
            .attr("x2", 5 * that.zoom_scale)
            .attr("y2", -5 * that.zoom_scale)
            .style("stroke-width", 2  * that.zoom_scale);
    cross_group.append("rect")
            .attr("class", "cross-background")
            .attr("x", -5 * 1.5 * that.zoom_scale)
            .attr("y", -5 * 1.5 * that.zoom_scale)
            .attr("width", 10 * 1.5 * that.zoom_scale)
            .attr("height", 10 * 1.5 * that.zoom_scale)
            .style("opacity", 0);

};

GraphLayout.prototype._update_selection_box = function(){
    let that = this;
    let transform = that.get_transform();

    // update data
    for(let i = 0; i < that.selection_box.length; i++){
        let nodes = Object.values(that.get_nodes())
            .filter(d => inbox(that.selection_box[i], that.center_scale_x(d.x), that.center_scale_y(d.y)));
        that.selection_box[i].nodes = nodes;
        let label_dist = nodes.map(d =>d.label.slice(-1)[0]);
        let label_count = new Array(12).fill(0);
        label_dist.forEach(b => {label_count[b] = label_count[b] + 1});
        let max_count_cls = -1;
        let max_count = -1
        for (let i = 0; i < label_count.length; i++){
            if(label_count[i] > max_count){
                max_count = label_count[i];
                max_count_cls = i;
            }
        }
        that.selection_box[i].label_count = label_count;
        that.selection_box[i].max_count_cls = max_count_cls;
    }

    // TODO: highlight 
    if (that.selection_box.length > 0){
        d3.selectAll(".node-dot").attr("r", d => 3.5 * that.zoom_scale);
        for (let j = 0; j < that.selection_box.length; j++){
            let selection_idxs = that.selection_box[j].nodes.map(d => d.id);
            // that.highlight(selection_idxs);
            for (let i = 0; i < selection_idxs.length; i++){
                d3.select("#id-" + selection_idxs[i])
                    .attr("r", d => 5 * that.zoom_scale);
            }
        }
    }

    let sg = that.selection_group.selectAll(".selection-box")
        .data(that.selection_box, d => d.id)
        .attr("transform", d => "translate("+(d.x)+","+ (d.y) +")");
    sg.selectAll(".box")
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .style("stroke-width", 4 * that.zoom_scale)
        .style("stroke", d => CategoryColor[d.max_count_cls]);
    let cross_group = sg.select(".cross")
        .attr("transform", d => "translate("+(d.width - 10 * that.zoom_scale)+","+ (10 * that.zoom_scale) +")");
    cross_group.select("#cross-line-1")
        .attr("x1", -5 * that.zoom_scale)
        .attr("y1", -5 * that.zoom_scale)
        .attr("x2", 5 * that.zoom_scale)
        .attr("y2", 5 * that.zoom_scale)
        .style("stroke-width", 2  * that.zoom_scale);
    cross_group.select("#cross-line-2")
        .attr("x1", -5 * that.zoom_scale)
        .attr("y1", 5 * that.zoom_scale)
        .attr("x2", 5 * that.zoom_scale)
        .attr("y2", -5 * that.zoom_scale)
        .style("stroke-width", 2  * that.zoom_scale);
    cross_group.select("rect")
        .attr("x", -5 * 1.5 * that.zoom_scale)
        .attr("y", -5 * 1.5 * that.zoom_scale)
        .attr("width", 10 * 1.5 * that.zoom_scale)
        .attr("height", 10 * 1.5 * that.zoom_scale);


    sg.select(".resize").select("#resize_rect_right_bottom")
        .attr("x", d => d.width-5 * that.zoom_scale)
        .attr("y", d => d.height-5 * that.zoom_scale)
        .attr("width", 10 * that.zoom_scale)
        .attr("height", 10 * that.zoom_scale)
        .style("fill", d => CategoryColor[d.max_count_cls]);
    sg.select(".resize").select("#resize_rect_left_top")
        .attr("x", -5 * that.zoom_scale)
        .attr("y", -5 * that.zoom_scale)
        .attr("width", 10  * that.zoom_scale)
        .attr("height", 10  * that.zoom_scale)
        .style("fill", d => CategoryColor[d.max_count_cls]);

};

GraphLayout.prototype._remove_selection_box = function(){
    let that = this;
    that.selection_group.selectAll(".selection-box")
        .data(that.selection_box, d => d.id)
        .exit()
        .remove();

};

GraphLayout.prototype.set_rect_selection = function(){
    let that = this;
    that.svg.on("mousedown", function(){
        console.log("set rect selection mousedown");
        let event = d3.mouse(that.main_group.node());
        that.selection_box.push({
            "x": event[0],
            "y": event[1],
            "width": 0.1,
            "height": 0.1,
            "id": that.selection_box_id_count
        });
        that.selection_box_id_count += 1;
        that._create_selection_box();
        // d3.event.sourceEvent.stopPropagation();
        that.svg.on("mousemove", function(){
            let event = d3.mouse(that.main_group.node());
            let start_x = that.selection_box[that.selection_box.length-1].x;
            let start_y = that.selection_box[that.selection_box.length-1].y; 
            that.selection_box[that.selection_box.length-1].width = event[0] - start_x;
            that.selection_box[that.selection_box.length-1].height = event[1] - start_y;
            that._update_selection_box();
        })
    })
    .on("mouseup", function(){
        that.svg.on("mousemove", null);
        that.show_edges();
        that.highlight_plg.reset_selection();
    })
};

GraphLayout.prototype.remove_rect_selection = function(){

};

GraphLayout.prototype._create_snapshot = function(){
    let that = this;
    let sg = that.snapshot_group.selectAll("g.snapshot")
        .data(that.selection_box, d => d.id)
        .enter()
        .append("g")
        .attr("class", "snapshot")
        .attr("transform", d => "translate("+(d.x)+","+ (d.y) +")");

    sg.append("rect")
        .attr("class", "snapshot-box")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("width", 20)
        .attr("height", 20)
        .style("fill", "white")
        .style("fill-opacity", 0)
        .style("stroke", "gray")
        .style("sroke-width", 2);
    
    let dist_group = sg.append("g")
        .attr("class", "snapshot-dist");
        dist_group.selectAll("rect")
        .data(d => d.label_count)
        .enter()
        .append("rect")
        .attr("x", (d, i) => i * 5)
        .attr("y", d => 0)
        .attr("width", 5)
        .attr("height", d => d * 10);
};

GraphLayout.prototype._update_snapshot = function(){

};

GraphLayout.prototype._remove_snapshot = function(){

};

GraphLayout.prototype.get_path = function(){
    let that = this;
    let path = {
        "in": [],
        "out": [],
        "within": [],
        "between": [],
        "in_nodes": [],
        "out_nodes": []
    };
    let highlights = [];

    for (let i in DataLoader.state.complete_graph){
        DataLoader.state.complete_graph[i].box_id = -1;
    }
    
    let all_nodes = that.selection_box.map(d => d.nodes);
    all_nodes.push(that.focus_nodes);

    for (let i = 0; i < all_nodes.length; i++){
        let focus_nodes = all_nodes[i];
        for (let j = 0; j < focus_nodes.length; j++){
            focus_nodes[j].box_id = i;
            focus_nodes[j].visited = false;
        }
    }

    for (let i = 0; i < all_nodes.length; i++){
        let focus_nodes = all_nodes[i];
        for (let j = 0; j < focus_nodes.length; j++){
            // focus_nodes[j].box_id = i;
            let node = focus_nodes[j];
            if (node.visited) continue;
            highlights.push(node.id);
             
            // process from
            let from = node.from;
            let from_weight = node.from_weight;
            for (let k = 0; k < from.length; k++){
                if (from_weight[k] > 0){
                    //TODO: it is not a safe code
                    let from_node = DataLoader.state.complete_graph[from[k]];
                    if (from_node.box_id !== undefined && from_node.box_id > -1){
                        if (from_node.box_id == node.box_id){
                            path.within.push([from_node, node, from_weight[k]]);
                        }
                        else{
                            path.between.push([from_node, node, from_weight[k]]);
                        }
                    }
                    else{
                        path.in.push([from_node, node, from_weight[k]]);
                        path.in_nodes.push(from_node);
                    }
                }
            }
            // process to
            let to = node.to;
            let to_weight = node.to_weight;
            for (let k = 0; k < to.length; k++){
                if (to_weight[k] > 0){
                    let to_node = DataLoader.state.complete_graph[to[k]];
                    if (!(to_node.box_id !== undefined && to_node.box_id > -1)){
                        path.out.push([node, to_node, to_weight[k]]);
                        path.out_nodes.push(to_node);
                    }
                }
            }

            node.visited = true;
        }
    }

    // for (let i = 0; i < that.selection_box.length; i++){
    //     let focus_nodes = that.selection_box[i].nodes;
    //     for (let j = 0; j < focus_nodes.length; j++){
    //         focus_nodes[j].box_id = -1;
    //     }
    // }

    that.all_path = path;
    that.highlights = highlights;
    return [path, highlights];
}

GraphLayout.prototype.show_edges = function(modes){
    let that = this;
    that.get_path();
    let edge_type_data = {};
    let edge_type_range = [];
    for (let i in that.all_path){
        let len = that.all_path[i].length;
        edge_type_data[i] = len;
        edge_type_range.push(i); 
    }
    that.data_manager.update_edge_type_bar(edge_type_data);
    // that.set_path();
    that.data_manager.state.path = that.all_path;
    that.data_manager.state.highlights = that.highlights;
    that.data_manager.update_graph_view();
    // that.update_snapshot();
};