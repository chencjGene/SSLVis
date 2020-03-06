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

            });
    let transform = that.get_transform();
    console.log("get transform:", transform);
    let sg = that.selection_group.selectAll(".selection-box")
        .data(that.selection_box)
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
        .style("stroke-width", 4)
        .style("stroke", "gray")
        .style("cursor", "move");
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
            .on("click", function(d, i){
                that.selection_box.splice(i, 1);
                that._remove_selection_box();
            })
    cross_group.append("line")
            .attr("class", "cross-line-hide")
            .attr("x1", -5)
            .attr("y1", -5)
            .attr("x2", 5)
            .attr("y2", 5);
    cross_group.append("line")
            .attr("class", "cross-line-hide")
            .attr("x1", -5)
            .attr("y1", 5)
            .attr("x2", 5)
            .attr("y2", -5);
    cross_group.append("rect")
            .attr("class", "cross-background")
            .attr("x", -5 * 1.5)
            .attr("y", -5 * 1.5)
            .attr("width", 10 * 1.5)
            .attr("height", 10 * 1.5)
            .style("opacity", 0);
};

GraphLayout.prototype._update_selection_box = function(){
    let that = this;
    let transform = that.get_transform();
    let sg = that.selection_group.selectAll(".selection-box")
        .data(that.selection_box)
        .attr("transform", d => "translate("+(d.x)+","+ (d.y) +")");
    sg.selectAll(".box")
        .attr("width", d => d.width)
        .attr("height", d => d.height);
    sg.select(".cross")
    .attr("transform", d => "translate("+(d.width - 10)+","+ (10) +")");

    for(let i = 0; i < that.selection_box.length; i++){
        let nodes = Object.values(that.get_nodes())
            .filter(d => inbox(that.selection_box[i], that.center_scale_x(d.x), that.center_scale_y(d.y)));
        that.selection_box[i].nodes = nodes;
    }

    if (that.selection_box.length > 0){
        let selection_idxs = that.selection_box[0].nodes.map(d => d.id);
        that.highlight(selection_idxs);
    }

};

GraphLayout.prototype._remove_selection_box = function(){
    let that = this;
    that.selection_group.selectAll(".selection-box")
        .data(that.selection_box)
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
            "height": 0.1
        })
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
    })
};

GraphLayout.prototype.remove_rect_selection = function(){

};