/*
* added by Changjian Chen, 20191015
* */


DataLoaderClass = function (dataset) {
    let that = this;

    that.dataset = dataset;

    // URL information
    that.manifest_url = "/graph/GetManifest";
    that.graph_url = "/graph/GetGraph";

    // Request nodes
    that.manifest_node = null;
    that.instance_graph_node = null;

    // views
    that.concept_graph_view = null;

    // Data storage
    that.state = {
        manifest_data: null,
    };

    // Define topological structure of data retrieval
    that._init = function () {
        let params = "?dataset=" + that.dataset;
        that.manifest_node = new request_node(that.manifest_url + params,
            that.get_manifest_handler(), "json", "GET");


        that.node_name_node = new request_node(that.node_name_url + params,
            that.get_node_name_handler(that.update_search_view), "json", "GET");
        that.node_name_node.depend_on(that.manifest_node);

        that.get_max_degree_node_node = new request_node(that.get_max_degree_node_url + params,
            that.get_max_degree_node_handler(that.search), "json", "GET");
        that.get_max_degree_node_node.depend_on(that.node_name_node);
        that.query_filter_view_data_dict();
    };

    that.init_notify = function () {
        that.manifest_node.notify();
    };


    that.init = function () {
        that._init();
    }.call();
};
