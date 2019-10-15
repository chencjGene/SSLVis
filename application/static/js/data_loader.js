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
            function(){}, "json", "GET");

        that.graph_node = new request_node(that.graph_url + params,
            function(){}, "json", "GET");
        that.graph_node.depend_on(that.manifest_node);
    };

    that.init_notify = function () {
        that.manifest_node.notify();
    };


    that.init = function () {
        that._init();
    }.call();
};
