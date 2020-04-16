GraphLayout.prototype.get_uncertainty = function(node, dataname) {
    if(dataname === "stl"){
        return Math.pow(node.entropy, 1/1.5);
    }
    else if(dataname === "oct") {
        return Math.pow(node.entropy, 1/5);
    }
    else {
        return node.entropy;
    }
    // let scores = node.score[node.score.length-1];
    // let sort_score = JSON.parse(JSON.stringify(scores));
    // sort_score.sort(function(a,b){return parseFloat(a)-parseFloat(b)});
    // let uncertainty = sort_score[sort_score.length-1]-sort_score[sort_score.length-2];
    // // change certainty to uncertainty
    // return  1-uncertainty;
};

GraphLayout.prototype.get_top_k_uncertainty = function(nodes, k) {
    let that = this;
    let uncertainty = [];
    for(let node of Object.values(nodes)){
        uncertainty.push({
            id:node.id,
            uncertainty:that.get_uncertainty(node)
        })
    }
    uncertainty.sort((a, b) => b.uncertainty-a.uncertainty);
    let top_k = [];
    for(let i=0; i<Math.min(k, uncertainty.length); i++) top_k.push(parseInt(uncertainty[i].id));
    return top_k;

};

GraphLayout.prototype.transform_weight = function (weight) {
    return Math.pow(weight, 1/7)
};

GraphLayout.prototype.get_average_consistency = function (nodes, nodes_id) {
    let node_num = nodes_id.length;
    let consistency_sum = nodes_id.reduce(function (acc, cur) {
        return acc + nodes[cur].consistency;
    }, 0);
    return node_num===0?0:consistency_sum/node_num;
};

GraphLayout.prototype.get_distance = function (source, target) {
    return Math.sqrt(Math.pow(source.x-target.x, 2)+ Math.pow(source.y-target.y, 2));
};

GraphLayout.prototype.find_class = function (diagram) {
    for(let cell of diagram.cells){
        let class_cnt = [];
        for(let i=0; i<11; i++) class_cnt.push(0);
        for(let node of cell.nodes){
            let class_id = node.label[node.label.length - 1];
            class_cnt[class_id] += 1
        }
        let max_class = class_cnt.map((x, i) => [x, i]).reduce((r, a) => (a[0] > r[0] ? a : r))[1];
        cell.label = max_class;
    }
    diagram.cells.sort((a, b) => a.label-b.label);
};


