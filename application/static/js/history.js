
let HistoryLayout = function (container) {
    let that = this;
    that.container = container;

    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let margin_horizontal = 10;
    let layout_width = width - margin_horizontal * 2;
    let layout_height = height * 0.8;
    let title_height = 30;
    let action_id_center = layout_width * 0.15;
    let cell_center = layout_width * 0.5;
    let text_center = layout_width * 0.85;
    let cell_height = 60;
    let cell_width = layout_width;
    let dist_start = cell_center - layout_width * 0.2;
    let dist_width = layout_width * 0.1;
    let data_manager = null;

    that.svg = container.select("#history-view").append("svg");
    that.line_group = that.svg.append("g").attr("id", "line");
    that.cell_group = that.svg.append("g").attr("id", "cell");

    let node_color = "rgb(127,127,127)";

    that._init = function () {
        container.select("#history-view")
            .style("height", (height * 0.80)+"px");
        that.svg.attr("width", width)
            .attr("height", layout_height);
        that.line_group.attr("transform", "translate(" + margin_horizontal + ", " + 0 + ")");
        that.cell_group.attr("transform", "translate(" + margin_horizontal + ", " + 0 + ")");
    };

    that.set_data_manager = function(new_data_manager) {
        data_manager = new_data_manager;
    };

    that.component_update = function(state) {
        that._update_data(state.history_data);
        that._update_view();
    };

    that._update_data = function(data) {
        that.history_data = data.history.reverse();
        that.focus_id = data.current_id;
        that.line_data = [];
        let cnt = that.history_data.length
        for(let row_idx = 0; row_idx < cnt; row_idx++){
            let row_data = that.history_data[row_idx];
            let end_idx = row_data.id;
            let end_point = {
                x: action_id_center,
                y: (cnt - end_idx - 0.5) * cell_height 
            };
            for(let start_idx of row_data.children){
                let start_point = {
                    x: action_id_center,
                    y: (cnt - start_idx - 0.5) * cell_height
                };
                let d = null;
                if ((start_idx - end_idx) == 1){
                    d = change_straight(start_point, end_point);
                }
                else{
                    d = change_path(start_point, end_point, 30, 40);
                }
                that.line_data.push({
                    "path": d,
                    "id": start_idx + "-" + end_idx
                });
            }
        }

        if (cnt * cell_height > layout_height){
            that.svg.attr("height", cnt * cell_height);
        }
    };

    that._update_view = function() {
        that._create();
        that._update();
        that._remove();
    };

    that._create = function(){
        // create cells
        console.log("history_data", that.history_data);
        that.cells = that.cell_group.selectAll("g.cell")
            .data(that.history_data, d => d.id)
            .enter()
            .append("g")
            .attr("class", "cell")
            .attr("id", d => "id-" + d.id)
            .attr("transform", 
                (_,i) => "translate(" + 0 + ", " + i * cell_height + ")")
            .on("mouseover", that.highlight)
            .on("mouseout", that.delighlight);
        that.cells.append("rect")
            .attr("class", "background")
            .attr("x", 0)
            .attr("y", 1)
            .attr("width", cell_width)
            .attr("height", cell_height - 1)
            .style("fill", "white")
            .style("fill-opacity", 0);
        that.cells.append("circle")
            .attr("class", "action-circle")
            .attr("cx", action_id_center)
            .attr("cy", cell_height * 0.5)
            .attr("r", 10)
            .style("fill", d => d.id === that.focus_id ? 
                "rgb(127, 127, 127)" : "rgb(222, 222, 222)")
            .on("click", function(d){
                that.focus_id = d.id;
                data_manager.set_history(that.focus_id);
                that._update();
            })
        that.cells.append("text")
            .attr("class", "action-id")
            .attr("text-anchor", "middle")
            .attr("x", action_id_center)
            .attr("y", cell_height * 0.5 + 4.5)
            .text(d => d.id);
        that.cells.append("rect")
            .attr("class", ".bottom-line")
            .attr("x", action_id_center + margin_horizontal)
            .attr("y", cell_height)
            .attr("width", cell_width - action_id_center - margin_horizontal)
            .attr("height", 1)
            .style("fill", "rgb(222,222,222)");
        that.cells.selectAll("rect.change")
            .data(d=>d.dist)
            .enter()
            .append("rect")
            .attr("class", "change")
            .attr("x", (_,i) => dist_start + i * dist_width)
            .attr("y", d => cell_height - d * cell_height)
            .attr("width", dist_width * 0.95)
            .attr("height", d => d * cell_height)
            .style("fill", node_color);
        that.cells.append("text")
            .attr("font-family", '"Helvetica Neue", Helvetica, Arial, sans-serif')
            .attr("font-size", "13px")
            .attr("font-weight", 700)
            .attr("fill", "#333333")
            .attr("text-anchor", "middle")
            .attr("x", text_center)
            .attr("y", cell_height * 0.5 + 4.5)
            .attr("text-anchor", "start")
            .text(d => d.margin);


        // //draw line
        that.line_group.selectAll("path")
            .data(that.line_data, d => d.id)
            .enter()
            .append("path")
            .attr("stroke-width", 2.0)
            .attr("fill-opacity", 0)
            .attr("stroke", node_color)
            .style("stroke", "rgb(222, 222, 222)")
            .attr("d", d => d.path)
    };

    that._update =  function() {
        // update cells
        that.cells = that.cell_group.selectAll("g.cell")
            .data(that.history_data, d => d.id)
            .attr("transform", (_,i) => "translate(" + 0 + ", " + i * cell_height + ")");
        that.cells.select("circle")
            .style("fill", d => d.id === that.focus_id ?
                "rgb(127, 127, 127)" : "rgb(222, 222, 222)");

        // update lines
        that.line_group.selectAll("path")
            .data(that.line_data, d => d.id)
            .attr("d",d => d.path)
        
    };

    that._remove = function() {
        // remove cells
        that.cells = that.cell_group.selectAll("g.cell")
            .data(that.history_data, d => d.id)
            .exit()
            .remove();

        // remove lines
        that.line_group.selectAll("path")
        .data(that.line_data, d => d.id)
        .exit()
        .remove();

    };

    that.highlight = function(d){
        console.log("highlight in History view");
        that.cell_group.select("#id-" + d.id)
            .select("rect.background")
            .style("fill-opacity", 0.1)
            .style("fill", "gray");
    };

    that.delighlight = function(){
        console.log("dehighlight in History view");
        that.svg.selectAll("g.cell")
            .select("rect.background")
            .style("fill-opacity", 0);
    };

    that.init = function () {
        that._init();
    }.call();
};