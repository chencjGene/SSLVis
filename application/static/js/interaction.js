/*
* added by Changjian Chen, 20200107
* */

function update_k(){
    let k = $("#global-k").slider("getValue");
    DataLoader.update_k(k);
}

function local_update_k(){

    DataLoader.local_update_k();
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

function reset_spinner(){
    $('#load-button').html("Load")
        .attr("disabled", false);
    $('#update-button').html("Update")
    .attr("disabled", false);
}

function add_new_categories(name, idxs){
    DataLoader.add_new_categories(name, idxs);
}