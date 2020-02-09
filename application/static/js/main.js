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
    LossView = new DistLayout(d3.select("#dist-view"));
    ImageView = new ImageLayout(d3.select("#image-row"));
    HistoryView = new HistoryLayout(d3.select("#history-row"));
    FilterView = new FilterLayout(d3.select(".current-scented-widget-container"));
    MenuView = new MenuLayout();
    LossView.controlInstanceView = GraphView;
    LossView.controlInfoView = ImageView;
    DataLoader.set_view(GraphView, "graph");
    DataLoader.set_view(LossView, "dist");
    DataLoader.set_view(ImageView, "image");
    DataLoader.set_view(HistoryView, "history");
    DataLoader.set_view(FilterView, "filter");
    DataLoader.set_view(MenuView, "menu");
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