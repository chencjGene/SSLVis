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
    let iter = 0;
    let img_padding = 10;
    let grid_size = 50;
    let grid_offset = 10;
    let detail_pos = -1;
    let state = null;
    let img_width = layout_width-img_padding * 2;
    let img_height = layout_height-img_padding*2;
    let AnimationDuration = 500;
    let longAnimationDuration = 500;
    let shortAnimationDuration = 10;
    let x_grid_num = parseInt((layout_width-5)/(grid_offset+grid_size));
    let color_unlabel = "#A9A9A9";
    let color_label = d3.schemeCategory10;
    color_label[7] = "#ffdb45";
    console.log("Image view", "layout width", layout_width, "layout height", layout_height);

    let img_url = null;
    let img_grid_urls = [];

    let data_manager = null;

    let svg = that.container.select("#info");
    let detail_group = svg.select("#detail-group");
    let img_grids = svg.append("g").attr("id", "grid-group");
    let img_grids_g = null;

    that._init = function(){
        svg.select(function(){return this.parentNode}).style("height", (height-10)+"px");
        svg.attr("width", layout_width)
            .attr("height", layout_height);
    };

    that.set_data_manager = function(_data_manager){
        data_manager = _data_manager;
    };

    that.component_update = function(state){
        // console.log("graph component update");
        that._update_data(state);
        if(img_url !== undefined && img_url !== null){
            detail_pos = -1;
            AnimationDuration = shortAnimationDuration;
            that._show_detail(img_url, img_grid_urls.length);
        }
        else {
            that._show_detail(null, -1);
        }
        that._update_view();
    };

    that._update_data = function(state){
        // console.log("image layout data:", state);
        if(state.img_grid_urls.length === 1){
            img_url = state.img_grid_urls[0];
            while (img_grid_urls.length>0) img_grid_urls.pop();
        }
        else{
            img_url = null;
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

    that._show_detail = function (d, i) {
        if(i===-1){
            detail_pos = -1;
            detail_group.style("opacity", 0);
            return;
        }
                img_url = d;
                console.log("show detail:", img_url);
                layout_width = parseFloat(svg.attr("width"));
                let img_width = x_grid_num*(grid_size+grid_offset)-grid_offset-img_padding*2;
                let img_size = img_width>img_height?img_height:img_width;
                let x_padding = (layout_width-img_size)/2;
                if (detail_pos === -1) {
                    detail_pos = i;
                    detail_group.transition()
                        .duration(AnimationDuration)
                        .style("opacity", 1);
                    detail_group.select("image")
                        .attr("xlink:href", img_url.url)
                        .attr("x", img_padding)
                        .attr("y", img_padding+(Math.floor(i/x_grid_num)+1)*(grid_size+grid_offset))
                        .attr("width", 0)
                        .attr("height", 0)
                        .transition()
                        .duration(AnimationDuration)
                        .attr("x", x_padding)
                        .attr("y", img_padding+(Math.floor(i/x_grid_num)+1)*(grid_size+grid_offset))
                        .attr("width", img_size)
                        .attr("height", img_size);
                    that._update_view();
                } else if (detail_pos === i) {
                    detail_pos = -1;
                    detail_group.transition()
                        .duration(AnimationDuration)
                        .style("opacity", 0);
                    detail_group.select("image")
                        .transition()
                        .duration(AnimationDuration)
                        .attr("x", x_padding)
                        .attr("y", img_padding+(Math.floor(i/x_grid_num)+1)*(grid_size+grid_offset))
                        .attr("width", 0)
                        .attr("height", 0);
                    that._update_view();
                } else {
                    detail_pos = i;
                    detail_group.transition()
                        .duration(AnimationDuration)
                        .style("opacity", 1);
                    detail_group.select("image")
                        .attr("xlink:href", img_url.url)
                        .transition()
                        .duration(AnimationDuration)
                        .attr("x", x_padding)
                        .attr("y", img_padding+(Math.floor(i/x_grid_num)+1)*(grid_size+grid_offset))
                        .attr("width", 0)
                        .attr("height", 0)
                        .on("end", function () {
                            let image = d3.select(this);
                            image.remove();
                        });
                    detail_group.append("image")
                        .attr("xlink:href", img_url.url)
                        .attr("x", img_padding)
                        .attr("y", img_padding+(Math.floor(i/x_grid_num)+1)*(grid_size+grid_offset))
                        .attr("width", 0)
                        .attr("height", 0)
                        .transition()
                        .duration(AnimationDuration)
                        .attr("x", x_padding)
                        .attr("y", img_padding+(Math.floor(i/x_grid_num)+1)*(grid_size+grid_offset))
                        .attr("width", img_size)
                        .attr("height", img_size);
                    that._update_view();
                }
            };

    that._create = function(){
        AnimationDuration = longAnimationDuration;
        img_grids_g =  img_grids.selectAll(".grid-image")
            .data(img_grid_urls);
        let enters = img_grids_g.enter()
            .append("g")
            .attr("class", "grid-image")
            .attr("transform", "translate(0,0)");

        enters.append("rect")
            .attr("x", (d, i) => img_padding+(i%x_grid_num)*(grid_size+grid_offset)-2)
            .attr("y", (d, i) => img_padding+Math.floor(i/x_grid_num)*(grid_size+grid_offset)-2)
            .attr("width", grid_size+4)
            .attr("height", grid_size+4)
            .attr("stroke-width", 4)
            .attr("stroke", function (d) {
                return color_unlabel;
                // TODO get label from back-end
                let node = d.node.datum();
                if(node.label[iter] === -1) return color_unlabel;
                    else return color_label[node.label[iter]];
            })
            .attr("fill-opacity", 0);

        enters.append("image")
            .attr("xlink:href", d => d.url)
            .attr("x", (d, i) => img_padding+(i%x_grid_num)*(grid_size+grid_offset))
            .attr("y", (d, i) => img_padding+Math.floor(i/x_grid_num)*(grid_size+grid_offset))
            .attr("width", grid_size)
            .attr("height", grid_size)
            .on("click", function (d, i) {
                that._show_detail(d, i);
                // return color_unlabel;
                // // TODO get label from back-end
                // let node = d.node.datum();
                // if(node.label[iter] === -1) return color_unlabel;
                //     else return color_label[node.label[iter]];
            });


    };

    that._update = function() {
        layout_width = parseFloat(svg.attr("width")) - 20;
        img_width = layout_width-img_padding * 2;
        let img_size = img_width>img_height?img_height:img_width;
        svg.attr("height", img_padding*2+Math.floor((img_grid_urls.length-1)/x_grid_num+1)*(grid_size+grid_offset)+img_size);
        img_grids_g.select("image")
            .attr("xlink:href", d => d.url);

        // img_grids_g.select("rect")
        //     .attr("stroke", function (d) {
        //
        //         });

        img_grids_g
            .transition()
            .duration(AnimationDuration)
            .attr("transform", (d, i) => "translate(" + 0 + ", " +
                ((detail_pos !== -1 && Math.floor(i / x_grid_num) >  Math.floor(detail_pos / x_grid_num)) * (img_padding*3+img_size)) + ")");

    };

    that._remove = function(){
        img_grids_g
            .exit()
            .remove();
    };

    that.setIter = function(newiter){
        iter = newiter;
        that._update_view();
    };

    that.init = function(){
        that._init();
    }.call();

};
