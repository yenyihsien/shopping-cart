import { AlertTriangle } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode } from "react"

type AIErrorBoundaryProps = {
  children: ReactNode
}

type AIErrorBoundaryState = {
  hasError: boolean
}

export class AIErrorBoundary extends Component<AIErrorBoundaryProps, AIErrorBoundaryState> {
  public state: AIErrorBoundaryState = {
    hasError: false
  }

  public static getDerivedStateFromError(): AIErrorBoundaryState {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AI panel crashed:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-panel">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-base font-semibold">AI 助理狀態</h2>
          </div>
          <p className="mt-2 text-sm text-slate-700">助理罷工中，請稍後再試。</p>
        </section>
      )
    }

    return this.props.children
  }
}
