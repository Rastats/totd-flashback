// src/components/LoadingSkeleton.tsx
// Reusable loading skeleton components for consistent loading states

"use client";

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: number;
    className?: string;
}

export function Skeleton({ width = "100%", height = 20, borderRadius = 4, className }: SkeletonProps) {
    return (
        <div
            className={className}
            style={{
                width,
                height,
                borderRadius,
                background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
            }}
        />
    );
}

export function CardSkeleton() {
    return (
        <div style={{
            background: "#1e293b",
            borderRadius: 12,
            border: "2px solid #334155",
            padding: 16,
            height: 300,
        }}>
            <div style={{ marginBottom: 12 }}><Skeleton height={24} width="60%" /></div>
            <div style={{ marginBottom: 20 }}><Skeleton height={16} width="40%" /></div>
            <div style={{ marginBottom: 12 }}><Skeleton height={120} borderRadius={8} /></div>
            <div style={{ marginBottom: 8 }}><Skeleton height={16} width="80%" /></div>
            <Skeleton height={16} width="50%" />
        </div>
    );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <tr>
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} style={{ padding: "12px 16px" }}>
                    <Skeleton height={16} width={i === 0 ? 30 : "80%"} />
                </td>
            ))}
        </tr>
    );
}

export function PageLoadingSkeleton({ title }: { title?: string }) {
    return (
        <div style={{
            minHeight: "100vh",
            background: "#0f172a",
            color: "#fff",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
        }}>
            {title && (
                <h1 style={{ fontSize: 28, opacity: 0.5 }}>{title}</h1>
            )}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "#94a3b8",
            }}>
                <div style={{
                    width: 24,
                    height: 24,
                    border: "3px solid #334155",
                    borderTopColor: "#3b82f6",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                }} />
                <span>Loading...</span>
            </div>
            <style>{`
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default Skeleton;
