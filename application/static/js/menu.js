/*
* added by Changjian Chen, 20200209
* */

let MenuLayout = function(){
    let that = this;

    let label_names = ["test1", "test2"];

    let click_menu_settings = {
        'mouseClick': 'right',
        'triggerOn': 'click'
    };

    that.data_manager = null;

    
    that.set_data_manager = function(new_data_manager) {
        that.data_manager = new_data_manager;
    };

    that._init = function(){
        that.update_click_menu($('#main_group'), 1);
    };

    // that.component_update = function(state){
    //     console.log("get menu state:", state);
    //     that._update_data(state);
    //     that._update_view();
    // };

    that.update_click_menu = function(container, d){
        d3.selectAll(".iw-curMenu").remove();
        let menu = [];
        label_names.forEach(function(d, i){
            let sm = {
                    title:d,
                    name:d,
                    color: "black",
                    className: "iw-mnotSelected label-menu-item",
                    fun:function(){
                        console.log("click menu");
                    }
                };
                menu.push(sm);
            });
        menu.push({
            title: 'Delete',
            name: 'Delete',
            color: '',
            className: "iw-mnotSelected delete-menu-item",
            fun: function () {
                console.log("delete");
            }
        });

        click_node_menu = menu;
        if (menu.length > 0) {
            container.contextMenu(click_node_menu, click_menu_settings);
        }

        menu = [];
        menu.push({
            title: 'Delete',
            name: 'Delete',
            color: '',
            className: "iw-mnotSelected delete-menu-item",
            fun: function () {
                d3.select(focus_edge_node).style("display", "none");
                that._apply_delete_and_update_label();
                that._update_wait_list_group();
                focus_node_change_switch = true;
                focus_edge_change_switch = true;
            }
        });
        click_edge_menu = menu;
        if (menu.length > 0) {
            $('#graph-view-link-g').contextMenu(click_edge_menu, click_menu_settings);
        }

    };

    that.reset_menu = function(){

    };

    that.show_changed_data = function(){

    };

    that.init = function () {
        that._init();
    }.call();
}