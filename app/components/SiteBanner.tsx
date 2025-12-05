"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase-client";
import { doc, onSnapshot } from "firebase/firestore";
import { FiX } from "react-icons/fi";
import { FaBullhorn } from "react-icons/fa";

interface BannerAsset {
  name: string;
  symbol: string;
  poolAddress: string;
}

interface BannerData {
  enabled: boolean;
  message: string;
  assets: BannerAsset[];
  backgroundColor?: string;
  textColor?: string;
  linkColor?: string;
}

const SiteBanner: React.FC = () => {
  const [bannerData, setBannerData] = useState<BannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Handle responsive detection
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch banner data from Firebase
  useEffect(() => {
    const bannerDocRef = doc(db, "banner", "current");

    const unsubscribe = onSnapshot(
      bannerDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as BannerData;
          setBannerData(data);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching banner:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Mobile scroll behavior - hide on scroll down, show on scroll up/top
  const handleScroll = useCallback(() => {
    if (!isMobile) return;

    const currentScrollY = window.scrollY;
    
    // At the top of the page - always show
    if (currentScrollY < 10) {
      setIsVisible(true);
    }
    // Scrolling down - hide
    else if (currentScrollY > lastScrollY && currentScrollY > 50) {
      setIsVisible(false);
    }
    // Scrolling up - show
    else if (currentScrollY < lastScrollY) {
      setIsVisible(true);
    }

    setLastScrollY(currentScrollY);
  }, [isMobile, lastScrollY]);

  useEffect(() => {
    if (!isMobile) {
      setIsVisible(true);
      return;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile, handleScroll]);

  const handleDismiss = () => {
    setDismissed(true);
    // Store dismissal in sessionStorage so it stays dismissed for this session
    if (typeof window !== "undefined") {
      sessionStorage.setItem("siteBannerDismissed", "true");
    }
  };

  // Check if banner was dismissed this session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const wasDismissed = sessionStorage.getItem("siteBannerDismissed");
      if (wasDismissed === "true") {
        setDismissed(true);
      }
    }
  }, []);

  // Don't render anything if loading, dismissed, or no data
  if (!mounted || loading || dismissed || !bannerData || !bannerData.enabled) {
    return null;
  }

  const backgroundColor = bannerData.backgroundColor || "#1e293b";
  const textColor = bannerData.textColor || "#f1f5f9";
  const linkColor = bannerData.linkColor || "#60a5fa";

  // Desktop: Bottom-left toast notification
  if (!isMobile) {
    return (
      <div
        className={`
          fixed bottom-4 left-4 z-[9999]
          w-[280px] md:w-[320px]
          rounded-lg shadow-2xl
          border border-gray-700/50
          overflow-hidden
          transition-all duration-300 ease-out
          ${isVisible && !dismissed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}
        `}
        style={{ backgroundColor }}
      >
        {/* Header with close button */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/30">
          <div className="flex items-center gap-2">
            <FaBullhorn className="w-3.5 h-3.5" style={{ color: linkColor }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: linkColor }}>
              Announcement
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-700/50"
            aria-label="Dismiss banner"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-3 py-3">
          <p className="text-sm leading-relaxed mb-2" style={{ color: textColor }}>
            {bannerData.message}
          </p>
          
          {/* Asset links */}
          {bannerData.assets && bannerData.assets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {bannerData.assets.map((asset) => {
                if (!asset.poolAddress) return null;
                return (
                  <Link
                    key={asset.symbol}
                    href={`/discover/${asset.poolAddress}/chart`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-all hover:brightness-110"
                    style={{ 
                      backgroundColor: `${linkColor}20`,
                      color: linkColor 
                    }}
                  >
                    {asset.symbol}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mobile: Use same bottom-left toast style as desktop for consistency
  // This avoids header overlap issues and provides better UX
  return (
    <div
      className={`
        fixed bottom-4 left-4 right-4 z-[9999]
        rounded-lg shadow-2xl
        border border-gray-700/50
        overflow-hidden
        transition-all duration-300 ease-out
        ${isVisible && !dismissed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}
      `}
      style={{ backgroundColor }}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/30">
        <div className="flex items-center gap-2">
          <FaBullhorn className="w-3.5 h-3.5" style={{ color: linkColor }} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: linkColor }}>
            Announcement
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-700/50"
          aria-label="Dismiss banner"
        >
          <FiX className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-3 py-3">
        <p className="text-sm leading-relaxed mb-2" style={{ color: textColor }}>
          {bannerData.message}
        </p>
        
        {/* Asset links */}
        {bannerData.assets && bannerData.assets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {bannerData.assets.map((asset) => {
              if (!asset.poolAddress) return null;
              return (
                <Link
                  key={asset.symbol}
                  href={`/discover/${asset.poolAddress}/chart`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-all hover:brightness-110"
                  style={{ 
                    backgroundColor: `${linkColor}20`,
                    color: linkColor 
                  }}
                >
                  {asset.symbol}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SiteBanner;
