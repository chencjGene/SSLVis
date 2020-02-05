
let HistoryLayout = function (container) {
    let that = this;
    that.container = container;

    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let layout_width = width - 20;
    let layout_height = height - 20;
    let history_data = [
        {
            add_edges_cnt:Math.floor((Math.random()-0.5)*5+5),
            delete_edges_cnt:Math.floor((Math.random()-0.5)*5+5),
            label_change_cnt:Math.floor((Math.random()-0.5)*5+5),
            node_delete_cnt:Math.floor((Math.random()-0.5)*5+5),
            margin:0.1,
            children:[1]
        },
        {
            add_edges_cnt:Math.floor((Math.random()-0.5)*5+5),
            delete_edges_cnt:Math.floor((Math.random()-0.5)*5+5),
            label_change_cnt:Math.floor((Math.random()-0.5)*5+5),
            node_delete_cnt:Math.floor((Math.random()-0.5)*5+5),
            margin:0.1,
            children:[2,3]
        },
        {
            add_edges_cnt:Math.floor((Math.random()-0.5)*5+5),
            delete_edges_cnt:Math.floor((Math.random()-0.5)*5+5),
            label_change_cnt:Math.floor((Math.random()-0.5)*5+5),
            node_delete_cnt:Math.floor((Math.random()-0.5)*5+5),
            margin:0.1,
            children:[]
        },
        {
            add_edges_cnt:Math.floor((Math.random()-0.5)*5+5),
            delete_edges_cnt:Math.floor((Math.random()-0.5)*5+5),
            label_change_cnt:Math.floor((Math.random()-0.5)*5+5),
            node_delete_cnt:Math.floor((Math.random()-0.5)*5+5),
            margin:0.1,
            children:[4]
        },
        {
            add_edges_cnt:Math.floor((Math.random()-0.5)*5+5),
            delete_edges_cnt:Math.floor((Math.random()-0.5)*5+5),
            label_change_cnt:Math.floor((Math.random()-0.5)*5+5),
            node_delete_cnt:Math.floor((Math.random()-0.5)*5+5),
            margin:0.1,
            children:[]
        }
    ];
    let data_manager = null;
    let svg = null;
    let node_color = "rgb(127,127,127)";

    that._init = function () {
        svg = container.select("#history-view");
    };

    that.set_data_manager = function(new_data_manager) {
        data_manager = new_data_manager;
    };

    that.component_update = function(state) {
        that._update_data(state.history_data);
        that._update_view();
    };

    that._update_data = function(new_history_data) {
        history_data = new_history_data;
    };

    that._update_view = function() {
        // set svg size
        let row_cnt = history_data.length;
        let row_height = 100;
        let row_offset = 10;
        let svg_height = row_height*row_cnt+row_offset;
        svg.attr("height", svg_height);

        // draw row
        let node_offset_x = 20;
        let node_offset_y = 40;
        for(let row_idx=0; row_idx<row_cnt; row_idx++){
            let row_data = history_data[row_idx];
            //draw group
            let group = svg.append("g")
                .attr("id", "history-"+row_idx);
            //draw node
            let node = group.append("circle")
                .attr("cx", node_offset_x)
                .attr("cy", row_height*(row_idx+0.5)+row_offset)
                .attr("r", 5)
                .attr("fill", node_color);
            //draw rect
            let x = d3.scaleBand().rangeRound([width*0.2, width*0.6], .05).paddingInner(0.05).domain(d3.range(4));
            let y = d3.scaleLinear().range([row_height*(row_idx+0)+row_offset, row_height*(row_idx+0.6)+row_offset]).domain([0, 10]);
            let rect_data = [
                row_data.add_edges_cnt,
                row_data.delete_edges_cnt,
                row_data.label_change_cnt,
                row_data.node_delete_cnt
            ];
            let rects = group.append("g").attr("id","group-bar-chart-"+row_idx).selectAll("rect").data(rect_data);
            rects
                .enter()
                .append("rect")
                .attr("class", "widget-bar-chart")
                .style("fill", "rgb(127, 127, 127)")
                .attr("x", function(d, i) { return x(i); })
                .attr("width", x.bandwidth())
                .attr("y", function(d, i) { return y(d); })
                .attr("height", function(d) {
                    return row_height*(row_idx+0.8)+row_offset - y(d);
                })
                .attr("opacity", 1);
            // draw margin
            let margin = group.append("text")
                .attr("font-family", '"Helvetica Neue", Helvetica, Arial, sans-serif')
                .attr("font-size", "13px")
                .attr("font-weight", 700)
                .attr("fill", "#333333")
                .attr("x", width*0.65)
                .attr("y", row_height*(row_idx+0.5)+row_offset)
                .attr("text-anchor", "start")
                .text("Margin:"+row_data.margin)
        }

        //draw line
        let lines = [];
        for(let row_idx=0; row_idx<row_cnt; row_idx++){
            let row_data = history_data[row_idx];
            for(let child of row_data.children){
                lines.push([row_idx, child]);
            }
        }
        let lineGenerator = d3.line().curve(d3.curveCardinal.tension(0));
        svg.selectAll("path")
                .data(lines)
                .enter()
                .append("path")
                .attr("stroke-width", 2.0)
                .attr("stroke", node_color)
                .attr("fill-opacity", 0)
                .attr("d", function (d) {
                    let begin_idx = d[0];
                    let end_idx = d[1];
                    let begin = [node_offset_x, row_height*(begin_idx+0.5)+row_offset];
                    let end = [node_offset_x, row_height*(end_idx+0.5)+row_offset];
                    // let mid = [(begin[0]+end[0])/2, (begin[1]+end[1])/2];
                    let mid = [node_offset_x+30, row_height*((begin_idx+end_idx)/2+0.5)+row_offset];
                    return lineGenerator([begin,mid, end]);
                })
    };

    that.init = function () {
        that._init();
    }.call();
};