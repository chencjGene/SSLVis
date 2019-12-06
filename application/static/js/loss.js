/*
* added by Changjian Chen, 20191015
* */

let ControlLayout = function (container){
    let that = this;
    that.container = container;

    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let layout_width = width - 20;
    let layout_height = height - 20;
    let line_width = width - 100;
    let line_height = height - 30;
    let loss = [];
    let min_loss = 0;
    let max_loss = 0;
    let iter = 0;
    let svg = null;
    let line_color = "gray";
    let playing = false;
    let play_interval = null;
    let draging = false;
    console.log("GraphLayout", "layout width", layout_width, "layout height", layout_height);

    let data_manager = null;

    that.controlItem = null;

    that._init = function(){
        $("#loss-begin-btn").click(function (d) {
            if(playing){
                playing = false;
                $("#loss-begin-btn span").removeClass("glyphicon-pause");
                $("#loss-begin-btn span").addClass("glyphicon-play");
                clearInterval(play_interval);
            }
            else {
                playing = true;
                $("#loss-begin-btn span").removeClass("glyphicon-play");
                $("#loss-begin-btn span").addClass("glyphicon-pause");
                let i = 0;
                that.setIter(i++);
                play_interval = setInterval(function (d) {
                    if(i === loss.length){
                        playing = false;
                    $("#loss-begin-btn span").removeClass("glyphicon-pause");
                    $("#loss-begin-btn span").addClass("glyphicon-play");
                        clearInterval(play_interval);
                        return;
                    }
                    that.setIter(i);
                    i++;
                }, 500)
            }
        })
    };

    that.set_data_manager = function(_data_manager){
        data_manager = _data_manager;
    };

    that.component_update = function(state){
        console.log("loss component update");
        that._update_data(state);
        that._update_view();
    };

    that._update_data = function(state){
        loss = state.loss_data;
        console.log("loss data:", loss);
        min_loss = loss.reduce(function (acc, num) {
            return acc > num?num:acc
        });
        max_loss = loss.reduce(function (acc, num) {
            return acc < num?num:acc
        });
        let dis_delta = (max_loss-min_loss)/loss.length;
        min_loss -= dis_delta;
        max_loss += dis_delta;
    };

    that.setIter = function(newiter) {
        if(newiter >= loss.length){
            console.log(newiter,"is larger than ", loss.length-1);
            return;
        }
        iter = newiter;
        that._update_view();
        that.controlItem.setIter(newiter);
    };

    that._update_view = function(){
        if(draging){
            svg.select("#loss-view-line").remove();
            svg.select("#loss-view-circle").remove();
            svg.select("#loss-view-iter").remove();
        }
        else {
            container.select("#loss-view-svg").remove();
            svg = container.append("svg")
                            .attr("id", "loss-view-svg");
        }

        width = $('#loss-view-svg').width();
        height = $('#loss-view-svg').height();
        layout_width = width - 20;
        layout_height = height - 20;
        line_width = width - 100;
        line_height = height - 50;
        let slider_delta = line_width/(loss.length-0.5);
        let slider_width = 6;
        let xPositionScale = d3
              .scaleLinear()
              .domain([-0.25, loss.length-0.75])
              .range([80, line_width+80]);
        let yPositionScale = d3
              .scaleLinear()
              .domain([min_loss, max_loss])
              .range([line_height+20, 20]);

        let drag_start = function() {
            draging = true;
    };

        let drag_slider = function(){
                let value = d3.event.x;
                if(value<80) value=80;
                if(value>80+line_width) value = 80+line_width;
                let new_iter = Math.floor((value-80)/slider_delta-0.25);
                if(new_iter<0)new_iter=0;
                if(new_iter>=loss.length) new_iter = loss.length-1;
                svg.select("#loss-slider-left").attr("x2", value);
                if(iter != new_iter){
                    that.setIter(new_iter);
                }
                let circle = d3.select("#loss-view-slider-circle");
                circle.attr("cx", value)
                    .attr("cy", 32+line_height)

        };

        let drag_slider_end = function() {
                let value = d3.event.x;
                if(value<80) value=80;
                if(value>80+line_width) value = 80+line_width;

                let circle = d3.select("#loss-view-slider-circle");
                let new_iter = Math.floor((value-80)/slider_delta-0.25);
                if(new_iter<0)new_iter=0;
                if(new_iter>=loss.length) new_iter = loss.length-1;
                value = xPositionScale(new_iter);
                svg.select("#loss-slider-left").attr("x2", value);
                circle.attr("cx", value)
                    .attr("cy", 32+line_height);
                draging = false;
        };

        let line = d3
                  .line()
                  .x(function(d, i) {
                    return xPositionScale(i)
                  })
                  .y(d => yPositionScale(d))
                  .curve(d3.curveMonotoneX);
        svg
            .append("g")
            .attr("id", "loss-view-line")
            .append('path')
            .datum(loss)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', line_color)
            .attr("stroke-width", 2);

        svg
            .append("g")
            .attr("id", "loss-view-circle")
            .selectAll('circle')
            .data(loss)
            .enter()
            .append('circle')
            .attr('r', function (d, i) {
                if (i===iter) return 6;
                else return 3;
            })
            .attr('cx', (d, i) => {
                return xPositionScale(i)
            })
            .attr('cy', d => {
              return yPositionScale(d)
            })
            .attr("fill", function (d, i) {
                let svg_node = d3.select(this);
                if(i === iter){
                    let x = svg_node.attr("cx");
                    let y = svg_node.attr("cy");
                    svg.select("#loss-view-iter").remove();
                    let iter_svg = svg.append("g")
                        .attr("id", "loss-view-iter");
                    iter_svg.append("text")
                        .attr("id", "iter-label")
                        .attr("x", parseInt(x))
                        .attr("y", y-10)
                        .text(parseFloat(d).toFixed(2))
                        .attr("text-anchor", "start");
                    iter_svg.append("line")
                        .attr("id", "iter-line1")
                        .attr("x1", x)
                        .attr("y1", 20)
                        .attr("x2", x)
                        .attr("y2", line_height+20)
                        .attr("stroke", "black")
                        .attr("stroke-dasharray", 3);

                    iter_svg.append("line")
                        .attr("id", "iter-line2")
                        .attr("x1", 80)
                        .attr("y1", y)
                        .attr("x2", line_width+80)
                        .attr("y2", y)
                        .attr("stroke", "black")
                        .attr("stroke-dasharray", 3);

                    return "gray"
                }
                else return "gray";
            })
            .on("mouseover", function (d) {
                console.log(d);
            })
            .on("click", function (d, i) {
                that.setIter(i);
            });

        svg.append("text")
            .attr("id", "legend-text1")
            .attr("x", 70)
            .attr("y", 20)
            .attr("text-anchor", "end")
            .text("Loss");

        svg.append("text")
            .attr("id", "legend-text2")
            .attr("x", 78+line_width)
            .attr("y", 50+line_height)
            .attr("text-anchor", "middle")
            .text("Iteration");
        if(!draging){
            let slider = svg.append("g")
            .attr("id", "loss-view-slider");
        slider.append("line")
            .attr("id", "loss-slider-right")
            .attr("x1", 80)
            .attr("y1", 32+line_height)
            .attr("x2", 80+line_width)
            .attr("y2", 32+line_height)
            .attr("stroke-width", slider_width)
            .attr("stroke", "#e4e7ed")
            .attr("stroke-linecap", "round");
        slider.append("line")
            .attr("id", "loss-slider-left")
            .attr("x1", 80)
            .attr("y1", 32+line_height)
            .attr("x2", xPositionScale(iter))
            .attr("y2", 32+line_height)
            .attr("stroke-width", slider_width)
            .attr("stroke", "#808080")
            .attr("stroke-linecap", "round");
        slider.selectAll("circle")
            .data(loss)
            .enter()
            .append("circle")
            .attr("id", "loss-slider-base-circle")
            .attr('cx', (d, i) => {
                return xPositionScale(i)
            })
            .attr('cy', 32+line_height)
            .attr("fill", "#808080")
            .attr("r", slider_width+2)
            .on("click", function (d, i) {
                that.setIter(i);
            });
        slider.append("circle")
            .attr("id", "loss-view-slider-circle")
            .attr('cx', xPositionScale(iter))
            .attr("cy", 32+line_height)
            .attr("fill", "#ffffff")
            .attr("r", slider_width+4)
            .attr("stroke", "#808080")
            .attr("stroke-width", 3)
            .call(d3.drag().on("start", drag_start).on("drag", drag_slider).on("end", drag_slider_end));
        const xAxis = d3.axisBottom(xPositionScale);
        svg
            .append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', 'translate(0,' + parseInt(line_height+20+'') + ')')
            .call(xAxis);

        const yAxis = d3.axisLeft(yPositionScale);
        svg
            .append('g')
            .attr('class', 'axis y-axis')
            .attr('transform', 'translate(80,0)')
            .call(yAxis)
        }
        svg.select("#loss-view-slider")
            .selectAll("#loss-slider-base-circle")
            .attr("fill", function (d, i) {
                if(i<=iter){
                    return "#808080"
                }
                else return "#e4e7ed"
            })

    };

    that.init = function(){
        that._init();
    }.call();

};
