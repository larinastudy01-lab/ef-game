import unclassified01 from "../asset/PM/PM_01.webp";
import unclassified02 from "../asset/PM/PM_02.webp";
import unclassified03 from "../asset/PM/PM_03.webp";
import unclassified04 from "../asset/PM/PM_04.webp";
import unclassified05 from "../asset/PM/PM_05.webp";
import unclassified06 from "../asset/PM/PM_06.webp";
import unclassified07 from "../asset/PM/PM_07.png";
import unclassified08 from "../asset/PM/PM_08.webp";
import unclassified09 from "../asset/PM/PM_09.webp";
import unclassified10 from "../asset/PM/PM_10.webp";
import unclassified11 from "../asset/PM/PM_11.webp";
import unclassified12 from "../asset/PM/PM_12.webp";
import unclassified13 from "../asset/PM/PM_13.webp";
import unclassified14 from "../asset/PM/PM_14.webp";
import unclassified15 from "../asset/PM/PM_15.webp";
import unclassified16 from "../asset/PM/PM_16.webp";
import unclassified17 from "../asset/PM/PM_17.webp";
import unclassified18 from "../asset/PM/PM_18.webp";
import unclassified19 from "../asset/PM/PM_19.webp";
import unclassified20 from "../asset/PM/PM_20.webp";
import unclassified21 from "../asset/PM/PM_21.webp";
import unclassified22 from "../asset/PM/PM_22.webp";
import unclassified23 from "../asset/PM/PM_23.webp";
import unclassified24 from "../asset/PM/PM_24.webp";
import unclassified25 from "../asset/PM/PM_25.webp";
import unclassified26 from "../asset/PM/PM_26.webp";
import car01 from "../asset/PM/car/PM_01.webp";
import car02 from "../asset/PM/car/PM_02.webp";
import car03 from "../asset/PM/car/PM_03.webp";
import car04 from "../asset/PM/car/PM_04.webp";
import car05 from "../asset/PM/car/PM_05.webp";
import car06 from "../asset/PM/car/PM_06.webp";
import car07 from "../asset/PM/car/PM_07.webp";
import clothes01 from "../asset/PM/clothes/PM_01.webp";
import clothes02 from "../asset/PM/clothes/PM_02.webp";
import clothes03 from "../asset/PM/clothes/PM_03.webp";
import clothes04 from "../asset/PM/clothes/PM_04.webp";
import clothes05 from "../asset/PM/clothes/PM_05.webp";
import clothes06 from "../asset/PM/clothes/PM_06.webp";
import clothes07 from "../asset/PM/clothes/PM_07.webp";
import clothes08 from "../asset/PM/clothes/PM_08.webp";
import furniture01 from "../asset/PM/furniture/PM_01.webp";
import furniture02 from "../asset/PM/furniture/PM_02.webp";
import furniture03 from "../asset/PM/furniture/PM_03.webp";
import furniture04 from "../asset/PM/furniture/PM_04.webp";
import furniture05 from "../asset/PM/furniture/PM_05.webp";
import furniture06 from "../asset/PM/furniture/PM_06.webp";
import furniture07 from "../asset/PM/furniture/PM_07.webp";
import furniture08 from "../asset/PM/furniture/PM_08.webp";
import furniture09 from "../asset/PM/furniture/PM_09.webp";
import furniture10 from "../asset/PM/furniture/PM_10.webp";
import furniture11 from "../asset/PM/furniture/PM_11.webp";
import furniture12 from "../asset/PM/furniture/PM_12.webp";
import furniture13 from "../asset/PM/furniture/PM_13.webp";
import furniture14 from "../asset/PM/furniture/PM_14.webp";
import furniture15 from "../asset/PM/furniture/PM_15.webp";
import furniture16 from "../asset/PM/furniture/PM_16.webp";
import furniture17 from "../asset/PM/furniture/PM_17.webp";
import food01 from "../asset/PM/food/PM_01.webp";
import food02 from "../asset/PM/food/PM_02.webp";
import food03 from "../asset/PM/food/PM_03.webp";
import food04 from "../asset/PM/food/PM_04.webp";
import food05 from "../asset/PM/food/PM_05.webp";
import food06 from "../asset/PM/food/PM_06.webp";
import food07 from "../asset/PM/food/PM_07.webp";
import food08 from "../asset/PM/food/PM_08.webp";
import food09 from "../asset/PM/food/PM_09.webp";
import food10 from "../asset/PM/food/PM_10.webp";
import food11 from "../asset/PM/food/PM_11.webp";
import food12 from "../asset/PM/food/PM_12.webp";
import food13 from "../asset/PM/food/PM_13.webp";
import food14 from "../asset/PM/food/PM_14.webp";
import food15 from "../asset/PM/food/PM_15.webp";
import ball01 from "../asset/PM/ball/PM_01.webp";
import ball02 from "../asset/PM/ball/PM_02.webp";
import ball03 from "../asset/PM/ball/PM_03.webp";
import ball04 from "../asset/PM/ball/PM_04.webp";
import ball05 from "../asset/PM/ball/PM_05.webp";
import ball06 from "../asset/PM/ball/PM_06.webp";
import ball07 from "../asset/PM/ball/PM_07.webp";
import ball08 from "../asset/PM/ball/PM_08.webp";

