import axios from "axios"
import { Bot, ChefHat } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import type { AIRecipeSuggestion, AIRecipeSuggestionResponse, CartItem, Product } from "../types"

type AIResultPanelProps = {
  cartItems: CartItem[]
  products: Product[]
  authToken: string
}

const api = axios.create({
  baseURL: "/api",
  timeout: 10000
})

export function AIResultPanel({ cartItems, products, authToken }: AIResultPanelProps) {
  const [data, setData] = useState<AIRecipeSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [hasFatalError, setHasFatalError] = useState(false)
  const requestAbortRef = useRef<AbortController | null>(null)

  const itemNames = useMemo(() => {
    const productMap = new Map(products.map((product) => [product.id, product]))
    return cartItems
      .map((item) => productMap.get(item.id)?.name)
      .filter((name): name is string => Boolean(name))
  }, [cartItems, products])

  useEffect(() => {
    requestAbortRef.current?.abort()

    if (!itemNames.length) {
      setData([])
      setErrorMessage("")
      setHasFatalError(false)
      return
    }

    const controller = new AbortController()
    requestAbortRef.current = controller
    setIsLoading(true)
    setErrorMessage("")

    const fetchSuggestion = async () => {
      try {
        const response = await api.post<AIRecipeSuggestionResponse>(
          "/ai/recipe-suggestions",
          { itemNames },
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          }
        )
        setData(response.data.recommendations)
      } catch (error) {
        if (!axios.isCancel(error)) {
          if (axios.isAxiosError(error) && (!error.response || error.response.status >= 500)) {
            setHasFatalError(true)
            return
          }
          setErrorMessage("AI 料理建議取得失敗，請稍後再試。")
        }
      } finally {
        setIsLoading(false)
      }
    }

    void fetchSuggestion()
    return () => {
      controller.abort()
    }
  }, [authToken, itemNames])

  if (hasFatalError) {
    throw new Error("AI assistant unavailable")
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-panel">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-5 w-5 text-indigo-600" />
        <h2 className="text-base font-semibold text-slate-900">AI 料理點子助理看板</h2>
      </div>

      {!itemNames.length ? (
        <p className="text-sm text-slate-600">加入食材後，AI 會自動推薦料理步驟與缺少食材。</p>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
        </div>
      ) : null}

      {!isLoading && errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {!isLoading && itemNames.length > 0 && data.length === 0 ? (
        <p className="text-sm text-slate-600">目前食材組合已接近完整，暫無需要補齊的推薦。</p>
      ) : null}

      {!isLoading && data.length > 0 ? (
        <div className="space-y-4">
          {data.map((recipe) => (
            <article key={recipe.recipeName} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2">
                <ChefHat className="h-4 w-4 text-indigo-700" />
                <p className="text-sm font-semibold text-indigo-800">{recipe.recipeName}</p>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {recipe.steps.map((step) => (
                  <li key={`${recipe.recipeName}-${step}`}>{step}</li>
                ))}
              </ol>
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-600">建議搭配食材</p>
                <div className="flex flex-wrap gap-2">
                  {recipe.missingIngredients.map((name) => (
                    <span key={`${recipe.recipeName}-${name}`} className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
