let SettingLayout = function () {
    let that = this;
    // ui
    let dataset_selection_util = null;
    let form = null;
    let pulldown_id = "#pulldown";
    let update_k_btn = null;
    let now_dataset = null;
    let rangeSlider = null;
    let slider = null;
    let range = null;
    let value = null;

    let send_setk_request = {};
    let send_setk_cnt = 0;
    let k = 0;
    let AnimationDuration = 1000;

    that._init = function () {
		dataset_selection_util = {
	f: {
		addStyle: function (elem, prop, val, vendors) {
			var i, ii, property, value
			if (!dataset_selection_util.f.isElem(elem)) {
				elem = document.getElementById(elem)
			}
			if (!dataset_selection_util.f.isArray(prop)) {
				prop = [prop]
				val = [val]
			}
			for (i = 0; i < prop.length; i += 1) {
				var thisProp = String(prop[i]),
					thisVal = String(val[i])
				if (typeof vendors !== "undefined") {
					if (!dataset_selection_util.f.isArray(vendors)) {
						vendors.toLowerCase() == "all" ? vendors = ["webkit", "moz", "ms", "o"] : vendors = [vendors]
					}
					for (ii = 0; ii < vendors.length; ii += 1) {
						elem.style[vendors[i] + thisProp] = thisVal
					}
				}
				thisProp = thisProp.charAt(0).toLowerCase() + thisProp.slice(1)
				elem.style[thisProp] = thisVal
			}
		},
		cssLoaded: function (event) {
			var child = dataset_selection_util.f.getTrg(event)
			child.setAttribute("media", "all")
		},
		events: {
			cancel: function (event) {
				dataset_selection_util.f.events.prevent(event)
				dataset_selection_util.f.events.stop(event)
			},
			prevent: function (event) {
				event = event || window.event
				event.preventDefault()
			},
			stop: function (event) {
				event = event || window.event
				event.stopPropagation()
			}
		},
		getSize: function (elem, prop) {
			return parseInt(elem.getBoundingClientRect()[prop], 10)
		},
		getTrg: function (event) {
			event = event || window.event
			if (event.srcElement) {
				return event.srcElement
			} else {
				return event.target
			}
		},
		isElem: function (elem) {
			return (dataset_selection_util.f.isNode(elem) && elem.nodeType == 1)
		},
		isArray: function(v) {
			return (v.constructor === Array)
		},
		isNode: function(elem) {
			return (typeof Node === "object" ? elem instanceof Node : elem && typeof elem === "object" && typeof elem.nodeType === "number" && typeof elem.nodeName==="string" && elem.nodeType !== 3)
		},
		isObj: function (v) {
			return (typeof v == "object")
		},
		replaceAt: function(str, index, char) {
			return str.substr(0, index) + char + str.substr(index + char.length);
		}
	}
};

		form = {
f: {
	init: {
		register: function () {
			var child, children = document.getElementsByClassName("field"), i
			for (i = 0; i < children.length; i += 1) {
				child = children[i]
				dataset_selection_util.f.addStyle(child, "Opacity", 1)
			}
			children = document.getElementsByClassName("psuedo_select")
			for (i = 0; i < children.length; i += 1) {
				child = children[i]
				child.addEventListener("click", form.f.select.toggle)
			}
		},
		unregister: function () {
			//just here as a formallity
			//call this to stop all ongoing timeouts are ready the page for some sort of json re-route
		}
	},
	select: {
		blur: function (field) {
			field.classList.remove("focused")
			var child, children = field.childNodes, i, ii, nested_child, nested_children
			for (i = 0; i < children.length; i += 1) {
				child = children[i]
				if (dataset_selection_util.f.isElem(child)) {
					if (child.classList.contains("deselect")) {
						child.parentNode.removeChild(child)
					} else if (child.tagName == "SPAN") {
						if (!field.dataset.value) {
							dataset_selection_util.f.addStyle(child, ["FontSize", "Top"], ["16px", "32px"])
						}
					} else if (child.classList.contains("psuedo_select")) {
						nested_children = child.childNodes
						for (ii = 0; ii < nested_children.length; ii += 1) {
							nested_child = nested_children[ii]
							if (dataset_selection_util.f.isElem(nested_child)) {
								if (nested_child.tagName == "SPAN") {
									if (!field.dataset.value) {
										dataset_selection_util.f.addStyle(nested_child, ["Opacity", "Transform"], [0, "translateY(24px)"])
									}
								} else if (nested_child.tagName == "UL") {
										dataset_selection_util.f.addStyle(nested_child, ["Height", "Opacity"], [0, 0])
								}
							}
						}
					}
				}
			}
		},
		focus: function (field) {
			field.classList.add("focused")
			var bool = false, child, children = field.childNodes, i, ii, iii, nested_child, nested_children, nested_nested_child, nested_nested_children, size = 0
			for (i = 0; i < children.length; i += 1) {
				child = children[i]
				dataset_selection_util.f.isElem(child) && child.classList.contains("deselect") ? bool = true : null
			}
			if (!bool) {
				child = document.createElement("div")
				child.className = "deselect"
				child.addEventListener("click", form.f.select.toggle)
				field.insertBefore(child, children[0])
			}
			for (i = 0; i < children.length; i += 1) {
				child = children[i]
				if (dataset_selection_util.f.isElem(child) && child.classList.contains("psuedo_select")) {
					nested_children = child.childNodes
					for (ii = 0; ii < nested_children.length; ii += 1) {
						nested_child = nested_children[ii]
						if (dataset_selection_util.f.isElem(nested_child) && nested_child.tagName == "UL") {
							size = 0
							nested_nested_children = nested_child.childNodes
							for (iii = 0; iii < nested_nested_children.length; iii += 1) {
								nested_nested_child = nested_nested_children[iii]
								if (dataset_selection_util.f.isElem(nested_nested_child) && nested_nested_child.tagName == "LI") {
									size += dataset_selection_util.f.getSize(nested_nested_child, "height")
								}
							}
							dataset_selection_util.f.addStyle(nested_child, ["Height", "Opacity"], [size + "px", 1])
						}
					}
				}
			}
		},
		selection: function (child, parent) {
			var children = parent.childNodes, i, ii, nested_child, nested_children, time = 0, value
			if (dataset_selection_util.f.isElem(child) && dataset_selection_util.f.isElem(parent)) {
				parent.dataset.value = child.dataset.value
				value = child.innerHTML
			}
			for (i = 0; i < children.length; i += 1) {
				child = children[i]
				if (dataset_selection_util.f.isElem(child)) {
					if (child.classList.contains("psuedo_select")) {
						nested_children = child.childNodes
						for (ii = 0; ii < nested_children.length; ii += 1) {
							nested_child = nested_children[ii]
							if (dataset_selection_util.f.isElem(nested_child) && nested_child.classList.contains("selected")) {
								if (nested_child.innerHTML)  {
									time = 1E2
									dataset_selection_util.f.addStyle(nested_child, ["Opacity", "Transform"], [0, "translateY(24px)"], "all")
								}
								setTimeout(function (c, v) {
									c.innerHTML = v
									dataset_selection_util.f.addStyle(c, ["Opacity", "Transform", "TransitionDuration"], [1, "translateY(0px)", ".1s"], "all")
								}, time, nested_child, value)
							}
						}
					} else if (child.tagName == "SPAN" && child.className !== "pulldown-icon") {
						console.log(child.tagName);
						dataset_selection_util.f.addStyle(child, ["FontSize", "Top"], ["12px", "8px"])
				   }
			   }
			}
		},
		toggle: function (event) {
			dataset_selection_util.f.events.stop(event)
			var child = dataset_selection_util.f.getTrg(event), children, i, parent
			if($(child).attr("class") === "option"){
				that.choose($(child).attr("id"));
			}
			switch (true) {
				case (child.classList.contains("psuedo_select")):
				case (child.classList.contains("deselect")):
					parent = child.parentNode
					break
				case (child.classList.contains("options")):
					parent = child.parentNode.parentNode
					break
				case (child.classList.contains("option")):
					parent = child.parentNode.parentNode.parentNode
					form.f.select.selection(child, parent)
					break
			}
			parent.classList.contains("focused") ? form.f.select.blur(parent) : form.f.select.focus(parent)
		}
	}
}};

		form.f.init.register();

// 		rangeSlider = function(){
//   	 slider = $('.range-slider');
//       range = $('.range-slider__range');
//       value = $('.range-slider__value');

//   slider.each(function(){

//     value.each(function(){
//       var value = $(this).prev().attr('value');
//       $(this).html(value);
//     });

//     range.on('input', function(){
//       $(this).next(value).html(this.value);
//       k=parseInt(this.value);
// 		if(update_k_btn.attr("opacity") == 0){
// 			update_k_btn.attr("cursor", "pointer");
// 			update_k_btn
// 				.transition()
// 				.duration(AnimationDuration)
// 				.attr("opacity", 1);
// 		}
//     });
//   });
// };

// 		rangeSlider();

		// global slider
		$("#global-k").slider(
			{ 
				id: "slider1", 
				min: 1, 
				max: 12, 
				range: false, 
				value: 3
			});
		$("#global-k").on("slide", function(slideEvt) {
			$("#k-value").text(slideEvt.value);
		}); 

		// local slider
		$("#local-k").slider(
			{ 
				id: "slider2", 
				min: 1, 
				max: 12, 
				range: true, 
				value: [3,7]
			});

		that.update_k_btn_init();

    };

    that.choose = function (dataset){
    	if(dataset === now_dataset) return;
    	now_dataset = dataset;
    	$(".pulldown-dataset").click();
    	$("#"+dataset).click();
    	choose(dataset);
	};


    that.setk_ui = function(k) {
		
	};

    that.update_k_btn_init = function(){
    	update_k_btn = d3.select(".range-slider__update");
    	update_k_btn.select("rect").on("click", function () {
			if(update_k_btn.attr("opacity") != 1)return;
				update_k_btn.attr("cursor", "default");
				update_k_btn
					.transition()
					.duration(AnimationDuration)
					.attr("opacity", "0");
				DataLoader.update_k(k);
		})
			.on("mouseover", function () {
				update_k_btn.selectAll("path").attr("opacity", 1);
			})
			.on("mouseout", function () {
				update_k_btn.selectAll("path").attr("opacity", 0.7);
			})
	};

    that.init = function () {
        that._init();
    }.call();
};