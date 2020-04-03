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
    let that = this;
    nodes = Object.values(nodes);
    let cls = nodes.map(d => d.label.slice(-1)[0]);
    cls = cls.delRepeat();
    centers = {};
    for (let i of cls){
        nodes_in_cls = nodes.filter(d => d.label.slice(-1)[0] === i);
        let center_x = average(nodes_in_cls.map(d => d.x));
        let center_y = average(nodes_in_cls.map(d => d.y));
        centers[i] = [center_x, center_y, i, nodes_in_cls];
    }
    let Diagram = null;
    for (let _iter = 0; _iter < 50; _iter++){
        if (_iter !== 0){
            for (let i = 0; i < cls.length; i++){
                node_in_cls = centers[i][3];
                exclude_node = [];
                for(let j = 0; j < node_in_cls.length; j++){
                    let nearest_cell = Diagram.find(node_in_cls[j].x, node_in_cls[j].y);
                    if(nearest_cell.data[2] !== i){
                        exclude_node.push(node_in_cls[j]);
                    }
                }
                if (i === 4){
                    console.log("exclude node", exclude_node);
                }
                if (exclude_node.length > 0){
                    let exclude_center_x = average(exclude_node.map(d => d.x));
                    let exclude_center_y = average(exclude_node.map(d => d.y));
                    centers[i][0] = centers[i][0] + 0.02 * exclude_node.length / node_in_cls.length * (exclude_center_x - centers[i][0]);
                    centers[i][1] = centers[i][1] + 0.02 * exclude_node.length / node_in_cls.length * (exclude_center_y - centers[i][1]);
                }
            }
        }
        let voronoi = d3.voronoi()
                .extent([[that.xRange[0] * 2, that.yRange[0] * 2],
                     [that.xRange[1] * 2, that.yRange[1] * 2]]);
        Diagram = voronoi(Object.values(centers));
        let poly = Diagram.polygons();
        for (let i = 0; i < Diagram.cells.length; i++){
            Diagram.cells[i].id = Diagram.cells[i].site.data[2];
            Diagram.cells[i].poly = poly[i];
        }
    }
    return Diagram;
};

GraphLayout.prototype.get_cell_path = function(cell, scale){
    let that = this;
    let cells = that.vonoroi_data.cells;
    let edges = that.vonoroi_data.edges;
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
}