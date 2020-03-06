/*
* added by Changjian Chen, 20191015
* */

function number_format (number, decimals, dec_point, thousands_sep) {
    // http://kevin.vanzonneveld.net
    // +   original by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +     bugfix by: Michael White (http://getsprink.com)
    // +     bugfix by: Benjamin Lupton
    // +     bugfix by: Allan Jensen (http://www.winternet.no)
    // +    revised by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // +     bugfix by: Howard Yeend
    // +    revised by: Luke Smith (http://lucassmith.name)
    // +     bugfix by: Diogo Resende
    // +     bugfix by: Rival
    // +      input by: Kheang Hok Chin (http://www.distantia.ca/)
    // +   improved by: davook
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +      input by: Jay Klehr
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +      input by: Amir Habibi (http://www.residence-mixte.com/)
    // +     bugfix by: Brett Zamir (http://brett-zamir.me)
    // +   improved by: Theriault
    // +      input by: Amirouche
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // *     example 1: number_format(1234.56);
    // *     returns 1: '1,235'
    // *     example 2: number_format(1234.56, 2, ',', ' ');
    // *     returns 2: '1 234,56'
    // *     example 3: number_format(1234.5678, 2, '.', '');
    // *     returns 3: '1234.57'
    // *     example 4: number_format(67, 2, ',', '.');
    // *     returns 4: '67,00'
    // *     example 5: number_format(1000);
    // *     returns 5: '1,000'
    // *     example 6: number_format(67.311, 2);
    // *     returns 6: '67.31'
    // *     example 7: number_format(1000.55, 1);
    // *     returns 7: '1,000.6'
    // *     example 8: number_format(67000, 5, ',', '.');
    // *     returns 8: '67.000,00000'
    // *     example 9: number_format(0.9, 0);
    // *     returns 9: '1'
    // *    example 10: number_format('1.20', 2);
    // *    returns 10: '1.20'
    // *    example 11: number_format('1.20', 4);
    // *    returns 11: '1.2000'
    // *    example 12: number_format('1.2000', 3);
    // *    returns 12: '1.200'
    // *    example 13: number_format('1 000,50', 2, '.', ' ');
    // *    returns 13: '100 050.00'
    // Strip all characters but numerical ones.
    number = (number + '').replace(/[^0-9+\-Ee.]/g, '');
    var n = !isFinite(+number) ? 0 : +number,
        prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
        sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
        dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
        s = '',
        toFixedFix = function (n, prec) {
            var k = Math.pow(10, prec);
            return '' + Math.round(n * k) / k;
        };
    // Fix for IE parseFloat(0.55).toFixed(0) = 0;
    s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
    if (s[0].length > 3) {
        s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
    }
    if ((s[1] || '').length < prec) {
        s[1] = s[1] || '';
        s[1] += new Array(prec - s[1].length + 1).join('0');
    }
    return s.join(dec);
}

let star_path = function(out_radius, inner_radius, center_x, center_y) {
    // added by changjian, 201912251013
    // generating star shape in a path format
    let svgdata='M ' + center_x + ' ' + center_y + '\n';
    let npoints = 5;
    let baseAngle = Math.PI / npoints;
    let counter = 0;
    let oddeven = 0;
    let r = 0;
    let cmd = '';
    let x = 0;
    let y = 0;
    let yangle = 0;
    let skew = 0;
    for (i = 0; i <= Math.PI * 2; i += baseAngle) {
        if (oddeven === 0) {
            /* Start on inner radius. */
            r = inner_radius;
            oddeven = 1;
            yangle = i;
        }
        else {
            /* Even points on outer radius. */
            r = out_radius;
            oddeven = 0;
            yangle = i + (baseAngle * skew);
        }

        if (counter === 0) {
            cmd = 'M';
        }
        else {
            cmd = 'L';
        }

        xsvg = number_format((r * Math.sin(i)) + center_x, 3, '.', '');
        ysvg = number_format((r * Math.cos(yangle)) + center_y, 3, '.', '');

        svgdata += cmd + ' ' + xsvg + ' ' + ysvg + '\n';

        counter++;
    }
    return svgdata;
};

let twoD_sum = function(mat){
    let sum = 0;
    for (let i = 0; i < mat.length; i++){
        for (let j = 0; j < mat[i].length; j++){
            sum = sum + mat[i][j];
        }
    }
    return sum;
};

let oneD_sum = function(vec){
    let sum = 0;
    for (let i = 0; i < vec.length; i++){
        sum += vec[i];
    }
    return sum;
};


let curve_mid = function (u, v) {
        let mid = [(u[0]+v[0])/2, (u[1]+v[1])/2];
        // console.log(Math.sqrt(Math.pow(u[0]-v[0], 2), Math.pow(u[1]-v[1], 2)))
        // let c = Math.sqrt(Math.pow(u[0]-v[0], 2), Math.pow(u[1]-v[1], 2))*0.3;
        let c = 40+(Math.random()-0.5)*5;
        if(u[1] === v[1]) {
            u[1] += 0.00005
        }
        let tmp = Math.sqrt(c/(1+Math.pow((u[0]-v[0])/(u[1]-v[1]), 2)));
        let res_x1 = tmp+(u[0]+v[0])/2;
        let res_x2 = -tmp+(u[0]+v[0])/2;
        let res_y1 = (u[0]-v[0])*(res_x1-(u[0]+v[0])/2)/(v[1]-u[1])+(u[1]+v[1])/2;
        let res_y2 = (u[0]-v[0])*(res_x2-(u[0]+v[0])/2)/(v[1]-u[1])+(u[1]+v[1])/2;
        if((res_x1-(u[0]+v[0])/2)*(v[1]-u[1])-(v[0]-u[0])*(res_y1-(u[1]+v[1])/2) < 0){
            return [res_x1, res_y1]
        }
        else {
            return [res_x2, res_y2]
        }
}

function deepCopy(obj) {
    let _obj = Array.isArray(obj) ? [] : {}
    for (let i in obj) {
      _obj[i] = typeof obj[i] === 'object' ? deepCopy(obj[i]) : obj[i]
    }
    return _obj
  }

String.prototype.format = String.prototype.f = function () {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

function change_path(sp, ep, hspace, vspace){
    let c1 = {
        x: sp.x,
        y: sp.y + vspace
    };
    let c2 = {
        x: sp.x - hspace,
        y: sp.y
    };
    let c3 = {
        x: ep.x - hspace,
        y: ep.y 
    };
    let c4 = {
        x: ep.x,
        y: ep.y - vspace
    };
    let m1 = {
        x: sp.x - hspace,
        y: sp.y + vspace
    };
    let m2 = {
        x: ep.x - hspace,
        y: ep.y - vspace
    };
    return "M {0}, {1} C {2}, {3} {4}, {5} {6}, {7} L {8} {9} C {10}, {11} {12}, {13} {14}, {15}".format(
        sp.x, sp.y, c1.x, c1.y, c2.x,
        c2.y, m1.x, m1.y, m2.x, m2.y, 
        c3.x, c3.y, c4.x, c4.y, ep.x, ep.y
    )
}

function change_straight(sp, ep){
    return "M {0}, {1} L {2}, {3}".format(
        sp.x, sp.y, ep.x, ep.y
    )
}

function zip(rows){
    return rows[0].map((_,c)=>rows.map(row=>row[c]));
}

function set_font(selection) {
    selection.attr("font-family", '"Helvetica Neue", Helvetica, Arial, sans-serif')
        .attr("font-size", "14px")
        .attr("font-weight", 700)
        .attr("color", "#333333")
}


Array.prototype.delRepeat=function(){
    var newArray=[];
    var provisionalTable = {};
    for (var i = 0, item; (item= this[i]) != null; i++) {
    if (!provisionalTable[item]) {
    newArray.push(item);
    provisionalTable[item] = true;
    }
    }
    return newArray;
    }