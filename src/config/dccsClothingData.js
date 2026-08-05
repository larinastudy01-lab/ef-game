// DCCS uses the four available objects. Each object has a normal image and a
// plastic-wrapped image; the latter keeps the existing "bag" rule API intact.
import blueHatImg from "../asset/DCCS/blue hat.webp";
import blueHatPlasticImg from "../asset/DCCS/blue hat_plastic.webp";
import blueShirtImg from "../asset/DCCS/blue shirt.webp";
import blueShirtPlasticImg from "../asset/DCCS/blue shirt_plastic.webp";
import redHatImg from "../asset/DCCS/red hat.webp";
import redHatPlasticImg from "../asset/DCCS/red hat_plastic.webp";
import redShirtImg from "../asset/DCCS/red shirt.webp";
import redShirtPlasticImg from "../asset/DCCS/red shirt_plastic.webp";

export const DCCS_COLORS = Object.freeze(["blue", "red"]);
export const DCCS_TYPES = Object.freeze(["hat", "shirt"]);

export const colorLabels = Object.freeze({ blue: "藍色", red: "紅色" });
export const typeLabels = Object.freeze({ hat: "帽子", shirt: "上衣" });
export const colorClassMap = Object.freeze({
  blue: "dccs-color-blue",
  red: "dccs-color-red",
});
export const colorHexMap = Object.freeze({ blue: "#4f9df8", red: "#e53b3b" });

function createClothingCard(id, color, type, normalImg, bagImg) {
  return Object.freeze({
    id,
    color,
    type,
    colorText: colorLabels[color],
    typeText: typeLabels[type],
    img: normalImg,
    normalImg,
    bagImg,
    hasBagImage: true,
    normalAlt: `${colorLabels[color]}${typeLabels[type]}`,
    bagAlt: `塑膠袋中的${colorLabels[color]}${typeLabels[type]}`,
  });
}

export const dccsClothingCards = Object.freeze([
  createClothingCard("blue_hat", "blue", "hat", blueHatImg, blueHatPlasticImg),
  createClothingCard("blue_shirt", "blue", "shirt", blueShirtImg, blueShirtPlasticImg),
  createClothingCard("red_hat", "red", "hat", redHatImg, redHatPlasticImg),
  createClothingCard("red_shirt", "red", "shirt", redShirtImg, redShirtPlasticImg),
]);

export const allCards = dccsClothingCards;
export const normalCards = dccsClothingCards;
export const baggedCards = Object.freeze(dccsClothingCards.filter((card) => card.bagImg));

const groupCards = (keys, property, cards = dccsClothingCards) =>
  Object.freeze(keys.reduce((groups, key) => {
    groups[key] = Object.freeze(cards.filter((card) => card[property] === key));
    return groups;
  }, {}));

export const cardsByColor = groupCards(DCCS_COLORS, "color");
export const baggedCardsByColor = groupCards(DCCS_COLORS, "color", baggedCards);
export const cardsByType = groupCards(DCCS_TYPES, "type");
export const colorSampleImg = Object.freeze({ blue: blueShirtImg, red: redShirtImg });
export const typeSampleImg = Object.freeze({ hat: blueHatImg, shirt: redShirtImg });

export function getCard(cardId) {
  return dccsClothingCards.find((card) => card.id === String(cardId)) || null;
}

export function getCardsByColor(color, { baggedOnly = false } = {}) {
  if (!DCCS_COLORS.includes(color)) return [];
  return (baggedOnly ? baggedCards : dccsClothingCards).filter((card) => card.color === color);
}

export function getCardsByType(type, { baggedOnly = false } = {}) {
  if (!DCCS_TYPES.includes(type)) return [];
  return (baggedOnly ? baggedCards : dccsClothingCards).filter((card) => card.type === type);
}

export const getBaggedCardsByColor = (color) => getCardsByColor(color, { baggedOnly: true });
export const getBaggedCardsByType = (type) => getCardsByType(type, { baggedOnly: true });
export const hasBagImage = (cardOrId) => Boolean(
  (typeof cardOrId === "string" ? getCard(cardOrId) : cardOrId)?.bagImg
);

export function getCardImage(cardOrId, imageVariant = "normal") {
  const card = typeof cardOrId === "string" ? getCard(cardOrId) : cardOrId;
  if (!card) return null;
  return imageVariant === "bag" ? card.bagImg || card.normalImg : card.normalImg || card.img;
}

export function getCardAlt(cardOrId, imageVariant = "normal") {
  const card = typeof cardOrId === "string" ? getCard(cardOrId) : cardOrId;
  if (!card) return "服飾物件";
  return imageVariant === "bag" && card.bagImg ? card.bagAlt : card.normalAlt;
}

export const getCardsByIds = (cardIds = []) =>
  (Array.isArray(cardIds) ? cardIds : []).map(getCard).filter(Boolean);

export function shuffleCards(cards = [], random = Math.random) {
  const result = Array.isArray(cards) ? [...cards] : [];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

export function getRandomCard({ color = null, type = null, baggedOnly = false, excludeIds = [], random = Math.random } = {}) {
  const excluded = new Set(Array.isArray(excludeIds) ? excludeIds : []);
  const candidates = (baggedOnly ? baggedCards : dccsClothingCards).filter(
    (card) => (!color || card.color === color) && (!type || card.type === type) && !excluded.has(card.id)
  );
  return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null;
}

export function getDifferentTypeCard({ color, excludedType, baggedOnly = false, random = Math.random } = {}) {
  const candidates = (baggedOnly ? baggedCards : dccsClothingCards).filter(
    (card) => card.color === color && card.type !== excludedType
  );
  return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null;
}

export function getSameTypeDifferentColorCard({ type, excludedColor, baggedOnly = false, random = Math.random } = {}) {
  const candidates = (baggedOnly ? baggedCards : dccsClothingCards).filter(
    (card) => card.type === type && card.color !== excludedColor
  );
  return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null;
}

export default dccsClothingCards;
