"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
          <div className="max-w-md rounded-lg border border-red-900/50 bg-gray-900 p-6 text-center">
            <div className="text-4xl">⚠️</div>
            <h1 className="mt-4 text-xl font-semibold text-white">Something went wrong</h1>
            <p className="mt-2 text-sm text-gray-400">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <p className="mt-3 rounded bg-gray-800 p-2 font-mono text-xs text-red-400">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 ml-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this content.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-center">
      <div className="text-3xl">⚠️</div>
      <h3 className="mt-3 text-lg font-medium text-red-400">{title}</h3>
      <p className="mt-1 text-sm text-gray-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = "📭",
  title = "Nothing here yet",
  message = "Connect a wallet and sync to get started.",
  action,
}: {
  icon?: string;
  title?: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center sm:p-12">
      <p className="text-3xl sm:text-4xl">{icon}</p>
      <h3 className="mt-3 text-lg font-medium text-gray-300">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
