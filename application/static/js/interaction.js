/*
* added by Changjian Chen, 20200107
* */

function update_k(k){
    DataLoader.update_k(k);
}

function local_update_k(selected_idxs){
    // TODO: for DEBUG
    selected_idxs = [1,2,3];
    DataLader.local_update_k(selected_idxs);
}

function update_filter_threshold(threshold){
    DataLoader.update_filter_threshold(threshold);
}

function change_dist_mode(){
    console.log("change_dist_mode test");
    DataLoader.change_dist_mode();
    if (DataLoader.state.dist_mode){
        d3.select("#switch-label").text("Display all");
    }
    else{
        d3.select("#switch-label").text("Display changes only");
    }
}