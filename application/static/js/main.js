/*
* added by Changjian Chen, 20191015
* */

function load_data() {
    console.log("loading data...");

    DataLoader.init_notify();
}

function set_up() {
    DataLoader = new DataLoaderClass();
    GraphView = new GraphLayout(d3.select("#my-graph-all"));
    LossView = new DistLayout(d3.select("#dist-view"));
    ImageView = new ImageLayout(d3.select("#image-row"));
    HistoryView = new HistoryLayout(d3.select("#history-row"));
    FilterView = new FilterLayout(d3.select(".current-scented-widget-container"));
    LossView.controlInstanceView = GraphView;
    LossView.controlInfoView = ImageView;
    DataLoader.set_graph_view(GraphView);
    DataLoader.set_dist_view(LossView);
    DataLoader.set_image_view(ImageView);
    DataLoader.set_history_view(HistoryView);
    DataLoader.set_filter_view(FilterView);
}

function clean_dom() {
    
}

// called by SettingView
function choose(dataset){
    DatasetName = dataset;
    DataLoader.set_dataset(dataset);
    load_data();
}


// main (entry of the application)
$(document).ready(function () {
    set_up();
    SettingView = new SettingLayout();
    // SettingView.choose("stl-20-2000");
});