"use client";

import { usePathname } from "next/navigation";

// Set your two real links here.
const YOUTUBE_URL = "https://www.youtube.com/@MTCCUAE";
const INSTAGRAM_URL = "https://www.instagram.com/mtcc_uae/";

export default function SocialFloat() {
  const path = usePathname() || "";
  // Keep the broadcast display and the admin screens clean.
  if (path.startsWith("/auction/display") || path.startsWith("/admin")) return null;

  const base =
    "flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/60";

  return (
    <div className="fixed right-4 bottom-20 sm:right-6 sm:bottom-24 z-50 flex flex-col gap-3" aria-label="Follow MTCC U.A.E.">
      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="MTCC U.A.E. on Instagram" title="Follow us on Instagram"
        className={base} style={{ background: "linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)" }}>
        <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none" />
        </svg>
      </a>
      <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" aria-label="MTCC U.A.E. on YouTube" title="Watch us on YouTube"
        className={base} style={{ background: "#FF0000" }}>
        <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-7 sm:h-7" fill="#fff">
          <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2C.5 9.1.5 12 .5 12s0 2.9.5 4.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.8.5-4.8s0-2.9-.5-4.8ZM9.8 15.2V8.8L15.5 12l-5.7 3.2Z" />
        </svg>
      </a>
    </div>
  );
}
