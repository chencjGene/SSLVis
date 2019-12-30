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
    let layout_height = height - 40;
    let img_offset_x = 20;
    let img_offset_y = 10;
    let img_padding = 10;
    let grid_size = 50;
    let grid_offset = 10;
    let state = null;
    let img_width = layout_width-img_padding * 2;
    let img_height = layout_height-img_padding*2;
    let x_grid_num = parseInt((layout_width-5)/(grid_offset+grid_size));
    console.log("GraphLayout", "layout width", layout_width, "layout height", layout_height);

    let img_url = null;
    let img_grid_urls = [];

    let data_manager = null;

    let svg = that.container.append("svg").attr("id", "info");
    let img_grids = svg.append("g").attr("id", "grid-group");
    let img_group = svg.append("g").attr("id", "info-image");
    let img_grids_g = null;

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
        // console.log("graph component update");
        that._update_data(state);
        that._update_view();
    };

    that._update_data = function(state){
        // console.log("image layout data:", state);
        img_url = state.img_url===undefined? img_url:state.img_url;
        if(state.img_grid_urls !== undefined){
            while (img_grid_urls.length>0) img_grid_urls.pop();
            for(let url of state.img_grid_urls){
                img_grid_urls.push(url)
            }
        }
    };

    that._update_view = function(){
        that._create();
        that._update();
        that._remove();
    };

    that._create = function(){
        img_grids_g =  img_grids.selectAll(".grid-image")
            .data(img_grid_urls);
        let enters = img_grids_g.enter()
            .append("g")
            .attr("class", "grid-image");

        enters.append("rect")
            .attr("x", (d, i) => img_padding+(i%x_grid_num)*(grid_size+grid_offset)-2)
            .attr("y", (d, i) => img_padding+Math.floor(i/x_grid_num)*(grid_size+grid_offset)-2)
            .attr("width", grid_size+4)
            .attr("height", grid_size+4)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("stroke-width", 4)
            .attr("stroke", "gray")
            .attr("fill-opacity", 0);

        enters.append("image")
            .attr("xlink:href", d => d)
            .attr("x", (d, i) => img_padding+(i%x_grid_num)*(grid_size+grid_offset))
            .attr("y", (d, i) => img_padding+Math.floor(i/x_grid_num)*(grid_size+grid_offset))
            .attr("width", grid_size)
            .attr("height", grid_size)
            .on("mouseover", function (d) {
                img_url = d;
                that._update_view();
            });

        img_group.selectAll("image")
            .data([img_url])
            .enter()
            .append("image")
            .attr("xlink:href", d => d)
            .attr("x", img_padding)
            .attr("y", img_padding+Math.floor((img_grid_urls.length-1)/x_grid_num+1)*(grid_size+grid_offset))
            .attr("width", 0)
            .attr("height", 0);

    };

    that._update = function(){
        layout_width = parseFloat(svg.attr("width")) - 20;
        img_width = layout_width-img_padding * 2;
        let img_size = img_width>img_height?img_height:img_width;
        svg.attr("height", img_padding*2+Math.floor((img_grid_urls.length-1)/x_grid_num+1)*(grid_size+grid_offset)+img_size);
        img_group.selectAll("image")
            .attr("xlink:href", d => d)
            .attr("x", img_padding)
            .attr("y", img_padding+Math.floor((img_grid_urls.length-1)/x_grid_num+1)*(grid_size+grid_offset))
            .attr("width", img_size)
            .attr("height", img_size);
        img_grids_g.select("image")
            .attr("xlink:href", d => d)
            .attr("x", (d, i) => img_padding+(i%x_grid_num)*(grid_size+grid_offset))
            .attr("y", (d, i) => img_padding+Math.floor(i/x_grid_num)*(grid_size+grid_offset))
            .attr("width", grid_size)
            .attr("height", grid_size);
    };

    that._remove = function(){
        img_group.selectAll("image")
            .exit()
            .remove();
        img_grids_g
            .exit()
            .remove();
    };

    that.init = function(){
        that._init();
    }.call();

};
