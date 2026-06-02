import { Minus, Plus, Trash2 } from "lucide-react"

import type { CartItem, Product } from "../types"

type CartListProps = {
  isAuthenticated: boolean
  items: CartItem[]
  products: Product[]
  promoCode: string
  onPromoCodeChange: (value: string) => void
  isCouponValidating: boolean
  onValidateCoupon: () => void
  onQuantityChange: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
  isCheckoutLoading: boolean
  onCheckout: () => void
  checkoutMessage: string
}

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
})

const parseQuantityInput = (raw: string) => {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 1) {
    return 1
  }
  if (parsed > 99) {
    return 99
  }
  return Math.trunc(parsed)
}

export function CartList({
  isAuthenticated,
  items,
  products,
  promoCode,
  onPromoCodeChange,
  isCouponValidating,
  onValidateCoupon,
  onQuantityChange,
  onRemove,
  isCheckoutLoading,
  onCheckout,
  checkoutMessage
}: CartListProps) {
  const productMap = new Map(products.map((product) => [product.id, product]))

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">購物車</h2>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">共 {items.length} 種品項</span>
      </div>

      {!isAuthenticated ? (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">請先登入後再管理個人購物車。</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">目前購物車是空的，先加入食材吧。</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const product = productMap.get(item.id)
            if (!product) {
              return null
            }

            return (
              <li key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-slate-800">{product.name}</p>
                  <p className="text-sm text-slate-500">{currency.format(product.price)}</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                      disabled={!isAuthenticated}
                      className="rounded-md border border-slate-300 p-1 text-slate-700 hover:bg-slate-100"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm outline-none ring-emerald-200 focus:ring"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(event) => onQuantityChange(item.id, parseQuantityInput(event.target.value))}
                      disabled={!isAuthenticated}
                    />
                    <button
                      type="button"
                      onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                      disabled={!isAuthenticated}
                      className="rounded-md border border-slate-300 p-1 text-slate-700 hover:bg-slate-100"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    disabled={!isAuthenticated}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    移除
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-5 rounded-lg bg-slate-50 p-4">
        <label htmlFor="promo-code" className="mb-2 block text-sm font-medium text-slate-700">
          優惠碼
        </label>
        <div className="flex gap-2">
          <input
            id="promo-code"
            maxLength={20}
            value={promoCode}
            onChange={(event) => onPromoCodeChange(event.target.value)}
            disabled={!isAuthenticated}
            placeholder="例如 FREE100"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-200 focus:ring"
          />
          <button
            type="button"
            onClick={onValidateCoupon}
            disabled={isCouponValidating || !isAuthenticated}
            className="rounded-md border border-indigo-300 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
          >
            {isCouponValidating ? "驗證中" : "驗證"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={isCheckoutLoading || items.length === 0 || !isAuthenticated}
        className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {isCheckoutLoading ? "結算中..." : "結帳"}
      </button>
      {checkoutMessage ? <p className="mt-3 text-sm text-slate-700">{checkoutMessage}</p> : null}
    </section>
  )
}
