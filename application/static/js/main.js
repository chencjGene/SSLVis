/*
* added by Changjian Chen, 20191015
* */

function load_data() {
    console.log("loading data...");

    DataLoader.init_notify();
}

function set_up(dataset) {
    DataLoader = new DataLoaderClass(dataset);
    GraphView = new GraphLayout(d3.select("#my-graph-all"));
    LossView = new ControlLayout(d3.select("#loss-view"));
    LossView.controlItem = GraphView;
    DataLoader.set_graph_view(GraphView);
    DataLoader.set_loss_view(LossView);
}

function clean_dom() {

}


// main (entry of the application)
$(document).ready(function () {
    // DatasetName = "cifar10";
    DatasetName = "OCT";
    // DatasetName = "Country_from_siemens";

    set_up(DatasetName);
    load_data();
});