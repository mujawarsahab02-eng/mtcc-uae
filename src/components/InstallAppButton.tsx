"use client";

import { useEffect, useState } from "react";

export default function InstallAppButton({ className = "" }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (isIOS || !deferredPrompt) {
      setShowHelp(true);
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  if (installed) return null;

  return (
    <>
      <button onClick={handleInstall} className={className}>
        Get the App
      </button>
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold font-display text-navyText mb-3">Add MTCC UAE to Your Home Screen</div>
            {isIOS ? (
              <p className="text-sm text-slateText leading-relaxed">
                Tap the Share icon at the bottom of Safari, then scroll down and tap &quot;Add to Home Screen.&quot;
              </p>
            ) : (
              <p className="text-sm text-slateText leading-relaxed">
                Open your browser menu and look for &quot;Install app&quot; or &quot;Add to Home Screen.&quot;
              </p>
            )}
            <button onClick={() => setShowHelp(false)} className="mt-5 text-sm font-semibold text-orange underline">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
