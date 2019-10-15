/*
* added by Changjian Chen, 20191015
* */

function load_data() {
    console.log("loading data...");

    DataLoader.init_notify();
}

function set_up(dataset) {
    DataLoader = new DataLoaderClass(dataset);
    GraphView = new GraphLayout(d3.select("#graph-row"));

    DataLoader.set_graph_view(GraphView);
}

function clean_dom() {

}


// main (entry of the application)
$(document).ready(function () {
    DatasetName = "cifar10";
    // DatasetName = "Country_from_siemens";

    set_up(DatasetName);
    load_data();
});