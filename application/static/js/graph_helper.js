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


GraphLayout.prototype.cal_vonoroi = function(nodes) {
    let that = this;
    //let nodes_dic = nodes;
    nodes = Object.values(nodes);
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
            if (Diagram.cells[i].nodes.length < 10) {
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
        "-5.722075812274367,-3.14427797833935": true,
        "-7.966393586005831,-1.406422740524782": true,
        "-0.617103386809269,7.017834224598929": true,
        "5.296328413284132,-4.526955719557195": true,
        "4.2830254138104,6.139549406453771": true,
        "0.930343117611701,2.3844940893608495": true,
        "2.4494735454385657,6.512194234487607": true,
    };
    let not_predefined_skeleton = {
        "-9.956811125485123,4.312367399741268": true,
        "-14.388622448979588,6.91364795918367": true,
        "-15.818022288446054,7.76523902651023": true,
        "-12.56665907019143,-3.3994712853236093": true,
        "-9.987834445086401,-9.385353222333105": true,
        "6.203132286462051,-12.226498929336188": true,
        // "7.654278000617093,11.524108299907436":true,
        "19.214696569920697,-6.769261213720301": true,
        "15.842210065645485,-6.407242888402623": true,
        "10.914449977866314,-5.776489597166888": true,
        "-0.4081211279641104,3.643222602008118":true,
        "4.2830254138104,6.139549406453771":true
    };
    let replace_node = {
        "17.321140939597328,28.08":[5.75864906343549, 28.08],
        "23.58403917964593,-7.684647092967011":[100000000.58403917964593, 1.0099118618981962],
        "8.292218045112781,5.952518796992482":[8.088306451612903, 6.8701209677419355],
        "0.930343117611701,2.3844940893608495":[-0.5342129694753129, 3.778111548741032]
    };
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
                if((predefined_skeleton[node_key]) && (skeleton.length===0 || skeleton[skeleton.length-1][0] !== mid_node[0] || skeleton[skeleton.length-1][1] !== mid_node[1])) skeleton.push(mid_node);
                if((start_edges[mid_key].length > 2) && (skeleton.length===0 || skeleton[skeleton.length-1][0] !== mid_node[0] || skeleton[skeleton.length-1][1] !== mid_node[1])) skeleton.push(mid_node);
                if(Math.sqrt(Math.pow(mid_node[0]-next_node[0], 2) + Math.pow(mid_node[1]-next_node[1], 2)) > 3){
                    if(skeleton.length===0 || skeleton[skeleton.length-1][0] !== mid_node[0] || skeleton[skeleton.length-1][1] !== mid_node[1]) skeleton.push(mid_node);
                    if(!not_predefined_skeleton[next_key]) skeleton.push(next_node);
                }
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
        let skeleton = cell.skeleton;
        for(let node of skeleton){
            let node_key = node[0]+","+node[1];
            if(replace_node[node_key]){
                node[0] = replace_node[node_key][0];
                node[1] = replace_node[node_key][1];
            }
        }
    }
    for(let cell of Diagram.cells){
        let new_skeleton = [];
        let old_skeleton = cell.skeleton;
        for(let i=0; i<cell.skeleton.length; i++){
            new_skeleton.push([old_skeleton[i], old_skeleton[i+1===cell.skeleton.length?0:i+1]])
        }
        cell.skeleton = new_skeleton;
    }


    // change direction of long edges


    return Diagram;
};

GraphLayout.prototype.get_cell_path = function(edge_id, scale){
    let that = this;
    let cells = that.vonoroi_data.cells;
    let edges = that.vonoroi_data.edges;

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

GraphLayout.prototype.get_skeleton_path = function(edge, scale){
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