"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

import { useRouter, usePathname } from "next/navigation";

import { motion, AnimatePresence } from "framer-motion";

import {
  FaTrophy,
  FaBolt,
  FaStar,
  FaBell,

  FaTrash,
  FaCheck,
  FaArrowUp,
  FaArrowDown,
  FaVolumeUp,
  FaDollarSign,
  FaRedo,
  FaExclamationTriangle,
  FaCopy,
  FaChartLine,
  FaBookmark,
  FaFilter,
} from "react-icons/fa";
import { PencilIcon, ArrowPathIcon, TrashIcon } from "@heroicons/react/24/outline";

import debounce from "lodash/debounce";

import { onAuthStateChanged } from "firebase/auth";

import type { User } from "firebase/auth";

import { auth, db } from "@/lib/firebase";

import { useFavorites } from "@/app/hooks/useFavorites";
import { useLoginModal } from "@/app/providers";

import { useWatchlists } from "@/app/hooks/useWatchlists";

import { collection, onSnapshot, query, addDoc, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc, getDocs, where } from "firebase/firestore";

import { ToastContainer, toast as reactToast } from "react-toastify";

import 'react-toastify/dist/ReactToastify.css';

import Image from 'next/image';

import Header from "../components/Header";
import Footer from "../components/Footer";
import PointTransactionModal from "../components/PointTransactionModal";
import LoadingPage from "../components/LoadingPage";

// Performance constants

const MOBILE_BREAKPOINT = 768;

const PULL_TO_REFRESH_THRESHOLD = 80;

// Transaction deduplication utility - removed unused function





// Use the new hooks

const firebaseAuth = auth;

// DexScreenerPair type removed - now using optimized API

// Memoized Token Row Component

const TokenRow = React.memo(({ token, index, style, onTokenClick, favorites, onToggleFavorite, formatPrice, getColorClass, getTrophy, MarketingIcon, currentTime, timeCounter }: {
  token: TokenData;
  index: number;
  style: React.CSSProperties;
  onTokenClick: (pool: string) => void;
  favorites: string[];
  onToggleFavorite: (poolAddress: string) => Promise<void>;
  formatPrice: (price: string | number) => string;
  getColorClass: (value: number) => string;
  getTrophy: (rank: number) => JSX.Element | null;
  MarketingIcon: () => JSX.Element;
  currentTime: number;
  timeCounter: number;
}) => {
  const isFavorite = favorites.includes(token.poolAddress);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;

  if (isMobile) {
    return (
      <div style={style} className="p-2">
        <div
          className="bg-gray-900 rounded-md p-3 border border-blue-500/20 hover:border-blue-500/40 transition-colors cursor-pointer"
          onClick={() => onTokenClick(token.poolAddress)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <DexIcon dexId={token.dexId} symbol={token.symbol} />
              {token.info?.imageUrl && (
                <Image src={token.info.imageUrl} alt={token.symbol} width={24} height={24} className="w-6 h-6 rounded-full" />
              )}
              <span className="font-bold text-white">{token.symbol}</span>
              {token.boosted && <MarketingIcon />}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(token.poolAddress);
              }}
              className="text-yellow-400 hover:text-yellow-300 p-2"
            >
              {isFavorite ? <FaStar className="w-4 h-4" /> : <FaStar className="w-4 h-4 opacity-50" />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400">Price:</span>
              <span className="text-white ml-1">{formatPrice(token.priceUsd || "0")}</span>
            </div>
            <div>
              <span className="text-gray-400">24h:</span>
              <span className={`ml-1 ${getColorClass(token.priceChange?.h24 || 0)}`}>
                {token.priceChange?.h24 ? `${token.priceChange.h24 >= 0 ? "+" : ""}${token.priceChange.h24.toFixed(2)}%` : "0.00%"}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Volume:</span>
              <span className="text-white ml-1">{formatPrice(token.volume?.h24 || 0)}</span>
            </div>
            <div>
              <span className="text-gray-400">MCap:</span>
              <span className="text-white ml-1">{formatPrice(token.marketCap || 0)}</span>
            </div>
          </div>
          <div className="mt-2 flex justify-between items-center">
            <span className="text-xs text-gray-500">
              <LiveTimeAgo createdAt={token.pairCreatedAt} currentTime={currentTime} timeCounter={timeCounter} />
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={style}
      className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors cursor-pointer"
      onClick={() => onTokenClick(token.poolAddress)}
    >
      <div className="flex items-center px-4 py-3 text-sm">
        <div className="flex items-center space-x-3 w-32">
          <span className="text-gray-400">#{index + 1}</span>
          {getTrophy(index + 1)}
          {token.boosted && <MarketingIcon />}
        </div>
        <div className="flex items-center space-x-3 w-32">
          <DexIcon dexId={token.dexId} symbol={token.symbol} />
          {token.info?.imageUrl && (
            <Image src={token.info.imageUrl} alt={token.symbol} width={24} height={24} className="w-6 h-6 rounded-full" />
          )}
          <div>
            <div className="font-bold text-white">{token.symbol}</div>
            <div className="text-xs text-gray-500">
              <LiveTimeAgo createdAt={token.pairCreatedAt} currentTime={currentTime} timeCounter={timeCounter} />
            </div>
          </div>
        </div>
        <div className="w-32 text-right">
          <div className="text-white">{formatPrice(token.priceUsd || "0")}</div>
          <div className={`text-xs ${getColorClass(token.priceChange?.h24 || 0)}`}>
            {token.priceChange?.h24 ? `${token.priceChange.h24 >= 0 ? "+" : ""}${token.priceChange.h24.toFixed(2)}%` : "0.00%"}
          </div>
        </div>
        <div className="w-32 text-right">
          <div className="text-white">{formatPrice(token.volume?.h24 || 0)}</div>
          <div className="text-xs text-gray-500">24h</div>
        </div>
        <div className="w-32 text-right">
          <div className="text-white">{formatPrice(token.marketCap || 0)}</div>
          <div className="text-xs text-gray-500">MCap</div>
        </div>
        <div className="w-20 text-right">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(token.poolAddress);
            }}
            className="text-yellow-400 hover:text-yellow-300 p-2"
          >
            {isFavorite ? <FaStar className="w-4 h-4" /> : <FaStar className="w-4 h-4 opacity-50" />}
          </button>
        </div>
      </div>
    </div>
  );
});

TokenRow.displayName = 'TokenRow';

// ====== TYPES ======

export type TokenData = {
  poolAddress: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals?: number;
  quoteToken?: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  priceUsd?: string;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h1: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
  };
  marketCap?: number;
  info?: {
    imageUrl?: string;
  };
  pairCreatedAt?: number;
  trendingScore?: number;
  boosted?: boolean;
  boostValue?: number;
  weight?: number;
  docId?: string;
  dexId?: string;
};

export type Watchlist = {
  id: string;
  name: string;
  tokens: string[]; // poolAddresses
};

export type CustomAlert = {
  id?: string;
  poolAddress: string;
  type: "price_above" | "price_below" | "volume_above" | "mc_above";
  threshold: number;
  notified?: boolean;
};

export type UserAlert = {
  id?: string;
  tokenAddress: string;
  poolAddress?: string;
  tokenSymbol: string;
  tokenName?: string;
  metric: "price_usd" | "price_native" | "market_cap";
  direction: "above" | "below";
  threshold: number;
  createdAt?: string;
  lastTriggeredAt?: string;
  lastValue?: number;
};

// ====== CONSTANTS ======

const COOLDOWN_PERIOD = 300_000; // 5 minutes

const TOP_MOVERS_LOSERS_INTERVAL = 3_600_000; // 1 hour

const MAX_NOTIFICATIONS_PER_HOUR = 18;

const MAX_NOTIFICATIONS_PER_TOKEN = 5;



// ====== UTILITY FUNCTIONS ======

function getColorClass(value: number): string {
  return value >= 0 ? "text-green-500" : "text-red-500";
}

function getAge(createdAt?: number, currentTime?: number): string {
  if (!createdAt) return "N/A";
  const now = currentTime || Date.now();
  const diffMs = now - createdAt;
  const seconds = Math.floor(diffMs / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Live time display component that re-renders every second
const LiveTimeAgo = ({ createdAt, currentTime, timeCounter: _timeCounter }: { createdAt?: number; currentTime: number; timeCounter: number }) => {
  // timeCounter ensures re-render even if currentTime doesn't change (prefixed with _ to indicate intentionally unused)
  return <span>{getAge(createdAt, currentTime)}</span>;
};


function formatPrice(price: string | number): string {
  const numPrice = Number(price);
  if (numPrice < 0.001) return `$${numPrice.toFixed(5)}`;
  if (numPrice < 1) return `$${numPrice.toFixed(4)}`;
  return `$${numPrice.toFixed(2)}`;
}

function computeTrending(token: TokenData, boostValue: number): number {
  const volume24h = token.volume?.h24 || 0;
  const liquidity = token.liquidity?.usd || 0;
  const marketCap = token.marketCap || 0;
  
  // Base requirements - tokens must meet minimum thresholds
  if (volume24h < 1000 || liquidity < 5000) {
    return 0; // Exclude low-quality tokens entirely
  }
  
  // Volume score (most important) - logarithmic scaling with higher weight
  const volumeScore = Math.log10(volume24h + 1) * 3.0;
  
  // Liquidity score - important for stability
  const liquidityScore = Math.log10(liquidity + 1) * 2.0;
  
  // Price movement scoring - only reward significant positive movements
  const priceChange1h = token.priceChange?.h1 ?? 0;
  const priceChange6h = token.priceChange?.h6 ?? 0;
  const priceChange24h = token.priceChange?.h24 ?? 0;
  
  // Only reward positive price movements above 5%
  const priceMovementScore = 
    (priceChange1h > 5 ? Math.min(priceChange1h * 0.5, 15) : 0) +
    (priceChange6h > 5 ? Math.min(priceChange6h * 0.3, 10) : 0) +
    (priceChange24h > 5 ? Math.min(priceChange24h * 0.2, 8) : 0);
  
  // Volume to market cap ratio - reward high volume relative to market cap
  const volumeToMarketCap = marketCap > 0 ? volume24h / marketCap : 0;
  const volumeMarketCapScore = Math.min(Math.log10(volumeToMarketCap + 1) * 2.5, 10);
  
  // Consistency bonus - reward tokens with sustained positive movement
  const consistencyBonus = (priceChange1h > 5 && priceChange6h > 5 && priceChange24h > 5) ? 15 : 0;
  
  // Market cap penalty - penalize very small market caps (potential manipulation)
  const marketCapPenalty = marketCap < 10000 ? -10 : 0;
  
  // Volume spike bonus - reward sudden volume increases (but not too much)
  const volumeSpikeBonus = token.volume?.h1 ? 
    Math.min(Math.log10((volume24h / (token.volume.h1 * 24 + 1)) + 1) * 1.5, 8) : 0;
  
  // Boost score from marketing
  const boostScore = boostValue || 0;
  
  // Quality score - reward tokens with good volume/liquidity ratios
  const qualityScore = liquidity > 0 ? Math.min((volume24h / liquidity) * 2, 5) : 0;
  
  const baseScore =
    volumeScore +
    liquidityScore +
    priceMovementScore +
    volumeMarketCapScore +
    consistencyBonus +
    marketCapPenalty +
    volumeSpikeBonus +
    boostScore +
    qualityScore;
  
  // Apply minimum score threshold
  return Math.max(baseScore, 0);
}



function getTrophy(rank: number): JSX.Element | null {
  if (rank === 1)
    return <FaTrophy size={16} className="text-[#FFD700]" title="Gold Trophy (Rank 1)" />;
  if (rank === 2)
    return <FaTrophy size={16} className="text-[#C0C0C0]" title="Silver Trophy (Rank 2)" />;
  if (rank === 3)
    return <FaTrophy size={16} className="text-[#CD7F32]" title="Bronze Trophy (Rank 3)" />;
  return null;
}

// DEX Icon component
const DexIcon = ({ dexId, symbol }: { dexId?: string; symbol?: string }) => {
  const getDexIcon = (dexId: string) => {
    // Special case for CBBTC - show Base logo
    if (symbol?.toUpperCase() === 'CBBTC') {
      return (
        <img
          src="https://i.imgur.com/ym7T9MN.png"
          alt="Base"
          className="w-4 h-4 rounded-full object-cover"
        />
      );
    }
    
    switch (dexId?.toLowerCase()) {
      case 'baseswap':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">B</span>
          </div>
        );
      case 'uniswap_v3':
      case 'uniswap':
        return (
          <img
            src="https://i.imgur.com/woTkNd2.png"
            alt="Uniswap"
            className="w-4 h-4 rounded-full object-cover"
          />
        );
      case 'pancakeswap_v3':
      case 'pancakeswap':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
        );
      case 'aerodrome':
        return (
          <img
            src="https://i.imgur.com/TpmRnXs.png"
            alt="Aerodrome"
            className="w-4 h-4 rounded-full object-cover"
          />
        );
      case 'alienbase':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
        );
      default:
        return (
          <div className="w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">D</span>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center gap-1">
      {getDexIcon(dexId || '')}
    </div>
  );
};

function MarketingIcon(): JSX.Element {
  return (
    <span className="cursor-help" title="Boosted Token">
      <FaBolt className="text-blue-400 w-4 h-4 md:w-5 md:h-5" />
    </span>
  );
}



function getBellColor(alerts: Alert[]): string {
  if (alerts.length === 0) return "text-gray-400";
  const latestAlert = alerts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  switch (latestAlert.type) {
    case "price_spike":
    case "price_spike_long":
    case "mover":
    case "price_above":
      return latestAlert.priceChangePercent && latestAlert.priceChangePercent >= 0
        ? "text-green-500"
        : "text-red-500";
    case "loser":
    case "price_below":
      return "text-red-500";
    case "volume_spike":
    case "boost":
    case "volume_above":
      return "text-blue-400";
    default:
      return "text-gray-400";
  }
}

function getAlertToastOptions(alert: Alert) {
  let type: 'success' | 'error' | 'info' | 'default' = 'default';
  const customStyle = {};
  switch (alert.type) {
    case "price_spike":
    case "price_spike_long":
    case "mover":
    case "price_above":
      type = alert.priceChangePercent && alert.priceChangePercent >= 0 ? 'success' : 'error';
      break;
    case "loser":
    case "price_below":
      type = 'error';
      break;
    case "volume_spike":
    case "boost":
    case "volume_above":
      type = 'info';
      break;
    default:
      type = 'default';
  }
  return { type, style: customStyle, position: "bottom-left" as const };
}

function getProgressColor(type: string, isPositive: boolean = true) {
  switch (type) {
    case "price_above":
    case "price_spike":
    case "price_spike_long":
    case "mover":
      return isPositive ? "bg-green-500" : "bg-red-500";
    case "price_below":
    case "loser":
      return "bg-red-500";
    case "volume_above":
    case "volume_spike":
    case "boost":
      return "bg-blue-500";
    case "mc_above":
      return "bg-purple-500";
    default:
      return "bg-gray-500";
  }
}

type Alert = {
  id?: string;
  type:
    | "price_spike"
    | "price_spike_long"
    | "volume_spike"
    | "mover"
    | "loser"
    | "boost"
    | "price_above"
    | "price_below"
    | "volume_above"
    | "mc_above";
  message: string;
  timestamp: string;
  poolAddress?: string;
  priceChangePercent?: number;
};

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 2,
});

