"use client";

import ErrorBoundary from "@/components/ErrorBoundary";
import AdminPage from "./page";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary
            fallback={
                <div style={{
                    padding: 48,
                    textAlign: "center",
                    minHeight: "50vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <h1 style={{ color: "#f87171", marginBottom: 16 }}>⚠️ Admin Error</h1>
                    <p style={{ opacity: 0.7, marginBottom: 24 }}>
                        Something went wrong loading the admin page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: "12px 24px",
                            background: "#3b82f6",
                            border: "none",
                            borderRadius: 8,
                            color: "#fff",
                            cursor: "pointer",
                            fontWeight: 500,
                        }}
                    >
                        Refresh Page
                    </button>
                </div>
            }
        >
            {children}
        </ErrorBoundary>
    );
}
