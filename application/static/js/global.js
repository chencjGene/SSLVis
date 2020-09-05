/*
* added by Changjian Chen, 20191015
* */

/*
    System information
*/
let ManifestApi = "/api/manifest";


/*
*  View Object
* */
let ConceptGraphView = null;
let FilterView = null;
let InstanceView = null;
let SearchView = null;

/*
    Const variables for data storage
*/
let DatasetName = null;
let DataLoader = null;
let GraphView = null;
let LossView = null;
let ImageView = null;
let HistoryView = null;
let EditView = null;
let SettingView = null;

let DataName = null;
debug = false;
/*
*  Color
* */
// let CategoryColor = [
//     "#4fa7ff",
//     "#ffa953",
//     "#55ff99",
//     "#ba9b96",
//     "#c982ce",
//     "#bcbd22",
//     "#e377c2",
//     "#990099",
//     "#17becf",
//     "#8c564b"
// ];


// stl
let CategoryColor_stl = [
    "#8c564b",
    "#ff7f0e",
    "#9467bd",
    "#d62728",
    "#1f77b4",
    "#2ca02c",
    "#e377c2",
    "#ffdb45",
    "#bcbd22",
    "#17becf",
    "#a6cee3"];


let CategoryColor = CategoryColor_stl;

// oct
let CategoryColor_oct = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#8c564b",
    "#17becf",
    "#e377c2",
    "#ffdb45",
    "#bcbd22",
    "#9467bd"];

let set_color = function(){
    if(DataName === "stl"){
        CategoryColor = CategoryColor_stl;
    }
    else{
        CategoryColor = CategoryColor_oct;
    }
}

    // "#a6cee3",
    // "#b2df8a"];

// let CategoryColor = ["#a6cee3",
//     "#1f78b4",
//     "#b2df8a",
//     "#33a02c",
//     "#fb9a99",
//     "#e31a1c",
//     "#fdbf6f",
//     "#ff7f00",
//     "#cab2d6",
//     "#6a3d9a",
//     "#ffff99",
// //     "#b15928"];

let UnlabeledColor = "#A9A9A9";

// 蓝色
// ["#deebf7",
// "#60a9ce",
// "#225982"],

// 橙色
//     ["#fef2e6",
//     "#fd9036",
//     "#f36c29"]

// ["#dfefff",
// "#4fa7ff",
// "#0063c6"], //蓝色
//
// ["#ffe5cc",
// "#ffa953",
// "#cc6600"], // 橙色； shixia


let CategorySequentialColor = [
    ["#c8e3ff",
        "#4fa7ff",
        "#0063c6"], //蓝色

    ["#ffe5cc",
        "#ffa953",
        "#cc6600"], //

    ["#bfffd9",
        "#22ff7a",
        "#00993e"], //

    ["#e6dbd9",
        "#ba9b96",
        "#7a5650"], //

    ["#ecd3ed",
        "#c982ce",
        "#8b3892"], //
];

let ThemeColor = "#9bcbff";
let Gray = "#a8a8a8";
let testColor = "#7f7f7f";
let FontColor = "#333333";

/*
    variables that debug needed
*/
AnimationDuration = 1500;


/*
    Keyboard status
 */
let ControlPressed = false;


let ClickFlag = null;

