"use client";

// Ensure framer-motion is installed and imported correctly
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image"; // Added import for next/image
import { useState, useEffect } from "react";
import { fetchAllTokenData, getTopPerformingCoins, type TokenData } from "@/lib/fetchTokenData";
import toast from "react-hot-toast"; // Added for error toasts

// Custom hook for mobile detection
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return isMobile;
}


// ====== HELPER FUNCTION ======
const abbreviateNumber = (number: number | undefined) => {
  if (number === undefined || isNaN(number) || number === 0) return "$0";
  const absNumber = Math.abs(number);
  if (absNumber >= 1e12) return `${(absNumber / 1e12).toFixed(2)}T`;
  if (absNumber >= 1e9) return `${(absNumber / 1e9).toFixed(2)}B`;
  if (absNumber >= 1e6) return `${(absNumber / 1e6).toFixed(2)}M`;
  if (absNumber >= 1e3) return `${(absNumber / 1e3).toFixed(2)}K`;
  return `${number.toFixed(2)}`; // No extra $ here, added in JSX
};

const TopPerformingCoins = () => {
  const [topCoins, setTopCoins] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const loadTokens = async () => {
      try {
        const tokens = await fetchAllTokenData();
        const logDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
        console.log(`[${logDate}] Fetched tokens:`, tokens);
        
        if (tokens.length === 0) {
          console.warn(`[${logDate}] No tokens found, showing empty state`);
          setTopCoins([]);
          setError("No tokens available at the moment.");
          return;
        }
        
        const top = getTopPerformingCoins(tokens);
        console.log(`[${logDate}] Top performing coins:`, top);
        
        if (top.length === 0) {
          console.warn(`[${logDate}] No top performing coins found`);
          setTopCoins([]);
          setError("No top performing coins available.");
          return;
        }
        
        setTopCoins(top);
        setError(null);
      } catch (err) {
        const logDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
        console.error(`[${logDate}] Error loading tokens:`, err);
        const errMsg = "Failed to load top coins. Please try again later.";
        setError(errMsg);
        setTopCoins([]);
        // Don't show toast for every error to avoid spam
        if (process.env.NODE_ENV === 'development') {
          toast.error(errMsg);
        }
      } finally {
        setLoading(false);
      }
    };
    loadTokens();
  }, []);

  if (loading) {
    return (
      <div className="w-full bg-gray-900 rounded-xl shadow-lg p-4 sm:p-6 border border-blue-500/30 flex flex-col h-full min-h-[400px]">
        <div className="flex justify-between items-center mb-3 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500/30 rounded-xl flex items-center justify-center border border-green-500/30">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-200">Top Movers</h2>
              <p className="text-xs sm:text-sm text-gray-400">Best performing tokens</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-500 text-sm bg-green-500/20 px-2 py-1 rounded-full animate-pulse-live">
              Live
            </span>
          </div>
        </div>
        <div className="space-y-3 flex-grow flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-gray-400 text-sm ml-2">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || topCoins.length === 0) {
    return (
      <div className="w-full bg-gray-900 rounded-xl shadow-lg p-4 sm:p-6 border border-blue-500/30 flex flex-col h-full min-h-[400px]">
        <div className="flex justify-between items-center mb-3 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500/30 rounded-xl flex items-center justify-center border border-green-500/30">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-200">Top Movers</h2>
              <p className="text-xs sm:text-sm text-gray-400">Best performing tokens</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-500 text-sm bg-green-500/20 px-2 py-1 rounded-full animate-pulse-live">
              Live
            </span>
          </div>
        </div>
        <p className="text-center text-red-400 flex-grow flex items-center justify-center">{error || "No top movers available."}</p>
      </div>
    );
  }

  return (
    <motion.div
      className="w-full bg-gray-900 rounded-xl shadow-lg p-4 sm:p-6 border border-blue-500/30 flex flex-col h-full min-h-[400px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="flex justify-between items-center mb-3 sm:mb-6">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500/30 rounded-xl flex items-center justify-center border border-green-500/30">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-200">Top Movers</h2>
            <p className="text-xs sm:text-sm text-gray-400">Best performing tokens</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-green-500 text-sm bg-green-500/20 px-2 py-1 rounded-full animate-pulse-live">
            Live
          </span>
        </div>
      </div>
      <div className="space-y-3 flex-grow">
        {/* Desktop Header */}
        <div className="bg-gray-800 p-3 rounded-lg mb-2 hidden sm:grid grid-cols-[3rem_1fr_8rem_6rem_6rem_4rem] items-center text-sm font-medium text-gray-400">
          <span className="text-center">#</span>
          <span className="text-center">Token</span>
          <span className="text-center">Market Cap</span>
          <span className="text-center">Price</span>
          <span className="text-center">Change (24h)</span>
          <span className="text-center">Action</span>
        </div>
        
        {topCoins.slice(0, isMobile ? 3 : 10).map((coin, index) => (
          <motion.div
            key={coin.poolAddress}
            className="bg-gray-800/30 border-b border-gray-700/50 p-2.5 hover:bg-gray-700/30 transition-all duration-200 cursor-pointer group"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            role="row"
          >
            {/* Desktop Layout */}
            <div className="hidden sm:grid grid-cols-[3rem_1fr_8rem_6rem_6rem_4rem] items-center">
              {/* Ranking */}
              <span className="text-sm sm:text-base font-bold text-gray-200 text-center">
                {index + 1}
              </span>
              {/* Token Info */}
              <div className="flex items-center space-x-3">
                {coin.info?.imageUrl && (
                  <Image
                    src={coin.info.imageUrl}
                    alt={`${coin.symbol} logo`}
                    width={24}
                    height={24}
                    className="w-7 h-7 rounded-full border border-blue-500/30"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => (e.currentTarget.src = "/fallback-token-icon.png")}
                    placeholder="blur"
                    blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
                  />
                )}
                <div>
                  <span className="text-sm sm:text-base font-semibold text-gray-200">{coin.symbol}</span>
                  <span className="hidden sm:block text-sm text-gray-400">({coin.name})</span>
                </div>
              </div>
              {/* Market Cap */}
              <span className="text-sm text-gray-200 text-center">
                ${abbreviateNumber(coin.marketCap) ?? "N/A"}
              </span>
              {/* Price */}
              <span className="text-sm text-gray-200 text-center">
                ${parseFloat(coin.priceUsd ?? "0").toFixed(2)}
              </span>
              {/* Change */}
              <span
                className={`text-sm ${
                  (coin.priceChange?.h24 ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                } font-medium text-center`}
              >
                {(coin.priceChange?.h24 ?? 0).toFixed(2)}%
              </span>
              {/* Action */}
              <Link
                href={`/explore/${coin.poolAddress || coin.tokenAddress}/chart`}
                className="text-sm text-blue-400 hover:text-blue-300 underline text-center transition-colors"
                aria-label={`Trade ${coin.symbol}`}
              >
                Trade
              </Link>
            </div>

            {/* Mobile Layout */}
            <div className="sm:hidden">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative flex-shrink-0">
                  <span className="text-sm font-bold text-gray-200">#{index + 1}</span>
                </div>
                {coin.info?.imageUrl && (
                  <Image
                    src={coin.info.imageUrl}
                    alt={`${coin.symbol} logo`}
                    width={32}
                    height={32}
                    className="rounded-full bg-blue-900"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => (e.currentTarget.src = "/fallback-token-icon.png")}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-200 group-hover:text-green-200 transition truncate text-sm">
                    {coin.name || "Unknown"}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{coin.symbol}</div>
                  {/* Price and 24h change */}
                  {coin.priceUsd && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-300">${parseFloat(coin.priceUsd).toFixed(6)}</span>
                      <span className={(coin.priceChange?.h24 ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                        {(coin.priceChange?.h24 ?? 0) >= 0 ? "+" : ""}{(coin.priceChange?.h24 ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <Link
                  href={`/explore/${coin.poolAddress || coin.tokenAddress}/chart`}
                  className="text-blue-400 hover:text-blue-300 text-xs underline"
                >
                  Trade
                </Link>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>
                  <span className="text-gray-400">MC:</span>
                  <span className="text-gray-200 ml-1">${abbreviateNumber(coin.marketCap) ?? "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400">Vol:</span>
                  <span className="text-gray-200 ml-1">${abbreviateNumber(coin.volume?.h24 ?? 0)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Change:</span>
                  <span className={`ml-1 ${(coin.priceChange?.h24 ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(coin.priceChange?.h24 ?? 0) >= 0 ? "+" : ""}{(coin.priceChange?.h24 ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Rank:</span>
                  <span className="text-gray-200 ml-1">#{index + 1}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      {topCoins.length > 0 && (
        <div className="text-center mt-6">
          <Link 
            href="/explore" 
            className="inline-flex items-center gap-2 text-blue-400 font-semibold text-sm px-4 py-2 rounded-full hover:bg-blue-500/20 transition-all duration-200 hover:scale-105"
          >
            Explore All Tokens
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </motion.div>
  );
};

export default TopPerformingCoins;

// Add CSS for pulsing animation
const styles = `
  @keyframes pulse-live {
    0% { 
      transform: scale(1);
      opacity: 1;
    }
    50% { 
      transform: scale(1.02);
      opacity: 0.8;
    }
    100% { 
      transform: scale(1);
      opacity: 1;
    }
  }
  .animate-pulse-live {
    animation: pulse-live 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    will-change: transform, opacity;
  }
  
  @media (max-width: 768px) {
    .animate-pulse-live {
      animation: none;
    }
  }
`;

// Inject the styles into the document
if (typeof window !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}