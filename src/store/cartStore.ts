import { create } from "zustand"

import type { CartItem } from "../types"

type CartState = {
  items: CartItem[]
  setItems: (items: CartItem[]) => void
  addItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
}

const sanitizeQuantity = (value: number) => {
  if (!Number.isFinite(value) || Number.isNaN(value) || value < 1) {
    return 1
  }
  if (value > 99) {
    return 99
  }
  return Math.trunc(value)
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  setItems: (items) =>
    set({
      items: items.map((item) => ({
        id: item.id,
        quantity: sanitizeQuantity(item.quantity)
      }))
    }),
  addItem: (productId) =>
    set((state) => {
      const current = state.items.find((item) => item.id === productId)
      if (!current) {
        return {
          items: [...state.items, { id: productId, quantity: 1 }]
        }
      }

      return {
        items: state.items.map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity: sanitizeQuantity(item.quantity + 1)
              }
            : item
        )
      }
    }),
  setQuantity: (productId, quantity) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity: sanitizeQuantity(quantity)
            }
          : item
      )
    })),
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== productId)
    })),
  clearCart: () => set({ items: [] })
}))
