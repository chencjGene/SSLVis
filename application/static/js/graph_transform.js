let GraphTransform = function (parent) {
    let that = this;

    // parent
    let view = null;

    // transform const
    let zoom_scale = 1;
    let transform = null;
    let zoom = null;
    let current_level = 0;
    let send_zoom_cnt = 0;
    let send_zoom_request = [];


    that._init = function () {
        that.set_view(parent);
    };

    that.set_view = function (new_parent) {
        view = new_parent;
    };

    that.apply_transform = function(transform){
        view.main_group.attr("transform", transform);
    };

    that.zoomed = function() {
        that.apply_transform(d3.event.transform);
        view.maintain_size(d3.event.transform);
        let target_level = current_level;
        let current_level_scale = Math.pow(2, target_level);
        while (d3.event.transform.k > 2 * current_level_scale) {
            current_level_scale *= 2;
            target_level += 1;
        }
        while (d3.event.transform.k < current_level_scale / 1.5 && target_level > 0) {
            current_level_scale /= 2;
            target_level -= 1;
        }
        current_level = target_level;
        // console.log(d3.event.transform);
        // if (transform === null) {
        //     transform = d3.event.transform;
        // }
        d3.selectAll(".iw-contextMenu").style("display", "none");
    };

    that.zoom_end = function() {
        that.apply_transform(d3.event.transform);
        view.maintain_size(d3.event.transform);
        let target_level = current_level;
        let current_level_scale = Math.pow(2, target_level);
        while (d3.event.transform.k > 2 * current_level_scale) {
            current_level_scale *= 2;
            target_level += 1;
        }
        while (d3.event.transform.k < current_level_scale / 1.5 && target_level > 0) {
            current_level_scale /= 2;
            target_level -= 1;
        }
        current_level = target_level;

        if (transform === null || d3.event.transform.k !== transform.k
            || Math.abs(d3.event.transform.x - transform.x) > 1
            || Math.abs(d3.event.transform.y - transform.y) > 1) {
            view.width = $('#graph-view-svg').width();
            view.height = $('#graph-view-svg').height();
            // main_group.select('#debug-shouxing')
            //     .attr('x', -d3.event.transform.x / d3.event.transform.k)
            //     .attr('y', -d3.event.transform.y / d3.event.transform.k)
            //     .attr('width', width / d3.event.transform.k)
            //     .attr('height', height / d3.event.transform.k);
            let start_x = view.center_scale_x_reverse(-d3.event.transform.x / d3.event.transform.k);
            let start_y = view.center_scale_y_reverse(-d3.event.transform.y / d3.event.transform.k);
            let end_x = view.center_scale_x_reverse((view.width - d3.event.transform.x) / d3.event.transform.k);
            let end_y = view.center_scale_y_reverse((view.height - d3.event.transform.y) / d3.event.transform.k);

            let area = {
                'x': start_x,
                'y': start_y,
                'width': end_x - start_x,
                'height': end_y - start_y
            };
            console.log(d3.event.transform, area, current_level);
            let send_zoom_idx = send_zoom_cnt++;
            send_zoom_request[send_zoom_idx] = true;

            setTimeout(function () {
                    if(send_zoom_request[send_zoom_idx+1] === undefined){
                        console.log(send_zoom_idx);
                        console.log("recv:", area, target_level);
                        // transform = d3.event.transform;
                        view.data_manager.zoom_graph_view_notify(area, target_level);
                    }
                }, 1000);

        }
        // else {
            transform = d3.event.transform;
        // }

    };

    that.init_zoom = function () {
        zoom = d3.zoom()
            .scaleExtent([0.6, 128])
            .on('start', function () {
                // d3.selectAll(".iw-contextMenu").style("display", "none");
                // focus_node_change_switch = true;
                // focus_edge_change_switch = true;
            })
            .on("zoom", that.zoomed)
            .on("end", that.zoom_end);
        view.svg.call(zoom);
    };

    that.update_zoom_scale = function (new_zoom_scale){
        zoom_scale = new_zoom_scale;
        view.update_zoom_scale(zoom_scale);
    };

    that.init = function () {
        that._init();
    }.call();
};