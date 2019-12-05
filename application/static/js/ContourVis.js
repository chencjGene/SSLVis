var VIS = VIS || {};
VIS.CHART = VIS.CHART || {};
VIS.CHART.WIDGET = VIS.CHART.WIDGET || {};
VIS.CHART.WIDGET.contourVisWidget = function (options) {

    //if (!options) throw 'options can not be null';
    //else if (options && !options.element) throw 'options.element can not be null';
    //var math_Utils= mathUtils();
    var defaultVal = {
        margin: { top: 40, right: 40, bottom: 40, left: 80 },
        kernelSize:40,
        contourCount:4,
        valueCut:0.1,
        // contourRatios: Array.from(Array(8)).map(function (d, i) {
        //         // if (i < 9) {
        //         //     return (i + 1) * 0.001 + 0.001;
        //         // }
        //         // if (i < 18) {
        //         //     return (i - 8) * 0.01;
        //         // }
        //         return (i + 1) * 0.1;
        //     }),
        contourRatios: [0.05, 0.2, 0.4, 0.6, 0.8],
        clickMenu:[{
            name:'zoom',
            title:'zoom',
            subMenu:[]
        },{
            name:'filter',
            title:'filter',
            subMenu:[]
        },{
            name:'label',
            title:'label',
            subMenu:[]
        }],
        events:{},
        clickMenuSettings:{'mouseClick':'right','triggerOn':'click'}
    };

    function ContourVis(options) {
        var self = this;
        self.element = options.element;
        self.data = options.data;
        self.state_data = {};
        self.label_names = options.label_names;
        self.max_level = options.max_level;
        self.state_stack = ['0'];
        self.state_index = 0;
        self.level = 0;
        self.settings = $.extend({}, defaultVal, options);
        // self.contour_class_id = 0;
        // self.hover_contour_class_id = -1;
        self.focus_dot_id = -1;
        self.focus_sampling_method_index = 0;
        self.focus_model_score_selection_mode_index = 0;
        self.focus_label_item_index = [];
        self.methods = ["random", "blue noise",
            "blue noise(label error)", "density based",
            "density based(label error)"];
        self.lasso_result = [];
        self.highlight_item = [];
        self.lasso_tree_size = 0;
        self.highlight_index = [];
        self.zoom_scale = 1.0;
        self.index2id = [];
        self.id2index = {};
        self.model_score_line = 1;
        self.thresholds_scale = 1;
        self.images = [];
        self.image_datas = [];
        self.label_filter_flag = [];
    }

    ContourVis.prototype = {
        init: function () {
            this._init_chart();
           // this._generate_chart();
        },
        redraw:function(data, label_names, max_level, model_score_line){
            var self = this;
            if(data && label_names){
                self.model_score_line = model_score_line;
                self.thresholds_scale = 1;
                self.data = data;
                self.state_data = {};
                self.state_stack = ['0'];
                self.state_index = 0;
                self.level = 0;
                self.focus_dot_id = -1;
                self.lasso_result = [];
                self._update_item_recomendation_param();
                self.images = [];
                self.image_datas = [];
                self._update_show_mode_switch();
                self.highlight_item = [];
                self.lasso_tree_size = 0;
                self.highlight_index = [];
                self.zoom_scale = 1.0;
                self.max_level = max_level;
                self.label_names = label_names;
                self.settings.data = data;
                self.index2id = [];
                self.id2index = {};
                for (var i = 0;i < self.data.length;i++){
                    self.index2id.push(self.data[i].id);
                    self.id2index['' + self.data[i].id] = i;
                }
                // console.log(self.index2id);

                self.state_data['0'] = {
                    'model_score_line': self.model_score_line,
                    'data':data,
                    'id_to_index': self.id2index,
                    "thresholds_scale": self.thresholds_scale
                };
                self._generate_chart(true);
                self._draw_state_stack();
                self._draw_images("clear");
            }
        },
        svg_id: function () {
            return 'plotView';
        },
        data_count: function () {
            if (this.data) {
                return this.data.length;
            }
            return 0;
        },
        export_lasso: function () {
            var self = this;
            if (self.lasso_result) {
                return self.lasso_result;
            }
            return [];
        },
        update_highlight_index: function (index) {
            if (this.data) {
                for (var i in this.highlight_index) {
                    d3.select('#dot-' + this.highlight_index[i])
                    // d3.selectAll('.dot')
                    //     .style('stroke', 'white')
                        // .style('fill', color_manager.get_color(this.data[i]['label']))
                        .style('opacity', 0.5);
                }
                this.highlight_index = index;
                for (var i in this.highlight_index) {
                    d3.select('#dot-' + index[i])//.style('stroke', '#000000')
                        // .style('fill', color_manager.get_color(9))
                        .stylt('opacity', 1);
                }
            }
            return 0;
        },
        resize:function(){
            var self = this;
            self.chart_width = (WINDOW_WIDTH - 180) * 0.67 - 15;
            self.chart_height = WINDOW_HEIGHT;
            self.contour_width = self.chart_width - self.settings.margin.left - self.settings.margin.right;
            self.contour_height = self.chart_height - self.settings.margin.top - self.settings.margin.bottom;
            self.chart.attr('width', self.chart_width)
                        .attr('height', self.chart_height);
            self._generate_chart(true);
        },
        _init_chart: function(){
            var self = this;
            self.chart_width = (WINDOW_WIDTH - 180) * 0.67 - 15;
            self.chart_height = WINDOW_HEIGHT;
            self.contour_width = self.chart_width - self.settings.margin.left - self.settings.margin.right;
            self.contour_height = self.chart_height - self.settings.margin.top - self.settings.margin.bottom;
            // self.contour_height = ($(self.element._groups[0][0]).height()||WINDOW_HEIGHT - 300) - self.settings.margin.top - self.settings.margin.bottom;
            // self.contour_width = ($(self.element._groups[0][0]).width()||WINDOW_WIDTH * 0.56 - 300) - self.settings.margin.left - self.settings.margin.right;
            self.chart = self.element
                            .append('svg')
                            .attr('cursor', "pointer")
                            .attr('id','plotView')
                            .attr('width', self.chart_width)
                            .attr('height', self.chart_height);
            self.mouse_pos = [0, 0];
            self.sampling_param_rect_drag = false;
            self.model_score_selection_param_rect_drag = false;
            self.label_param_rect_drag = false;
            self.sampling_param_button_drag = false;
            self.sampling_value_bar_initial_x = 0;
            self.sampling_value_bar_pre_x = 0;
            self.sampling_value_bar_x_range = [0, 0];
            self.sampling_param_group_initial_pos = [0, 0];
            self.sampling_param_group_pre_transform = [0, 0];
            self.model_score_selection_param_button_drag = false;
            self.dot_mouse_down = false;
            self.model_score_selection_button_drag = false;
            self.model_score_selection_value_bar_initial_x = 0;
            self.model_score_selection_value_bar_pre_x = 0;
            self.model_score_selection_value_bar_x_range = [0, 0];
            self.model_score_selection_param_group_initial_pos = [0, 0];
            self.model_score_selection_param_group_pre_transform = [0, 0];
            self.label_param_group_initial_pos = [0, 0];
            self.label_param_group_pre_transform = [0, 0];
            self.bbox = d3.select('#ListComponent').node().getBoundingClientRect();
            document.onmousemove = function (e){
                var event = (e || window.event);
                self.mouse_pos[0] = event.clientX - self.bbox.left;
                self.mouse_pos[1] = event.clientY - self.bbox.top;
                if (self.sampling_param_rect_drag) {
                    self.sampling_param_group_pre_transform[0] = self.mouse_pos[0]
                            - self.sampling_param_group_initial_pos[0];
                    self.sampling_param_group_pre_transform[1] = self.mouse_pos[1]
                            - self.sampling_param_group_initial_pos[1];
                    self.sampling_param_group.attr('transform','translate(' + self.sampling_param_group_pre_transform[0]
                        + ',' + self.sampling_param_group_pre_transform[1] + ')');

                }
                if (self.model_score_selection_param_rect_drag) {
                    self.model_score_selection_param_group_pre_transform[0] = self.mouse_pos[0]
                            - self.model_score_selection_param_group_initial_pos[0];
                    self.model_score_selection_param_group_pre_transform[1] = self.mouse_pos[1]
                            - self.model_score_selection_param_group_initial_pos[1];
                    self.model_score_selection_param_group.attr('transform','translate(' + self.model_score_selection_param_group_pre_transform[0]
                        + ',' + self.model_score_selection_param_group_pre_transform[1] + ')');

                }
                if (self.label_param_rect_drag) {
                    self.label_param_group_pre_transform[0] = self.mouse_pos[0]
                            - self.label_param_group_initial_pos[0];
                    self.label_param_group_pre_transform[1] = self.mouse_pos[1]
                            - self.label_param_group_initial_pos[1];
                    self.label_param_group.attr('transform','translate(' + self.label_param_group_pre_transform[0]
                        + ',' + self.label_param_group_pre_transform[1] + ')');

                }
                if (self.sampling_param_button_drag) {
                    self.sampling_value_bar_pre_x = self.mouse_pos[0] - self.sampling_value_bar_initial_x;
                    if (self.sampling_value_bar_pre_x > self.sampling_value_bar_x_range[1] - 5) {
                        self.sampling_value_bar_pre_x = self.sampling_value_bar_x_range[1] - 5;
                    }
                    if (self.sampling_value_bar_pre_x < self.sampling_value_bar_x_range[0] - 5) {
                        self.sampling_value_bar_pre_x = self.sampling_value_bar_x_range[0] - 5;
                    }
                    self.sampling_param_group.select("#sampling_param_value_rect").attr("x", self.sampling_value_bar_pre_x);
                    var value = (self.sampling_value_bar_pre_x + 5 - self.sampling_value_bar_x_range[0])
                        / (self.sampling_value_bar_x_range[1] - self.sampling_value_bar_x_range[0]) * (self.lasso_tree_size - 2) + 1;
                    self.sampling_param_group.select("#sampling_param_value_text").attr("x", self.sampling_value_bar_pre_x + 5).text(Math.floor(value));
                }
                if (self.model_score_selection_param_button_drag) {
                    self.model_score_selection_value_bar_pre_x = self.mouse_pos[0] - self.model_score_selection_value_bar_initial_x;
                    if (self.model_score_selection_value_bar_pre_x > self.model_score_selection_value_bar_x_range[1] - 5) {
                        self.model_score_selection_value_bar_pre_x = self.model_score_selection_value_bar_x_range[1] - 5;
                    }
                    if (self.model_score_selection_value_bar_pre_x < self.model_score_selection_value_bar_x_range[0] - 5) {
                        self.model_score_selection_value_bar_pre_x = self.model_score_selection_value_bar_x_range[0] - 5;
                    }
                    self.model_score_selection_param_group.select("#model_score_selection_param_value_rect").attr("x", self.model_score_selection_value_bar_pre_x);
                    var value = (self.model_score_selection_value_bar_pre_x + 5 - self.model_score_selection_value_bar_x_range[0])
                        / (self.model_score_selection_value_bar_x_range[1] - self.model_score_selection_value_bar_x_range[0]) * ((self.model_score_values[1]["value"] - self.model_score_values[0]["value"])) + self.model_score_values[0]["value"];
                    self.model_score_selection_param_group.select("#model_score_selection_param_value_text").attr("x", self.model_score_selection_value_bar_pre_x + 5).text(value.toExponential(2));
                    self._update_lasso_result_by_model_score(value);
                }
                if (self.model_score_selection_button_drag) {
                    self.model_score_selection_value_bar_pre_x = self.mouse_pos[0] - self.model_score_selection_value_bar_initial_x;
                    if (self.model_score_selection_value_bar_pre_x > self.model_score_selection_value_bar_x_range[1] - 5) {
                        self.model_score_selection_value_bar_pre_x = self.model_score_selection_value_bar_x_range[1] - 5;
                    }
                    if (self.model_score_selection_value_bar_pre_x < self.model_score_selection_value_bar_x_range[0] - 5) {
                        self.model_score_selection_value_bar_pre_x = self.model_score_selection_value_bar_x_range[0] - 5;
                    }
                    self.chart.select("#model_score_selection_value_rect").attr("x", self.model_score_selection_value_bar_pre_x);
                    var value = (self.model_score_selection_value_bar_pre_x + 5 - self.model_score_selection_value_bar_x_range[0])
                        / (self.model_score_selection_value_bar_x_range[1] - self.model_score_selection_value_bar_x_range[0]) * ((self.model_score_values[1]["value"] - self.model_score_values[0]["value"])) + self.model_score_values[0]["value"];
                    self.chart.select("#model_score_selection_value_text").attr("x", self.model_score_selection_value_bar_pre_x + 5).text(value.toExponential(2));
                    self._update_lasso_result_by_model_score(value);
                }

            };
            document.onmouseup = function (e){
                self.sampling_param_rect_drag = false;
                self.label_param_group_pre_transform = [0, 0];
                self.sampling_param_button_drag = false;
                self.model_score_selection_param_rect_drag = false;
                self.model_score_selection_param_button_drag = false;
                if (self.model_score_selection_button_drag) {
                    self.model_score_selection_button_drag = false;
                    self._enableLasso();
                }
                if (self.dot_mouse_down) {
                    self.dot_mouse_down = false;
                    self._enableLasso();
                }

                self.label_param_rect_drag = false;
                self.label_param_group_pre_transform = [0, 0];
            };





            self.main_group = self.chart.append('g').attr('class','main_group');

            self.container = self.main_group.append('g').attr('class','container');
            self.contour_map = self.container.append('g').attr('class','contourMap')
                .attr('transform','translate(' + self.settings.margin.left + ',' + self.settings.margin.top + ')');
            self.contour_map_density = self.contour_map.append('g').attr('class','contourMapDensity')
                .attr('transform','translate(' + self.settings.margin.left + ',' + self.settings.margin.top + ')');
            self.contour_map_dot = self.contour_map.append('g').attr('class','contourMapDot')
                .attr('transform','translate(' + self.settings.margin.left + ',' + self.settings.margin.top + ')');
            self.contour_map_dot.append("rect")
                .attr('id', "background_rect")
                .attr('x', 100 - self.settings.margin.left)
                .attr('y', - self.settings.margin.top)
                .attr('width', self.chart_width - 100)
                .attr('height', self.chart_height)
                .style("opacity", 0);
            self.contour_map_selected = self.contour_map.append('g').attr('class','contourMapSelected')
                .attr('transform','translate(' + self.settings.margin.left + ',' + self.settings.margin.top + ')');
            self.contour_map1_highlight = self.contour_map.append('g').attr('class','contourMapHighlight')
                .attr('transform','translate(' + self.settings.margin.left + ',' + self.settings.margin.top + ')');
            self.contour_map_image = self.contour_map.append('g').attr('class','contourMapImage')
                .attr('transform','translate(' + self.settings.margin.left + ',' + self.settings.margin.top + ')');

            self.legend_map = self.chart.append('g').attr('class','legendMap');
            self.legend_rect_group = self.legend_map.append('g').attr('class', 'legend_rect_group')
            self.legend_hide = false;
            var colors = [];
            for (var i = 0;i < self.settings.contourRatios.length;i++) {
                colors[i] = color_manager.get_contour_map_color(i);
            }
            self.color_map = d3.scaleThreshold()
                    .range(colors);
            self._generate_chart(true);
        },
        _changeItemLabels:function(value){
            var self = this;
            self.lasso_result.forEach(function(dot_id){
                self.chart.select('#dot-'+dot_id).each(function(dotData){
                    dotData.label = value;
                    dotData.label_name = self.label_names[value];
                    d3.select(this).style('fill',color_manager.get_color(value));
                });
                for (var i = 0;i < self.state_stack.length;i++) {
                    var index = self.state_data[self.state_stack[i]]['id_to_index'][dot_id];
                    if (index != undefined) {
                        self.state_data[self.state_stack[i]]['data'][index]['label'] = value;
                        self.state_data[self.state_stack[i]]['data'][index]['label_name'] = self.label_names[value];
                    }
                }
                self.data[self.id2index[dot_id]]['label'] = value;
                self.data[self.id2index[dot_id]]['label_name'] = self.label_names[value];
            });
            list_component.change_item_labels(self.lasso_result, {
                "label": value,
                "label_name": self.label_names[value]
            });
            image_component.change_item_labels(self.lasso_result, {
                "label": value,
                "label_name": self.label_names[value]
            });
            var label = [];
            for (var i = 0;i < self.lasso_result.length;i++) {
                label[i] = value;
            }
            var formData = new FormData();
            formData.append("filename", JSON.stringify(processed_result[dataset_selector[0].selectedIndex]['filename']));
            formData.append("ids", JSON.stringify(self.lasso_result));
            formData.append("label", JSON.stringify(label));
            formData.append("label_names", JSON.stringify(self.label_names));

            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/change_label', true);
            xhr.onload = function (e) {
                if (xhr.status === 200) {

                } else {
                    alert('An error occurred!');
                }
            };
            xhr.send(formData);
        },
        change_item_labels:function(ids, target_label){
            var self = this;
            if (target_label["label"] >= self.label_names.length) {
                self.label_names.push(target_label["label_name"]);
            }

            for (var i = 0;i < ids.length;i++) {
                var index = self.id2index[ids[i]];
                if (index == undefined) {
                    continue;
                }
                self.chart.select('#dot-'+ids[i]).each(function(dotData){
                    dotData.label = target_label["label"];
                    dotData.label_name = target_label["label_name"];
                    d3.select(this).style('fill',color_manager.get_color(target_label["label"]));
                });
                self.chart.select('#selected-dot-'+ids[i]).each(function(dotData){
                    dotData.label = target_label["label"];
                    dotData.label_name = target_label["label_name"];
                    d3.select(this).style('fill',color_manager.get_color(target_label["label"]));
                });
                for (var j = 0;j < self.state_stack.length;j++) {
                    var index = self.state_data[self.state_stack[j]]['id_to_index'][ids[i]];
                    if (index != undefined) {
                        self.state_data[self.state_stack[j]]['data'][index]['label'] = target_label["label"];
                        self.state_data[self.state_stack[j]]['data'][index]['label_name'] = target_label["label_name"];
                    }
                }
                self.data[self.id2index[ids[i]]]['label'] = target_label["label"];
                self.data[self.id2index[ids[i]]]['label_name'] = target_label["label_name"];
            }
            self._drawLegend();
            self._updateClickMenu();
        },
        _change_all_item_labels:function(labels){
            var self = this;
            var max_label = 0;
            for (var i in labels) {
                if (labels[i] > max_label) {
                    max_label = labels[i];
                }
            }
            var new_label_num = max_label + 1 - self.label_names.length;
            var label_index = self.label_names.length;
            while (new_label_num > 0) {
                while(self.label_names.indexOf('label-' + label_index) != -1) {
                    label_index++;
                }
                self.label_names.push('label-' + label_index);
                new_label_num--;
            }

            for (var i in labels) {
                var index = self.id2index[i];
                if (index == undefined) {
                    continue;
                }
                self.chart.select('#dot-'+i).each(function(dotData){
                    dotData.label = labels[i];
                    dotData.label_name = self.label_names[labels[i]];
                    d3.select(this).style('fill',color_manager.get_color(labels[i]));
                });
                for (var j = 0;j < self.state_stack.length;j++) {
                    var index = self.state_data[self.state_stack[j]]['id_to_index'][i];
                    if (index != undefined) {
                        self.state_data[self.state_stack[j]]['data'][index]['label'] = labels[i];
                        self.state_data[self.state_stack[j]]['data'][index]['label_name'] = self.label_names[labels[i]];
                    }
                }
                self.data[self.id2index[i]]['label'] = labels[i];
                self.data[self.id2index[i]]['label_name'] = self.label_names[labels[i]];
            }
            self._drawLegend();
            self._updateClickMenu();
        },
        _change_state: function(index) {
            var self = this;
            if (index == self.state_index) {
                self._reset();
                return;
            }
            self._draw_images("clear");
            self._draw_state_stack();
            d3.select('#state-stack-button-' + self.state_stack[index]).style('opacity', 1).style('fill', '#868E96');
            d3.select('#state-stack-button-text-' + self.state_stack[index]).style('opacity', 1).style('fill', 'white');
            d3.select('#state-stack-button-' + self.state_stack[self.state_index]).style('opacity', 0.7).style('fill', 'transparent');
            d3.select('#state-stack-button-text-' + self.state_stack[self.state_index]).style('opacity', 0.7).style('fill', 'black');
            self.level = index;

            self.state_index = index;
            var temp_data = self.state_data[self.state_stack[self.state_index]]['data'],
                temp_model_score_line = self.state_data[self.state_stack[self.state_index]]['model_score_line'],
                temp_id2index = self.state_data[self.state_stack[self.state_index]]['id_to_index'],
                temp_index2id = [];
            var temp_thresholds_scale = 1;
            if (self.state_data[self.state_stack[self.state_index]]['thresholds_scale'] != undefined) {
                temp_thresholds_scale = self.state_data[self.state_stack[self.state_index]]['thresholds_scale'];
            }


            for (var i = 0;i < temp_data.length;i++){
                temp_index2id.push(temp_data[i].id);
            }

            var data = temp_data;
            self.lasso_result = [];
            self._update_show_mode_switch();
            self.lasso_tree_size = 0;

            if (data.length == 0) {
                self.data = temp_data;
                self.id2index = temp_id2index;
                self.index2id = temp_index2id;
                self.model_score_line = temp_model_score_line;
                self.thresholds_scale = temp_thresholds_scale;
                self.state_data[self.state_stack[self.state_index]]['thresholds_scale'] = 1;
                self.data['thresholds_scale'] = 1;
                self.thresholds_scale = 1;
                var points = self.chart.selectAll('.dot')
                                .data(data, function (d) {
                                    return d.id;
                                });
                points.exit().remove();
                self.chart.selectAll('.contourPath').attr("opacity", 0);
                self._drawLegend();
                self._updateClickMenu();
                self._update_item_recomendation_param();
                return;
            }

            var xRange = d3.extent(data, function(d){return d.pos[0]});
            var yRange = d3.extent(data, function(d){return d.pos[1]});
            var scale = Math.min(self.contour_width / (xRange[1] - xRange[0]),
                                    self.contour_height / (yRange[1] - yRange[0]));
            var bandwidth_scale = Math.min(self.contour_width / 300,
                                    self.contour_height / 200);

            var bandwidthRange = d3.extent(temp_data, function(d){return d['bandwidth']});
            if (bandwidthRange[0] * bandwidth_scale < 8) {
                bandwidth_scale *= 8 / (bandwidthRange[0] * bandwidth_scale);
            }

            self.point_x_scale = d3.scaleLinear().domain(xRange).range([self.settings.margin.left, (xRange[1] - xRange[0]) * scale + self.settings.margin.left]);
            self.point_y_scale = d3.scaleLinear().domain(yRange).range([(yRange[1] - yRange[0]) * scale + self.settings.margin.top, self.settings.margin.top]);
            self.point_x_reverse_scale = d3.scaleLinear().domain([self.settings.margin.left, (xRange[1] - xRange[0]) * scale + self.settings.margin.left]).range(xRange);
            self.point_y_reverse_scale = d3.scaleLinear().domain([(yRange[1] - yRange[0]) * scale + self.settings.margin.top, self.settings.margin.top]).range(yRange);




            data.forEach(function(d){
                d.x = self.point_x_scale(d.pos[0]);
                d.y = self.point_y_scale(d.pos[1]);
                d.weight = 10.0 / (d.label_entropy + 1);
            });
            var  contour = d3.contourDensity()
                            .x(function (d) {
                                return d.x;
                            })
                            .y(function (d) {
                                return d.y;
                            })
                            .weight(function (d) {
                                return d.weight;
                            })
                            .size([3000, 3000])
                            .bandwidth(function (d) {
                                return d.bandwidth * bandwidth_scale;
                            });

            contour(data);
            var max_density_value = 0;
            contour.density_values().forEach(function(d){
                if (max_density_value < d){
                    max_density_value = d;
                }
            });

            var thresholds = [];

            var ratios = self.settings.contourRatios;
            thresholds.push();
            for (var i = 0; i < ratios.length; i++) {
                if (i == 0) {
                    thresholds.push(max_density_value * ratios[i] * temp_thresholds_scale);
                }
                else {
                    thresholds.push(max_density_value * ratios[i]);
                }
            }

            var contourTh = d3.contourDensity()
                                .x(function (d) {
                                    return d.x;
                                })
                                .y(function (d) {
                                    return d.y;
                                })
                                .weight(function (d) {
                                    return d.weight;
                                })
                                .size([3000, 3000])
                                .bandwidth(function (d) {
                                    return d.bandwidth * bandwidth_scale;
                                })
                                .thresholds(thresholds);
            var contourData = contourTh(data);

            while(contourData[0]["coordinates"].length > 1) {
                if (contourData[0]["coordinates"].length >= length) {
                    break;
                }
                length = contourData[0]["coordinates"].length;
                if (contourData[0]["coordinates"].length > 5) {
                    temp_thresholds_scale *= 0.5;
                }
                else {
                    temp_thresholds_scale *= 0.8;
                }
                thresholds[0] = max_density_value * ratios[0] * temp_thresholds_scale;

                contourTh = d3.contourDensity()
                                    .x(function (d) {
                                        return d.x;
                                    })
                                    .y(function (d) {
                                        return d.y;
                                    })
                                    .weight(function (d) {
                                        return d.weight;
                                    })
                                    .size([3000, 3000])
                                    .bandwidth(function (d) {
                                        return d.bandwidth * bandwidth_scale;
                                    })
                                    .thresholds(thresholds);
                contourData = contourTh(data);
            }
            self.state_data[self.state_stack[self.state_index]]['thresholds_scale'] = temp_thresholds_scale;
            self.data['thresholds_scale'] = temp_thresholds_scale;
            self.thresholds_scale = temp_thresholds_scale;


            for (var i = 0;i < contourData.length;i++) {
                contourData[i].id = i;
            }

            var x_range = [self.settings.margin.left, (xRange[1] - xRange[0]) * scale + self.settings.margin.left],
                y_range = [self.settings.margin.top, (yRange[1] - yRange[0]) * scale + self.settings.margin.top];

            for (var i = 0;i < contourData[0]["coordinates"].length;i++) {
                var coordinate = contourData[0]["coordinates"][i][0];
                for (var j in coordinate) {
                    if (coordinate[j][0] < x_range[0]) {
                        x_range[0] = coordinate[j][0];
                    }
                    if (coordinate[j][0] > x_range[1]) {
                        x_range[1] = coordinate[j][0];
                    }
                    if (coordinate[j][1] < y_range[0]) {
                        y_range[0] = coordinate[j][1];
                    }
                    if (coordinate[j][1] > y_range[1]) {
                        y_range[1] = coordinate[j][1];
                    }
                }
            }
            scale = Math.min(self.chart_width / (x_range[1] - x_range[0]),
                                    self.chart_height / (y_range[1] - y_range[0]));
            var x_begin = (self.chart_width - (x_range[1] - x_range[0]) * scale) / 2 - self.settings.margin.left;
            var y_begin = (self.chart_height - (y_range[1] - y_range[0]) * scale) / 2 - self.settings.margin.top;
            self.contour_x_scale = d3.scaleLinear().domain(x_range).range([x_begin, x_begin + (x_range[1] - x_range[0]) * scale]);
            self.contour_y_scale = d3.scaleLinear().domain(y_range).range([y_begin, y_begin + (y_range[1] - y_range[0]) * scale]);
            self.contour_x_reverse_scale = d3.scaleLinear().domain([x_begin, x_begin + (x_range[1] - x_range[0]) * scale]).range(x_range);
            self.contour_y_reverse_scale = d3.scaleLinear().domain([y_begin, y_begin + (y_range[1] - y_range[0]) * scale]).range(y_range);



            var x_r = [Infinity, -Infinity], y_r = [Infinity, -Infinity];
            for (var i in contourData) {
                var coordinates = contourData[i]["coordinates"];
                for (var j in coordinates) {
                    var temp = coordinates[j];
                    for (var k in temp) {
                        var coordinate = temp[k];
                        coordinate.forEach(function(d){
                            d[0] = self.contour_x_scale(d[0]);
                            d[1] = self.contour_y_scale(d[1]);
                            if (d[0] < x_r[0]) {
                                x_r[0] = d[0];
                            }
                            if (d[0] > x_r[1]) {
                                x_r[1] = d[0];
                            }
                            if (d[1] < y_r[0]) {
                                y_r[0] = d[1];
                            }
                            if (d[1] > y_r[1]) {
                                y_r[1] = d[1];
                            }
                        });
                    }
                }
            }
            //self._draw_pie_in_density_map_centers(contourData);

            data.forEach(function(d){
                d.x = self.contour_x_scale(d.x);
                d.y = self.contour_y_scale(d.y);
            });

            var contour_values = contourData.map(function (d) { return d.value; });
            contour_values.sort(function (a, b) {
                return a - b;
            });
            self.color_map.domain(contour_values);

            self.zoom = d3.zoom()
                            .scaleExtent([0.2, 6])
                            .on("zoom", zoomed);

            self.drag_transform = {'x': 0, 'y': 0};
            self.drag = d3.drag()
                .subject(function(d) {
                    return {
                        x: d.x,
                        y: d.y
                    };
                })
                .on("start", function(d){
                    // it's important that we suppress the mouseover event on the node being dragged. Otherwise it will absorb the mouseover event and the underlying node will not detect it
                    d3.select(this).attr( 'pointer-events', 'none' );
                })
                .on("drag", function(d) {
                    self.drag_transform.x += d3.event.dx;
                    self.drag_transform.y += d3.event.dy;
                    self.contour_map_dot.selectAll(".selected_dot")
                        .attr("cx", function(e) {return e.x + self.drag_transform.x;})
                        .attr("cy", function(e) {return e.y + self.drag_transform.y;});
                })
                .on("end", function(d){
                    // now restore the mouseover event or we won't be able to drag a 2nd time
                    d3.select(this).attr( 'pointer-events', '' );
                    var id = dataset_selector[0].selectedIndex;
                    for (var i = 0;i < self.lasso_result.length;i++){
                        self.data[self.id2index['' + self.lasso_result[i]]]['pos'][0]
                            = self.point_x_reverse_scale(self.contour_x_reverse_scale(self.data[self.id2index['' + self.lasso_result[i]]]['x']
                                                            + self.drag_transform.x));
                        self.data[self.id2index['' + self.lasso_result[i]]]['pos'][1]
                            = self.point_y_reverse_scale(self.contour_y_reverse_scale(self.data[self.id2index['' + self.lasso_result[i]]]['y']
                                                            + self.drag_transform.y));
                    }
                    self._generate_chart(false);
                });
            function zoomed() {
                if (self.zoom_scale != 1.0 / d3.event.transform.k) {
                    self.contour_map_dot.selectAll('.dot')
                        .attr('r', function (d) {
                        if (d.model_score >= self.model_score_line) {
                            return dot_size[1] * self.zoom_scale;
                        }
                        else if (self.lasso_result.indexOf(d.id) != -1 || self.highlight_index.indexOf(d.id) != -1) {
                            return dot_size[2] * self.zoom_scale;
                        }
                        return dot_size[0] * self.zoom_scale;
                    });
                    self.chart.selectAll('.highlight-item')
                        .attr('r', dot_size[0] * self.zoom_scale / 2);
                    self.chart.selectAll('.dot-g').attr("transform", function (d) {
                        return "translate(" + d["image_x"]
                                  + "," + d["image_y"] + ") scale(" + (1.0 / d3.event.transform.k) + ")";
                    });
                }
                self.zoom_scale = 1.0 / d3.event.transform.k;
                if (self.lasso != undefined) {
                    self.lasso.set_zoom_scale(self.zoom_scale);
                }
                self.main_group.style("stroke-width", 1.0 * self.zoom_scale + "px");
                self.main_group.attr("transform", d3.event.transform); // updated for d3 v4
            }

            d3.select("body").on('keydown',function(){
                if(d3.event.altKey){
                    // self.chart.on(".dragstart", null);
                    // self.chart.on(".drag", null);
                    // self.chart.on(".dragend", null);
                    self.contour_map.select("#background_rect").attr("width", 0).attr("height", 0);
                    self.chart.call(self.zoom);
                    if (_flag_ == "sampling") {
                        _flag_ = "";
                        console.log("change to selection");
                    }
                    else {
                        _flag_ = "sampling";
                        console.log("change to sampling");
                    }
                }
                else if (d3.event.keyCode == 27) {
                    self._reset();
                }
                else if (d3.event.keyCode == 13) {
                    if (self.focus_dot_id != -1) {
                        // document.getElementById('col-1-selector').blur();
                        list_component.change_point([{
                            'id': self.focus_dot_id,
                            'label': self.data.find(function(d){return d.id==self.focus_dot_id;}).label
                        }]);
                    }
                }
                else if(d3.event.shiftKey) {
                    self.chart.on("mousedown", null);
                    self.chart.on(".drag", null);
                    self.chart.on(".dragend", null);
                    self.chart.selectAll(".dot").call(self.drag);
                }
                else if (d3.event.ctrlKey) {
                    self.lasso.set_select_mode(1);
                    list_component.set_lasso_select_mode(1);
                }

            }).on('keyup',function(){
                if (d3.event.keyCode == 16) {
                    self.chart.selectAll(".dot").on('.drag', null);
                }
                else if (d3.event.keyCode == 17) {
                    self.lasso.set_select_mode(0);
                    list_component.set_lasso_select_mode(0);
                }
                else if (d3.event.keyCode == 18) {
                    self.chart.on('.zoom', null);
                    self.contour_map.select("#background_rect").attr("width", self.chart_width - 100)
                        .attr("height", self.chart_height);
                }
            });


            var contourMapContainerDot = self.chart.selectAll('.contourMapDot');
            var contourMapContainerDensity = self.chart.selectAll('.contourMapDensity');
            var contourMapDensity = contourMapContainerDensity.selectAll('.contourPath')
                    .data(contourData);

            contourMapDensity.exit().remove();
            contourMapDensity = contourMapContainerDensity.selectAll('.contourPath')
                    .data(contourData);
            contourMapDensity.enter().append('path')
                .attr('class','contourPath')
                .attr('id', function (d) {
                    return 'contourPath-' + d.id;
                });
            contourMapDensity = contourMapContainerDensity.selectAll('.contourPath');
            contourMapDensity
                .attr('id', function (d) {
                    return 'contourPath-' + d.id;
                });


            // // data = data.sort(function (a, b) {
            // //     return a.label - b.label;
            // // });
            // var del_ids = [], add_ids = [], dup_ids = [];
            // for (var i = 0, j = 0;j < temp_index2id.length;) {
            //     if (i >= self.index2id.length || self.index2id[i] > temp_index2id[j]) {
            //         data[j]['old'] = false;
            //         // data[j]['pre_x'] = data[j]['x'];
            //         // data[j]['pre_y'] = data[j]['y'];
            //         // data[j]['pre_opacity'] = 0;
            //         // data[j]['opacity'] = 0.7;
            //         j++;
            //     }
            //     else if (self.index2id[i] == temp_index2id[j]) {
            //         data[j]['old'] = true;
            //         // data[j]['pre_opacity'] = 0.7;
            //         // data[j]['opacity'] = 0.7;
            //         i++;
            //         j++;
            //     }
            //     else {
            //         contourMapContainer.select('#dot-' + self.index2id[i])
            //             .transition()
            //             .duration(1000)
            //             .style('opacity', 0);
            //         del_ids.push(self.index2id[i]);
            //         i++;
            //     }
            // }
            self.chart.selectAll('.highlight-item')
                .transition()
                .duration(1000)
                .style('opacity', 0);
            contourMapDensity
                .transition()
                .duration(1000)
                .style("opacity", 0);

            self.data = temp_data;
            self.id2index = temp_id2index;
            self.index2id = temp_index2id;
            self.model_score_line = temp_model_score_line;
            self.thresholds_scale = temp_thresholds_scale;

            self._drawLegend();
            self._updateClickMenu();
            self._update_item_recomendation_param();
            self._update_show_mode_switch();

            setTimeout(function () {
                var points = contourMapContainerDot.selectAll('.dot')
                                .data(data, function (d) {
                                    return d.id;
                                });
                points.exit().remove();
                points = contourMapContainerDot.selectAll('.dot')
                                .data(data, function (d) {
                                    return d.id;
                                });
                points.enter().append('circle')
                    .attr('class','dot')
                    .attr('id', function (d) {
                        return 'dot-' + d.id;
                    })
                    .style("opacity", 0)
                    .attr('cx',function(d){
                        return d.x;
                    })
                    .attr('cy',function(d){
                        return d.y;
                    })
                    .on("mousemove", function (d) {
                        if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                            && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                            // d3.select('#dot-' + self.focus_dot_id)
                                // .attr('r', function (d) {
                                //     if (d.model_score >= self.model_score_line) {
                                //         return dot_size[2] * self.zoom_scale;
                                //     }
                                //     return dot_size[0] * self.zoom_scale;
                                // })
                                // .style('stroke', 'white');
                        }
                        self.focus_dot_id = d.id;
                        d3.select('#dot-' + d.id)
                            // .attr('r', function (d) {
                            //     if (d.model_score >= self.model_score_line) {
                            //         return dot_size[2] * self.zoom_scale;
                            //     }
                            //     return dot_size[1] * self.zoom_scale;
                            // })
                            // .style('stroke', '#000000');
                        var data = deep_copy(d);
                        data.label = self.label_names[data.label];
                        if (col_1_view_state == 0) {
                            // information_component.redraw(data);
                        }
                        else {
                            self._update_dot_info(d.id);
                        }
                    })
                    .on("mousedown", function (d) {
                        self.dot_mouse_down = true;
                        self.contour_map.on(".dragstart", null);
                        self.contour_map.on(".drag", null);
                        self.contour_map.on(".dragend", null);
                        if (self.lasso.get_select_mode() == 0) {
                            for (var i = 0;i < self.lasso_result.length;i++) {
                                self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                        if (d.model_score >= self.model_score_line) {
                                            return dot_size[2] * self.zoom_scale;
                                        }
                                        return dot_size[0] * self.zoom_scale;
                                    });
                            }
                            self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                            self.lasso_result = [d.id];
                            self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                            self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                });
                        }
                        else if (self.lasso_result.indexOf(d.id) == -1){
                            self.lasso_result.push(d.id);
                            self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                            self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                });
                        }
                        self._update_item_recomendation_param();
                        self._update_show_mode_switch();
                        self.lasso.set_selected_index(self.lasso_result);
                        self._updateClickMenu();
                    })
                    .on("mouseup", function (d) {
                        if (self.lasso.get_select_mode() == 0) {
                            for (var i = 0;i < self.lasso_result.length;i++) {
                                self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                        if (d.model_score >= self.model_score_line) {
                                            return dot_size[2] * self.zoom_scale;
                                        }
                                        return dot_size[0] * self.zoom_scale;
                                    });
                            }
                            self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                            self.lasso_result = [d.id];
                            self._update_item_recomendation_param();
                            self._update_show_mode_switch();
                            self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                            self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                });
                        }
                        else if (self.lasso_result.indexOf(d.id) == -1){
                            self.lasso_result.push(d.id);
                            self._update_item_recomendation_param();
                            self._update_show_mode_switch();
                            self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                            self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                });
                        }

                        self._update_item_recomendation_param();
                        self._update_show_mode_switch();
                        self._enableLasso();
                        self._updateClickMenu();
                        self.dot_mouse_down = false;
                    })
                    .on("mouseleave", function (d) {
                        if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                            && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                            d3.select('#dot-' + self.focus_dot_id)
                                // .attr('r', function (d) {
                                //     if (d.model_score >= self.model_score_line) {
                                //         return dot_size[2] * self.zoom_scale;
                                //     }
                                //     return dot_size[0] * self.zoom_scale;
                                // })
                                // .style('stroke', 'white');
                        }
                        self.focus_dot_id = -1;
                        var count = 0;
                        for (var x in self.data[0]) {
                            count++;
                        }
                        if (col_1_view_state == 1 &&
                            (self.mouse_pos[0] < self.chart_width - 210
                            || self.mouse_pos[0] > self.chart_width - 10
                            || self.mouse_pos[1] < self.chart_height - count * 25 - 220
                            || self.mouse_pos[1] > self.chart_height - 10)) {
                            self._update_dot_info(-1);
                        }
                    });
                points = contourMapContainerDot.selectAll('.dot')
                                .data(data, function (d) {
                                    return d.id;
                                });
                points
                    .style('fill', function (d) {
                        return color_manager.get_color(d['label']);
                    })
                    // .style('stroke', 'white')
                    .attr('id', function (d) {
                        return 'dot-' + d.id;
                    })
                    .attr('r', function (d) {
                        if (d.model_score >= self.model_score_line) {
                            return dot_size[1] * self.zoom_scale;
                        }
                        return dot_size[0] * self.zoom_scale;
                    })
                    .on("mousemove", function (d) {
                        if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                            && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                            // d3.select('#dot-' + self.focus_dot_id)
                                // .attr('r', function (d) {
                                //     if (d.model_score >= self.model_score_line) {
                                //         return dot_size[2] * self.zoom_scale;
                                //     }
                                //     return dot_size[0] * self.zoom_scale;
                                // })
                                // .style('stroke', 'white');
                        }
                        self.focus_dot_id = d.id;
                        d3.select('#dot-' + d.id)
                            // .attr('r', function (d) {
                            //     if (d.model_score >= self.model_score_line) {
                            //         return dot_size[2] * self.zoom_scale;
                            //     }
                            //     return dot_size[1] * self.zoom_scale;
                            // })
                            // .style('stroke', '#000000');
                        var data = deep_copy(d);
                        data.label = self.label_names[data.label];
                        if (col_1_view_state == 0) {
                            // information_component.redraw(data);
                        }
                        else {
                            self._update_dot_info(d.id);
                        }
                    })
                    .on("mousedown", function (d) {
                        self.dot_mouse_down = true;
                        self.contour_map.on(".dragstart", null);
                        self.contour_map.on(".drag", null);
                        self.contour_map.on(".dragend", null);
                        if (self.lasso.get_select_mode() == 0) {
                            for (var i = 0;i < self.lasso_result.length;i++) {
                                self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                        if (d.model_score >= self.model_score_line) {
                                            return dot_size[2] * self.zoom_scale;
                                        }
                                        return dot_size[0] * self.zoom_scale;
                                    });
                            }
                            self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                            self.lasso_result = [d.id];
                            self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                            self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                });
                        }
                        else if (self.lasso_result.indexOf(d.id) == -1){
                            self.lasso_result.push(d.id);
                            self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                            self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                });
                        }
                        self._update_item_recomendation_param();
                        self._update_show_mode_switch();
                        self.lasso.set_selected_index(self.lasso_result);
                        self._updateClickMenu();
                    })
                    .on("mouseup", function (d) {
                        if (self.lasso.get_select_mode() == 0) {
                            for (var i = 0;i < self.lasso_result.length;i++) {
                                self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                        if (d.model_score >= self.model_score_line) {
                                            return dot_size[2] * self.zoom_scale;
                                        }
                                        return dot_size[0] * self.zoom_scale;
                                    });
                            }
                            self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                            self.lasso_result = [d.id];
                            self._update_item_recomendation_param();
                            self._update_show_mode_switch();
                            self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                            self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                });
                        }
                        else if (self.lasso_result.indexOf(d.id) == -1){
                            self.lasso_result.push(d.id);
                            self._update_item_recomendation_param();
                            self._update_show_mode_switch();
                            self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                            self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                });
                        }

                        self._update_item_recomendation_param();
                        self._update_show_mode_switch();
                        self._enableLasso();
                        self._updateClickMenu();
                        self.dot_mouse_down = false;
                    })
                    .on("mouseleave", function (d) {
                        if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                            && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                            d3.select('#dot-' + self.focus_dot_id)
                                // .attr('r', function (d) {
                                //     if (d.model_score >= self.model_score_line) {
                                //         return dot_size[2] * self.zoom_scale;
                                //     }
                                //     return dot_size[0] * self.zoom_scale;
                                // })
                                // .style('stroke', 'white');
                        }
                        self.focus_dot_id = -1;
                        var count = 0;
                        for (var x in self.data[0]) {
                            count++;
                        }
                        if (col_1_view_state == 1 &&
                            (self.mouse_pos[0] < self.chart_width - 210
                            || self.mouse_pos[0] > self.chart_width - 10
                            || self.mouse_pos[1] < self.chart_height - count * 25 - 220
                            || self.mouse_pos[1] > self.chart_height - 10)) {
                            self._update_dot_info(-1);
                        }
                    });

                self.chart.selectAll(".dot")
                    .transition()
                    .duration(1000)
                    .attr('cx',function(d){return d['x'];})
                    .attr('cy',function(d){return d['y'];});


                contourMapDensity
                    // .transition()
                    // .duration(1000)
                    .attr('d', d3.geoPath())
                    .style('fill', function (d) {
                        return self.color_map(d.value);
                    });

                setTimeout(function () {
                    self.chart.selectAll(".dot")
                        .transition()
                        .duration(1000)
                        .style("opacity", 0.7);
                    setTimeout(function () {
                        contourMapContainerDensity.selectAll('.contourPath').transition()
                                .duration(1000)
                                .style('opacity', 1);
                        setTimeout(function () {
                            self._set_highlight_item(list_component.get_item_ids());
                        }, 1000);

                        self._update_item_recomendation_param();
                        self._update_show_mode_switch();
                        self._enableLasso();
                    }, 1000);
                }, 1000);

            }, 1000);

        },
        _update_show_mode_switch: function () {
            var self = this;
            var images = deep_copy(self.images);
            var lasso_result = deep_copy(self.lasso_result);
            images.sort(function(a, b){return a - b;});
            lasso_result.sort(function(a, b){return a - b;});
            var i = 0;
            for (var j = 0;i < lasso_result.length && j < images.length;) {
                if (lasso_result[i] < images[j]) {
                    break;
                }
                else if (lasso_result[i] === images[j]) {
                    i++;
                    j++;
                }
                else {
                    j++;
                }
            }
            if (i < lasso_result.length || lasso_result.length == 0) {
                document.getElementById("show-mode").innerText = "Show image";
            }
            else {
                document.getElementById("show-mode").innerText = "Show dot";
            }
        },
        _update_item_recomendation_param: function () {
            var self = this;
            var max_num = self.lasso_result.length;
            var data = [];
            for (var i = 0;i < max_num;i++){
                var item = self.data[self.id2index[self.lasso_result[i]]];
                data.push(item);
            }
            var contourMapContainerSelected = self.chart.selectAll('.contourMapSelected');
            var points = contourMapContainerSelected.selectAll('.selected_dot1')
                                    .data(data, function (d) {
                                    return d.id;
                                });
                points.exit().remove();
                points = contourMapContainerSelected.selectAll('.selected_dot1')
                                    .data(data, function (d) {
                                    return d.id;
                                });
                points.enter().append('circle')
                                .attr('class','selected_dot1')
                                .attr('id', function (d) {
                                    return 'selected-dot-' + d.id;
                                })
                                .on("mousemove", function (d) {
                                    if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                        && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                        // d3.select('#dot-' + self.focus_dot_id)
                                            // .attr('r', function (d) {
                                            //     if (d.model_score >= self.model_score_line) {
                                            //         return dot_size[2] * self.zoom_scale;
                                            //     }
                                            //     return dot_size[0] * self.zoom_scale;
                                            // })
                                            // .style('stroke', 'white');
                                    }
                                    self.focus_dot_id = d.id;
                                    // d3.select('#dot-' + d.id)
                                        // .attr('r', function (d) {
                                        //     if (d.model_score >= self.model_score_line) {
                                        //         return dot_size[2] * self.zoom_scale;
                                        //     }
                                        //     return dot_size[1] * self.zoom_scale;
                                        // })
                                        // .style('stroke', '#000000');
                                    var data = deep_copy(d);
                                    data.label = self.label_names[data.label];
                                    if (col_1_view_state == 0) {
                                        // information_component.redraw(data);
                                    }
                                    else {
                                        self._update_dot_info(d.id);
                                    }
                                })
                                .on("mousedown", function (d) {
                                    self.dot_mouse_down = true;
                                    self.contour_map.on(".dragstart", null);
                                    self.contour_map.on(".drag", null);
                                    self.contour_map.on(".dragend", null);
                                    if (self.lasso.get_select_mode() == 0) {
                                        for (var i = 0;i < self.lasso_result.length;i++) {
                                            self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                    if (d.model_score >= self.model_score_line) {
                                                        return dot_size[2] * self.zoom_scale;
                                                    }
                                                    return dot_size[0] * self.zoom_scale;
                                                });
                                        }
                                        self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                        self.lasso_result = [d.id];
                                        self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    else if (self.lasso_result.indexOf(d.id) == -1){
                                        self.lasso_result.push(d.id);
                                        self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    self._update_item_recomendation_param();
                                    self._update_show_mode_switch();
                                    self.lasso.set_selected_index(self.lasso_result);
                                    self._updateClickMenu();
                                })
                                .on("mouseup", function (d) {
                                    if (self.lasso.get_select_mode() == 0) {
                                        for (var i = 0;i < self.lasso_result.length;i++) {
                                            self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                    if (d.model_score >= self.model_score_line) {
                                                        return dot_size[2] * self.zoom_scale;
                                                    }
                                                    return dot_size[0] * self.zoom_scale;
                                                });
                                        }
                                        self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                        self.lasso_result = [d.id];
                                        self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    else if (self.lasso_result.indexOf(d.id) == -1){
                                        self.lasso_result.push(d.id);
                                        self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    self._update_item_recomendation_param();
                                    self._update_show_mode_switch();
                                    self._enableLasso();
                                    self._updateClickMenu();
                                    self.dot_mouse_down = false;
                                })
                                .on("mouseleave", function (d) {
                                    if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                        && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                        // d3.select('#dot-' + self.focus_dot_id)
                                            // .attr('r', function (d) {
                                            //     if (d.model_score >= self.model_score_line) {
                                            //         return dot_size[2] * self.zoom_scale;
                                            //     }
                                            //     return dot_size[0] * self.zoom_scale;
                                            // })
                                            // .style('stroke', 'white');
                                    }
                                    self.focus_dot_id = -1;
                                    var count = 0;
                                    for (var x in self.data[0]) {
                                        count++;
                                    }
                                    if (col_1_view_state == 1 &&
                                        (self.mouse_pos[0] < self.chart_width - 210
                                        || self.mouse_pos[0] > self.chart_width - 10
                                        || self.mouse_pos[1] < self.chart_height - count * 25 - 220
                                        || self.mouse_pos[1] > self.chart_height - 10)) {
                                        self._update_dot_info(-1);
                                    }
                                });
                points = contourMapContainerSelected.selectAll('.selected_dot1')
                                    .data(data, function (d) {
                                    return d.id;
                                });
                points.attr('cx',function(d){return d.x;})
                                .attr('cy',function(d){return d.y;})
                                .style('fill', function (d) {
                                    return color_manager.get_color(d['label']);
                                })
                                // .style('stroke', 'white')
                                .style('opacity', 1)
                                .attr('r', function (d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                })
                                .on("mousemove", function (d) {
                                    if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                        && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                        // d3.select('#dot-' + self.focus_dot_id)
                                            // .attr('r', function (d) {
                                            //     if (d.model_score >= self.model_score_line) {
                                            //         return dot_size[2] * self.zoom_scale;
                                            //     }
                                            //     return dot_size[0] * self.zoom_scale;
                                            // })
                                            // .style('stroke', 'white');
                                    }
                                    self.focus_dot_id = d.id;
                                    // d3.select('#dot-' + d.id)
                                        // .attr('r', function (d) {
                                        //     if (d.model_score >= self.model_score_line) {
                                        //         return dot_size[2] * self.zoom_scale;
                                        //     }
                                        //     return dot_size[1] * self.zoom_scale;
                                        // })
                                        // .style('stroke', '#000000');
                                    var data = deep_copy(d);
                                    data.label = self.label_names[data.label];
                                    if (col_1_view_state == 0) {
                                        // information_component.redraw(data);
                                    }
                                    else {
                                        self._update_dot_info(d.id);
                                    }
                                })
                                .on("mousedown", function (d) {
                                    self.dot_mouse_down = true;
                                    self.contour_map.on(".dragstart", null);
                                    self.contour_map.on(".drag", null);
                                    self.contour_map.on(".dragend", null);
                                    if (self.lasso.get_select_mode() == 0) {
                                        for (var i = 0;i < self.lasso_result.length;i++) {
                                            self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                    if (d.model_score >= self.model_score_line) {
                                                        return dot_size[2] * self.zoom_scale;
                                                    }
                                                    return dot_size[0] * self.zoom_scale;
                                                });
                                        }
                                        self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                        self.lasso_result = [d.id];
                                        self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    else if (self.lasso_result.indexOf(d.id) == -1){
                                        self.lasso_result.push(d.id);
                                        self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    self._update_item_recomendation_param();
                                    self._update_show_mode_switch();
                                    self.lasso.set_selected_index(self.lasso_result);
                                    self._updateClickMenu();
                                })
                                .on("mouseup", function (d) {
                                    if (self.lasso.get_select_mode() == 0) {
                                        for (var i = 0;i < self.lasso_result.length;i++) {
                                            self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                    if (d.model_score >= self.model_score_line) {
                                                        return dot_size[2] * self.zoom_scale;
                                                    }
                                                    return dot_size[0] * self.zoom_scale;
                                                });
                                        }
                                        self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                        self.lasso_result = [d.id];
                                        self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    else if (self.lasso_result.indexOf(d.id) == -1){
                                        self.lasso_result.push(d.id);
                                        self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    self._update_item_recomendation_param();
                                    self._update_show_mode_switch();
                                    self._enableLasso();
                                    self._updateClickMenu();
                                    self.dot_mouse_down = false;
                                })
                                .on("mouseleave", function (d) {
                                    if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                        && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                        // d3.select('#dot-' + self.focus_dot_id)
                                            // .attr('r', function (d) {
                                            //     if (d.model_score >= self.model_score_line) {
                                            //         return dot_size[2] * self.zoom_scale;
                                            //     }
                                            //     return dot_size[0] * self.zoom_scale;
                                            // })
                                            // .style('stroke', 'white');
                                    }
                                    self.focus_dot_id = -1;
                                    var count = 0;
                                    for (var x in self.data[0]) {
                                        count++;
                                    }
                                    if (col_1_view_state == 1 &&
                                        (self.mouse_pos[0] < self.chart_width - 210
                                        || self.mouse_pos[0] > self.chart_width - 10
                                        || self.mouse_pos[1] < self.chart_height - count * 25 - 220
                                        || self.mouse_pos[1] > self.chart_height - 10)) {
                                        self._update_dot_info(-1);
                                    }
                                });
            if (max_num == 0) {
                max_num = self.data_count();
            }
            // document.getElementById("sampling-number-max").innerText = "" + max_num;
            max_sampling_number = max_num;
            document.getElementById("sampling-number").value = 0;
            var change_points = [];
            for (var i = 0;i < self.lasso_result.length;i++) {
                change_points[i] = {
                    "id": self.lasso_result[i],
                    "label": self.data[self.id2index[self.lasso_result[i]]]['label']
                }
            }
            // self._set_highlight_item(list_component.get_item_ids());
            image_component.change_point(change_points);
            self._drawLegend();
        },
        _draw_sampling_filter:function () {
            var self = this;
            self.chart.on(".dragstart", null);
            self.chart.on(".drag", null);
            self.chart.on(".dragend", null);
            self.chart.selectAll(".sampling_param").remove();
            self.chart.selectAll(".sampling_param_value").remove();
            self.chart.selectAll(".sampling_method_circle").remove();
            self.chart.selectAll(".sampling_method_text").remove();
            self.chart.select("#sampling_param_group").remove();
            self.sampling_param_group = self.chart.append('g');
            self.sampling_param_group.attr("#sampling_param_group");
            self.focus_sampling_method_index = 0;
            var pos_record = [self.mouse_pos[0], self.mouse_pos[1]];
            self.sampling_param_group.append('rect')
                .attr("class", "sampling_param")
                .attr("id", "sampling_param_rect")
                .attr("x", pos_record[0] - 50)
                .attr("y", pos_record[1] - 150)
                .attr("width", 300)
                .attr("height", 210)
                .style("fill", "white")
                .style("opacity", 0.5)
                .style("stroke", "black")
                .on("mousedown", function () {
                    self.sampling_param_group_initial_pos[0] = self.mouse_pos[0] - self.sampling_param_group_pre_transform[0];
                    self.sampling_param_group_initial_pos[1] = self.mouse_pos[1] - self.sampling_param_group_pre_transform[1];
                    self.sampling_param_rect_drag = true;
                })
                .on("mouseup", function () {
                    self.sampling_param_rect_drag = false;
                    self.label_param_group_pre_transform = [0, 0];
                });
            self.sampling_param_group.append('circle')
                .attr("class", "sampling_param")
                .attr("id", "sampling_param_mask")
                .attr("cx", pos_record[0] + 240)
                .attr("cy", pos_record[1] - 140)
                .attr("r", 7)
                .style("fill", "transparent")
                .style("stroke", "black")
                .style("stroke-width", 1)
                .style("opacity", 0.7)
                .on("mousemove", function () {
                    self.sampling_param_group.select("#sampling_param_mask")
                        .style("stroke", "white")
                        .style("opacity", 1)
                        .style("fill", "black");
                    self.sampling_param_group.select("#sampling_param_mask_path")
                        .style("stroke", "white")
                        .style("opacity", 1.0);
                })
                .on("mouseleave", function () {
                    self.sampling_param_group.select("#sampling_param_mask")
                        .style("stroke", "black")
                        .style("opacity", 0.7)
                        .style("fill", "transparent");
                    self.sampling_param_group.select("#sampling_param_mask_path")
                        .style("stroke", "black")
                        .style("opacity", 0.7);
                })
                .on("mousedown", function () {
                    self.chart.selectAll(".sampling_param").remove();
                    self.chart.selectAll(".sampling_param_value").remove();
                    self.chart.selectAll(".sampling_method_circle").remove();
                    self.chart.selectAll(".sampling_method_text").remove();
                    self.chart.select("#sampling_param_group").remove();

                    self.sampling_param_group_initial_pos = [0, 0];
                    self.sampling_param_group_pre_transform = [0, 0];
                    self._enableLasso();
                });
            self.sampling_param_group.append('path')
                .attr("class", "sampling_param")
                .attr("id", "sampling_param_mask_path")
                .attr("d", "M" + (pos_record[0] + 240 - 7 / 1.5)
                                + "," + (pos_record[1] - 140 - 7 / 1.5)
                        + "L" + (pos_record[0] + 240 + 7 / 1.5)
                                + "," + (pos_record[1] - 140 + 7 / 1.5)
                        + "L" + (pos_record[0] + 240)
                                + "," + (pos_record[1] - 140)
                        + "L" + (pos_record[0] + 240 + 7 / 1.5)
                                + "," + (pos_record[1] - 140 - 7 / 1.5)
                        + "L" + (pos_record[0] + 240 - 7 / 1.5)
                                + "," + (pos_record[1] - 140 + 7 / 1.5))
                .style("fill", "transparent")
                .style("stroke", "black")
                .style("stroke-width", 1)
                .style("opacity", 0.7)
                .on("mousemove", function () {
                    self.sampling_param_group.select("#sampling_param_mask")
                        .style("stroke", "white")
                        .style("opacity", 1)
                        .style("fill", "black");
                    self.sampling_param_group.select("#sampling_param_mask_path")
                        .style("stroke", "white")
                        .style("opacity", 1.0);
                })
                .on("mouseleave", function () {
                    self.sampling_param_group.select("#sampling_param_mask")
                        .style("stroke", "black")
                        .style("opacity", 0.7)
                        .style("fill", "transparent");
                    self.sampling_param_group.select("#sampling_param_mask_path")
                        .style("stroke", "black")
                        .style("opacity", 0.7);
                })
                .on("mousedown", function () {
                    self.chart.selectAll(".sampling_param").remove();
                    self.chart.selectAll(".sampling_param_value").remove();
                    self.chart.selectAll(".sampling_method_circle").remove();
                    self.chart.selectAll(".sampling_method_text").remove();
                    self.chart.select("#sampling_param_group").remove();
                    self.sampling_param_group_initial_pos = [0, 0];
                    self.sampling_param_group_pre_transform = [0, 0];
                    self._enableLasso();
                });

            var sampling_methods = [];
            for (var i = 0;i < self.methods.length;i++) {
                sampling_methods[i] = {
                    "method": self.methods[i],
                    "index": i
                };
            }
            self.sampling_param_group.selectAll(".sampling_method_circle")
                .data(sampling_methods)
                .enter()
                .append("circle")
                .attr("class", "sampling_method_circle")
                .attr("id", function (d) {
                    return "sampling_method_" + d["index"];
                })
                .attr("cx", pos_record[0] - 30)
                .attr("cy", function (d) {
                    return  pos_record[1] - 115 + 20 * d["index"];
                })
                .attr("r", 6)
                .style("fill", function (d) {
                    if (d["index"] == self.focus_sampling_method_index) {
                        return "black";
                    }
                    return "transparent";
                })
                .style("stroke", "black")
                .style("stroke-width", 1)
                .style("opacity", function (d) {
                    if (d["index"] == self.focus_sampling_method_index) {
                        return 1;
                    }
                    return 0.7;
                })
                // .on("mousemove", function (d) {
                //     self.sampling_param_group.select("#sampling_method_" + d["index"])
                //         .style("stroke", "white")
                //         .style("opacity", 1)
                //         .style("fill", "black");
                // })
                // .on("mouseleave", function (d) {
                //     if (d["index"] != self.focus_sampling_method_index) {
                //         self.sampling_param_group.select("#sampling_method_" + d["index"])
                //             .style("stroke", "black")
                //             .style("opacity", 0.7)
                //             .style("fill", "transparent");
                //     }
                // })
                .on("mousedown", function (d) {
                    self.sampling_param_group.select("#sampling_method_" + self.focus_sampling_method_index)
                        .style("stroke", "black")
                        .style("opacity", 0.7)
                        .style("fill", "transparent");
                    self.focus_sampling_method_index = d["index"];
                    self.sampling_param_group.select("#sampling_method_" + d["index"])
                        .style("stroke", "white")
                        .style("opacity", 1)
                        .style("fill", "black");
                });
            self.sampling_param_group.selectAll(".sampling_method_text")
                .data(sampling_methods)
                .enter()
                .append("text")
                .attr("class", "sampling_method_text")
                .attr("id", function (d) {
                    return "sampling_method_text_" + d["index"];
                })
                .attr("x", pos_record[0])
                .attr("y", function (d) {
                    return  pos_record[1] - 109 + 20 * d["index"];
                })
                .text(function (d) {
                    return d["method"];
                })
                .style("user-select", "none");

            self.sampling_param_group.append("path")
                .attr("class", "sampling_param")
                .attr("id", "sampling_sample_num_line")
                .attr("d", "M" + pos_record[0]
                                + "," + (pos_record[1] + 10)
                        + "L" + (pos_record[0] + 200)
                                + "," + (pos_record[1] + 10))
                .style("fill", "black")
                .style("stroke", "black")
                .style("stroke-width", 3)
                .style("opacity", 1);

            var values = [{
                "index": 0,
                "value": 1
            }, {
                "index": 1,
                "value": self.lasso_tree_size - 1
            }];
            var value = Math.floor(self.lasso_tree_size / 2);

            self.sampling_param_group.selectAll(".sampling_param_value")
                .data(values)
                .enter()
                .append("text")
                .style("user-select", "none")
                .attr("class", "sampling_param_value")
                .attr("id", function (d) {
                    return "sampling_param_value_" + d["index"];
                })
                .attr("x", function (d) {
                    if (d["index"] == 0) {
                        return pos_record[0] - 25;
                    }
                    return pos_record[0] + 225;
                })
                .attr("y", pos_record[1] + 10)
                .text(function (d) {
                    return d["value"];
                })
                .style("user-select", "none")
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '15px')
                .attr('font-family', 'Arial');

            self.sampling_value_bar_pre_x = pos_record[0] + 200 * (value - 1) / (self.lasso_tree_size - 2);
            self.sampling_value_bar_x_range[0] = pos_record[0];
            self.sampling_value_bar_x_range[1] = pos_record[0] + 200;
            self.sampling_param_group.append('rect')
                .attr("class", "sampling_param")
                .attr("id", "sampling_param_value_rect")
                .attr("x", self.sampling_value_bar_pre_x)
                .attr("y", pos_record[1])
                .attr("width", 10)
                .attr("height", 20)
                .style("fill", "white")
                .style("opacity", 0.5)
                .style("stroke", "black")
                .on("mousemove", function () {
                    self.sampling_param_group.select("#sampling_param_value_rect")
                        .style("fill", "black");
                })
                .on("mouseleave", function () {
                    self.sampling_param_group.select("#sampling_param_value_rect")
                        .style("fill", "white")
                })
                .on("mousedown", function () {
                    self.sampling_value_bar_initial_x = self.mouse_pos[0] - self.sampling_value_bar_pre_x;
                    self.sampling_param_button_drag = true;
                })
                .on("mouseup", function () {
                    self.sampling_param_button_drag = false;
                });

            self.sampling_param_group.append('text')
                .attr("id", "sampling_param_value_text")
                .attr('class', 'sampling_param')
                .attr('x', self.sampling_value_bar_pre_x + 5)
                .attr('y',pos_record[1] - 10)
                .text(value)
                .style("user-select", "none")
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '15px')
                .attr('font-family', 'Arial')
                .attr('text-anchor', "middle");

            self.sampling_param_group.append('rect')
                .attr("class", "sampling_param")
                .attr("id", "ok_button")
                .attr("x", pos_record[0] + 200)
                .attr("y", pos_record[1] + 30)
                .attr("width", 40)
                .attr("height", 20)
                .style("fill", "white")
                .style("opacity", 0.5)
                .style("stroke", "black")
                .on("mousemove", function () {
                    self.sampling_param_group.select("#ok_button")
                        .style("fill", "black");
                    self.sampling_param_group.select("#ok_button_text")
                        .style("fill", "white");
                })
                .on("mouseleave", function () {
                    self.sampling_param_group.select("#ok_button")
                        .style("fill", "white");
                    self.sampling_param_group.select("#ok_button_text")
                        .style("fill", "black");
                })
                .on("mousedown", function () {
                    self.chart.selectAll(".sampling_param").remove();
                    self.chart.selectAll(".sampling_param_value").remove();
                    self.chart.selectAll(".sampling_method_circle").remove();
                    self.chart.selectAll(".sampling_method_text").remove();
                    self.chart.select("#sampling_param_group").remove();
                    self.sampling_param_group_initial_pos = [0, 0];
                    self.sampling_param_group_pre_transform = [0, 0];
                    self._enableLasso();
                    self._sampling_filter();
                });

            self.sampling_param_group.append('text')
                .attr("id", "ok_button_text")
                .attr('class', 'sampling_param')
                .attr('x', pos_record[0] + 220)
                .attr('y',pos_record[1] + 40)
                .text("ok")
                .style("user-select", "none")
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '15px')
                .attr('font-family', 'Arial')
                .attr('text-anchor', "middle")
                .on("mousemove", function () {
                    self.sampling_param_group.select("#ok_button")
                        .style("fill", "black");
                    self.sampling_param_group.select("#ok_button_text")
                        .style("fill", "white");
                })
                .on("mouseleave", function () {
                    self.sampling_param_group.select("#ok_button")
                        .style("fill", "white");
                    self.sampling_param_group.select("#ok_button_text")
                        .style("fill", "black");
                })
                .on("mousedown", function () {
                    self.chart.selectAll(".sampling_param").remove();
                    self.chart.selectAll(".sampling_param_value").remove();
                    self.chart.selectAll(".sampling_method_circle").remove();
                    self.chart.selectAll(".sampling_method_text").remove();
                    self.chart.select("#sampling_param_group").remove();
                    self.sampling_param_group_initial_pos = [0, 0];
                    self.sampling_param_group_pre_transform = [0, 0];
                    self._enableLasso();
                    self._sampling_filter();
                });
        },
        _draw_label_filter:function () {
            var self = this;
            self.chart.on(".dragstart", null);
            self.chart.on(".drag", null);
            self.chart.on(".dragend", null);
            self.chart.selectAll(".label_param").remove();
            self.chart.selectAll(".label_item_circle").remove();
            self.chart.selectAll(".label_item_rect").remove();
            self.chart.selectAll(".label_item_text").remove();
            self.chart.select("#label_param_group").remove();
            self.label_param_group = self.chart.append('g');
            self.label_param_group.attr("#label_param_group");
            self.focus_label_item_index = [];
            var pos_record = [self.mouse_pos[0], self.mouse_pos[1]];
            self.label_param_group.append('rect')
                .attr("class", "label_param")
                .attr("id", "label_param_rect")
                .attr("x", pos_record[0] - 50)
                .attr("y", pos_record[1] - 150)
                .attr("width", 300)
                .attr("height", 20 * self.label_names.length + 40)
                .style("fill", "white")
                .style("opacity", 0.5)
                .style("stroke", "black")
                .on("mousedown", function () {
                    self.label_param_group_initial_pos[0] = self.mouse_pos[0] - self.label_param_group_pre_transform[0];
                    self.label_param_group_initial_pos[1] = self.mouse_pos[1] - self.label_param_group_pre_transform[1];
                    self.label_param_rect_drag = true;
                })
                .on("mouseup", function () {
                    self.label_param_rect_drag = false;
                    self.label_param_group_pre_transform = [0, 0];
                });
            self.label_param_group.append('circle')
                .attr("class", "label_param")
                .attr("id", "label_param_mask")
                .attr("cx", pos_record[0] + 240)
                .attr("cy", pos_record[1] - 140)
                .attr("r", 7)
                .style("fill", "transparent")
                .style("stroke", "black")
                .style("stroke-width", 1)
                .style("opacity", 0.7)
                .on("mousemove", function () {
                    self.label_param_group.select("#label_param_mask")
                        .style("stroke", "white")
                        .style("opacity", 1)
                        .style("fill", "black");
                    self.label_param_group.select("#label_param_mask_path")
                        .style("stroke", "white")
                        .style("opacity", 1.0);
                })
                .on("mouseleave", function () {
                    self.label_param_group.select("#label_param_mask")
                        .style("stroke", "black")
                        .style("opacity", 0.7)
                        .style("fill", "transparent");
                    self.label_param_group.select("#label_param_mask_path")
                        .style("stroke", "black")
                        .style("opacity", 0.7);
                })
                .on("mousedown", function () {
                    self.chart.selectAll(".label_param").remove();
                    self.chart.selectAll(".label_item_circle").remove();
                    self.chart.selectAll(".label_item_rect").remove();
                    self.chart.selectAll(".label_item_text").remove();
                    self.chart.select("#label_param_group").remove();
                    self.label_param_group_initial_pos = [0, 0];
                    self.label_param_group_pre_transform = [0, 0];
                    self._enableLasso();
                });
            self.label_param_group.append('path')
                .attr("class", "label_param")
                .attr("id", "label_param_mask_path")
                .attr("d", "M" + (pos_record[0] + 240 - 7 / 1.5)
                                + "," + (pos_record[1] - 140 - 7 / 1.5)
                        + "L" + (pos_record[0] + 240 + 7 / 1.5)
                                + "," + (pos_record[1] - 140 + 7 / 1.5)
                        + "L" + (pos_record[0] + 240)
                                + "," + (pos_record[1] - 140)
                        + "L" + (pos_record[0] + 240 + 7 / 1.5)
                                + "," + (pos_record[1] - 140 - 7 / 1.5)
                        + "L" + (pos_record[0] + 240 - 7 / 1.5)
                                + "," + (pos_record[1] - 140 + 7 / 1.5))
                .style("fill", "transparent")
                .style("stroke", "black")
                .style("stroke-width", 1)
                .style("opacity", 0.7)
                .on("mousemove", function () {
                    self.label_param_group.select("#label_param_mask")
                        .style("stroke", "white")
                        .style("opacity", 1)
                        .style("fill", "black");
                    self.label_param_group.select("#label_param_mask_path")
                        .style("stroke", "white")
                        .style("opacity", 1.0);
                })
                .on("mouseleave", function () {
                    self.label_param_group.select("#label_param_mask")
                        .style("stroke", "black")
                        .style("opacity", 0.7)
                        .style("fill", "transparent");
                    self.label_param_group.select("#label_param_mask_path")
                        .style("stroke", "black")
                        .style("opacity", 0.7);
                })
                .on("mousedown", function () {
                    self.chart.selectAll(".label_param").remove();
                    self.chart.selectAll(".label_item_circle").remove();
                    self.chart.selectAll(".label_item_rect").remove();
                    self.chart.selectAll(".label_item_text").remove();
                    self.chart.select("#label_param_group").remove();
                    self.label_param_group_initial_pos = [0, 0];
                    self.label_param_group_pre_transform = [0, 0];
                    self._enableLasso();
                });

            var label_items = [];
            for (var i = 0;i < self.label_names.length;i++) {
                label_items[i] = {
                    "name": self.label_names[i],
                    "index": i
                };
            }
            self.label_param_group.selectAll(".label_item_circle")
                .data(label_items)
                .enter()
                .append("circle")
                .attr("class", "label_item_circle")
                .attr("id", function (d) {
                    return "label_item_circle_" + d["index"];
                })
                .attr("cx", pos_record[0] - 30)
                .attr("cy", function (d) {
                    return  pos_record[1] - 115 + 20 * d["index"];
                })
                .attr("r", 6)
                .style("fill", function (d) {
                    if (self.focus_label_item_index.indexOf(d["index"]) != -1) {
                        return "black";
                    }
                    return "transparent";
                })
                .style("stroke", "black")
                .style("stroke-width", 1)
                .style("opacity", function (d) {
                    if (self.focus_label_item_index.indexOf(d["index"]) != -1) {
                        return 1;
                    }
                    return 0.7;
                })
                // .on("mousemove", function (d) {
                //     self.label_param_group.select("#label_item_circle_" + d["index"])
                //         .style("stroke", "white")
                //         .style("opacity", 1)
                //         .style("fill", "black");
                // })
                // .on("mouseleave", function (d) {
                //     if (self.focus_label_item_index.indexOf(d["index"]) != -1) {
                //         self.label_param_group.select("#label_item_circle_" + d["index"])
                //             .style("stroke", "black")
                //             .style("opacity", 0.7)
                //             .style("fill", "transparent");
                //     }
                // })
                .on("mousedown", function (d) {
                    if (self.focus_label_item_index.indexOf(d["index"]) != -1) {
                        self.focus_label_item_index.splice(self.focus_label_item_index.indexOf(d["index"]), 1);
                        self.label_param_group.select("#label_item_circle_" + d["index"])
                            .style("stroke", "black")
                            .style("opacity", 0.7)
                            .style("fill", "transparent");
                    }
                    else {
                        self.focus_label_item_index.push(d["index"]);
                        self.label_param_group.select("#label_item_circle_" + d["index"])
                            .style("stroke", "white")
                            .style("opacity", 1)
                            .style("fill", "black");
                    }
                });

            self.label_param_group.selectAll(".label_item_rect")
                .data(label_items)
                .enter()
                .append("rect")
                .attr("class", "label_item_rect")
                .attr("id", function (d) {
                    return "label_item_rect_" + d["index"];
                })
                .attr("x", pos_record[0] - 10)
                .attr("y", function (d) {
                    return  pos_record[1] - 121 + 20 * d["index"];
                })
                .attr("width", 30)
                .attr("height", 12)
                .style("fill", function (d) {
                    return color_manager.get_color(d["index"])
                })
                .style("stroke", "black")
                .style("stroke-width", 1)
                .style("opacity", function (d) {
                    return 0.7;
                });

            self.label_param_group.selectAll(".label_item_text")
                .data(label_items)
                .enter()
                .append("text")
                .attr("class", "label_item_text")
                .attr("id", function (d) {
                    return "label_item_text_" + d["index"];
                })
                .attr("x", pos_record[0] + 30)
                .attr("y", function (d) {
                    return  pos_record[1] - 109 + 20 * d["index"];
                })
                .text(function (d) {
                    return d["name"];
                })
                .style("user-select", "none");

            self.label_param_group.append('rect')
                .attr("class", "label_param")
                .attr("id", "ok_button")
                .attr("x", pos_record[0] + 200)
                .attr("y", pos_record[1] + 20 * self.label_names.length - 140)
                .attr("width", 40)
                .attr("height", 20)
                .style("fill", "white")
                .style("opacity", 0.5)
                .style("stroke", "black")
                .on("mousemove", function () {
                    self.label_param_group.select("#ok_button")
                        .style("fill", "black");
                    self.label_param_group.select("#ok_button_text")
                        .style("fill", "white");
                })
                .on("mouseleave", function () {
                    self.label_param_group.select("#ok_button")
                        .style("fill", "white");
                    self.label_param_group.select("#ok_button_text")
                        .style("fill", "black");
                })
                .on("mousedown", function () {
                    self.chart.selectAll(".label_param").remove();
                    self.chart.selectAll(".label_item_circle").remove();
                    self.chart.selectAll(".label_item_rect").remove();
                    self.chart.selectAll(".label_item_text").remove();
                    self.chart.select("#label_param_group").remove();
                    self.label_param_group_initial_pos = [0, 0];
                    self.label_param_group_pre_transform = [0, 0];
                    self._enableLasso();
                    self._label_filter();
                });

            self.label_param_group.append('text')
                .attr("id", "ok_button_text")
                .attr('class', 'label_param')
                .attr('x', pos_record[0] + 220)
                .attr('y',pos_record[1] + 20 * self.label_names.length - 130)
                .text("ok")
                .style("user-select", "none")
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '15px')
                .attr('font-family', 'Arial')
                .attr('text-anchor', "middle")
                .on("mousemove", function () {
                    self.label_param_group.select("#ok_button")
                        .style("fill", "black");
                    self.label_param_group.select("#ok_button_text")
                        .style("fill", "white");
                })
                .on("mouseleave", function () {
                    self.label_param_group.select("#ok_button")
                        .style("fill", "white");
                    self.label_param_group.select("#ok_button_text")
                        .style("fill", "black");
                })
                .on("mousedown", function () {
                    self.chart.selectAll(".label_param").remove();
                    self.chart.selectAll(".label_item_circle").remove();
                    self.chart.selectAll(".label_item_rect").remove();
                    self.chart.selectAll(".label_item_text").remove();
                    self.chart.select("#label_param_group").remove();
                    self.label_param_group_initial_pos = [0, 0];
                    self.label_param_group_pre_transform = [0, 0];
                    self._enableLasso();
                    self._label_filter();
                });
        },
        _label_filter:function () {
            var self = this;
            self.chart.transition()
            .duration(1000)
            .call( self.zoom.transform, d3.zoomIdentity );
            self.chart.selectAll('.dot')
                    .on("mousemove", null)
                    .on("mouseleave", null)
                    .on("mousedown", null);
            self.chart.selectAll('.dot')
                .transition()
                .duration(1000)
                .style('opacity', 0);
                // .style('stroke', "transparent");

            self.chart.selectAll('.contourPath')
                .transition()
                .duration(1000)
                .style('opacity', 0);

            self.chart.selectAll('.selected_dot')
                .transition()
                .duration(1000)
                .style('opacity', function (d) {
                    if (self.focus_label_item_index.indexOf(d.label) != -1) {
                        return 1;
                    }
                    return 0;
                });
            self.zoom_ing = true;
            setTimeout(function () {
                self.zoom_ing = false;
            }, 1000);

            var data = [];
            var seeds = [];

            var trust_item_ids = list_component.get_item_ids(),
                trust_item_seeds = [];

            for (var i = 0;i < trust_item_ids.length;i++){
                if (self.index2id.indexOf(trust_item_ids[i]) != -1) {
                    trust_item_seeds.push({
                        'id': trust_item_ids[i],
                        'level': self.data[self.id2index[trust_item_ids[i]]]['level'],
                        'pos': self.data[self.id2index[trust_item_ids[i]]]['pos'],
                        'label_entropy': self.data[self.id2index[trust_item_ids[i]]]['label_entropy']
                    });
                }
            }
            for (var i = 0;i < self.lasso_result.length;i++){
                var label = self.data[self.id2index[self.lasso_result[i]]]['label'];
                seeds.push({
                    'id': self.lasso_result[i],
                    'level': self.data[self.id2index[self.lasso_result[i]]]['level'],
                    'pos': self.data[self.id2index[self.lasso_result[i]]]['pos'],
                    'label_entropy': self.data[self.id2index[self.lasso_result[i]]]['label_entropy']
                });
                data.push({
                    'x': self.data[self.id2index[self.lasso_result[i]]]['x'],
                    'y': self.data[self.id2index[self.lasso_result[i]]]['y']
                });
            }
            var xRange = d3.extent(data, function(d){return d.x});
            var yRange = d3.extent(data, function(d){return d.y});
            if (xRange[0] == xRange[1]) {
                xRange[0] -= 10;
                xRange[1] += 10;
            }
            if (yRange[0] == yRange[1]) {
                yRange[0] -= 10;
                yRange[1] += 10;
            }
            var scale = Math.min(self.contour_width / (xRange[1] - xRange[0]),
                                    self.contour_height / (yRange[1] - yRange[0]));
            var x_begin = (self.contour_width - (xRange[1] - xRange[0]) * scale) / 2 + self.settings.margin.left;
            var y_begin = (self.contour_height - (yRange[1] - yRange[0]) * scale) / 2 + self.settings.margin.top;
            var point_x_scale = d3.scaleLinear().domain(xRange).range([x_begin, (xRange[1] - xRange[0]) * scale + x_begin]);
            var point_y_scale = d3.scaleLinear().domain(yRange).range([y_begin, (yRange[1] - yRange[0]) * scale + y_begin]);

            self.chart.selectAll('.selected_dot')
                .transition()
                .duration(1000)
                .attr('cx', function (d) {
                    return point_x_scale(d.x);
                })
                .attr('cy', function (d) {
                    return point_y_scale(d.y);
                });

            var formData = new FormData();
            formData.append("filename", JSON.stringify(processed_result[dataset_selector[0].selectedIndex]['filename']));
            formData.append("seeds", JSON.stringify(seeds));
            formData.append("labels", JSON.stringify(self.focus_label_item_index));
            formData.append("trust_item_seeds", JSON.stringify(trust_item_seeds));
            formData.append("current_state", JSON.stringify(action_trail_component.get_current_state()));


            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/label_filter', true);
            xhr.onload = function (e) {
                if (xhr.status === 200) {
                    // console.log('uploaded');
                    var response = JSON.parse(xhr.response);
                    if (self.state_index < self.state_stack.length - 1) {
                        for (var i = self.state_index + 1;i < self.state_stack.length;i++) {
                            self.state_data[self.state_stack[i]] = undefined;
                        }
                        self.state_stack.splice(self.state_index + 1,self.state_stack.length - self.state_index - 1);
                    }

                    self.state_stack.push("label-filter-" + (self.state_index + 1));
                    var id2index = {};
                    for (var i = 0;i < response['data'].length;i++){
                        id2index[response['data'][i].id] = i;
                    }
                    self.state_data["label-filter-" + (self.state_index + 1)] = {
                        'model_score_line': response['model_score_line'],
                        'data': response['data'],
                        'id_to_index': id2index
                    };
                    self._change_state(self.state_index + 1);
                } else {
                    alert('An error occurred!');
                }
            };
            xhr.send(formData);
        },
        _sampling_filter:function() {
            var self = this;
            self.chart.transition()
            .duration(1000)
            .call( self.zoom.transform, d3.zoomIdentity );
            self.chart.selectAll('.dot')
                    .on("mousemove", null)
                    .on("mouseleave", null)
                    .on("mousedown", null);
            self.chart.selectAll('.dot')
                .transition()
                .duration(1000)
                .style('opacity', 0);
                // .style('stroke', "transparent");

            self.chart.selectAll('.contourPath')
                .transition()
                .duration(1000)
                .style('opacity', 0);
            self.chart.selectAll('.selected_dot')
                .transition()
                .duration(1000)
                .style('opacity', 1);
            self.zoom_ing = true;
            setTimeout(function () {
                self.zoom_ing = false;
            }, 1000);

            var data = [];
            var trust_item_ids = list_component.get_item_ids(),
                trust_item_seeds = [];

            for (var i = 0;i < trust_item_ids.length;i++){
                if (self.index2id.indexOf(trust_item_ids[i]) != -1) {
                    trust_item_seeds.push({
                        'id': trust_item_ids[i],
                        'level': self.data[self.id2index[trust_item_ids[i]]]['level'],
                        'pos': self.data[self.id2index[trust_item_ids[i]]]['pos'],
                        'label_entropy': self.data[self.id2index[trust_item_ids[i]]]['label_entropy']
                    });
                }
            }
            var seeds = [];
            for (var i = 0;i < self.lasso_result.length;i++){
                seeds.push({
                    'id': self.lasso_result[i],
                    'level': self.data[self.id2index[self.lasso_result[i]]]['level'],
                    'pos': self.data[self.id2index[self.lasso_result[i]]]['pos'],
                    'label_entropy': self.data[self.id2index[self.lasso_result[i]]]['label_entropy']
                });
                data.push({
                    'x': self.data[self.id2index[self.lasso_result[i]]]['x'],
                    'y': self.data[self.id2index[self.lasso_result[i]]]['y']
                })
            }
            var xRange = d3.extent(data, function(d){return d.x});
            var yRange = d3.extent(data, function(d){return d.y});
            if (xRange[0] == xRange[1]) {
                xRange[0] -= 10;
                xRange[1] += 10;
            }
            if (yRange[0] == yRange[1]) {
                yRange[0] -= 10;
                yRange[1] += 10;
            }
            var scale = Math.min(self.contour_width / (xRange[1] - xRange[0]),
                                    self.contour_height / (yRange[1] - yRange[0]));
            var x_begin = (self.contour_width - (xRange[1] - xRange[0]) * scale) / 2 + self.settings.margin.left;
            var y_begin = (self.contour_height - (yRange[1] - yRange[0]) * scale) / 2 + self.settings.margin.top;
            var point_x_scale = d3.scaleLinear().domain(xRange).range([x_begin, (xRange[1] - xRange[0]) * scale + x_begin]);
            var point_y_scale = d3.scaleLinear().domain(yRange).range([y_begin, (yRange[1] - yRange[0]) * scale + y_begin]);

            self.chart.selectAll('.selected_dot')
                .transition()
                .duration(1000)
                .attr('cx', function (d) {
                    return point_x_scale(d.x);
                })
                .attr('cy', function (d) {
                    return point_y_scale(d.y);
                });

            var formData = new FormData();
            formData.append("filename", JSON.stringify(processed_result[dataset_selector[0].selectedIndex]['filename']));
            formData.append("seeds", JSON.stringify(seeds));
            formData.append("method", JSON.stringify(self.methods[self.focus_sampling_method_index]));
            var value = (self.sampling_value_bar_pre_x + 5 - self.sampling_value_bar_x_range[0])
                        / (self.sampling_value_bar_x_range[1] - self.sampling_value_bar_x_range[0]) * (self.lasso_tree_size - 2) + 1;
            formData.append("n_sample", JSON.stringify(Math.floor(value)));
            formData.append("level", JSON.stringify(self.level));
            formData.append("trust_item_seeds", JSON.stringify(trust_item_seeds));
            formData.append("current_state", JSON.stringify(action_trail_component.get_current_state()));


            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/sampling_filter', true);
            xhr.onload = function (e) {
                if (xhr.status === 200) {
                    // console.log('uploaded');
                    var response = JSON.parse(xhr.response);
                    if (self.state_index < self.state_stack.length - 1) {
                        for (var i = self.state_index + 1;i < self.state_stack.length;i++) {
                            self.state_data[self.state_stack[i]] = undefined;
                        }
                        self.state_stack.splice(self.state_index + 1,self.state_stack.length - self.state_index - 1);
                    }
                    self.state_stack.push("sampling-" + (self.state_index + 1));
                    var id2index = {};
                    for (var i = 0;i < response['data'].length;i++){
                        id2index[response['data'][i].id] = i;
                    }
                    self.state_data["sampling-" + (self.state_index + 1)] = {
                        'model_score_line': response['model_score_line'],
                        'data': response['data'],
                        'id_to_index': id2index
                    };
                    self._change_state(self.state_index + 1);
                } else {
                    alert('An error occurred!');
                }
            };
            xhr.send(formData);
        },
        _draw_model_score_selection:function () {
            var self = this;
            self.chart.on(".dragstart", null);
            self.chart.on(".drag", null);
            self.chart.on(".dragend", null);
            self.chart.selectAll(".model_score_selection_param").remove();
            self.chart.selectAll(".model_score_selection_param_value").remove();
            self.chart.selectAll(".model_score_selection_mode_circle").remove();
            self.chart.selectAll(".model_score_selection_mode_text").remove();
            self.chart.select("#model_score_selection_param_group").remove();
            self.model_score_selection_param_group = self.chart.append('g');
            self.model_score_selection_param_group.attr("#model_score_selection_param_group");
            self.focus_model_score_selection_mode_index = 0;
            var pos_record = [self.mouse_pos[0], self.mouse_pos[1]];
            self.model_score_selection_param_group.append('rect')
                .attr("class", "model_score_selection_param")
                .attr("id", "model_score_selection_param_rect")
                .attr("x", pos_record[0] - 50)
                .attr("y", pos_record[1] - 150)
                .attr("width", 300)
                .attr("height", 160)
                .style("fill", "white")
                .style("opacity", 0.5)
                .style("stroke", "black")
                .on("mousedown", function () {
                    self.model_score_selection_param_group_initial_pos[0] = self.mouse_pos[0] - self.model_score_selection_param_group_pre_transform[0];
                    self.model_score_selection_param_group_initial_pos[1] = self.mouse_pos[1] - self.model_score_selection_param_group_pre_transform[1];
                    self.model_score_selection_param_rect_drag = true;
                })
                .on("mouseup", function () {
                    self.model_score_selection_param_rect_drag = false;
                    self.label_param_group_pre_transform = [0, 0];
                });
            self.model_score_selection_param_group.append('circle')
                .attr("class", "model_score_selection_param")
                .attr("id", "model_score_selection_param_mask")
                .attr("cx", pos_record[0] + 240)
                .attr("cy", pos_record[1] - 140)
                .attr("r", 7)
                .style("fill", "transparent")
                .style("stroke", "black")
                .style("stroke-width", 1)
                .style("opacity", 0.7)
                .on("mousemove", function () {
                    self.model_score_selection_param_group.select("#model_score_selection_param_mask")
                        .style("stroke", "white")
                        .style("opacity", 1)
                        .style("fill", "black");
                    self.model_score_selection_param_group.select("#model_score_selection_param_mask_path")
                        .style("stroke", "white")
                        .style("opacity", 1.0);
                })
                .on("mouseleave", function () {
                    self.model_score_selection_param_group.select("#model_score_selection_param_mask")
                        .style("stroke", "black")
                        .style("opacity", 0.7)
                        .style("fill", "transparent");
                    self.model_score_selection_param_group.select("#model_score_selection_param_mask_path")
                        .style("stroke", "black")
                        .style("opacity", 0.7);
                })
                .on("mouseup", function () {
                    self.chart.selectAll(".model_score_selection_param").remove();
                    self.chart.selectAll(".model_score_selection_param_value").remove();
                    self.chart.selectAll(".model_score_selection_mode_circle").remove();
                    self.chart.selectAll(".model_score_selection_mode_text").remove();
                    self.chart.select("#model_score_selection_param_group").remove();

                    self.model_score_selection_param_group_initial_pos = [0, 0];
                    self.model_score_selection_param_group_pre_transform = [0, 0];
                    self._enableLasso();
                    self._updateClickMenu();
                });
            self.model_score_selection_param_group.append('path')
                .attr("class", "model_score_selection_param")
                .attr("id", "model_score_selection_param_mask_path")
                .attr("d", "M" + (pos_record[0] + 240 - 7 / 1.5)
                                + "," + (pos_record[1] - 140 - 7 / 1.5)
                        + "L" + (pos_record[0] + 240 + 7 / 1.5)
                                + "," + (pos_record[1] - 140 + 7 / 1.5)
                        + "L" + (pos_record[0] + 240)
                                + "," + (pos_record[1] - 140)
                        + "L" + (pos_record[0] + 240 + 7 / 1.5)
                                + "," + (pos_record[1] - 140 - 7 / 1.5)
                        + "L" + (pos_record[0] + 240 - 7 / 1.5)
                                + "," + (pos_record[1] - 140 + 7 / 1.5))
                .style("fill", "transparent")
                .style("stroke", "black")
                .style("stroke-width", 1)
                .style("opacity", 0.7)
                .on("mousemove", function () {
                    self.model_score_selection_param_group.select("#model_score_selection_param_mask")
                        .style("stroke", "white")
                        .style("opacity", 1)
                        .style("fill", "black");
                    self.model_score_selection_param_group.select("#model_score_selection_param_mask_path")
                        .style("stroke", "white")
                        .style("opacity", 1.0);
                })
                .on("mouseleave", function () {
                    self.model_score_selection_param_group.select("#model_score_selection_param_mask")
                        .style("stroke", "black")
                        .style("opacity", 0.7)
                        .style("fill", "transparent");
                    self.model_score_selection_param_group.select("#model_score_selection_param_mask_path")
                        .style("stroke", "black")
                        .style("opacity", 0.7);
                })
                .on("mouseup", function () {
                    self.chart.selectAll(".model_score_selection_param").remove();
                    self.chart.selectAll(".model_score_selection_param_value").remove();
                    self.chart.selectAll(".model_score_selection_mode_circle").remove();
                    self.chart.selectAll(".model_score_selection_mode_text").remove();
                    self.chart.select("#model_score_selection_param_group").remove();
                    self.model_score_selection_param_group_initial_pos = [0, 0];
                    self.model_score_selection_param_group_pre_transform = [0, 0];
                    self._enableLasso();
                    self._updateClickMenu();
                });

            var model_score_selection_modes = [];
            var modes = ["replace", "add"];
            for (var i = 0;i < modes.length;i++) {
                model_score_selection_modes[i] = {
                    "mode": modes[i],
                    "index": i
                };
            }
            self.model_score_selection_param_group.selectAll(".model_score_selection_mode_circle")
                .data(model_score_selection_modes)
                .enter()
                .append("circle")
                .attr("class", "model_score_selection_mode_circle")
                .attr("id", function (d) {
                    return "model_score_selection_mode_" + d["index"];
                })
                .attr("cx", pos_record[0] - 30)
                .attr("cy", function (d) {
                    return  pos_record[1] - 115 + 30 * d["index"];
                })
                .attr("r", 6)
                .style("fill", function (d) {
                    if (d["index"] == self.focus_model_score_selection_mode_index) {
                        return "black";
                    }
                    return "transparent";
                })
                .style("stroke", "black")
                .style("stroke-width", 1)
                .style("opacity", function (d) {
                    if (d["index"] == self.focus_model_score_selection_mode_index) {
                        return 1;
                    }
                    return 0.7;
                })
                // .on("mousemove", function (d) {
                //     self.model_score_selection_param_group.select("#model_score_selection_mode_" + d["index"])
                //         .style("stroke", "white")
                //         .style("opacity", 1)
                //         .style("fill", "black");
                // })
                // .on("mouseleave", function (d) {
                //     if (d["index"] != self.focus_model_score_selection_mode_index) {
                //         self.model_score_selection_param_group.select("#model_score_selection_mode_" + d["index"])
                //             .style("stroke", "black")
                //             .style("opacity", 0.7)
                //             .style("fill", "transparent");
                //     }
                // })
                .on("mousedown", function (d) {
                    self.model_score_selection_param_group.select("#model_score_selection_mode_" + self.focus_model_score_selection_mode_index)
                        .style("stroke", "black")
                        .style("opacity", 0.7)
                        .style("fill", "transparent");
                    self.focus_model_score_selection_mode_index = d["index"];
                    self.model_score_selection_param_group.select("#model_score_selection_mode_" + d["index"])
                        .style("stroke", "white")
                        .style("opacity", 1)
                        .style("fill", "black");
                });
            self.model_score_selection_param_group.selectAll(".model_score_selection_mode_text")
                .data(model_score_selection_modes)
                .enter()
                .append("text")
                .attr("class", "model_score_selection_mode_text")
                .attr("id", function (d) {
                    return "model_score_selection_mode_text_" + d["index"];
                })
                .attr("x", pos_record[0])
                .attr("y", function (d) {
                    return  pos_record[1] - 109 + 30 * d["index"];
                })
                .text(function (d) {
                    return d["mode"];
                })
                .style("user-select", "none");

            // self.model_score_selection_param_group.append("path")
            //     .attr("class", "model_score_selection_param")
            //     .attr("id", "model_score_selection_sample_num_line")
            //     .attr("d", "M" + pos_record[0]
            //                     + "," + (pos_record[1] - 40)
            //             + "L" + (pos_record[0] + 200)
            //                     + "," + (pos_record[1] - 40))
            //     .style("fill", "black")
            //     .style("stroke", "black")
            //     .style("stroke-width", 3)
            //     .style("opacity", 1);

            self.model_score_values = [{
                "index": 0,
                "value": 0
            }, {
                "index": 1,
                "value": 0
            }];
            if (self.data_count() > 0) {
                var range = d3.extent(self.data, function(d){return d.model_score;});
                self.model_score_values[0]["value"] = range[0];
                self.model_score_values[1]["value"] = range[1];
            }
            var value = (self.model_score_values[0]["value"] + self.model_score_values[1]["value"]) / 2;

            self._update_lasso_result_by_model_score(value);

            self.model_score_selection_param_group.selectAll(".model_score_selection_param_value")
                .data(self.model_score_values)
                .enter()
                .append("text")
                .style("user-select", "none")
                .attr("class", "model_score_selection_param_value")
                .attr("id", function (d) {
                    return "model_score_selection_param_value_" + d["index"];
                })
                .attr("x", function (d) {
                    if (d["index"] == 0) {
                        return pos_record[0] - 25;
                    }
                    return pos_record[0] + 225;
                })
                .attr("y", pos_record[1] - 40)
                .text(function (d) {
                    return d["value"].toExponential(2);
                })
                .style("user-select", "none")
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '15px')
                .attr('font-family', 'Arial')
                .attr('text-anchor', "middle");

            self.model_score_selection_value_bar_pre_x = pos_record[0] + 200 * (value - self.model_score_values[0]["value"]) / (self.model_score_values[1]["value"] - self.model_score_values[0]["value"]);
            self.model_score_selection_value_bar_x_range[0] = pos_record[0];
            self.model_score_selection_value_bar_x_range[1] = pos_record[0] + 200;
            self.model_score_selection_param_group.append('rect')
                .attr("class", "model_score_selection_param")
                .attr("id", "model_score_selection_param_value_rect")
                .attr("x", self.model_score_selection_value_bar_pre_x)
                .attr("y", pos_record[1] - 50)
                .attr("width", 10)
                .attr("height", 20)
                .style("fill", "white")
                .style("opacity", 0.5)
                .style("stroke", "black")
                .on("mousemove", function () {
                    self.model_score_selection_param_group.select("#model_score_selection_param_value_rect")
                        .style("fill", "black");
                })
                .on("mouseleave", function () {
                    self.model_score_selection_param_group.select("#model_score_selection_param_value_rect")
                        .style("fill", "white")
                })
                .on("mousedown", function () {
                    self.model_score_selection_value_bar_initial_x = self.mouse_pos[0] - self.model_score_selection_value_bar_pre_x;
                    self.model_score_selection_param_button_drag = true;
                })
                .on("mouseup", function () {
                    self.model_score_selection_param_button_drag = false;
                });

            self.model_score_selection_param_group.append('text')
                .attr("id", "model_score_selection_param_value_text")
                .attr('class', 'model_score_selection_param')
                .attr('x', self.model_score_selection_value_bar_pre_x + 5)
                .attr('y',pos_record[1] - 60)
                .text(value.toExponential(2))
                .style("user-select", "none")
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '15px')
                .attr('font-family', 'Arial')
                .attr('text-anchor', "middle");
        },
        _update_lasso_result_by_model_score:function(value) {
            var self = this;
            var new_lasso_result = [];
            for (var i = 0;i < self.data_count();i++) {
                if (self.data[i]["model_score"] >= value) {
                    new_lasso_result.push(self.data[i]['id']);
                }
            }
            for (var i = 0;i < self.lasso_result.length;i++) {
                self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                        if (d.model_score >= self.model_score_line) {
                            return dot_size[2] * self.zoom_scale;
                        }
                        return dot_size[0] * self.zoom_scale;
                    });
            }
            if (self.focus_model_score_selection_mode_index == 0) {
                self.lasso_result = new_lasso_result;
            }
            else {
                var temp_lasso_result = self.lasso_result;
                self.lasso_result = [];
                temp_lasso_result.sort(function(a, b){return a - b;});
                new_lasso_result.sort(function(a, b){return a - b;});
                for (var i = 0, j = 0;;i++, j++) {
                    if (i < temp_lasso_result.length && j < new_lasso_result.length) {
                        if (temp_lasso_result[i] == new_lasso_result[j]) {
                            self.lasso_result.push(new_lasso_result[j]);
                        }
                        else if (temp_lasso_result[i] < new_lasso_result[j]) {
                            self.lasso_result.push(temp_lasso_result[i]);
                            j--;
                        }
                        else {
                            self.lasso_result.push(new_lasso_result[j]);
                            i--;
                        }
                    }
                    else if (i < temp_lasso_result.length) {
                        self.lasso_result.push(temp_lasso_result[i]);
                    }
                    else if (j < new_lasso_result.length) {
                        self.lasso_result.push(new_lasso_result[j]);
                    }
                    else {
                        break;
                    }
                }
            }
            self._update_item_recomendation_param();
            self._update_show_mode_switch();
            self.lasso.set_selected_index(self.lasso_result);

            self.lasso_tree_size = 0;
            self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
            for (var i = 0;i < self.lasso_result.length;i++) {
                self.lasso_tree_size += self.data[self.id2index[self.lasso_result[i]]]['tree_size'];
                self.chart.select("#dot-" + self.lasso_result[i]).classed("selected_dot", true).attr('r', function(d) {
                        if (d.model_score >= self.model_score_line) {
                            return dot_size[2] * self.zoom_scale;
                        }
                        return dot_size[2] * self.zoom_scale;
                    });
            }
            self._updateClickMenu();
        },
        _updateClickMenu:function(){
            var self = this;
            var menu = [];
            if (self.level < self.max_level && self.lasso_result.length > 0) {
                var zoom_menu = {
                    title: 'zoom in',
                    name: 'zoom in',
                    fun:function(){
                        var b = self.settings.clickMenu.find(function(d){return d["title"] == "zoom in";});
                        if (b == undefined) {
                            return;
                        }
                        self._zoom_in_level();
                    }
                };
                menu.push(zoom_menu);
            }
            if (self.lasso_result.length > 0) {
                var label_menu = {
                    title: 'label',
                    name: 'label',
                    subMenu: [{
                        title: 'change label',
                        name: 'change label',
                        subMenu: []
                    }, {
                        title: 'new label',
                        name: 'new label'
                    }]
                };
                self.label_names.forEach(function(d){
                    var sm = {
                            title:d,
                            name:d,
                            fun:function(){
                                var b = self.settings.clickMenu.find(function(d){return d["title"] == "label";});
                                if (b == undefined) {
                                    return;
                                }
                                self._changeItemLabels(self.label_names.indexOf(d));
                            }
                        };
                        label_menu.subMenu[0].subMenu.push(sm);
                    });
                label_menu.subMenu[1].fun = function(){
                    for (var i = self.label_names.length;;i++) {
                        if(self.label_names.indexOf("label-" + i) == -1) {
                            self.label_names.push("label-" + i);
                            self._changeItemLabels(self.label_names.length - 1);
                            self._drawLegend();
                            self._updateClickMenu();
                            break;
                        }
                    }
                };
                menu.push(label_menu);
                var filter_menu = {
                    title: 'filter',
                    name: 'filter',
                    subMenu: [{
                        title: 'sampling filter',
                        name: 'sampling filter',
                        fun: function(){
                            var b = self.settings.clickMenu.find(function(d){return d["title"] == "filter";});
                            if (b == undefined) {
                                return;
                            }
                            self._draw_sampling_filter();
                            self._draw_state_stack();
                        }
                    }, {
                        title: 'label filter',
                        name: 'label filter',
                        fun: function(){
                            var b = self.settings.clickMenu.find(function(d){return d["title"] == "filter";});
                            if (b == undefined) {
                                return;
                            }
                            self._draw_label_filter();
                            self._draw_state_stack();
                        }
                    }]
                };
                menu.push(filter_menu);
                var add_to_trust_item_menu = {
                        title: 'add to trust item',
                        name: 'add to trust item',
                        fun: function(){
                            var b = self.settings.clickMenu.find(function(d){return d["title"] == "add to trust item";});
                            if (b == undefined) {
                                return;
                            }
                            var change_points = [];
                            for (var i = 0;i < self.lasso_result.length;i++) {
                                change_points[i] = {
                                    "id": self.lasso_result[i],
                                    "label": self.data[self.id2index[self.lasso_result[i]]]['label']
                                }
                            }
                            list_component.change_point(change_points);
                        }
                    };
                menu.push(add_to_trust_item_menu);
            }
            if (self.data_count() > 0 && false) {
                var model_score_selection_menu = {
                    title: 'select by model score',
                    name: 'select by model score',
                    fun: function(){
                        var b = self.settings.clickMenu.find(function(d){return d["title"] == "select by model score";});
                        if (b == undefined) {
                            return;
                        }
                        self._draw_model_score_selection();
                    }
                };
                menu.push(model_score_selection_menu);
            }

            self.settings.clickMenu = menu;
            // $('#plotView').contextMenu(self.settings.clickMenu,self.settings.clickMenuSettings);
        },
        _add_selected_item_to_trusted_item: function () {
            var self = this;
            var change_points = [];
            for (var i = 0;i < self.lasso_result.length;i++) {
                change_points[i] = {
                    "id": self.lasso_result[i],
                    "label": self.data[self.id2index[self.lasso_result[i]]]['label']
                }
            }
            list_component.change_point(change_points);
            self._set_lasso_result([]);
        },
        _update_dot_info: function(id){
            var self = this;
            var scale = 1.5;
            self.chart.selectAll('.dot-info-background').remove();
            self.chart.selectAll('.dot-info-attr-name').remove();
            self.chart.selectAll('.dot-info-attr-value').remove();
            self.chart.selectAll('.dot-info-image').remove();
            if (id == -1) {
                return;
            }
            var data = deep_copy(self.data.find(function(d){return d.id == id;}));
            if (data == undefined) {
                return;
            }
            data.label = self.label_names[data.label];
            var text_data = [], count = 0;
            for (var attr in data) {
                if(attr == 'id' || attr == 'label' || attr == 'label1'){
                    if (attr == 'label1') {
                        var res = {
                            key: 'from ' + data['label_name'],
                            value: 'to ' + self.label_names[data['label1']],
                            x: 10,
                            y: 25 * count + 200 * scale
                        };
                    }
                    else {
                        var res = {
                            key: attr,
                            value: data[attr],
                            x: 10,
                            y: 25 * count + 200 * scale
                        };
                        if (typeof(data[attr]) == 'number' && attr != 'id') {
                            res['value'] = data[attr].toFixed(2);
                        }
                        if (typeof (data[attr]) == 'string' && data[attr].length > 7) {
                            res['value'] = res['value'].slice(0, 5) + '..';
                        }
                    }
                    text_data.push(res);
                }
                else {
                    continue;
                }
                count++;
            }
            var width = 200 * scale, height = count * 25 + 210 * scale;

            self.chart.append('rect')
                        .attr('class', 'dot-info-background')
                        .attr('id', 'dot-info-background-rect-mask')
                        .attr('width', width)
                        .attr('height', height)
                        .attr('x', self.chart_width - width - 10)
                        .attr('y', self.chart_height - height - 10)
                        .style('fill', 'white')
                        .style('stroke', 'black')
                        .style('opacity', 0.7)
                        .on("mouseleave", function () {
                            self.chart.selectAll('.dot-info-background').remove();
                            self.chart.selectAll('.dot-info-attr-name').remove();
                            self.chart.selectAll('.dot-info-attr-value').remove();
                            self.chart.selectAll('.dot-info-image').remove();
                        });
            var url = "/api/get_image?dataset=" + processed_result[dataset_selector[0].selectedIndex]['filename']
                        + "&data_id=" + id;
            self.chart.append("image")
                .attr("class", "dot-info-image")
                .attr("x", self.chart_width - width + 5)
                .attr("y", self.chart_height - height + 5)
                .attr("width", 170 * scale)
                .attr("height", 170 * scale)
                .attr("xlink:href", url)
                .style("user-select", "none")
                .attr('text-anchor', "middle")
                .attr('dominant-baseline', "middle")
                .style("border", "1px solid black");
            text_data.forEach(function(d){
                d.x += self.chart_width - width;
                d.y += self.chart_height - height;
            });
            var infos = self.chart.selectAll('.dot-info-attr-name')
                            .data(text_data);
            infos.enter().append('text')
                            .attr('class', 'dot-info-attr-name')
                            .attr('x', function(d){return d.x;})
                            .attr('y',function(d){return d.y;})
                            .text(function(d){return d.key;})
                            .style("user-select", "none")
                            .attr('dominant-baseline', 'middle')
                            .attr('font-size', '16px')
                            .attr('font-family', 'Arial');
            infos = self.chart.selectAll('.dot-info-attr-value')
                            .data(text_data);
            infos.enter().append('text')
                            .attr('class', 'dot-info-attr-value')
                            .attr('x', function(d){return d.x + 110 * scale;})
                            .attr('y',function(d){return d.y;})
                            .text(function(d){return d.value;})
                            .style("user-select", "none")
                            .attr('dominant-baseline', 'middle')
                            .attr('font-size', '16px')
                            .attr('font-family', 'Arial');
            self.chart.append('rect')
                        .attr('class', 'dot-info-background')
                        .attr('id', 'dot-info-background-rect')
                        .attr('width', width)
                        .attr('height', height)
                        .attr('x', self.chart_width - width - 10)
                        .attr('y', self.chart_height - height - 10)
                        .style('fill', 'transparent')
                        .style('stroke', 'black')
                        .style('opacity', 0.7)
                        .on("mouseleave", function () {
                            self.chart.selectAll('.dot-info-background').remove();
                            self.chart.selectAll('.dot-info-attr-name').remove();
                            self.chart.selectAll('.dot-info-attr-value').remove();
                            self.chart.selectAll('.dot-info-image').remove();
                        });
        },
        _reset: function () {
            var self = this;
            self.chart.transition()
            .duration(1000)
            .call( self.zoom.transform, d3.zoomIdentity ); // updated for d3 v4
            self.lasso_result = [];
            self._update_item_recomendation_param();
            self._update_show_mode_switch();
            self.lasso_tree_size = 0;
            self._updateClickMenu();
            self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
            if (self.lasso != undefined) {
                self.lasso.clear();
            }
            self.highlight_index = [];
            self.contour_map_dot.selectAll('.dot')
                .attr('r', function(d){
                    if (d.model_score >= self.model_score_line) {
                        return dot_size[1] * self.zoom_scale;
                    }
                    return dot_size[0] * self.zoom_scale;
                })
                // .style('stroke', 'white')
                .style('opacity', 0.7);

            // self._generate_chart(true);
        },
        _set_lasso_result: function (lasso_result) {
            var self = this;
            self.lasso_result = [];
            for (var i = 0;i < lasso_result.length;i++) {
                var index_i = self.id2index[lasso_result[i]];
                if (index_i == undefined) {
                    continue;
                }
                self.lasso_result.push(lasso_result[i])
            }
            self._update_item_recomendation_param();
            self._update_show_mode_switch();
            self.lasso_tree_size = 0;
            self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
            self.contour_map_dot.selectAll('.dot')
                .attr('r', function(d){
                    if (d.model_score >= self.model_score_line) {
                        return dot_size[1] * self.zoom_scale;
                    }
                    return dot_size[0] * self.zoom_scale;
                })
                // .style('stroke', 'white')
                .style('opacity', 0.7);
            for (var i = 0;i < self.lasso_result.length;i++) {
                var index_i = self.id2index[self.lasso_result[i]];
                self.lasso_tree_size += self.data[index_i]['tree_size'];
                self.chart.select("#dot-" + self.lasso_result[i]).classed("selected_dot", true)
                    .attr('r', function(d) {
                        if (d.model_score >= self.model_score_line) {
                            return dot_size[2] * self.zoom_scale;
                        }
                        return dot_size[2] * self.zoom_scale;
                    })
                    // .style('stroke', '#000000')
                    .style('opacity', 1);
            }
            self.lasso.set_selected_index(self.lasso_result);
            self.lasso.set_zoom_scale(self.zoom_scale);
            self._updateClickMenu();
        },
        _get_lasso_result: function () {
            var self = this;
            return self.lasso_result;
        },
        _get_label_names: function () {
            var self = this;
            return self.label_names;
        },
        _export_label: function () {
            var self = this;
            var formData = new FormData();
            formData.append("filename", JSON.stringify(processed_result[dataset_selector[0].selectedIndex]['filename']));

            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/get_label', true);
            xhr.onload = function (e) {
                if (xhr.status === 200) {
                    var data = JSON.parse(xhr.response);
                    var text = data['label'].join('\n');
                    var filename = '{0}-{1}-label.txt'.format(selector_value(), self.data_count());
                    var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
                    saveAs(blob, filename);
                    text = data['label_names'].join('\n');
                    filename = '{0}-{1}-label_names.txt'.format(selector_value(), self.data_count());
                    blob = new Blob([text], {type: "text/plain;charset=utf-8"});
                    saveAs(blob, filename);
                } else {
                    alert('An error occurred!');
                }
            };
            xhr.send(formData);
        },
        _generate_chart:function(scaling){
            var self = this;
            var data = self.data;
            self.lasso_result = [];
            self._update_item_recomendation_param();
            self._update_show_mode_switch();
            self.lasso_tree_size = 0;
            self._updateClickMenu();

            if (data.length == 0) {
                return;
            }

            var pos_record = [self.chart_width - 656, 22];
            self.chart.selectAll('.model_score_selection').remove();
            // self.chart.append("path")
            //     .attr("class", "model_score_selection")
            //     .attr("id", "model_score_selection_sample_num_line")
            //     .attr("d", "M" + (pos_record[0] + 200)
            //                     + "," + pos_record[1]
            //             + "L" + (pos_record[0] + 400)
            //                     + "," + pos_record[1])
            //     .style("fill", "black")
            //     .style("stroke", "black")
            //     .style("stroke-width", 3)
            //     .style("opacity", 1);

            self.model_score_values = [{
                "index": 0,
                "value": 0
            }, {
                "index": 1,
                "value": 0
            }];
            if (self.data_count() > 0) {
                var range = d3.extent(self.data, function(d){return d.model_score;});
                self.model_score_values[0]["value"] = range[0];
                self.model_score_values[1]["value"] = range[1];
            }
            var value = self.model_score_values[1]["value"];

            // self._update_lasso_result_by_model_score(value);

            // self.chart.selectAll(".model_score_selection_text").remove();
            // self.chart.append('text')
            //     .attr('class', 'model_score_selection_text')
            //     .attr('id', 'model_score_selection_text_name')
            //     .attr('x', pos_record[0])
            //     .attr('y', pos_record[1])
            //     .text('Select by model score:')
            //     .style("user-select", "none")
            //     .attr('dominant-baseline', 'middle')
            //     .attr('font-size', '14px')
            //     .attr('font-family', 'Arial')
            //     .style('fill', 'black');
            // self.chart.selectAll(".model_score_selection_value")
            //     .data(self.model_score_values)
            //     .enter()
            //     .append("text")
            //     .style("user-select", "none")
            //     .attr("class", "model_score_selection_value")
            //     .attr("id", function (d) {
            //         return "model_score_selection_value_" + d["index"];
            //     })
            //     .attr("x", function (d) {
            //         if (d["index"] == 0) {
            //             return pos_record[0] + 171;
            //         }
            //         return pos_record[0] + 444;
            //     })
            //     .attr("y", pos_record[1])
            //     .text(function (d) {
            //         return d["value"].toExponential(2);
            //     })
            //     .style("user-select", "none")
            //     .attr('dominant-baseline', 'middle')
            //     .attr('font-size', '15px')
            //     .attr('font-family', 'Arial')
            //     .attr('text-anchor', "middle");
            // self.model_score_selection_value_bar_pre_x = pos_record[0] + 200 + 200 * (value - self.model_score_values[0]["value"]) / (self.model_score_values[1]["value"] - self.model_score_values[0]["value"]);
            // self.model_score_selection_value_bar_x_range[0] = pos_record[0] + 200;
            // self.model_score_selection_value_bar_x_range[1] = pos_record[0] + 400;
            // self.chart.append('rect')
            //     .attr("class", "model_score_selection")
            //     .attr("id", "model_score_selection_value_rect")
            //     .attr("x", self.model_score_selection_value_bar_pre_x)
            //     .attr("y", pos_record[1] - 10)
            //     .attr("width", 10)
            //     .attr("height", 20)
            //     .style("fill", "white")
            //     .style("opacity", 0.5)
            //     .style("stroke", "black")
            //     .on("mousemove", function () {
            //         self.chart.select("#model_score_selection_value_rect")
            //             .style("fill", "black");
            //     })
            //     .on("mouseleave", function () {
            //         self.chart.select("#model_score_selection_value_rect")
            //             .style("fill", "white")
            //     })
            //     .on("mousedown", function () {
            //         self.model_score_selection_value_bar_initial_x = self.mouse_pos[0] - self.model_score_selection_value_bar_pre_x;
            //         self.model_score_selection_button_drag = true;
            //         self.chart.on(".dragstart", null);
            //         self.chart.on(".drag", null);
            //         self.chart.on(".dragend", null);
            //     })
            //     .on("mouseup", function () {
            //         self.model_score_selection_button_drag = false;
            //         self._enableLasso();
            //     });
            //
            // self.chart.append('text')
            //     .attr("id", "model_score_selection_value_text")
            //     .attr('class', 'model_score_selection')
            //     .attr('x', self.model_score_selection_value_bar_pre_x + 5)
            //     .attr('y', pos_record[1] + 20)
            //     .text(value.toExponential(2))
            //     .style("user-select", "none")
            //     .attr('dominant-baseline', 'middle')
            //     .attr('font-size', '15px')
            //     .attr('font-family', 'Arial')
            //     .attr('text-anchor', "middle");

            // self.chart.selectAll('.control-button').remove();
            // self.chart.append('rect')
            //     .attr('class', 'control-button')
            //     .attr('id', 'reset-button')
            //     .attr('width', 46)
            //     .attr('height', 24)
            //     .attr('x', self.chart_width - 56)
            //     .attr('y', 10)
            //     .attr('ry', 5)
            //     .attr('ry', 5)
            //     .style('fill', 'transparent')
            //     .style('stroke', 'black')
            //     .style('opacity', 0.7)
            //     .on("mousemove", function () {
            //         d3.select('#reset-button').style('opacity', 1).style('fill', '#868E96');
            //         d3.select('#reset-button-text').style('opacity', 1).style('fill', 'white');
            //     })
            //     .on("mouseleave", function () {
            //         d3.select('#reset-button').style('opacity', 0.7).style('fill', 'transparent');
            //         d3.select('#reset-button-text').style('opacity', 0.7).style('fill', 'black');
            //     })
            //     .on("mousedown", function () {
            //         self._reset();
            //     });
            //
            // self.chart.append('text')
            //     .attr('class', 'control-button')
            //     .attr('id', 'reset-button-text')
            //     .attr('x', self.chart_width - 49)
            //     .attr('y', 22)
            //     .text('reset')
            //     .style("user-select", "none")
            //     .attr('dominant-baseline', 'middle')
            //     .attr('font-size', '14px')
            //     .attr('font-family', 'Arial')
            //     .style('opacity', 0.7)
            //     .style('fill', 'black')
            //     .on("mousemove", function () {
            //         d3.select('#reset-button').style('opacity', 1).style('fill', '#868E96');
            //         d3.select('#reset-button-text').style('opacity', 1).style('fill', 'white');
            //     })
            //     .on("mouseleave", function () {
            //         d3.select('#reset-button').style('opacity', 0.7).style('fill', 'transparent');
            //         d3.select('#reset-button-text').style('opacity', 0.7).style('fill', 'black');
            //     })
            //     .on("mousedown", function () {
            //         self._reset();
            //     });
            //
            // self.chart.append('rect')
            //     .attr('class', 'control-button')
            //     .attr('id', 'export-label-button')
            //     .attr('width', 86)
            //     .attr('height', 24)
            //     .attr('x', self.chart_width - 157)
            //     .attr('y', 10)
            //     .attr('ry', 5)
            //     .attr('ry', 5)
            //     .style('fill', 'transparent')
            //     .style('stroke', 'black')
            //     .style('opacity', 0.7)
            //     .on("mousemove", function () {
            //         d3.select('#export-label-button').style('opacity', 1).style('fill', '#868E96');
            //         d3.select('#export-label-button-text').style('opacity', 1).style('fill', 'white');
            //     })
            //     .on("mouseleave", function () {
            //         d3.select('#export-label-button').style('opacity', 0.7).style('fill', 'transparent');
            //         d3.select('#export-label-button-text').style('opacity', 0.7).style('fill', 'black');
            //     })
            //     .on("mousedown", function () {
            //         self._export_label();
            //     });
            //
            // self.chart.append('text')
            //     .attr('class', 'control-button')
            //     .attr('id', 'export-label-button-text')
            //     .attr('x', self.chart_width - 150)
            //     .attr('y', 22)
            //     .text('export label')
            //     .style("user-select", "none")
            //     .attr('dominant-baseline', 'middle')
            //     .attr('font-size', '14px')
            //     .attr('font-family', 'Arial')
            //     .style('opacity', 0.7)
            //     .style('fill', 'black')
            //     .on("mousemove", function () {
            //         d3.select('#export-label-button').style('opacity', 1).style('fill', '#868E96');
            //         d3.select('#export-label-button-text').style('opacity', 1).style('fill', 'white');
            //     })
            //     .on("mouseleave", function () {
            //         d3.select('#export-label-button').style('opacity', 0.7).style('fill', 'transparent');
            //         d3.select('#export-label-button-text').style('opacity', 0.7).style('fill', 'black');
            //     })
            //     .on("mousedown", function () {
            //         self._export_label();
            //     });

            self._updateClickMenu();
            var xRange = d3.extent(self.data, function(d){return d.pos[0]});
            var yRange = d3.extent(self.data, function(d){return d.pos[1]});
            var scale = Math.min(self.contour_width / (xRange[1] - xRange[0]),
                                    self.contour_height / (yRange[1] - yRange[0]));
            var bandwidth_scale = Math.min(self.contour_width / 300,
                                    self.contour_height / 200);

            var bandwidthRange = d3.extent(self.data, function(d){return d['bandwidth']});
            if (bandwidthRange[0] * bandwidth_scale < 8) {
                bandwidth_scale = 8 / bandwidthRange[0];
            }
            if (scaling) {
                self.point_x_scale = d3.scaleLinear().domain(xRange).range([self.settings.margin.left, (xRange[1] - xRange[0]) * scale + self.settings.margin.left]);
                self.point_y_scale = d3.scaleLinear().domain(yRange).range([(yRange[1] - yRange[0]) * scale + self.settings.margin.top, self.settings.margin.top]);
                self.point_x_reverse_scale = d3.scaleLinear().domain([self.settings.margin.left, (xRange[1] - xRange[0]) * scale + self.settings.margin.left]).range(xRange);
                self.point_y_reverse_scale = d3.scaleLinear().domain([(yRange[1] - yRange[0]) * scale + self.settings.margin.top, self.settings.margin.top]).range(yRange);
            }



            data.forEach(function(d){
                d.x = self.point_x_scale(d.pos[0]);
                d.y = self.point_y_scale(d.pos[1]);
                d.weight = 10.0 / (d.label_entropy + 1);
            });
            var  contour = d3.contourDensity()
                            .x(function (d) {
                                return d.x;
                            })
                            .y(function (d) {
                                return d.y;
                            })
                            .weight(function (d) {
                                return d.weight;
                            })
                            .size([3000, 3000])
                            .bandwidth(function (d) {
                                return d.bandwidth * bandwidth_scale;
                            });

            contour(data);
            var max_density_value = 0;
            contour.density_values().forEach(function(d){
                if (max_density_value < d){
                    max_density_value = d;
                }
            });

            var thresholds = [];

            var ratios= self.settings.contourRatios;

            for (var i = 0; i < ratios.length; i++) {
                if (i == 0) {
                    thresholds.push(max_density_value * ratios[i] * self.thresholds_scale);
                }
                else {
                    thresholds.push(max_density_value * ratios[i]);
                }
            }

            var contourTh = d3.contourDensity()
                                .x(function (d) {
                                    return d.x;
                                })
                                .y(function (d) {
                                    return d.y;
                                })
                                .weight(function (d) {
                                    return d.weight;
                                })
                                .size([3000, 3000])
                                .bandwidth(function (d) {
                                    return d.bandwidth * bandwidth_scale;
                                })
                                .thresholds(thresholds);
            var contourData = contourTh(data);
            var length = contourData[0]["coordinates"].length + 1;
            while(contourData[0]["coordinates"].length > 1) {
                if (contourData[0]["coordinates"].length >= length) {
                    break;
                }
                length = contourData[0]["coordinates"].length;
                if (contourData[0]["coordinates"].length > 5) {
                    self.thresholds_scale *= 0.5;
                }
                else {
                    self.thresholds_scale *= 0.8;
                }
                thresholds[0] = max_density_value * ratios[0] * self.thresholds_scale;

                contourTh = d3.contourDensity()
                                    .x(function (d) {
                                        return d.x;
                                    })
                                    .y(function (d) {
                                        return d.y;
                                    })
                                    .weight(function (d) {
                                        return d.weight;
                                    })
                                    .size([3000, 3000])
                                    .bandwidth(function (d) {
                                        return d.bandwidth * bandwidth_scale;
                                    })
                                    .thresholds(thresholds);
                contourData = contourTh(data);
            }
            self.state_data[self.state_stack[self.state_index]]['thresholds_scale'] = self.thresholds_scale;
            self.data['thresholds_scale'] = self.thresholds_scale;

            for (var i = 0;i < contourData.length;i++) {
                contourData[i].id = i;
            }

            var x_range = [self.settings.margin.left, (xRange[1] - xRange[0]) * scale + self.settings.margin.left],
                y_range = [self.settings.margin.top, (yRange[1] - yRange[0]) * scale + self.settings.margin.top];

            for (var i = 0;i < contourData[0]["coordinates"].length;i++) {
                var coordinate = contourData[0]["coordinates"][i][0];
                for (var j in coordinate) {
                    if (coordinate[j][0] < x_range[0]) {
                        x_range[0] = coordinate[j][0];
                    }
                    if (coordinate[j][0] > x_range[1]) {
                        x_range[1] = coordinate[j][0];
                    }
                    if (coordinate[j][1] < y_range[0]) {
                        y_range[0] = coordinate[j][1];
                    }
                    if (coordinate[j][1] > y_range[1]) {
                        y_range[1] = coordinate[j][1];
                    }
                }
            }
            scale = Math.min(self.chart_width / (x_range[1] - x_range[0]),
                                    self.chart_height / (y_range[1] - y_range[0]));
            if (scaling){
                var x_begin = (self.chart_width - (x_range[1] - x_range[0]) * scale) / 2 - self.settings.margin.left;
                var y_begin = (self.chart_height - (y_range[1] - y_range[0]) * scale) / 2 - self.settings.margin.top;
                self.contour_x_scale = d3.scaleLinear().domain(x_range).range([x_begin, x_begin + (x_range[1] - x_range[0]) * scale]);
                self.contour_y_scale = d3.scaleLinear().domain(y_range).range([y_begin, y_begin + (y_range[1] - y_range[0]) * scale]);
                self.contour_x_reverse_scale = d3.scaleLinear().domain([x_begin, x_begin + (x_range[1] - x_range[0]) * scale]).range(x_range);
                self.contour_y_reverse_scale = d3.scaleLinear().domain([y_begin, y_begin + (y_range[1] - y_range[0]) * scale]).range(y_range);
            }

            var x_r = [Infinity, -Infinity], y_r = [Infinity, -Infinity];
            for (var i in contourData) {
                var coordinates = contourData[i]["coordinates"];
                for (var j in coordinates) {
                    var temp = coordinates[j];
                    for (var k in temp) {
                        var coordinate = temp[k];
                        coordinate.forEach(function(d){
                            d[0] = self.contour_x_scale(d[0]);
                            d[1] = self.contour_y_scale(d[1]);
                            if (d[0] < x_r[0]) {
                                x_r[0] = d[0];
                            }
                            if (d[0] > x_r[1]) {
                                x_r[1] = d[0];
                            }
                            if (d[1] < y_r[0]) {
                                y_r[0] = d[1];
                            }
                            if (d[1] > y_r[1]) {
                                y_r[1] = d[1];
                            }
                        });
                    }
                }
            }
            // console.log(x_r, y_r);
            //self._draw_pie_in_density_map_centers(contourData);

            data.forEach(function(d){
                d.x = self.contour_x_scale(d.x);
                d.y = self.contour_y_scale(d.y);
            });

            var contour_values = contourData.map(function (d) { return d.value; });
            contour_values.sort(function (a, b) {
                return a - b;
            });
            self.color_map.domain(contour_values);

            self.zoom = d3.zoom()
                            .scaleExtent([0.2, 60])
                            .on("zoom", zoomed);

            self.drag_transform = {'x': 0, 'y': 0};
            self.drag = d3.drag()
                .subject(function(d) {
                    return {
                        x: d.x,
                        y: d.y
                    };
                })
                .on("start", function(d){
                    // it's important that we suppress the mouseover event on the node being dragged. Otherwise it will absorb the mouseover event and the underlying node will not detect it
                    d3.select(this).attr( 'pointer-events', 'none' );
                })
                .on("drag", function(d) {
                    self.drag_transform.x += d3.event.dx;
                    self.drag_transform.y += d3.event.dy;
                    self.contour_map_dot.selectAll(".selected_dot")
                        .attr("cx", function(e) {return e.x + self.drag_transform.x;})
                        .attr("cy", function(e) {return e.y + self.drag_transform.y;});
                })
                .on("end", function(d){
                    // now restore the mouseover event or we won't be able to drag a 2nd time
                    d3.select(this).attr( 'pointer-events', '' );
                    var id = dataset_selector[0].selectedIndex;
                    for (var i = 0;i < self.lasso_result.length;i++){
                        self.data[self.id2index['' + self.lasso_result[i]]]['pos'][0]
                            = self.point_x_reverse_scale(self.contour_x_reverse_scale(self.data[self.id2index['' + self.lasso_result[i]]]['x']
                                                            + self.drag_transform.x));
                        self.data[self.id2index['' + self.lasso_result[i]]]['pos'][1]
                            = self.point_y_reverse_scale(self.contour_y_reverse_scale(self.data[self.id2index['' + self.lasso_result[i]]]['y']
                                                            + self.drag_transform.y));
                    }
                    self._generate_chart(false);
                });
            function zoomed() {
                if (self.zoom_scale != 1.0 / d3.event.transform.k) {
                    self.contour_map_dot.selectAll('.dot')
                        .attr('r', function (d) {
                        if (d.model_score >= self.model_score_line) {
                            return dot_size[1] * self.zoom_scale;
                        }
                        else if (self.lasso_result.indexOf(d.id) != -1 || self.highlight_index.indexOf(d.id) != -1) {
                            return dot_size[2] * self.zoom_scale;
                        }
                        return dot_size[0] * self.zoom_scale;
                    });
                    self.chart.selectAll('.highlight-item')
                        .attr('r', dot_size[0] * self.zoom_scale / 2);
                    self.chart.selectAll('.dot-g').attr("transform", function (d) {
                        return "translate(" + d["image_x"]
                                  + "," + d["image_y"] + ") scale(" + (1.0 / d3.event.transform.k) + ")";
                    });
                }
                self.zoom_scale = 1.0 / d3.event.transform.k;
                if (self.lasso != undefined) {
                    self.lasso.set_zoom_scale(self.zoom_scale);
                }
                self.main_group.style("stroke-width", 1.0 * self.zoom_scale + "px");
                self.main_group.attr("transform", d3.event.transform); // updated for d3 v4
            }

            d3.select("body").on('keydown',function(){
                if(d3.event.altKey){
                    self.contour_map.on(".dragstart", null);
                    self.contour_map.on(".drag", null);
                    self.contour_map.on(".dragend", null);
                    self.contour_map.select("#background_rect").attr("width", 0).attr("height", 0);
                    self.chart.call(self.zoom);
                    if (_flag_ == "sampling") {
                        _flag_ = "";
                        console.log("change to selection");
                    }
                    else {
                        _flag_ = "sampling";
                        console.log("change to sampling");
                    }
                }
                else if (d3.event.keyCode == 27) {
                    self._reset();
                }
                else if (d3.event.keyCode == 13) {
                    if (self.focus_dot_id != -1) {
                        // document.getElementById('col-1-selector').blur();
                        list_component.change_point([{
                            'id': self.focus_dot_id,
                            'label': self.data.find(function(d){return d.id==self.focus_dot_id;}).label
                        }]);
                    }
                }
                else if(d3.event.shiftKey) {
                    self.chart.on("mousedown", null);
                    self.chart.on(".drag", null);
                    self.chart.on(".dragend", null);
                    self.chart.selectAll(".dot").call(self.drag);
                }
                else if (d3.event.ctrlKey) {
                    self.lasso.set_select_mode(1);
                    list_component.set_lasso_select_mode(1);
                }

            }).on('keyup',function(){
                if (d3.event.keyCode == 16) {
                    self.chart.selectAll(".dot").on('.drag', null);
                }
                else if (d3.event.keyCode == 17) {
                    self.lasso.set_select_mode(0);
                    list_component.set_lasso_select_mode(0);
                }
                else if (d3.event.keyCode == 18) {
                    self.chart.on('.zoom', null);
                    self.contour_map.select("#background_rect").attr("width", self.chart_width - 100)
                        .attr("height", self.chart_height);
                    self._enableLasso();
                }
            });


            var contourMapContainer = self.chart.selectAll('.contourMap');
            var contourMapContainerDot = self.chart.selectAll('.contourMapDot');
            var contourMapContainerDensity = self.chart.selectAll('.contourMapDensity');
            contourMapContainer.transition().duration(500).style('opacity', 0);
            setTimeout(function () {
                var contourMapDensity = contourMapContainerDensity.selectAll('.contourPath')
                        .data(contourData);
                contourMapDensity.exit().remove();
                contourMapDensity = contourMapContainerDensity.selectAll('.contourPath')
                        .data(contourData);
                contourMapDensity.enter().append('path')
                                    .attr('class','contourPath')
                                    .attr('id', function (d) {
                                        return 'contourPath-' + d.id;
                                    });
                contourMapDensity = contourMapContainerDensity.selectAll('.contourPath')
                        .data(contourData);
                contourMapDensity.attr('d', d3.geoPath())
                                    .style('fill', function (d) {
                                        return self.color_map(d.value);
                                    });


                // data = data.sort(function (a, b) {
                //     return a.label - b.label;
                // });
                var points = contourMapContainerDot.selectAll('.dot')
                                    .data(data, function (d) {
                                    return d.id;
                                });
                points.exit().remove();
                points = contourMapContainerDot.selectAll('.dot')
                                    .data(data, function (d) {
                                    return d.id;
                                });
                points.enter().append('circle')
                                .attr('class','dot')
                                .attr('id', function (d) {
                                    return 'dot-' + d.id;
                                })
                                .on("mousemove", function (d) {
                                    if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                        && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                        // d3.select('#dot-' + self.focus_dot_id)
                                            // .attr('r', function (d) {
                                            //     if (d.model_score >= self.model_score_line) {
                                            //         return dot_size[2] * self.zoom_scale;
                                            //     }
                                            //     return dot_size[0] * self.zoom_scale;
                                            // })
                                            // .style('stroke', 'white');
                                    }
                                    self.focus_dot_id = d.id;
                                    // d3.select('#dot-' + d.id)
                                        // .attr('r', function (d) {
                                        //     if (d.model_score >= self.model_score_line) {
                                        //         return dot_size[2] * self.zoom_scale;
                                        //     }
                                        //     return dot_size[1] * self.zoom_scale;
                                        // })
                                        // .style('stroke', '#000000');
                                    var data = deep_copy(d);
                                    data.label = self.label_names[data.label];
                                    if (col_1_view_state == 0) {
                                        // information_component.redraw(data);
                                    }
                                    else {
                                        self._update_dot_info(d.id);
                                    }
                                })
                                .on("mousedown", function (d) {
                                    self.dot_mouse_down = true;
                                    self.contour_map.on(".dragstart", null);
                                    self.contour_map.on(".drag", null);
                                    self.contour_map.on(".dragend", null);
                                    if (self.lasso.get_select_mode() == 0) {
                                        for (var i = 0;i < self.lasso_result.length;i++) {
                                            self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                    if (d.model_score >= self.model_score_line) {
                                                        return dot_size[2] * self.zoom_scale;
                                                    }
                                                    return dot_size[0] * self.zoom_scale;
                                                });
                                        }
                                        self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                        self.lasso_result = [d.id];
                                        self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    else if (self.lasso_result.indexOf(d.id) == -1){
                                        self.lasso_result.push(d.id);
                                        self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    self._update_item_recomendation_param();
                                    self._update_show_mode_switch();
                                    self.lasso.set_selected_index(self.lasso_result);
                                    self._updateClickMenu();
                                })
                                .on("mouseup", function (d) {
                                    if (self.lasso.get_select_mode() == 0) {
                                        for (var i = 0;i < self.lasso_result.length;i++) {
                                            self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                    if (d.model_score >= self.model_score_line) {
                                                        return dot_size[2] * self.zoom_scale;
                                                    }
                                                    return dot_size[0] * self.zoom_scale;
                                                });
                                        }
                                        self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                        self.lasso_result = [d.id];
                                        self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    else if (self.lasso_result.indexOf(d.id) == -1){
                                        self.lasso_result.push(d.id);
                                        self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    self._update_item_recomendation_param();
                                    self._update_show_mode_switch();
                                    self._enableLasso();
                                    self._updateClickMenu();
                                    self.dot_mouse_down = false;
                                })
                                .on("mouseleave", function (d) {
                                    if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                        && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                        // d3.select('#dot-' + self.focus_dot_id)
                                            // .attr('r', function (d) {
                                            //     if (d.model_score >= self.model_score_line) {
                                            //         return dot_size[2] * self.zoom_scale;
                                            //     }
                                            //     return dot_size[0] * self.zoom_scale;
                                            // })
                                            // .style('stroke', 'white');
                                    }
                                    self.focus_dot_id = -1;
                                    var count = 0;
                                    for (var x in self.data[0]) {
                                        count++;
                                    }
                                    if (col_1_view_state == 1 &&
                                        (self.mouse_pos[0] < self.chart_width - 210
                                        || self.mouse_pos[0] > self.chart_width - 10
                                        || self.mouse_pos[1] < self.chart_height - count * 25 - 220
                                        || self.mouse_pos[1] > self.chart_height - 10)) {
                                        self._update_dot_info(-1);
                                    }
                                });
                points = contourMapContainerDot.selectAll('.dot')
                                    .data(data, function (d) {
                                    return d.id;
                                });
                points.attr('cx',function(d){return d.x;})
                                .attr('cy',function(d){return d.y;})
                                .style('fill', function (d) {
                                    return color_manager.get_color(d['label']);
                                })
                                // .style('stroke', 'white')
                                .style('opacity', 0.7)
                                .attr('r', function (d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[1] * self.zoom_scale;
                                    }
                                    return dot_size[0] * self.zoom_scale;
                                })
                                .on("mousemove", function (d) {
                                    if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                        && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                        // d3.select('#dot-' + self.focus_dot_id)
                                            // .attr('r', function (d) {
                                            //     if (d.model_score >= self.model_score_line) {
                                            //         return dot_size[2] * self.zoom_scale;
                                            //     }
                                            //     return dot_size[0] * self.zoom_scale;
                                            // })
                                            // .style('stroke', 'white');
                                    }
                                    self.focus_dot_id = d.id;
                                    // d3.select('#dot-' + d.id)
                                        // .attr('r', function (d) {
                                        //     if (d.model_score >= self.model_score_line) {
                                        //         return dot_size[2] * self.zoom_scale;
                                        //     }
                                        //     return dot_size[1] * self.zoom_scale;
                                        // })
                                        // .style('stroke', '#000000');
                                    var data = deep_copy(d);
                                    data.label = self.label_names[data.label];
                                    if (col_1_view_state == 0) {
                                        // information_component.redraw(data);
                                    }
                                    else {
                                        self._update_dot_info(d.id);
                                    }
                                })
                                .on("mousedown", function (d) {
                                    self.dot_mouse_down = true;
                                    self.contour_map.on(".dragstart", null);
                                    self.contour_map.on(".drag", null);
                                    self.contour_map.on(".dragend", null);
                                    if (self.lasso.get_select_mode() == 0) {
                                        for (var i = 0;i < self.lasso_result.length;i++) {
                                            self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                    if (d.model_score >= self.model_score_line) {
                                                        return dot_size[2] * self.zoom_scale;
                                                    }
                                                    return dot_size[0] * self.zoom_scale;
                                                });
                                        }
                                        self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                        self.lasso_result = [d.id];
                                        self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    else if (self.lasso_result.indexOf(d.id) == -1){
                                        self.lasso_result.push(d.id);
                                        self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    self._update_item_recomendation_param();
                                    self._update_show_mode_switch();
                                    self.lasso.set_selected_index(self.lasso_result);
                                    self._updateClickMenu();
                                })
                                .on("mouseup", function (d) {
                                    if (self.lasso.get_select_mode() == 0) {
                                        for (var i = 0;i < self.lasso_result.length;i++) {
                                            self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                    if (d.model_score >= self.model_score_line) {
                                                        return dot_size[2] * self.zoom_scale;
                                                    }
                                                    return dot_size[0] * self.zoom_scale;
                                                });
                                        }
                                        self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                        self.lasso_result = [d.id];
                                        self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    else if (self.lasso_result.indexOf(d.id) == -1){
                                        self.lasso_result.push(d.id);
                                        self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                        self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[2] * self.zoom_scale;
                                            });
                                    }
                                    self._update_item_recomendation_param();
                                    self._update_show_mode_switch();
                                    self._enableLasso();
                                    self._updateClickMenu();
                                    self.dot_mouse_down = false;
                                })
                                .on("mouseleave", function (d) {
                                    if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                        && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                        // d3.select('#dot-' + self.focus_dot_id)
                                            // .attr('r', function (d) {
                                            //     if (d.model_score >= self.model_score_line) {
                                            //         return dot_size[2] * self.zoom_scale;
                                            //     }
                                            //     return dot_size[0] * self.zoom_scale;
                                            // })
                                            // .style('stroke', 'white');
                                    }
                                    self.focus_dot_id = -1;
                                    var count = 0;
                                    for (var x in self.data[0]) {
                                        count++;
                                    }
                                    if (col_1_view_state == 1 &&
                                        (self.mouse_pos[0] < self.chart_width - 210
                                        || self.mouse_pos[0] > self.chart_width - 10
                                        || self.mouse_pos[1] < self.chart_height - count * 25 - 220
                                        || self.mouse_pos[1] > self.chart_height - 10)) {
                                        self._update_dot_info(-1);
                                    }
                                });

                contourMapContainer.transition().duration(500).style('opacity', 1);
            }, 300);


            self._drawLegend();
                            // .on("click", function (d) {
                            //     self.contour_class_id = d.id;
                            //     self.redraw(self.data, self.label_names);
                            // });
            // var a = background_legends.enter().append('rect')
            //                 .attr('class', 'background-legend')
            //                 .attr('id', function (d) {
            //                     return 'background-legend-' + d.id;
            //                 })
            //                 .attr('width', 150)
            //                 .attr('height', 16)
            //                 .attr('x', 5)
            //                 .attr('y',function(d){return d.id * 20 + 7;})
            //                 .style('fill', function (d) {
            //                     if (d.id == self.contour_class_id) {
            //                         return '#808080';
            //                     }
            //                     return 'transparent';
            //                 })
            //                 .attr('fill-opacity', 0.3)
            //                 .style('stroke', 'white')
            //                 .on("click", function (d) {
            //                     if (self.contour_class_id != d.id) {
            //                         self.contour_class_id = d.id;
            //                     }
            //                     else {
            //                         self.contour_class_id = -1;
            //                     }
            //                     self.redraw(self.data, self.label_names);
            //                 })
            //                 .on("mousemove", function (d) {
            //                     if (self.hover_contour_class_id != d.id) {
            //                         d3.select('#background-legend-' + self.hover_contour_class_id).transition()
            //                                 .duration(100)
            //                                 .style("stroke","transparent");
            //                         d3.select('#' + this.id).transition()
            //                                 .duration(100)
            //                                 .style("stroke","black");
            //                         self.hover_contour_class_id = d.id;
            //                     }
            //                 })
            //                 .on("mouseout", function (d) {
            //                     d3.select('#' + this.id).transition()
            //                             .duration(100)
            //                             .style("stroke","transparent");
            //                     self.hover_contour_class_id = -1;
            //                 });

            self._enableLasso();
        },
        _draw_pie:function (group, pos, pie_data, id) {
            var pie = d3.pie();
            var arc = d3.arc()
                .innerRadius(0)
                .outerRadius(50);
            var arcs = group.selectAll("g#" + id)
                .data(pie(pie_data))
                .enter()
                .append("g")
                .style("cursor", "pointer")
                .attr("class", "arc")
                .attr("id", id)
                .attr("transform","translate(" + pos[0] + "," + pos[1] + ")");
            arcs.append("path")
                .style("fill", function (d, i) {
                    return color_manager.get_color(i);
                })
                // .attr("stroke", "white")
                .style("stroke-width", 0)
                .attr("d", function (d) {
                    return arc(d);
                })
                .style("opacity", 0.7)
                .on("mouseover",function(d,i){
                    d3.select(this)
                        .attr("opacity",1);
                })
                .on("mouseout",function(d,i){
                    d3.select(this)
                        .transition()
                        .duration(500)
                        .attr("opacity",0.7);
                })
                .on("click",function () {

                });
        },
        _draw_pie_in_density_map_centers:function (contourData) {
            var self = this;
            var group = self.main_group;
            group.selectAll("g.arc").remove();
            var coordinates = contourData[contourData.length - 1]["coordinates"];
            for (var i = 0;i < coordinates.length;i++) {
                var path = coordinates[i][0];
                var center_pos = [0, 0], max_pos = [-Infinity, -Infinity];
                for (var j = 0;j < path.length;j++) {
                    center_pos[0] += path[j][0];
                    center_pos[1] += path[j][1];
                    if (path[j][0] > max_pos[0]) {
                        max_pos[0] = path[j][0];
                    }
                    if (path[j][1] > max_pos[1]) {
                        max_pos[1] = path[j][1];
                    }
                }
                max_pos[0] += self.settings.margin.left;
                max_pos[1] += self.settings.margin.top;
                self._draw_pie(group, max_pos, [123,234,345,213,325,421,342], "center_pie-" + i);
            }
        },
        _drawLegend:function(){
            var self = this;
            self.label_filter_flag = [];
            for (var i = 0;i < self.label_names.length;i++) {
                self.label_filter_flag[i] = false;
            }
            var count = self.label_names.length;
            for (var i = 0;i < self.lasso_result.length;i++) {
                var label = self.data[self.id2index[self.lasso_result[i]]]["label"];
                if (!self.label_filter_flag[label]) {
                    self.label_filter_flag[label] = true;
                    count--;
                    if (count === 0) {
                        break;
                    }
                }
            }
            var legendMapContainer = self.legend_map;
            legendMapContainer.selectAll('rect').remove();
            legendMapContainer.selectAll('text').remove();
            legendMapContainer.selectAll('path').remove();
            var legend_rect_group = self.legend_rect_group;
            var legend_data = [];
            var max_label_name_size = 0;
            for (var i = 0;i < self.label_names.length;i++) {
                if (self.label_names[i].length > max_label_name_size) {
                    max_label_name_size = self.label_names[i].length;
                }
                legend_data.push({
                    id: i,
                    label_name: self.label_names[i],
                    flag: self.label_filter_flag[i]
                });
            }
            if (max_label_name_size > 9) {
                max_label_name_size = 9;
            }
            // var background_legends = legendMapContainer.selectAll('.background-legend')
            //                     .data(legend_data);
            legend_width = 59 + 6 * max_label_name_size;
            var btn_body = {
                'x': legend_width - 12,
                'y': 0, //current_legend_map_bbox.y,
                'width': 10,
                'height': self.label_names.length * 20
            };

            // legendMapContainer.selectAll('.legend-visible-button').remove();
            //
            // legendMapContainer.append('rect')
            //     .attr('class', 'legend-visible-button')
            //     .attr('id', 'legend-visible-btn-background')
            //     .attr('width', legend_width - 1)
            //     .attr('height', self.label_names.length * 20)
            //     .attr('x', 0)
            //     .attr('y', 0)
            //     .style('fill', 'transparent')
            //     .style('opacity', 0)
            //     .on('mousemove', function () {
            //         self.chart.selectAll('.legend-visible-button')
            //             .transition()
            //             .duration(100)
            //             .style('opacity', 0.5)
            //             .style('stroke-width', 1);
            //     })
            //     .on('mouseleave', function () {
            //         self.chart.selectAll('.legend-visible-button')
            //             .transition()
            //             .duration(100)
            //             .style('opacity', function () {
            //                 if (self.legend_hide) {
            //                     return 0.5;
            //                 }
            //                 else {
            //                     return 0;
            //                 }
            //             })
            //             .style('stroke-width', 1);
            //     });
            var legends = legend_rect_group.selectAll('.legend')
                                .data(legend_data);
            var texts = legendMapContainer.selectAll('.legend-text')
                                .data(legend_data);
            // background_legends.exit().remove();
            legends.exit().remove();
            texts.exit().remove();
            legends = legend_rect_group.selectAll('.legend')
                                .data(legend_data);
            legends.enter().append('rect')
                .attr('class', 'legend');
            legends = legend_rect_group.selectAll('.legend')
                                .data(legend_data);
            legends.attr('id', function (d) {
                    return 'legend-' + d.id;
                })
                .attr('width', 30)
                .attr('height', 10)
                .attr('x', 4)
                .attr('y',function(d){return d.id * 20 + 10;})
                .style('fill', function (d) {
                    return color_manager.get_color(d.id);
                })
                .style('stroke', function (d) {
                    if (d.flag) {
                        return "black";
                    }
                    else {
                        return "transparent";
                    }
                })
                .style('stroke-width', 2)
                .style('opacity', 0.7)
                .on("mousedown", function (d) {
                    var labels = deep_copy(self.label_filter_flag);
                    if (labels[d.id]) {
                        labels[d.id] = false;
                        self._label_filter_selection(labels);
                    }
                })
                .on('mousemove', function () {
                    self.chart.selectAll('.legend-visible-button')
                        .transition()
                        .duration(100)
                        .style('opacity', 0.5)
                        .style('stroke-width', 1);
                })
                .on('mouseleave', function () {
                    self.chart.selectAll('.legend-visible-button')
                        .transition()
                        .duration(100)
                        .style('opacity', function () {
                            if (self.legend_hide) {
                                return 0.5;
                            }
                            else {
                                return 0;
                            }
                        })
                        .style('stroke-width', 1);
                });
                            // .on("click", function (d) {
                            //     self.contour_class_id = d.id;
                            //     self.redraw(self.data, self.label_names);
                            // });
            texts = legendMapContainer.selectAll('.legend-text')
                                .data(legend_data);
            texts.enter().append('text')
                            .attr('class', 'legend-text');
            texts = legendMapContainer.selectAll('.legend-text')
                                .data(legend_data);
            texts.attr('id', function (d) {
                                return 'text-' + d.id;
                            })
                            .attr('x', 44)
                            .attr('y',function(d){return d.id * 20 + 15;})
                            .text(function(d){
                                if (d.label_name.length < 8) {
                                    return d.label_name + "   ";
                                }
                                return d.label_name.slice(0, 9) + "   ";})
                            .style("user-select", "none")
                            .attr('dominant-baseline', 'middle')
                            .attr('font-size', '14px')
                            .attr('font-family', 'Arial')
                            .on('mousemove', function () {
                                self.chart.selectAll('.legend-visible-button')
                                    .transition()
                                    .duration(100)
                                    .style('opacity', 0.5)
                                    .style('stroke-width', 1);
                            })
                            .on('mouseleave', function () {
                                self.chart.selectAll('.legend-visible-button')
                                    .transition()
                                    .duration(100)
                                    .style('opacity', function () {
                                        if (self.legend_hide) {
                                            return 0.5;
                                        }
                                        else {
                                            return 0;
                                        }
                                    })
                                    .style('stroke-width', 1);
                            });

            legendMapContainer.append('rect')
                .attr('class', 'legend-visible-button')
                .attr('id', 'legend-visible-btn-body')
                .attr('width', btn_body['width'])
                .attr('height', btn_body['height'])
                .attr('x', btn_body['x'])
                .attr('y', btn_body['y'])
                .style('fill', color_manager.default_color)
                .style('opacity', 0)
                .on('mousemove', function () {
                    self.chart.selectAll('.legend-visible-button')
                        .transition()
                        .duration(100)
                        .style('opacity', 0.5)
                        .style('stroke-width', 2);
                })
                .on('mouseleave', function () {
                    self.chart.selectAll('.legend-visible-button')
                        .transition()
                        .duration(100)
                        .style('opacity', function () {
                            if (self.legend_hide) {
                                return 0.5;
                            }
                            else {
                                return 0;
                            }
                        })
                        .style('stroke-width', 1);
                })
                .on('mousedown', function () {
                    if (self.legend_hide) {
                        self.chart.selectAll('.legendMap')
                            .transition()
                            .duration(300)
                            .attr('transform', "translate(0,0)");
                        self.chart.selectAll('.legend_rect_group')
                            .transition()
                            .duration(300)
                            .attr('transform', "translate(0,0)");
                        self.chart.selectAll('.legend-text')
                            .transition()
                            .duration(300)
                            .style('opacity', 1);
                    }
                    else {
                        self.chart.selectAll('.legendMap')
                            .transition()
                            .duration(300)
                            .attr('transform', "translate(" + (5 - btn_body['x']) + ",0)");
                        self.chart.selectAll('.legend_rect_group')
                            .transition()
                            .duration(300)
                            .attr('transform', "translate(" + (btn_body['x'] - 30) + ",0)");
                        self.chart.selectAll('.legend-text')
                            .transition()
                            .duration(300)
                            .style('opacity', 0);
                    }
                    self.legend_hide = !self.legend_hide;
                });
            btn_body['center_x'] = btn_body['x'] + btn_body['width'] / 2;
            btn_body['center_y'] = btn_body['y'] + btn_body['height'] / 2;
            legendMapContainer.append('path')
                .attr('class','legend-visible-button')
                .attr('id', 'legend-visible-btn-icon')
                .attr('d', function (d) {
                    if (!self.legend_hide) {
                        return 'M' + (btn_body['center_x'] + btn_body['width'] / 4) + ','
                                            + (btn_body['center_y'] - Math.min(10, btn_body['height'] / 2))
                                        + 'L' + (btn_body['center_x'] - btn_body['width'] / 4) + ','
                                            + btn_body['center_y']
                                        + 'L' + (btn_body['center_x'] + btn_body['width'] / 4) + ','
                                            + (btn_body['center_y'] + Math.min(10, btn_body['height'] / 2));
                    }
                    return 'M' + (btn_body['center_x'] - btn_body['width'] / 4) + ','
                                            + (btn_body['center_y'] - Math.min(10, btn_body['height'] / 2))
                                        + 'L' + (btn_body['center_x'] + btn_body['width'] / 4) + ','
                                            + btn_body['center_y']
                                        + 'L' + (btn_body['center_x'] - btn_body['width'] / 4) + ','
                                            + (btn_body['center_y'] + Math.min(10, btn_body['height'] / 2));
                }
                )
                .style('fill', 'transparent')
                .style('stroke', 'black')
                .style('stroke-width', 1)
                .style('opacity', 0)
                .on('mousemove', function () {
                    self.chart.selectAll('.legend-visible-button')
                        .transition()
                        .duration(100)
                        .style('opacity', 0.5)
                        .style('stroke-width', 2);
                })
                .on('mouseleave', function () {
                    self.chart.selectAll('.legend-visible-button')
                        .transition()
                        .duration(100)
                        .style('opacity', function () {
                            if (self.legend_hide) {
                                return 0.5;
                            }
                            else {
                                return 0;
                            }
                        })
                        .style('stroke-width', 1);
                });

        },
        _enableLasso:function(){
            var self = this;
            // self.lasso_result = [];
            // self.lasso_tree_size = 0;
            if (self.lasso != undefined) {
                delete self.lasso;
            }
            self.lasso = new SimpleLasso(self.contour_map, self.contour_map_dot.selectAll('circle'), function (selected) {
                

                // self.lasso_result = [];

                self.lasso_result = selected;
                self._update_item_recomendation_param();
                self._update_show_mode_switch();
                self.lasso_tree_size = 0;
                self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                self.chart.selectAll(".dot-g-background").style("opacity", 0);
                self.chart.selectAll(".dot")
                    .attr("r", dot_size[0] * self.zoom_scale)
                    .style('opacity', 0.7);

                for (var i = 0;i < selected.length;i++) {
                    self.lasso_tree_size += self.data[self.id2index[selected[i]]]['tree_size'];
                    self.chart.select("#dot-" + selected[i]).classed("selected_dot", true).attr('r', function(d) {
                        if (d.model_score >= self.model_score_line) {
                            return dot_size[2] * self.zoom_scale;
                        }
                        return dot_size[2] * self.zoom_scale;
                    })
                    .style('opacity', 1.0);
                    self.chart.select("#dot-g-background-" + selected[i]).style("opacity", 0.7);
                }



                self._updateClickMenu();
            });
            self.lasso.set_selected_index(self.lasso_result);
            self.lasso.set_zoom_scale(self.zoom_scale);
        },
        _draw_state_stack:function () {
            var self = this;
            self.chart.selectAll('.state-stack-button').remove();
            self.chart.selectAll('.state-stack-button-text').remove();
            var data = [];
            var stack_num = self.max_level + 1;
            if (self.state_stack.length > stack_num) {
                stack_num = self.state_stack.length;
            }
            for (var i = 0;i < stack_num;i++) {
                if (i < self.state_stack.length) {
                    data[i] = {
                        'state_index': i,
                        'enable': true
                    };
                }
                else {
                    data[i] = {
                        'state_index': i,
                        'enable': false
                    };
                }
            }
            self.chart.selectAll('.state-stack-button')
                .data(data)
                .enter()
                .append('rect')
                .attr('class', 'state-stack-button')
                .attr('id', function (d) {
                    return 'state-stack-button-' + self.state_stack[d['state_index']];
                })
                .attr('width', 100)
                .attr('height', 24)
                .attr('x', 10)
                .attr('y', function (d) {
                    return self.chart_height - 40 - 24 * d['state_index'];
                })
                .style('fill', function (d) {
                    if (d['state_index'] == self.state_index) {
                        return '#868E96';
                    }
                    return 'none';
                })
                .style('stroke', function (d) {
                    if (d['enable']) {
                        return 'black';
                    }
                    return 'gray';
                })
                .style('opacity', function (d) {
                    if (!d['enable']) {
                        return 0.5;
                    }
                    if (d['state_index'] == self.state_index) {
                        return 1.0;
                    }
                    return 0.7;
                })
                .on("mousemove", function (d) {
                    if (d['enable']) {
                        d3.select('#state-stack-button-' + self.state_stack[d['state_index']]).style('opacity', 1).style('fill', '#868E96');
                        d3.select('#state-stack-button-text-' + self.state_stack[d['state_index']]).style('opacity', 1).style('fill', 'white');
                    }
                })
                .on("mouseleave", function (d) {
                    if (d['enable']) {
                        if (d['state_index'] != self.state_index) {
                            d3.select('#state-stack-button-' + self.state_stack[d['state_index']]).style('opacity', 0.7).style('fill', 'transparent');
                            d3.select('#state-stack-button-text-' + self.state_stack[d['state_index']]).style('opacity', 0.7).style('fill', 'black');
                        }
                    }
                })
                .on("mousedown", function (d) {
                    if (d['enable']) {
                        self._change_state(d['state_index']);
                    }
                });
            self.chart.selectAll('.state-stack-button-text')
                .data(data)
                .enter()
                .append('text')
                .attr('class', 'state-stack-button-text')
                .attr('id', function (d) {
                    return 'state-stack-button-text-' + self.state_stack[d['state_index']];
                })
                .attr('x', 60)
                .attr('y', function (d) {
                    return self.chart_height - 28 - 24 * d['state_index'];
                })
                .text(function (d) {
                    if (d.state_index > self.max_level) {
                        return "selection " + (d.state_index - self.max_level);
                    }
                    return "level " + d['state_index'];
                })
                .style("user-select", "none")
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '15px')
                .attr('font-family', 'Arial')
                .attr('text-anchor', "middle")
                .style('opacity', function (d) {
                    if (!d['enable']) {
                        return 0.5;
                    }
                    if (d['state_index'] == self.state_index) {
                        return 1.0;
                    }
                    return 0.7;
                })
                .style('fill', function (d) {
                    if (!d['enable']) {
                        return 'gray';
                    }
                    if (d['state_index'] == self.state_index) {
                        return 'white';
                    }
                    return 'black';
                })
                .on("mousemove", function (d) {
                    if (d['enable']) {
                        d3.select('#state-stack-button-' + self.state_stack[d['state_index']]).style('opacity', 1).style('fill', '#868E96');
                        d3.select('#state-stack-button-text-' + self.state_stack[d['state_index']]).style('opacity', 1).style('fill', 'white');
                    }
                })
                .on("mousedown", function (d) {
                    if (d['enable']) {
                        self._change_state(d['state_index']);
                    }
                });

        },
        _on_click_dots:function(dot_id){
            if (self.id2index[dot_id] == undefined) {
                return;
            }
            var data = deep_copy(self.data[self.id2index[dot_id]]);
            data.label = self.label_names[data.label];
            if (col_1_view_state == 0) {
                // information_component.redraw(data);
            }
            else {
                self._update_dot_info(dot_id);
            }
        },
        _highlight_focus_trust_item:function (index) {
            var self = this;
            if (index >= 0){
                d3.select('#dot-' + index)
                    .attr('r', function (d) {
                        return dot_size[3] * self.zoom_scale;
                    });
                    // .style("stroke-width", 2)
                    // .style('stroke', '#000000');
                var data = deep_copy(self.data.find(function(d){return d.id == index;}));
                data.label = self.label_names[data.label];
                if (col_1_view_state == 0) {
                    // information_component.redraw(data);
                }
                else {
                    self._update_dot_info(index);
                }
            }
            else {
                if (self.lasso_result.indexOf(-index-1) == -1) {
                    d3.select('#dot-' + (-index-1))
                        .attr('r', function (d) {
                            if (d.model_score >= self.model_score_line) {
                                return dot_size[1] * self.zoom_scale;
                            }
                            return dot_size[0] * self.zoom_scale;
                        });
                        // .style("stroke-width", 1)
                        // .style('stroke', 'white');
                }
                else {
                    d3.select('#dot-' + (-index-1))
                        .attr('r', function (d) {
                            return dot_size[2] * self.zoom_scale;
                        });
                        // .style("stroke-width", 1);
                }
                if (col_1_view_state == 0) {
                    // information_component.redraw({});
                }
                else {
                    self._update_dot_info(-1);
                }
            }

        },
        _zoom_in_level: function () {
            var self = this;
            self.chart.transition()
            .duration(1000)
            .call( self.zoom.transform, d3.zoomIdentity );
            self.chart.selectAll('.dot')
                    .on("mousemove", null)
                    .on("mouseleave", null)
                    .on("mousedown", null);
            self.contour_map_selected.selectAll('.selected_dot1').remove();
            self.chart.selectAll('.dot')
                .transition()
                .duration(1000)
                .style('opacity', 0);
            self.chart.selectAll('.highlight-item')
                .transition()
                .duration(1000)
                .style('opacity', 0);
                // .style('stroke', "transparent");


            self.chart.selectAll('.contourPath')
                .transition()
                .duration(1000)
                .style('opacity', 0);
            self.chart.selectAll('.selected_dot')
                .transition()
                .duration(1000)
                .style('opacity', 0.7);

            var data = [];
            var seeds = [], trust_item_seeds = [];
            var trust_item_ids = list_component.get_item_ids();

            for (var i = 0;i < trust_item_ids.length;i++){
                if (self.index2id.indexOf(trust_item_ids[i]) != -1) {
                    // trust_item_seeds.push({
                    //     'id': trust_item_ids[i],
                    //     'level': self.data[self.id2index[trust_item_ids[i]]]['level'],
                    //     'pos': self.data[self.id2index[trust_item_ids[i]]]['pos'],
                    //     'label_entropy': self.data[self.id2index[trust_item_ids[i]]]['label_entropy']
                    // });
                }
            }
            for (var i = 0;i < self.lasso_result.length;i++){
                seeds.push({
                    'id': self.lasso_result[i],
                    'level': self.data[self.id2index[self.lasso_result[i]]]['level'],
                    'pos': self.data[self.id2index[self.lasso_result[i]]]['pos'],
                    'label_entropy': self.data[self.id2index[self.lasso_result[i]]]['label_entropy']
                });
                data.push({
                    'x': self.data[self.id2index[self.lasso_result[i]]]['x'],
                    'y': self.data[self.id2index[self.lasso_result[i]]]['y']
                });
            }
            var xRange = d3.extent(data, function(d){return d.x});
            var yRange = d3.extent(data, function(d){return d.y});
            if (xRange[0] == xRange[1]) {
                xRange[0] -= 10;
                xRange[1] += 10;
            }
            if (yRange[0] == yRange[1]) {
                yRange[0] -= 10;
                yRange[1] += 10;
            }
            var scale = Math.min(self.contour_width / (xRange[1] - xRange[0]),
                                    self.contour_height / (yRange[1] - yRange[0]));
            var x_begin = (self.contour_width - (xRange[1] - xRange[0]) * scale) / 2 + self.settings.margin.left;
            var y_begin = (self.contour_height - (yRange[1] - yRange[0]) * scale) / 2 + self.settings.margin.top;
            var point_x_scale = d3.scaleLinear().domain(xRange).range([x_begin, (xRange[1] - xRange[0]) * scale + x_begin]);
            var point_y_scale = d3.scaleLinear().domain(yRange).range([y_begin, (yRange[1] - yRange[0]) * scale + y_begin]);

            self.chart.selectAll('.selected_dot')
                .transition()
                .duration(1000)
                .attr('cx', function (d) {
                    return point_x_scale(d.x);
                })
                .attr('cy', function (d) {
                    return point_y_scale(d.y);
                });
            self.zoom_ing = true;
            setTimeout(function () {
                self.zoom_ing = false;
            }, 1000);

            var formData = new FormData();
            formData.append("filename", JSON.stringify(processed_result[dataset_selector[0].selectedIndex]['filename']));
            formData.append("seeds", JSON.stringify(seeds));
            formData.append("level", JSON.stringify(self.level));
            formData.append("trust_item_seeds", JSON.stringify(trust_item_seeds));
            formData.append("current_state", JSON.stringify(action_trail_component.get_current_state()));
            formData.append("times", JSON.stringify(times));

            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/zoom_in', true);
            xhr.onload = function (e) {
                if (xhr.status === 200) {
                    // console.log('uploaded');
                    var response = JSON.parse(xhr.response);
                    times++;
                    if (self.state_index < self.state_stack.length - 1) {
                        for (var i = self.state_index + 1;i < self.state_stack.length;i++) {
                            self.state_data[self.state_stack[i]] = undefined;
                        }
                        self.state_stack.splice(self.state_index + 1,self.state_stack.length - self.state_index - 1);
                    }
                    self.state_stack.push("" + response['level']);
                    var id2index = {};
                    for (var i = 0;i < response['data'].length;i++){
                        id2index[response['data'][i].id] = i;
                    }
                    self.state_data[response['level']] = {
                        'model_score_line': response['model_score_line'],
                        'data': response['data'],
                        'id_to_index': id2index
                    };
                    self._change_state(self.state_index + 1);
                } else {
                    alert('An error occurred!');
                }
            };
            xhr.send(formData);
        },
        _zoom_in_level_lowest: function () {
            var self = this;
            self.chart.transition()
            .duration(1000)
            .call( self.zoom.transform, d3.zoomIdentity );
            self.chart.selectAll('.dot')
                    .on("mousemove", null)
                    .on("mouseleave", null)
                    .on("mousedown", null);
            self.chart.selectAll('.dot')
                .transition()
                .duration(1000)
                .style('opacity', 0);
                // .style('stroke', "transparent");

            self.chart.selectAll('.contourPath')
                .transition()
                .duration(1000)
                .style('opacity', 0);
            self.chart.selectAll('.selected_dot')
                .transition()
                .duration(1000)
                .style('opacity', 0.7);

            var data = [];
            for (var i = 0;i < self.lasso_result.length;i++){
                data.push(self.data[self.id2index[self.lasso_result[i]]]);
            }
            var xRange = d3.extent(data, function(d){return d.x});
            var yRange = d3.extent(data, function(d){return d.y});
            if (xRange[0] == xRange[1]) {
                xRange[0] -= 10;
                xRange[1] += 10;
            }
            if (yRange[0] == yRange[1]) {
                yRange[0] -= 10;
                yRange[1] += 10;
            }
            var scale = Math.min(self.contour_width / (xRange[1] - xRange[0]),
                                    self.contour_height / (yRange[1] - yRange[0]));
            var x_begin = (self.contour_width - (xRange[1] - xRange[0]) * scale) / 2 + self.settings.margin.left;
            var y_begin = (self.contour_height - (yRange[1] - yRange[0]) * scale) / 2 + self.settings.margin.top;
            var point_x_scale = d3.scaleLinear().domain(xRange).range([x_begin, (xRange[1] - xRange[0]) * scale + x_begin]);
            var point_y_scale = d3.scaleLinear().domain(yRange).range([y_begin, (yRange[1] - yRange[0]) * scale + y_begin]);

            self.chart.selectAll('.selected_dot')
                .transition()
                .duration(1000)
                .attr('cx', function (d) {
                    return point_x_scale(d.x);
                })
                .attr('cy', function (d) {
                    return point_y_scale(d.y);
                });
            self.zoom_ing = true;
            setTimeout(function () {
                self.zoom_ing = false;
            }, 1000);

            if (self.state_index < self.state_stack.length - 1) {
                for (var i = self.state_index + 1;i < self.state_stack.length;i++) {
                    self.state_data[self.state_stack[i]] = undefined;
                }
                self.state_stack.splice(self.state_index + 1,self.state_stack.length - self.state_index - 1);
            }
            self.state_stack.push("" + (self.level + 1));
            var id2index = {};
            for (var i = 0;i < data.length;i++){
                id2index[data[i].id] = i;
            }
            self.state_data[self.level + 1] = {
                'model_score_line': self.model_score_line,
                'data': data,
                'id_to_index': id2index
            };
            self._change_state(self.state_index + 1);
        },
        _get_model_score_line:function () {
            var self = this;
            return self.model_score_line;
        },
        _label_filter_selection:function (labels) {
            var self = this;
            var lasso_result = self.lasso_result;
            self.lasso_result = [];
            for (var i = 0;i < lasso_result.length;i++) {
                var label = self.data[self.id2index[lasso_result[i]]]['label'];
                if (labels[label]) {
                    self.lasso_result.push(lasso_result[i]);
                }
            }
            self._update_item_recomendation_param();
            self._update_show_mode_switch();
            self.lasso_tree_size = 0;
            self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
            self.contour_map_dot.selectAll('.dot')
                .attr('r', function(d){
                    if (d.model_score >= self.model_score_line) {
                        return dot_size[1] * self.zoom_scale;
                    }
                    return dot_size[0] * self.zoom_scale;
                })
                // .style('stroke', 'white')
                .style('opacity', 0.7);
            for (var i = 0;i < self.lasso_result.length;i++) {
                var index_i = self.id2index[self.lasso_result[i]];
                self.lasso_tree_size += self.data[index_i]['tree_size'];
                self.chart.select("#dot-" + self.lasso_result[i]).classed("selected_dot", true)
                    .attr('r', function(d) {
                        if (d.model_score >= self.model_score_line) {
                            return dot_size[2] * self.zoom_scale;
                        }
                        return dot_size[2] * self.zoom_scale;
                    })
                    // .style('stroke', '#000000')
                    .style('opacity', 1);
            }
            self.lasso.set_selected_index(self.lasso_result);
            self.lasso.set_zoom_scale(self.zoom_scale);
            self._updateClickMenu();
        },
        _sampling_selection:function (sampling_num) {
            var self = this;
            var lasso_result = self.lasso_result;
            if (lasso_result.length == 0) {
                lasso_result = self.index2id;
            }
            if (sampling_num >= lasso_result.length || sampling_num <= 0) {
                if (self.data_count() == sampling_num) {
                    self.lasso_result = lasso_result;
                    self.lasso.set_selected_index(self.lasso_result);
                    self.lasso.set_zoom_scale(self.zoom_scale);
                    self._update_item_recomendation_param();
                    self._update_show_mode_switch();
                    self.lasso_tree_size = 0;
                    self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                    self.contour_map_dot.selectAll('.dot')
                        .attr('r', function(d){
                            if (d.model_score >= self.model_score_line) {
                                return dot_size[1] * self.zoom_scale;
                            }
                            return dot_size[0] * self.zoom_scale;
                        })
                        // .style('stroke', 'white')
                        .style('opacity', 0.7);
                    for (var i = 0;i < self.lasso_result.length;i++) {
                        var index_i = self.id2index[self.lasso_result[i]];
                        self.lasso_tree_size += self.data[index_i]['tree_size'];
                        self.chart.select("#dot-" + self.lasso_result[i]).classed("selected_dot", true)
                            .attr('r', function(d) {
                                if (d.model_score >= self.model_score_line) {
                                    return dot_size[2] * self.zoom_scale;
                                }
                                return dot_size[2] * self.zoom_scale;
                            })
                            // .style('stroke', '#000000')
                            .style('opacity', 1);
                    }
                    self._updateClickMenu();
                }
                return;
            }
            self.lasso_result = [];
            self.lasso.set_selected_index(self.lasso_result);
            var formData = new FormData();
            formData.append("filename", JSON.stringify(processed_result[dataset_selector[0].selectedIndex]['filename']));
            formData.append("seeds", JSON.stringify(lasso_result));
            formData.append("method", JSON.stringify("density based(label error)"));
            formData.append("n_sample", JSON.stringify(Math.floor(sampling_num)));
            formData.append("current_state", JSON.stringify(action_trail_component.get_current_state()));

            if (_flag_ == "sampling") {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/sampling_selection1', true);
                xhr.onload = function (e) {
                    if (xhr.status === 200) {
                        // console.log('uploaded');
                        var response = JSON.parse(xhr.response);
                        var trust_idx = list_component.get_item_ids();
                        self.lasso_result = [];
                        for (var i = 0;i < response["data"].length;i++) {
                            if (trust_idx.indexOf(response["data"][i]) == -1) {
                                self.lasso_result.push(response["data"][i]);
                            }
                        }
                        // self.lasso_result = response["data"];
                        self.lasso.set_selected_index(self.lasso_result);
                        self.lasso.set_zoom_scale(self.zoom_scale);
                        self._update_item_recomendation_param();
                        self._update_show_mode_switch();
                        self.lasso_tree_size = 0;
                        self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                        self.contour_map_dot.selectAll('.dot')
                            .attr('r', function(d){
                                if (d.model_score >= self.model_score_line) {
                                    return dot_size[1] * self.zoom_scale;
                                }
                                return dot_size[0] * self.zoom_scale;
                            })
                            // .style('stroke', 'white')
                            .style('opacity', 0.7);
                        for (var i = 0;i < self.lasso_result.length;i++) {
                            var index_i = self.id2index[self.lasso_result[i]];
                            self.lasso_tree_size += self.data[index_i]['tree_size'];
                            self.chart.select("#dot-" + self.lasso_result[i]).classed("selected_dot", true)
                                .attr('r', function(d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                })
                                // .style('stroke', '#000000')
                                .style('opacity', 1);
                        }
                        self._updateClickMenu();
                    } else {
                        alert('An error occurred!');
                    }
                };
                xhr.send(formData);
            }
            else {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/sampling_selection', true);
                xhr.onload = function (e) {
                    if (xhr.status === 200) {
                        // console.log('uploaded');
                        var response = JSON.parse(xhr.response);
                        var trust_idx = list_component.get_item_ids();
                        self.lasso_result = [];
                        for (var i = 0;i < response["data"].length;i++) {
                            if (trust_idx.indexOf(response["data"][i]) == -1) {
                                self.lasso_result.push(response["data"][i]);
                            }
                        }
                        // self.lasso_result = response["data"];
                        self.lasso.set_selected_index(self.lasso_result);
                        self.lasso.set_zoom_scale(self.zoom_scale);
                        self._update_item_recomendation_param();
                        self._update_show_mode_switch();
                        self.lasso_tree_size = 0;
                        self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                        self.contour_map_dot.selectAll('.dot')
                            .attr('r', function(d){
                                if (d.model_score >= self.model_score_line) {
                                    return dot_size[1] * self.zoom_scale;
                                }
                                return dot_size[0] * self.zoom_scale;
                            })
                            // .style('stroke', 'white')
                            .style('opacity', 0.7);
                        for (var i = 0;i < self.lasso_result.length;i++) {
                            var index_i = self.id2index[self.lasso_result[i]];
                            self.lasso_tree_size += self.data[index_i]['tree_size'];
                            self.chart.select("#dot-" + self.lasso_result[i]).classed("selected_dot", true)
                                .attr('r', function(d) {
                                    if (d.model_score >= self.model_score_line) {
                                        return dot_size[2] * self.zoom_scale;
                                    }
                                    return dot_size[2] * self.zoom_scale;
                                })
                                // .style('stroke', '#000000')
                                .style('opacity', 1);
                        }
                        self._updateClickMenu();
                    } else {
                        alert('An error occurred!');
                    }
                };
                xhr.send(formData);
            }
        },
        _change_selected_item_labels: function (target_label) {
            var self = this;
            if (target_label["label"] >= self.label_names.length) {
                self.label_names.push(target_label["label_name"]);
                self._changeItemLabels(target_label["label"]);
                self._drawLegend();
            }
            else {
                self._changeItemLabels(target_label["label"]);
            }

        },
        _update_label_and_label_names: function (label_info) {
            var self = this;
            self.label_names = deep_copy(label_info["label_names"]);
            var label = deep_copy(label_info["label"]);
            self.index2id.forEach(function(dot_id){
                self.chart.select('#dot-'+dot_id).each(function(dotData){
                    dotData.label = label[dot_id];
                    dotData.label_name = self.label_names[label[dot_id]];
                    d3.select(this).transition().duration(1000).style('fill',color_manager.get_color(label[dot_id]));
                });
                for (var i = 0;i < self.state_stack.length;i++) {
                    var index = self.state_data[self.state_stack[i]]['id_to_index'][dot_id];
                    if (index != undefined) {
                        self.state_data[self.state_stack[i]]['data'][index]['label'] = label[dot_id];
                        self.state_data[self.state_stack[i]]['data'][index]['label_name'] = self.label_names[label[dot_id]];
                    }
                }
                self.data[self.id2index[dot_id]]['label'] = label[dot_id];
                self.data[self.id2index[dot_id]]['label_name'] = self.label_names[label[dot_id]];
            });
            self._drawLegend();

            var label = [];
            for (var i = 0;i < self.index2id.length;i++) {
                label[i] = label_info["label"][self.index2id[i]];
            }
            var formData = new FormData();
            formData.append("filename", JSON.stringify(processed_result[dataset_selector[0].selectedIndex]['filename']));
            formData.append("ids", JSON.stringify(self.index2id));
            formData.append("label", JSON.stringify(label));
            formData.append("label_names", JSON.stringify(self.label_names));

            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/change_label', true);
            xhr.onload = function (e) {
                if (xhr.status === 200) {

                } else {
                    alert('An error occurred!');
                }
            };
            xhr.send(formData);
            update_label_filter_and_selected_item_modal();
        },
        _draw_images: function (type) {
            var self = this;
            if (type == "image") {
                for (var i = 0;i < self.lasso_result.length;i++) {
                    if (self.images.indexOf(self.lasso_result[i]) == -1) {
                        self.images.push(self.lasso_result[i]);
                    }
                }
            }
            else if (type == "dot") {
                var imgs = self.images,
                    dots = self.lasso_result;
                imgs.sort(function (a, b) {
                    return a - b;
                });
                dots.sort(function (a, b) {
                    return a - b;
                });
                var images = [];
                for (var i = 0, j = 0;;) {
                    if (imgs[i] < dots[j]) {
                        images.push(imgs[i]);
                        i++;
                    }
                    else if (imgs[i] == dots[j]) {
                        i++;
                        j++;
                    }
                    else {
                        j++;
                    }
                    if (j >= dots.length) {
                        while(i < imgs.length) {
                            images.push(imgs[i]);
                            i++;
                        }
                        break;
                    }
                    else if (i >= imgs.length) {
                        break;
                    }
                }
                self.images = images;
            }
            else {
                self.images = [];
            }
            var contourMapContainerImage = self.chart.selectAll('.contourMapImage');
            var data = [];
            var url = "/api/get_image?dataset=" + processed_result[dataset_selector[0].selectedIndex]['filename']
                        + "&data_id=";
            for (var i = 0;i < self.images.length;i++) {
                data[i] = {
                    "id": self.images[i],
                    "image_x": self.data[self.id2index[self.images[i]]].x,
                    "image_y": self.data[self.id2index[self.images[i]]].y,
                    "image_width": 150,
                    "image_height": 150,
                    "url": url + self.images[i],
                    "label": self.data[self.id2index[self.images[i]]]["label"]
                };
            }
            var images = contourMapContainerImage.selectAll('.dot-g')
                                .data(data);
            images.exit().remove();
            images = contourMapContainerImage.selectAll('.dot-g')
                                .data(data);
            images.enter().append("g")
                            .attr("class", "dot-g")
                            .attr("id", function (d) {
                                return "dot-g-" + d["id"];
                            });
            images = contourMapContainerImage.selectAll('.dot-g')
                                .data(data);
            images.attr("transform", function (d) {
                                return "translate(" + d["image_x"]
                                  + "," + d["image_y"] + ")";
                            })
                            .on("mousemove", function (d) {
                                if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                    && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                    // d3.select('#dot-' + self.focus_dot_id)
                                        // .attr('r', function (d) {
                                        //     if (d.model_score >= self.model_score_line) {
                                        //         return dot_size[2] * self.zoom_scale;
                                        //     }
                                        //     return dot_size[0] * self.zoom_scale;
                                        // })
                                        // .style('stroke', 'white');
                                }
                                self.chart.select("#dot-g-background-" + self.focus_dot_id).style("opacity", 0);
                                self.focus_dot_id = d.id;
                                self.chart.select("#dot-g-background-" + self.focus_dot_id).style("opacity", 0.7);
                                // d3.select('#dot-' + d.id)
                                    // .attr('r', function (d) {
                                    //     if (d.model_score >= self.model_score_line) {
                                    //         return dot_size[2] * self.zoom_scale;
                                    //     }
                                    //     return dot_size[1] * self.zoom_scale;
                                    // })
                                    // .style('stroke', '#000000');
                                var data = deep_copy(d);
                                data.label = self.label_names[data.label];
                                if (col_1_view_state == 0) {
                                    // information_component.redraw(data);
                                }
                                else {
                                    self._update_dot_info(d.id);
                                }
                            })
                            .on("mousedown", function (d) {
                                self.dot_mouse_down = true;
                                self.contour_map.on(".dragstart", null);
                                self.contour_map.on(".drag", null);
                                self.contour_map.on(".dragend", null);
                                if (self.lasso.get_select_mode() == 0) {
                                    for (var i = 0;i < self.lasso_result.length;i++) {
                                        self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[0] * self.zoom_scale;
                                            });
                                    }
                                    self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                    self.lasso_result = [d.id];
                                    self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                }
                                else if (self.lasso_result.indexOf(d.id) == -1){
                                    self.lasso_result.push(d.id);
                                    self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                }
                                self._update_item_recomendation_param();
                                self._update_show_mode_switch();
                                self.lasso.set_selected_index(self.lasso_result);
                                self._updateClickMenu();
                            })
                            .on("mouseup", function (d) {
                                if (self.lasso.get_select_mode() == 0) {
                                    for (var i = 0;i < self.lasso_result.length;i++) {
                                        self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[0] * self.zoom_scale;
                                            });
                                        self.chart.select("#dot-g-background-" + self.lasso_result[i]).style("opacity", 0);
                                    }
                                    self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                    self.lasso_result = [d.id];
                                    self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                    self.chart.select("#dot-g-background-" + d.id).style("opacity", 0.7);
                                }
                                else if (self.lasso_result.indexOf(d.id) == -1){
                                    self.lasso_result.push(d.id);
                                    self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                    self.chart.select("#dot-g-background-" + d.id).style("opacity", 0.7);
                                }

                                self._update_item_recomendation_param();
                                self._update_show_mode_switch();
                                self._enableLasso();
                                self._updateClickMenu();
                                self.dot_mouse_down = false;
                            })
                            .on("mouseleave", function (d) {
                                if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                    && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                    // d3.select('#dot-' + self.focus_dot_id)
                                        // .attr('r', function (d) {
                                        //     if (d.model_score >= self.model_score_line) {
                                        //         return dot_size[2] * self.zoom_scale;
                                        //     }
                                        //     return dot_size[0] * self.zoom_scale;
                                        // })
                                        // .style('stroke', 'white');
                                    self.chart.select("#dot-g-background-" + self.focus_dot_id).style("opacity", 0);
                                }

                                self.focus_dot_id = -1;
                                var count = 0;
                                for (var x in self.data[0]) {
                                    count++;
                                }
                                if (col_1_view_state == 1 &&
                                    (self.mouse_pos[0] < self.chart_width - 210
                                    || self.mouse_pos[0] > self.chart_width - 10
                                    || self.mouse_pos[1] < self.chart_height - count * 25 - 220
                                    || self.mouse_pos[1] > self.chart_height - 10)) {
                                    self._update_dot_info(-1);
                                }
                            });
            for (var i = 0;i < data.length;i++) {
                var g = contourMapContainerImage.select("#dot-g-" + data[i]["id"]);
                g.append("rect")
                            .attr("class", "dot-g-background")
                            .attr("id", "dot-g-background-" + data[i]["id"])
                            .attr("x", - 0.5 * self.zoom_scale * (data[i]["image_width"] + 8))
                            .attr("y", - 0.5 * self.zoom_scale * (data[i]["image_height"] + 8))
                            .attr("width", self.zoom_scale * (data[i]["image_width"] + 8))
                            .attr("height", self.zoom_scale * (data[i]["image_height"] + 8))
                            .style("fill", "black")
                            .style("opacity", 0);
                g.append("rect")
                            .attr("class", "dot-g-rect")
                            .attr("id", "dot-g-rect-" + data[i]["id"])
                            .attr("x", - 0.5 * self.zoom_scale * (data[i]["image_width"] + 4))
                            .attr("y", - 0.5 * self.zoom_scale * (data[i]["image_height"] + 4))
                            .attr("width", self.zoom_scale * (data[i]["image_width"] + 4))
                            .attr("height", self.zoom_scale * (data[i]["image_height"] + 4))
                            .style("fill", color_manager.get_color(data[i]["label"]));
                g.append("image")
                            .attr("class", "dot-g-image")
                            .attr("id", function (d) {
                                return "dot-g-image-" + d["id"];
                            })
                            .attr("x", function (d) {
                                return - 0.5 * self.zoom_scale * d["image_width"];
                            })
                            .attr("y", function (d) {
                                return - 0.5 * self.zoom_scale * d["image_height"];
                            })
                            .attr("width", function (d) {
                                return self.zoom_scale * d["image_width"];
                            })
                            .attr("height", function (d) {
                                return self.zoom_scale * d["image_height"];
                            })
                            .attr("xlink:href", function (d) {
                                return d["url"];
                            })
                            .style("user-select", "none");
            }



            self.image_datas = images;
            self._drawLegend();
        },
        _set_highlight_item: function (highlight_item) {
            var self = this;
            self.highlight_item = highlight_item;
            var contourMapContainerHighlight = self.chart.selectAll('.contourMapHighlight');
            var data = [];
            for (var i = 0;i < self.highlight_item.length;i++) {
                if (self.id2index[self.highlight_item[i]] != undefined) {
                    data.push({
                        "id": self.highlight_item[i],
                        "x": self.data[self.id2index[self.highlight_item[i]]].x,
                        "y": self.data[self.id2index[self.highlight_item[i]]].y
                    });
                }
            }
            var points = contourMapContainerHighlight.selectAll('.highlight-item')
                                .data(data);
            points.exit().remove();
            contourMapContainerHighlight.selectAll('.highlight-item')
                                .data(data);
            points.enter().append('circle')
                            .attr('class','highlight-item')
                            .attr('id', function (d) {
                                return 'highlight-item-' + d.id;
                            })
                            .on("mousemove", function (d) {
                                if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                    && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                    // d3.select('#dot-' + self.focus_dot_id)
                                        // .attr('r', function (d) {
                                        //     if (d.model_score >= self.model_score_line) {
                                        //         return dot_size[2] * self.zoom_scale;
                                        //     }
                                        //     return dot_size[0] * self.zoom_scale;
                                        // })
                                        // .style('stroke', 'white');
                                }
                                self.focus_dot_id = d.id;
                                // d3.select('#dot-' + d.id)
                                    // .attr('r', function (d) {
                                    //     if (d.model_score >= self.model_score_line) {
                                    //         return dot_size[2] * self.zoom_scale;
                                    //     }
                                    //     return dot_size[1] * self.zoom_scale;
                                    // })
                                    // .style('stroke', '#000000');
                                var data = deep_copy(d);
                                data.label = self.label_names[data.label];
                                if (col_1_view_state == 0) {
                                    // information_component.redraw(data);
                                }
                                else {
                                    self._update_dot_info(d.id);
                                }
                            })
                            .on("mousedown", function (d) {
                                self.dot_mouse_down = true;
                                self.contour_map.on(".dragstart", null);
                                self.contour_map.on(".drag", null);
                                self.contour_map.on(".dragend", null);
                                if (self.lasso.get_select_mode() == 0) {
                                    for (var i = 0;i < self.lasso_result.length;i++) {
                                        self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[0] * self.zoom_scale;
                                            });
                                    }
                                    self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                    self.lasso_result = [d.id];
                                    self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                }
                                else if (self.lasso_result.indexOf(d.id) == -1){
                                    self.lasso_result.push(d.id);
                                    self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                }
                                self._update_item_recomendation_param();
                                self._update_show_mode_switch();
                                self.lasso.set_selected_index(self.lasso_result);
                                self._updateClickMenu();
                            })
                            .on("mouseup", function (d) {
                                if (self.lasso.get_select_mode() == 0) {
                                    for (var i = 0;i < self.lasso_result.length;i++) {
                                        self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[0] * self.zoom_scale;
                                            });
                                    }
                                    self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                    self.lasso_result = [d.id];
                                    self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                }
                                else if (self.lasso_result.indexOf(d.id) == -1){
                                    self.lasso_result.push(d.id);
                                    self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                }
                                self._update_item_recomendation_param();
                                self._update_show_mode_switch();
                                self._enableLasso();
                                self._updateClickMenu();
                                self.dot_mouse_down = false;
                            });
            contourMapContainerHighlight.selectAll('.highlight-item')
                                .data(data);
            points.attr('cx',function(d){return d.x;})
                            .attr('cy',function(d){return d.y;})
                            .style('fill', 'black')
                            // .style('stroke', 'white')
                            .style('opacity', 0)
                            .attr('r', dot_size[0] * self.zoom_scale / 2)
                            .on("mousemove", function (d) {
                                if (self.highlight_index.indexOf(self.focus_dot_id) == -1
                                    && self.lasso_result.indexOf(self.focus_dot_id) == -1) {
                                    // d3.select('#dot-' + self.focus_dot_id)
                                        // .attr('r', function (d) {
                                        //     if (d.model_score >= self.model_score_line) {
                                        //         return dot_size[2] * self.zoom_scale;
                                        //     }
                                        //     return dot_size[0] * self.zoom_scale;
                                        // })
                                        // .style('stroke', 'white');
                                }
                                self.focus_dot_id = d.id;
                                // d3.select('#dot-' + d.id)
                                    // .attr('r', function (d) {
                                    //     if (d.model_score >= self.model_score_line) {
                                    //         return dot_size[2] * self.zoom_scale;
                                    //     }
                                    //     return dot_size[1] * self.zoom_scale;
                                    // })
                                    // .style('stroke', '#000000');
                                var data = deep_copy(d);
                                data.label = self.label_names[data.label];
                                if (col_1_view_state == 0) {
                                    // information_component.redraw(data);
                                }
                                else {
                                    self._update_dot_info(d.id);
                                }
                            })
                            .on("mousedown", function (d) {
                                self.dot_mouse_down = true;
                                self.contour_map.on(".dragstart", null);
                                self.contour_map.on(".drag", null);
                                self.contour_map.on(".dragend", null);
                                if (self.lasso.get_select_mode() == 0) {
                                    for (var i = 0;i < self.lasso_result.length;i++) {
                                        self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[0] * self.zoom_scale;
                                            });
                                    }
                                    self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                    self.lasso_result = [d.id];
                                    self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                }
                                else if (self.lasso_result.indexOf(d.id) == -1){
                                    self.lasso_result.push(d.id);
                                    self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                }
                                self._update_item_recomendation_param();
                                self._update_show_mode_switch();
                                self.lasso.set_selected_index(self.lasso_result);
                                self._updateClickMenu();
                            })
                            .on("mouseup", function (d) {
                                if (self.lasso.get_select_mode() == 0) {
                                    for (var i = 0;i < self.lasso_result.length;i++) {
                                        self.chart.select("#dot-" + self.lasso_result[i]).attr('r', function(d) {
                                                if (d.model_score >= self.model_score_line) {
                                                    return dot_size[2] * self.zoom_scale;
                                                }
                                                return dot_size[0] * self.zoom_scale;
                                            });
                                    }
                                    self.contour_map_dot.selectAll(".selected_dot").classed("selected_dot", false);
                                    self.lasso_result = [d.id];
                                    self.lasso_tree_size = self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                }
                                else if (self.lasso_result.indexOf(d.id) == -1){
                                    self.lasso_result.push(d.id);
                                    self.lasso_tree_size += self.data[self.id2index[d.id]]['tree_size'];
                                    self.chart.select("#dot-" + d.id).classed("selected_dot", true).attr('r', function(d) {
                                            if (d.model_score >= self.model_score_line) {
                                                return dot_size[2] * self.zoom_scale;
                                            }
                                            return dot_size[2] * self.zoom_scale;
                                        });
                                }
                                self._update_item_recomendation_param();
                                self._update_show_mode_switch();
                                self._enableLasso();
                                self._updateClickMenu();
                                self.dot_mouse_down = false;
                            });
            self.chart.selectAll(".highlight-item")
                    .transition()
                    .duration(1000)
                    .style('opacity', 0.7);
            self._drawLegend();
        },
        _zoom_in: function () {
            var self = this;
            if (self.level < self.max_level) {
                self._zoom_in_level();
            }
            else {
                self._zoom_in_level_lowest();
            }
        },
        _zoom_out: function () {
            var self = this;
            if (self.state_index > 0) {
                self._change_state(self.state_index - 1);
            }
        }
    };
    var contourVis = new ContourVis(options);
    contourVis.init();
    return {
        options: contourVis.settings,
        redraw: function () {
            contourVis.redraw.apply(contourVis, arguments);
        },
        resize: function(){
            contourVis.resize.apply(contourVis, arguments);
        },
        svg_id: function () {
            return contourVis.svg_id.apply(contourVis, arguments);
        },
        data_count: function () {
            return contourVis.data_count.apply(contourVis, arguments);
        },
        export_lasso: function () {
            return contourVis.export_lasso.apply(contourVis, arguments);
        },
        update_highlight_index: function () {
            return contourVis.update_highlight_index.apply(contourVis, arguments);
        },
        highlight_focus_trust_item: function () {
            return contourVis._highlight_focus_trust_item.apply(contourVis, arguments);
        },
        on_click_dots: function () {
            return contourVis._on_click_dots.apply(contourVis, arguments);
        },
        get_model_score_line: function () {
            return contourVis._get_model_score_line.apply(contourVis, arguments);
        },
        change_item_labels: function () {
            return contourVis.change_item_labels.apply(contourVis, arguments);
        },
        update_dot_info: function () {
            return contourVis._update_dot_info.apply(contourVis, arguments);
        },
        set_lasso_result: function () {
            contourVis._set_lasso_result.apply(contourVis, arguments);
        },
        get_lasso_result: function () {
            return contourVis._get_lasso_result.apply(contourVis, arguments);
        },
        get_label_names: function () {
            return contourVis._get_label_names.apply(contourVis, arguments);
        },
        export_label: function () {
            contourVis._export_label.apply(contourVis, arguments);
        },
        reset: function () {
            contourVis._reset.apply(contourVis, arguments);
        },
        add_selected_item_to_trusted_item: function () {
            contourVis._add_selected_item_to_trusted_item.apply(contourVis, arguments);
        },
        label_filter_selection: function () {
            contourVis._label_filter_selection.apply(contourVis, arguments);
        },
        sampling_selection: function () {
            contourVis._sampling_selection.apply(contourVis, arguments);
        },
        change_selected_item_labels: function () {
            contourVis._change_selected_item_labels.apply(contourVis, arguments);
        },
        draw_images: function () {
            contourVis._draw_images.apply(contourVis, arguments);
        },
        zoom_in: function () {
            contourVis._zoom_in.apply(contourVis, arguments);
        },
        zoom_out: function () {
            contourVis._zoom_out.apply(contourVis, arguments);
        },
        set_highlight_item: function () {
            contourVis._set_highlight_item.apply(contourVis, arguments);
        },
        update_label_and_label_names: function () {
            contourVis._update_label_and_label_names.apply(contourVis, arguments);
        },
        change_all_item_labels: function () {
            contourVis._change_all_item_labels.apply(contourVis, arguments);
        }
    };
};

