
let FilterLayout = function (container) {
    let that = this;
    that.container = container;

    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let layout_width = width - 20;
    let layout_height = height - 20;
    let widget_width = null;
    let widget_height = null;
    let data_manager = null;
    let AnimationDuration = 1000;
    let color_unlabel = UnlabeledColor;
    let color_label = CategoryColor;

    // svg
    let uncertainty_svg = null;
    let label_svg = null;
    let indegree_svg = null;
    let outdegree_svg = null;

    //data
    let label_widget_data = null;
    let label_widget_range = [-1, -1];
    let uncertainty_widget_data = null;
    let uncertainty_widget_range = [-1, -1];
    let indegree_widget_data = null;
    let indegree_widget_range = [-1, -1];
    let outdegree_widget_data = null;
    let outdegree_widget_range = [-1, -1];

    //filter flag
    let control_items = {};
    let label_items = {};
    let uncertain_items = {};
    let indegree_items = {};
    let outdegree_items = {};

    //drag
    let uncertainty_start_drag = null;
    let uncertainty_end_drag = null;
    let indegree_start_drag = null;
    let indegree_end_drag = null;
    let outdegree_start_drag = null;
    let outdegree_end_drag = null;

    //label
    let label_rect = {};

    that._init = function () {
        uncertainty_svg = container.select("#current-uncertainty-svg");
        label_svg = container.select("#current-label-svg");
        indegree_svg = container.select("#current-indegree-svg");
        outdegree_svg = container.select("#current-outdegree-svg");

        widget_width = parseInt($("#current-uncertainty-svg").width());
        widget_height = parseInt($("#current-uncertainty-svg").height());
    };

    that.set_data_manager = function(new_data_manager) {
        data_manager = new_data_manager;
    };

    that.component_update = function(state) {
        console.log("get filter state:", state);
        that._update_data(state);
        that._update_view();
    };

    that._update_data = function(state) {
        label_widget_data = state.label_widget_data;
        label_widget_range = state.label_widget_range;
        uncertainty_widget_data = state.uncertainty_widget_data;
        uncertainty_widget_range = state.uncertainty_widget_range;
        indegree_widget_data = state.indegree_widget_data;
        indegree_widget_range = state.indegree_widget_range;
        outdegree_widget_data = state.outdegree_widget_data;
        outdegree_widget_range = state.outdegree_widget_range;

        // init flags
        uncertain_items = {};
        label_items = {};
        indegree_items = {};
        outdegree_items = {};
        control_items = {};
        for(let i=0; i< uncertainty_widget_data.length; i++){
            if(i<uncertainty_widget_range[0] || i>uncertainty_widget_range[1]){
                for(let node_id of uncertainty_widget_data[i]){
                    uncertain_items[node_id] = false;
                }
            }
            else {
                for(let node_id of uncertainty_widget_data[i]){
                    uncertain_items[node_id] = true;
                }
            }
        }
        for(let i=0; i< indegree_widget_data.length; i++){
            if(i<indegree_widget_range[0] || i>indegree_widget_range[1]){
                for(let node_id of indegree_widget_data[i]){
                    indegree_items[node_id] = false;
                }
            }
            else {
                for(let node_id of indegree_widget_data[i]){
                    indegree_items[node_id] = true;
                }
            }
        }
        for(let i=0; i< outdegree_widget_data.length; i++){
            if(i<outdegree_widget_range[0] || i>outdegree_widget_range[1]){
                for(let node_id of outdegree_widget_data[i]){
                    outdegree_items[node_id] = false;
                }
            }
            else {
                for(let node_id of outdegree_widget_data[i]){
                    outdegree_items[node_id] = true;
                }
            }
        }
        for(let i=0; i< label_widget_data.length; i++){
            if(label_widget_range.indexOf(i)===-1){
                for(let node_id of label_widget_data[i]){
                    label_items[node_id] = false;
                }
            }
            else {
                for(let node_id of label_widget_data[i]){
                    label_items[node_id] = true;
                }
            }
        }
        for(let node_bins of uncertainty_widget_data){
            for(let node_id of node_bins){
                control_items[node_id] = uncertain_items[node_id]&&label_items[node_id]&&
                    indegree_items[node_id]&&outdegree_items[node_id];
            }
        }
    };

    that._update_view = function() {
        that._draw_widget(uncertainty_widget_data, uncertainty_svg, "uncertainty", uncertainty_widget_range, uncertain_items);
        that.label_scented_widget();
        that._draw_widget(indegree_widget_data, indegree_svg, "indegree", indegree_widget_range, indegree_items);
        that._draw_widget(outdegree_widget_data, outdegree_svg, "outdegree", outdegree_widget_range, outdegree_items);
    };

    that.label_scented_widget = function() {
        // label interval
        let min_label_id = -1;
        let max_label_id = 9;
        let label_cnt = max_label_id-min_label_id+1;
        function interval_idx(label_id){
            return label_id;
        }


        // label distribution
        let label_distribution = label_widget_data;
        let max_len = 0;
        for(let label_ary of label_distribution){
            if(max_len < label_ary.length){
                max_len = label_ary.length;
            }
        }

        // draw
        label_rect = {};
        let container = label_svg;
        let container_width = widget_width;
        let container_height = widget_height;
        // container.selectAll("*").remove();
        let x = d3.scaleBand().rangeRound([container_width*0.1, container_width*0.9], .05).paddingInner(0.05).domain(d3.range(label_cnt));
        let y = d3.scaleLinear().range([container_height*0.85, container_height*0.05]).domain([0, 1]);
        // draw rect

        if(container.select("#current-label-rects").size() === 0){
            container.append("g")
                .attr("id", "current-label-rects");
        }
        let rects = container.select("#current-label-rects").selectAll("rect").data(label_distribution);
        rects
            .enter()
            .append("rect")
            .attr("class", "widget-bar-chart")
            .style("fill", (d, i) => i===0?color_unlabel:color_label[i-1])
            .attr("x", function(d, i) { return x(i); })
            .attr("width", x.bandwidth())
            .attr("y", function(d, i) { return y(d.length/max_len); })
            .attr("height", function(d) {
              return container_height*0.85 - y(d.length/max_len);
          })
            .attr("opacity", (d, i) => (label_widget_range.indexOf(i) > -1)?1:0.2)
            .on("mouseover", function (d, i) {
                let rect = label_rect[i].rect;
                let checkbox = label_rect[i].checkbox;
                if(rect.attr("opacity") == 1){
                    rect.attr("opacity", 0.5);
                }
            })
            .on("mouseout", function (d, i) {
                let rect = label_rect[i].rect;
                let checkbox = label_rect[i].checkbox;
                if(rect.attr("opacity") == 0.5){
                    rect.attr("opacity", 1);
                }
            })
            .on("click", function (d, i) {
                let rect = label_rect[i].rect;
                let checkbox = label_rect[i].checkbox;
                if(rect.attr("opacity") != 0.2){
                    // no select
                    rect.attr("opacity", 0.2);
                    checkbox.attr("xlink:href", "#check-no-select");
                    for(let id of label_rect[i].data){
                        label_items[id] = false;
                    }
                    that.update_widget_showing_items(label_rect[i].data);
                    label_widget_range.splice(label_widget_range.indexOf(i), 1);
                }
                else {
                    rect.attr("opacity", 0.5);
                    checkbox.attr("xlink:href", "#check-select");
                    for(let id of label_rect[i].data){
                        label_items[id] = true;
                    }
                    that.update_widget_showing_items(label_rect[i].data);
                    label_widget_range.push(i);
                }
            })
            .each(function (d, i) {
                let rect = d3.select(this);
                label_rect[i] = {
                    label:i,
                    rect:rect,
                    data:d
                }
            });
        rects
            .each(function (d, i) {
                let rect = d3.select(this);
                label_rect[i] = {
                    label:i,
                    rect:rect,
                    data:d
                }
            });
        rects.each(function (d) {
           let rect = d3.select(this);
           if(rect.attr("opacity")==0.2){
               for(let id of d){
                   label_items[id] = false;
               }
           }
           else {
               for(let id of d){
                   label_items[id] = true;
               }
           }
        });
        rects.transition()
            .duration(AnimationDuration)
            .attr("y", function(d, i) { return y(d.length/max_len); })
            .attr("height", function(d) {
                  return container_height*0.85 - y(d.length/max_len);
              })
            .attr("opacity", (d, i) => (label_widget_range.indexOf(i) > -1)?1:0.2);
        // draw axis
        if(container.select("#current-label-axis").size() === 0){
            container.append("g")
            .attr("id", "current-label-axis")
            .append("line")
            .attr("x1", container_width*0.1)
            .attr("y1", container_height*0.85)
            .attr("x2", container_width*0.9)
            .attr("y2", container_height*0.85)
            .attr("stroke", "black")
            .attr("stroke-width", 1);
        }
        // draw checkbox
        if(container.select("#current-label-checkbox").size() === 0){
            let bandwidth = x.bandwidth()*0.7;
            let offset = x.bandwidth()*0.15;
            container.append("g")
                .attr("id", "current-label-checkbox-hover")
                .selectAll("rect")
                .data(Object.values(label_rect))
                .enter()
                .append("rect")
                .attr("x", (d, i) => x(label_rect[i].label)+offset)
                .attr("y", container_height*0.85+offset)
                .attr("width", bandwidth)
                .attr("height", bandwidth)
                .attr("opacity", 0)
                .on("mouseover", function (d, i) {
                    let rect = label_rect[i].rect;
                    let checkbox = label_rect[i].checkbox;
                    if(rect.attr("opacity") == 1){
                        rect.attr("opacity", 0.5);
                    }
                })
                .on("mouseout", function (d, i) {
                    let rect = label_rect[i].rect;
                    let checkbox = label_rect[i].checkbox;
                    if(rect.attr("opacity") == 0.5){
                        rect.attr("opacity", 1);
                    }
                })
                .on("click", function (d, i) {
                    let rect = label_rect[i].rect;
                    let checkbox = label_rect[i].checkbox;
                    if(rect.attr("opacity") != 0.2){
                        // no select
                        rect.attr("opacity", 0.2);
                        checkbox.attr("xlink:href", "#check-no-select");
                        for(let id of label_rect[i].data){
                            label_items[id] = false;
                        }
                        that.update_widget_showing_items(label_rect[i].data);
                        label_widget_range.splice(label_widget_range.indexOf(i), 1);
                    }
                    else {
                        rect.attr("opacity", 0.5);
                        checkbox.attr("xlink:href", "#check-select");
                        for(let id of label_rect[i].data){
                            label_items[id] = true;
                        }
                        that.update_widget_showing_items(label_rect[i].data);
                        label_widget_range.push(i);
                    }
                });
            container.append("g")
                .attr("id", "current-label-checkbox")
                .selectAll("use")
                .data(Object.values(label_rect))
                .enter()
                .append("use")
                .attr("xlink:href", (d, i) => label_widget_range.indexOf(i)>-1?"#check-select":"#check-no-select")
                .attr("x", (d, i) => x(label_rect[i].label)+offset)
                .attr("y", container_height*0.85+offset)
                .attr("width", bandwidth)
                .attr("height", bandwidth)
                .each(function (d, i) {
                    let checkbox = d3.select(this);
                    label_rect[i].checkbox = checkbox;
                })
        }
        else {
            container.select("#current-label-checkbox-hover")
                .selectAll("rect")
                .data(Object.values(label_rect));
            container.select("#current-label-checkbox")
                .selectAll("use")
                .data(Object.values(label_rect))
                .attr("xlink:href", (d, i) => label_widget_range.indexOf(i)>-1?"#check-select":"#check-no-select")
                .each(function (d, i) {
                    let checkbox = d3.select(this);
                    label_rect[i].checkbox = checkbox;
                });
        }
    };

    that.update_widget_showing_items = function(ids) {
        let remove_nodes = [];
        let add_nodes = [];
        for(let node_id of ids){
            let new_flag = label_items[node_id]&&uncertain_items[node_id]&&indegree_items[node_id]&&outdegree_items[node_id];
            if(new_flag === true && control_items[node_id] === false){
                add_nodes.push(node_id);
                control_items[node_id] = new_flag;
            }
            else if(new_flag === false && control_items[node_id] === true){
                remove_nodes.push(node_id);
                control_items[node_id] = new_flag;
            }

        }
        if(remove_nodes.length >0 || add_nodes.length>0){
            console.log(remove_nodes, add_nodes);
            // TODO
            data_manager.change_visible_items(control_items);
        }

    };

    that._draw_widget = function(distribution, container, type, range, visible_items){
        // distribution
        let max_len = 0;
        let bar_cnt = distribution.length;
        for(let node_ary of distribution){
            if(max_len < node_ary.length){
                max_len = node_ary.length;
            }
        }
        // draw
        let container_width = widget_width;
        let container_height = widget_height;
        let x = d3.scaleBand().rangeRound([container_width*0.1, container_width*0.9], .05).paddingInner(0.05).domain(d3.range(bar_cnt));
        let y = d3.scaleLinear().range([container_height*0.85, container_height*0.05]).domain([0, 1]);

        //draw bar chart
        if(container.select("#current-"+type+"-rects").size() === 0){
            container.append("g")
                .attr("id", "current-"+type+"-rects");
        }
        let rects = container.select("#current-"+type+"-rects").selectAll("rect").data(distribution);
        //create
        rects
            .enter()
            .append("rect")
            .attr("class", "widget-bar-chart")
            .style("fill", "rgb(127, 127, 127)")
            .attr("x", function(d, i) { return x(i); })
            .attr("width", x.bandwidth())
            .attr("y", function(d, i) { return y(d.length/max_len); })
            .attr("height", function(d) {
                return container_height*0.85 - y(d.length/max_len);
            })
            .attr("opacity", (d, i) => (i>=range[0]&&i<=range[1])?1:0.5);
        //update
        rects.transition()
            .duration(AnimationDuration)
            .attr("x", function(d, i) { return x(i); })
            .attr("width", x.bandwidth())
            .attr("y", function(d, i) { return y(d.length/max_len); })
            .attr("height", function(d) {
                return container_height*0.85 - y(d.length/max_len);
            })
            .attr("opacity", (d, i) => (i>=range[0]&&i<=range[1])?1:0.5);
        //remove
        rects.exit()
            .transition()
            .duration(AnimationDuration)
            .attr("opacity", 0)
            .remove();

        // draw x-axis
        if(container.select("#current-"+type+"-axis").size() === 0){
            container.append("g")
                .attr("id","current-"+type+"-axis")
                .append("line")
                .attr("x1", container_width*0.1)
                .attr("y1", container_height*0.85)
                .attr("x2", container_width*0.9)
                .attr("y2", container_height*0.85)
                .attr("stroke", "black")
                .attr("stroke-width", 1);
        }

        //draw dragble
        let draggable_item_path = "M0 -6 L6 6 L-6 6 Z";
        let drag_interval = x.step();
        let start_drag = null;
        let end_drag = null;
        if(container.select(".start-drag").size() === 0){
            start_drag = container.append("path")
                .attr("class", "start-drag")
                .attr("d", draggable_item_path)
                .attr("fill", "rgb(127, 127, 127)")
                .attr("transform", "translate("+(container_width*0.1+range[0]*drag_interval)+","+(container_height*0.9)+")");
            end_drag = container.append("path")
                .attr("class", "end-drag")
                .attr("d", draggable_item_path)
                .attr("fill", "rgb(127, 127, 127)")
                .attr("transform", "translate("+(container_width*0.1+(range[1]+1)*drag_interval)+","+(container_height*0.9)+")");
        }
        else {
            start_drag = container.select(".start-drag");
            end_drag = container.select(".end-drag");
            start_drag.transition()
                .duration(AnimationDuration)
                .attr("transform", "translate("+(container_width*0.1+range[0]*drag_interval)+","+(container_height*0.9)+")");
            end_drag.transition()
                .duration(AnimationDuration)
                .attr("transform", "translate("+(container_width*0.1+(range[1]+1)*drag_interval)+","+(container_height*0.9)+")");
        }
        start_drag.call(d3.drag()
                    .on("drag", function () {
                        let x = d3.event.x;
                        let drag_btn = d3.select(this);
                        let min_x = container_width*0.09;
                        let max_x = -1;
                        let end_pos = end_drag.attr("transform").slice(end_drag.attr("transform").indexOf("(")+1, end_drag.attr("transform").indexOf(","));
                        max_x = parseFloat(end_pos);
                        if((x<=min_x)||(x>=max_x)) return;
                        drag_btn.attr("transform", "translate("+(x)+","+(container_height*0.9)+")");
                        container.selectAll("rect").attr("opacity", function (d, i) {
                            let change = false;
                            let rect = d3.select(this);
                            let rect_x = parseFloat(rect.attr("x"));
                            let rect_width = parseFloat(rect.attr("width"));
                            if((rect_x>=x)&&(rect_x+rect_width<=max_x)){
                                // in control
                                if(rect.attr("opacity")!=1)change = true;
                                for(let id of d){
                                    visible_items[id] = true;
                                }
                                if(change) {
                                    that.update_widget_showing_items(d);
                                    range[0] = i;
                                }
                                return 1
                            }
                            if(rect.attr("opacity")!=0.5)change = true;
                            for(let id of d){
                                    visible_items[id] = false;
                            }
                            if(change) {
                                that.update_widget_showing_items(d);
                                range[0] = i+1;
                            }
                            return 0.5
                        })
                    }));
            end_drag.call(d3.drag()
                    .on("drag", function () {
                        let x = d3.event.x;
                        let drag_btn = d3.select(this);
                        let max_x = container_width*0.91;
                        let min_x = -1;
                        let end_pos = start_drag.attr("transform").slice(start_drag.attr("transform").indexOf("(")+1, start_drag.attr("transform").indexOf(","));
                        min_x = parseFloat(end_pos);
                        if((x<=min_x)||(x>=max_x)) return;
                        drag_btn.attr("transform", "translate("+(x)+","+(container_height*0.9)+")");

                        container.selectAll("rect").attr("opacity", function (d, i) {
                            let change = false;
                            let rect = d3.select(this);
                            let rect_x = parseFloat(rect.attr("x"));
                            let rect_width = parseFloat(rect.attr("width"));
                            if((rect_x>=min_x)&&(rect_x+rect_width<=x)){
                                // in control
                                if(rect.attr("opacity")!=1)change = true;
                                for(let id of d){
                                    visible_items[id] = true;
                                }
                                if(change) {
                                    that.update_widget_showing_items(d);
                                    range[1] = i;
                                }
                                return 1
                            }
                            if(rect.attr("opacity")!=0.5)change = true;
                            for(let id of d){
                                    visible_items[id] = false;
                            }
                            if(change) {
                                that.update_widget_showing_items(d);
                                range[1] = i-1;
                            }
                            return 0.5
                        })
                    }))
    };

    that.get_visible_items = function() {
        return control_items;
    };

    that.get_ranges = function() {
        return [uncertainty_widget_range, label_widget_range, indegree_widget_range, outdegree_widget_range]
    };

    that.init = function () {
        that._init();
    }.call();
};