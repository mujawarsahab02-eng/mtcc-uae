"use client";

// Turns a client-side crash into a readable message with a Try again
// button, instead of Next.js's blank "Application error" screen. On the
// venue screen, "Try again" re-mounts the page and picks the live auction
// straight back up, so a glitch costs seconds instead of the whole moment.
export default function DisplayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-8"
      style={{ background: "radial-gradient(ellipse 70% 55% at 50% 0%, #1B2A4D 0%, #0B1224 45%, #04070F 100%)", color: "#fff" }}>
      <div className="font-display font-black text-3xl mb-2" style={{ color: "#F0C94A" }}>Reconnecting…</div>
      <p className="text-sm max-w-md mb-6" style={{ color: "#C7CEDD" }}>
        The display hit a hiccup. Nothing in the auction is affected — tap below and the live screen comes straight back.
      </p>
      <button onClick={() => reset()} className="px-8 py-3 rounded-full font-bold text-base"
        style={{ background: "linear-gradient(135deg,#D4AF37,#F37032)", color: "#0A0F1C" }}>
        ▶ Resume Display
      </button>
      <details className="mt-8 text-left max-w-lg w-full">
        <summary className="text-xs cursor-pointer" style={{ color: "#56607A" }}>Technical details (for the admin)</summary>
        <pre className="text-[11px] mt-2 p-3 rounded-lg overflow-auto whitespace-pre-wrap"
          style={{ background: "rgba(255,255,255,0.05)", color: "#9AA6C2" }}>
          {error?.message || "Unknown error"}{error?.digest ? `\n\nDigest: ${error.digest}` : ""}
        </pre>
      </details>
    </div>
  );
}