export const PM_ASSET_CATALOG_VERSION = "2.0.0";
export const PM_TEST_CATEGORIES = Object.freeze(["car", "furniture", "clothes"]);
export const PM_TRAINING_CATEGORIES = Object.freeze(["food", "ball"]);

function items(categoryKey, categoryLabel, images, descriptions, visualGroups, folder) {
  return images.map((image, index) => {
    const number = String(index + 1).padStart(2, "0");
    const group = visualGroups.find(([, , indices]) => indices.includes(index + 1));
    return Object.freeze({
      id: `PM_${categoryKey.toUpperCase()}_${number}`,
      image, alt: descriptions[index], categoryKey, categoryLabel,
      assetCategoryKey: categoryKey,
      sourcePath: `PM/${folder ? folder + "/" : ""}PM_${number}.${categoryKey === "unclassified" && number === "07" ? "png" : "webp"}`,
      similarityGroup: group?.[0] || null, similarityDefinition: group?.[1] || null,
    });
  });
}

export const PM_ASSET_ITEMS = Object.freeze([
  ...items("unclassified", "未分類", [unclassified01, unclassified02, unclassified03, unclassified04, unclassified05, unclassified06, unclassified07, unclassified08, unclassified09, unclassified10, unclassified11, unclassified12, unclassified13, unclassified14, unclassified15, unclassified16, unclassified17, unclassified18, unclassified19, unclassified20, unclassified21, unclassified22, unclassified23, unclassified24, unclassified25, unclassified26],
    ["藍色水壺","紫色禮物盒","金色湯匙","金色筷子","金色叉子","綠色葉子","黃色小鴨玩偶","彩虹吊飾","粉紅色兔子玩偶","藍色熊玩偶","紫色狗玩偶","紫色鬧鐘","白色雲朵","黃色太陽","藍色馬克杯","粉紅色茶壺","綠色手套","藍色手電筒","彩色調色盤","藍色紙杯","綠色扇子","動物繪本","藍色梳子","紫色衛生紙盒","花朵鈴鐺","彩色木琴"], [["handled_utensils","湯匙與叉子的長柄輪廓相近",[3,5]]], ""),
  ...items("car", "交通工具", [car01, car02, car03, car04, car05, car06, car07],
    ["黃色計程車","彩色火車","橘色大貨車","藍綠色高速列車","藍色小貨車","彩色機車","彩色腳踏車"], [["trucks","貨車的駕駛室與載貨結構相近",[3,5]]], "car"),
  ...items("clothes", "穿戴配件", [clothes01, clothes02, clothes03, clothes04, clothes05, clothes06, clothes07, clothes08],
    ["奶黃色皮鞋","綠色圓面手錶","紫色貝雷帽","彩色運動鞋","奶黃色短靴","紫色方面手錶","紫色棒球帽","粉紅色漁夫帽"], [["shoes","鞋子的輪廓與結構相近",[1,4,5]],["watches","手錶的錶面與錶帶結構相近",[2,6]],["hats","帽子的輪廓相近，款式不同",[3,7,8]]], "clothes"),
  ...items("furniture", "家具", [furniture01, furniture02, furniture03, furniture04, furniture05, furniture06, furniture07, furniture08, furniture09, furniture10, furniture11, furniture12, furniture13, furniture14, furniture15, furniture16, furniture17],
    ["盆栽床頭櫃","綠色熊相框","黃色小鴨相框","粉紅色熊相框","綠色風景掛畫","綠色兔子相框","黃色彩虹掛畫","盆栽層架","粉紅色矮櫃","藍色沙發","粉紅色圓凳","奶黃色桌子","黃色立燈","粉紅色毛巾架","藍色玩具收納箱","紫色書櫃","粉紅色衣櫃"], [["photo_frames","直立相框的外框與支架結構相近",[2,3,4,6]],["wall_pictures","吊掛畫框的輪廓相近",[5,7]]], "furniture"),
  ...items("food", "食物", [food01, food02, food03, food04, food05, food06, food07, food08, food09, food10, food11, food12, food13, food14, food15],
    ["紫色奶油蛋糕","彩色棒棒糖","莓果果醬","三明治","玉米","西瓜","巧克力蛋糕","草莓蛋糕","胡蘿蔔","香蕉","草莓","粉紅色飲料盒","起司","黃色甜椒","綜合餅乾"], [["cakes","蛋糕的外形與層狀結構相近",[1,7,8]]], "food"),
  ...items("ball", "球具", [ball01, ball02, ball03, ball04, ball05, ball06, ball07, ball08],
    ["籃球","網球","排球","棒球","粉彩玩具球","保齡球","紫色撞球","羽毛球"], [], "ball"),
]);

