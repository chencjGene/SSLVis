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
    ImageView = new ImageLayout(d3.select("#image-row"));
    DataLoader.set_graph_view(GraphView);
    DataLoader.set_loss_view(LossView);
    DataLoader.set_image_view(ImageView);
}

function clean_dom() {

}


// main (entry of the application)
$(document).ready(function () {
    // DatasetName = "cifar10";
    // DatasetName = "OCT";
    // DatasetName = "stl";
    DatasetName = "stl-20-2000";
    // DatasetName = "Country_from_siemens";

    set_up(DatasetName);
    load_data();
});