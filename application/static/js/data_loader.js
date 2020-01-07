/*
* added by Changjian Chen, 20191015
* */


DataLoaderClass = function (dataset) {
    let that = this;

    that.dataset = dataset;

    // URL information
    that.manifest_url = "/graph/GetManifest";
    that.graph_url = "/graph/GetGraph";
    that.loss_url = "/graph/GetLoss";
    that.ent_url = "/graph/GetEnt";
    that.image_url = "/info/image";
    that.set_knn_url = "/graph/setK";
    that.set_influence_filter_url = "/graph/SetInfluenceFilter";

    // Request nodes
    that.manifest_node = null;
    that.graph_node = null;
    that.loss_node = null;
    that.ent_node = null;

    // views
    that.graph_view = null;
    that.loss_view = null;

    // Data storage
    that.state = {
        // manifest_data: null,
        k: null,
        filter_threshold: null,
        graph_data: null,
        loss_data: null,
        img_url: null,
        ent_data: null
    };

    // Define topological structure of data retrieval
    that._init = function () {
        let params = "?dataset=" + that.dataset;
        that.manifest_node = new request_node(that.manifest_url + params,
            that.get_manifest_handler(), "json", "GET");

        that.graph_node = new request_node(that.graph_url + params,
            that.get_graph_handler(that.update_graph_view), "json", "GET");
        that.graph_node.depend_on(that.manifest_node);

        that.loss_node = new request_node(that.loss_url + params,
            that.get_loss_handler(that.update_loss_view), "json", "GET");
        that.loss_node.depend_on(that.manifest_node);

        that.ent_node = new request_node(that.ent_url + params,
            that.get_ent_handler(that.update_ent_view), "json", "GET");
        that.ent_node.depend_on(that.manifest_node);
    };

    that.init_notify = function () {
        that.manifest_node.notify();
    };

    that.set_graph_view = function (v) {
        that.graph_view = v;
        v.set_data_manager(that);
    };

    that.set_loss_view = function(v){
        that.loss_view = v;
        v.set_data_manager(that);
    };

    that.set_image_view = function(v){
        that.image_view = v;
        v.set_data_manager();
    };

    // update img_url in states and update ImageView
    that.update_image_view = function(nodes){
        that.state.img_grid_urls = [];
        nodes.each(function (d) {
            let node = d3.select(this);
            that.state.img_grid_urls.push({
                url:that.image_url + "?filename=" + d.id + ".jpg",
                id:d.id,
                node:node
            })
        });
        that.image_view.component_update({
            "img_grid_urls": that.state.img_grid_urls
        })

    };

    that.update_graph_view = function(){
        console.log("update graph view");
        that.graph_view.component_update({
            "graph_data": that.state.graph_data
        })
    };

    that.update_loss_view = function(){
        console.log("update loss view");
        that.loss_view.component_update({
            "loss_data": that.state.loss_data
        })
    };

    that.update_ent_view = function(){
        console.log("update ent view");
        that.loss_view.component_update({
            "ent_data": that.state.ent_data
        })
    };

    that.init = function () {
        that._init();
    }.call();
};
