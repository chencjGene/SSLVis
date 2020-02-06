/*
* added by Changjian Chen, 20191015
* */

DataLoaderClass.prototype.get_manifest_handler = function (callback) {
    let that = this;

    // 这里必须以函数形式返回。因为DataLoaderClass本身没有manifest_handler这个函数，
    // 只有在调用时才会往上（prototype）寻找同名的函数
    function _manifest_handler(data) {
        console.log(that.manifest_url);
        console.log("manifest_handler");
        console.log(data);
        // that.state.manifest_data = data;
        that.state.k = data.k;
        that.state.filter_threshold = data.filter_threshold;
        that.state.label_names = data.label_names;
        that.state.labeled_num = data.labeled_num;
        that.state.unlabeled_num = data.all_num-data.labeled_num;
        if (callback) callback();
    }

    return _manifest_handler;
};

DataLoaderClass.prototype.get_graph_handler = function (callback) {
    let that = this;

    function _graph_handler(data) {
        console.log(that.manifest_url);
        console.log("graph_handler");
        console.log(data);
        that.state.graph_data = data;
        let selected_idxs = [];
        // TODO: move this part to callback
        for(let i in that.state.graph_data.nodes){
            selected_idxs.push(i);
        }
        that.get_dist_view(selected_idxs);
        if (callback) callback(true);
    }

    return _graph_handler;
};

DataLoaderClass.prototype.update_graph_handler = function (callback) {
    let that = this;

    function _update_graph_handler(data) {
        console.log(that.update_graph_url);
        console.log("update_graph_handler");
        console.log(data);
        that.state.graph_data = data;
        if (callback) callback(false);
    }

    return _update_graph_handler;
};

DataLoaderClass.prototype.update_fisheye_graph_handler = function (callback) {
    let that = this;

    function _update_fisheye_graph_handler(data) {
        console.log(that.fisheye_graph_url);
        console.log("fisheye_graph_handler");
        console.log(data);
        that.state.graph_data = data[0];
        that.state.area = data[1];
        if (callback) callback(false);
    }

    return _update_fisheye_graph_handler;
};

DataLoaderClass.prototype.get_loss_handler = function (callback) {
    let that = this;

    function _loss_handler(data) {
        that.state.loss_data = data;
        if (callback) callback();
    }

    return _loss_handler;
};

DataLoaderClass.prototype.get_ent_handler = function (callback) {
    let that = this;

    function _ent_handler(data) {
        that.state.ent_data = data;
        if (callback) callback();
    }

    return _ent_handler;
};

DataLoaderClass.prototype.get_flows_handler = function (callback) {
    let that = this;

    function _flows_handler(data){
        that.state.label_sums = data.label_sums;
        that.state.flows = data.flows;
        that.state.selected_flows = data.selected_flows;
        if (callback) callback();
    }
    return _flows_handler;
};

DataLoaderClass.prototype.selected_flows_handler = function(callback){
    let that = this;

    function _selected_flows_handler(data){
        that.state.selected_flows = data.selected_flows;
        console.log("selected_flows_handler", data);
        if (callback) callback();
    }
    return _selected_flows_handler;
}

DataLoaderClass.prototype.set_influence_filter = function(callback){
    let that = this;

    function _influence_filter_handler(data){
        // that.state
        // TODO:
    }

    return _influence_filter_handler;
};

DataLoaderClass.prototype.local_update_k_handler = function(callback){
    let that = this;

    function _local_update_k_handler(data){
        console.log("local_update_k_handler", data);

        if(callback) callback();
    }
    return _local_update_k_handler;
}

DataLoaderClass.prototype.update_history_handler = function(callback){
    let that = this;

    function _update_history_handler(data){
        console.log("update_history_handler");
        that.state.history_data = data;

        if (callback) callback();
    }
    return _update_history_handler;
}