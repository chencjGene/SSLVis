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