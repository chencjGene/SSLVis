/*
* added by Changjian Chen, 20191015
* */

let ImageLayout = function (container){
    let that = this;
    that.container = container;

    let bbox = that.container.node().getBoundingClientRect();
    let width = bbox.width;
    let height = bbox.height;
    let layout_width = width - 20;
    let layout_height = height - 20;
    let img_offset_x = 20;
    let img_offset_y = 10;
    let img_padding = 10;
    console.log("GraphLayout", "layout width", layout_width, "layout height", layout_height);

    let img_url = null;

    let data_manager = null;

    let svg = that.container.append("svg").attr("id", "info");
    let img_group = svg.append("g").attr("id", "info-image");

    that._init = function(){
        svg.attr("width", layout_width)
            .attr("height", layout_height);
        img_group.attr("transform",
            "translate(" + ( img_offset_x ) + "," + ( img_offset_y )+ ")");
    };

    that.set_data_manager = function(_data_manager){
        data_manager = _data_manager;
    };

    that.component_update = function(state){
        console.log("graph component update");
        that._update_data(state);
        that._update_view();
    };

    that._update_data = function(state){
        // console.log("image layout data:", state);
        img_url = state.img_url;
    };

    that._update_view = function(){
        that._create();
        that._update();
        that._remove();
    };

    that._create = function(){
        console.log("create image:", img_url);
        img_group.selectAll("image")
            .data([img_url])
            .enter()
            .append("image")
            .attr("xlink:href", d => d)
            .attr("x", img_padding)
            .attr("y", img_padding)
            .attr("width", 0)
            .attr("height", 0);
    };

    that._update = function(){
        img_group.selectAll("image")
            .attr("xlink:href", d => d)
            .attr("width", layout_width - img_padding * 2)
            .attr("height", layout_height - img_padding * 2);
    };

    that._remove = function(){
        img_group.selectAll("image")
            .exit()
            .remove();
    };

    that.init = function(){
        that._init();
    }.call();

};
