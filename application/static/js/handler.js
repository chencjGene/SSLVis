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
        that.state.manifest_data = data;
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

DataLoaderClass.prototype.get_loss_handler = function (callback) {
    let that = this;

    function _loss_handler(data) {
        that.state.loss_data = data;
        if (callback) callback();
    }

    return _loss_handler;
};