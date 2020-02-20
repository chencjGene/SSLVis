/*
* added by Changjian Chen, 20200209
* */

let EditLayout = function(){
    let that = this;

    let label_names = null;
    let name_2_label_map = null;
    let label_colors = CategoryColor;
    let focus_data = null;
    let edit_mode = null; // TODO: unclear
    let edit_state = {
            deleted_idxs: [],
            labeled_idxs: [],
            labels: [],
            deleted_edges: []
        };



    let click_menu_settings = {
        'mouseClick': 'right',
        'triggerOn': 'click'
    };

    that.data_manager = null;

    
    that.set_data_manager = function(new_data_manager) {
        that.data_manager = new_data_manager;
    };

    that._init = function(){

    };

    that.update_info = function(state){
        console.log("get menu state:", state);
        label_names = state.label_names;
        name_2_label_map = {};
        for (let i = 0; i < label_names.length; i++){
            name_2_label_map[label_names[i]] = i;
        }
        
        that.clean_click_menu();
        that.update_click_menu($('#main_group'), 1);
        that.update_click_menu($('#grid-group'), 1);
    };

    that.clean_click_menu = function(){
        d3.selectAll(".iw-curMenu").remove();
    }

    that.update_click_menu = function(container, d){
        let menu = [];
        label_names.forEach(function(d, i){
            let sm = {
                    title:d,
                    name:d,
                    color: label_colors[i],
                    className: "iw-mnotSelected label-menu-item",
                    fun:function(){
                        console.log("click menu", d);
                        let label = name_2_label_map[d];
                        that.editing(label);
                    }
                };
                menu.push(sm);
            });
        menu.push({
            title: 'Add',
            name: '\u2295',
            color: '',
            className: "iw-mnotSelected add-menu-item",
            fun: function () {
                console.log("add", d);
                // let label = -1;
                // that.editing(label);
            }
        });

        click_node_menu = menu;
        if (menu.length > 0) {
            container.contextMenu(click_node_menu, click_menu_settings);
        }

        // edge 
        menu = [];
        menu.push({
            title: 'Add',
            name: 'Add',
            color: '',
            className: "iw-mnotSelected add-menu-item",
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

    that.update_focus = function(data, mode){
        focus_data = data;
        focus_mode = mode;
    }

    that.editing = function(label){
        console.log("editing", {label, focus_data, focus_mode});
        if (focus_mode === "instance"){
            if (label === -1){
                if (Array.isArray(focus_data)){
                    edit_state.deleted_idxs = 
                        edit_state.deleted_idxs.concat(focus_data);
                }
                else{ 
                    edit_state.deleted_idxs.push(focus_data);
                }
                console.log("deleted data", label, focus_data, focus_mode);
            }
            else{
                edit_state.labeled_idxs.push(focus_data);
                edit_state.labels.push(focus_data);
            }
        }
        else if (focus_mode === "delete edge"){

        }
        else if (focus_mode === "add edge"){

        }
        else {

        }
        that.data_manager.update_delete_and_change_label(edit_state);
    };


    that.init = function () {
        that._init();
    }.call();
}