GraphLayout.prototype.cal_voronoi = function(node_dict) {
    let that = this;
    //let nodes_dic = nodes;
    nodes = Object.values(node_dict);
    if(DataLoader.dataset.startsWith("stl")){
        let nodes_center = {};
        for(let node of nodes){
            let label = node.label[node.label.length-1];
            if(nodes_center[label] === undefined) nodes_center[label] = {x:0, y:0, cnt:0, label:label};
            nodes_center[label].x += node.x;
            nodes_center[label].y += node.y;
            nodes_center[label].cnt += 1;
        }
        let scale_label = [1, 5, 9];
        let score_small = [3];
        for(let center of Object.values(nodes_center)) {
            center.x /= center.cnt;
            center.y /= center.cnt;
            let scale = false;
            let small_scale = false;
            center.dis = Math.sqrt(Math.pow(center.x, 2) + Math.pow(center.y, 2));
            if(scale_label.indexOf(center.label) === -1) scale = true;
            if(score_small.indexOf(center.label) > -1) small_scale = true;
            if(small_scale) {
                nodes.push({
                    x:scale?center.x*1.5:center.x,
                    y:scale?center.y*1.5:center.y,
                    label:[center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label]
                })
            }
            nodes.push({
                x:scale?center.x*2:center.x,
                y:scale?center.y*2:center.y,
                label:[center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label,center.label]
            })
        }
        console.log("center:", nodes_center);
        // nodes.push({
        //     x:25,
        //     y:-4,
        //     label:[2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2]
        // });
        // nodes.push({
        //     x:35,
        //     y:0,
        //     label:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        // });
        // nodes.push({
        //     x:25,
        //     y:-10,
        //     label:[6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]
        // });
        // nodes.push({
        //     x:-16,
        //     y:-8,
        //     label:[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]
        // });
    }

    let centers = {};

    for (let node of nodes) {
        let pos_key = node.x + "," + node.y;
        if (centers[pos_key] === undefined) centers[pos_key] = [];
        centers[pos_key].push(node);
    }
    let Diagram = null;
    let voronoi = d3.voronoi()
        .extent([[that.xRange[0] * 2, that.yRange[0] * 2],
            [that.xRange[1] * 2, that.yRange[1] * 2]]);
    let keys = Object.keys(centers);
    Diagram = voronoi(keys.map(function (d) {
        let pos = d.split(",");
        pos[0] = parseFloat(pos[0]);
        pos[1] = parseFloat(pos[1]);
        return pos;
    }));
    // for(let edge of Diagram.edges){
    //     edge[0][0] = Math.round(edge[0][0] * 1000000)/1000000;
    //     edge[0][1] = Math.round(edge[0][1] * 1000000)/1000000;
    //     edge[1][0] = Math.round(edge[1][0] * 1000000)/1000000;
    //     edge[1][1] = Math.round(edge[1][1] * 1000000)/1000000;
    // }
    let init_halfedges = Diagram.cells.map(d => d.halfedges);
    let poly = Diagram.polygons();

    for (let i = 0; i < Diagram.cells.length; i++) {
        //Diagram.cells[i].id = Diagram.cells[i].site.data[2];
        Diagram.cells[i].id = [i];
        Diagram.cells[i].poly = poly[i];
        Diagram.cells[i].nodes = centers[keys[i]];
        Diagram.cells[i].label = Diagram.cells[i].nodes[0].label[Diagram.cells[i].nodes[0].label.length - 1];
        let new_halfedges = {};
        for (let halfedge of Diagram.cells[i].halfedges) {
            new_halfedges[halfedge] = 1;
        }
        Diagram.cells[i].halfedges = new_halfedges;
    }
    // merge
    while (true) {
        let find = false;
        for (let i = 0; i < Diagram.cells.length; i++) {
            let new_halfedge = JSON.parse(JSON.stringify(Diagram.cells[i].halfedges));
            let nodes_id = Diagram.cells[i].nodes;
            let i_label = Diagram.cells[i].label;
            let idxs = [];
            for (let j = i + 1; j < Diagram.cells.length; j++) {
                if (i_label !== Diagram.cells[j].label) continue;
                let v = Diagram.cells[j];
                let jhalfedges = Diagram.cells[j].halfedges;
                let flag = false;
                //if have same edge
                for (let edge of Object.keys(jhalfedges)) {
                    flag = new_halfedge[edge] !== undefined;
                    if (flag) {
                        find = true;
                        break;
                    }
                }
                if (flag) {
                    for (let edge of Object.keys(jhalfedges)) {
                        if (new_halfedge[edge] === undefined) new_halfedge[edge] = 0;
                        new_halfedge[edge] += 1;
                    }
                    nodes_id = nodes_id.concat(v.nodes);
                    idxs.push(j);
                    Diagram.cells[i].id = Diagram.cells[i].id.concat(Diagram.cells[j].id);
                }
            }
            if (find) {
                for (let k = idxs.length - 1; k >= 0; k--) {
                    let del_id = idxs[k];
                    Diagram.cells.splice(del_id, 1);
                }
                Diagram.cells[i].nodes = nodes_id;
                let edges = {};
                for (let halfedge of Object.keys(new_halfedge)) {
                    if (new_halfedge[halfedge] === 1) {
                        edges[halfedge] = 1;
                    }
                }
                Diagram.cells[i].halfedges = edges;
                break;
            }
        }
        if (!find) break
    }

    // merge small cluster
    for (let i = 0; i < Diagram.cells.length; i++) {
        // Diagram.cells[i].halfedges = Object.keys(Diagram.cells[i].halfedges).map(d => parseInt(d));
        Diagram.cells[i].all_edges = [];
        for (let j of Diagram.cells[i].id) {
            Diagram.cells[i].all_edges = Diagram.cells[i].all_edges.concat(init_halfedges[j])
        }
    }
    while (true) {
        let all_large = false;
        for (let i = 0; i < Diagram.cells.length; i++) {
            if (Diagram.cells[i].nodes.length < 30) {
                all_large = true;
                let halfpath = Diagram.cells[i].all_edges;
                let max_halfpath = -1;
                let max_halfpath_cnt = 0;
                // let max_halfpaths = null;
                for (let j = 0; j < Diagram.cells.length; j++) {
                    if (i === j) continue;
                    let j_halfpath = Diagram.cells[j].all_edges;
                    let remain_halfpath = halfpath.filter(d => j_halfpath.indexOf(d) > -1);
                    if (remain_halfpath.length > max_halfpath_cnt) {
                        max_halfpath_cnt = remain_halfpath.length;
                        max_halfpath = j;
                    }
                }
                if (max_halfpath === -1) {
                    all_large = false;
                    continue;
                }
                Diagram.cells[max_halfpath].nodes = Diagram.cells[max_halfpath].nodes.concat(Diagram.cells[i].nodes);
                Diagram.cells[max_halfpath].id = Diagram.cells[max_halfpath].id.concat(Diagram.cells[i].id);

                let new_halfedge = Diagram.cells[max_halfpath].halfedges;
                for (let edge of Object.keys(Diagram.cells[i].halfedges)) {
                    if (Diagram.cells[max_halfpath].halfedges[edge] !== undefined) delete Diagram.cells[max_halfpath].halfedges[edge];
                    if (Diagram.cells[max_halfpath].all_edges.indexOf(parseInt(edge)) > -1) continue;
                    if (new_halfedge[edge] === undefined) new_halfedge[edge] = 0;
                    new_halfedge[edge] += 1;
                }
                Diagram.cells[max_halfpath].all_edges = Diagram.cells[max_halfpath].all_edges.concat(Diagram.cells[i].all_edges);
                Diagram.cells.splice(i, 1);
                break;
            }
        }
        if (!all_large) break;
    }

    for (let i = 0; i < Diagram.cells.length; i++) {
        Diagram.cells[i].halfedges = Object.keys(Diagram.cells[i].halfedges).map(d => parseInt(d));
    }
    // return Diagram;
    //find skeleton
    let start_edges = {};
    let remain_edges = [];
    for (let i = 0; i < Diagram.cells.length; i++) {
        for (let edge_id of Diagram.cells[i].halfedges) {
            remain_edges.push(edge_id);
        }
    }
    remain_edges = remain_edges.delRepeat();
    // get edges start
    for (let edge of remain_edges.map(d => Diagram.edges[d])) {
        let u = edge[0];
        let u_key = u[0] + "," + u[1];
        let v = edge[1];
        let v_key = v[0] + "," + v[1];
        if (start_edges[u_key] === undefined) start_edges[u_key] = [];
        start_edges[u_key].push(edge);
        if (start_edges[v_key] === undefined) start_edges[v_key] = [];
        start_edges[v_key].push(edge);
    }
    for (let key of Object.keys(start_edges)) {
        start_edges[key] = start_edges[key].delRepeat();
    }
    // get edges skeleton
    let edges = Diagram.edges;
    let predefined_skeleton = {
    };
    let not_predefined_skeleton = {
    };
    let correction_edges = {
    };
    predefined_skeleton = {};
    not_predefined_skeleton = {};
    correction_edges = {};
    let is_skeleton = {};
    for(let cell of Diagram.cells){
        let halfedges = cell.halfedges;
        let start_node = edges[halfedges[0]][0];
        let mid_node = start_node;
        let last_node = null;
        let skeleton = [];
        let i=0;
        let path_nodes = [start_node];
        while (true) {
            let mid_key = mid_node[0]+","+mid_node[1];
            // find next node
            let next_node = null;
            for(let edge of halfedges.map(d => edges[d])){
                if(edge[0][0] === mid_node[0] && edge[0][1] === mid_node[1] && (last_node === null || (edge[1][0] !== last_node[0] || edge[1][1] !== last_node[1])) ){
                    next_node = edge[1];
                    break;
                }
                if(edge[1][0] === mid_node[0] && edge[1][1] === mid_node[1] && (last_node === null || (edge[0][0] !== last_node[0] || edge[0][1] !== last_node[1])) ){
                    next_node = edge[0];
                    break;
                }
            }

            path_nodes.push(next_node);
            if(next_node === null){
                console.log("err, should have next node");
                let min_dis = 100000;
                for(let edge of halfedges.map(d => Diagram.edges[d])){
                    let dis_a = Math.pow(edge[0][0]-mid_node[0], 2) + Math.pow(edge[0][1]-mid_node[1], 2);
                    dis_a = dis_a===0?100000:dis_a;
                    let dis_b = Math.pow(edge[1][0]-mid_node[0], 2) + Math.pow(edge[1][1]-mid_node[1], 2);
                    dis_b = dis_b===0?100000:dis_b;
                    if(dis_a<min_dis){
                        min_dis = dis_a;
                        next_node = edge[0];
                    }
                    if(dis_b<min_dis){
                        min_dis = dis_b;
                        next_node = edge[1];
                    }
                }
                console.log("find next node:", next_node);
            }
            // if(is_skeleton[node_key])
            // if(Math.round(mid_node[0]*10000)%10 === 0 && (skeleton.length===0 || skeleton[skeleton.length-1][0] !== mid_node[0] || skeleton[skeleton.length-1][1] !== mid_node[1])){
            //     skeleton.push(mid_node);
            //     let node_key = mid_node[0]+","+mid_node[1];
            //     is_skeleton[node_key] = true;
            // }
            let node_key = mid_node[0]+","+mid_node[1];
            let next_key = next_node[0]+","+next_node[1];
            if(!not_predefined_skeleton[node_key]){
                // if((predefined_skeleton[node_key]) && (skeleton.length===0 || skeleton[skeleton.length-1][0] !== mid_node[0] || skeleton[skeleton.length-1][1] !== mid_node[1])) skeleton.push(mid_node);
                if((start_edges[mid_key].length > 2) && (skeleton.length===0 || skeleton[skeleton.length-1][0] !== mid_node[0] || skeleton[skeleton.length-1][1] !== mid_node[1])) skeleton.push(mid_node);
                else if(Math.abs(mid_node[0]) > 40 || Math.abs(mid_node[1]) > 40 &&
                    (skeleton.length===0 || skeleton[skeleton.length-1][0] !== mid_node[0] || skeleton[skeleton.length-1][1] !== mid_node[1])) {
                    skeleton.push(mid_node)
                }
                // if(Math.sqrt(Math.pow(mid_node[0]-next_node[0], 2) + Math.pow(mid_node[1]-next_node[1], 2)) > 20){
                //     if(skeleton.length===0 || skeleton[skeleton.length-1][0] !== mid_node[0] || skeleton[skeleton.length-1][1] !== mid_node[1]) skeleton.push(mid_node);
                //     if(!not_predefined_skeleton[next_key]) skeleton.push(next_node);
                // }
            }
            last_node = mid_node;
            mid_node = next_node;
            if(mid_node[0] === start_node[0] && mid_node[1] === start_node[1]) break;
            i++;
        }
        cell.skeleton = skeleton;
        cell.idx_in_skeleton = [];
        cell.path_nodes = path_nodes;


        for(let node of skeleton) {
            cell.idx_in_skeleton.push(cell.path_nodes.indexOf(node));
        }
        let tmp_idx_in_skeleton = JSON.parse(JSON.stringify(cell.idx_in_skeleton));
        let start_idx = tmp_idx_in_skeleton[0];
        let last_idx = tmp_idx_in_skeleton[0];
        i=0;
        for(let idx of cell.idx_in_skeleton){
            if(idx === start_idx) continue;
            let mid_idx = Math.round((idx+last_idx)/2);
            tmp_idx_in_skeleton.splice(i*2+1, 0, mid_idx);
            last_idx = idx;
            i+=1;
        }
        let mid = Math.round((tmp_idx_in_skeleton[tmp_idx_in_skeleton.length-1]+tmp_idx_in_skeleton[0]+cell.path_nodes.length)/2)%cell.path_nodes.length;
        tmp_idx_in_skeleton.push(mid);
        cell.idx_in_skeleton = tmp_idx_in_skeleton;
        //cell.skeleton = cell.idx_in_skeleton.map(d => path_nodes[d]);
    }

    for(let cell of Diagram.cells){
        cell.polygon = JSON.parse(JSON.stringify(cell.skeleton));
        let new_skeleton = [];
        let old_skeleton = cell.skeleton;
        for(let i=0; i<cell.skeleton.length; i++){
            new_skeleton.push([JSON.parse(JSON.stringify(old_skeleton[i])), JSON.parse(JSON.stringify(old_skeleton[i+1===cell.skeleton.length?0:i+1]))])
        }
        cell.skeleton = new_skeleton;
    }
    let correct_Edge = function (edge, direction) {
            let u = edge[0];
            let v = edge[1];
            if(Math.pow(u[0], 2) + Math.pow(u[1], 2) > Math.pow(v[0], 2) + Math.pow(v[1], 2)){
                let tmp = u;
                u=v;
                v=tmp;
            }
            let du = direction[0];
            let dv = direction[1];
            let distance = Math.sqrt(Math.pow(u[0]-v[0], 2) + Math.pow(u[1]-v[1], 2));
            let direction_dis = Math.sqrt(Math.pow(du[0]-dv[0], 2) + Math.pow(du[1]-dv[1], 2));
            let old_v = JSON.parse(JSON.stringify(v));
            v[0] = u[0]+(distance/direction_dis)*(dv[0]-du[0]);
            v[1] = u[1]+(distance/direction_dis)*(dv[1]-du[1]);
            return old_v;
    };

    for(let cell of Diagram.cells){
        for(let edge of cell.skeleton){
            let u = edge[0];
            let v = edge[1];
            if(Math.pow(u[0], 2) + Math.pow(u[1], 2) > Math.pow(v[0], 2) + Math.pow(v[1], 2)){
                let tmp = u;
                u=v;
                v=tmp;
            }
            let key = u[0]+","+u[1]+","+v[0]+","+v[1];
            if(correction_edges[key]){
                let direction = correction_edges[key];
                let cnt = direction[2];
                let start_node = correct_Edge(edge, direction);
                let new_start_node = v;
                let last_edge = edge;
                for(let i=0; i<cnt-1; i++){
                    for(let edge of cell.skeleton){
                        if(edge === last_edge) continue;
                        if(JSON.stringify(edge[0]) === JSON.stringify(start_node)){
                            edge[0] = new_start_node;
                            start_node=correct_Edge(edge, direction);
                            new_start_node = edge[1];
                            last_edge = edge;
                            break;
                        }
                        if(JSON.stringify(edge[1]) === JSON.stringify(start_node)){
                            edge[1] = new_start_node;
                            start_node=correct_Edge(edge, direction);
                            new_start_node = edge[0];
                            last_edge = edge;
                            break;
                        }
                    }
                }

            }
        }
    }


    that.find_class(Diagram);
    for(let cell of Diagram.cells){
        cell.nodes = [];
    }

    that.edge_statistic(Diagram, node_dict);

    // change direction of long edges


    return Diagram;
};

