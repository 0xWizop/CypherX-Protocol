"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STORAGE_KEY = "cypherx_cookie_consent";

const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleChoice = (value: "accepted" | "rejected") => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, value);
    }
    setIsVisible(false);
  };

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-[9999998]"
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{ willChange: "transform" }}
        >
          <div className="w-full bg-[#050a1a] border-t border-blue-900/40 px-3 py-3 sm:px-6 sm:py-5">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-slate-200 flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold tracking-wide text-white">Cookies & Privacy</p>
                <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                  We use cookies to personalize content, enhance your experience, and analyze traffic. You can accept or reject optional cookies.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleChoice("rejected")}
                  className="w-full sm:w-auto rounded-lg border border-blue-800/50 bg-[#0b1735] px-4 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:border-blue-600/60 hover:bg-[#101f44] transition-colors"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleChoice("accepted")}
                  className="w-full sm:w-auto rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;

