
let HistoryLayout = function (container) {
    let that = this;
    that.container = container;

    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let margin_horizontal = 10;
    let layout_width = width - margin_horizontal * 2;
    let layout_height = height - 20;
    let title_height = 30;
    let action_id_center = layout_width * 0.1;
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
            .style("height", (height-35)+"px");
        svg.attr("width", layout_width)
            .attr("height", layout_height);
        line_group.attr("transform", "translate(" + margin_horizontal + ", " + title_height + ")");
        cell_group.attr("transform", "translate(" + margin_horizontal + ", " + title_height + ")");
        title_group.attr("transform", "translate(" + margin_horizontal + ", " + 0 + ")");

        // title_data = [
        //     ["Action id", action_id_center],
        //     ["Changes", cell_center],
        //     ["Entropy", text_center]
        // ];
        // title_group.selectAll("text")
        //     .data(title_data)
        //     .enter()
        //     .append("text")
        //     .attr("font-family", '"Helvetica Neue", Helvetica, Arial, sans-serif')
        //     .attr("font-size", "13px")
        //     .attr("font-weight", 700)
        //     .attr("fill", "#333333")
        //     .attr("text-anchor", "middle")
        //     .attr("x", d => d[1])
        //     .attr("y", title_height * 0.7)
        //     .text(d => d[0]);
        // title_group.append("rect")
        //     .attr("x", 0)
        //     .attr("y", title_height * 0.8)
        //     .attr("width", cell_width)
        //     .attr("height", 1)
        //     .style("fill", "rgb(222,222,222)");
    };

    that.set_data_manager = function(new_data_manager) {
        data_manager = new_data_manager;
    };

    that.component_update = function(state) {
        that._update_data(state.history_data);
        that._update_view();
    };

    that._update_data = function(new_history_data) {
        // DEBUG
        new_history_data = [
            {
                dist: [0.83, 0.58, 0.39, 0.41], 
                margin: 0.0,
                children: [1],
                id: 0,
            },
            {
                dist: [0.83, 0.58, 0.39, 0.41], 
                margin: 0.1,
                children: [2],
                id: 1,
            },    
            {
                dist: [0.83, 0.58, 0.39, 0.41], 
                margin: 0.2,
                children: [],
                id: 2,
            }
        ]

        that.history_data = new_history_data.reverse();
        that.line_data = [];
        for(let row_idx = 0; row_idx < that.history_data.length; row_idx++){
            let row_data = that.history_data[row_idx];
            for(let child of row_data.children){
                that.line_data.push([row_idx, child]);
            }
        }
    };

    that._update_view = function() {
        that._create();
        that._update();
        that._remove();
        // // set svg size
        // let row_cnt = history_data.length;
        // let row_height = 100;
        // let row_offset = 10;
        // let svg_height = row_height*row_cnt+row_offset;
        // svg.attr("height", svg_height);
        // svg.selectAll("*").remove();
        // // draw row
        // let node_offset_x = 20;
        // let node_offset_y = 40;
        // for(let row_idx=0; row_idx<row_cnt; row_idx++){
        //     let row_data = history_data[row_idx];
        //     //draw group
        //     let group = svg.append("g")
        //         .attr("id", "history-"+row_idx);
        //     //draw node
        //     let node = group.append("circle")
        //         .attr("cx", node_offset_x)
        //         .attr("cy", row_height*(row_idx+0.5)+row_offset)
        //         .attr("r", 5)
        //         .attr("fill", node_color);
        //     //draw rect
        //     let x = d3.scaleBand().rangeRound([width*0.2, width*0.6], .1).paddingInner(0.2).domain(d3.range(4));
        //     let y = d3.scaleLinear().range([row_height*(row_idx+0)+row_offset, row_height*(row_idx+0.6)+row_offset]).domain([0, 10]);
        //     let rect_data = row_data.dist;
        //     let rects = group.append("g").attr("id","group-bar-chart-"+row_idx).selectAll("rect").data(rect_data);
        //     rects
        //         .enter()
        //         .append("rect")
        //         .attr("class", "widget-bar-chart")
        //         .style("fill", "rgb(127, 127, 127)")
        //         .attr("x", function(d, i) { return x(i); })
        //         .attr("width", x.bandwidth())
        //         .attr("y", function(d, i) { return y(d); })
        //         .attr("height", function(d) {
        //             return row_height*(row_idx+0.8)+row_offset - y(d);
        //         })
        //         .attr("opacity", 1);
        //     // draw margin
        //     let margin = group.append("text")
        //         .attr("font-family", '"Helvetica Neue", Helvetica, Arial, sans-serif')
        //         .attr("font-size", "13px")
        //         .attr("font-weight", 700)
        //         .attr("fill", "#333333")
        //         .attr("x", width*0.65)
        //         .attr("y", row_height*(row_idx+0.5)+row_offset)
        //         .attr("text-anchor", "start")
        //         .text("Entropy:"+row_data.margin)
        // }

    };

    that._create = function(){
        // create cells
        console.log("history_data", that.history_data);
        that.cells = cell_group.selectAll("g.cell")
            .data(that.history_data)
            .enter()
            .append("g")
            .attr("class", "cell")
            .attr("transform", (_,i) => "translate(" + 0 + ", " + i * cell_height + ")");
        // that.cells.append("rect")
        //     .attr("class", "backgroud")
        //     .attr("x", 0)
        //     .attr("y", 1)
        //     .attr("width", cell_width)
        //     .attr("height", cell_height - 1)
        //     .style("fill", "white");
        that.cells.append("rect")
            .attr("class", ".bottom-line")
            .attr("x", 0)
            .attr("y", cell_height)
            .attr("width", cell_width)
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
            .attr("y", cell_height * 0.7)
            .attr("text-anchor", "start")
            .text(d => d.margin);


        // //draw line
        // let lineGenerator = d3.line().curve(d3.curveCardinal.tension(0));
        // line_group.selectAll("path")
        //     .data(that.line_data)
        //     .enter()
        //     .append("path")
        //     .attr("stroke-width", 2.0)
        //     .attr("stroke", node_color)
        //     .attr("fill-opacity", 0)
        //     .attr("d", function (d) {
        //         let node_offset_x = 20;
        //         let row_height = cell_height;
        //         let row_offset = 10;
        //         let begin_idx = d[0];
        //         let end_idx = d[1];
        //         let begin = [node_offset_x, row_height*(begin_idx+0.5)+row_offset];
        //         let end = [node_offset_x, row_height*(end_idx+0.5)+row_offset];
        //         if(end_idx === begin_idx + 1){
        //             return lineGenerator([begin, end]);
        //         }
        //         // let mid = [(begin[0]+end[0])/2, (begin[1]+end[1])/2];
        //         let mid1 = [node_offset_x, row_height*(begin_idx+0.5)+row_offset+1];
        //         let mid11 = [node_offset_x+20, row_height*(begin_idx+0.5)+row_offset+20];
        //         let mid2 = [node_offset_x+20, row_height*(end_idx+0.5)+row_offset-20];
        //         let mid22 = [node_offset_x, row_height*(end_idx+0.5)+row_offset-1];
        //         return lineGenerator([begin,mid1, mid11, mid2,mid22, end]);
        //     })
    };

    that._update =  function() {

    };

    that._remove = function() {

    };

    that.init = function () {
        that._init();
    }.call();
};