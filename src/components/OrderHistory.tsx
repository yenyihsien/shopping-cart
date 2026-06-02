import { ReceiptText, RefreshCcw } from "lucide-react"

import type { Order, Product } from "../types"

type OrderHistoryProps = {
  orders: Order[]
  products: Product[]
  isLoading: boolean
  onRefresh: () => void
}

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
})

export function OrderHistory({ orders, products, isLoading, onRefresh }: OrderHistoryProps) {
  const productMap = new Map(products.map((product) => [product.id, product]))

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-900">歷史訂單</h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          重新載入
        </button>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">訂單載入中...</p> : null}

      {!isLoading && orders.length === 0 ? <p className="text-sm text-slate-500">目前沒有歷史訂單。</p> : null}

      {!isLoading && orders.length > 0 ? (
        <ul className="max-h-80 space-y-3 overflow-auto pr-1">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{order.id}</p>
                  <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString("zh-TW")}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">{order.status}</span>
              </div>
              <ul className="mb-2 list-disc pl-5 text-xs text-slate-600">
                {order.items.map((item) => (
                  <li key={`${order.id}-${item.id}`}>
                    {(productMap.get(item.id)?.name ?? item.id)} x {item.quantity}
                  </li>
                ))}
              </ul>
              <p className="text-sm font-medium text-slate-800">總計：{currency.format(order.total)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
