"use client";

// Keeps a client-side crash in the Control Room from blanking the screen
// mid-auction. Nothing is lost: every bid and result is already saved, so
// "Reload the Control Room" picks up exactly where the auction stands.
export default function AuctionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-10" style={{ minHeight: "60vh" }}>
      <div className="font-display font-black text-2xl mb-2 text-goldBright">Control Room hiccup</div>
      <p className="text-sm text-mutedDim max-w-md mb-6">
        Nothing is lost — every bid and result is saved. Reload and the auction carries on from exactly where it is.
      </p>
      <button onClick={() => reset()} className="px-7 py-3 rounded-full font-bold"
        style={{ background: "linear-gradient(135deg,#D4AF37,#F37032)", color: "#0A0F1C" }}>
        Reload the Control Room
      </button>
      <details className="mt-8 text-left max-w-lg w-full">
        <summary className="text-xs cursor-pointer text-mutedDim">Technical details (send this to support)</summary>
        <pre className="text-[11px] mt-2 p-3 rounded-lg overflow-auto whitespace-pre-wrap bg-white/5 text-mutedDim">
          {error?.message || "Unknown error"}{error?.digest ? `\n\nDigest: ${error.digest}` : ""}
        </pre>
      </details>
    </div>
  );
}
