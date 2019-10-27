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

    that.centralize = function(nodes, width, height){
        let avx = 0;
        let avy = 0;
        for(let node of nodes){
            avx += node.x;
            avy += node.y;
        }
        avx /= nodes.length;
        avy /= nodes.length;
        let delx = width/2-avx;
        let dely = height/2 - avy;
        for (let node of nodes){
            node.x += delx;
            node.y += dely;
        }
    }

    that._update_view = function(){
        container.select("#graph-view-svg").remove();
        let svg = container.append("svg")
                            .attr("id", "graph-view-svg")
                            .attr("width", width)
                            .attr("height", height);
        console.log("width: ", width, "height: ", height);
        let area = width*height;
        // node data
        // graph_data = {
        //     node:[{c:-1, id:0, p:1},{c:-1, id:1, p:2},{c:-1, id:2, p:2},{c:-1, id:3, p:3},{c:-1, id:4, p:3}],
        //     link:[[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 4, 1], [4, 0, 1]]
        // };
        // let nodes_data = JSON.parse(JSON.stringify(graph_data.node));
        //
        // for(let node of nodes_data){
        //         node.x = (Math.random()-0.5)*20+width/2;
        //         node.y = (Math.random()-0.5)*20+height/2;
        // }
        $.post('/graph/GetNodes', {}, function (data) {
        let nodes_data = data['nodes'];
        let links_data = data['links'];
        for(let link of links_data){
            link.source = link.source.id;
            link.target = link.target.id;
        }
        console.log(data);
        let id2idx = {};
        let i=0;
        for(let node of nodes_data){
            id2idx[node.id] = i++;
        }
        // create focus data for test
        // let focus_nodes_data = [];
        // for(let node of nodes_data){
        //     if(node.p === 1){
        //         focus_nodes_data.push(node);
        //     }
        // }
        // link data
        // let links_data = [];
        // for(let link of graph_data.link){
        //     links_data.push({
        //         source:link[0],
        //         target:link[1],
        //         value:link[2]
        //     })
        // }

        // get D
        let n = nodes_data.length;
        // let D = that.all_paired_shortest_path(nodes_data, links_data);
        // // get max d
        // let maxd = 0;
        // for(let a of D){
        //     for(let b of a){
        //         if(b>maxd) maxd = b;
        //     }
        // }
        //
        // let L0 = Math.sqrt(area)/maxd;
        // D = D.map(row => row.map(d => L0*d));
        let D = nodes_data.map(u => nodes_data.map(v => Math.sqrt(Math.pow(u.x-v.x, 2)+Math.pow(u.y-v.y, 2))));
        let W = D.map(row => row.map(d => d===0?0:Math.pow(d, -2)));
        let L = D.map(row => row.map(d => d===0?0:-2*Math.pow(d, -2)));
        let center_weight = 0.005;
        let no_center_weight = 0.1;
        let center_count = 0;
        let C = [];
        let r = Math.min(width/2, height/2)*0.9;
        for(let rowidx=0; rowidx<n; rowidx++){
            let row = L[rowidx];
            let sum = 0;
            for(let colidx=0; colidx<n; colidx++){
                if(colidx===rowidx) continue;
                sum -= row[colidx];
            }
            row[rowidx] = sum;
            if(nodes_data[rowidx].p===2 || nodes_data[rowidx].p===1){
                row[rowidx] += center_weight;
                center_count++;
                C.push([width/2*center_weight, height/2*center_weight]);
            }
            else {
                row[rowidx] += no_center_weight;
                let len = Math.sqrt(Math.pow(nodes_data[rowidx].x-width/2, 2)+Math.pow(nodes_data[rowidx].y-height/2, 2));
                C.push([((nodes_data[rowidx].x-width/2)/len*r+width/2)*no_center_weight, ((nodes_data[rowidx].y-height/2)/len*r+height/2)*no_center_weight]);
            }
        }
        console.log("center count:", center_count);
        console.log("D: ", D);
        console.log("W: ", W);
        console.log("L: ", L);
        console.log("C: ", C);
        let X = nodes_data.map(d => [d.x, d.y]);
        let postdata = {
            D:D,
            W:W,
            L:L,
            C:C,
            X:X
        };
        let a=1;
        $.post('/graph/StressMajorization',{
            data:JSON.stringify(postdata)
        } , function (data) {
            // console.log(data);
            for(let rowidx=0; rowidx < n; rowidx++){
                nodes_data[rowidx].x = data[rowidx][0];
                nodes_data[rowidx].y = data[rowidx][1];
            }
            // that.centralize(nodes_data, width, height);
            console.log(nodes_data);
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
                .attr("fill", function (d) {
                    if(d.p===2||d.p===1) return "#000000";
                    if(d.c===-1){
                        return color_unlabel;
                    }
                    else return color_label[d.c];
                })
                .on("mouseover", function (d) {
                    console.log(d);
                });
        })
        });


    };

    that.init = function(){
        that._init();
    }.call();

};