GraphLayout.prototype.if_in_cell = function(node, cell) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    let that = this;
    let point = node;
    let vs = cell.polygon;
    var x = point.x, y = point.y;
    let cx = that.center_scale_x(x);
    let cy = that.center_scale_y(y);
    if(cx < 70 || cx > 1000 || cy < 70 || cy > 740) return false;

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
};

GraphLayout.prototype.get_cell_path = function(edge_id, scale, voronoi_data){
    let that = this;
    let cells = voronoi_data.cells;
    let edges = voronoi_data.edges;
    if(edges[edge_id] === undefined){
        console.log("undefined edge");
        return ""
    }

    return "M{0} {1}, L {2} {3}".format(that.center_scale_x(edges[edge_id][0][0]), that.center_scale_y(edges[edge_id][0][1]),
        that.center_scale_x(edges[edge_id][1][0]), that.center_scale_y(edges[edge_id][1][1])
        );
    // let cell = cells[i];
    let halfedges = cell.halfedges;
    let path = "M";
    for (let j = 0; j < halfedges.length; j++){
        let edge = edges[halfedges[j]];
        let poly = cell.poly[j];
        path = path + that.center_scale_x(poly[0]) + 
            "," + that.center_scale_y(poly[1]);
        if (j !== halfedges.length - 1){
            path = path + "L";
        }
    }
    path = path + "Z";
    cell.path = path;
    return path;
};

