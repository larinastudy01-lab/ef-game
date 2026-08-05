// 家具售價統一放在這裡；之後定價只需修改 price。
// 未個別設定的家具會使用 DEFAULT_FURNITURE_PRICE。
export const DEFAULT_FURNITURE_PRICE = 100;

export const FURNITURE_PRICES = {
  bed01: 120,
  chair_bear: 80,
  bookshelf: 100,
  flower_rug: 90,
  table_lamp: 70,
};

export const getFurniturePrice = (id) =>
  Math.max(0, Number(FURNITURE_PRICES[id] ?? DEFAULT_FURNITURE_PRICE));
