"use client";

import { useEffect } from "react";

// Replaces the root layout on a catastrophic layout-level error.
// Must include its own <html> and <body> — Next.js App Router requirement.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error monitoring — digest is Next.js's server-side error reference
    console.error("[global-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", background: "#FAFAF7", margin: 0, padding: "3rem 2rem" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8", marginBottom: "1rem" }}>
          PublikEye
        </p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem" }}>
          Service temporarily unavailable
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#64748b", lineHeight: 1.6, maxWidth: "36rem", marginBottom: "1.5rem" }}>
          We could not load the application right now. Our team has been
          notified. Please try again in a moment.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#0d9488", color: "#fff", border: "none", borderRadius: "0.5rem",
            padding: "0.6rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
