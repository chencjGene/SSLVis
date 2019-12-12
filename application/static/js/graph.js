/*
* added by Changjian Chen, 20191015
* */

let GraphLayout = function (container){
    let that = this;
    that.container = container;

    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let layout_width = width - 20;
    let layout_height = height - 20;
    let color_unlabel = "#A9A9A9";
    let color_label = d3.schemeCategory10;
    color_label[7] = "#ffff00";
    let graph_data = null;
    let data_manager = null;
    let kklayout = window.KKlayout;
    let focus_radius = 50;
    let focus_path = [];
    let svg = null;

    let lasso = d3.lasso()
        .closePathSelect(true)
        .closePathDistance(100);

    let iter = 0;

    that._init = function(){
        $("#zoom-out-btn").click(function (event) {
                 $.post("/graph/ZoomOut", {}, function (data) {
                     let d = data.data;
                     let status = data.status;
                     if(status === 0){
                        console.log("Can not zoom out！");
                        return
                     }
                     let focus_node = focus_path.pop();
                     let opacity_promise = function(){
                         return new Promise(function (resolve, reject) {
                             svg.select("#graph-view-tsne-point").selectAll("circle")
                                 .each(function (d) {
                                     let svg_node = d3.select(this);
                                     if(focus_node.indexOf(d.id) !== -1){
                                         svg_node.classed("selected", true)
                                     }
                                     else {
                                         svg_node.transition()
                                             .duration(500)
                                             .attr("opacity", 0)
                                             .on("end", resolve);
                                     }
                                 })
                         })
                     };
                     let move_opacity = function(){
                         return new Promise(function (resolve, reject) {
                             graph_data = d;
                            console.log("Zoom out Nodes", graph_data);
                            that._center_tsne();
                            let center_x = 0;
                            let center_y = 0;
                            let r = 0;
                            svg.select("#graph-view-tsne-point").selectAll("circle")
                                .each(function (d) {
                                    let svg_node = d3.select(this);
                                     if(focus_node.indexOf(d.id) !== -1){
                                         svg_node.classed("selected", true)
                                         .transition()
                                        .duration(800)
                                        .attr("cx", function (d) {
                                            return graph_data.nodes[d.id].x
                                        })
                                        .attr("cy", function (d) {
                                            return graph_data.nodes[d.id].y
                                        })
                                        .on("end", resolve);
                                     }
                                })

                         })
                     };
                     opacity_promise().then(function () {
                         return move_opacity()
                     }).then(function (d) {
                         that.draw_tsne(false);
                         svg.select("#graph-view-node-g")
                            .selectAll("circle")
                            .each(function (d) {
                                let circle = d3.select(this);
                                if(focus_node.indexOf(d.id) !== -1){
                                    circle.classed("selected", true)
                                }
                            })
                     });
                 })
            });
    };

    that.lasso_start = function() {
        lasso.items()
            .attr("r",3.5) // reset size
            .classed("not_possible",true)
            .classed("selected",false);
    };

    that.lasso_draw = function() {
        // Style the possible dots
        // lasso.possibleItems()
        //     .classed("not_possible",false)
        //     .classed("possible",true);
        //
        // // Style the not possible dot
        // lasso.notPossibleItems()
        //     .classed("not_possible",true)
        //     .classed("possible",false);

    };

    that.lasso_end = function() {
        lasso.items()
            .classed("not_possible",false)
            .classed("possible",false);

        // Style the selected dots
        lasso.selectedItems()
            .classed("selected",true)
            .attr("r",7);

        // Reset the style of the not selected dots
        lasso.notSelectedItems()
            .attr("r",3.5);

        let focus_node = lasso.selectedItems().data().map(d => d.id);
        if(focus_node.length===0){
            console.log("No node need focus.");
            return
        }
        $.post("/graph/ZoomIn", {
            "nodes":JSON.stringify(focus_node)
        }, function (data) {
            let d = data.data;
            let status = data.status;
            if(status === 0){
                console.log("Can not zoom in！");
                return
            }
            focus_path.push(focus_node);
            // transition
            let no_select_node_promise = function(){
                return new Promise(function (resolve, reject) {
                    if(lasso.notSelectedItems().size()===0){
                        resolve()
                    }
                     lasso.notSelectedItems()
                         .transition()
                         .duration(500)
                         .attr("opacity", 0)
                         .on("end", resolve);
                })
            };
            let select_node_promise = function(){
                return new Promise(function (resolve, reject) {
                    graph_data = d;
                    console.log("Zoom In Nodes", graph_data);
                    that._center_tsne();
                    let center_x = 0;
                    let center_y = 0;
                    let r = 0;
                    lasso.selectedItems()
                        .transition()
                        .duration(800)
                        .attr("cx", function (d) {
                            return graph_data.nodes[d.id].x
                        })
                        .attr("cy", function (d) {
                            return graph_data.nodes[d.id].y
                        })
                        .on("end", resolve);

                })
            };
            no_select_node_promise()
                .then(function () {
                    return select_node_promise()
                })
                .then(function () {
                    that.draw_tsne(false);
                    svg.select("#graph-view-tsne-point")
                        .selectAll("circle")
                        .each(function (d) {
                            let circle = d3.select(this);
                            if(focus_node.indexOf(d.id) !== -1){
                                circle.classed("selected", true)
                            }
                        });
                });
        })
    };

    that.all_paired_shortest_path = function(nodes, links){
        let i=0;
        let n=nodes.length;
        let D = nodes.map(n => nodes.map(m => 10241024));

        //id 2 idx
        let id2idx = {};
        i=0;
        for(let node of nodes){
            id2idx[node.id] = i++;
        }

        // init
        for(let link of links){
            D[id2idx[link.source]][id2idx[link.target]] = 1;
            D[id2idx[link.target]][id2idx[link.source]] = 1;
        }
        for(let i=0;i<n;i++){
            D[i][i] = 0;
        }
        // floyd-warshall
        for(let k=0;k<n;k++){
            for(let i=0;i<n;i++){
                for(let j=0;j<n;j++){
                    D[i][j] = D[i][j]>D[i][k]+D[j][k]?D[i][k]+D[j][k]:D[i][j];
                }
            }
        }
        return D;
    };

    that.set_data_manager = function(_data_manager){
        data_manager = _data_manager;
    };

    that.component_update = function(state){
        console.log("graph component update");
        that._update_data(state);
        that._update_view();
    };

    that._update_data = function(state){
        graph_data = state.graph_data;
        console.log("graph_data", graph_data);
        that._draw_legend();
    };

    that.centralize_and_scale = function(nodes, width, height){
        let avx = 0;
        let avy = 0;
        let scale = 10000;
        let nodenum = Object.values(nodes).length;
        for(let nodeid in nodes){
            let node = nodes[nodeid];
            avx += node.x;
            avy += node.y;
        }
        avx /= nodenum;
        avy /= nodenum;
        let delx = width/2-avx;
        let dely = height/2 - avy;
        for (let nodeid in nodes){
            let node = nodes[nodeid];
            node.x += delx;
            node.y += dely;
            let xscale = (width/2)/Math.abs(node.x-width/2);
            let yscale = (height/2)/Math.abs(node.y-height/2);
            scale = Math.min(scale, xscale, yscale);
        }
        scale *= 0.85;
        for(let nodeid in nodes){
            let node = nodes[nodeid];
            node.x += (node.x-width/2)*scale;
            node.y += (node.y-height/2)*scale;
        }
    };

    that._draw_legend = function() {
        $.post('/graph/GetLabels', {}, function (d) {
                let labels = d;
                let label_num = labels.length;
                d3.select("#graph-legend-g").remove();
                let legend_area = d3.select("#graph-legend").append("g")
                    .attr("id", "graph-legend-g");
                let legend_start_x = 10;
                let legend_start_y = 10;
                let x_delta = 140;
                let legend_delta = 55;
                let rect_width = 45;
                let rect_height = 30;
                let text_start_x = legend_start_x+rect_width+5;
                let text_start_y = legend_start_y+20;
                let half = Math.floor(label_num/2);
                for(let i=-1; i<label_num; i++){
                    legend_area.append("rect")
                        .attr("x", function () {
                            if(i<0) return legend_start_x;
                            else return Math.floor(i/half)*x_delta+legend_start_x;
                        })
                        .attr("y", legend_start_y+(i%half+1)*legend_delta)
                        .attr("width", rect_width)
                        .attr("height", rect_height)
                        .attr("fill", function () {
                            if(i===-1) return color_unlabel;
                            else return color_label[i];
                        });
                    legend_area.append("text")
                        .attr("x", function () {
                            if(i<0) return text_start_x;
                            else return Math.floor(i/half)*x_delta+text_start_x;
                        })
                        .attr("y", text_start_y+(i%half+1)*legend_delta)
                        .attr("text-anchor", "start")
                        .attr("font-size", "17")
                        .text(function () {
                            if(i===-1) return "unlabel";
                            else return labels[i]
                        })
                }


        })
    };

    that._draw_layout = function(graph, transform = true){
        svg = container.select("#graph-view-svg");
        svg.select("#graph-view-link-g").remove();
        svg.select("#graph-view-node-g").remove();
        svg.select('#graph-view-density-map').remove();
        svg.select(".lasso").remove();
        // that._draw_legend();
        // svg = container.append("svg")
        //                     .attr("id", "graph-view-svg");
        width = $('#graph-view-svg').width();
        height = $('#graph-view-svg').height();
        console.log("width: ", width, "height: ", height);
        if(transform){
            that.centralize_and_scale(graph_data.node, width, height);
        }
        let area = width*height;

        let nodes_data = graph['node'];
        let links_data = graph['link'];
        let process_data = graph['process'];

        let id2idx = {};
        let i=0;
        for(let nodeid in nodes_data){
            let node = nodes_data[nodeid];
            id2idx[node.id] = i++;
        }
        let n = Object.values(nodes_data).length;

        let density_color = d3.scaleLinear()
                            .domain([0, 1])
                            .range(["white", "#696969"]);

            let contour_paths = d3.contourDensity()
                            .x(function (d) {
                                return d.x;
                            })
                            .y(function (d) {
                                return d.y;
                            })
                            .weight(function (d) {
                                return d.weight;
                            })
                            .thresholds(40)
                            .bandwidth(25)
                            .size([width, height])(Object.values(nodes_data));
            let max_contour_value = 0;
            for(let contour_path of contour_paths){
                if(contour_path.value > max_contour_value){
                    max_contour_value = contour_path.value;
                }
            }
            for(let contour_path of contour_paths){
                contour_path.value /= max_contour_value;
            }
            let contour_svg = svg.append("g")
                .attr("id", "graph-view-density-map")
                .selectAll("path")
                .data(contour_paths)
                .enter()
                .append("path")
                .attr("fill", function (d) {
                    return density_color(d.value)
                })
                .attr("d", d3.geoPath());

            // that.centralize(nodes_data, width, height);
            let links = svg.append("g")
                .attr("id", "graph-view-link-g")
                .selectAll("line")
                .data(links_data).enter().append("line")
                .attr("x1", d => nodes_data[d[0]].x)
                .attr("y1", d => nodes_data[d[0]].y)
                .attr("x2", d => nodes_data[d[1]].x)
                .attr("y2", d => nodes_data[d[1]].y)
                .attr("stroke-width", 1)
                .attr("stroke", "gray")
                .attr("opacity", 0.4);
            let nodes = svg.append("g")
                .attr("id", "graph-view-node-g")
                .selectAll("circle")
                .data(Object.values(nodes_data)).enter().append("circle")
                .attr("class", "graph-view-node")
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("r", 3)
                .attr("opacity", 1)
                .attr("fill", function (d) {
                    let label = process_data[iter][d.id][0];
                    if(label === -1){
                        return color_unlabel;
                    }
                    else {
                        return color_label[label]
                    }
                })
                .on("mouseover", function (d) {
                    console.log("node:", d, "label:", process_data[iter][d.id][0], "score:", process_data[iter][d.id][1]);
                });
            lasso.items(nodes)
            .targetArea(svg)
            .on("start", that.lasso_start)
            .on("draw", that.lasso_draw)
            .on("end", that.lasso_end);

            svg.call(lasso);



    };

    that._draw_overview = function(graph_data) {
        let overview_svg = d3.select("#graph-overview");
        overview_svg.select("#overview-density-map").remove();
        let overview_width = $("#graph-overview").width();
        let overview_height = $("#graph-overview").height();
        let scale = Math.min(overview_width/width, overview_height/height);
        let density_color = d3.scaleLinear()
                            .domain([0, 1])
                            .range(["white", "gray"]);

            let contour_paths = d3.contourDensity()
                            .x(function (d) {
                                return d.x;
                            })
                            .y(function (d) {
                                return d.y;
                            })
                            .weight(function (d) {
                                return d.weight;
                            })
                            .thresholds(40)
                            .size([width, height])(Object.values(graph_data.node));
            let max_contour_value = 0;
            for(let contour_path of contour_paths){
                if(contour_path.value > max_contour_value){
                    max_contour_value = contour_path.value;
                }
            }
            for(let contour_path of contour_paths){
                contour_path.value /= max_contour_value;
            }
            let contour_svg = overview_svg.append("g")
                .attr("id", "overview-density-map")
                .attr("transform", "scale("+scale+")")
                .selectAll("path")
                .data(contour_paths)
                .enter()
                .append("path")
                .attr("fill", function (d) {
                    return density_color(d.value)
                })
                .attr("d", d3.geoPath());
    };

    that.setIter = function(newiter) {
        iter = newiter;
        that._draw_layout(graph_data, false);
    };
    
    that.d3_layout = function(graph) {
        container.select("#graph-view-svg").remove();
        let svg = container.append("svg")
            .attr("id", "graph-view-svg")
            .attr("width", width)
            .attr("height", height);
        console.log("width: ", width, "height: ", height);
        let area = width * height;

        let nodes_data = Object.values(graph['node']);
        let links_data = graph['link'];
        for(let link of links_data){
            link.source = link[0];
            link.target = link[1];
        }

        let id2idx = {};
        let i = 0;
        for (let nodeid in nodes_data) {
            let node = nodes_data[nodeid];
            id2idx[node.id] = i++;
        }
        let n = Object.values(nodes_data).length;
        //

        let simulation = d3.forceSimulation()
            .force("link", d3.forceLink().id(function (d) {
                return d.id;
            }))
            .force("charge", d3.forceManyBody())
            .force("center", d3.forceCenter(width / 2, height / 2));

        var link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links_data)
            .enter().append("line")
            .attr("stroke", "gray")
            .attr("stroke-width", function (d) {
                return 1
            });

        var node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(nodes_data)
            .enter().append("g");

        var circles = node.append("circle")
            .attr("r", 2)
            .attr("fill", function (d) {
                return "gray";
            });


          simulation
              .nodes(nodes_data)
              .on("tick", ticked);

          simulation.force("link")
              .links(links_data);

          function ticked() {
            link
                .attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });

            node
                .attr("transform", function(d) {
                  return "translate(" + d.x + "," + d.y + ")";
                })
          }

    };

    that._center_tsne = function centering(){
            let avx = 0;
            let avy = 0;
            let scale = 10000;
            let nodes = Object.values(graph_data.nodes);
            let nodenum = nodes.length;
            for(let node of nodes){
                avx += node.x;
                avy += node.y;
            }
            avx /= nodenum;
            avy /= nodenum;
            let delx = width/2-avx;
            let dely = height/2 - avy;
            for (let node of nodes){
                node.x += delx;
                node.y += dely;
                let xscale = (width/2)/Math.abs(node.x-width/2);
                let yscale = (height/2)/Math.abs(node.y-height/2);
                scale = Math.min(scale, xscale, yscale);
            }
            scale *= 0.85;
            for(let node of nodes){
                node.x += (node.x-width/2)*scale;
                node.y += (node.y-height/2)*scale;
            }
        };

    that.draw_tsne = function(center = true) {

        svg = container.select("#graph-view-svg");
        svg.select("#graph-view-tsne-point").remove();
        svg.select(".lasso").remove();
        let nodes = Object.values(graph_data.nodes);
        width = $('#graph-view-svg').width();
        height = $('#graph-view-svg').height();
        if(center){
            that._center_tsne()
        }
        let nodes_svg = svg.append("g")
            .attr("id", "graph-view-tsne-point")
            .selectAll("circle")
            .data(nodes)
            .enter()
            .append("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", 4)
            .attr("opacity", 1)
            .attr("fill", function (d) {
                if(d.truth === -1) return color_unlabel;
                else return color_label[d.truth];
            });


        lasso.items(nodes_svg)
            .targetArea(svg)
            .on("start", that.lasso_start)
            .on("draw", that.lasso_draw)
            .on("end", that.lasso_end);

            svg.call(lasso);
    };

    that._update_view = function(){
        that.draw_tsne()
    };

    that.init = function(){
        that._init();
    }.call();

};

