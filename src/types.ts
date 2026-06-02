import type { CartItem, Order, Product } from "../shared/types/domain"

export type { CartItem, Order, Product }

export type CheckoutResponse = {
  orderId: string
  subtotal: number
  discountAmount: number
  totalAmount: number
  currency: "TWD"
}

export type CouponValidateResponse = {
  valid: true
  promoCode: string
  discountAmount: number
}

export type AIRecipeSuggestion = {
  recipeName: string
  steps: string[]
  missingIngredients: string[]
}

export type AIRecipeSuggestionResponse = {
  recommendations: AIRecipeSuggestion[]
}

export type AuthUser = {
  id: string
  username: string
  email: string
}

export type LoginResponse = {
  token: string
  user: AuthUser
}
