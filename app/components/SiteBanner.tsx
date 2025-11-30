"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    const bannerDocRef = doc(db, "banner", "current");

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      bannerDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as BannerData;
          setBannerData(data);
          setLoading(false);
        } else {
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error fetching banner:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (loading || dismissed || !bannerData || !bannerData.enabled) {
    return null;
  }

  const backgroundColor = bannerData.backgroundColor || "#1e293b"; // slate-800 to match theme
  const textColor = bannerData.textColor || "#f1f5f9"; // slate-100
  const linkColor = bannerData.linkColor || "#60a5fa"; // blue-400

  return (
    <div
      className="sticky top-0 left-0 right-0 z-[100] w-full border-b border-gray-700/50 overflow-hidden"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="max-w-[1400px] mx-auto px-4 py-1.5 flex items-center justify-center gap-2 relative">
        <FaBullhorn className="w-3.5 h-3.5 flex-shrink-0" style={{ color: linkColor }} />
        <span className="text-xs sm:text-sm font-medium">
          {bannerData.message}
        </span>
        <div className="flex items-center gap-1.5">
          {bannerData.assets.map((asset, index) => {
            // Only render if poolAddress is provided
            if (!asset.poolAddress) return null;
            
            return (
              <span key={asset.symbol} className="flex items-center gap-1">
                <Link
                  href={`/discover/${asset.poolAddress}/chart`}
                  className="text-xs sm:text-sm font-semibold hover:underline transition-all"
                  style={{ color: linkColor }}
                  onClick={(e: React.MouseEvent) => {
                    // Prevent banner dismissal when clicking asset
                    e.stopPropagation();
                  }}
                >
                  {asset.symbol}
                </Link>
                {index < bannerData.assets.length - 1 && (
                  <span className="mx-1 text-gray-500">•</span>
                )}
              </span>
            );
          })}
        </div>
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-0.5 flex-shrink-0"
          aria-label="Dismiss banner"
        >
          <FiX className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SiteBanner;

