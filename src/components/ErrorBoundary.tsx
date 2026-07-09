import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
          <p className="text-sm font-medium text-red-600">页面渲染异常</p>
          <p className="mt-1 text-xs text-gray-400">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 inline-flex h-7 items-center rounded-md bg-indigo-500 px-3 text-xs font-medium text-white hover:bg-indigo-600"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