function formatCompactCurrency(value: number): string {
  if (!value) return "$0";
  return `$${compactCurrencyFormatter.format(value)}`;
}

export default function TokenScreener() {
  const router = useRouter();
  const pathname = usePathname();
  const { setShowLoginModal, setRedirectTo } = useLoginModal();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "favorites" | "watchlist" | "alerts">("all");
  const [sortFilter, setSortFilter] = useState<string>("trending");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState({
    minLiquidity: 0,
    minVolume: 0,
    minAge: 0,
    maxAge: Infinity,
  });
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showMobileFilterModal, setShowMobileFilterModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState<User | null>(null);
  const { favorites, toggleFavorite } = useFavorites();
  const { watchlists, deleteWatchlist } = useWatchlists();
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>("");
  const [customAlerts, setCustomAlerts] = useState<CustomAlert[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [alertTokenData, setAlertTokenData] = useState<Map<string, { name: string; symbol: string; imageUrl: string }>>(new Map());

  const [_userAlerts, _setUserAlerts] = useState<UserAlert[]>([]);
  const [_isAlertModalOpen, _setIsAlertModalOpen] = useState(false);
  const [_pendingAlertToken, _setPendingAlertToken] = useState<TokenData | null>(null);
  const [_notificationPermission, _setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [_isRequestingPermission, _setIsRequestingPermission] = useState(false);
  const [_permissionChecked, _setPermissionChecked] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  const [pageLoadTime, setPageLoadTime] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullToRefreshY, setPullToRefreshY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileSkeleton, setShowMobileSkeleton] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [timeCounter, setTimeCounter] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  
  // Trending history tracking
  const [trendingHistory, setTrendingHistory] = useState<Map<string, number>>(new Map());
  const [lastTrendingUpdate, setLastTrendingUpdate] = useState(0);
  
  // Update current time every second for live counting
  useEffect(() => {
    // Set initial time
    setCurrentTime(Date.now());
    
    // Update every second - use both currentTime and a counter to force re-renders
    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      setTimeCounter(prev => prev + 1); // Increment counter to force re-render
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Load trending history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('trendingHistory');
      const savedUpdateTime = localStorage.getItem('lastTrendingUpdate');
      
      if (savedHistory) {
        const historyData = JSON.parse(savedHistory);
        const historyMap = new Map(Object.entries(historyData).map(([key, value]) => [key, value as number]));
        setTrendingHistory(historyMap);
      }
      
      if (savedUpdateTime) {
        setLastTrendingUpdate(parseInt(savedUpdateTime));
      }
    } catch (error) {
      console.error('Failed to load trending history:', error);
    }
  }, []);

  // Disable body scroll when mobile filter modal is open
  useEffect(() => {
    if (showMobileFilterModal) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [showMobileFilterModal]);

  // Prevent body scrolling during loading on desktop
  useEffect(() => {
    if (!isMobile && loading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [loading, isMobile]);
  
  // Save trending history to localStorage when it updates
  useEffect(() => {
    try {
      // Clean up old entries (older than 7 days)
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const cleanedHistory = new Map<string, number>();
      
      trendingHistory.forEach((timestamp, poolAddress) => {
        if (timestamp > sevenDaysAgo) {
          cleanedHistory.set(poolAddress, timestamp);
        }
      });
      
      const historyObject = Object.fromEntries(cleanedHistory);
      localStorage.setItem('trendingHistory', JSON.stringify(historyObject));
      localStorage.setItem('lastTrendingUpdate', lastTrendingUpdate.toString());
      
      // Update state with cleaned history
      if (cleanedHistory.size !== trendingHistory.size) {
        setTrendingHistory(cleanedHistory);
      }
    } catch (error) {
      console.error('Failed to save trending history:', error);
    }
  }, [trendingHistory, lastTrendingUpdate]);
  
  // Missing variables that were removed
  const [_previousPrices, _setPreviousPrices] = useState<{ [symbol: string]: number }>({});
  const [lastAlertTimes, setLastAlertTimes] = useState<{
    [symbol: string]: { volume: number; price: number; priceLong: number; boost: number };
  }>({});
  
  // Additional missing state variables
  const [showFavoritePopup, setShowFavoritePopup] = useState(false);
  const [selectedTokenForWatchlist, setSelectedTokenForWatchlist] = useState<string | null>(null);
  const [watchlistSelections, setWatchlistSelections] = useState<string[]>([]);
  const [showAddToWatchlistModal, setShowAddToWatchlistModal] = useState(false);
  
  // Remaining missing state variables
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenLogo, setTokenLogo] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Point transaction modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [pendingTokenSubmission, setPendingTokenSubmission] = useState<{
    tokenSymbol: string;
    tokenAddress: string;
    tokenLogo: string;
  } | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);

  // Fetch user points on component mount
  useEffect(() => {
    const fetchUserPoints = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/user/stats?walletAddress=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          setUserPoints(data.points || 0);
        }
      } catch (error) {
        console.error('Error fetching user points:', error);
      }
    };

    fetchUserPoints();
  }, [user]);
  
  // Final missing state variables
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [showCreateWatchlistModal, setShowCreateWatchlistModal] = useState(false);
  const [customAlertForm, setCustomAlertForm] = useState({
    poolAddress: "",
    type: "price_above" as "price_above" | "price_below" | "volume_above" | "mc_above",
    threshold: "",
  });
  const [editingCustomAlert, setEditingCustomAlert] = useState<CustomAlert | null>(null);
  
  // Final missing state variables
  const [showCustomAlertModal, setShowCustomAlertModal] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<Alert[] | null>(null);
  const [triggerFilter, setTriggerFilter] = useState<"all" | "price_above" | "price_below" | "volume_above" | "mc_above">("all");
  
  // Final missing state variables

  const [alertTab, setAlertTab] = useState<"feed" | "triggers" | "history">("feed");
  
  // Final missing state variable

  
  // Apply Trending Scores
  const tokensWithTrending = useMemo(() => {
    const now = Date.now();
    
    // Update trending history every hour
    if (now - lastTrendingUpdate > 60 * 60 * 1000) {
      const newTrendingHistory = new Map<string, number>();
      
      // Calculate trending scores and track top trending tokens
      const tokensWithScores = tokens.map((token) => ({
        ...token,
        trendingScore: computeTrending(token, token.boostValue || 0),
      }));
      
      // Sort by trending score and track top 50 tokens
      const topTrending = tokensWithScores
        .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
        .slice(0, 50);
      
      // Update trending history with current timestamp
      topTrending.forEach((token) => {
        newTrendingHistory.set(token.poolAddress, now);
      });
      
      setTrendingHistory(newTrendingHistory);
      setLastTrendingUpdate(now);
    }
    
    return tokens.map((token) => {
      const baseTrendingScore = computeTrending(token, token.boostValue || 0);
      
      // Apply trending fatigue based on history (removed age-based fatigue)
      const lastTrendingTime = trendingHistory.get(token.poolAddress) || 0;
      const hoursSinceLastTrending = (now - lastTrendingTime) / (1000 * 60 * 60);
      
      // Apply penalty for recently trending tokens (within last 24 hours)
      let trendingFatigue = 1;
      if (hoursSinceLastTrending < 24) {
        // Reduce score for tokens that were trending recently
        trendingFatigue = 0.3 + (0.7 * (hoursSinceLastTrending / 24));
      }
      
      // Apply bonus for tokens that haven't been trending for a while
      let varietyBonus = 0;
      if (hoursSinceLastTrending > 48) {
        varietyBonus = Math.min(20, (hoursSinceLastTrending - 48) * 0.5);
      }
      
      return {
        ...token,
        trendingScore: (baseTrendingScore + varietyBonus) * trendingFatigue,
      };
    });
  }, [tokens, trendingHistory, lastTrendingUpdate]);

  // Memoized filtered and sorted tokens
  const filteredAndSortedTokens = useMemo(() => {
    let filtered = tokensWithTrending;

    // Apply view mode filter
    switch (viewMode) {
      case "favorites":
        filtered = filtered.filter((token) => favorites.includes(token.poolAddress));
        break;
      case "watchlist":
        if (selectedWatchlist) {
          const watchlist = watchlists.find((w) => w.id === selectedWatchlist);
          if (watchlist) {
            filtered = filtered.filter((token) => watchlist.tokens.includes(token.poolAddress));
          }
        }
        break;
    }

    // Apply filters
    filtered = filtered.filter((token) => {
      const liquidity = token.liquidity?.usd || 0;
      const volume = token.volume?.h24 || 0;
      const age = token.pairCreatedAt || 0;
      const now = Date.now();
      const ageInHours = (now - age) / (1000 * 60 * 60);
      return (
        liquidity >= filters.minLiquidity &&
        volume >= filters.minVolume &&
        ageInHours >= filters.minAge &&
        ageInHours <= filters.maxAge
      );
    });

    // Sort tokens
    const sorted = [...filtered].sort((a, b) => {
      let aValue: number;
      let bValue: number;
      
      if (sortFilter === "trending") {
        aValue = a.trendingScore || 0;
        bValue = b.trendingScore || 0;
      } else if (sortFilter === "volume") {
        aValue = a.volume?.h24 || 0;
        bValue = b.volume?.h24 || 0;
      } else if (sortFilter === "liquidity") {
        aValue = a.liquidity?.usd || 0;
        bValue = b.liquidity?.usd || 0;
      } else if (sortFilter === "marketCap") {
        aValue = a.marketCap || 0;
        bValue = b.marketCap || 0;
      } else if (sortFilter === "age") {
        aValue = a.pairCreatedAt || 0;
        bValue = b.pairCreatedAt || 0;
      } else {
        // Handle time-based sorting (5m, 1h, 6h, 24h)
        let key: "m5" | "h1" | "h6" | "h24" = "h1";
        if (sortFilter === "5m") key = "m5";
        else if (sortFilter === "1h") key = "h1";
        else if (sortFilter === "6h") key = "h6";
        else if (sortFilter === "24h") key = "h24";
        
        aValue = a.priceChange?.[key] ?? 0;
        bValue = b.priceChange?.[key] ?? 0;
      }
      
      return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
    });

    return sorted;
  }, [tokensWithTrending, viewMode, favorites, selectedWatchlist, watchlists, filters, sortFilter, sortDirection]);

  // Ensure component is mounted on client
  useEffect(() => {
    setIsMounted(true);
    setPageLoadTime(Date.now());
    // Show loading immediately on mount
    setInitialLoad(true);
  }, []);

  // Prevent scrolling when filter menu is open
  useEffect(() => {
    if (showFilterMenu) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [showFilterMenu]);

  // Mobile detection and responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      
      // Calculate footer height
      const footerEl = document.getElementById("app-footer");
      if (footerEl) {
        setFooterHeight(footerEl.offsetHeight);
      }
    };
    
    // Initial check
    checkMobile();
    
    window.addEventListener('resize', checkMobile);
    
    // Watch for footer height changes
    const footerEl = document.getElementById("app-footer");
    if (footerEl) {
      const observer = new MutationObserver(() => {
        setFooterHeight(footerEl.offsetHeight);
      });
      observer.observe(footerEl, { attributes: true, childList: true, subtree: true });
      
      return () => {
        window.removeEventListener('resize', checkMobile);
        observer.disconnect();
      };
    }
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Progressive loading effect
  useEffect(() => {
    if (tokens.length > 0 && isMobile && !loading) {
      setShowMobileSkeleton(false);
    } else if (isMobile && (loading || tokens.length === 0)) {
      setShowMobileSkeleton(true);
    }
  }, [tokens, isMobile, loading]);

  // Check Authentication & fetch custom alerts
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch custom alerts
        const customAlertsRef = collection(db, `users/${currentUser.uid}/customAlerts`);
        const unsubCustomAlerts = onSnapshot(customAlertsRef, async (snapshot) => {
          const cas = snapshot.docs.map((doc) => {
            const data = doc.data();
            // Safely handle any timestamp fields that might be in the data
            const safeData: any = {};
            for (const [key, value] of Object.entries(data)) {
              if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
                // Convert Firestore Timestamp to ISO string
                safeData[key] = value.toDate().toISOString();
              } else if (value instanceof Date) {
                safeData[key] = value.toISOString();
              } else {
                safeData[key] = value;
              }
            }
            return {
              id: doc.id,
              ...safeData,
            } as CustomAlert;
          });
          setCustomAlerts(cas);
          
          // Fetch token data for alerts from Firebase tokens collection
          const tokenDataMap = new Map<string, { name: string; symbol: string; imageUrl: string }>();
          for (const alert of cas) {
            // Early validation: Skip invalid pool addresses (must be 42 characters: 0x + 40 hex)
            if (!alert.poolAddress || !/^0x[a-fA-F0-9]{40}$/.test(alert.poolAddress)) {
              // Invalid address - skip this alert silently
              continue;
            }
            
            if (!tokenDataMap.has(alert.poolAddress)) {
              try {
                let tokenDoc: any = null;
                let tokenAddress: string | null = null;
                
                // First try: Query by pool address
                const poolQuery = query(collection(db, "tokens"), where("pool", "==", alert.poolAddress));
                const poolSnapshot = await getDocs(poolQuery);
                if (!poolSnapshot.empty) {
                  tokenDoc = poolSnapshot.docs[0].data();
                  tokenAddress = tokenDoc.address;
                } else {
                  // Second try: Query by pair address
                  const pairQuery = query(collection(db, "tokens"), where("pair", "==", alert.poolAddress));
                  const pairSnapshot = await getDocs(pairQuery);
                  if (!pairSnapshot.empty) {
                    tokenDoc = pairSnapshot.docs[0].data();
                    tokenAddress = tokenDoc.address;
                  } else {
                    // Third try: Check if poolAddress is actually a token address
                    if (/^0x[a-fA-F0-9]{40}$/.test(alert.poolAddress)) {
                      const addressQuery = query(collection(db, "tokens"), where("address", "==", alert.poolAddress));
                      const addressSnapshot = await getDocs(addressQuery);
                      if (!addressSnapshot.empty) {
                        tokenDoc = addressSnapshot.docs[0].data();
                        tokenAddress = tokenDoc.address || alert.poolAddress;
                      } else {
                        // Fallback: Use poolAddress as token address (only if valid)
                        tokenAddress = alert.poolAddress;
                      }
                    }
                  }
                }
                
                // Validate tokenAddress before making API calls
                if (tokenAddress && /^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
                  // Only fetch from DexScreener if we have a valid Ethereum address
                  try {
                    const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
                    const dexData = await dexResponse.json();
                    if (dexData.pairs && dexData.pairs.length > 0) {
                      const pair = dexData.pairs[0];
                      const baseToken = pair.baseToken || {};
                      tokenDataMap.set(alert.poolAddress, {
                        name: tokenDoc?.name || baseToken.name || tokenDoc?.symbol || baseToken.symbol || "Unknown",
                        symbol: tokenDoc?.symbol || baseToken.symbol || "Unknown",
                        imageUrl: pair.info?.imageUrl || baseToken.logoURI || `https://dexscreener.com/base/${tokenAddress}/logo.png`,
                      });
                    } else {
                      tokenDataMap.set(alert.poolAddress, {
                        name: tokenDoc?.name || tokenDoc?.symbol || "Unknown",
                        symbol: tokenDoc?.symbol || "Unknown",
                        imageUrl: `https://dexscreener.com/base/${tokenAddress}/logo.png`,
                      });
                    }
                  } catch (dexError) {
                    tokenDataMap.set(alert.poolAddress, {
                      name: tokenDoc?.name || tokenDoc?.symbol || "Unknown",
                      symbol: tokenDoc?.symbol || "Unknown",
                      imageUrl: `https://dexscreener.com/base/${tokenAddress}/logo.png`,
                    });
                  }
                } else if (tokenDoc) {
                  // If we have tokenDoc but invalid address, use what we have from Firebase
                  tokenDataMap.set(alert.poolAddress, {
                    name: tokenDoc.name || tokenDoc.symbol || "Unknown",
                    symbol: tokenDoc.symbol || "Unknown",
                    imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect width='24' height='24' fill='%23374151'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239CA3AF' font-size='10'%3E?%3C/text%3E%3C/svg%3E",
                  });
                }
              } catch (error) {
                // Silently skip invalid addresses - don't log errors for known invalid addresses
                if (alert.poolAddress && /^0x[a-fA-F0-9]{40}$/.test(alert.poolAddress)) {
                  console.error(`Error fetching token data for ${alert.poolAddress}:`, error);
                }
              }
            }
          }
          setAlertTokenData(tokenDataMap);
        });
        return () => {
          unsubCustomAlerts();
        };
      } else {
        setCustomAlerts([]);
        setAlertTokenData(new Map());
      }
    });
    return () => unsubscribe();
  }, []);

  // Pagination config - 25 tokens per page with on-demand loading
  const TOKENS_PER_PAGE = 25;
  const [allFirebaseTokens, setAllFirebaseTokens] = useState<Array<{
    poolAddress: string;
    tokenAddress: string;
    symbol: string;
    name: string;
    decimals: number;
    pairCreatedAt: number;
    docId: string;
  }>>([]);
  
  // Initial Firebase fetch (just metadata, fast)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "tokens"), (snapshot) => {
        const tokenList = snapshot.docs.map((doc) => ({
          poolAddress: doc.data().pool as string || "",
          tokenAddress: doc.data().address as string || "",
          symbol: doc.data().symbol as string || "",
          name: doc.data().name as string || doc.data().symbol || "Unknown",
          decimals: doc.data().decimals as number || 18,
          pairCreatedAt: (() => {
            const createdAt = doc.data().createdAt;
            if (!createdAt) return 0;
            if (createdAt?.toDate && typeof createdAt.toDate === 'function') {
              return createdAt.toDate().getTime();
            }
            if (createdAt instanceof Date) {
              return createdAt.getTime();
            }
            if (typeof createdAt === 'number') {
              return createdAt;
            }
            return 0;
          })(),
          docId: doc.id,
        }));
      
        const uniqueTokenMap = new Map<string, typeof tokenList[0]>();
        tokenList.forEach((token) => {
        if (token.tokenAddress && /^0x[a-fA-F0-9]{40}$/.test(token.tokenAddress)) {
          if (!uniqueTokenMap.has(token.tokenAddress)) {
            uniqueTokenMap.set(token.tokenAddress, token);
          }
        }
        });
      setAllFirebaseTokens(Array.from(uniqueTokenMap.values()));
    });
    return () => unsubscribe();
  }, []);

  // Fetch price data for a batch of tokens - only return tokens WITH price data
  const fetchPriceData = useCallback(async (tokensToFetch: typeof allFirebaseTokens) => {
    if (tokensToFetch.length === 0) return [];
    
    const results: TokenData[] = [];
    
    // Chunk tokens (10 per API call)
    const chunks: string[][] = [];
    for (let i = 0; i < tokensToFetch.length; i += 10) {
      chunks.push(tokensToFetch.slice(i, i + 10).map((t) => t.tokenAddress));
        }
    
    // Fetch all chunks in parallel
    const chunkPromises = chunks.map(async (chunk) => {
          const joinedChunk = chunk.join(",");
      try {
          const res = await fetch(
            `https://api.dexscreener.com/tokens/v1/base/${encodeURIComponent(joinedChunk)}`,
          { headers: { Accept: "application/json" } }
          );
        if (!res.ok) return [];
        return await res.json();
      } catch {
        return [];
      }
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    
    chunkResults.flat().forEach((pair: any) => {
            if (pair && pair.baseToken && pair.baseToken.address) {
        const firestoreToken = tokensToFetch.find(
                (t) => t.tokenAddress.toLowerCase() === pair.baseToken?.address.toLowerCase()
              );
        if (firestoreToken && !results.some((r) => r.tokenAddress === firestoreToken.tokenAddress)) {
          results.push({
                  ...firestoreToken,
                  poolAddress: pair.pairAddress,
                  priceUsd: pair.priceUsd || "0",
                  priceChange: pair.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 },
                  volume: pair.volume || { h1: 0, h24: 0 },
                  liquidity: pair.liquidity || { usd: 0 },
                  marketCap: pair.marketCap || 0,
                  info: pair.info ? { imageUrl: pair.info.imageUrl } : undefined,
            dexId: pair.dexId || "unknown",
                });
              }
            }
          });
    
    return results;
  }, []);

  // Load ALL tokens with price data when Firebase data arrives
  useEffect(() => {
    if (allFirebaseTokens.length === 0) return;
    
    const loadAllTokens = async () => {
      setLoading(true);
      setError("");
      
      try {
        // Fetch price data for all tokens in batches to avoid rate limits
        const BATCH_SIZE = 50; // Fetch 50 tokens per batch
        const allResults: TokenData[] = [];
        
        for (let i = 0; i < allFirebaseTokens.length; i += BATCH_SIZE) {
          const batch = allFirebaseTokens.slice(i, i + BATCH_SIZE);
          const batchResults = await fetchPriceData(batch);
          allResults.push(...batchResults);
          
          // Small delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < allFirebaseTokens.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        }
        
        setTokens(allResults);
      } catch (err) {
        setError("Unable to load tokens. Please try again later.");
        console.error(err);
              } finally {
          setLoading(false);
          setInitialLoad(false);
        }
    };
    
    loadAllTokens();
  }, [allFirebaseTokens, fetchPriceData]);

  // Reset to last valid page if current page exceeds total pages
  useEffect(() => {
    const maxPages = filteredAndSortedTokens.length > 0 
      ? Math.ceil(filteredAndSortedTokens.length / TOKENS_PER_PAGE) 
      : 1;
    if (currentPage > maxPages && maxPages > 0) {
      setCurrentPage(maxPages);
    }
  }, [filteredAndSortedTokens.length, currentPage]);


  // Fetch Alerts from Firestore and Clean Up
  // TODO: Reintroduce alert subscription once the new alert system is ready

  // Price Spike and Volume Spike Alerts + Custom Alerts Check
  // TODO: Add alert evaluation interval once new alert triggers are implemented

  // Boost Alerts - Real-time with onSnapshot and expiration
  useEffect(() => {
    const boostsQuery = query(collection(db, "boosts"));
    const unsubscribe = onSnapshot(boostsQuery, (snapshot) => {
      const now = new Date();
      const boostMap: { [poolAddress: string]: number } = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        const expiresAt = (() => {
          const exp = data.expiresAt;
          if (!exp) return null;
          if (exp?.toDate && typeof exp.toDate === 'function') {
            return exp.toDate();
          }
          if (exp instanceof Date) {
            return exp;
          }
          if (typeof exp === 'string') {
            return new Date(exp);
          }
          return null;
        })();
        if (!expiresAt || expiresAt > now) {
          if (data.poolAddress) {
            boostMap[data.poolAddress.toLowerCase()] = data.boostValue || 0;
          }
        } else {
          deleteDoc(doc.ref).catch((err) => console.error("Failed to delete expired boost:", err));
        }
      });
      setTokens((prev) =>
        prev.map((token) => ({
          ...token,
          boosted: !!boostMap[token.poolAddress.toLowerCase()],
          boostValue: boostMap[token.poolAddress.toLowerCase()] || 0,
        }))
      );
      const newBoostAlerts: Alert[] = [];
      tokens.forEach((token) => {
        const symbol = token.symbol;
        const poolAddress = token.poolAddress;
        const boostValue = boostMap[poolAddress.toLowerCase()];
        const lastBoostTime = lastAlertTimes[symbol]?.boost || 0;
        if (
          boostValue > 0 &&
          !token.boosted &&
          Date.now() - lastBoostTime >= COOLDOWN_PERIOD &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR
        ) {
          const alert: Alert = {
            type: "boost",
            message: `${symbol} received a boost of ${boostValue}`,
            timestamp: new Date().toISOString(),
            poolAddress,
          };
          if (Date.now() >= pageLoadTime) {
            newBoostAlerts.push(alert);
            addDoc(collection(db, "notifications"), {
              ...alert,
              createdAt: serverTimestamp(),
            }).catch((err) => console.error(`Failed to save boost alert for ${symbol}:`, err));
            setLastAlertTimes((prev) => ({
              ...prev,
              [symbol]: {
                ...prev[symbol],
                boost: Date.now(),
              },
            }));
            setNotificationCount((prev) => prev + 1);
            reactToast(alert.message, getAlertToastOptions(alert));
          }
        }
      });
      if (newBoostAlerts.length > 0) {
        setAlerts((prev) => [...prev, ...newBoostAlerts]);
      }
    });
    return () => unsubscribe();
  }, [pageLoadTime]);

  // Top Movers and Losers Alerts
  useEffect(() => {
    async function checkTopMoversAndLosers() {
      const sortedBy1h = [...tokens].sort((a, b) => (b.priceChange?.h1 ?? 0) - (a.priceChange?.h1 ?? 0));
      const topMovers = sortedBy1h.slice(0, 5);
      const topLosers = sortedBy1h.slice(-5).reverse();
      const newAlerts: Alert[] = [];
      if (notificationCount >= MAX_NOTIFICATIONS_PER_HOUR) return;
      topMovers.forEach((token) => {
        const priceChange = token.priceChange?.h1 ?? 0;
        const tokenAlerts = alerts.filter((a) => a.poolAddress === token.poolAddress).length;
        if (
          priceChange > 0 &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR &&
          tokenAlerts < MAX_NOTIFICATIONS_PER_TOKEN
        ) {
          const alert: Alert = {
            type: "mover",
            message: `${token.symbol} is up ${priceChange.toFixed(2)}% in the last hour.`,
            timestamp: new Date().toISOString(),
            poolAddress: token.poolAddress,
            priceChangePercent: priceChange,
          };
          if (Date.now() >= pageLoadTime) {
            newAlerts.push(alert);
            addDoc(collection(db, "notifications"), {
              ...alert,
              createdAt: serverTimestamp(),
            }).catch((err) =>
              console.error(`Failed to save mover alert for ${token.symbol}:`, err)
            );
            setNotificationCount((prev) => prev + 1);
            reactToast(alert.message, getAlertToastOptions(alert));
          }
        }
      });
      topLosers.forEach((token) => {
        const priceChange = token.priceChange?.h1 ?? 0;
        const tokenAlerts = alerts.filter((a) => a.poolAddress === token.poolAddress).length;
        if (
          priceChange < 0 &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR &&
          tokenAlerts < MAX_NOTIFICATIONS_PER_TOKEN
        ) {
          const alert: Alert = {
            type: "loser",
            message: `${token.symbol} is down ${Math.abs(priceChange).toFixed(2)}% in the last hour.`,
            timestamp: new Date().toISOString(),
            poolAddress: token.poolAddress,
            priceChangePercent: priceChange,
          };
          if (Date.now() >= pageLoadTime) {
            newAlerts.push(alert);
            addDoc(collection(db, "notifications"), {
              ...alert,
              createdAt: serverTimestamp(),
            }).catch((err) =>
              console.error(`Failed to save loser alert for ${token.symbol}:`, err)
            );
            setNotificationCount((prev) => prev + 1);
            reactToast(alert.message, getAlertToastOptions(alert));
          }
        }
      });
      setAlerts((prev) => [...prev, ...newAlerts]);
    }
    const interval = setInterval(() => {
      const currentTime = new Date();
      if (currentTime.getMinutes() % 5 === 0) {
        checkTopMoversAndLosers();
      }
    }, TOP_MOVERS_LOSERS_INTERVAL);
    return () => clearInterval(interval);
  }, [pageLoadTime]);



  // Handlers
  const handleCopy = useCallback(async (token: TokenData) => {
    let address = token.tokenAddress;
    if (!address) {
      try {
        const tokenDoc = await getDoc(doc(db, "tokens", token.docId!));
        if (tokenDoc.exists()) {
          address = tokenDoc.data().address || "";
        }
      } catch (err) {
        console.error("Failed to fallback query token address:", err);
        reactToast.error("Error fetching address", { position: "bottom-left" });
        return;
      }
    }
    
    if (address) {
      try {
        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(address);
          reactToast.success("Token address copied!", { position: "bottom-left" });
        } else {
          // Fallback for older browsers or non-secure contexts
          const textArea = document.createElement("textarea");
          textArea.value = address;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          try {
            document.execCommand('copy');
            reactToast.success("Token address copied!", { position: "bottom-left" });
          } catch (err) {
            console.error("Fallback copy failed:", err);
            reactToast.error("Copy failed", { position: "bottom-left" });
          } finally {
            document.body.removeChild(textArea);
          }
        }
      } catch (err) {
        console.error("Copy failed:", err);
        reactToast.error("Copy failed", { position: "bottom-left" });
      }
    } else {
      reactToast.error("No address available", { position: "bottom-left" });
    }
  }, []);

  const handleToggleFavorite = useCallback(
    async (poolAddress: string) => {
      console.log("🔍 handleToggleFavorite called with user:", user?.uid, "authenticated:", !!user);
      if (!user) {
        setShowFavoritePopup(true);
        return;
      }
      await toggleFavorite(poolAddress);
    },
    [user, toggleFavorite]
  );

  const handleOpenAddToWatchlist = useCallback((poolAddress: string) => {
    setSelectedTokenForWatchlist(poolAddress);
    const currentSelections = watchlists
      .filter((wl) => wl.tokens.includes(poolAddress))
      .map((wl) => wl.id);
    setWatchlistSelections(currentSelections);
    setShowAddToWatchlistModal(true);
  }, [watchlists]);

  const handleUpdateWatchlistSelections = useCallback(async () => {
    if (!user || !selectedTokenForWatchlist) return;
    try {
      for (const wl of watchlists) {
        const isSelected = watchlistSelections.includes(wl.id);
        const isCurrentlyIn = wl.tokens.includes(selectedTokenForWatchlist);
        if (isSelected !== isCurrentlyIn) {
          if (wl.id === "favorites") {
            const favoriteDocRef = doc(db, `users/${user.uid}/favorites`, selectedTokenForWatchlist);
            if (isSelected) {
              await setDoc(favoriteDocRef, {
                poolAddress: selectedTokenForWatchlist,
                createdAt: serverTimestamp(),
              });
            } else {
              await deleteDoc(favoriteDocRef);
            }
          } else {
            const watchlistDocRef = doc(db, `users/${user.uid}/watchlists`, wl.id);
            await updateDoc(watchlistDocRef, {
              tokens: isSelected ? arrayUnion(selectedTokenForWatchlist) : arrayRemove(selectedTokenForWatchlist),
            });
          }
        }
      }
      setShowAddToWatchlistModal(false);
      setSelectedTokenForWatchlist(null);
      setWatchlistSelections([]);
      
      const selectedCount = watchlistSelections.length;
      const tokenSymbol = tokens.find(t => t.poolAddress === selectedTokenForWatchlist)?.symbol || 'Token';
      
      if (selectedCount === 0) {
        reactToast.info(`${tokenSymbol} removed from all watchlists`, { 
          position: "bottom-left"
        });
      } else if (selectedCount === 1) {
        const watchlistName = watchlists.find(w => w.id === watchlistSelections[0])?.name || 'Watchlist';
        reactToast.success(`${tokenSymbol} added to ${watchlistName}`, { 
          position: "bottom-left"
        });
      } else {
        reactToast.success(`${tokenSymbol} added to ${selectedCount} watchlists`, { 
          position: "bottom-left"
        });
      }
    } catch (err) {
      console.error("Error updating watchlists:", err);
      reactToast.error("Error updating watchlists", { position: "bottom-left" });
    }
  }, [user, selectedTokenForWatchlist, watchlistSelections, watchlists]);

  const handleTokenClick = useCallback(
    (pool: string) => {
      if (!pool || !/^0x[a-fA-F0-9]{40}$/.test(pool)) {
        console.error("Invalid pool address for navigation:", pool);
        reactToast.error("Invalid token address. Please try again.", { position: "bottom-left" });
        return;
      }
      const targetUrl = `/discover/${pool}/chart`;
      router.push(targetUrl);
      setTimeout(() => {
        if (window.location.pathname !== targetUrl) {
          window.location.href = targetUrl;
        }
      }, 500);
    },
    [router]
  );

  const handleBoostNow = () => {
    setShowBoostModal(false);
    router.push("/marketplace");
  };



  async function handleSubmitListing(e: React.FormEvent) {
    e.preventDefault();
    
    // Set pending submission and show transaction modal
    setPendingTokenSubmission({
      tokenSymbol,
      tokenAddress,
      tokenLogo
    });
    setShowTransactionModal(true);
  }

  const handleConfirmTokenTransaction = async () => {
    if (!pendingTokenSubmission) return;
    
    try {
      const response = await fetch("/api/submit-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingTokenSubmission),
      });
      if (response.ok) {
        setSubmissionSuccess(true);
        setPendingTokenSubmission(null);
        reactToast.success("Token listing submitted", { position: "bottom-left" });
      } else {
        throw new Error("Submission failed");
      }
    } catch (err) {
      console.error(err);
      reactToast.error("Submission error. Please try again.", { position: "bottom-left" });
    }
  }

  function closeModal() {
    setShowModal(false);
    setSubmissionSuccess(false);
    setTokenSymbol("");
    setTokenAddress("");
    setTokenLogo("");
  }

  const handleCreateWatchlist = useCallback(async () => {
    if (!user || !newWatchlistName) return;
    try {
      const docRef = await addDoc(collection(db, `users/${user.uid}/watchlists`), {
        name: newWatchlistName,
        tokens: [],
        createdAt: serverTimestamp(),
      });
      setShowCreateWatchlistModal(false);
      setNewWatchlistName("");
      setSelectedWatchlist(docRef.id);
      reactToast.success(`Watchlist "${newWatchlistName}" created successfully`, { 
        position: "bottom-left"
      });
    } catch (err) {
      console.error("Error creating watchlist:", err);
      reactToast.error("Error creating watchlist", { position: "bottom-left" });
    }
  }, [user, newWatchlistName]);

  const handleSaveCustomAlert = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setShowFavoritePopup(true);
      return;
    }
    const { poolAddress, type, threshold } = customAlertForm;
    if (!/^0x[a-fA-F0-9]{40}$/.test(poolAddress)) {
      reactToast.error("Invalid pool address", { position: "bottom-left" });
      return;
    }
    try {
      if (editingCustomAlert && editingCustomAlert.id) {
        const docRef = doc(db, `users/${user.uid}/customAlerts`, editingCustomAlert.id);
        await updateDoc(docRef, {
          poolAddress,
          type,
          threshold: Number(threshold),
          notified: false,
        });
        setCustomAlerts((prev) =>
          prev.map((ca) =>
            ca.id === editingCustomAlert.id ? { ...ca, poolAddress, type, threshold: Number(threshold), notified: false } : ca
          )
        );
        reactToast.success("Custom alert updated", { position: "bottom-left" });
      } else {
        const docRef = await addDoc(collection(db, `users/${user.uid}/customAlerts`), {
          poolAddress,
          type,
          threshold: Number(threshold),
          notified: false,
          createdAt: serverTimestamp(),
        });
        setCustomAlerts((prev) => [
          ...prev,
          {
            id: docRef.id,
            poolAddress,
            type,
            threshold: Number(threshold),
          },
        ]);
        reactToast.success("Custom alert added", { position: "bottom-left" });
      }
      setCustomAlertForm({ poolAddress: "", type: "price_above", threshold: "" });
      setShowCustomAlertModal(false);
      setEditingCustomAlert(null);
    } catch (err) {
      console.error("Error saving custom alert:", err);
      reactToast.error("Error saving custom alert", { position: "bottom-left" });
    }
  }, [user, customAlertForm, editingCustomAlert]);

  useEffect(() => {
    if (editingCustomAlert) {
      setCustomAlertForm({
        poolAddress: editingCustomAlert.poolAddress,
        type: editingCustomAlert.type,
        threshold: editingCustomAlert.threshold.toString(),
      });
      setShowCustomAlertModal(true);
    }
  }, [editingCustomAlert]);

  const handleResetNotified = async (id: string) => {
    if (!user || !id) return;
    try {
      const docRef = doc(db, `users/${user.uid}/customAlerts`, id);
      await updateDoc(docRef, { notified: false });
      setCustomAlerts((prev) =>
        prev.map((ca) =>
          ca.id === id ? { ...ca, notified: false } : ca)
      );
      reactToast.success("Alert reset", { position: "bottom-left" });
    } catch (err) {
      console.error("Error resetting alert:", err);
      reactToast.error("Error resetting alert", { position: "bottom-left" });
    }
  };



  const handleFilterChange = useCallback(
    (filter: string) => {
      if (sortFilter === filter) {
        setSortDirection(sortDirection === "desc" ? "asc" : "desc");
      } else {
        setSortFilter(filter);
        setSortDirection("desc");
      }
      setCurrentPage(1);
    },
    [sortFilter, sortDirection]
  );

  const debouncedSetCurrentPage = useCallback(
    (page: number) => {
      const debouncedFn = debounce((val: number) => setCurrentPage(val), 300);
      debouncedFn(page);
    },
    [setCurrentPage]
  );

  // Calculate total pages from tokens WITH price data (filteredAndSortedTokens)
  const totalPages = filteredAndSortedTokens.length > 0 
    ? Math.ceil(filteredAndSortedTokens.length / TOKENS_PER_PAGE) 
    : 1;
  
  // Index for ranking display
  const indexOfFirstToken = (currentPage - 1) * TOKENS_PER_PAGE;
  
  // Get exactly 25 tokens for current page from the sorted/filtered list
  const currentTokens = useMemo(() => {
    const startIndex = (currentPage - 1) * TOKENS_PER_PAGE;
    const endIndex = startIndex + TOKENS_PER_PAGE;
    return filteredAndSortedTokens.slice(startIndex, endIndex);
  }, [filteredAndSortedTokens, currentPage]);
  
  const rowVariants = {
    hidden: { opacity: 0, y: 20 },
    // Use a TS-safe transition (omit `ease` which conflicts with framer-motion's typed Easing)
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const desktopPagination = totalPages > 1 ? (
    <div className="flex w-full items-center justify-center gap-3 text-[11px] uppercase text-gray-200">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        disabled={currentPage === 1}
        className="rounded-full border border-blue-500/30 bg-gray-900/60 px-4 py-1.5 font-sans transition-colors hover:bg-gray-800 disabled:opacity-50"
      >
        Previous
      </motion.button>
      <input
        type="number"
        value={currentPage}
        onChange={(e) => {
          const page = Number(e.target.value);
          if (page >= 1 && page <= totalPages) {
            debouncedSetCurrentPage(page);
          }
        }}
        className="w-16 rounded-full border border-blue-500/30 bg-gray-900/60 px-3 py-1.5 text-center font-sans text-gray-200 uppercase focus:outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min={1}
        max={totalPages}
      />
      <span className="font-sans text-gray-400 px-1">of {totalPages}</span>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="rounded-full border border-blue-500/30 bg-gray-900/60 px-4 py-1.5 font-sans transition-colors hover:bg-gray-800 disabled:opacity-50"
      >
        Next
      </motion.button>
    </div>
  ) : null;

  const filteredCustomAlerts = useMemo(() => {
    return triggerFilter === "all" ? customAlerts : customAlerts.filter(ca => ca.type === triggerFilter);
  }, [customAlerts, triggerFilter]);



  // Pull to refresh handlers
  const handlePullToRefreshStart = useCallback((e: React.TouchEvent) => {
    if (e.touches[0].clientY < 100) {
      setPullToRefreshY(e.touches[0].clientY);
    }
  }, []);

  const handlePullToRefreshMove = useCallback((e: React.TouchEvent) => {
    if (pullToRefreshY > 0) {
      const deltaY = e.touches[0].clientY - pullToRefreshY;
      if (deltaY > PULL_TO_REFRESH_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        // Simulate refresh
        setTimeout(() => {
          setIsRefreshing(false);
          setPullToRefreshY(0);
          reactToast.success("Data refreshed!", { position: "bottom-left" });
        }, 1000);
      }
    }
  }, [pullToRefreshY, isRefreshing]);

  const handlePullToRefreshEnd = useCallback(() => {
    // Reset pull-to-refresh state when user releases
    if (pullToRefreshY > 0 && !isRefreshing) {
      setPullToRefreshY(0);
    }
  }, [pullToRefreshY, isRefreshing]);

  if (!isMounted || initialLoad) {
    return (
      <div className="min-h-screen w-full bg-gray-950 flex items-center justify-center overflow-hidden">
        <LoadingPage />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 text-gray-200 font-sans m-0 p-0 overflow-hidden flex flex-col">
      <style jsx global>{`
        @keyframes fillLeftToRight {
          0% {
            transform: scaleX(0);
          }
          100% {
            transform: scaleX(1);
          }
        }
        .Toastify__progress-bar {
          transform-origin: left;
          animation: fillLeftToRight linear forwards;
        }
        .Toastify__progress-bar--animated {
          background: linear-gradient(to right, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.9) 100%);
        }
        .Toastify__toast-theme--dark .Toastify__progress-bar--success {
          background: linear-gradient(to right, rgba(0, 255, 0, 0.5) 0%, rgba(0, 255, 0, 0.9) 100%);
        }
        .Toastify__toast-theme--dark .Toastify__progress-bar--error {
          background: linear-gradient(to right, rgba(255, 0, 0, 0.5) 0%, rgba(255, 0, 0, 0.9) 100%);
        }
        .Toastify__toast-theme--dark .Toastify__progress-bar--info {
          background: linear-gradient(to right, rgba(0, 0, 255, 0.5) 0%, rgba(0, 0, 255, 0.9) 100%);
        }
        
        /* Custom scrollbar styling */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #1f2937;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
        
        ::-webkit-scrollbar-corner {
          background: #1f2937;
        }
        
        /* Firefox scrollbar */
        * {
          scrollbar-width: thin;
          scrollbar-color: #374151 #1f2937;
        }
        
        /* Prevent overscroll bounce on mobile */
        @media (max-width: 768px) {
          body {
            overscroll-behavior-y: contain;
            -webkit-overflow-scrolling: touch;
          }
        }
        
        /* Hide scrollbars but keep scrolling functionality */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        /* Ensure body doesn't scroll on desktop */
        @media (min-width: 769px) {
          body {
            overflow: hidden !important;
          }
        }
      `}</style>
      <ToastContainer 
        position="bottom-left" 
        autoClose={2000} 
        hideProgressBar={false} 
        newestOnTop={false} 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
        theme="dark"
        style={{ zIndex: 99999999 }}
      />
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-gray-200 font-sans py-2 px-4 rounded-md shadow-xl z-50 border border-blue-500/30 uppercase">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-sm font-bold">
            ×
          </button>
        </div>
      )}
      {/* Submit Listing Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-gray-900 text-gray-200 p-6 rounded-md shadow-xl w-80 border border-blue-500/30 md:w-96">
            <button onClick={closeModal} className="absolute top-2 right-2 text-xl font-bold">
              ×
            </button>
            {!submissionSuccess ? (
              <>
                <h2 className="text-xl font-bold mb-4 font-sans uppercase">Submit Token Listing</h2>
                <form onSubmit={handleSubmitListing}>
                  <div className="mb-4">
                    <label className="block mb-1 font-sans uppercase">Token Symbol</label>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      className="w-full border border-blue-500/30 p-2 rounded-md font-sans bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                      required
                      maxLength={10}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block mb-1 font-sans uppercase">Token Address</label>
                    <input
                      type="text"
                      value={tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                      className="w-full border border-blue-500/30 p-2 rounded-md font-sans bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                      required
                      placeholder="0x..."
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block mb-1 font-sans uppercase">Logo URL</label>
                    <input
                      type="url"
                      value={tokenLogo}
                      onChange={(e) => setTokenLogo(e.target.value)}
                      className="w-full border border-blue-500/30 p-2 rounded-md font-sans bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                      required
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="bg-gray-900 hover:bg-gray-800 text-gray-200 py-2 px-4 rounded-full font-sans border border-blue-500/30 uppercase"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      type="submit"
                      className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 py-2 px-4 rounded-full font-sans uppercase border border-blue-500/30"
                    >
                      Submit
                    </motion.button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center">
                <h2 className="text-xl font-bold mb-4 font-sans uppercase">Token Listing Submitted!</h2>
                <p className="mb-4 text-sm font-sans uppercase">
                  Your token has been submitted for review. We&rsquo;ll notify you once it&rsquo;s listed!
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={closeModal}
                  className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 py-2 px-4 rounded-full font-sans uppercase border border-blue-500/30"
                >
                  Close
                </motion.button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Boost Info Modal */}
      {showBoostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-gray-900 text-gray-200 p-6 rounded-md shadow-xl w-80 border border-blue-500/30 md:w-96">
            <button onClick={() => setShowBoostModal(false)} className="absolute top-2 right-2 text-xl font-bold">
              ×
            </button>
            <h2 className="text-xl font-bold mb-4 font-sans uppercase">Boost Info</h2>
            <p className="text-sm mb-4 font-sans uppercase">
              Purchase a boost with USDC on our website to increase your token&apos;s visibility. Boosts add a score to your
              token&apos;s trending rank:
            </p>
            <ul className="text-sm mb-4 list-disc list-inside font-sans uppercase">
              <li>Boost (10) - 10 USDC (12HR)</li>
              <li>Boost (20) - 15 USDC (12HR)</li>
              <li>Boost (30) - 20 USDC (12HR)</li>
              <li>Boost (40) - 25 USDC (12HR)</li>
              <li>Boost (50) - 35 USDC (24HR)</li>
              <li>Boost (100) - 50 USDC (24HR)</li>
              <li>Boost (150) - 75 USDC (36HR)</li>
              <li>Boost (200) - 90 USDC (36HR)</li>
              <li>Boost (250) - 100 USDC (36HR)</li>
              <li>Boost (500) - 175 USDC (48HR)</li>
              <li>Boost (1000) - 300 USDC (48HR)</li>
              <li>Ad (Banner Ad) - 50 USDC</li>
            </ul>
            <p className="text-sm mb-4 font-sans uppercase">
              Once the transaction is confirmed, your token will appear boosted in the screener!
            </p>
            <div className="flex justify-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBoostNow}
                className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 py-2 px-4 rounded font-sans uppercase border border-blue-500/30"
              >
                Boost Now
              </motion.button>
            </div>
          </div>
        </div>
      )}
      {/* Favorite Popup Modal */}
      {showFavoritePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-gray-900 text-gray-200 p-6 rounded-md shadow-xl w-80 border border-blue-500/30 md:w-96">
            <button
              onClick={() => setShowFavoritePopup(false)}
              className="absolute top-2 right-2 text-xl font-bold"
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4 font-sans uppercase">Authentication Required</h2>
            <p className="text-sm mb-4 font-sans uppercase">Please sign in to favorite a token.</p>
            <div className="flex flex-col space-y-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowFavoritePopup(false);
                  setRedirectTo(pathname);
                  setShowLoginModal(true);
                }}
                className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 py-2 px-4 rounded-full w-full font-sans uppercase border border-blue-500/30"
              >
                Sign In
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFavoritePopup(false)}
                className="bg-gray-900 hover:bg-gray-800 text-gray-200 py-2 px-4 rounded-full w-full font-sans border border-blue-500/30 uppercase"
              >
                Cancel
              </motion.button>
            </div>
          </div>
        </div>
      )}
      {/* Selected Alerts Modal - Dark Theme with Blue Accents */}
      {selectedAlerts && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#0a0e17] text-gray-200 rounded-md shadow-2xl w-full max-w-3xl max-h-[85vh] border border-blue-500/30 flex flex-col"
          >
            {/* Compact Header */}
            <div className="p-4 border-b border-gray-800/50 flex items-center justify-between bg-[#070c14]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-500/20 rounded-md flex items-center justify-center border border-blue-500/30">
                  <FaBell className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="text-lg font-bold font-sans uppercase text-gray-100">Token Alerts</h2>
                <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/30">
                  {selectedAlerts.length}
                </span>
              </div>
              <button
                onClick={() => setSelectedAlerts(null)}
                className="text-gray-400 hover:text-gray-200 text-xl font-bold transition-colors p-1 hover:bg-gray-800/50 rounded"
              >
                ×
              </button>
            </div>
            
            {/* Compact Alerts List */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#0a0e17]">
              {selectedAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <FaBell className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-sans uppercase">No alerts found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedAlerts.map((alert, idx) => {
                    const token = tokens.find((t) => t.poolAddress === alert.poolAddress);
                    const colorClass =
                      alert.type === "volume_spike" || alert.type === "boost" || alert.type === "volume_above"
                        ? "text-blue-400"
                        : alert.type === "mover" || alert.type === "price_above" || alert.type === "price_spike" || alert.type === "price_spike_long"
                        ? "text-green-400"
                        : "text-red-400";
                    const messageParts = alert.message.split(/(\d+\.?\d*)/);
                    const formattedMessage = messageParts.map((part, index) => (
                      /^\d+\.?\d*$/.test(part) ? (
                        <span key={index} className={colorClass}>
                          {part}
                        </span>
                      ) : (
                        <span key={index}>{part}</span>
                      )
                    ));
                    
                    return (
                      <div key={idx} className="bg-gray-900/50 border border-gray-800/50 rounded-md p-3 hover:bg-gray-900/70 hover:border-blue-500/30 transition-all">
                        <div className="flex items-center gap-3">
                            {token?.info ? (
                              <Image
                                src={token.info.imageUrl || "/fallback.png"}
                                alt={token.symbol}
                                width={32}
                                height={32}
                                className="rounded-full border border-blue-500/30 flex-shrink-0"
                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                  if (!e.currentTarget.src.includes('data:image/svg')) {
                                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23374151'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239CA3AF' font-size='12'%3E?%3C/text%3E%3C/svg%3E";
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-800 rounded-full border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-500 text-xs font-bold">?</span>
                              </div>
                            )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${colorClass} bg-opacity-10 border border-current`}>
                                {alert.type.replace("_", " ")}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-sm font-sans">
                              <span className="font-semibold text-gray-200">{token?.symbol || "Unknown"}</span>
                              <span className="text-gray-600 mx-1.5">•</span>
                              <span className={colorClass}>{formattedMessage}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => {
                                if (token?.poolAddress) {
                                  router.push(`/discover/${token.poolAddress}/chart`);
                                  setSelectedAlerts(null);
                                }
                              }}
                              className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-full transition-colors border border-blue-500/20"
                              title="View Chart"
                            >
                              <FaChartLine className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (token?.poolAddress) {
                                  handleCopy(token);
                                }
                              }}
                              className="p-2 bg-gray-800/50 hover:bg-gray-800 text-gray-400 rounded-full transition-colors border border-gray-700/50"
                              title="Copy Address"
                            >
                              <FaCopy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Compact Footer */}
            <div className="p-4 border-t border-gray-800/50 flex justify-between items-center bg-[#070c14]">
              <div className="text-xs text-gray-500 font-sans uppercase">
                {selectedAlerts.length} alert{selectedAlerts.length !== 1 ? 's' : ''}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedAlerts(null)}
                  className="px-4 py-2 bg-gray-800/50 hover:bg-gray-800 text-gray-300 rounded-full transition-colors text-xs font-sans uppercase border border-gray-700/50"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {/* Create Watchlist Modal */}
      {showCreateWatchlistModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative bg-gray-900 text-gray-200 p-6 rounded-md shadow-2xl w-full max-w-md border border-blue-500/30"
          >
            <button 
              onClick={() => setShowCreateWatchlistModal(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-blue-500/20 rounded-md flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold font-sans text-white">Create Watchlist</h2>
                <p className="text-sm text-gray-400">Organize your favorite tokens</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Watchlist Name</label>
                <input
                  type="text"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  className="w-full border border-gray-700 p-3 rounded-md font-sans bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g., Top Performers, DeFi Gems"
                  required
                  maxLength={30}
                />
                <p className="text-xs text-gray-500 mt-1">{newWatchlistName.length}/30 characters</p>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Watchlists help you track specific groups of tokens</span>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateWatchlistModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateWatchlist}
                disabled={!newWatchlistName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2 px-6 rounded-md font-medium transition-colors"
              >
                Create Watchlist
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Add to Watchlist Modal */}
      {showAddToWatchlistModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative bg-gray-900 text-gray-200 p-6 rounded-md shadow-2xl w-full max-w-md border border-blue-500/30"
          >
            <button 
              onClick={() => setShowAddToWatchlistModal(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-blue-500/20 rounded-md flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold font-sans text-white">Add to Watchlists</h2>
                <p className="text-sm text-gray-400">Select watchlists to add this token</p>
              </div>
            </div>
            
            {watchlists.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-4">No watchlists found</p>
                <button
                  onClick={() => {
                    setShowAddToWatchlistModal(false);
                    setShowCreateWatchlistModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium transition-colors"
                >
                  Create First Watchlist
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
                  {watchlists.map((wl) => {
                    const tokenCount = wl.tokens.length;
                    const isSelected = watchlistSelections.includes(wl.id);
                    return (
                      <motion.div
                        key={wl.id}
                        whileHover={{ scale: 1.02 }}
                        className={`p-3 rounded-md border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-blue-500/20 border-blue-500/50' 
                            : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                        }`}
                        onClick={() => {
                          setWatchlistSelections((prev) =>
                            isSelected ? prev.filter((id) => id !== wl.id) : [...prev, wl.id]
                          );
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                              isSelected 
                                ? 'bg-blue-500 border-blue-500' 
                                : 'border-gray-600'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white truncate">{wl.name}</p>
                              <p className="text-sm text-gray-400">{tokenCount} token{tokenCount !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              isSelected 
                                ? 'bg-blue-500/20 text-blue-400' 
                                : 'bg-gray-700 text-gray-400'
                            }`}>
                              {isSelected ? 'Selected' : 'Add'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowAddToWatchlistModal(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUpdateWatchlistSelections}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md font-medium transition-colors"
                  >
                    Update Watchlists
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
      {/* Custom Alert Modal */}
      {showCustomAlertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-gray-900 text-gray-200 p-6 rounded-md shadow-xl w-80 border border-blue-500/30 md:w-96">
            <button onClick={() => { setShowCustomAlertModal(false); setEditingCustomAlert(null); }} className="absolute top-2 right-2 text-xl font-bold">
              ×
            </button>
            <h2 className="text-xl font-bold mb-4 font-sans uppercase">{editingCustomAlert ? "Edit" : "Set"} Custom Alert</h2>
            <form onSubmit={handleSaveCustomAlert}>
              <div className="mb-4">
                <label className="block mb-1 font-sans uppercase">Pool Address</label>
                <input
                  type="text"
                  value={customAlertForm.poolAddress}
                  onChange={(e) => setCustomAlertForm({ ...customAlertForm, poolAddress: e.target.value })}
                  className="w-full border border-blue-500/30 p-2 rounded-full font-sans bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                  required
                  placeholder="0x..."
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-sans uppercase">Type</label>
                <select
                  value={customAlertForm.type}
                  onChange={(e) => setCustomAlertForm({ ...customAlertForm, type: e.target.value as "price_above" | "price_below" | "volume_above" | "mc_above" })}
                  className="w-full border border-blue-500/30 p-2 rounded-full font-sans bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                >
                  <option value="price_above">Price Above</option>
                  <option value="price_below">Price Below</option>
                  <option value="volume_above">Volume Above</option>
                  <option value="mc_above">Market Cap Above</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-sans uppercase">Threshold</label>
                <input
                  type="number"
                  value={customAlertForm.threshold}
                  onChange={(e) => setCustomAlertForm({ ...customAlertForm, threshold: e.target.value })}
                  className="w-full border border-blue-500/30 p-2 rounded-full font-sans bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                  required
                  placeholder="e.g. 1.5"
                  step="any"
                />
              </div>
              <div className="flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 py-2 px-4 rounded-full font-sans uppercase border border-blue-500/30"
                >
                  {editingCustomAlert ? "Update" : "Add"} Alert
                </motion.button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Main Container */}
      <div className="flex flex-col w-full h-full min-h-screen">
        {/* Header Bar */}
        {/* Header */}
        <Header />
        {/* Filter & ViewMode Overlay (Mobile full-page) */}
        {showFilterMenu && (
          <div className="fixed inset-0 bg-gray-900 z-50 overflow-y-auto">
            <div className="p-4 relative">
              <button
                onClick={() => setShowFilterMenu(false)}
                className="absolute top-4 right-4 text-gray-200 text-xl font-bold"
              >
                ×
              </button>
              <h2 className="text-lg font-bold text-gray-200 mb-4 uppercase">Menu</h2>
              {/* ViewMode Buttons */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => {
                    setViewMode("all");
                    setShowFilterMenu(false);
                  }}
                  className={`px-3 py-1.5 text-gray-200 rounded-full text-sm font-sans transition-colors uppercase ${
                    viewMode === "all" ? "bg-blue-500/20 text-blue-400" : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  All Tokens
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => {
                    setViewMode("favorites");
                    setShowFilterMenu(false);
                  }}
                  className={`px-3 py-1.5 text-gray-200 rounded-full text-sm font-sans transition-colors uppercase ${
                    viewMode === "favorites" ? "bg-blue-500/20 text-blue-400" : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  Favorites
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => {
                    setViewMode("watchlist");
                    setShowFilterMenu(false);
                  }}
                  className={`px-3 py-1.5 text-gray-200 rounded-full text-sm font-sans transition-colors uppercase ${
                    viewMode === "watchlist" ? "bg-blue-500/20 text-blue-400" : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  Watchlists
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => {
                    setViewMode("alerts");
                    setShowFilterMenu(false);
                  }}
                  className={`px-3 py-1.5 text-gray-200 rounded-full text-sm font-sans transition-colors uppercase ${
                    viewMode === "alerts" ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  Alerts
                </motion.button>
                <motion.button
                  disabled
                  className="p-3 text-gray-400 rounded-full text-base font-sans transition-colors border border-blue-500/30 bg-gray-800 opacity-50 cursor-not-allowed truncate uppercase"
                >
                  New Pairs v2
                </motion.button>
              </div>
              {/* Filter Inputs */}
              <div className="grid grid-cols-1 gap-4 mb-6">
                <div>
                  <label className="block mb-1 text-gray-400 uppercase text-sm font-sans">Min Liq ($)</label>
                  <input
                    type="number"
                    placeholder="Any"
                    value={filters.minLiquidity || ""}
                    onChange={(e) => setFilters({ ...filters, minLiquidity: Number(e.target.value) })}
                    className="w-full p-3 bg-gray-800/50 text-gray-200 border border-blue-500/30 rounded-full text-base font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-gray-400 uppercase text-sm font-sans">Min Vol ($)</label>
                  <input
                    type="number"
                    placeholder="Any"
                    value={filters.minVolume || ""}
                    onChange={(e) => setFilters({ ...filters, minVolume: Number(e.target.value) })}
                    className="w-full p-3 bg-gray-800/50 text-gray-200 border border-blue-500/30 rounded-full text-base font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-gray-400 uppercase text-sm font-sans">Min Age (d)</label>
                  <input
                    type="number"
                    placeholder="Any"
                    value={filters.minAge || ""}
                    onChange={(e) => setFilters({ ...filters, minAge: Number(e.target.value) })}
                    className="w-full p-3 bg-gray-800/50 text-gray-200 border border-blue-500/30 rounded-full text-base font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-gray-400 uppercase text-sm font-sans">Max Age (d)</label>
                  <input
                    type="number"
                    placeholder="Any"
                    value={filters.maxAge === Infinity ? "" : filters.maxAge}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        maxAge: e.target.value ? Number(e.target.value) : Infinity,
                      })
                    }
                    className="w-full p-3 bg-gray-800/50 text-gray-200 border border-blue-500/30 rounded-full text-base font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowFilterMenu(false)}
                  className="bg-gray-800/50 hover:bg-gray-700/50 text-gray-200 py-3 px-6 rounded-full font-sans uppercase border border-blue-500/30"
                >
                  Apply
                </motion.button>
              </div>
            </div>
          </div>
        )}
        {/* Desktop Filter Bar & ViewMode Tabs */}
        {!showFilterMenu && (
          <div className="hidden sm:flex bg-gray-950 p-3 sm:p-4 flex-col sm:flex-row gap-3 sm:gap-4 border-b border-gray-800 shadow-inner border-t border-gray-800">
            <div className="flex flex-col sm:flex-row gap-2 w-full items-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setViewMode("all")}
                className={`px-3 py-1.5 text-gray-200 rounded-full text-xs sm:text-sm w-full sm:w-auto font-sans transition-colors shadow-sm truncate uppercase ${
                  viewMode === "all" ? "bg-blue-500/20 text-blue-400" : "bg-gray-800/50 hover:bg-gray-700/50"
                }`}
              >
                All Tokens
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setViewMode("favorites")}
                className={`px-3 py-1.5 text-gray-200 rounded-full text-xs sm:text-sm w-full sm:w-auto font-sans transition-colors shadow-sm truncate uppercase ${
                  viewMode === "favorites" ? "bg-blue-500/20 text-blue-400" : "bg-gray-800/50 hover:bg-gray-700/50"
                }`}
              >
                Favorites
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setViewMode("watchlist")}
                className={`px-3 py-1.5 text-gray-200 rounded-full text-xs sm:text-sm w-full sm:w-auto font-sans transition-colors shadow-sm truncate uppercase ${
                  viewMode === "watchlist" ? "bg-blue-500/20 text-blue-400" : "bg-gray-800/50 hover:bg-gray-700/50"
                }`}
              >
                Watchlists
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setViewMode("alerts")}
                className={`px-3 py-1.5 text-gray-200 rounded-full text-xs sm:text-sm w-full sm:w-auto font-sans transition-colors uppercase ${
                  viewMode === "alerts" ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" : "bg-gray-800 hover:bg-gray-700"
                }`}
              >
                Alerts
              </motion.button>
            </div>
            <div className="hidden sm:flex gap-2">
              <input
                type="number"
                placeholder="Min Liq ($)"
                value={filters.minLiquidity || ""}
                onChange={(e) => setFilters({ ...filters, minLiquidity: Number(e.target.value) })}
                className="px-3 py-1.5 bg-gray-800/50 text-gray-200 border border-blue-500/30 rounded-full text-xs sm:text-sm w-full sm:w-28 font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Minimum Liquidity ($)"
              />
              <input
                type="number"
                placeholder="Min Vol ($)"
                value={filters.minVolume || ""}
                onChange={(e) => setFilters({ ...filters, minVolume: Number(e.target.value) })}
                className="px-3 py-1.5 bg-gray-800/50 text-gray-200 border border-blue-500/30 rounded-full text-xs sm:text-sm w-full sm:w-28 font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Minimum Volume ($)"
              />
              <input
                type="number"
                placeholder="Min Age (d)"
                value={filters.minAge || ""}
                onChange={(e) => setFilters({ ...filters, minAge: Number(e.target.value) })}
                className="px-3 py-1.5 bg-gray-800/50 text-gray-200 border border-blue-500/30 rounded-full text-xs sm:text-sm w-full sm:w-28 font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Minimum Age (days)"
              />
              <input
                type="number"
                placeholder="Max Age (d)"
                value={filters.maxAge === Infinity ? "" : filters.maxAge}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    maxAge: e.target.value ? Number(e.target.value) : Infinity,
                  })
                }
                className="px-3 py-1.5 bg-gray-800/50 text-gray-200 border border-blue-500/30 rounded-full text-xs sm:text-sm w-full sm:w-28 font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Maximum Age (days)"
              />
            </div>
          </div>
        )}
        {/* Watchlist Selector - Single Line */}
        {viewMode === "watchlist" && (
          <div className="bg-gray-950 px-3 py-2 border-b border-gray-800 shadow-inner">
            <div className="flex items-center gap-2 flex-wrap">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateWatchlistModal(true)}
                  className="bg-gray-800/50 hover:bg-gray-700/50 text-gray-200 py-1.5 px-3 rounded-full text-xs font-sans transition-colors flex items-center gap-1.5 border border-gray-700/50 whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>New</span>
                </motion.button>
              
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="relative flex-1 min-w-0 max-w-xs">
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                  <select
                    value={selectedWatchlist || ""}
                    onChange={(e) => setSelectedWatchlist(e.target.value)}
                    className="w-full bg-gray-800/50 text-gray-200 border border-blue-500/30 py-1.5 pl-8 pr-2 rounded-full text-xs font-sans focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all truncate"
                  >
                    <option value="">Select watchlist</option>
                    {watchlists.map((wl) => (
                      <option key={wl.id} value={wl.id}>
                        {wl.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedWatchlist && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-gray-400 whitespace-nowrap">
                      <span>{watchlists.find(w => w.id === selectedWatchlist)?.tokens.length || 0} tokens</span>
                      <span>•</span>
                      <span>Updated {new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                    {watchlists.length > 1 && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          const watchlistName = watchlists.find(w => w.id === selectedWatchlist)?.name || 'this watchlist';
                          if (confirm(`Delete "${watchlistName}"?`)) {
                            await deleteWatchlist(selectedWatchlist);
                            setSelectedWatchlist(watchlists.find(w => w.id !== selectedWatchlist)?.id || '');
                          }
                        }}
                        className="p-1.5 bg-gray-800/50 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-full text-xs transition-colors border border-gray-700/50 hover:border-red-500/30"
                        title="Delete watchlist"
                      >
                        <FaTrash className="w-3 h-3" />
                      </motion.button>
                    )}
                    <button
                      onClick={() => setSelectedWatchlist("")}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap px-2"
                    >
                      View All
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Main Table or Alerts Feed */}
        <div className="flex-1 flex flex-col w-full overflow-hidden">
          <div
            className={`flex-1 overflow-x-hidden bg-gray-950 scrollbar-hide ${loading ? 'overflow-hidden' : 'overflow-y-auto'}`}
            style={{ 
              maxHeight: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 160px)',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              overscrollBehaviorY: 'contain',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingBottom: isMobile ? 0 : '80px'
            }}
          >
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-gray-950">
              <LoadingPage />
            </div>
          ) : filteredAndSortedTokens.length === 0 && viewMode !== "alerts" ? (
            <div className="p-4 text-center text-gray-400 font-sans uppercase w-full h-full flex items-center justify-center">
              No tokens match your filters. Try adjusting filters or check Firebase data.
            </div>
          ) : viewMode === "alerts" ? (
            <div className="w-full h-full bg-gray-950 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {/* Compact Header - Single Line */}
              <div className="p-3 border-b border-gray-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <h2 className="text-sm font-bold font-sans text-gray-200 uppercase whitespace-nowrap">Alerts</h2>
                  <div className="flex gap-1.5 flex-1 min-w-0">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setAlertTab("feed")}
                      className={`px-3 py-1.5 text-xs font-sans transition-colors border rounded-full uppercase whitespace-nowrap ${
                        alertTab === "feed" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-gray-900/50 hover:bg-gray-800/50 text-gray-300 border-gray-700/50"
                      }`}
                    >
                      Feed
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setAlertTab("triggers")}
                      className={`px-3 py-1.5 text-xs font-sans transition-colors border rounded-full uppercase whitespace-nowrap ${
                        alertTab === "triggers" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-gray-900/50 hover:bg-gray-800/50 text-gray-300 border-gray-700/50"
                      }`}
                    >
                      Triggers
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setAlertTab("history")}
                      className={`px-3 py-1.5 text-xs font-sans transition-colors border rounded-full uppercase whitespace-nowrap ${
                        alertTab === "history" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-gray-900/50 hover:bg-gray-800/50 text-gray-300 border-gray-700/50"
                      }`}
                    >
                      History
                    </motion.button>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setEditingCustomAlert(null); setShowCustomAlertModal(true); }}
                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-1.5 px-3 rounded-md text-xs font-sans uppercase border border-blue-500/30 whitespace-nowrap"
                >
                  + Alert
                </motion.button>
              </div>
              {alertTab === "feed" ? (
                !alerts || alerts.length === 0 ? (
                  <p className="p-4 text-xs text-gray-400 font-sans uppercase">No recent alerts.</p>
                ) : (
                  <div className="divide-y divide-gray-800/50">
                    {alerts.map((alert, idx) => {
                      const token = tokens.find((t) => t.poolAddress === alert.poolAddress);
                      const colorClass =
                        alert.type === "volume_spike" || alert.type === "boost" || alert.type === "volume_above"
                          ? "text-blue-400"
                          : alert.type === "mover" || alert.type === "price_above" || alert.type === "price_spike" || alert.type === "price_spike_long"
                          ? "text-green-500"
                          : "text-red-500";
                      const messageParts = alert.message.split(/(\d+\.?\d*)/);
                      const formattedMessage = messageParts.map((part, index) => (
                        /^\d+\.?\d*$/.test(part) ? (
                          <span key={index} className={colorClass}>
                            {part}
                          </span>
                        ) : (
                          <span key={index}>{part}</span>
                        )
                      ));
                      return (
                        <div key={idx} className="px-3 py-3 hover:bg-gray-900/30 transition-colors flex items-center gap-3 text-sm">
                          {token?.info && (
                            <Image
                              src={token.info.imageUrl || "/fallback.png"}
                              alt={token.symbol}
                              width={24}
                              height={24}
                              className="rounded-full border border-blue-500/30 flex-shrink-0"
                              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                if (!e.currentTarget.src.includes('data:image/svg')) {
                                  e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect width='24' height='24' fill='%23374151'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239CA3AF' font-size='10'%3E?%3C/text%3E%3C/svg%3E";
                                }
                              }}
                            />
                          )}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-semibold text-gray-300 uppercase whitespace-nowrap hover:text-blue-400 transition-colors cursor-pointer">{alert.type.replace("_", " ")}</span>
                            <span className="text-gray-500">•</span>
                            <span className="font-semibold text-gray-200 truncate">{token?.symbol || "Unknown"}</span>
                            <span className="text-gray-500">•</span>
                            <span className={colorClass}>{formattedMessage}</span>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : alertTab === "triggers" ? (
                <>
                  {filteredCustomAlerts.length === 0 ? (
                    <div className="p-6 text-center">
                      <FaExclamationTriangle className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                      <p className="text-xs text-gray-400 font-sans uppercase mb-3">No active triggers</p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setEditingCustomAlert(null); setShowCustomAlertModal(true); }}
                        className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-1.5 px-3 rounded-md text-xs font-sans uppercase border border-blue-500/30"
                      >
                        Create Trigger
                      </motion.button>
                    </div>
                  ) : (
                    <>
                      {/* Compact Filter Bar - Single Line */}
                      <div className="p-3 border-b border-gray-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400 font-sans uppercase">Active:</span>
                          <span className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-2 py-0.5 rounded-md text-sm font-bold border border-blue-500/30 transition-colors cursor-pointer">
                            {filteredCustomAlerts.length}
                          </span>
                        </div>
                        <select
                          value={triggerFilter}
                          onChange={(e) => setTriggerFilter(e.target.value as typeof triggerFilter)}
                          className="bg-gray-900/50 text-gray-200 border border-blue-500/20 px-3 py-1.5 rounded-md text-sm font-sans focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        >
                          <option value="all">All Types</option>
                          <option value="price_above">Price Above</option>
                          <option value="price_below">Price Below</option>
                          <option value="volume_above">Volume Above</option>
                          <option value="mc_above">Market Cap Above</option>
                        </select>
                      </div>
                      {/* Compact Trigger List - Larger Text */}
                      <div className="divide-y divide-gray-800/50">
                        {filteredCustomAlerts.map((ca) => {
                          const token = tokens.find((t) => t.poolAddress === ca.poolAddress);
                          const alertToken = alertTokenData.get(ca.poolAddress);
                          const tokenSymbol = alertToken?.symbol || token?.symbol || "Unknown";
                          const tokenImage = alertToken?.imageUrl || token?.info?.imageUrl || `https://dexscreener.com/base/${ca.poolAddress}/logo.png`;
                          
                          const currentPrice = token ? parseFloat(token.priceUsd || "0") : 0;
                          const volumeH1 = token ? token.volume?.h1 || 0 : 0;
                          const marketCap = token ? token.marketCap || 0 : 0;
                          let color = "text-gray-400";
                          let progress = 0;
                          let icon = null;
                          if (ca.notified) {
                            color = "text-green-400";
                          } else {
                            if (ca.type === "price_above") {
                              progress = Math.min(100, (currentPrice / ca.threshold) * 100);
                              color = "text-green-400";
                              icon = <FaArrowUp className="w-4 h-4" />;
                            } else if (ca.type === "price_below") {
                              progress = currentPrice > ca.threshold ? (ca.threshold / currentPrice * 100) : 100;
                              color = "text-red-400";
                              icon = <FaArrowDown className="w-4 h-4" />;
                            } else if (ca.type === "volume_above") {
                              progress = Math.min(100, (volumeH1 / ca.threshold) * 100);
                              color = "text-blue-400";
                              icon = <FaVolumeUp className="w-4 h-4" />;
                            } else if (ca.type === "mc_above") {
                              progress = Math.min(100, (marketCap / ca.threshold) * 100);
                              color = "text-purple-400";
                              icon = <FaDollarSign className="w-4 h-4" />;
                            }
                          }
                          const currentValue = ca.type === "price_above" || ca.type === "price_below"
                            ? currentPrice.toFixed(4)
                            : ca.type === "volume_above"
                            ? volumeH1.toLocaleString()
                            : marketCap.toLocaleString();
                          return (
                            <div key={ca.id} className="px-3 py-3 hover:bg-gray-900/30 transition-colors flex items-center gap-3 text-sm">
                              <Image
                                src={tokenImage}
                                alt={tokenSymbol}
                                width={24}
                                height={24}
                                className="rounded-full border border-blue-500/30 flex-shrink-0"
                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                  // Prevent infinite loops by checking if we've already tried fallback
                                  if (e.currentTarget.src.includes('data:image/svg')) return;
                                  // Use placeholder SVG instead of trying more URLs
                                  e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect width='24' height='24' fill='%23374151'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239CA3AF' font-size='10'%3E?%3C/text%3E%3C/svg%3E";
                                }}
                              />
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`${color} flex-shrink-0`}>{icon}</div>
                                <span className="font-semibold text-gray-200 truncate">{tokenSymbol}</span>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-400 uppercase text-xs hover:text-blue-400 transition-colors cursor-pointer">{ca.type.replace("_", " ")}</span>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-400">Target: <span className="text-gray-200">${ca.threshold.toFixed(2)}</span></span>
                                <span className="text-gray-500">•</span>
                                <span className={color}>Current: ${currentValue}</span>
                                {!ca.notified && (
                                  <>
                                    <span className="text-gray-500">•</span>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <div className="w-20 bg-gray-800 rounded-md h-1.5 border border-blue-500/10">
                                        <div
                                          className={`h-1.5 rounded-md transition-all duration-500 ${getProgressColor(ca.type, progress > 0)}`}
                                          style={{ width: `${Math.min(100, progress)}%` }}
                                        ></div>
                                      </div>
                                      <span className="text-xs text-gray-500 w-10">{progress.toFixed(0)}%</span>
                                    </div>
                                  </>
                                )}
                                {ca.notified && (
                                  <>
                                    <span className="text-gray-500">•</span>
                                    <span className="text-green-400 flex items-center gap-1">
                                      <FaCheck className="w-3.5 h-3.5" />
                                      <span className="text-xs">Triggered</span>
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setEditingCustomAlert(ca)}
                                  className="p-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded-lg text-gray-300 hover:text-blue-400 transition-all"
                                  title="Edit"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </motion.button>
                                {ca.notified && (
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleResetNotified(ca.id!)}
                                    className="p-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded-lg text-gray-300 hover:text-blue-400 transition-all"
                                    title="Reset"
                                  >
                                    <ArrowPathIcon className="w-4 h-4" />
                                  </motion.button>
                                )}
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    if (ca.id) {
                                      deleteDoc(doc(db, `users/${user?.uid ?? ''}/customAlerts`, ca.id));
                                      reactToast.success("Alert removed", { position: "bottom-left" });
                                    }
                                  }}
                                  className="p-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded-lg text-gray-300 hover:text-red-400 transition-all"
                                  title="Delete"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="p-4 text-xs text-gray-400 font-sans uppercase">Coming soon: Alert history and analytics</p>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto scrollbar-hide pb-12" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <table className="table-auto w-full whitespace-nowrap text-sm font-sans uppercase min-w-[1200px]">
                  <thead className="bg-gray-950 text-gray-400 sticky top-0 z-10 border-b border-gray-800">
                    <tr>
                      <th
                        className="p-3 text-left cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("trending")}
                        title="Rank by trending score"
                      >
                        #{sortFilter === "trending" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th className="p-3 text-left" title="Token Pair">
                        POOL
                      </th>
                      <th className="p-3 text-right" title="Price in USD">
                        PRICE
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("age")}
                        title="Age of the token pair"
                      >
                        AGE{sortFilter === "age" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("5m")}
                        title="Price change in last 5 minutes"
                      >
                        5M{sortFilter === "5m" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("1h")}
                        title="Price change in last 1 hour"
                      >
                        1H{sortFilter === "1h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("6h")}
                        title="Price change in last 6 hours"
                      >
                        6H{sortFilter === "6h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("24h")}
                        title="Price change in last 24 hours"
                      >
                        24H{sortFilter === "24h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("volume")}
                        title="Trading volume in last 24 hours"
                      >
                        VOLUME{sortFilter === "volume" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("liquidity")}
                        title="Liquidity in USD"
                      >
                        LIQUIDITY{sortFilter === "liquidity" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("marketCap")}
                        title="Market capitalization"
                      >
                        MKT CAP{sortFilter === "marketCap" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th className="p-3 text-center" title="Alerts">
                        ALERTS
                      </th>
                      <th className="p-3 text-center" title="Actions">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTokens.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-4 text-center text-gray-400 font-sans uppercase">
                          No tokens available for this page. Try adjusting filters or check Firebase/DexScreener data.
                        </td>
                      </tr>
                    ) : (
                      currentTokens.map((token, index) => {
                        const rank = indexOfFirstToken + index + 1;
                        const tokenAlerts = alerts.filter((alert) => alert.poolAddress === token.poolAddress);
                        // Skip invalid addresses silently (they might be transaction hashes or other identifiers)
                        if (!/^0x[a-fA-F0-9]{40}$/.test(token.poolAddress)) {
                          return null;
                        }
                        return (
                          <motion.tr
                            key={token.poolAddress}
                            className="border-b border-blue-500/30 hover:bg-gray-800 transition-colors duration-200"
                            variants={rowVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <td className="p-3">
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center justify-center w-12 font-sans text-gray-200 shadow-sm border border-blue-500/30 uppercase bg-gray-900 rounded-full px-2 py-1">
                                  {getTrophy(rank) || rank}
                                </div>
                                <div className="flex items-center space-x-1">
                                  {token.boosted && (
                                    <>
                                      <MarketingIcon />
                                      <span className="text-blue-400 text-xs uppercase">+{token.boostValue}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 font-sans uppercase">
                              <div
                                onClick={() => handleTokenClick(token.poolAddress)}
                                className="flex items-center space-x-2 hover:text-blue-400 cursor-pointer transition-colors duration-150"
                              >
                                <DexIcon dexId={token.dexId} symbol={token.symbol} />
                                {token.info && (
                                  <Image
                                    src={token.info.imageUrl || "/fallback.png"}
                                    alt={token.symbol}
                                    width={24}
                                    height={24}
                                    className="rounded-full border border-blue-500/30"
                                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                      if (!e.currentTarget.src.includes('data:image/svg')) {
                                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect width='24' height='24' fill='%23374151'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239CA3AF' font-size='10'%3E?%3C/text%3E%3C/svg%3E";
                                      }
                                    }}
                                  />
                                )}
                                <div>
                                  <span className="font-bold text-gray-200">{token.symbol}</span> /{" "}
                                  <span className="text-gray-400">{token.quoteToken?.symbol || "WETH"}</span>
                                  <br />
                                  <span className="text-xs text-gray-400">{token.name}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-right text-gray-200">{formatPrice(token.priceUsd || 0)}</td>
                            <td className="p-3 text-right text-gray-200">
                              <LiveTimeAgo createdAt={token.pairCreatedAt} currentTime={currentTime} timeCounter={timeCounter} />
                            </td>
                            <td className={`p-3 text-right ${getColorClass(token.priceChange?.m5 || 0)}`}>
                              {(token.priceChange?.m5 || 0).toFixed(2)}%
                            </td>
                            <td className={`p-3 text-right ${getColorClass(token.priceChange?.h1 || 0)}`}>
                              {(token.priceChange?.h1 || 0).toFixed(2)}%
                            </td>
                            <td className={`p-3 text-right ${getColorClass(token.priceChange?.h6 || 0)}`}>
                              {(token.priceChange?.h6 || 0).toFixed(2)}%
                            </td>
                            <td className={`p-3 text-right ${getColorClass(token.priceChange?.h24 || 0)}`}>
                              {(token.priceChange?.h24 || 0).toFixed(2)}%
                            </td>
                            <td className="p-3 text-right text-gray-200">
                              ${(token.volume?.h24 || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-right text-gray-200">
                              ${(token.liquidity?.usd || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-right text-gray-200">
                              {formatCompactCurrency(token.marketCap || 0)}
                            </td>
                            <td className="p-3 text-center">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setSelectedAlerts(tokenAlerts)}
                                className="px-3 py-1 rounded"
                                title="View Alerts"
                              >
                                <div
                                  className={`bg-gray-800 border border-blue-500/30 rounded-full px-2 py-1 flex items-center justify-center space-x-2 ${getBellColor(
                                    tokenAlerts
                                  )}`}
                                >
                                  <FaBell className="w-4 h-4" />
                                  <span className="text-xs">{tokenAlerts.length}</span>
                                </div>
                              </motion.button>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setTimeout(() => handleCopy(token), 100);
                                  }}
                                  className="p-1.5 rounded transition-colors duration-200 text-gray-400"
                                  title="Copy token address"
                                >
                                  <FaCopy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleFavorite(token.poolAddress)}
                                  className="p-1.5 rounded transition-colors duration-200 text-gray-400"
                                  title={
                                    favorites.includes(token.poolAddress)
                                      ? "Remove from favorites"
                                      : "Add to favorites"
                                  }
                                >
                                  <FaStar
                                    className={`w-4 h-4 ${
                                      favorites.includes(token.poolAddress)
                                        ? "text-yellow-400"
                                        : ""
                                    }`}
                                  />
                                </button>
                                <button
                                  onClick={() => handleOpenAddToWatchlist(token.poolAddress)}
                                  className="p-1.5 rounded transition-colors duration-200 text-gray-400"
                                  title="Add to watchlists"
                                >
                                  <FaBookmark className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile Table View */}
              <div
                className="md:hidden bg-gray-950"
                style={{ 
                  paddingBottom: `calc(${footerHeight + 56}px + env(safe-area-inset-bottom, 0px))`,
                  marginBottom: 0,
                  overscrollBehavior: 'contain',
                  overscrollBehaviorY: 'contain'
                }}
                onTouchStart={handlePullToRefreshStart}
                onTouchMove={handlePullToRefreshMove}
                onTouchEnd={handlePullToRefreshEnd}
              >
                {isRefreshing && (
                  <div className="sticky top-0 z-20 flex items-center justify-center bg-blue-500/20 py-2 text-xs font-semibold uppercase tracking-wide text-blue-400">
                    <FaRedo className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing...
                  </div>
                )}

                <table className="w-full table-fixed text-[11px] font-sans uppercase text-gray-400 bg-gray-950">
                  <thead className="bg-gray-950 text-[10px] sticky top-0 z-10 border-b border-gray-800">
                    <tr>
                      <th className="px-2 py-3 text-left font-semibold tracking-wide whitespace-nowrap" style={{ width: '7%' }}>#</th>
                      <th className="px-2 py-3 text-left font-semibold tracking-wide" style={{ width: '24%' }}>Token</th>
                      <th className="px-2 py-3 text-right font-semibold tracking-wide whitespace-nowrap" style={{ width: '18%' }}>Price</th>
                      <th 
                        className="px-2 py-3 text-right font-semibold tracking-wide whitespace-nowrap cursor-pointer hover:text-blue-400 transition-colors" 
                        style={{ width: '16%' }}
                        onClick={() => {
                          const filters = ["5m", "1h", "6h", "24h"];
                          const currentIndex = filters.indexOf(sortFilter);
                          const nextFilter = filters[(currentIndex + 1) % filters.length];
                          handleFilterChange(nextFilter);
                        }}
                        title="Click to cycle: 5m → 1h → 6h → 24h"
                      >
                        {sortFilter === "5m" ? "5m" : sortFilter === "1h" ? "1h" : sortFilter === "6h" ? "6h" : "24h"}
                      </th>
                      <th className="px-2 py-3 text-right font-semibold tracking-wide whitespace-nowrap" style={{ width: '18%' }}>Mcap</th>
                      <th className="px-2 py-3 text-right font-semibold tracking-wide whitespace-nowrap" style={{ width: '17%' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-950">
                    {showMobileSkeleton && isMobile && (loading || tokens.length === 0) ? (
                      Array.from({ length: 6 }).map((_, index) => (
                        <tr key={`mobile-skeleton-${index}`} className="border-b border-blue-500/10 bg-gray-950 last:border-b-0">
                          <td className="px-2 py-4" style={{ width: '7%' }}>
                            <div className="h-3 w-8 rounded bg-gray-800/80 animate-pulse" />
                          </td>
                          <td className="px-2 py-4" style={{ width: '24%' }}>
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-gray-800/80 animate-pulse flex-shrink-0" />
                              <div className="h-3 flex-1 rounded bg-gray-800/80 animate-pulse" />
                            </div>
                          </td>
                          <td className="px-2 py-4 text-right" style={{ width: '18%' }}>
                            <div className="ml-auto h-3 w-14 rounded bg-gray-800/80 animate-pulse" />
                          </td>
                          <td className="px-2 py-4 text-right" style={{ width: '16%' }}>
                            <div className="ml-auto h-3 w-12 rounded bg-gray-800/80 animate-pulse" />
                          </td>
                          <td className="px-2 py-4 text-right" style={{ width: '18%' }}>
                            <div className="ml-auto h-3 w-16 rounded bg-gray-800/80 animate-pulse" />
                          </td>
                          <td className="px-2 py-4 text-right" style={{ width: '17%' }}>
                            <div className="ml-auto h-3 w-10 rounded bg-gray-800/80 animate-pulse" />
                          </td>
                        </tr>
                      ))
                    ) : currentTokens.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-[11px] text-gray-500">
                          No tokens available for this page. Try adjusting filters or check Firebase/DexScreener data.
                        </td>
                      </tr>
                    ) : (
                      currentTokens.map((token, index) => {
                        const rank = indexOfFirstToken + index + 1;
                        // Filter-aware price change based on sortFilter
                        let priceChange = 0;
                        if (sortFilter === "5m") {
                          priceChange = token.priceChange?.m5 ?? 0;
                        } else if (sortFilter === "1h") {
                          priceChange = token.priceChange?.h1 ?? 0;
                        } else if (sortFilter === "6h") {
                          priceChange = token.priceChange?.h6 ?? 0;
                        } else {
                          priceChange = token.priceChange?.h24 ?? 0;
                        }

                        // Skip invalid addresses silently (they might be transaction hashes or other identifiers)
                        if (!/^0x[a-fA-F0-9]{40}$/.test(token.poolAddress)) {
                          return null;
                        }

                        return (
                          <motion.tr
                            key={token.poolAddress}
                            className="border-b border-blue-500/10 bg-gray-950 text-[11px] text-gray-300 transition-colors duration-150 hover:bg-gray-900/60 last:border-b-0"
                            variants={rowVariants}
                            initial="hidden"
                            animate="visible"
                            onClick={() => handleTokenClick(token.poolAddress)}
                          >
                            <td className="px-2 py-3" style={{ width: '7%' }}>
                              <div className="flex items-center gap-1 text-gray-200">
                                <span className="font-semibold text-[10px]">#{rank}</span>
                                {token.boosted && (
                                  <div className="flex items-center gap-1 text-blue-400">
                                    <MarketingIcon />
                                    {typeof token.boostValue === "number" && (
                                      <span className="text-[9px] font-semibold">+{token.boostValue}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-3" style={{ width: '24%' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                {token.info?.imageUrl ? (
                                  <Image
                                    src={token.info.imageUrl}
                                    alt={token.symbol}
                                    width={20}
                                    height={20}
                                    className="h-5 w-5 rounded-full border border-blue-500/30 object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="h-5 w-5 rounded-full border border-blue-500/30 bg-gray-800/80 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-semibold text-gray-100 text-[11px]">{token.symbol}</div>
                                  <div className="truncate text-[9px] uppercase text-gray-500">
                                    {token.quoteToken?.symbol || token.name || "WETH"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3 text-right text-gray-200 whitespace-nowrap" style={{ width: '18%' }}>
                              <span className="text-[11px]">{formatPrice(token.priceUsd || 0)}</span>
                            </td>
                            <td className={`px-2 py-3 text-right font-semibold whitespace-nowrap ${getColorClass(priceChange)}`} style={{ width: '16%' }}>
                              <span className="text-[11px]">{`${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)}%`}</span>
                            </td>
                            <td className="px-2 py-3 text-right text-gray-200 whitespace-nowrap" style={{ width: '18%' }}>
                              <span className="text-[11px]">{formatCompactCurrency(token.marketCap || 0)}</span>
                            </td>
                            <td className="px-2 py-3 text-right text-gray-400 whitespace-nowrap" style={{ width: '17%' }}>
                              <span className="text-[10px]">
                                <LiveTimeAgo createdAt={token.pairCreatedAt} currentTime={currentTime} timeCounter={timeCounter} />
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </>
          )}
          </div>
        </div>

        {/* Mobile Pagination */}
        <div
          className="md:hidden fixed left-0 right-0 z-40 flex items-center justify-between bg-gray-950 px-4 py-3 text-[11px] font-semibold uppercase text-gray-200"
          style={{ 
            bottom: `calc(${footerHeight}px + env(safe-area-inset-bottom, 0px))`,
            borderTop: '1px solid rgba(31, 41, 55, 0.5)'
          }}
        >
          {totalPages > 1 ? (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 transition-colors hover:text-blue-300 disabled:opacity-40"
              >
                Prev
              </motion.button>
              <span className="tracking-wide text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 transition-colors hover:text-blue-300 disabled:opacity-40"
              >
                Next
              </motion.button>
            </>
          ) : (
            <div className="flex-1" />
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowMobileFilterModal(true)}
            className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-md text-gray-300 hover:bg-gray-800 hover:text-white transition-all"
          >
            <FaFilter className="w-3 h-3" />
            <span className="text-[10px] font-medium">
              {sortFilter === "trending" ? "Trend" : 
               sortFilter === "age" ? "Age" :
               sortFilter === "5m" ? "5M" :
               sortFilter === "1h" ? "1H" :
               sortFilter === "6h" ? "6H" :
               sortFilter === "24h" ? "24H" :
               sortFilter === "volume" ? "Vol" :
               sortFilter === "liquidity" ? "Liq" :
               sortFilter === "marketCap" ? "Mcap" : "Filter"}
              {sortDirection === "desc" ? " ↓" : " ↑"}
            </span>
          </motion.button>
        </div>

        {/* Mobile Filter Modal */}
        <AnimatePresence>
          {showMobileFilterModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] md:hidden"
                onClick={() => setShowMobileFilterModal(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: "100%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "100%" }}
                transition={{ 
                  type: "spring", 
                  damping: 30, 
                  stiffness: 300,
                  mass: 0.8
                }}
                className="fixed inset-0 z-[10000] md:hidden bg-gray-950 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-full flex flex-col">
                  <div className="px-4 pt-6 pb-4 border-b border-gray-800">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white text-base font-semibold">Sort & Filter</h3>
                      <button
                        onClick={() => setShowMobileFilterModal(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-xl font-light"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
                    <div className="space-y-2">
                    {[
                      { key: "trending", label: "Trending Score" },
                      { key: "age", label: "Age" },
                      { key: "5m", label: "5M Change" },
                      { key: "1h", label: "1H Change" },
                      { key: "6h", label: "6H Change" },
                      { key: "24h", label: "24H Change" },
                      { key: "volume", label: "Volume" },
                      { key: "liquidity", label: "Liquidity" },
                      { key: "marketCap", label: "Market Cap" },
                    ].map((filter) => (
                      <motion.button
                        key={filter.key}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          handleFilterChange(filter.key);
                          setShowMobileFilterModal(false);
                        }}
                        className={`w-full flex items-center justify-between p-3.5 rounded-md border transition-all ${
                          sortFilter === filter.key
                            ? "bg-gray-800 border-gray-700 text-white"
                            : "bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <span className="text-sm font-medium">{filter.label}</span>
                        {sortFilter === filter.key && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSortDirection(sortDirection === "desc" ? "asc" : "desc");
                                setCurrentPage(1);
                              }}
                              className="px-3 py-1 rounded-md bg-gray-700 border border-gray-600 text-gray-200 hover:bg-gray-600 hover:border-gray-500 text-xs font-medium transition-colors"
                            >
                              {sortDirection === "desc" ? "↓ Desc" : "↑ Asc"}
                            </button>
                          </div>
                        )}
                      </motion.button>
                    ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Footer */}
        <Footer desktopAddon={desktopPagination} />
      </div>

      {/* Point Transaction Modal */}
      {pendingTokenSubmission && (
        <PointTransactionModal
          isOpen={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          onConfirm={handleConfirmTokenTransaction}
          transaction={{
            action: 'submit_token',
            points: 25,
            description: `Submit token listing for ${pendingTokenSubmission.tokenSymbol}`,
            metadata: {
              tokenSymbol: pendingTokenSubmission.tokenSymbol,
              tokenAddress: pendingTokenSubmission.tokenAddress,
              tokenLogo: pendingTokenSubmission.tokenLogo
            }
          }}
          userPoints={userPoints}
          walletAddress={user ? `user_${user.uid}` : undefined}
        />
      )}
    </div>
  );
}
