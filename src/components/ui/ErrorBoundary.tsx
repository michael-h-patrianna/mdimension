import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 *
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-screen w-screen items-center justify-center bg-gray-950 p-4 text-white">
          <div className="w-full max-w-md rounded-lg border border-red-500/30 bg-red-900/10 p-6 backdrop-blur-md">
            <h2 className="mb-4 text-xl font-bold text-red-400">Something went wrong</h2>
            <p className="mb-4 text-sm text-gray-300">
              An error occurred while rendering the application.
            </p>
            {this.state.error && (
              <pre className="mb-4 max-h-40 overflow-auto rounded bg-black/50 p-2 text-xs text-red-300">
                {this.state.error.message}
              </pre>
            )}
            <button
              className="rounded bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
