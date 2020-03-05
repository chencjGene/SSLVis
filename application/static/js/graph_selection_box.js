/*
* added by Changjian Chen, 20200305
* */
GraphLayout.prototype.update_selection_box = function(){
    let that = this;
    that._create_selection_box();
    that._update_selection_box();
    that._remove_selection_box();
};

GraphLayout.prototype._create_selection_box = function(){
    let that = this;
    

    // let drag = function() {
    //     function dragstarted(d) {
    //         console.log("start dragstarted");
    //     }
      
    //     function dragged(d) {
    //       d3.select(this).attr("x", d.x = d3.event.x).attr("y", d.y = d3.event.y);
    //     }
      
    //     function dragended(d) {

    //     }
      
    //     return d3.drag()
    //         .on("start", dragstarted)
    //         .on("drag", dragged)
    //         .on("end", dragended);
    //   }
    let drag = d3.drag()
            .on("start", function(){
                console.log("start dragstarted");
                d3.event.sourceEvent.stopPropagation();
            })
            .on("drag", function(d){
                d3.select(this).attr("x", d.x = d3.event.x).attr("y", d.y = d3.event.y)
            })
            .on("end", function(){

            });

    that.selection_group.selectAll(".selection-box")
        .data(that.selection_box)
        .enter()
        .append("rect")
        .attr("class", "selection-box")
        .attr("width", 400)
        .attr("height", 400)
        .attr("x", 100)
        .attr("y", 100)
        .style("fill", "none")
        .style("stroke-width", 2)
        .style("stroke", "gray")
        .style("cursor", "pointer")
        .call(drag);
};

GraphLayout.prototype._update_selection_box = function(){

};

GraphLayout.prototype._remove_selection_box = function(){

};