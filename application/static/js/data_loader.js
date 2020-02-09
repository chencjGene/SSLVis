/*
* added by Changjian Chen, 20191015
* */


DataLoaderClass = function () {
    let that = this;

    that.dataset = null;

    // URL information
    that.manifest_url = "/graph/GetManifest";
    that.graph_url = "/graph/GetGraph";
    that.loss_url = "/graph/GetLoss";
    that.ent_url = "/graph/GetEnt";
    that.local_update_k_url = "/graph/LocalUpdateK";
    that.set_influence_filter_url = "/graph/SetInfluenceFilter";
    that.zoom_graph_url = "/graph/update";
    that.fisheye_graph_url = "/graph/fisheye";
    that.update_delete_and_change_label_url = "/graph/update_delete_and_change_label";
    that.flows_urls = "/dist/GetFlows";
    that.selected_flows_urls = "/dist/GetSelectedFlows";
    that.image_url = "/info/image";
    that.get_history_url = "/history/GetHistory";
    that.set_history_url = "/history/SetHistory";
    that.retrain_url = "/history/Retrain";
    that.set_k_url = "/graph/SetK";

    // Request nodes
    that.k_node = null;
    that.manifest_node = null;
    that.graph_node = null;
    that.update_graph_node = null;
    that.update_delete_and_change_label_node = null;
    that.loss_node = null;
    that.ent_node = null;
    that.flows_node = null;
    that.selected_flows_node = null;
    that.influence_filter_node = null;
    that.local_update_k_node = null;
    that.get_history_node = null;
    that.set_history_node = null;
    that.retrain_node = null;

    // views
    that.graph_view = null;
    that.dist_view = null;
    that.history_view = null;
    that.filter_view = null;
    that.edit_view = null;
    that.image_view = null;

    // Data storage
    that.state = {
        // manifest_data: null,
        k: null,
        filter_threshold: null,
        label_names: null,
        loss_data: null,
        img_url: null,
        ent_data: null,
        // label change info:
        label_sums: null,
        flows: null,
        dist_mode: true,
        selected_flows: null,
        // scented widget info:
        label_widget_data: null,
        label_widget_range:[-1, -1],
        uncertainty_widget_data: null,
        uncertainty_widget_range: [-1, -1],
        indegree_widget_data: null,
        indegree_widget_range: [-1, -1],
        outdegree_widget_data: null,
        outdegree_widget_range: [-1, -1],
        // graph info:
        nodes: null,
        path: [],
        is_show_path: false,
        highlights: null,
        area: null,
        rescale: false,
        visible_items:{},
        // history info:
        history_data: null,
        // edit info:
        edit_state: {
            deleted_idxs: [],
            labeled_idxs: [],
            labels: [],
            deleted_edges: []
        }
    };

    // Define topological structure of data retrieval
    that._init = function () {

    };

    that.set_dataset = function(dataset) {
        that.dataset = dataset;
        that.graph_view.remove_all();
        let params = "?dataset=" + that.dataset;
        that.manifest_node = new request_node(that.manifest_url + params,
            that.get_manifest_handler(function(){
                that.update_control_info();
                that.update_edit_info();
            }), "json", "GET");

        that.graph_node = new request_node(that.graph_url + params,
            that.get_graph_handler(that.get_graph_view), "json", "GET");
        that.graph_node.depend_on(that.manifest_node);

        // that.update_graph_node = new request_node(that.update_graph_url + params,
        //     that.update_graph_handler(that.update_graph_view), "json", "POST");

        that.update_delete_and_change_label_node = new request_node(that.update_delete_and_change_label_url + params,
            null, "json", "POST");

        // that.fisheye_graph_node = new request_node(that.fisheye_graph_url + params,
        //     that.update_fisheye_graph_handler(that.update_fisheye_view), "json", "POST");

        that.get_history_node = new request_node(that.get_history_url + params,
            that.update_history_handler(that.update_history_view), "json", "GET");
        that.get_history_node.depend_on(that.graph_node);
    }

    that.init_notify = function () {
        that.manifest_node.notify();
    };

    that.update_edit_info = function(){
        that.edit_view.update_info({
            label_names: that.state.label_names
        });
    };

    that.update_delete_and_change_label = function (edit_state) {
        that.state.edit_state = edit_state;
        that.update_delete_and_change_label_node.set_data(that.state.edit_state);
        that.update_delete_and_change_label_node.notify();
    };

    that.update_edit_state = function(data, mode){
        console.log("update_edit_state", data, mode);
        that.edit_view.update_focus(data, mode);
    };

    that.update_k = function(k){
        that.graph_view.remove_all();
        that.state.k = k;
        let graph_params = "?dataset=" + that.dataset + "&k=" +
            that.state.k + "&filter_threshold=" + that.state.filter_threshold;
        that.graph_node.set_url(that.graph_url + graph_params);
        that.graph_node.notify();
    };

    that.local_update_k = function(selected_idxs){
        let params = "?dataset=" + that.dataset;
        that.local_update_k_node = new request_node(that.local_update_k_url + params,
            that.local_update_k_handler(), "json", "POST");
        let data = {selected_idxs};
        that.local_update_k_node.set_data(data);
        that.local_update_k_node.notify();
    };

    that.update_filter_threshold = function(threshold){
        that.state.filter_threshold = threshold;
        let params = "?dataset=" + that.dataset +
            "&filter_threshold=" + that.state.filter_threshold;
        that.influence_filter_node = new request_node(that.set_influence_filter_url + params,
            that.set_influence_filter(), "json", "GET");
        that.influence_filter_node.notify();
    };

    that.set_view = function(v, name){
        that[name + "_view"] = v;
        v.set_data_manager(that);
    }

    // update img_url in states and update ImageView
    that.update_image_view = function(nodes){
        that.state.img_grid_urls = [];
        for(let node_id of nodes){
            that.state.img_grid_urls.push({
                url:that.image_url + "?filename=" + node_id + ".jpg",
                id:node_id,
            })
        }
        that.image_view.component_update({
            "img_grid_urls": that.state.img_grid_urls
        })
    };

    // that.update_graph_view = function(rescale){
    //     console.log("update graph view");
    //     that.graph_view.component_update({
    //         "graph_data": that.state.graph_data,
    //         "label_names": that.state.label_names
    //     }, rescale);
    // };
    //

    that.update_history_view = function(){
        console.log("update history view");
        that.history_view.component_update({
            "history_data": that.state.history_data
        });
    }

    that.get_dist_view = function(selected_idxs){
        let params = "?dataset=" + that.dataset;
        that.flows_node = new request_node(that.flows_urls + params,
            that.get_flows_handler(that.update_dist_view), "json", "POST");
        that.flows_node.set_data(selected_idxs);
        that.flows_node.notify();
        // that.flows_node.depend_on(that.graph_node);

    }

    that.update_dist_view = function(){
        console.log("update loss view");
        that.dist_view.component_update({
            "label_sums": that.state.label_sums,
            "flows": that.state.flows,
            "selected_flows": that.state.selected_flows,
            "label_names": that.state.label_names,
            "dist_mode": that.state.dist_mode
        });
    };

    that.retrain = function(){ 
        let params = "?dataset=" + that.dataset;
        that.retrain_node = new request_node(that.retrain_url + params,
            that.retrain_handler(that.update_history_view), "json", "POST");
        that.retrain_node.notify();
    };

    that.set_history = function(id){
        let params = "?dataset=" + that.dataset;
        that.set_history_node = new request_node(that.set_history_url + params,
            function(){}, "json", "POST");
        let data = {"id": id};
        that.set_history_node.set_data(data);
        that.set_history_node.notify();
    }

    that.change_dist_mode = function(){
        that.state.dist_mode = !that.state.dist_mode;
        that.update_dist_view();
    };

    that.get_selected_flows = function(path_id){
        that.selected_flows_node = new request_node(that.selected_flows_urls,
            that.selected_flows_handler(that.update_dist_view), "json", "POST");
        that.selected_flows_node.set_data({path_id});
        that.selected_flows_node.notify();
    };

    that.update_control_info = function() {
        $("#labeled-num").text(that.state.labeled_num + " Labeled data");
        $("#unlabeled-num").text(that.state.unlabeled_num + " Unlabeled data");
        SettingView.setk_ui(that.state.k);
    };


    that.get_filter_view = function(state) {
        that.state.uncertainty_widget_data = state.uncertainty_widget_data;
        that.state.uncertainty_widget_range = state.uncertainty_widget_range;
        that.state.label_widget_data = state.label_widget_data;
        that.state.label_widget_range = state.label_widget_range;
        that.state.indegree_widget_data = state.indegree_widget_data;
        that.state.indegree_widget_range = state.indegree_widget_range;
        that.state.outdegree_widget_data = state.outdegree_widget_data;
        that.state.outdegree_widget_range = state.outdegree_widget_range;
        that.update_filter_view();
    };

    that.update_filter_view = function() {
        console.log("update filter view");
        that.filter_view.component_update({
            "uncertainty_widget_data": that.state.uncertainty_widget_data,
            "uncertainty_widget_range": that.state.uncertainty_widget_range,
            "label_widget_data": that.state.label_widget_data,
            "label_widget_range": that.state.label_widget_range,
            "indegree_widget_data": that.state.indegree_widget_data,
            "indegree_widget_range":that.state.indegree_widget_range,
            "outdegree_widget_data":that.state.outdegree_widget_data,
            "outdegree_widget_range":that.state.outdegree_widget_range
        });
    };

    that.set_filter_data = function (nodes) {
        let iter = Object.values(nodes)[0].label.length-1;
        // uncertainty
        let certainty_distribution = [];
        let min_certainty = 0;
        let max_certainty = 1;
        let certainty_cnt = 20;
        for(let i=0; i<certainty_cnt; i++) certainty_distribution.push([]);
        function uncertainty_interval_idx(certainty){
            if(certainty === max_certainty){
                return certainty_cnt-1;
            }
            return Math.floor(certainty/((max_certainty-min_certainty)/certainty_cnt));
        }
        for(let node_id of Object.keys(nodes).map(d => parseInt(d))){
            if(nodes[node_id] === undefined){
                console.log("no node:", node_id);
                continue
            }
            let scores = nodes[node_id].score[iter];
            let sort_score = JSON.parse(JSON.stringify(scores));
            sort_score.sort(function(a,b){return parseFloat(a)-parseFloat(b)});
            let uncertainty = sort_score[sort_score.length-1]-sort_score[sort_score.length-2];
            // change certainty to uncertainty
            uncertainty = 1-uncertainty;
            let distribution_box = certainty_distribution[uncertainty_interval_idx(uncertainty)];
            distribution_box.push(node_id);
        }

        // label interval
        let min_label_id = -1;
        let max_label_id = 9;
        let labels = [];
        let label_cnt = max_label_id-min_label_id+1;
        for(let i=0; i<label_cnt; i++){
            labels.push(i)
        }
        function label_interval_idx(label_id){
            return label_id;
        }
        let label_distribution = [];
        for(let i=0; i<label_cnt; i++) label_distribution.push([]);
        for(let node_id of Object.keys(nodes).map(d => parseInt(d))){
            if(nodes[node_id] === undefined){
                console.log("no node:", node_id);
                continue
            }
            let predict_label = nodes[node_id].label[iter];
            let distribution_box = label_distribution[label_interval_idx(predict_label)+1];
            distribution_box.push(node_id);
        }

        // indegree interval
        let min_in_degree = 0;
        let max_in_degree = 20;
        let indegree_cnt = max_in_degree-min_in_degree;
        function indegree_interval_idx(in_degree){
            return in_degree>=max_in_degree?max_in_degree-1:in_degree;
        }
        let indegree_distribution = [];
        for(let i=0; i<indegree_cnt; i++) indegree_distribution.push([]);
        for(let node_id of Object.keys(nodes).map(d => parseInt(d))){
            if(nodes[node_id] === undefined){
                console.log("no node:", node_id);
                continue
            }
            let in_degree = nodes[node_id].in_degree;
            let distribution_box = indegree_distribution[indegree_interval_idx(in_degree)];
            distribution_box.push(node_id);
        }

        // indegree interval
        let min_out_degree = 0;
        let max_out_degree = 20;
        let outdegree_cnt = max_out_degree-min_out_degree;
        function outdegree_interval_idx(out_degree){
            return out_degree>=max_out_degree?max_out_degree-1:out_degree;
        }
        let outdegree_distribution = [];
        for(let i=0; i<outdegree_cnt; i++) outdegree_distribution.push([]);
        for(let node_id of Object.keys(nodes).map(d => parseInt(d))){
            if(nodes[node_id] === undefined){
                console.log("no node:", node_id);
                continue
            }
            let in_degree = nodes[node_id].out_degree;
            let distribution_box = outdegree_distribution[outdegree_interval_idx(in_degree)];
            distribution_box.push(node_id);
        }

        that.state.uncertainty_widget_data = certainty_distribution;
        that.state.label_widget_data = label_distribution;
        that.state.indegree_widget_data = indegree_distribution;
        that.state.outdegree_widget_data = outdegree_distribution;
    };

    that.set_filter_range = function (uncertainty_range, label_range, indegree_range, outdegree_range){
        that.state.uncertainty_widget_range = uncertainty_range;
        that.state.label_widget_range = label_range;
        that.state.indegree_widget_range = indegree_range;
        that.state.outdegree_widget_range = outdegree_range;
    };

    //graph view:
    // first load graph
    that.get_graph_view = function() {
        that.state.rescale = true;
        that.state.highlights = [];
        that.state.path = [];
        that.is_show_path = false;
        that.state.visible_items = {};
        for(let node_id of  Object.keys(that.state.nodes).map(d => parseInt(d))){
            that.state.visible_items[node_id] = true;
        }

        // update filter
        that.set_filter_data(that.state.nodes);
        let label_range = [];
        for(let i=0; i<11; i++){
            label_range.push(i);
        }
        that.set_filter_range([0, 19], label_range, [0, 19], [0,19]);
        that.update_filter_view();

        //update view
        that.update_graph_view();
    };

    that.update_graph_view = function() {
        console.log("update graph view");
        let show_ids = [];
        for(let node_id of Object.keys(that.state.nodes).map(d => parseInt(d))){
            if(that.state.visible_items[node_id] === true){
                show_ids.push(node_id);
            }
        }
        that.get_dist_view(show_ids);
        that.graph_view.component_update({
            "nodes":that.state.nodes,
            "path":that.state.path,
            "is_show_path":that.state.is_show_path,
            "highlights":that.state.highlights,
            "area":that.state.area,
            "rescale":that.state.rescale,
            "visible_items":that.state.visible_items
        })
    };

    that.zoom_graph_view = function() {
        that.set_filter_data(that.state.nodes);
        let ranges = that.filter_view.get_ranges();
        that.set_filter_range(ranges[0], ranges[1], ranges[2], ranges[3]);
        that.update_filter_view();
        that.state.visible_items = that.filter_view.get_visible_items();
        that.update_graph_view();
    };

    that.zoom_graph_view_notify = function (area, target_level) {
        let params = "?dataset=" + that.dataset;
        let update_graph_node = new request_node(that.zoom_graph_url + params,
            that.zoom_graph_handler(that.zoom_graph_view), "json", "POST");
        that.state.area = area;
        that.state.rescale = false;
        update_graph_node.set_data({
            'area': area,
            'level': target_level
        });
        update_graph_node.notify();
    };

    that.change_visible_items = function(visible_items) {
        that.state.visible_items = visible_items;
        that.state.rescale = false;
        that.update_graph_view();
    };

    that.fetch_graph_node = function(must_show_nodes, area, level, wh, mode, data) {
         let params = "?dataset=" + that.dataset;
        let fetch_graph = new request_node(that.fisheye_graph_url + params,
            that.fetch_graph_handler(that.zoom_graph_view), "json", "POST");
        that.state.area = area;
        that.state.rescale = false;
        if(mode === "showpath"){
            that.state.is_show_path = true;
            that.state.path = data;
        }
        else if(mode === "highlight"){
            that.state.is_show_path = false;
            that.state.highlights = data;
        }
        fetch_graph.set_data({
            'must_show_nodes':must_show_nodes,
            'area':area,
            'level':level,
            'wh':wh
        });
        fetch_graph.notify();
    };

    that.show_highlight_node = function(highlight_nodes) {
        that.state.highlights = highlight_nodes;
        that.state.is_show_path = false;
        that.state.rescale = false;
        that.update_graph_view();
    };

    that.show_path_node = function(path) {
        if(path.length > 0){
            that.state.path = path;
            that.state.is_show_path = true;
        }
        else {
            that.state.path = [];
            that.state.is_show_path = false;
        }
        that.state.rescale = false;
        that.update_graph_view();
    };

    // highlight nodes:
    that.highlight_nodes = function(nodes_id){
        that.graph_view.highlight(nodes_id);
    };

    that.init = function () {
        that._init();
    }.call();
};
