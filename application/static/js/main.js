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
    EditView = new EditLayout();
    SettingView = new SettingLayout();
    LossView.controlInstanceView = GraphView;
    LossView.controlInfoView = ImageView;
    DataLoader.set_view(GraphView, "graph");
    DataLoader.set_view(LossView, "dist");
    DataLoader.set_view(ImageView, "image");
    DataLoader.set_view(HistoryView, "history");
    DataLoader.set_view(FilterView, "filter");
    DataLoader.set_view(EditView, "edit");
    DataLoader.set_view(SettingView, "setting")
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
    SettingView.choose("stl-50-20000");
    // SettingView.choose("stl-20-2000");

    
});