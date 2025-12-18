"use client";

import { Component, ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("[ErrorBoundary] Error caught:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    padding: 24,
                    background: "#1a1a2e",
                    borderRadius: 12,
                    border: "1px solid #f87171",
                    textAlign: "center",
                    margin: 20,
                }}>
                    <h2 style={{ color: "#f87171", marginBottom: 12 }}>Something went wrong</h2>
                    <p style={{ opacity: 0.7, marginBottom: 16 }}>
                        {this.state.error?.message || "An unexpected error occurred"}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            padding: "8px 16px",
                            background: "#3b82f6",
                            border: "none",
                            borderRadius: 6,
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
