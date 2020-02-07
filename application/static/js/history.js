
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

    let svg = container.select("#history-view").append("svg");
    let title_group = svg.append("g").attr("id", "title");
    let line_group = svg.append("g").attr("id", "line");
    let cell_group = svg.append("g").attr("id", "cell");

    let node_color = "rgb(127,127,127)";

    that._init = function () {
        container.select("#history-view")
            .style("height", (height * 0.80)+"px");
        svg.attr("width", width)
            .attr("height", layout_height);
        line_group.attr("transform", "translate(" + margin_horizontal + ", " + 0 + ")");
        cell_group.attr("transform", "translate(" + margin_horizontal + ", " + 0 + ")");
        title_group.attr("transform", "translate(" + margin_horizontal + ", " + 0 + ")");

    };

    that.set_data_manager = function(new_data_manager) {
        data_manager = new_data_manager;
    };

    that.component_update = function(state) {
        that._update_data(state.history_data);
        that._update_view();
    };

    that._update_data = function(data) {
        // // DEBUG
        // new_history_data = [
        //     {
        //         dist: [0.83, 0.58, 0.39, 0.41], 
        //         margin: 0.0,
        //         children: [1,3],
        //         id: 0,
        //     },
        //     {
        //         dist: [0.83, 0.58, 0.39, 0.41], 
        //         margin: 0.1,
        //         children: [2],
        //         id: 1,
        //     },    
        //     {
        //         dist: [0.83, 0.58, 0.39, 0.41], 
        //         margin: 0.2,
        //         children: [],
        //         id: 2,
        //     },
        //     {
        //         dist: [0.83, 0.58, 0.39, 0.41], 
        //         margin: 0.0,
        //         children: [],
        //         id: 3,
        //     }
        // ]

        that.history_data = data.history.reverse();
        that.focus_id = data.current_id;
        that.line_data = [];
        let cnt = that.history_data.length
        for(let row_idx = 0; row_idx < cnt; row_idx++){
            let row_data = that.history_data[row_idx];
            let start_idx = row_data.id;
            let end_point = {
                x: action_id_center,
                y: (cnt - start_idx) * cell_height 
            };
            for(let child of row_data.children){
                let start_point = {
                    x: action_id_center,
                    y: (cnt - child) * cell_height 
                };
                let d = null;
                if ((child - start_idx) == 1){
                    d = change_straight(start_point, end_point);
                }
                else{
                    d = change_path(start_point, end_point, 30, 40);
                }
                that.line_data.push(d);
            }
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
        that.cells = cell_group.selectAll("g.cell")
            .data(that.history_data, d => d.id)
            .enter()
            .append("g")
            .attr("class", "cell")
            .attr("transform", (_,i) => "translate(" + 0 + ", " + i * cell_height + ")");
        that.cells.append("circle")
            .attr("class", "action-circle")
            .attr("cx", action_id_center)
            // .attr("cy", cell_height * 0.5)
            .attr("cy", cell_height)
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
            .attr("y", cell_height + 4.5)
            // .attr("y", cell_height * 0.5 + 4.5)
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
        line_group.selectAll("path")
            .data(that.line_data)
            .enter()
            .append("path")
            .attr("stroke-width", 2.0)
            .attr("fill-opacity", 0)
            .attr("stroke", node_color)
            .style("stroke", "rgb(222, 222, 222)")
            .attr("d", function (d) {
                return d;
            })
    };

    that._update =  function() {
        // update cells
        that.cells = cell_group.selectAll("g.cell")
            .data(that.history_data, d => d.id)
            .attr("transform", (_,i) => "translate(" + 0 + ", " + i * cell_height + ")");
        that.cells.select("circle")
            .style("fill", d => d.id === that.focus_id ?
                "rgb(127, 127, 127)" : "rgb(222, 222, 222)");
        
    };

    that._remove = function() {
        // update cells
        that.cells = cell_group.selectAll("g.cell")
            .data(that.history_data, d => d.id)
            .exit()
            .remove();
    };

    that.init = function () {
        that._init();
    }.call();
};