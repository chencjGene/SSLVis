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

    let graph_data = null;
    let data_manager = null;

    that._init = function(){

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

    that._update_view = function(){
        container.select("#graph-view-svg").remove();
        let svg = container.append("svg")
                            .attr("id", "graph-view-svg")
                            .attr("width", width)
                            .attr("height", height);
        // node data
        let nodes_data = JSON.parse(JSON.stringify(graph_data.node));
        for(let node of nodes_data){
                node.x = (Math.random()-0.5)*20+width/2;
                node.y = (Math.random()-0.5)*20+height/2;
        }
        let id2idx = {};
        let i=0;
        for(let node of nodes_data){
            id2idx[node.id] = i++;
        }
        // create focus data for test
        let focus_nodes_data = [];
        for(let node of nodes_data){
            if(node.p === 1){
                focus_nodes_data.push(node);
            }
        }
        // link data
        let links_data = [];
        for(let link of graph_data.link){
            links_data.push({
                source:link[0],
                target:link[1],
                value:link[2]
            })
        }
        let area = width*height;
        let k = Math.sqrt(area/nodes_data.length);
        function tick() {
            function fa(d) {
                return d*d/k;
            }
            function fr(d) {
                return k*k/d;
            }
            function dis(a, b){
                let x = a.x-b.x;
                let y = a.y-b.y;
                return Math.sqrt(x*x+y*y);
            }
            // init
            let df = [];
            for(let node of nodes_data) df.push({x:0, y:0});
            // attractive
            for(let link of links_data){
                let uidx = id2idx[link.source];
                let vidx = id2idx[link.target];
                let u = nodes_data[uidx];
                let v = nodes_data[vidx];
                let d = dis(u, v);
                if(d===0) d=0.01;
                let a = fa(d);
                df[uidx].x -= (u.x-v.x)/d*a;
                df[uidx].y -= (u.y-v.y)/d*a;
                df[vidx].x += (u.x-v.x)/d*a;
                df[vidx].y += (u.y-v.y)/d*a;
            }
            // repulsive
            i = 0;
            for(let u of nodes_data){
                for(let v of nodes_data){
                    if(u.id === v.id) continue;
                    let d = dis(u, v);
                    if(d===0) continue;
                    let r = fr(d);
                    df[i].x += (u.x-v.x)/d*r;
                    df[i].y += (u.y-v.y)/d*r;
                }
                i++;
            }
            // move
            for(let idx in nodes_data){
                df[idx].x =df[idx].x/Math.abs(df[idx].x)*Math.min(Math.abs(df[idx].x)/30, width/10);
                df[idx].y =df[idx].y/Math.abs(df[idx].y)*Math.min(Math.abs(df[idx].y)/30, height/10);
                nodes_data[idx].x = Math.min(width, Math.max(0, nodes_data[idx].x + df[idx].x));
                nodes_data[idx].y = Math.min(height, Math.max(0, nodes_data[idx].y + df[idx].y));
            }
            console.log(df)
        }
        console.log(width, height);
        for (let iternum=0;iternum<50; iternum++){
            tick();
        }
        // let simulation = d3.forceSimulation(nodes_data)
        //       .force("link", d3.forceLink(links_data).id(d => d.id))
        //       .force("charge", d3.forceManyBody().strength(-10))
        //       .force("center", d3.forceCenter(width / 2, height / 2));
        let links = svg.append("g")
            .attr("id", "graph-view-link-g")
            .selectAll("line")
            .data(links_data).enter().append("line")
            .attr("x1", d => nodes_data[id2idx[d.source]].x)
            .attr("y1", d => nodes_data[id2idx[d.source]].y)
            .attr("x2", d => nodes_data[id2idx[d.target]].x)
            .attr("y2", d => nodes_data[id2idx[d.target]].y)
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
            .attr("fill", d => d.c===-1?color_unlabel:color_label[d.c])
            .on("mouseover", function (d) {
                console.log(d);
            });

        // simulation.on("tick", () => {
        //
        //         links
        //             .attr("x1", d => d.source.x)
        //             .attr("y1", d => d.source.y)
        //             .attr("x2", d => d.target.x)
        //             .attr("y2", d => d.target.y);
        //
        //         nodes
        //             .attr("cx", d => d.x)
        //             .attr("cy", d => d.y);
        //       });
        function parsedata(data) {
            let res=[];
            for(let i=0;i<11;i++) res.push([]);
            for(let d of data) res[d.c+1].push(d)
            return res;
        }
    };

    that.init = function(){
        that._init();
    }.call();

};

