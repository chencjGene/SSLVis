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
        .style("fill", "none")
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
            .attr("transform", d => "translate("+(d.width - 10)+","+ (10) +")")
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
                // that.selection_box.splice(i, 1);
                for(let i = 0; i < that.selection_box.length; i++){
                    if (that.selection_box[i].id === d.id){
                        that.selection_box.splice(i, 1);
                        break;
                    }
                }
                that._remove_selection_box();
            })
    cross_group.append("line")
            .attr("class", "cross-line-hide")
            .attr("x1", -5 * that.zoom_scale)
            .attr("y1", -5 * that.zoom_scale)
            .attr("x2", 5 * that.zoom_scale)
            .attr("y2", 5 * that.zoom_scale);
    cross_group.append("line")
            .attr("class", "cross-line-hide")
            .attr("x1", -5 * that.zoom_scale)
            .attr("y1", 5 * that.zoom_scale)
            .attr("x2", 5 * that.zoom_scale)
            .attr("y2", -5 * that.zoom_scale);
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
    let sg = that.selection_group.selectAll(".selection-box")
        .data(that.selection_box, d => d.id)
        .attr("transform", d => "translate("+(d.x)+","+ (d.y) +")");
    sg.selectAll(".box")
        .attr("width", d => d.width)
        .attr("height", d => d.height);
    sg.select(".cross")
    .attr("transform", d => "translate("+(d.width - 10)+","+ (10) +")");


    sg.select(".resize").select("#resize_rect_right_bottom")
        .attr("x", d => d.width-5 * that.zoom_scale)
        .attr("y", d => d.height-5 * that.zoom_scale);

    for(let i = 0; i < that.selection_box.length; i++){
        let nodes = Object.values(that.get_nodes())
            .filter(d => inbox(that.selection_box[i], that.center_scale_x(d.x), that.center_scale_y(d.y)));
        // let nodes = d3.selectAll(".node-dot")
        //                 .
        that.selection_box[i].nodes = nodes;
    }

    if (that.selection_box.length > 0){
        d3.selectAll(".node-dot").attr("r", 3 * that.zoom_scale);
        for (let j = 0; j < that.selection_box.length; j++){
            let selection_idxs = that.selection_box[j].nodes.map(d => d.id);
            // that.highlight(selection_idxs);
            for (let i = 0; i < selection_idxs.length; i++){
                d3.select("#id-" + selection_idxs[i])
                    .attr("r", 4 * that.zoom_scale);
            }
        }
    }

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
    })
};

GraphLayout.prototype.remove_rect_selection = function(){

};

GraphLayout.prototype.get_path = function(){
    let that = this;
    let path = {
        "from": [],
        "to": [],
        "within": [],
        "between": []
    };
    
    for (let i = 0; i < that.selection_box.length; i++){
        let focus_nodes = that.selection_box[i].nodes;
        for (let j = 0; j < focus_nodes.length; j++){
            focus_nodes[j].box_id = i;
            focus_nodes[j].visited = false;
        }
    }

    for (let i = 0; i < that.selection_box.length; i++){
        let focus_nodes = that.selection_box[i].nodes;
        for (let j = 0; j < focus_nodes.length; j++){
            // focus_nodes[j].box_id = i;
            let node = focus_nodes[j];
            if (node.visited) continue;
             
            // process from
            let from = node.from;
            let from_weight = node.from_weight;
            for (let k = 0; k < from.length; k++){
                if (from_weight[k] > 0){
                    // it is not a safe code
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
                        path.from.push([from_node, node, from_weight[k]]);
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
                        path.to.push([node, to_node, to_weight[k]]);
                    }
                }
            }

            node.visited = true;
        }
    }

    for (let i = 0; i < that.selection_box.length; i++){
        let focus_nodes = that.selection_box[i].nodes;
        for (let j = 0; j < focus_nodes.length; j++){
            focus_nodes[j].box_id = -1;
        }
    }

    that.all_path = path;
    return path;
}

GraphLayout.prototype.show_edges = function(modes){
    let that = this;
    that.get_path();
    that.set_path();
    that._update_view();
}