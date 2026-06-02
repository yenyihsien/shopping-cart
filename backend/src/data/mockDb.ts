import type { Product } from "../../../shared/types/domain.js";

// Backend-authoritative product catalog:
// never trust any unit price from frontend payloads.
export const products: Product[] = [
  {
    id: "beef",
    name: "牛肉",
    category: "meat",
    unit: "份",
    price: 180,
    currency: "TWD",
    inStock: true
  },
  {
    id: "onion",
    name: "洋蔥",
    category: "vegetable",
    unit: "顆",
    price: 35,
    currency: "TWD",
    inStock: true
  },
  {
    id: "tomato",
    name: "番茄",
    category: "vegetable",
    unit: "顆",
    price: 30,
    currency: "TWD",
    inStock: true
  },
  {
    id: "potato",
    name: "馬鈴薯",
    category: "vegetable",
    unit: "顆",
    price: 25,
    currency: "TWD",
    inStock: true
  },
  {
    id: "pasta",
    name: "義大利麵",
    category: "staple",
    unit: "包",
    price: 85,
    currency: "TWD",
    inStock: true
  }
];

export const productPriceMap = new Map(products.map((product) => [product.id, product.price]));
