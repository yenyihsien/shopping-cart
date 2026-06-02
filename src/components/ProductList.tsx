import { Plus } from "lucide-react"

import type { Product } from "../types"

type ProductListProps = {
  products: Product[]
  onAddToCart: (productId: string) => void
  disabled?: boolean
}

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
})

export function ProductList({ products, onAddToCart, disabled = false }: ProductListProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">商品列表</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {products.map((product) => (
          <article
            key={product.id}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
              <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">{product.unit}</span>
            </div>
            <p className="mb-3 text-sm text-slate-500">分類：{product.category}</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-emerald-700">{currency.format(product.price)}</p>
              <button
                type="button"
                onClick={() => onAddToCart(product.id)}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                加入
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