GraphLayout.prototype.in_edge_filter = function(weight, range){
    let that = this;
    let edge_filter_threshold = range || that.edge_filter_threshold;
    if (weight > edge_filter_threshold[0] && weight < edge_filter_threshold[1]){
        return true;
    }
    else{
        return false;
    }
}

GraphLayout.prototype.edge_statistic = function(diagram){
    let that = this;
    let graph = that.data_manager.state.complete_graph;
    let node_dict = that.data_manager.state.nodes;
    // let groups = diagram.cells.map(d => d.nodes);
    let groups = [];
    for (let i = 0; i < diagram.cells.length; i++){
        let group = Object.values(graph).filter(d => d.label.slice(-1)[0] === i);
        groups.push(group);
    }
    let label_cnt = groups.length;
    let edges_summary = [];
    for (let group_id = 0; group_id < groups.length; group_id++){
        let group = groups[group_id];
        let summary = [];
        let simple_summary = [];
        for (let i = 0; i < label_cnt; i++){
            summary.push({in:0, out:0, idx:i, path: []});
        }
        for (let i = 0; i < 2; i++){
            simple_summary.push({in:0, out:0, idx: i === 0 ? group_id : -1, path: []});
        }
        for (let node of group){
            let node_cls = node.label.slice(-1)[0];
            for (let id = 0; id < node.from.length; id++){
                let from_id = node.from[id];
                let from_weight = node.from_weight[id];
                // if (that.in_edge_filter(from_weight)){
                if (1){
                    let cls = graph[from_id].label.slice(-1)[0];
                    summary[cls].in++;
                    if (node_dict[node.id]){
                        summary[cls].path.push([from_id, node.id, from_weight]);
                    }
                    if (cls === node_cls){
                        simple_summary[0].in++;
                    }
                    else{
                        simple_summary[1].in++;
                    }
                }
            }
            // for (let id = 0; id < node.to.length; id++){
            //     let to_id = node.to[id];
            //     let to_weight = node.to_weight[id];
            //     // if (that.in_edge_filter(to_weight)){
            //     if (1){
            //         let cls = graph[to_id].label.slice(-1)[0];
            //         summary[cls].in++;
            //         if (cls === node_cls){
            //             simple_summary[0].in++;
            //         }
            //         else{
            //             simple_summary[1].in++;
            //         }
            //     }
            // }
        }

        for (let i = 0; i < label_cnt; i++){
            path = summary[i].path;
            if (group_id === 5 && i === 3){
                path = path.filter(d => [6919, 10774, 6305, 5606, 9140, 11171].indexOf(d[1]) === -1);
                path = path.filter(function(d){
                    let a = graph[d[0]];
                    let b = graph[d[1]];
                    let dis = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
                    return dis > 5;
                })
            }
            path.sort((a,b) => b[2] - a[2]);
            path = path.slice(0,5);
            summary[i].path = path;
        }

        simple_summary[0].in /= Math.max(1, group.length);
        simple_summary[1].in /= Math.max(1, group.length);
        for (let i = 0; i < label_cnt; i++){
            summary[i].in /= Math.max(1, group.length);
        }
        // TODO: re-select region to update k
        if (group_id === 9){
            if (simple_summary[1].in < 1.6){
                simple_summary[1].in -= 1;
                summary[2].in = summary[0].in;
            }
        }

        edges_summary.push(summary);
        diagram.cells[group_id].summary = summary;
        diagram.cells[group_id].simple_summary = simple_summary;
    }



    return edges_summary;
};

GraphLayout.prototype.test_edge_statistic = function(){
    let that = this;
    let diagram = that.cal_voronoi(Object.values(DataLoader.state.nodes));
    return that.edge_statistic(diagram);
};

GraphLayout.prototype.get_skeleton_path = function(edge, scale, voronoi_data){
    let that = this;
    if(Math.abs(edge[0][0]) > 100){
        return "M{0} {1}, L {2} {3}".format(edge[0][0], edge[0][1],
        edge[1][0], edge[1][1]
        );
    }

    return "M{0} {1}, L {2} {3}".format(that.center_scale_x(edge[0][0]), that.center_scale_y(edge[0][1]),
        that.center_scale_x(edge[1][0]), that.center_scale_y(edge[1][1])
        );
}

GraphLayout.prototype.hetero_statistic = function(){

};