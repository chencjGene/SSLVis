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
    console.log("GraphLayout", "layout width", layout_width, "layout height", layout_height);
    let color_unlabel = "#A9A9A9";
    let color_label = d3.schemeCategory20;
    let graph_data = null;
    let data_manager = null;
    let kklayout = window.KKlayout;

    that._init = function(){

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
        scale *= 0.95;
        for(let nodeid in nodes){
            let node = nodes[nodeid];
            node.x += (node.x-width/2)*scale;
            node.y += (node.y-height/2)*scale;
        }
    };

    that._draw_layout = function(graph){
        container.select("#graph-view-svg").remove();
        let svg = container.append("svg")
                            .attr("id", "graph-view-svg")
                            .attr("width", width)
                            .attr("height", height);
        console.log("width: ", width, "height: ", height);
        let area = width*height;

        let nodes_data = graph['node'];
        let links_data = graph['link'];

        let id2idx = {};
        let i=0;
        for(let nodeid in nodes_data){
            let node = nodes_data[nodeid];
            id2idx[node.id] = i++;
        }
        let n = Object.values(nodes_data).length;

            // that.centralize(nodes_data, width, height);
            console.log(nodes_data);
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
                .attr("stroke-opacity", "0.4");
            let nodes = svg.append("g")
                .attr("id", "graph-view-node-g")
                .selectAll("circle")
                .data(nodes_data).enter().append("circle")
                .attr("class", "graph-view-node")
                .attr("cx", d => d.x)
                .attr("cy", d => d.y)
                .attr("fill", function (d) {
                    return "gray";
                    if(d.p===2||d.p===1) return "#000000";
                    if(d.c===-1){
                        return color_unlabel;
                    }
                    else return color_label[d.c];
                })
                .on("mouseover", function (d) {
                    console.log(d);
                });
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

    that._update_view = function(){
        kklayout.layoutFast(graph_data);
        that.centralize_and_scale(graph_data.node, width, height);
        that._draw_layout(graph_data);
    };

    that.init = function(){
        that._init();
    }.call();

};

