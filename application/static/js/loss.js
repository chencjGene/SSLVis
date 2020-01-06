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
    let ent = [];
    let min_loss = 0;
    let max_loss = 0;
    let min_ent = 0;
    let max_ent = 0;
    let iter = 0;
    let svg = null;
    let line_color = "gray";
    let loss_color = "#26a9e1";
    let entropy_color = "#816cad";
    let playing = false;
    let play_interval = null;
    let draging = false;

    let xPositionScale = null;
    let loss_yPositionScale = null;
    let ent_yPositionScale = null;
    let loss_line_pattern = null;
    let ent_line_pattern = null;
    let loss_line = null;
    let loss_view_line_g = null;
    let loss_circles = null;
    let loss_view_circle_g = null;
    let ent_line = null;
    let ent_view_line_g = null;
    let ent_circles = null;
    let ent_view_circle_g = null;

    let slider = null;
    console.log("Loss view", "layout width", layout_width, "layout height", layout_height);
    if(layout_width<0){
        console.log("error");
    }

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
                let i = iter===loss.length-1?0:iter;
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
        });
        svg = container.select("#loss-view-svg");
        loss_view_line_g = svg.select("#loss-view-line");
        loss_view_circle_g = svg.select("#loss-view-circle");
        ent_view_line_g = svg.select("#ent-view-line");
        ent_view_circle_g = svg.select("#ent-view-circle");
        slider = svg.select("#loss-view-slider");
    };

    that.set_data_manager = function(_data_manager){
        data_manager = _data_manager;
    };

    that.component_update = function(state){
        console.log("loss component update");
        that._update_data(state);
        that._init_view();
        that._update_view();
    };

    that._init_view = function() {
        // update scale
        width = $('#loss-view-svg').width();
        height = $('#loss-view-svg').height();
        layout_width = width - 80;
        layout_height = height - 20;
        line_width = layout_width - 80;
        line_height = layout_height - 30;
        let slider_delta = line_width/(loss.length-0.5);
        let slider_width = 6;
        xPositionScale = d3
              .scaleLinear()
              .domain([-0.25, loss.length-0.75])
              .range([80, line_width+80]);
        loss_yPositionScale = d3
              .scaleLinear()
              .domain([min_loss, max_loss])
              .range([line_height+20, 20]);
        ent_yPositionScale = d3
              .scaleLinear()
              .domain([min_ent, max_ent])
              .range([line_height+20, 20]);
        loss_line_pattern = d3
                  .line()
                  .x(function(d, i) {
                    return xPositionScale(i)
                  })
                  .y(d => loss_yPositionScale(d))
                  .curve(d3.curveMonotoneX);
        ent_line_pattern = d3
                  .line()
                  .x(function(d, i) {
                    return xPositionScale(i)
                  })
                  .y(d => ent_yPositionScale(d))
                  .curve(d3.curveMonotoneX);

        // update axis
        svg.selectAll(".axis").remove();
        const xAxis = d3.axisBottom(xPositionScale).ticks(loss.length);
        svg
            .append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', 'translate(0,' + parseInt(line_height+20+'') + ')')
            .call(xAxis);
        svg.selectAll(".x-axis text")
            .attr("class", "axis-x-text");

        const loss_yAxis = d3.axisLeft(loss_yPositionScale);
        svg
            .append('g')
            .attr('class', 'axis y-axis loss-axis')
            .attr('transform', 'translate(80,0)')
            .call(loss_yAxis.ticks(5));

        const ent_yAxis = d3.axisRight(ent_yPositionScale);
        svg
            .append('g')
            .attr('class', 'axis y-axis entropy-axis')
            .attr('transform', 'translate('+parseInt(80+line_width)+',0)')
            .call(ent_yAxis.ticks(5));

        // legend
        svg.select("#legend-text1").remove();
        svg.select("#legend-text2").remove();
        svg.select("#legend-text3").remove();
        svg.append("text")
            .attr("id", "legend-text1")
            .attr("x", 70)
            .attr("y", 20)
            .attr("text-anchor", "end")
            .attr("fill", line_color)
            .text("Loss");

        svg.append("text")
            .attr("id", "legend-text2")
            .attr("x", 78+line_width)
            .attr("y", 50+line_height)
            .attr("text-anchor", "middle")
            .text("Iteration");

        svg.append("text")
            .attr("id", "legend-text3")
            .attr("x", line_width+90)
            .attr("y", 20)
            .attr("text-anchor", "start")
            .attr("fill", line_color)
            .text("Entropy");

        // dragging
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

        slider.selectAll("*").remove();
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
    };

    that._update_data = function(state){
        iter = 0;
        console.log("Loss view get state", state);
        if(state.loss_data !== undefined){
            while (loss.length>0) loss.pop();
            for(let e of state.loss_data){
                loss.push(e);
            }
            min_loss = loss.reduce(function (acc, num) {
                return acc > num?num:acc
            });
            max_loss = loss.reduce(function (acc, num) {
                return acc < num?num:acc
            });
            let dis_delta = (max_loss-min_loss)/loss.length;
            min_loss -= dis_delta;
            max_loss += dis_delta;
        }
        if(state.ent_data !== undefined){
            while (ent.length>0) ent.pop();
            for(let e of state.ent_data){
                ent.push(e);
            }
            min_ent = ent.reduce(function (acc, num) {
                return acc > num?num:acc
            });
            max_ent = ent.reduce(function (acc, num) {
                return acc < num?num:acc
            });
            let dis_delta = (max_ent-min_ent)/ent.length;
            min_ent -= dis_delta;
            max_ent += dis_delta;
        }
        if(loss.length !== ent.length){
            console.log("ERROR: loss length != ent length", loss, ent);
        }
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

    that._update_view = function() {
        that._create();
        that._update();
        that._remove();
    };

    that._create = function() {
        loss_line = loss_view_line_g
            .selectAll("path")
            .data([loss]);

        loss_circles = loss_view_circle_g
            .selectAll("circle")
            .data(loss);

        loss_line.enter()
            .append('path')
            .attr('d', loss_line_pattern)
            .attr("fill", "none")
            .attr('stroke', line_color)
            .attr("stroke-width", 2);

        loss_circles.enter()
            .append('circle')
            .attr('r', function (d, i) {
                if (i===iter) return 6;
                else return 3;
            })
            .attr('cx', (d, i) => {
                return xPositionScale(i)
            })
            .attr('cy', d => {
              return loss_yPositionScale(d)
            })
            .attr("fill", line_color)
            .on("mouseover", function (d) {
                console.log(d);
            })
            .on("click", function (d, i) {
                that.setIter(i);
            })
            .each(function (d, i) {
                let svg_node = d3.select(this);
                if(i === iter){
                    let x = svg_node.attr("cx");
                    let y = svg_node.attr("cy");
                    svg.select("#loss-view-iter").remove();
                    let iter_svg = svg.append("g")
                        .attr("id", "loss-view-iter");
                    iter_svg.append("text")
                        .attr("id", "iter-label")
                        .attr("x", parseInt(x)-5)
                        .attr("y", y-10)
                        .text(parseFloat(d).toFixed(2))
                        .attr("text-anchor", "end");
                }
            });


        ent_line = ent_view_line_g
            .selectAll("path")
            .data([ent]);

        ent_circles = ent_view_circle_g
            .selectAll("circle")
            .data(ent);

        ent_line.enter()
            .append('path')
            .attr('d', ent_line_pattern)
            .attr("fill", "none")
            .attr('stroke', line_color)
            .attr("stroke-width", 2);

        ent_circles.enter()
            .append('circle')
            .attr('r', function (d, i) {
                if (i===iter) return 6;
                else return 3;
            })
            .attr('cx', (d, i) => {
                return xPositionScale(i)
            })
            .attr('cy', d => {
              return ent_yPositionScale(d)
            })
            .attr("fill", line_color)
            .on("mouseover", function (d) {
                console.log(d);
            })
            .on("click", function (d, i) {
                that.setIter(i);
            })
            .each(function (d, i) {
                let svg_node = d3.select(this);
                if(i === iter){
                    let x = svg_node.attr("cx");
                    let y = svg_node.attr("cy");
                    svg.select("#ent-view-iter").remove();
                    let iter_svg = svg.append("g")
                        .attr("id", "ent-view-iter");
                    iter_svg.append("text")
                        .attr("id", "iter-label")
                        .attr("x", parseInt(x)+5)
                        .attr("y", y-10)
                        .text(parseFloat(d).toFixed(2))
                        .attr("text-anchor", "start");
                }
            });
    };

    that._update = function() {
        loss_line.attr('d', loss_line_pattern);
        loss_circles.attr('r', function (d, i) {
                if (i===iter) return 6;
                else return 3;
            })
            .attr('cx', (d, i) => {
                return xPositionScale(i)
            })
            .attr('cy', d => {
              return loss_yPositionScale(d)
            })
            .each(function (d, i) {
                let svg_node = d3.select(this);
                if(i === iter){
                    let x = svg_node.attr("cx");
                    let y = svg_node.attr("cy");
                    svg.select("#loss-view-iter").remove();
                    let iter_svg = svg.append("g")
                        .attr("id", "loss-view-iter");
                    iter_svg.append("text")
                        .attr("id", "iter-label")
                        .attr("x", parseInt(x)-5)
                        .attr("y", y-10)
                        .text(parseFloat(d).toFixed(2))
                        .attr("text-anchor", "end");
                }
            });

        ent_line.attr('d', ent_line_pattern);
        ent_circles.attr('r', function (d, i) {
                if (i===iter) return 6;
                else return 3;
            })
            .attr('cx', (d, i) => {
                return xPositionScale(i)
            })
            .attr('cy', d => {
              return ent_yPositionScale(d)
            })
            .each(function (d, i) {
                let svg_node = d3.select(this);
                if(i === iter){
                    let x = svg_node.attr("cx");
                    let y = svg_node.attr("cy");
                    svg.select("#ent-view-iter").remove();
                    let iter_svg = svg.append("g")
                        .attr("id", "ent-view-iter");
                    iter_svg.append("text")
                        .attr("id", "iter-label")
                        .attr("x", parseInt(x)+5)
                        .attr("y", y-10)
                        .text(parseFloat(d).toFixed(2))
                        .attr("text-anchor", "start");
                }
            });

        slider.selectAll("#loss-slider-base-circle")
            .attr("fill", function (d, i) {
                if(i<=iter){
                    return "#808080"
                }
                else return "#e4e7ed"
            });
    };

    that._remove = function() {
        loss_line.exit()
            .remove();
        loss_circles.exit()
            .remove();
        ent_line.exit()
            .remove();
        ent_circles.exit()
            .remove();
    };

    that.init = function(){
        that._init();
    }.call();

};
