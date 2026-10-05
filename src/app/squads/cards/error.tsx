"use client";

// Shows the real error on screen instead of the generic "Application error" page.
export default function CardsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 700, margin: "40px auto" }}>
      <h2 style={{ fontWeight: 800, fontSize: 20 }}>Something went wrong on this page</h2>
      <p style={{ marginTop: 10, color: "#b00020", fontWeight: 600, wordBreak: "break-word" }}>{String(error?.message || "Unknown error")}</p>
      {error?.digest && <p style={{ marginTop: 6, fontSize: 12, color: "#555" }}>Code: {error.digest}</p>}
      <p style={{ marginTop: 10, fontSize: 13, color: "#555" }}>Please send a screenshot of this to the developer.</p>
      <button onClick={reset} style={{ marginTop: 14, padding: "8px 18px", borderRadius: 8, border: 0, background: "#0B1F3A", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Try again</button>
    </div>
  );
}
