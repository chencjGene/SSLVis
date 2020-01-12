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
let CategoryColor = ["#1f77b4",
    "#ff7f0e", "#2ca02c",
    "#d62728", "#9467bd",
    "#8c564b", "#e377c2",
    "#ffdb45", "#bcbd22", "#17becf"];

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
let AnimationDuration = 500;


/*
    Keyboard status
 */
let ControlPressed = false;


let ClickFlag = null;

