export interface Product {
  id: string;
  name: string;
  category: "meat" | "vegetable" | "staple" | "other";
  unit: string;
  price: number;
  currency: "TWD";
  inStock: boolean;
}

export interface CartItem {
  id: string;
  quantity: number;
}

export interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  ingredients: Array<{
    productId: string;
    quantity: number;
    note?: string;
  }>;
  createdAt: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  promoCode?: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  currency: "TWD";
  status: "pending" | "paid" | "cancelled";
  createdAt: string;
}
