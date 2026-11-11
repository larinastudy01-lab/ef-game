import bluePants from "../asset/DCCS/test01/blue pants.webp";
import bluePantsBag from "../asset/DCCS/test01/blue pants_plastic.webp";
import redPants from "../asset/DCCS/test01/red pants.webp";
import redPantsBag from "../asset/DCCS/test01/red pants_plastic.webp";
import blueSocks from "../asset/DCCS/test01/blue sock.webp";
import blueSocksBag from "../asset/DCCS/test01/blue sock_plastic.webp";
import redSocks from "../asset/DCCS/test01/red sock.webp";
import redSocksBag from "../asset/DCCS/test01/red sock_plastic.webp";
import leftBox01 from "../asset/DCCS/test01/box_left.webp";
import rightBox01 from "../asset/DCCS/test01/box_right.webp";
import blueScarf from "../asset/DCCS/test02/blue scarf.webp";
import blueScarfBag from "../asset/DCCS/test02/blue scarf_plastic.webp";
import redScarf from "../asset/DCCS/test02/red scarf.webp";
import redScarfBag from "../asset/DCCS/test02/red scarf_plastic.webp";
import blueSlippers from "../asset/DCCS/test02/blue slippers.webp";
import blueSlippersBag from "../asset/DCCS/test02/blue slippers_plastic.webp";
import redSlippers from "../asset/DCCS/test02/red slippers.webp";
import redSlippersBag from "../asset/DCCS/test02/red slippers_plastic.webp";
import leftBox02 from "../asset/DCCS/test02/box_left.webp";
import rightBox02 from "../asset/DCCS/test02/box_right.webp";

export const DCCS_ASSESSMENT_TYPE_LABELS = Object.freeze({
  pants: "褲子", socks: "襪子", scarf: "圍巾", slippers: "拖鞋",
});

const card = (color, type, normalImg, bagImg) => Object.freeze({
  id: `${color}_${type}`, color, type,
  colorText: color === "blue" ? "藍色" : "紅色",
  typeText: DCCS_ASSESSMENT_TYPE_LABELS[type],
  img: normalImg, normalImg, bagImg, hasBagImage: true,
});

function version(testVersion, stimulusName, firstType, secondType, cards, leftBox, rightBox) {
  return Object.freeze({
    testVersion, stimulusSetId: `test${testVersion}`, stimulusName,
    types: Object.freeze([firstType, secondType]),
    cards: Object.freeze(cards),
    boxes: Object.freeze({ top: leftBox, bottom: rightBox }),
    // These identities are printed on each version's box artwork.
    boxReferences: Object.freeze({
      top: cards.find((item) => item.color === "blue" && item.type === firstType),
      bottom: cards.find((item) => item.color === "red" && item.type === secondType),
    }),
  });
}

export const DCCS_ASSESSMENT_VERSIONS = Object.freeze({
  "01": version("01", "褲子／襪子", "pants", "socks", [
    card("blue", "socks", blueSocks, blueSocksBag),
    card("blue", "pants", bluePants, bluePantsBag),
    card("red", "socks", redSocks, redSocksBag),
    card("red", "pants", redPants, redPantsBag),
  ], leftBox01, rightBox01),
  "02": version("02", "拖鞋／圍巾", "slippers", "scarf", [
    card("blue", "scarf", blueScarf, blueScarfBag),
    card("blue", "slippers", blueSlippers, blueSlippersBag),
    card("red", "scarf", redScarf, redScarfBag),
    card("red", "slippers", redSlippers, redSlippersBag),
  ], leftBox02, rightBox02),
});

export const getDccsAssessmentVersion = (testVersion) =>
  DCCS_ASSESSMENT_VERSIONS[testVersion] || DCCS_ASSESSMENT_VERSIONS["01"];
