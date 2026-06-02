import axios from "axios"
import { ShoppingCart } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { AIErrorBoundary } from "./components/AIErrorBoundary"
import { AIResultPanel } from "./components/AIResultPanel"
import { CartList } from "./components/CartList"
import { OrderHistory } from "./components/OrderHistory"
import { ProductList } from "./components/ProductList"
import { useCartStore } from "./store/cartStore"
import type { AuthUser, CheckoutResponse, CouponValidateResponse, LoginResponse, Order, Product } from "./types"

const api = axios.create({
  baseURL: "/api",
  timeout: 10000
})

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
})

const getCartSnapshotKey = (userId?: string) => (userId ? `cartSnapshot:${userId}` : "cartSnapshot:guest")

const mergeCartItems = (
  localItems: Array<{ id: string; quantity: number }>,
  remoteItems: Array<{ id: string; quantity: number }>
) => {
  const merged = new Map<string, number>()
  localItems.forEach((item) => {
    const current = merged.get(item.id) ?? 0
    merged.set(item.id, Math.max(current, item.quantity))
  })
  remoteItems.forEach((item) => {
    const current = merged.get(item.id) ?? 0
    merged.set(item.id, Math.max(current, item.quantity))
  })
  return [...merged.entries()].map(([id, quantity]) => ({ id, quantity }))
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [authUsername, setAuthUsername] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [promoCode, setPromoCode] = useState("")
  const [checkoutMessage, setCheckoutMessage] = useState("")
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  const items = useCartStore((state) => state.items)
  const setItems = useCartStore((state) => state.setItems)
  const addItem = useCartStore((state) => state.addItem)
  const setQuantity = useCartStore((state) => state.setQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const clearCart = useCartStore((state) => state.clearCart)

  const isAuthenticated = Boolean(authToken && authUser)
  const cartSnapshotKey = useMemo(() => getCartSnapshotKey(authUser?.id), [authUser?.id])
  const authHeaders = useMemo(
    () => (authToken ? { Authorization: `Bearer ${authToken}` } : undefined),
    [authToken]
  )
  const aiBoundaryKey = useMemo(() => `${authUser?.id ?? "guest"}-${items.map((item) => `${item.id}:${item.quantity}`).join("|")}`, [authUser?.id, items])

  const productsAbortRef = useRef<AbortController | null>(null)
  const couponAbortRef = useRef<AbortController | null>(null)
  const checkoutAbortRef = useRef<AbortController | null>(null)
  const ordersAbortRef = useRef<AbortController | null>(null)
  const cartAbortRef = useRef<AbortController | null>(null)
  const hasHydratedCartRef = useRef(false)

  const fetchOrders = async (signal?: AbortSignal) => {
    if (!authHeaders) {
      setOrders([])
      return
    }
    setIsLoadingOrders(true)
    try {
      const response = await api.get<{ items: Order[] }>("/orders", { signal, headers: authHeaders })
      setOrders(response.data.items)
    } catch (error) {
      if (!axios.isCancel(error)) {
        setCheckoutMessage("讀取歷史訂單失敗。")
      }
    } finally {
      setIsLoadingOrders(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    productsAbortRef.current?.abort()
    productsAbortRef.current = controller

    const fetchProducts = async () => {
      setIsLoadingProducts(true)
      try {
        const response = await api.get<{ items: Product[] }>("/products", {
          signal: controller.signal
        })
        setProducts(response.data.items)
      } catch (error) {
        if (!axios.isCancel(error)) {
          setCheckoutMessage("載入商品失敗，請稍後再試。")
        }
      } finally {
        setIsLoadingProducts(false)
      }
    }

    void fetchProducts()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const storedToken = localStorage.getItem("authToken")
    const storedUser = localStorage.getItem("authUser")
    if (!storedToken || !storedUser) {
      return
    }
    try {
      setAuthToken(storedToken)
      setAuthUser(JSON.parse(storedUser) as AuthUser)
    } catch {
      localStorage.removeItem("authToken")
      localStorage.removeItem("authUser")
    }
  }, [])

  useEffect(() => {
    const cachedCartRaw = localStorage.getItem(cartSnapshotKey)
    if (cachedCartRaw) {
      try {
        const cachedItems = JSON.parse(cachedCartRaw) as Array<{ id: string; quantity: number }>
        setItems(cachedItems)
      } catch {
        localStorage.removeItem(cartSnapshotKey)
        setItems([])
      }
    } else {
      setItems([])
    }
    hasHydratedCartRef.current = true
  }, [cartSnapshotKey, setItems])

  useEffect(() => {
    if (!authHeaders) {
      return
    }
    const controller = new AbortController()
    const syncUserData = async () => {
      try {
        const localSnapshotRaw = localStorage.getItem(cartSnapshotKey)
        const localSnapshotItems = localSnapshotRaw
          ? (JSON.parse(localSnapshotRaw) as Array<{ id: string; quantity: number }>)
          : []

        const [cartRes, orderRes] = await Promise.all([
          api.get<{ items: { id: string; quantity: number }[] }>("/cart", {
            signal: controller.signal,
            headers: authHeaders
          }),
          api.get<{ items: Order[] }>("/orders", {
            signal: controller.signal,
            headers: authHeaders
          })
        ])
        const mergedCartItems = mergeCartItems(localSnapshotItems, cartRes.data.items)
        setItems(mergedCartItems)
        setOrders(orderRes.data.items)
        await api.put(
          "/cart",
          { items: mergedCartItems },
          {
            signal: controller.signal,
            headers: authHeaders
          }
        )
      } catch (error) {
        if (!axios.isCancel(error)) {
          setCheckoutMessage("同步使用者資料失敗，請重新登入。")
        }
      }
    }
    void syncUserData()
    return () => controller.abort()
  }, [authHeaders, cartSnapshotKey, setItems])

  useEffect(() => {
    if (!hasHydratedCartRef.current) {
      return
    }
    localStorage.setItem(cartSnapshotKey, JSON.stringify(items))
  }, [cartSnapshotKey, items])

  useEffect(() => {
    if (!authHeaders) {
      return
    }
    const controller = new AbortController()
    cartAbortRef.current?.abort()
    cartAbortRef.current = controller
    void api.put(
      "/cart",
      { items },
      {
        signal: controller.signal,
        headers: authHeaders
      }
    )
    return () => controller.abort()
  }, [authHeaders, items])

  const resetAuthForm = () => {
    setAuthEmail("")
    setAuthUsername("")
    setAuthPassword("")
  }

  const handleRegister = async () => {
    setIsAuthLoading(true)
    try {
      await api.post("/auth/register", {
        username: authUsername.trim(),
        email: authEmail.trim(),
        password: authPassword
      })
      setCheckoutMessage("註冊成功，請登入。")
      setAuthMode("login")
      resetAuthForm()
    } catch {
      setCheckoutMessage("註冊失敗，請檢查格式或帳號是否已存在。")
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogin = async () => {
    setIsAuthLoading(true)
    try {
      const response = await api.post<LoginResponse>("/auth/login", {
        email: authEmail.trim(),
        password: authPassword
      })
      setAuthToken(response.data.token)
      setAuthUser(response.data.user)
      localStorage.setItem("authToken", response.data.token)
      localStorage.setItem("authUser", JSON.stringify(response.data.user))
      setAuthMode(null)
      setCheckoutMessage(`歡迎回來，${response.data.user.username}。`)
      resetAuthForm()
    } catch {
      setCheckoutMessage("登入失敗，請確認帳號密碼。")
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      if (authHeaders) {
        await api.post("/auth/logout", {}, { headers: authHeaders })
      }
    } catch {
      // ignore
    }
    setAuthToken(null)
    setAuthUser(null)
    setOrders([])
    localStorage.removeItem("authToken")
    localStorage.removeItem("authUser")
    setCheckoutMessage("已登出。")
  }

  const handleValidateCoupon = async () => {
    if (!authHeaders) {
      setCheckoutMessage("請先登入。")
      return
    }
    if (!promoCode.trim()) {
      setCheckoutMessage("請先輸入優惠碼。")
      return
    }

    const controller = new AbortController()
    couponAbortRef.current?.abort()
    couponAbortRef.current = controller
    setIsValidatingCoupon(true)

    try {
      const response = await api.post<CouponValidateResponse>(
        "/coupon/validate",
        { promoCode: promoCode.trim() },
        { signal: controller.signal, headers: authHeaders }
      )
      setCheckoutMessage(`優惠碼有效，可折抵 ${currency.format(response.data.discountAmount)}。`)
    } catch (error) {
      if (!axios.isCancel(error)) {
        setCheckoutMessage("優惠碼無效或格式錯誤。")
      }
    } finally {
      setIsValidatingCoupon(false)
    }
  }

  const handleCheckout = async () => {
    if (!authHeaders) {
      setCheckoutMessage("請先登入。")
      return
    }
    if (!items.length) {
      setCheckoutMessage("購物車是空的，無法結算。")
      return
    }

    const payload: { items: { id: string; quantity: number }[]; promoCode?: string } = {
      items: items.map((item) => ({
        id: item.id,
        quantity: item.quantity
      }))
    }
    const normalizedPromoCode = promoCode.trim()
    if (normalizedPromoCode) {
      payload.promoCode = normalizedPromoCode
    }

    console.log("[checkout payload]", payload)

    const controller = new AbortController()
    checkoutAbortRef.current?.abort()
    checkoutAbortRef.current = controller
    setIsCheckingOut(true)

    try {
      const response = await api.post<CheckoutResponse>("/orders/checkout", payload, {
        signal: controller.signal,
        headers: authHeaders
      })
      setCheckoutMessage(`結算完成，訂單編號：${response.data.orderId}`)
      clearCart()
      ordersAbortRef.current?.abort()
      ordersAbortRef.current = new AbortController()
      await fetchOrders(ordersAbortRef.current.signal)
    } catch (error) {
      if (!axios.isCancel(error)) {
        setCheckoutMessage("結算失敗，請檢查資料後重試。")
      }
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Smart Shopping Platform</h1>
              <p className="text-xs text-slate-500">Server-Authoritative Checkout & Security Defenses</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && authUser ? <span className="text-sm text-slate-600">Hi, {authUser.username}</span> : null}
            {!isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  登入
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                >
                  註冊
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
              >
                登出
              </button>
            )}
          </div>
        </div>
      </header>

      {authMode ? (
        <div className="mx-auto mt-4 max-w-7xl px-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-base font-semibold text-slate-800">{authMode === "login" ? "登入" : "註冊"}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {authMode === "register" ? (
                <input
                  value={authUsername}
                  onChange={(event) => setAuthUsername(event.target.value)}
                  placeholder="使用者名稱"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              ) : null}
              <input
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="Email"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="密碼（至少 8 碼）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={isAuthLoading}
                onClick={authMode === "login" ? handleLogin : handleRegister}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {isAuthLoading ? "處理中..." : authMode === "login" ? "確認登入" : "確認註冊"}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-5">
          {isLoadingProducts ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">商品載入中...</div>
          ) : (
            <ProductList products={products} onAddToCart={addItem} disabled={!isAuthenticated} />
          )}
        </section>

        <section className="space-y-5">
          <CartList
            isAuthenticated={isAuthenticated}
            items={items}
            products={products}
            promoCode={promoCode}
            onPromoCodeChange={setPromoCode}
            isCouponValidating={isValidatingCoupon}
            onValidateCoupon={handleValidateCoupon}
            onQuantityChange={setQuantity}
            onRemove={removeItem}
            isCheckoutLoading={isCheckingOut}
            onCheckout={handleCheckout}
            checkoutMessage={checkoutMessage}
          />
          {isAuthenticated ? (
            <AIErrorBoundary key={aiBoundaryKey}>
              <AIResultPanel cartItems={items} products={products} authToken={authToken!} />
            </AIErrorBoundary>
          ) : null}
          <OrderHistory
            orders={orders}
            products={products}
            isLoading={isLoadingOrders}
            onRefresh={() => {
              const controller = new AbortController()
              ordersAbortRef.current?.abort()
              ordersAbortRef.current = controller
              void fetchOrders(controller.signal)
            }}
          />
        </section>
      </main>
    </div>
  )
}

export default App
