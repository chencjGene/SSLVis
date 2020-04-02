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


GraphLayout.prototype.cal_vonoroi = function(nodes){
    nodes = Object.values(nodes);
    let cls = nodes.map(d => d.label.slice(-1)[0]);
    cls = cls.delRepeat();
    centers = {};
    for (let i of cls){
        nodes_in_cls = nodes.filter(d => d.label.slice(-1)[0] === i);
        let center_x = average(nodes.map(d => d.x));
        let center_y = average(nodes.map(d => d.y));
        centers[i] = [center_x, center_y];
    }
    let voronoi = d3.voronoi();
    let c = voronoi.voronoi(cneters);
    return c;
};