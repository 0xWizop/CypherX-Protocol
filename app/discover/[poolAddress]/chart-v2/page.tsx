"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../../../components/Header";
import LightweightChart, { type LightweightChartHandle } from "./LightweightChart.tsx";
import { coinGeckoMapping } from "../../../tokenMapping";
import dayjs from "dayjs";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import { OverviewIcon, PerformanceIcon, SwapArrowsIcon, TradesIcon } from "../../../components/icons";
import { FiX, FiCheck, FiChevronDown, FiCopy, FiStar, FiBell } from "react-icons/fi";
import OrderManagement from "../../../components/OrderManagement";
import { useWalletSystem } from "@/app/providers";
import { useWatchlists } from "@/app/hooks/useWatchlists";
import { usePriceAlerts } from "@/app/hooks/usePriceAlerts";

// Extend Window interface for ethereum provider
declare global {
  interface Window {
    ethereum?: any;
  }
}

interface DexPairResponse {
  pair?: {
    priceUsd?: string;
    priceNative?: string;
    baseToken?: { 
      symbol?: string; 
      address?: string;
      name?: string;
      website?: string;
      twitter?: string;
      telegram?: string;
    };
    quoteToken?: { symbol?: string; address?: string };
    fdv?: number;
    marketCap?: number;
    liquidity?: { usd?: number };
    txns?: { h24?: { buys: number; sells: number } };
    volume?: { h24?: number };
    info?: { imageUrl?: string };
    dexId?: string;
  };
}

// Constants
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base WETH

const MOBILE_TABS = [
  { id: "overview", label: "Chart", icon: OverviewIcon },
  { id: "pnl", label: "PnL", icon: PerformanceIcon },
  { id: "swap", label: "Swap", icon: SwapArrowsIcon },
  { id: "trades", label: "Trades", icon: TradesIcon },
] as const;

const TIMEFRAME_OPTIONS = ["1m", "5m", "1h", "4h", "1d"] as const;
const MOBILE_TAB_HEIGHT = 44;

type MobileTabKey = typeof MOBILE_TABS[number]["id"];

export default function ChartV2Page() {
  const params = useParams();
  const poolAddress = params?.poolAddress as string | undefined;
  const router = useRouter();
  const { selfCustodialWallet } = useWalletSystem();
  const { watchlists, addToWatchlist, removeFromWatchlist, getWatchlistsForToken, isInWatchlist } = useWatchlists();
  const { createAlert, hasActiveAlert } = usePriceAlerts();

  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [pair, setPair] = useState<DexPairResponse["pair"] | null>(null);
  const [candles, setCandles] = useState<Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>>([]);
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showEMA, setShowEMA] = useState(false);
  // Adaptive moving average period based on timeframe
  const getAdaptivePeriod = useCallback((tf: string): number => {
    switch (tf) {
      case '1m': return 20; // 20 minutes
      case '5m': return 12; // 1 hour (12 * 5min)
      case '1h': return 24; // 24 hours
      case '4h': return 12; // 2 days (12 * 4h)
      case '1d': return 20; // 20 days
      default: return 20;
    }
  }, []);
  
  const [movingAveragePeriod, setMovingAveragePeriod] = useState(20);
  const [indicatorColors, setIndicatorColors] = useState({
    sma: "#3b82f6",
    ema: "#a855f7",
    vwap: "#f59e0b",
    rsi: "#ec4899",
  });
  const [activeDataTab, setActiveDataTab] = useState<"orders" | "positions">("orders");
  const [activeMiddleTab, setActiveMiddleTab] = useState<"trades" | "holders">("trades");
  const [transactions, setTransactions] = useState<Array<{ hash: string; timestamp: number; tokenAmount: number; tokenSymbol?: string; tokenAddress?: string; isBuy?: boolean }>>([]);
  const [timeframe, setTimeframe] = useState<string>("1d");
  const [yAxisMode, setYAxisMode] = useState<"price" | "marketCap">("price");
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState(false);
  const [showIndicatorsDropdown, setShowIndicatorsDropdown] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const [newTradeHashes, setNewTradeHashes] = useState<Set<string>>(new Set());
  const [prevTransactionsLength, setPrevTransactionsLength] = useState(0);
  const chartRef = React.useRef<LightweightChartHandle | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timeframeButtonRef = useRef<HTMLButtonElement | null>(null);
  const indicatorsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [indicatorsButtonWidth, setIndicatorsButtonWidth] = useState<number | undefined>(undefined);
  const [payAmount, setPayAmount] = useState<string>("");
  const [receiveAmount, setReceiveAmount] = useState<string>("");
  const [isBuy, setIsBuy] = useState<boolean>(true);
  const [slippage, setSlippage] = useState<number>(2);
  const [walletEthBalance, setWalletEthBalance] = useState<number>(0);
  const [walletQuoteTokenBalance, setWalletQuoteTokenBalance] = useState<number>(0);
  const [walletTokenBalance, setWalletTokenBalance] = useState<number>(0);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [quoteExpiresAt, setQuoteExpiresAt] = useState<number | null>(null);
  const [quoteCountdown, setQuoteCountdown] = useState<number>(0);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const [showSwapConfirmation, setShowSwapConfirmation] = useState(false);
  const [pendingSwapData, setPendingSwapData] = useState<any>(null);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [swapSuccess, setSwapSuccess] = useState<{
    type: 'buy' | 'sell';
    amount: string;
    tokenSymbol: string;
    txHash: string;
    received: string;
  } | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{
    website?: string;
    twitter?: string;
    telegram?: string;
  } | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTabKey>("overview");
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 0
  );
  const [footerHeight, setFooterHeight] = useState(0);
  
  // Orders and Positions state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersInitialized, setOrdersInitialized] = useState(false);
  const [positions, setPositions] = useState<any[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsInitialized, setPositionsInitialized] = useState(false);
  
  // Order modal ref
  const orderManagementRef = useRef<{ openModal: (type: "LIMIT_BUY" | "LIMIT_SELL" | "STOP_LOSS", amount?: string) => void }>(null);

  // Watchlist and Alert modals
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState("");
  const [alertDirection, setAlertDirection] = useState<"above" | "below">("above");

  // Top volume dropdown state
  const [showTopVolume, setShowTopVolume] = useState(false);
  const [topVolumeLoading, setTopVolumeLoading] = useState(false);
  const [topVolumePairs, setTopVolumePairs] = useState<Array<{
    poolAddress?: string;
    baseSymbol?: string;
    baseAddress?: string;
    quoteSymbol?: string;
    priceUsd?: number;
    volume24h?: number;
    txns24h?: number;
    imageUrl?: string | null;
  }>>([]);

  // Token selector state
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState<string>('');
  const [tokenSearchResults, setTokenSearchResults] = useState<any[]>([]);
  const [isSearchingTokens, setIsSearchingTokens] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<any[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [recentTokens, setRecentTokens] = useState<Array<{symbol: string; address: string; logo?: string; name?: string}>>([]);
  const [selectedPayToken, setSelectedPayToken] = useState<{symbol: string; address: string; logo?: string; name?: string} | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateLayoutMetrics = () => {
      setViewportWidth(window.innerWidth);
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setFooterHeight(0);
      } else {
        const footerEl = document.getElementById("app-footer");
        setFooterHeight(footerEl?.offsetHeight ?? 0);
      }
    };
    updateLayoutMetrics();
    window.addEventListener("resize", updateLayoutMetrics);
    return () => window.removeEventListener("resize", updateLayoutMetrics);
  }, []);

  // Prevent body scroll - page should not scroll, everything in viewport
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.documentElement.style.height = '100vh';
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.height = '';
    };
  }, []);

  // Match indicators button width to timeframe button
  useEffect(() => {
    if (!isMobile && timeframeButtonRef.current && indicatorsButtonRef.current) {
      const timeframeWidth = timeframeButtonRef.current.offsetWidth;
      setIndicatorsButtonWidth(timeframeWidth);
    }
  }, [isMobile, timeframe]);

  // Track new trades for flash animations
  useEffect(() => {
    if (transactions.length > prevTransactionsLength && prevTransactionsLength > 0) {
      const newTrades = transactions.slice(0, transactions.length - prevTransactionsLength);
      const newHashes = new Set(newTrades.map(tx => tx.hash));
      setNewTradeHashes(newHashes);
      
      // Remove flash after animation completes
      setTimeout(() => {
        setNewTradeHashes(prev => {
          const updated = new Set(prev);
          newHashes.forEach(hash => updated.delete(hash));
          return updated;
        });
      }, 2000);
    }
    setPrevTransactionsLength(transactions.length);
  }, [transactions, prevTransactionsLength]);

  // Copy token address to clipboard
  const copyTokenAddress = useCallback(async () => {
    const tokenAddress = pair?.baseToken?.address;
    if (!tokenAddress) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(tokenAddress);
        setCopiedAddress(true);
        setShowCopyNotification(true);
        setTimeout(() => {
          setCopiedAddress(false);
          setShowCopyNotification(false);
        }, 2000);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = tokenAddress;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedAddress(true);
        setShowCopyNotification(true);
        setTimeout(() => {
          setCopiedAddress(false);
          setShowCopyNotification(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy token address:', error);
    }
  }, [pair?.baseToken?.address]);

  const chartPriceScalePadding = useMemo(() => {
    if (isMobile) return 0;
    if (viewportWidth <= 1280) return 56;
    if (viewportWidth <= 1440) return 40;
    if (viewportWidth <= 1600) return 32;
    return 24;
  }, [isMobile, viewportWidth]);

  const formatTimeAgo = useCallback((timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${Math.max(seconds, 1)}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }, []);

  const chartHeight = isMobile ? 380 : 480;
  const mobileBottomOffset = isMobile
    ? `calc(${footerHeight}px + ${MOBILE_TAB_HEIGHT}px + env(safe-area-inset-bottom, 0px))`
    : "0px";
  const swapButtonHeight = isMobile ? "h-10" : "h-12";
  const swapSectionSpacing = isMobile ? "mb-2" : "mb-3";
  const swapFieldPadding = isMobile ? "p-2.5" : "p-3";
  const quickButtonClass = isMobile ? "px-2 py-1 text-[10px]" : "px-2 py-1 text-[11px]";
  const desktopScrollable = "";
  const visibleOrders = isMobile ? orders.slice(0, 4) : orders;
  const visiblePositions = isMobile ? positions.slice(0, 4) : positions;

  const getQuoteBalance = useCallback(() => {
    const quoteTokenAddress = (pair?.quoteToken?.address || WETH_ADDRESS).toLowerCase();
    return quoteTokenAddress === WETH_ADDRESS.toLowerCase()
      ? walletEthBalance
      : walletQuoteTokenBalance;
  }, [pair?.quoteToken?.address, walletEthBalance, walletQuoteTokenBalance]);

  const formatBalance = useCallback((value: number) => {
    if (!value || value <= 0) return "0.0000";
    return value < 0.0001 ? value.toFixed(8) : value.toFixed(4);
  }, []);

  const handleQuickSelect = useCallback(
    (pct: number) => {
      const basis = isBuy ? getQuoteBalance() : walletTokenBalance;
      if (basis && basis > 0) {
        const amount = (basis * pct) / 100;
        setPayAmount(amount > 0 ? amount.toFixed(6) : "");
      }
    },
    [isBuy, getQuoteBalance, walletTokenBalance]
  );

  const quickButtonLabels = useMemo(() => ["25%", "50%", "75%", "MAX"], []);

  const quickDisabled = useMemo(
    () => !walletAddress || (isBuy ? getQuoteBalance() <= 0 : walletTokenBalance <= 0),
    [walletAddress, isBuy, getQuoteBalance, walletTokenBalance]
  );

  const renderTokenIcon = useCallback(
    (tokenType: "base" | "quote", size: "sm" | "md" = "sm") => {
      const dimension = size === "md" ? "w-10 h-10" : "w-6 h-6";
      const borderClasses = "border border-gray-700 rounded-full";

      if (tokenType === "base") {
        if (pair?.info?.imageUrl) {
          return (
            <img
              src={pair.info.imageUrl}
              alt={pair?.baseToken?.symbol || "Token"}
              className={`${dimension} ${borderClasses} object-cover`}
            />
          );
        }
        return (
          <div className={`${dimension} ${borderClasses} bg-gray-800 flex items-center justify-center text-xs text-gray-300`}>
            {pair?.baseToken?.symbol?.[0] || "T"}
          </div>
        );
      }

      const quoteSymbol = pair?.quoteToken?.symbol || "Q";
      const quoteAddress = (pair?.quoteToken?.address || WETH_ADDRESS).toLowerCase();

      if (quoteAddress === WETH_ADDRESS.toLowerCase()) {
        return (
          <img
            src="https://assets.coingecko.com/coins/images/2518/small/weth.png"
            alt="WETH"
            className={`${dimension} ${borderClasses} object-cover`}
          />
        );
      }

      if (quoteSymbol.toUpperCase() === "USDC") {
        return (
          <img
            src="https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
            alt="USDC"
            className={`${dimension} ${borderClasses} object-cover`}
          />
        );
      }

      if (quoteSymbol.toUpperCase() === "USDT") {
        return (
          <img
            src="https://assets.coingecko.com/coins/images/325/small/Tether-symbol-black.png"
            alt="USDT"
            className={`${dimension} ${borderClasses} object-cover`}
          />
        );
      }

      return (
        <div className={`${dimension} ${borderClasses} bg-gray-800 flex items-center justify-center text-xs text-gray-300`}>
          {quoteSymbol[0] || "Q"}
        </div>
      );
    },
    [pair?.info?.imageUrl, pair?.baseToken?.symbol, pair?.quoteToken?.symbol, pair?.quoteToken?.address]
  );

  const renderQuickButtons = useCallback(
    (containerClass: string, buttonClass: string) => (
      <div className={containerClass}>
        {quickButtonLabels.map((label) => {
          const pct = label === "MAX" ? 100 : parseInt(label, 10);
          return (
            <button
              key={label}
              type="button"
              onClick={() => handleQuickSelect(pct)}
              disabled={quickDisabled}
              className={`${buttonClass} disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
            >
              {label}
            </button>
          );
        })}
      </div>
    ),
    [quickButtonLabels, handleQuickSelect, quickDisabled]
  );

  const quoteBalance = getQuoteBalance();
  const payBalanceDisplay = formatBalance(isBuy ? quoteBalance : walletTokenBalance);
  // ETH token constant
  const ETH_TOKEN = { symbol: 'ETH', address: '0x4200000000000000000000000000000000000006', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' };

  // Determine pay token - use selected token if available, otherwise use default based on isBuy
  const payToken = selectedPayToken || (isBuy 
    ? { symbol: pair?.quoteToken?.symbol || "WETH", address: pair?.quoteToken?.address || WETH_ADDRESS, name: pair?.quoteToken?.symbol || "WETH" }
    : { symbol: pair?.baseToken?.symbol || "TOKEN", address: pair?.baseToken?.address || "", name: pair?.baseToken?.name || pair?.baseToken?.symbol || "TOKEN" }
  );
  const payTokenSymbol = payToken.symbol;
  const receiveTokenSymbol = isBuy ? (pair?.baseToken?.symbol || "TOKEN") : (pair?.quoteToken?.symbol || "WETH");
  const payTokenIcon = renderTokenIcon(isBuy ? "quote" : "base", isMobile ? "sm" : "sm");
  const receiveTokenIcon = renderTokenIcon(isBuy ? "base" : "quote", isMobile ? "sm" : "sm");

  // Load recent tokens from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cypherx_recent_tokens');
      if (stored) {
        try {
          setRecentTokens(JSON.parse(stored));
        } catch (e) {
          console.error('Error loading recent tokens:', e);
        }
      }
    }
  }, []);

  // Save token to recent tokens
  const addToRecentTokens = useCallback((token: {symbol: string; address: string; logo?: string; name?: string}) => {
    if (typeof window === 'undefined') return;
    
    setRecentTokens(prev => {
      const filtered = prev.filter(t => t.address.toLowerCase() !== token.address.toLowerCase());
      const updated = [token, ...filtered].slice(0, 10);
      localStorage.setItem('cypherx_recent_tokens', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Get token logo from DexScreener
  const getTokenLogo = useCallback(async (tokenAddress: string): Promise<string | undefined> => {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const pair = data.pairs[0];
          return pair.baseToken?.logoURI || pair.quoteToken?.logoURI || undefined;
        }
      }
    } catch (error) {
      console.error('Error fetching token logo:', error);
    }
    return undefined;
  }, []);

  // Load available tokens (ETH + recent tokens)
  const loadAvailableTokens = useCallback(async () => {
    setIsLoadingTokens(true);
    try {
      const tokens = [ETH_TOKEN];
      recentTokens.forEach((token) => {
        if (token.address.toLowerCase() !== ETH_TOKEN.address.toLowerCase() && 
            !tokens.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
          tokens.push({
            symbol: token.symbol,
            address: token.address,
            name: token.name || token.symbol,
            logo: token.logo || ''
          });
        }
      });
      setAvailableTokens(tokens);
    } catch (error) {
      console.error('Error loading tokens:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  }, [recentTokens]);

  // Search tokens
  const searchTokens = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setTokenSearchResults([]);
      return;
    }

    setIsSearchingTokens(true);
    try {
      if (query.startsWith('0x') && query.length === 42) {
        try {
          const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${query}`);
          const data = await response.json();
          
          if (data.pairs && data.pairs.length > 0) {
            const pair = data.pairs[0];
            const logo = pair.baseToken?.logoURI || pair.quoteToken?.logoURI || undefined;
            setTokenSearchResults([{
              symbol: pair.baseToken?.symbol || 'UNKNOWN',
              address: query,
              name: pair.baseToken?.name || 'Unknown Token',
              logo: logo
            }]);
          } else {
            setTokenSearchResults([]);
          }
        } catch (error) {
          console.error('Error searching token by address:', error);
          setTokenSearchResults([]);
        }
        setIsSearchingTokens(false);
        return;
      }

      const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const basePairs = data.pairs.filter((pair: any) => 
          pair.chainId === 'base' || pair.chainId === '8453'
        );
        
        const uniqueTokens = new Map();
        basePairs.forEach((pair: any) => {
          const tokenAddress = pair.baseToken?.address?.toLowerCase();
          if (tokenAddress && !uniqueTokens.has(tokenAddress)) {
            const logo = pair.baseToken?.logoURI || pair.quoteToken?.logoURI || undefined;
            uniqueTokens.set(tokenAddress, {
              symbol: pair.baseToken?.symbol || 'UNKNOWN',
              address: pair.baseToken?.address,
              name: pair.baseToken?.name || pair.baseToken?.symbol || 'Unknown Token',
              logo: logo
            });
          }
        });
        
        setTokenSearchResults(Array.from(uniqueTokens.values()).slice(0, 20));
      } else {
        setTokenSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching tokens:', error);
      setTokenSearchResults([]);
    } finally {
      setIsSearchingTokens(false);
    }
  }, []);

  // Handle token search input
  useEffect(() => {
    if (showTokenSelector && tokenSearchQuery) {
      const timeoutId = setTimeout(() => {
        searchTokens(tokenSearchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (showTokenSelector && !tokenSearchQuery) {
      setTokenSearchResults([]);
    }
  }, [tokenSearchQuery, showTokenSelector, searchTokens]);

  // Load tokens when selector opens
  useEffect(() => {
    if (showTokenSelector) {
      loadAvailableTokens();
      setTokenSearchQuery('');
      setTokenSearchResults([]);
    }
  }, [showTokenSelector, loadAvailableTokens]);

  // Handle token selection
  const handleTokenSelect = useCallback(async (token: {symbol: string; address: string; logo?: string; name?: string}) => {
    let tokenWithLogo = { ...token };
    if (!token.logo && token.address.toLowerCase() !== ETH_TOKEN.address.toLowerCase()) {
      const logo = await getTokenLogo(token.address);
      if (logo) {
        tokenWithLogo.logo = logo;
      }
    }
    
    setSelectedPayToken(tokenWithLogo);
    
    if (token.address.toLowerCase() !== ETH_TOKEN.address.toLowerCase()) {
      addToRecentTokens(tokenWithLogo);
    }
    
    setShowTokenSelector(false);
    setTokenSearchQuery('');
    setTokenSearchResults([]);
    
    // Clear amounts to trigger new quote
    setPayAmount('');
    setReceiveAmount('');
  }, [getTokenLogo, addToRecentTokens]);


  // Cache for token decimals to avoid repeated on-chain calls
  const tokenDecimalsCache = useRef<Map<string, number>>(new Map());

  // Helper function to get token decimals (with caching and on-chain fallback)
  const getTokenDecimals = async (tokenAddress: string | undefined): Promise<number> => {
    if (!tokenAddress) return 18;
    const addr = tokenAddress.toLowerCase();
    
    // Check cache first
    if (tokenDecimalsCache.current.has(addr)) {
      return tokenDecimalsCache.current.get(addr)!;
    }

    // Known tokens with non-18 decimals
    const knownDecimals: Record<string, number> = {
      // USDC on Base: 6 decimals
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": 6,
      // USDT on Base: 6 decimals
      "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": 6,
      // cBBTC on Base: 8 decimals (Bitcoin-like)
      "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": 8,
      // WETH on Base: 18 decimals
      "0x4200000000000000000000000000000000000006": 18,
    };

    if (knownDecimals[addr]) {
      tokenDecimalsCache.current.set(addr, knownDecimals[addr]);
      return knownDecimals[addr];
    }

    // Fetch from on-chain if not in cache or known list
    try {
      const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const tokenContract = new ethers.Contract(
        addr,
        ["function decimals() view returns (uint8)"],
        provider
      );
      const decimals = await tokenContract.decimals();
      const decimalsNum = Number(decimals);
      tokenDecimalsCache.current.set(addr, decimalsNum);
      console.log(`✅ Fetched decimals for ${addr}: ${decimalsNum}`);
      return decimalsNum;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch decimals for ${addr}, defaulting to 18:`, error);
      // Default to 18 if fetch fails
      tokenDecimalsCache.current.set(addr, 18);
      return 18;
    }
  };

  // Check token balance for swap
  const checkTokenBalance = useCallback(async (tokenAddress: string, amount: string) => {
    if (!walletAddress || !amount || parseFloat(amount) <= 0) {
      setTokenBalance('0');
      setInsufficientFunds(false);
      return;
    }

    try {
      const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const decimals = await getTokenDecimals(tokenAddress);
      
      // Check if it's ETH/WETH
      if (tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        const balance = await provider.getBalance(walletAddress);
        const balanceFormatted = parseFloat(ethers.formatEther(balance));
        setTokenBalance(balanceFormatted.toFixed(6));
        setInsufficientFunds(balanceFormatted < parseFloat(amount));
      } else {
        // Check ERC20 token balance
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const balance = await tokenContract.balanceOf(walletAddress);
        const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
        setTokenBalance(balanceFormatted.toFixed(6));
        setInsufficientFunds(balanceFormatted < parseFloat(amount));
      }
    } catch (error) {
      console.error('Error checking token balance:', error);
      setTokenBalance('0');
      setInsufficientFunds(false);
    }
  }, [walletAddress, getTokenDecimals]);

  // Fetch WETH balance (ETH + WETH on Base)
  const fetchWethBalance = useCallback(async (address: string) => {
    if (!address) return;
    try {
      // Fetch ETH balance (native)
      const response = await fetch(`/api/wallet/balance?address=${address}`);
      let ethBalance = 0;
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          ethBalance = parseFloat(data.ethBalance || "0");
        }
      }

      // Also fetch WETH token balance (wrapped ETH)
      const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base WETH
      const wethResponse = await fetch(`/api/wallet/balance?address=${address}&tokenAddress=${WETH_ADDRESS}`);
      let wethBalance = 0;
      
      if (wethResponse.ok) {
        const wethData = await wethResponse.json();
        if (wethData.success) {
          wethBalance = parseFloat(wethData.tokenBalance || "0");
        }
      }

      // Total usable balance = ETH (can be wrapped) + existing WETH
      const totalBalance = ethBalance + wethBalance;
      setWalletEthBalance(totalBalance);
      console.log("✅ WETH balance fetched:", { ethBalance, wethBalance, totalBalance });
    } catch (error) {
      console.error("❌ Error fetching WETH balance:", error);
    }
  }, []);

  // Detect connected wallet from global context
  useEffect(() => {
    if (selfCustodialWallet?.address && selfCustodialWallet?.isConnected) {
      setWalletAddress(selfCustodialWallet.address);
      // Fetch balance when wallet is detected
      fetchWethBalance(selfCustodialWallet.address);
    } else {
      setWalletAddress("");
    }
  }, [selfCustodialWallet?.address, selfCustodialWallet?.isConnected, fetchWethBalance]);

  // Listen for wallet updates
  useEffect(() => {
    const handleWalletUpdate = () => {
      if (selfCustodialWallet?.address && selfCustodialWallet?.isConnected) {
        setWalletAddress(selfCustodialWallet.address);
        fetchWethBalance(selfCustodialWallet.address);
      } else {
        setWalletAddress("");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("wallet-updated", handleWalletUpdate);
      return () => window.removeEventListener("wallet-updated", handleWalletUpdate);
    }
  }, [selfCustodialWallet, fetchWethBalance]);

  // Fetch quote token balance (USDC, WETH, virtual, etc.)
  const fetchQuoteTokenBalance = async (address: string, quoteTokenAddress: string | undefined) => {
    if (!address || !quoteTokenAddress) {
      setWalletQuoteTokenBalance(0);
      return;
    }
    try {
      const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
      
      // If quote token is WETH, use the existing WETH balance logic
      if (quoteTokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        await fetchWethBalance(address);
        // walletEthBalance will be set by fetchWethBalance
        return;
      }

      // For other quote tokens (USDC, etc.), fetch their balance
      const response = await fetch(`/api/wallet/balance?address=${address}&tokenAddress=${quoteTokenAddress}`);
      let quoteBalance = 0;
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          quoteBalance = parseFloat(data.tokenBalance || "0");
        }
      }

      setWalletQuoteTokenBalance(quoteBalance);
      console.log("✅ Quote token balance fetched:", { quoteTokenAddress, quoteBalance });
    } catch (error) {
      console.error("❌ Error fetching quote token balance:", error);
      setWalletQuoteTokenBalance(0);
    }
  };

  // Fetch token balance (the token being traded)
  const fetchTokenBalance = async (address: string, tokenAddress: string) => {
    if (!address || !tokenAddress) {
      setWalletTokenBalance(0);
      return;
    }
    try {
      const response = await fetch(`/api/wallet/balance?address=${address}&tokenAddress=${tokenAddress}`);
      let tokenBalance = 0;
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          tokenBalance = parseFloat(data.tokenBalance || "0");
        }
      }

      setWalletTokenBalance(tokenBalance);
      console.log("✅ Token balance fetched:", { tokenAddress, tokenBalance });
    } catch (error) {
      console.error("❌ Error fetching token balance:", error);
      setWalletTokenBalance(0);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${poolAddress}`);
        const json: DexPairResponse = await res.json();
        if (!cancelled) {
          setPair(json.pair || null);
          // Extract token info if available
          if (json.pair?.baseToken) {
            setTokenInfo({
              website: (json.pair.baseToken as any).website,
              twitter: (json.pair.baseToken as any).twitter,
              telegram: (json.pair.baseToken as any).telegram,
            });
          }
        }
      } catch (e) {
        if (!cancelled) setError("Failed to load token data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (poolAddress) load();
    return () => {
      cancelled = true;
    };
  }, [poolAddress]);

  // Fetch token balance when wallet address or token address changes
  useEffect(() => {
    if (walletAddress && pair?.baseToken?.address) {
      fetchTokenBalance(walletAddress, pair.baseToken.address);
    } else {
      setWalletTokenBalance(0);
    }
  }, [walletAddress, pair?.baseToken?.address]);

  // Fetch quote token balance when wallet address or quote token changes
  useEffect(() => {
    if (walletAddress && pair?.quoteToken?.address) {
      fetchQuoteTokenBalance(walletAddress, pair.quoteToken.address);
    } else {
      setWalletQuoteTokenBalance(0);
    }
  }, [walletAddress, pair?.quoteToken?.address]);

  // Fetch token info separately when pair is available
  useEffect(() => {
    let cancelled = false;
    async function fetchTokenInfo() {
      if (!pair?.baseToken?.address) return;
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${pair.baseToken.address}`);
        if (res.ok) {
          const data = await res.json();
          const tokenData = data.pairs?.[0]?.baseToken;
          if (tokenData && !cancelled) {
            setTokenInfo({
              website: tokenData.website,
              twitter: tokenData.twitter,
              telegram: tokenData.telegram,
            });
          }
        }
      } catch {}
    }
    fetchTokenInfo();
    return () => {
      cancelled = true;
    };
  }, [pair?.baseToken?.address]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!pair?.baseToken?.address || !walletAddress) {
      console.log('No token address or wallet address available for orders fetch');
      return;
    }
    
    if (!ordersInitialized) {
      setOrdersLoading(true);
    }
    try {
      console.log('🔧 Fetching orders for wallet:', walletAddress, 'token:', pair.baseToken.address);
      const response = await fetch(`/api/wallet/orders?address=${walletAddress}&tokenAddress=${pair.baseToken.address}`);
      if (response.ok) {
        const data = await response.json();
        console.log('🔧 Orders API response:', data);
        setOrders(data.orders || []);
      } else {
        console.error('Failed to fetch orders');
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
      setOrdersInitialized(true);
    }
  }, [pair?.baseToken?.address, walletAddress]);

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    if (!pair?.baseToken?.address || !walletAddress) {
      console.log('No token address or wallet address available for positions fetch');
      return;
    }
    
    if (!positionsInitialized) {
      setPositionsLoading(true);
    }
    try {
      console.log('🔧 Fetching positions for wallet:', walletAddress, 'token:', pair.baseToken.address);
      const response = await fetch(`/api/wallet/positions?address=${walletAddress}&tokenAddress=${pair.baseToken.address}`);
      if (response.ok) {
        const data = await response.json();
        console.log('🔧 Positions API response:', data);
        setPositions(data.positions || []);
      } else {
        console.error('Failed to fetch positions');
        setPositions([]);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
      setPositions([]);
    } finally {
      setPositionsLoading(false);
      setPositionsInitialized(true);
    }
  }, [pair?.baseToken?.address, walletAddress]);

  // Fetch top volume list
  const fetchTopVolume = useCallback(async () => {
    setTopVolumeLoading(true);
    try {
      const res = await fetch('/api/discover/top-volume');
      const data = await res.json();
      if (res.ok) setTopVolumePairs(data.pairs || []);
      else setTopVolumePairs([]);
    } catch {
      setTopVolumePairs([]);
    } finally {
      setTopVolumeLoading(false);
    }
  }, []);

  // Fetch data when tabs are selected
  useEffect(() => {
    if (activeDataTab === "orders" && !ordersLoading && !ordersInitialized && walletAddress) {
      fetchOrders();
    }
  }, [activeDataTab, ordersLoading, ordersInitialized, walletAddress, fetchOrders]);

  useEffect(() => {
    if (activeDataTab === "positions" && !positionsLoading && !positionsInitialized && walletAddress) {
      fetchPositions();
    }
  }, [activeDataTab, positionsLoading, positionsInitialized, walletAddress, fetchPositions]);

  // Fetch OHLC using GeckoTerminal per timeframe (minute/hour/day) with aggregation; fallback to CoinGecko
  useEffect(() => {
    let cancelled = false;
    async function loadOhlc() {
      if (!poolAddress) return;
      try {
        // Use our proxy to avoid CORS/rate issues
        const poolLc = poolAddress.toString().toLowerCase();
        const res = await fetch(`/api/explorer/ohlcv?pool=${poolLc}&tf=${timeframe}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const list: Array<{time:number;open:number;high:number;low:number;close:number;volume?:number}> = data?.candles || [];
          console.log("OHLC proxy result:", JSON.stringify({ tf: timeframe, count: list?.length, sample: list?.[list.length-1], first: list?.[0], rawData: data }));
          if (!cancelled && Array.isArray(list) && list.length > 0) {
            const mapped = list
              .map(c => ({ time: Math.floor(Number(c.time)), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 }))
              .sort((a, b) => a.time - b.time);
            console.log("Setting candles:", mapped.length, "first:", mapped[0], "last:", mapped[mapped.length-1]);
            setCandles(mapped);
            return;
          } else {
            console.warn("OHLC proxy returned empty or invalid data:", { listLength: list?.length, isArray: Array.isArray(list), data });
          }
        }
        // Fallback to CoinGecko logic if GT fails
        if (pair?.baseToken?.symbol) {
          const symbol = pair.baseToken.symbol.toUpperCase();
          const id = coinGeckoMapping[symbol];
          const daysMap: Record<string, number> = { "1m": 1, "5m": 1, "15m": 1, "1h": 1, "4h": 1, "1d": 1 };
          const days = daysMap[timeframe] || 1;
          if (id) {
            const cg = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`);
            if (cg.ok) {
              const arr: Array<[number, number, number, number, number]> = await cg.json();
              if (!cancelled && Array.isArray(arr) && arr.length > 0) {
                const mapped = arr
                  .map(d => ({ time: Math.floor(d[0]/1000), open: d[1], high: d[2], low: d[3], close: d[4] }))
                  .sort((a, b) => a.time - b.time);
                console.log("CoinGecko OHLC fallback:", { tf: timeframe, count: mapped.length, sample: mapped[mapped.length-1] });
                setCandles(mapped);
                return;
              }
            }
          }
        }
        // Synthetic fallback: build a flat series from current price so chart isn't empty
        if (!cancelled) {
          const nowSec = Math.floor(Date.now() / 1000);
          const base = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
          if (base > 0) {
            const synthetic: Array<{ time:number; open:number; high:number; low:number; close:number }> = [];
            for (let i = 10; i >= 0; i--) {
              const t = nowSec - i * 60;
              synthetic.push({ time: t, open: base, high: base, low: base, close: base });
            }
            console.log("Synthetic OHLC built due to empty data:", { count: synthetic.length, price: base });
            setCandles(synthetic);
          } else {
            setCandles([]);
          }
        }
      } catch (e) {
        console.warn("OHLC load error, using synthetic fallback", e);
        if (!cancelled) {
          const nowSec = Math.floor(Date.now() / 1000);
          const base = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
          if (base > 0) {
            const synthetic: Array<{ time:number; open:number; high:number; low:number; close:number }> = [];
            for (let i = 10; i >= 0; i--) {
              const t = nowSec - i * 60;
              synthetic.push({ time: t, open: base, high: base, low: base, close: base });
            }
            setCandles(synthetic);
          } else {
            setCandles([]);
          }
        }
      }
    }
    loadOhlc();
    return () => { cancelled = true; };
  }, [poolAddress, timeframe, pair?.baseToken?.symbol]);

  // Derive current price from last candle if available, fallback to pair.priceUsd
  const currentPrice = useMemo(() => {
    if (candles && candles.length > 0) return candles[candles.length - 1].close;
    return pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
  }, [candles, pair?.priceUsd]);

  // Fetch indicative price from 0x when inputs change
  useEffect(() => {
    let cancelled = false;
    async function fetchPrice() {
      try {
        // Clear receive amount if no input
        if (!payAmount || parseFloat(payAmount) <= 0 || !pair?.baseToken?.address) {
          setReceiveAmount("");
          return;
        }

        // Determine sell and buy tokens - use selected pay token if available, otherwise use default based on isBuy
        const quoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS; // Fallback to WETH if no quote token
        
        const sellToken = selectedPayToken ? selectedPayToken.address : (isBuy ? quoteTokenAddress : pair.baseToken.address);
        const buyToken = isBuy ? pair.baseToken.address : quoteTokenAddress;
        
        // Get correct decimals for both tokens (async fetch if needed)
        const [sellTokenDecimals, buyTokenDecimals] = await Promise.all([
          getTokenDecimals(sellToken),
          getTokenDecimals(buyToken)
        ]);
        
        const amountWei = (Number(payAmount) * Math.pow(10, sellTokenDecimals)).toFixed(0);
        
        console.log("🔍 Fetching 0x price:", { 
          isBuy, 
          payAmount, 
          sellToken, 
          buyToken, 
          amountWei, 
          sellTokenDecimals,
          buyTokenDecimals,
          quoteTokenAddress: pair?.quoteToken?.address,
          quoteTokenSymbol: pair?.quoteToken?.symbol
        });
        
        const params = new URLSearchParams({
          chainId: "8453",
          sellToken,
          buyToken,
          sellAmount: amountWei
        });
        
        const res = await fetch(`/api/0x/price?${params.toString()}`);
        const data = await res.json();
        
        if (!res.ok) {
          console.error("❌ Price fetch failed:", data);
          if (!cancelled) setReceiveAmount("");
          return;
        }

        // 0x API returns buyAmount as a string in the token's smallest unit
        const buyAmount = data?.buyAmount;
        if (!cancelled && buyAmount) {
          // Use the already fetched buyTokenDecimals
          const divisor = Math.pow(10, buyTokenDecimals);
          const amt = Number(buyAmount) / divisor;
          
          // Format with appropriate decimal places (more for smaller amounts)
          let formattedAmt: string;
          if (amt >= 1) {
            formattedAmt = amt.toFixed(4);
          } else if (amt >= 0.01) {
            formattedAmt = amt.toFixed(6);
          } else {
            formattedAmt = amt.toFixed(8);
          }
          
          setReceiveAmount(formattedAmt);
          
          // Set quote expiration (0x quotes typically expire after 30 seconds)
          const expiresIn = data?.expiresInSeconds || 30;
          const expirationTime = Date.now() + (expiresIn * 1000);
          setQuoteExpiresAt(expirationTime);
          
          console.log("✅ Price received:", { 
            buyAmountRaw: buyAmount, 
            buyAmountFormatted: formattedAmt,
            buyTokenDecimals,
            sellTokenDecimals,
            expiresIn,
            expirationTime: new Date(expirationTime).toLocaleTimeString()
          });
        } else if (!cancelled) {
          console.warn("⚠️  No buyAmount in response:", data);
          // Check if there's an error message
          if (data?.error || data?.reason) {
            console.error("❌ API Error:", data.error || data.reason);
          }
          setReceiveAmount("");
          setQuoteExpiresAt(null);
        }
      } catch (error) {
        console.error("❌ Price fetch error:", error);
        if (!cancelled) setReceiveAmount("");
      }
    }
    
    // Debounce the price fetch to avoid too many requests
    const timeoutId = setTimeout(fetchPrice, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [payAmount, pair?.baseToken?.address, pair?.quoteToken?.address, isBuy, selectedPayToken]);

  // Quote expiration countdown timer
  useEffect(() => {
    if (!quoteExpiresAt) {
      setQuoteCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((quoteExpiresAt - now) / 1000));
      setQuoteCountdown(remaining);
    };

    updateCountdown(); // Initial update
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [quoteExpiresAt]);

  const isQuoteExpired = quoteCountdown <= 0 && quoteExpiresAt !== null && receiveAmount !== "";

  // Show swap confirmation dialog
  const handleSwapButtonClick = async () => {
    if (!payAmount || !receiveAmount || isQuoteExpired || !pair?.baseToken?.address || !walletAddress) {
      setSwapError('Please enter a valid amount and wait for the quote.');
      return;
    }

    // Determine the token address we're paying with
    const swapQuoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
    const sellToken = selectedPayToken ? selectedPayToken.address : (isBuy ? swapQuoteTokenAddress : pair.baseToken.address);
    
    // Check balance before showing confirmation
    await checkTokenBalance(sellToken, payAmount);
    
    if (insufficientFunds) {
      setSwapError(`Insufficient funds. You have ${tokenBalance} ${selectedPayToken ? selectedPayToken.symbol : (isBuy ? (pair?.quoteToken?.symbol || 'WETH') : pair?.baseToken?.symbol)}`);
      return;
    }

    // Store swap data for confirmation
    setPendingSwapData({
      payAmount,
      receiveAmount,
      isBuy,
      payToken: selectedPayToken ? selectedPayToken.symbol : (isBuy ? (pair?.quoteToken?.symbol || 'WETH') : pair?.baseToken?.symbol),
      receiveToken: isBuy ? pair?.baseToken?.symbol : (pair?.quoteToken?.symbol || 'WETH')
    });
    setShowSwapConfirmation(true);
    setSwapError(null);
  };

  // Execute swap using 0x API with in-app wallet (after confirmation)
  const executeSwap = async () => {
    if (!payAmount || !receiveAmount || isQuoteExpired || !pair?.baseToken?.address || !walletAddress) {
      return;
    }

    // Final balance check before executing
    const swapQuoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
    const sellToken = selectedPayToken ? selectedPayToken.address : (isBuy ? swapQuoteTokenAddress : pair.baseToken.address);
    await checkTokenBalance(sellToken, payAmount);
    
    if (insufficientFunds) {
      setSwapError(`Insufficient funds. You have ${tokenBalance} ${selectedPayToken ? selectedPayToken.symbol : (isBuy ? (pair?.quoteToken?.symbol || 'WETH') : pair?.baseToken?.symbol)}`);
      setShowSwapConfirmation(false);
      return;
    }

    setIsSwapping(true);
    setSwapError(null);
    setSwapSuccess(null); // Clear any previous success message
    setShowSwapConfirmation(false);

    try {
      // Get in-app wallet from localStorage
      const storedWallet = localStorage.getItem('cypherx_wallet');
      if (!storedWallet) {
        throw new Error("No wallet found. Please connect your wallet first.");
      }

      const walletData = JSON.parse(storedWallet);
      if (!walletData.privateKey) {
        throw new Error("Wallet private key not found. Please reconnect your wallet.");
      }

      // Setup provider for Base network
      const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      
      // Create wallet from private key (in-app wallet)
      const wallet = new ethers.Wallet(walletData.privateKey, provider);
      
      // Verify wallet address matches
      if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn("⚠️ Wallet address mismatch, updating state");
        setWalletAddress(wallet.address);
      }

      // Prepare swap parameters - use selected pay token if available
      const swapQuoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS; // Fallback to WETH if no quote token
      
      const sellToken = selectedPayToken ? selectedPayToken.address : (isBuy ? swapQuoteTokenAddress : pair.baseToken.address);
      const buyToken = isBuy ? pair.baseToken.address : swapQuoteTokenAddress;
      
      // Get correct decimals for the sell token (async)
      const sellTokenDecimals = await getTokenDecimals(sellToken);
      const sellAmountWei = ethers.parseUnits(payAmount, sellTokenDecimals).toString();
      const slippageBps = Math.round(slippage * 100); // Convert % to basis points

      console.log("🔍 Getting swap quote from 0x...", {
        sellToken,
        buyToken,
        sellAmountWei,
        walletAddress: wallet.address,
        slippageBps
      });

      // Get quote from 0x API
      const quoteParams = new URLSearchParams({
        chainId: "8453",
        sellToken,
        buyToken,
        sellAmount: sellAmountWei,
        taker: wallet.address,
        slippageBps: slippageBps.toString()
      });

      const quoteRes = await fetch(`/api/0x/quote?${quoteParams.toString()}`);
      const quoteData = await quoteRes.json();

      if (!quoteRes.ok) {
        throw new Error(quoteData.error || "Failed to get swap quote");
      }

      console.log("✅ Quote received:", {
        buyAmount: quoteData.buyAmount,
        allowanceNeeded: !!quoteData.issues?.allowance
      });

      // Check if allowance is needed
      if (quoteData.issues?.allowance) {
        console.log("🔍 Approval needed for token...");
        const tokenAddress = isBuy ? WETH_ADDRESS : pair.baseToken.address;
        const spender = quoteData.issues.allowance.spender;
        
        // ERC20 approve using in-app wallet
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ["function approve(address spender, uint256 amount) returns (bool)"],
          wallet
        );

        const maxUint256 = ethers.MaxUint256;
        console.log("📝 Approving token (1-click, no popup)...");
        const approveTx = await tokenContract.approve(spender, maxUint256);
        console.log("⏳ Waiting for approval confirmation...", approveTx.hash);
        await approveTx.wait();
        console.log("✅ Approval confirmed");
      }

      // Sign and send the swap transaction (1-click, no popup)
      console.log("📝 Signing swap transaction with in-app wallet (1-click)...");
      const tx = await wallet.sendTransaction({
        to: quoteData.to,
        data: quoteData.data,
        value: quoteData.value || "0",
        gasLimit: quoteData.gas || "500000",
      });
      
      // Show confirmation state - transaction sent, waiting for confirmation
      setIsSwapping(true);

      console.log("⏳ Transaction sent, waiting for confirmation...", tx.hash);
      const receipt = await tx.wait();
      
      // CRITICAL: Check if transaction actually succeeded
      if (!receipt || receipt.status === 0 || receipt.status === null) {
        console.error("❌ Transaction failed or reverted!", {
          hash: tx.hash,
          status: receipt?.status,
          receipt: receipt
        });
        throw new Error(`Transaction failed! Status: ${receipt?.status}. The transaction may have reverted due to insufficient liquidity, slippage, or other on-chain conditions. Check on BaseScan: https://basescan.org/tx/${tx.hash}`);
      }
      
      // Parse transaction result
      const swapDetails = {
        hash: receipt.hash,
        from: receipt.from,
        to: receipt.to,
        status: receipt.status === 1 ? 'Success' : 'Failed',
        gasUsed: receipt.gasUsed?.toString(),
        blockNumber: receipt.blockNumber,
        logs: receipt.logs?.length || 0
      };
      
      console.log("✅ Swap completed!", swapDetails);
      console.log("📊 Swap Summary:", {
        sold: `${payAmount} ${isBuy ? 'WETH' : pair?.baseToken?.symbol}`,
        bought: `~${receiveAmount} ${isBuy ? pair?.baseToken?.symbol : 'WETH'}`,
        tokenAddress: isBuy ? pair?.baseToken?.address : 'WETH',
        txHash: receipt.hash,
        status: receipt.status,
        fromAddress: receipt.from,
        walletAddress: wallet.address
      });

      // Verify transaction actually succeeded
      if (receipt.status !== 1) {
        throw new Error(`Transaction reverted! Status: ${receipt.status}. Check on BaseScan: https://basescan.org/tx/${receipt.hash}`);
      }

      // Refresh balances for the wallet that executed the transaction
      const swapWalletAddress = receipt.from || wallet.address;
      console.log("🔄 Refreshing balances for wallet:", swapWalletAddress);
      
      // Update displayed wallet address if different BEFORE fetching balance
      if (swapWalletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        console.log("🔄 Updating displayed wallet to match transaction wallet");
        setWalletAddress(swapWalletAddress);
        // Update localStorage to match the transaction wallet
        try {
          const storedWallet = localStorage.getItem('cypherx_wallet');
          if (storedWallet) {
            const walletData = JSON.parse(storedWallet);
            walletData.address = swapWalletAddress;
            localStorage.setItem('cypherx_wallet', JSON.stringify(walletData));
          }
        } catch (e) {
          console.error("Failed to update localStorage:", e);
        }
      }
      
      // Fetch balances for the wallet that actually executed the transaction
      const refreshQuoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
      
      // Fetch quote token balance (could be WETH, USDC, etc.)
      fetchQuoteTokenBalance(swapWalletAddress, refreshQuoteTokenAddress);
      
      // Fetch base token balance
      if (pair?.baseToken?.address) {
        fetchTokenBalance(swapWalletAddress, pair.baseToken.address);
      }

      // Auto-link wallet to user account if signed in (for rewards)
      try {
        const walletLinkCheck = await fetch(`/api/wallet/link?walletAddress=${swapWalletAddress}`);
        if (walletLinkCheck.ok) {
          const linkData = await walletLinkCheck.json();
          if (!linkData.isLinked && walletAddress) {
            // Try to link if user is signed in but wallet not linked
            // This will be handled by the frontend if user is authenticated
            console.log('ℹ️  Wallet not linked to user account - rewards will be skipped');
          } else if (linkData.isLinked) {
            console.log('✅ Wallet linked to user account - rewards will be processed');
          }
        }
      } catch (error) {
        console.error('Error checking wallet link:', error);
      }

      // Save order and position to Firebase
      try {
        const orderData = {
          walletAddress: swapWalletAddress,
          type: isBuy ? 'BUY' : 'SELL',
          tokenAddress: isBuy ? pair.baseToken.address : '0x4200000000000000000000000000000000000006', // WETH
          tokenSymbol: isBuy ? (pair.baseToken.symbol || 'TOKEN') : 'WETH',
          tokenName: isBuy ? (pair.baseToken.name || 'Token') : 'Wrapped Ether',
          amount: isBuy ? receiveAmount : payAmount,
          amountDisplay: isBuy ? receiveAmount : payAmount,
          inputToken: isBuy ? '0x4200000000000000000000000000000000000006' : pair.baseToken.address,
          outputToken: isBuy ? pair.baseToken.address : '0x4200000000000000000000000000000000000006',
          executedPrice: pair?.priceUsd || '0',
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed?.toString(),
          gasPrice: receipt.gasPrice?.toString(),
          protocol: '0x',
          pairAddress: poolAddress,
        };

        const saveResponse = await fetch('/api/orders/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });

        if (saveResponse.ok) {
          const saveData = await saveResponse.json();
          console.log('✅ Order and position saved to Firebase');
          
          // Log rewards info if processed
          if (saveData.rewards?.processed) {
            console.log('💰 Rewards processed:', {
              cashback: saveData.rewards.cashbackAmount,
              referralReward: saveData.rewards.referralReward
            });
          } else {
            console.log('ℹ️  Rewards not processed:', saveData.rewards?.message);
          }
          
          // Refresh orders and positions after save
          setOrdersInitialized(false);
          setPositionsInitialized(false);
          setTimeout(() => {
            if (activeDataTab === 'orders') fetchOrders();
            if (activeDataTab === 'positions') fetchPositions();
          }, 1000);
        } else {
          console.error('❌ Failed to save order:', await saveResponse.text());
        }
      } catch (error) {
        console.error('❌ Error saving order to Firebase:', error);
        // Don't block the success flow if saving fails
      }

      // Set success banner data
      const quoteTokenSymbol = pair?.quoteToken?.symbol || 'WETH';
      const tokenSymbol = isBuy ? (pair?.baseToken?.symbol || 'TOKEN') : quoteTokenSymbol;
      setSwapSuccess({
        type: isBuy ? 'buy' : 'sell',
        amount: receiveAmount,
        tokenSymbol: tokenSymbol,
        txHash: receipt.hash,
        received: receiveAmount
      });

      // Clear amounts after successful swap
      setPayAmount("");
      setReceiveAmount("");
      setQuoteExpiresAt(null);

      // Auto-hide success banner after 8 seconds
      setTimeout(() => {
        setSwapSuccess(null);
      }, 8000);

    } catch (error: any) {
      console.error("❌ Swap error:", error);
      setSwapError(error?.message || "Swap failed");
      
      // Show error to user
      if (error?.code === 4001) {
        alert("Transaction was rejected by user");
      } else {
        alert(`Swap failed: ${error?.message || "Unknown error"}`);
      }
    } finally {
      setIsSwapping(false);
    }
  };

  // Lightweight live updates: poll the latest candle periodically and merge
  useEffect(() => {
    if (!poolAddress || candles.length === 0) return;
    let cancelled = false;
    const tfMap: Record<string, { path: string; agg: string; periodSec: number }> = {
      "1m": { path: "minute", agg: "1", periodSec: 60 },
      "5m": { path: "minute", agg: "5", periodSec: 300 },
      "1h": { path: "hour", agg: "1", periodSec: 3600 },
      "4h": { path: "hour", agg: "4", periodSec: 14400 },
      "1d": { path: "day", agg: "1", periodSec: 86400 },
      "1w": { path: "day", agg: "7", periodSec: 604800 },
    };
    const selected = tfMap[timeframe] || tfMap["1h"];
    const url = `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddress}/ohlcv/${selected.path}?aggregate=${selected.agg}&limit=2`;
    const intervalMs = Math.max(10_000, Math.floor(selected.periodSec * 0.25) * 1000); // poll ~quarter period, min 10s

    async function tick() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const list: Array<[number, number, number, number, number]> = data?.data?.attributes?.ohlcv_list || [];
        if (!Array.isArray(list) || list.length === 0) return;
        const latest = list
          .map(([ts, open, high, low, close]) => ({ time: Math.floor(Number(ts)), open, high, low, close }))
          .sort((a, b) => a.time - b.time)
          .slice(-1)[0];
        if (!latest) return;
        if (cancelled) return;
        setCandles(prev => {
          if (!prev || prev.length === 0) return [latest];
          const last = prev[prev.length - 1];
          if (last.time === latest.time) {
            // Update ongoing candle
            const copy = [...prev];
            copy[copy.length - 1] = latest;
            return copy;
          }
          // Append new candle
          return [...prev, latest];
        });
      } catch {}
    }
    const id = setInterval(tick, intervalMs);
    tick();
    return () => { cancelled = true; clearInterval(id); };
  }, [poolAddress, timeframe, candles.length]);

  // Live Feed – WebSocket for real-time trades
  useEffect(() => {
    if (!poolAddress || !pair?.baseToken?.symbol) return;
    const wsUrl = "wss://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
    const httpUrl = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
    let buffer: any[] = [];
    let bufferTimer: ReturnType<typeof setTimeout> | null = null;

    async function fetchTxDetail(txHash: string) {
      try {
        const res = await fetch(httpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "eth_getTransactionByHash",
            params: [txHash],
          }),
        });
        const data = await res.json();
        if (data.result) {
          const tx = data.result;
          const isErc20Transfer = tx.to?.toLowerCase() === poolAddress?.toString().toLowerCase() && tx.input.startsWith("0xa9059cbb");
          let isSell = false;
          if (tx.value === "0x0" && isErc20Transfer) {
            isSell = false;
          } else if (tx.value !== "0x0") {
            isSell = true;
          } else {
            return;
          }

          let tokenAmount = 0;
          let value = "0";
          let decimals = 18;
          try {
            if (isSell) {
              // ERC20 amount (input slice) - base token is being sold
              const amountHex = tx.input.slice(-64, -32);
              const rawAmount = BigInt("0x" + amountHex);
              // Get base token decimals
              const baseTokenAddress = pair?.baseToken?.address?.toLowerCase();
              if (baseTokenAddress) {
                decimals = await getTokenDecimals(baseTokenAddress);
                tokenAmount = Number(rawAmount) / Math.pow(10, decimals);
              } else {
                tokenAmount = Number(rawAmount) / 1e18; // fallback
              }
              value = rawAmount.toString();
            } else {
              // Buy: quote token being sent - need to get correct decimals
              const rawValue = BigInt(tx.value);
              const quoteTokenAddress = pair?.quoteToken?.address?.toLowerCase();
              if (quoteTokenAddress) {
                decimals = await getTokenDecimals(quoteTokenAddress);
                tokenAmount = Number(rawValue) / Math.pow(10, decimals);
              } else {
                // Fallback to 18 decimals (WETH)
                decimals = 18;
                tokenAmount = Number(rawValue) / 1e18;
              }
              value = rawValue.toString();
            }
          } catch (_e) {
            tokenAmount = 0;
            value = "0";
          }

          buffer.push({
            hash: tx.hash,
            from: tx.from,
            to: tx.to || poolAddress,
            value,
            tokenAmount,
            timestamp: Date.now(),
            tokenSymbol: isSell ? (pair?.baseToken?.symbol || "TOKEN") : (pair?.quoteToken?.symbol || "ETH"),
            decimals,
          });
        }
      } catch (e) {
        // Ignore
      }
    }

    function processBuffer() {
      if (buffer.length === 0) return;
      // Remove self-transfers, de-dup, sort, and prepend
      const deduped = buffer.filter((tx, i, arr) =>
        arr.findIndex(t => t.hash === tx.hash) === i && tx.from.toLowerCase() !== tx.to.toLowerCase());
      if (deduped.length > 0) {
        setTransactions(prev => {
          // Only add new ones not already present
          const prevHashes = new Set(prev.map(t => t.hash));
          const newOnes = deduped.filter(tx => !prevHashes.has(tx.hash));
          return [...newOnes, ...prev].slice(0, 50);
        });
      }
      buffer = [];
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_subscribe",
        params: ["newHeads"],
      }));
    };
    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.method === "eth_subscription" && data.params?.result) {
          const blockHash = data.params.result.hash;
          const res = await fetch(httpUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: 2,
              jsonrpc: "2.0",
              method: "eth_getBlockByHash",
              params: [blockHash, true],
            }),
          });
          const blockData = await res.json();
          const txs = blockData?.result?.transactions || [];
          const relevantTxs = txs.filter(
            (tx: any) => tx.from?.toLowerCase() === poolAddress?.toString().toLowerCase() ||
              tx.to?.toLowerCase() === poolAddress?.toString().toLowerCase()
          );
          for (const tx of relevantTxs) {
            await fetchTxDetail(tx.hash);
          }
          if (bufferTimer) clearTimeout(bufferTimer);
          bufferTimer = setTimeout(processBuffer, 300);
        }
      } catch (e) { }
    };
    ws.onerror = () => { /* fallback or log error */ };
    ws.onclose = () => { /* try fallback? */ };
    return () => {
      ws.close();
      if (bufferTimer) clearTimeout(bufferTimer);
    };
  }, [poolAddress, pair?.baseToken?.symbol]);

  // Load recent trades using Alchemy Transfers API
  useEffect(() => {
    let cancelled = false;
    const transactionLimit = 100;
    
    // Cache for token decimals to avoid repeated API calls
    const decimalsCache = new Map<string, number>();
    
    async function getCachedTokenDecimals(tokenAddress: string): Promise<number> {
      if (decimalsCache.has(tokenAddress)) {
        return decimalsCache.get(tokenAddress)!;
      }
      const decimals = await getTokenDecimals(tokenAddress);
      decimalsCache.set(tokenAddress, decimals);
      return decimals;
    }
    
    async function fetchTransactions() {
      if (!poolAddress || !pair?.baseToken?.address || !pair?.quoteToken?.address) {
        return;
      }

      try {
        const ALCHEMY_API_URL =
          process.env.NEXT_PUBLIC_ALCHEMY_API_URL ||
          "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
        
        const poolAddressLower = poolAddress.toString().toLowerCase();
        const baseTokenAddress = pair.baseToken.address.toLowerCase();
        const quoteTokenAddress = pair.quoteToken.address.toLowerCase();
        const wethAddress = WETH_ADDRESS.toLowerCase();
        const isWethQuote = quoteTokenAddress === wethAddress;
        
        // Fetch transfers TO the pool
        const toPoolRequest = {
          id: 1,
          jsonrpc: "2.0",
          method: "alchemy_getAssetTransfers",
          params: [{
            fromBlock: "0x0",
            toBlock: "latest",
            category: ["external", "erc20"],
            withMetadata: true,
            maxCount: "0x" + transactionLimit.toString(16),
            order: "desc",
            toAddress: poolAddressLower,
          }],
        };

        // Fetch transfers FROM the pool
        const fromPoolRequest = {
          id: 2,
          jsonrpc: "2.0",
          method: "alchemy_getAssetTransfers",
          params: [{
            fromBlock: "0x0",
            toBlock: "latest",
            category: ["external", "erc20"],
            withMetadata: true,
            maxCount: "0x" + transactionLimit.toString(16),
            order: "desc",
            fromAddress: poolAddressLower,
          }],
        };

        const [toResponse, fromResponse] = await Promise.all([
          fetch(ALCHEMY_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toPoolRequest),
          }),
          fetch(ALCHEMY_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fromPoolRequest),
          }),
        ]);

        if (!toResponse.ok || !fromResponse.ok) {
          throw new Error("Failed to fetch transactions from Alchemy");
        }

        const toData = await toResponse.json();
        const fromData = await fromResponse.json();
        const transfers = [...(toData?.result?.transfers || []), ...(fromData?.result?.transfers || [])];
        
        // Filter transfers involving base or quote tokens, and group by transaction hash
        const transfersByTx = new Map<string, any[]>();
        
        for (const transfer of transfers) {
          // Skip self-transfers
          if (transfer.from?.toLowerCase() === transfer.to?.toLowerCase()) continue;
          
          const tokenAddress = transfer.rawContract?.address?.toLowerCase();
          const isBase = tokenAddress === baseTokenAddress;
          const isQuote = tokenAddress === quoteTokenAddress || 
                        (transfer.category === "external" && isWethQuote);
          
          if (isBase || isQuote) {
            const txHash = transfer.hash?.toLowerCase();
            if (txHash) {
              if (!transfersByTx.has(txHash)) {
                transfersByTx.set(txHash, []);
              }
              transfersByTx.get(txHash)!.push(transfer);
            }
          }
        }

        // Process each transaction to identify swaps and calculate amounts
        const trades: Array<{
          hash: string;
          timestamp: number;
          tokenAmount: number;
          tokenSymbol?: string;
          tokenAddress?: string;
          isBuy: boolean;
        }> = [];

        for (const [txHash, txTransfers] of transfersByTx.entries()) {
          try {
            // Find base token and quote token transfers in this transaction
            let baseTransfer: any = null;
            let quoteTransfer: any = null;
            
            for (const transfer of txTransfers) {
              const tokenAddress = transfer.rawContract?.address?.toLowerCase();
              if (tokenAddress === baseTokenAddress) {
                baseTransfer = transfer;
              } else if (tokenAddress === quoteTokenAddress || 
                        (transfer.category === "external" && isWethQuote)) {
                quoteTransfer = transfer;
              }
            }

            // Determine swap type and calculate base token amount
            let baseTokenAmount = 0;
            let isBuy = false;
            let timestamp = 0;

            if (baseTransfer) {
              // Base token transfer found - use it directly
              // Alchemy returns rawContract.value as hex string for ERC20, value as number for external
              let baseTokenAmountRaw = 0;
              if (baseTransfer.category === "erc20" && baseTransfer.rawContract?.value) {
                // ERC20: rawContract.value is hex string
                const decimals = await getCachedTokenDecimals(baseTokenAddress);
                const rawValue = parseInt(baseTransfer.rawContract.value, 16);
                baseTokenAmountRaw = rawValue / Math.pow(10, decimals);
              } else if (baseTransfer.category === "external" && baseTransfer.value != null) {
                // External ETH: value is already in ETH (human-readable)
                baseTokenAmountRaw = parseFloat(baseTransfer.value.toString());
              } else if (baseTransfer.rawContract?.value) {
                // Fallback: try to parse rawContract.value
                const decimals = baseTokenAddress === wethAddress ? 18 : 
                                await getCachedTokenDecimals(baseTokenAddress);
                const rawValue = parseInt(baseTransfer.rawContract.value, 16);
                baseTokenAmountRaw = rawValue / Math.pow(10, decimals);
              }
              
              baseTokenAmount = baseTokenAmountRaw;
              
              // Base token FROM pool = BUY (pool sending tokens to user)
              // Base token TO pool = SELL (user sending tokens to pool)
              isBuy = baseTransfer.from?.toLowerCase() === poolAddressLower;
              timestamp = baseTransfer.metadata?.blockTimestamp 
                ? new Date(baseTransfer.metadata.blockTimestamp).getTime() 
                : Date.now();
            } else if (quoteTransfer && pair?.priceUsd && parseFloat(pair.priceUsd) > 0) {
              // Only quote token transfer - convert to base token amount
              // Alchemy returns rawContract.value as hex string for ERC20, value as number for external
              let quoteAmount = 0;
              if (quoteTransfer.category === "erc20" && quoteTransfer.rawContract?.value) {
                // ERC20: rawContract.value is hex string
                const decimals = await getCachedTokenDecimals(quoteTokenAddress);
                const rawValue = parseInt(quoteTransfer.rawContract.value, 16);
                quoteAmount = rawValue / Math.pow(10, decimals);
              } else if (quoteTransfer.category === "external" && quoteTransfer.value != null) {
                // External ETH: value is already in ETH (human-readable)
                quoteAmount = parseFloat(quoteTransfer.value.toString());
              } else if (quoteTransfer.rawContract?.value) {
                // Fallback: try to parse rawContract.value
                const decimals = quoteTransfer.category === "external" ? 18 : 
                                await getCachedTokenDecimals(quoteTokenAddress);
                const rawValue = parseInt(quoteTransfer.rawContract.value, 16);
                quoteAmount = rawValue / Math.pow(10, decimals);
              }
              
              // Get quote token price in USD
              const quoteSymbol = pair.quoteToken.symbol?.toUpperCase();
              let quotePriceUSD = 1;
              if (quoteSymbol === "USDC" || quoteSymbol === "USDT" || quoteSymbol === "DAI") {
                quotePriceUSD = 1;
              } else if (quoteSymbol === "WETH" || quoteSymbol === "ETH") {
                quotePriceUSD = pair.priceNative ? parseFloat(pair.priceNative) : 3000;
              } else {
                quotePriceUSD = pair.priceNative ? parseFloat(pair.priceNative) : 1;
              }
              
              // Convert quote amount to base token amount
              const baseTokenPriceUSD = parseFloat(pair.priceUsd);
              const quoteValueUSD = quoteAmount * quotePriceUSD;
              baseTokenAmount = quoteValueUSD / baseTokenPriceUSD;
              
              // Quote token TO pool = BUY (user sending quote to pool, receiving base)
              // Quote token FROM pool = SELL (pool sending quote to user, receiving base)
              isBuy = quoteTransfer.to?.toLowerCase() === poolAddressLower;
              timestamp = quoteTransfer.metadata?.blockTimestamp 
                ? new Date(quoteTransfer.metadata.blockTimestamp).getTime() 
                : Date.now();
            } else {
              // Can't determine swap without base transfer or price data
              continue;
            }

            // Filter out dust and add to trades
            if (baseTokenAmount > 0.000001 && pair?.baseToken?.symbol) {
              trades.push({
                hash: txHash,
                timestamp,
                tokenAmount: baseTokenAmount,
                tokenSymbol: pair.baseToken.symbol,
                tokenAddress: baseTokenAddress,
                isBuy,
              });
            }
          } catch (e) {
            console.error(`Error processing transaction ${txHash}:`, e);
          }
        }

        // Sort by timestamp (newest first) and limit to 50
        const validTrades = trades
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50);

        if (!cancelled) {
          console.log(`✅ Fetched ${validTrades.length} trades`);
          setTransactions(validTrades);
        }
      } catch (e) {
        console.error("Error fetching transactions:", e);
        if (!cancelled) setTransactions([]);
      }
    }
    
    if (poolAddress && pair?.baseToken?.address && pair?.quoteToken?.address) {
      fetchTransactions();
      const interval = setInterval(() => {
        if (poolAddress && pair?.baseToken?.address && pair?.quoteToken?.address && !cancelled) {
          fetchTransactions();
        }
      }, 5000);
      return () => { cancelled = true; clearInterval(interval); };
    }
  }, [poolAddress, pair?.baseToken?.address, pair?.quoteToken?.address, pair?.priceUsd, pair?.priceNative]);

  const title = useMemo(() => {
    const base = pair?.baseToken?.symbol || "TOKEN";
    const quote = pair?.quoteToken?.symbol || "WETH";
    return `${base}/${quote}`;
  }, [pair]);

  const abbrev = (n: number, withDollar=false) => {
    if (n == null) return withDollar ? '-' : '-';
    const abs = Math.abs(n);
    if (abs >= 1e9) return `${withDollar ? '$' : ''}${(n/1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${withDollar ? '$' : ''}${(n/1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${withDollar ? '$' : ''}${(n/1e3).toFixed(2)}K`;
    return `${withDollar ? '$' : ''}${n.toFixed(2)}`;
  };

  // For table rendering, memoize and color-categorize
  // tokenAmount is already in base token units from the fetch function
  const augmentedTransactions = useMemo(() => {
    if (!transactions.length) return [];

    return transactions.map(tx => {
      // tokenAmount is already in base token units
      // USD = baseTokenAmount × baseTokenPriceUSD
      const baseTokenPriceUSD = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
      const usd = tx.tokenAmount * baseTokenPriceUSD;
      const usdLabel = abbrev(usd, true);

      // Fill calculation for visual bar sizing - enhanced separation for smaller values
      // Strategy: Use square root scale for better separation at lower values, then transition to log scale
      // - Minimum fill: 35% (lower to allow more room for distinction)
      // - Maximum fill: 100% (for very large trades)
      // - Square root scale emphasizes differences in smaller values
      const MIN_FILL = 35; // Lower minimum to allow more spread
      const MAX_FILL = 100; // Maximum fill
      const MIN_USD = 1; // Minimum USD value for scaling
      const MAX_USD = 10000; // USD value that reaches MAX_FILL
      const TRANSITION_POINT = 1000; // Point where we transition from sqrt to log scale
      
      let fill = 0;
      if (usd < MIN_USD) {
        // Very small trades: use minimum fill
        fill = MIN_FILL;
      } else if (usd >= MAX_USD) {
        // Very large trades: use maximum fill
        fill = MAX_FILL;
      } else if (usd < TRANSITION_POINT) {
        // Small to medium trades: Use square root scale for better separation
        // Square root gives more linear feel at lower values
        const sqrtMin = Math.sqrt(MIN_USD);
        const sqrtMax = Math.sqrt(TRANSITION_POINT);
        const sqrtValue = Math.sqrt(usd);
        const normalized = (sqrtValue - sqrtMin) / (sqrtMax - sqrtMin);
        
        // Map to 35% to 70% range for small trades
        const SMALL_MAX_FILL = 70;
        fill = MIN_FILL + (normalized * (SMALL_MAX_FILL - MIN_FILL));
        
        // Examples:
        // $1 → 35%
        // $10 → ~42%
        // $50 → ~52%
        // $100 → ~58%
        // $500 → ~66%
        // $1K → 70%
      } else {
        // Large trades: Use logarithmic scale for natural progression
        const logMin = Math.log10(TRANSITION_POINT);
        const logMax = Math.log10(MAX_USD);
        const logValue = Math.log10(usd);
        const normalized = (logValue - logMin) / (logMax - logMin);
        
        // Apply smooth easing curve
        const eased = 1 - Math.pow(1 - normalized, 2);
        
        // Scale from 70% to 100% for large trades
        const LARGE_MIN_FILL = 70;
        fill = LARGE_MIN_FILL + (eased * (MAX_FILL - LARGE_MIN_FILL));
        
        // Examples:
        // $1K → 70%
        // $2K → ~78%
        // $5K → ~88%
        // $10K+ → 100%
      }

      const isBuy = (tx as any).isBuy !== undefined ? (tx as any).isBuy : true;
      return { 
        ...tx, 
        isBuy,
        isSell: !isBuy, 
        usd, 
        usdLabel, 
        fill 
      };
    });
  }, [transactions, pair]);

  // External link SVG (replaces old icon inside <a> for time cell):
  const ExternalLinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 20 20"><rect x="3" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M9 11l7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M13.9 3.8h2.3c.5 0 .8.4.8.8v2.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  );

  const containerStyle = isMobile
    ? { height: "100vh", overscrollBehavior: "none" as const, overflow: "hidden" as const }
    : { height: "100vh", overscrollBehavior: "none" as const, overflow: "hidden" as const };

  if (loading || !pair) {
    return (
      <div className="bg-gray-950 text-gray-200 flex flex-col" style={containerStyle}>
        <Header />
        <div className="flex-1 flex items-center justify-center">
          {/* Loading state - no text, just empty space */}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 text-gray-200 flex flex-col overflow-hidden h-screen" style={containerStyle}>
      <Header />

      <div className={`flex-1 flex flex-col overflow-hidden ${isMobile && (activeMobileTab === 'overview' || activeMobileTab === 'pnl') ? 'h-full' : ''}`} style={isMobile && (activeMobileTab === 'overview' || activeMobileTab === 'pnl') ? { overscrollBehavior: 'none' } : undefined}>
        <div className={`flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px_320px] 2xl:grid-cols-[minmax(0,1fr)_260px_420px] gap-0 overflow-hidden min-h-0 ${isMobile && (activeMobileTab === 'overview' || activeMobileTab === 'pnl') ? 'h-full' : ''}`}>
          {/* Left: Chart & PnL */}
          <div
            className={`${(activeMobileTab === "overview" || activeMobileTab === "pnl") ? "flex" : "hidden"} flex-1 flex-col min-h-0 overflow-hidden xl:flex xl:overflow-hidden`}
            style={isMobile && (activeMobileTab === 'overview' || activeMobileTab === 'pnl') ? { 
              paddingBottom: mobileBottomOffset,
              height: '100%',
              maxHeight: '100%',
              overscrollBehavior: 'none'
            } : undefined}
          >
          <div className={`${activeMobileTab === "overview" ? "flex flex-col min-h-0 flex-1" : "hidden"} xl:flex xl:flex-col xl:flex-1 xl:min-h-0`}>
              {/* Pair header */}
              <div className={`flex items-center justify-between ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} border-b border-gray-800 bg-gray-950/90 flex-shrink-0`}>
                <div className="flex items-center gap-3 min-w-0">
                  {pair?.info?.imageUrl ? (
                    <img src={pair.info.imageUrl} alt={title} className="w-8 h-8 rounded-full border border-gray-700" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">{pair?.baseToken?.symbol?.[0] || "T"}</div>
                  )}
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <div className="text-white text-sm sm:text-base font-semibold">{title}</div>
                      {/* Dropdown trigger (placeholder icon) */}
                      <button
                        type="button"
                        aria-label="Open markets"
                        className="p-0.5 text-gray-400 hover:text-gray-200 focus:outline-none"
                        onClick={() => {
                          setShowTopVolume((v) => !v);
                          if (!showTopVolume) {
                            fetchTopVolume();
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                      <span className="text-[10px] sm:text-xs text-blue-300 bg-blue-500/15 border border-blue-500/30 rounded-md px-2 py-[2px] leading-none">
                        Spot
                      </span>
                      {/* Watchlist Button */}
                      {poolAddress && (
                        <button
                          type="button"
                          onClick={() => {
                            if (watchlists.length === 0) {
                              setShowWatchlistModal(true);
                            } else {
                              const tokenWatchlists = getWatchlistsForToken(poolAddress);
                              if (tokenWatchlists.length > 0) {
                                // Remove from first watchlist
                                removeFromWatchlist(tokenWatchlists[0].id, poolAddress);
                              } else {
                                // Add to first watchlist
                                addToWatchlist(watchlists[0].id, poolAddress);
                              }
                            }
                          }}
                          className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                          title={poolAddress && getWatchlistsForToken(poolAddress).length > 0 ? "Remove from watchlist" : "Add to watchlist"}
                        >
                          <FiStar className={`w-4 h-4 ${poolAddress && getWatchlistsForToken(poolAddress).length > 0 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}`} />
                        </button>
                      )}
                      {/* Alert Button */}
                      {poolAddress && pair?.baseToken?.address && (
                        <button
                          type="button"
                          onClick={() => setShowAlertModal(true)}
                          className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                          title="Set price alert"
                        >
                          <FiBell className={`w-4 h-4 ${poolAddress && hasActiveAlert(pair.baseToken.address) ? 'text-blue-400' : 'text-gray-400'}`} />
                        </button>
                      )}
                    </div>
                    {showTopVolume && (
                      <div className="absolute top-full mt-2 left-0 z-30 w-[600px] sm:w-[720px] bg-gray-900 border border-gray-800 shadow-2xl rounded-lg" style={{ 
                        maxWidth: 'min(720px, calc(100vw - 32px))',
                        left: '0',
                        right: 'auto'
                      }}>
                        <div className="px-4 py-2.5 text-xs text-gray-400 border-b border-gray-800 bg-gray-900/50">Top 10 by 24h Volume</div>
                        <div className="max-h-[70vh] overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 text-gray-400 z-10">
                              <tr>
                                <th className="px-3 py-2 text-left font-normal">Symbol</th>
                                <th className="px-3 py-2 text-right font-normal">Last</th>
                                <th className="px-3 py-2 text-right font-normal">24h</th>
                                <th className="px-3 py-2 text-right font-normal">Vol 24h</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topVolumeLoading ? (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-gray-400">Loading...</td>
                                </tr>
                              ) : topVolumePairs.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-gray-400">No data</td>
                                </tr>
                              ) : (
                                topVolumePairs.map((p) => {
                                  const change = (p as any).priceChange24h ?? 0;
                                  const changeColor = change >= 0 ? 'text-green-400' : 'text-red-400';
                                  return (
                                    <tr
                                      key={`${p.baseAddress}-${p.poolAddress}`}
                                      className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                                      onClick={() => {
                                        setShowTopVolume(false);
                                        if (p.poolAddress) {
                                          try { window.location.href = `/discover/${p.poolAddress}/chart`; } catch {}
                                        }
                                      }}
                                    >
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-5 h-5 bg-gray-800 text-[10px] text-gray-300 flex items-center justify-center overflow-hidden rounded">
                                            {p.imageUrl ? (
                                              <img src={p.imageUrl} alt={p.baseSymbol || 'T'} className="w-full h-full object-cover" />
                                            ) : (
                                              <span>{(p.baseSymbol || 'T').slice(0,1)}</span>
                                            )}
                                          </div>
                                          <div className="text-white text-[12px]">{p.baseSymbol}/{p.quoteSymbol}</div>
                                          <span className="ml-1 text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1 rounded">SPOT</span>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-200">${p.priceUsd?.toFixed(6)}</td>
                                      <td className={`px-3 py-2 text-right font-medium ${changeColor}`}>{change >= 0 ? '+' : ''}{Number(change).toFixed(2)}%</td>
                                      <td className="px-3 py-2 text-right text-gray-200">${(p.volume24h || 0).toLocaleString()}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span>{(() => {
                        const dexName = (pair as any)?.dexId || (pair as any)?.dexName || "DEX";
                        return dexName.charAt(0).toUpperCase() + dexName.slice(1).toLowerCase();
                      })()}</span>
                      {pair?.baseToken?.address && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{pair.baseToken.address.slice(0, 6)}…{pair.baseToken.address.slice(-4)}</span>
                          <button
                            onClick={copyTokenAddress}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                            title="Copy token address"
                          >
                            <FiCopy className={`w-3 h-3 ${copiedAddress ? 'text-green-400' : ''}`} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {/* Right-side stats from Dexscreener */}
                <div className="hidden lg:flex items-center gap-4 xl:gap-5 2xl:gap-6 flex-wrap xl:flex-nowrap">
                  <div className="text-right">
                    <div className={`${(pair as any)?.priceChange?.h24 && (pair as any).priceChange.h24 >= 0 ? 'text-green-400' : 'text-red-400'} text-base sm:text-lg font-medium`}>${currentPrice.toFixed(6)}</div>
                    <div className="text-gray-500 text-[11px]">Price</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-200 text-sm">{pair?.marketCap ? `$${(pair.marketCap/1e6).toFixed(2)}M` : '-'}</div>
                    <div className="text-gray-500 text-[11px]">MCap</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-200 text-sm">{pair?.fdv ? `$${(pair.fdv/1e6).toFixed(2)}M` : '-'}</div>
                    <div className="text-gray-500 text-[11px]">FDV</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-200 text-sm">{pair?.liquidity?.usd ? `$${abbrev(pair.liquidity.usd)}` : '-'}</div>
                    <div className="text-gray-500 text-[11px]">Liquidity</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-200 text-sm">{pair?.volume?.h24 ? `$${abbrev(pair.volume.h24)}` : '-'}</div>
                    <div className="text-gray-500 text-[11px]">Vol 24h</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-200 text-sm">{pair?.txns?.h24 ? `${pair.txns.h24.buys}/${pair.txns.h24.sells}` : '-'}</div>
                    <div className="text-gray-500 text-[11px]">Buys/Sells</div>
                  </div>
                </div>
              </div>

          {/* Chart */}
          <div className={`flex-1 min-h-0 flex flex-col ${isMobile && activeMobileTab === 'overview' ? 'overflow-hidden h-full' : ''}`}>
            {/* Controls */}
            <div className={`${isMobile ? 'px-2 py-1' : 'px-4 py-[5.75px]'} bg-gray-950 border-b border-gray-900/70 flex-shrink-0`}>
              <div className={`flex items-center ${isMobile ? 'gap-1.5 flex-wrap' : 'gap-2 justify-between'}`}>
                {/* Left side: Timeframe and Indicators */}
                <div className={`flex items-center ${isMobile ? 'gap-1.5 flex-1 min-w-0' : 'gap-1.5'}`}>
                  <div className="relative flex-shrink-0">
                    <button
                      ref={timeframeButtonRef}
                      onClick={() => {
                        setShowTimeframeDropdown(!showTimeframeDropdown);
                        setShowIndicatorsDropdown(false);
                      }}
                      className={`flex items-center gap-1 ${isMobile ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-sm'} rounded-lg text-gray-300 hover:text-white transition-colors`}
                    >
                      <span>{timeframe.toUpperCase()}</span>
                      <FiChevronDown className={`${isMobile ? 'w-3 h-3' : 'w-3.5 h-3.5'} transition-transform duration-200 ${showTimeframeDropdown ? 'rotate-180' : ''}`} style={{ minWidth: isMobile ? '12px' : '14px', minHeight: isMobile ? '12px' : '14px' }} />
                    </button>
                    {showTimeframeDropdown && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowTimeframeDropdown(false)}
                        />
                        <div className="absolute top-full left-0 mt-1.5 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[90px] overflow-hidden">
                          {TIMEFRAME_OPTIONS.map((tf) => (
                            <button
                              key={tf}
                              onClick={() => {
                                setTimeframe(tf);
                                setShowTimeframeDropdown(false);
                                // Auto-adjust moving average period based on timeframe for better indicator behavior
                                const adaptivePeriod = getAdaptivePeriod(tf);
                                setMovingAveragePeriod(adaptivePeriod);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                                timeframe === tf
                                  ? "text-white bg-blue-500/20 border-l-2 border-blue-500"
                                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                              }`}
                            >
                              {tf.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Indicators dropdown with active indicator label */}
                  <div className="relative flex-shrink-0">
                    <button
                      ref={indicatorsButtonRef}
                      onClick={() => {
                        setShowIndicatorsDropdown(!showIndicatorsDropdown);
                        setShowTimeframeDropdown(false);
                      }}
                      className={`flex items-center gap-1 ${isMobile ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-sm'} rounded-lg text-gray-300 hover:text-white transition-colors`}
                      style={!isMobile && indicatorsButtonWidth ? { width: `${indicatorsButtonWidth}px` } : undefined}
                    >
                      <span>
                        {(() => {
                          const activeIndicators = [];
                          if (showVWAP) activeIndicators.push('VWAP');
                          if (showMovingAverage) activeIndicators.push('SMA');
                          if (showEMA) activeIndicators.push('EMA');
                          if (showRSI) activeIndicators.push('RSI');
                          return activeIndicators.length > 0 ? activeIndicators.join(', ') : 'Indicators';
                        })()}
                      </span>
                      <FiChevronDown className={`${isMobile ? 'w-3 h-3' : 'w-3.5 h-3.5'} transition-transform duration-200 ${showIndicatorsDropdown ? 'rotate-180' : ''}`} style={{ minWidth: isMobile ? '12px' : '14px', minHeight: isMobile ? '12px' : '14px' }} />
                    </button>
                    {showIndicatorsDropdown && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowIndicatorsDropdown(false)}
                        />
                        <div className="absolute top-full left-0 mt-1.5 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[200px] overflow-hidden">
                          {/* Indicator Toggles */}
                          <div className="border-b border-gray-700">
                            <button
                              onClick={() => {
                                setShowMovingAverage(!showMovingAverage);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                                showMovingAverage
                                  ? "text-white bg-blue-500/20 border-l-2 border-blue-500"
                                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                              }`}
                            >
                              <span>SMA</span>
                              {showMovingAverage && <span className="text-blue-400">●</span>}
                            </button>
                            <button
                              onClick={() => {
                                setShowEMA(!showEMA);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                                showEMA
                                  ? "text-white bg-purple-500/20 border-l-2 border-purple-500"
                                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                              }`}
                            >
                              <span>EMA</span>
                              {showEMA && <span className="text-purple-400">●</span>}
                            </button>
                            <button
                              onClick={() => {
                                setShowVWAP(!showVWAP);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                                showVWAP
                                  ? "text-white bg-amber-500/20 border-l-2 border-amber-500"
                                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                              }`}
                            >
                              <span>VWAP</span>
                              {showVWAP && <span className="text-amber-400">●</span>}
                            </button>
                            <button
                              onClick={() => {
                                setShowRSI(!showRSI);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                                showRSI
                                  ? "text-white bg-pink-500/20 border-l-2 border-pink-500"
                                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                              }`}
                            >
                              <span>RSI</span>
                              {showRSI && <span className="text-pink-400">●</span>}
                            </button>
                          </div>
                          
                          {/* Settings Section */}
                          <div className="px-3 py-2 border-b border-gray-700">
                            <div className="text-[10px] text-gray-500 uppercase mb-2">MA Period</div>
                            <div className="flex gap-1">
                              {[10, 20, 50, 200].map((period) => (
                                <button
                                  key={period}
                                  onClick={() => setMovingAveragePeriod(period)}
                                  className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                                    movingAveragePeriod === period
                                      ? "bg-blue-500 text-white"
                                      : "bg-gray-700/50 text-gray-300 hover:bg-gray-700"
                                  }`}
                                >
                                  {period}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Color Settings */}
                          <div className="px-3 py-2 space-y-2">
                            <div className="text-[10px] text-gray-500 uppercase mb-1">Colors</div>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">SMA:</span>
                                <input
                                  type="color"
                                  value={indicatorColors.sma}
                                  onChange={(e) => setIndicatorColors({...indicatorColors, sma: e.target.value})}
                                  className="w-6 h-6 rounded border border-gray-600 cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">EMA:</span>
                                <input
                                  type="color"
                                  value={indicatorColors.ema}
                                  onChange={(e) => setIndicatorColors({...indicatorColors, ema: e.target.value})}
                                  className="w-6 h-6 rounded border border-gray-600 cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">VWAP:</span>
                                <input
                                  type="color"
                                  value={indicatorColors.vwap}
                                  onChange={(e) => setIndicatorColors({...indicatorColors, vwap: e.target.value})}
                                  className="w-6 h-6 rounded border border-gray-600 cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">RSI:</span>
                                <input
                                  type="color"
                                  value={indicatorColors.rsi}
                                  onChange={(e) => setIndicatorColors({...indicatorColors, rsi: e.target.value})}
                                  className="w-6 h-6 rounded border border-gray-600 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Right side controls */}
                <div className={`flex items-center ${isMobile ? 'gap-1 flex-shrink-0' : 'gap-1.5 flex-shrink-0'}`}>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setYAxisMode("price")}
                      className={`${isMobile ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-sm'} rounded-lg transition-colors ${
                        yAxisMode === "price"
                          ? "text-blue-400"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Price
                    </button>
                    <span className="text-gray-600 text-sm">/</span>
                    <button
                      onClick={() => setYAxisMode("marketCap")}
                      className={`${isMobile ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-sm'} rounded-lg transition-colors ${
                        yAxisMode === "marketCap"
                          ? "text-blue-400"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      MCap
                    </button>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => chartRef.current?.zoomIn()}
                      className={`${isMobile ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-sm'} rounded-lg text-gray-400 hover:text-white transition-colors`}
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                    <button
                      onClick={() => chartRef.current?.zoomOut()}
                      className={`${isMobile ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-sm'} rounded-lg text-gray-400 hover:text-white transition-colors`}
                      aria-label="Zoom out"
                    >
                      −
                    </button>
                    <button
                      onClick={() => chartRef.current?.fit()}
                      className={`${isMobile ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-sm'} rounded-lg text-gray-400 hover:text-white transition-colors`}
                    >
                      ↻
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div 
              className={`flex-1 min-h-0 relative ${isMobile && activeMobileTab === 'overview' ? 'overflow-hidden' : ''}`}
              style={isMobile && activeMobileTab === 'overview' ? {
                height: '100%',
                maxHeight: '100%'
              } : undefined}
            >
              <LightweightChart
                ref={chartRef}
                height={isMobile ? undefined : chartHeight}
                theme="dark"
                candles={candles}
                priceScalePadding={chartPriceScalePadding}
                yAxisMode={yAxisMode}
                currentMarketCap={pair?.marketCap}
                currentPrice={pair?.priceUsd ? parseFloat(pair.priceUsd) : undefined}
                showVolume={true}
                showMovingAverage={showMovingAverage}
                movingAveragePeriod={movingAveragePeriod}
                timeframe={timeframe}
                showVWAP={showVWAP}
                showRSI={showRSI}
                showEMA={showEMA}
                indicatorColors={indicatorColors}
              />
              {/* Overlay: Branding and OHLC in top-left */}
              {!isMobile && (
                <div className="absolute top-4 left-4 z-10">
                  <div className="flex items-center gap-3">
                    {/* Branding and Token Info */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span>{title}</span>
                      <span className="text-gray-500">•</span>
                      <span>{timeframe.toUpperCase()}</span>
                      <span className="text-gray-500">•</span>
                      <span className="capitalize">{(pair as any)?.dexId || (pair as any)?.dexName || "DEX"}</span>
                    </div>
                    {/* OHLC Data */}
                    {candles.length > 0 && (
                      <>
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        {(() => { 
                          const c = candles[candles.length-1];
                          const currentPrice = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
                          const currentMarketCap = pair?.marketCap || 0;
                          
                          let openVal, highVal, lowVal, closeVal;
                          if (yAxisMode === "marketCap" && currentPrice > 0 && currentMarketCap > 0) {
                            openVal = (c.open / currentPrice) * currentMarketCap;
                            highVal = (c.high / currentPrice) * currentMarketCap;
                            lowVal = (c.low / currentPrice) * currentMarketCap;
                            closeVal = (c.close / currentPrice) * currentMarketCap;
                            const formatMcap = (val: number) => {
                              if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
                              if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
                              if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
                              return `$${val.toFixed(2)}`;
                            };
                            const change = closeVal - openVal;
                            const changePercent = openVal !== 0 ? ((change / openVal) * 100) : 0;
                            const changeSign = change >= 0 ? '+' : '';
                            return (
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-white">O <span className="text-red-400">{formatMcap(openVal)}</span></span>
                                <span className="text-white">H <span className="text-red-400">{formatMcap(highVal)}</span></span>
                                <span className="text-white">L <span className="text-red-400">{formatMcap(lowVal)}</span></span>
                                <span className="text-white">C <span className="text-red-400">{formatMcap(closeVal)}</span></span>
                                <span className="text-red-400">{changeSign}{formatMcap(change)} ({changeSign}{changePercent.toFixed(2)}%)</span>
                              </div>
                            );
                          } else {
                            const change = c.close - c.open;
                            const changePercent = c.open !== 0 ? ((change / c.open) * 100) : 0;
                            const changeSign = change >= 0 ? '+' : '';
                            const formatPrice = (val: number) => {
                              // Format to show appropriate decimal places
                              if (val >= 1000) return val.toFixed(2);
                              if (val >= 1) return val.toFixed(3);
                              if (val >= 0.1) return val.toFixed(4);
                              return val.toFixed(5);
                            };
                            return (
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-white">O <span className="text-red-400">{formatPrice(c.open)}</span></span>
                                <span className="text-white">H <span className="text-red-400">{formatPrice(c.high)}</span></span>
                                <span className="text-white">L <span className="text-red-400">{formatPrice(c.low)}</span></span>
                                <span className="text-white">C <span className="text-red-400">{formatPrice(c.close)}</span></span>
                                <span className="text-red-400">{changeSign}{formatPrice(Math.abs(change))} ({changeSign}{changePercent.toFixed(2)}%)</span>
                              </div>
                            );
                          }
                        })()}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          </div>

          {/* Data sections below chart */}
          <div className={`${isMobile ? (activeMobileTab === "pnl" ? "flex" : "hidden") : "flex"} flex-col min-h-0 flex-shrink-0`} style={{ minHeight: '300px' }}>
            <div className="w-full px-4 flex gap-4 text-sm border-b border-gray-800/50 flex-shrink-0" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
              <button onClick={() => setActiveDataTab("orders")} className={`pb-2 transition-colors ${activeDataTab==='orders' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-300'}`}>Orders</button>
              <button onClick={() => setActiveDataTab("positions")} className={`pb-2 transition-colors ${activeDataTab==='positions' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-300'}`}>Positions</button>
            </div>
            <div className="px-4 pt-6 text-sm text-white bg-gray-950 min-h-[160px] flex-1 min-h-0 overflow-hidden flex flex-col">
              {activeDataTab === 'orders' && (
                <div className="w-full flex-1 flex flex-col">
                  {ordersLoading ? (
                    <div className="p-6 text-center text-gray-400 flex-1 flex flex-col items-center justify-center">
                      <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-sm">Loading orders...</p>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ paddingBottom: !isMobile && footerHeight > 0 ? `${footerHeight + 20}px` : '20px' }}>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800/50 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-300 mb-1">No orders available</p>
                      <p className="text-xs text-gray-500">Your order history will appear here once you place trades</p>
                    </div>
                  ) : (
                    <div className="w-full -mx-4 flex-1 min-h-0 flex flex-col overflow-hidden">
                      <div className="w-full border-b border-gray-700/50 mb-3 flex-shrink-0">
                        <div className="grid grid-cols-5 gap-4 px-4 py-2.5 text-xs text-gray-400">
                          <div>Time</div>
                          <div>Type</div>
                          <div>Amount</div>
                          <div>Price</div>
                          <div>Status</div>
                        </div>
                      </div>
                      <div className={`space-y-0 flex-1 min-h-0 ${isMobile ? (visibleOrders.length > 3 ? 'overflow-y-auto' : 'overflow-hidden') : (visibleOrders.length > 5 ? 'overflow-y-auto' : 'overflow-hidden')} ${desktopScrollable}`} style={{ paddingBottom: !isMobile && footerHeight > 0 ? `${footerHeight + 8}px` : '8px', overscrollBehavior: 'contain' }}>
                        {visibleOrders.map((order, idx) => {
                          const orderColor = order.type === 'buy' ? "text-green-400" : "text-red-400";
                          const orderLabel = order.type === 'buy' ? "BUY" : "SELL";
                          
                          // Calculate display amount - use outputAmount for buys, inputAmount for sells
                          const displayAmount = parseFloat(order.amount || '0');
                          const amountStr = displayAmount > 0 
                            ? displayAmount.toLocaleString(undefined, { maximumFractionDigits: 6, minimumFractionDigits: 0 })
                            : '0';
                          
                          return (
                            <div 
                              key={`order-${order.id}-${order.transactionHash || order.timestamp || idx}`} 
                              className={`w-full grid grid-cols-5 gap-4 px-4 py-3 ${idx < visibleOrders.length - 1 ? 'border-b border-gray-800/30' : ''} hover:bg-gray-800/20 transition-colors`}
                            >
                              <div className="text-gray-300 text-sm">
                                {formatTimeAgo(order.timestamp)}
                              </div>
                              <div>
                                <span className={`font-medium ${orderColor} text-sm`}>
                                  {orderLabel}
                                </span>
                              </div>
                              <div className="text-gray-300 text-sm">
                                {amountStr}
                              </div>
                              <div className="text-gray-300 text-sm">
                                ${parseFloat(order.price || '0').toFixed(6)}
                              </div>
                              <div>
                                <span className={`px-2 py-1 text-xs rounded ${
                                  (order.status === 'completed' || order.status === 'confirmed') ? 'bg-green-500/20 text-green-400' :
                                  order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {(order.status === 'completed' || order.status === 'confirmed') ? 'filled' : order.status}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeDataTab === 'positions' && (
                <div className="w-full flex-1 flex flex-col">
                  {positionsLoading ? (
                    <div className="p-6 text-center text-gray-400 flex-1 flex flex-col items-center justify-center">
                      <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-sm">Loading positions...</p>
                    </div>
                  ) : positions.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ paddingBottom: !isMobile && footerHeight > 0 ? `${footerHeight + 20}px` : '20px' }}>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800/50 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-300 mb-1">No active positions</p>
                      <p className="text-xs text-gray-500">Your open positions for this token will appear here</p>
                    </div>
                  ) : (
                    <div className="w-full -mx-4 flex-1 min-h-0 flex flex-col overflow-hidden">
                      <div className="w-full border-b border-gray-700/50 mb-3 flex-shrink-0">
                        <div className="grid grid-cols-5 gap-4 px-4 py-2.5 text-xs text-gray-400">
                          <div>Token</div>
                          <div>Amount</div>
                          <div>Avg Price</div>
                          <div>Current</div>
                          <div>P&L</div>
                        </div>
                      </div>
                      <div className={`space-y-0 flex-1 min-h-0 ${isMobile ? (visiblePositions.length > 3 ? 'overflow-y-auto' : 'overflow-hidden') : (visiblePositions.length > 4 ? 'overflow-y-auto max-h-[400px]' : 'overflow-hidden')}`} style={{ overscrollBehavior: 'contain' }}>
                        {visiblePositions.map((position, idx) => {
                          const pnlColor = position.pnlPercentage !== undefined ? 
                            (position.pnlPercentage >= 0 ? "text-green-400" : "text-red-400") :
                            (position.pnl?.startsWith('+') ? "text-green-400" : "text-red-400");
                          
                          // Ensure amount displays correctly
                          const displayAmount = parseFloat(position.amount || position.remainingAmount?.toString() || '0');
                          const amountStr = displayAmount > 0 
                            ? displayAmount.toLocaleString(undefined, { maximumFractionDigits: 6, minimumFractionDigits: 0 })
                            : '0';
                          
                          return (
                            <div 
                              key={`position-${position.id}-${position.tokenAddress}-${position.entryDate || idx}`} 
                              className={`w-full grid grid-cols-5 gap-4 px-4 py-3 ${idx < visiblePositions.length - 1 ? 'border-b border-gray-800/30' : ''} hover:bg-gray-800/20 transition-colors`}
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center border border-gray-600 flex-shrink-0 overflow-hidden">
                                  {pair?.info?.imageUrl ? (
                                    <img 
                                      src={pair.info.imageUrl} 
                                      alt={position.tokenSymbol || 'Token'}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-8 h-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-blue-500/30 ${pair?.info?.imageUrl ? 'hidden' : ''}`}>
                                    <span className="text-blue-400 font-bold text-sm">
                                      {position.tokenSymbol?.charAt(0) || 'T'}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-gray-300 font-medium text-sm">
                                  {position.tokenSymbol || 'Unknown'}
                                </div>
                              </div>
                              <div className="text-gray-300 text-sm flex items-center">
                                {amountStr}
                              </div>
                              <div className="text-gray-300 text-sm flex items-center">
                                ${parseFloat(position.avgPrice || '0').toFixed(6)}
                              </div>
                              <div className="text-gray-300 text-sm flex items-center">
                                ${parseFloat(position.currentPrice || '0').toFixed(6)}
                              </div>
                              <div className={`font-medium text-sm flex items-center ${pnlColor}`}>
                                {position.pnl || position.pnlValue || (
                                  position.pnlPercentage !== undefined ? (
                                    `${position.pnlPercentage >= 0 ? '+' : ''}$${Math.abs(position.pnlPercentage || 0).toFixed(2)}`
                                  ) : 'N/A'
                                )}
                                {position.pnlPercentage !== undefined && (
                                  <span className="ml-1.5 text-xs">
                                    ({position.pnlPercentage >= 0 ? '+' : ''}{position.pnlPercentage.toFixed(2)}%)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Transactions and Holders */}
        <div
          className={`${activeMobileTab === "trades" ? "flex" : "hidden"} xl:flex flex-col bg-gray-950 border-t border-gray-900/60 xl:border-t-0 xl:border-l xl:border-gray-800 w-full xl:w-[220px] xl:max-w-[220px] 2xl:w-[260px] 2xl:max-w-[260px] overflow-hidden min-h-0 h-full relative`}
          style={isMobile ? { paddingBottom: mobileBottomOffset } : undefined}
        >
          {/* Tab selector */}
          <div className="px-4 pt-3 pb-0 flex gap-2 text-sm border-b border-gray-800/50 h-[70px] items-end relative z-10">
            <button 
              onClick={() => setActiveMiddleTab("trades")} 
              className={`pb-2 flex-1 w-full text-center transition-colors ${activeMiddleTab === 'trades' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Trades
            </button>
            <button 
              onClick={() => setActiveMiddleTab("holders")} 
              className={`pb-2 flex-1 w-full text-center transition-colors ${activeMiddleTab === 'holders' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Holders
            </button>
          </div>
          
          {/* Recent Trades content */}
          {activeMiddleTab === 'trades' && (
            <div
              className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                overflowX: 'visible',
                scrollBehavior: 'smooth',
              }}
            >
              <table className="w-full text-xs" style={{ position: 'relative' }}>
                <thead className="text-gray-300 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-20" style={{ marginTop: '-112px', paddingTop: '112px', paddingBottom: '42px', borderBottomWidth: '1px' }}>
                  <tr>
                    <th className="text-left px-3 py-3 font-medium">USD</th>
                    <th className="text-center px-2 py-3 font-medium">Size ({pair?.baseToken?.symbol || "TOKEN"})</th>
                    <th className="text-center px-3 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {augmentedTransactions.length === 0 && (
                    <tr><td className="px-3 py-6 text-gray-400" colSpan={3}>No recent trades</td></tr>
                  )}
                  {augmentedTransactions.slice(0, 50).map((tx) => {
                    const isNewTrade = newTradeHashes.has(tx.hash);
                    return (
                      <motion.tr 
                        key={`trade-${tx.hash}-${tx.timestamp}-${tx.tokenAmount}`} 
                        className="border-b border-gray-800/40 hover:bg-gray-900/30 transition-colors relative group"
                        initial={isNewTrade ? { 
                          backgroundColor: tx.isBuy 
                            ? 'rgba(34, 197, 94, 0.2)' 
                            : 'rgba(239, 68, 68, 0.2)',
                          scale: 1.01
                        } : false}
                        animate={isNewTrade ? {
                          backgroundColor: 'transparent',
                          scale: 1
                        } : {}}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      >
                        {/* USD Value with clean color bar - only size varies */}
                        <td className="px-3 py-2.5 relative" style={{ overflow: tx.fill === 100 ? 'visible' : 'hidden' }}>
                          <motion.div 
                            aria-hidden 
                            className={`absolute left-0 top-0 bottom-0 ${tx.isBuy ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                            style={{ 
                              zIndex: 0,
                              width: tx.fill === 100 
                                ? 'calc(260px)' 
                                : `${tx.fill}%`,
                            }}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ 
                              width: tx.fill === 100 
                                ? '260px' 
                                : `${tx.fill}%`,
                              opacity: 1 
                            }}
                            transition={{ 
                              duration: 0.6, 
                              ease: [0.4, 0, 0.2, 1],
                              opacity: { duration: 0.3 }
                            }}
                          />
                          {isNewTrade && (
                            <motion.div
                              className={`absolute inset-0 z-5 ${tx.isBuy ? 'bg-green-500/30' : 'bg-red-500/30'}`}
                              initial={{ opacity: 1, x: -20 }}
                              animate={{ opacity: 0, x: 0 }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                          )}
                          <motion.span 
                            className={`relative z-10 font-semibold ${tx.isBuy ? 'text-green-400' : 'text-red-400'}`}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1, duration: 0.3 }}
                          >
                            {tx.usdLabel}
                          </motion.span>
                        </td>
                        <td className="px-2 py-2.5 text-center text-gray-200 group-hover:text-white transition-colors">
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.15, duration: 0.3 }}
                          >
                            {tx.tokenAmount > 0 ? (
                              tx.tokenAmount >= 1 
                                ? tx.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })
                                : tx.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 6, minimumFractionDigits: 0 })
                            ) : '0'}
                          </motion.span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Link
                            href={`/explorer/tx/${tx.hash}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            className="text-gray-400 hover:text-blue-400 hover:underline transition-all duration-200 group"
                            title={tx.hash}
                          >
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.2, duration: 0.3 }}
                            >
                              {dayjs(tx.timestamp).format('HH:mm:ss')}
                            </motion.span>
                            <motion.div
                              whileHover={{ scale: 1.1, rotate: -45 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ExternalLinkIcon />
                            </motion.div>
                          </Link>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Holders content */}
          {activeMiddleTab === 'holders' && (
            <div
              className="flex-1 px-4 py-4 text-sm text-white"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                paddingBottom: isMobile ? mobileBottomOffset : undefined,
              }}
            >
              <div className="text-gray-300">Holders data will appear here.</div>
            </div>
          )}
        </div>

        {/* Right: Swap panel (refined UI) */}
        <aside
          className={`${activeMobileTab === "swap" ? "flex" : "hidden"} xl:flex flex-col bg-gray-950 border-t border-gray-900/60 xl:border-t-0 xl:border-l xl:border-gray-800 w-full xl:min-w-[320px] 2xl:min-w-[400px] overflow-hidden`}
          style={isMobile ? { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" } : undefined}
        >
          {!isMobile && (
            <>
              <div className="px-4 py-3 pb-[17px]">
                <div className="flex items-center gap-3">
                  {pair?.info?.imageUrl ? (
                    <img src={pair.info.imageUrl} alt={title} className="w-10 h-10 rounded-full border border-gray-700" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                      {pair?.baseToken?.symbol?.[0] || "T"}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-white font-semibold text-sm">{title}</div>
                    <div className="text-xs text-gray-400">{pair?.baseToken?.name || pair?.baseToken?.symbol || "Token"}</div>
                  </div>
                </div>
                {(tokenInfo?.website || tokenInfo?.twitter || tokenInfo?.telegram) && (
                  <div className="flex items-center gap-3 mt-3">
                    {tokenInfo.website && (
                      <a
                        href={tokenInfo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white transition-colors text-xs"
                      >
                        🌐 Website
                      </a>
                    )}
                    {tokenInfo.twitter && (
                      <a
                        href={tokenInfo.twitter.startsWith('http') ? tokenInfo.twitter : `https://twitter.com/${tokenInfo.twitter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white transition-colors text-xs"
                      >
                        🐦 Twitter
                      </a>
                    )}
                    {tokenInfo.telegram && (
                      <a
                        href={tokenInfo.telegram.startsWith('http') ? tokenInfo.telegram : `https://t.me/${tokenInfo.telegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white transition-colors text-xs"
                      >
                        💬 Telegram
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="border-t border-gray-800"></div>
            </>
          )}

          {/* Buy/Sell and Swap Interface */}
          <div className={`${isMobile ? "px-3 py-2" : "px-4 py-3"} flex-1 flex flex-col relative overflow-hidden`}>
            {isMobile ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                <div className="space-y-2 flex-shrink-0">
                  <div className="rounded-xl border border-gray-800 bg-gray-900/85 px-2.5 py-1.5 shadow-sm">
                    <div className="flex items-center justify-between text-[9px] text-gray-400 mb-1.5">
                      <span>Buy / Sell</span>
                      <span className="text-gray-500">Powered by 0x</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setIsBuy(true)}
                        className={`rounded-lg py-1.5 text-[10px] font-semibold border transition-colors ${
                          isBuy
                            ? "bg-green-500/20 border-green-500/40 text-green-200 shadow-inner"
                            : "bg-gray-900/60 border-transparent text-gray-300 hover:border-gray-700"
                        }`}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsBuy(false)}
                        className={`rounded-lg py-1.5 text-[10px] font-semibold border transition-colors ${
                          !isBuy
                            ? "bg-red-500/20 border-red-500/40 text-red-200 shadow-inner"
                            : "bg-gray-900/60 border-transparent text-gray-300 hover-border-gray-700"
                        }`}
                      >
                        Sell
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-xl border ${insufficientFunds ? 'border-red-500/50' : 'border-gray-800'} bg-gray-900/75 p-2 shadow-sm`}>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1.5">
                      <span>You Pay</span>
                      <span className="text-[9px] text-gray-500">
                        {walletAddress ? (tokenBalance !== '0' ? `${tokenBalance} ${selectedPayToken ? selectedPayToken.symbol : (isBuy ? (pair?.quoteToken?.symbol || 'WETH') : pair?.baseToken?.symbol)}` : payBalanceDisplay) : "0.0000"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-shrink-0">{payTokenIcon}</div>
                        <div className="text-xs font-semibold text-white">{payTokenSymbol}</div>
                      </div>
                      <input
                        value={payAmount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setPayAmount(value);
                          setSwapError(null);
                          setInsufficientFunds(false);
                          // Check balance when amount changes
                          if (value && parseFloat(value) > 0 && walletAddress) {
                            const swapQuoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
                            const sellToken = selectedPayToken ? selectedPayToken.address : (isBuy ? swapQuoteTokenAddress : pair?.baseToken?.address || WETH_ADDRESS);
                            checkTokenBalance(sellToken, value).catch(err => console.error('Balance check error:', err));
                          } else {
                            setTokenBalance('0');
                            setInsufficientFunds(false);
                          }
                        }}
                        inputMode="decimal"
                        className={`flex-1 min-w-0 bg-transparent text-right text-lg font-semibold focus:outline-none placeholder-gray-600 ${insufficientFunds ? 'text-red-400' : 'text-white'}`}
                        placeholder="0"
                      />
                    </div>
                    {renderQuickButtons(
                      "grid grid-cols-4 gap-1 mt-2",
                      "rounded-full bg-gray-900/60 border border-gray-800 px-2 py-1 text-[9px] font-medium text-gray-300 hover:bg-blue-500/15 hover:text-blue-200"
                    )}
                    {insufficientFunds && (
                      <div className="mt-2 text-[10px] text-red-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Insufficient funds. You have {tokenBalance} {selectedPayToken ? selectedPayToken.symbol : (isBuy ? (pair?.quoteToken?.symbol || 'WETH') : pair?.baseToken?.symbol)}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsBuy((prev) => !prev);
                      const currentPay = payAmount;
                      setPayAmount(receiveAmount);
                      setReceiveAmount(currentPay);
                      if (walletAddress) {
                        const quoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
                        fetchQuoteTokenBalance(walletAddress, quoteTokenAddress);
                        if (pair?.baseToken?.address) {
                          fetchTokenBalance(walletAddress, pair.baseToken.address);
                        }
                      }
                    }}
                    className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-gray-800 bg-gray-900/70 text-gray-300 hover:text-white shadow-sm"
                    aria-label="Flip trade direction"
                  >
                    <SwapArrowsIcon className="w-3.5 h-3.5" />
                  </button>

                  <div className="rounded-xl border border-gray-800 bg-gray-900/75 p-2.5 shadow-sm">
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1.5">
                      <span>You Receive</span>
                      {quoteExpiresAt && receiveAmount && (
                        <span className={`text-[9px] ${isQuoteExpired ? "text-red-400" : "text-gray-500"}`}>
                          {isQuoteExpired ? "Expired" : `${quoteCountdown}s`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-shrink-0">{receiveTokenIcon}</div>
                        <div className="text-xs font-semibold text-white">{receiveTokenSymbol}</div>
                      </div>
                      <input
                        value={receiveAmount || ""}
                        readOnly
                        className="flex-1 min-w-0 bg-transparent text-right text-lg font-semibold text-white placeholder-gray-600"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-800 bg-gray-900/75 px-2.5 py-2 flex items-center justify-between text-[10px] text-gray-400">
                    <span>Slippage</span>
                    <div className="inline-flex gap-1.5">
                      {[0.5, 1, 2].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSlippage(s)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                            slippage === s
                              ? "bg-blue-500/25 text-blue-100 border border-blue-500/40"
                              : "text-gray-300 border border-gray-700 hover:bg-blue-500/10 hover:text-blue-200"
                          }`}
                        >
                          {s}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Order Buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        orderManagementRef.current?.openModal("LIMIT_BUY", payAmount);
                      }}
                      className="px-1.5 py-2 rounded-lg bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 text-gray-300 hover:text-blue-400 text-[9px] font-semibold transition-all hover:bg-blue-500/10"
                    >
                      Limit Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        orderManagementRef.current?.openModal("LIMIT_SELL", payAmount);
                      }}
                      className="px-1.5 py-2 rounded-lg bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 text-gray-300 hover:text-blue-400 text-[9px] font-semibold transition-all hover:bg-blue-500/10"
                    >
                      Limit Sell
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        orderManagementRef.current?.openModal("STOP_LOSS", payAmount);
                      }}
                      className="px-1.5 py-2 rounded-lg bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 text-gray-300 hover:text-blue-400 text-[9px] font-semibold transition-all hover:bg-blue-500/10"
                    >
                      Stop Loss
                    </button>
                  </div>

                  {swapError && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[10px] text-red-300 text-center">
                      {swapError}
                    </div>
                  )}

                  <div className="pt-1.5">
                    {walletAddress ? (
                      <button
                        type="button"
                        onClick={handleSwapButtonClick}
                        disabled={
                          !payAmount ||
                          !receiveAmount ||
                          parseFloat(payAmount || "0") <= 0 ||
                          parseFloat(receiveAmount || "0") <= 0 ||
                          isQuoteExpired ||
                          !pair?.baseToken?.address ||
                          isSwapping
                        }
                        className={`w-full rounded-xl py-2 font-semibold text-[10px] uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                          isBuy
                            ? "bg-green-500/25 border border-green-500/40 text-green-200 hover:bg-green-500/35"
                            : "bg-red-500/25 border border-red-500/40 text-red-200 hover:bg-red-500/35"
                        }`}
                      >
                        {isSwapping
                          ? "Processing..."
                          : isQuoteExpired
                            ? "Quote Expired"
                            : insufficientFunds
                              ? "Insufficient funds"
                              : `${isBuy ? "Buy" : "Sell"} ${receiveTokenSymbol}`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            (window as any).dispatchEvent(new CustomEvent("open-wallet"));
                          } catch {}
                        }}
                        className="w-full rounded-xl bg-blue-600 text-white py-2 font-semibold text-[10px] uppercase tracking-wide hover:bg-blue-500 transition-colors"
                      >
                        Connect Wallet
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className={`flex items-center justify-between ${swapSectionSpacing}`}>
                  <div className="w-full bg-gray-900/40 backdrop-blur supports-[backdrop-filter]:bg-gray-900/30 border border-gray-800 flex">
                    <button
                      type="button"
                      onClick={() => setIsBuy(true)}
                      className={`flex-1 ${swapButtonHeight} text-sm font-semibold ${
                        isBuy ? "bg-green-500/20 text-green-300" : "text-gray-300 hover:text-white hover:bg-gray-800/50"
                      }`}
                    >
                      Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBuy(false)}
                      className={`flex-1 ${swapButtonHeight} text-sm font-semibold ${
                        !isBuy ? "bg-red-500/20 text-red-300" : "text-gray-300 hover:text-white hover:bg-gray-800/50"
                      }`}
                    >
                      Sell
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 mb-2">Powered by 0x</div>

                <div className={`bg-gray-900/50 border border-gray-800 ${swapFieldPadding}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">You Pay</div>
                    <button
                      onClick={() => setShowTokenSelector(true)}
                      className="flex items-center gap-2 text-[11px] text-gray-300 hover:opacity-80 transition-opacity"
                    >
                      {payToken.logo ? (
                        <img src={payToken.logo} alt={payToken.symbol} className="w-5 h-5 rounded-full flex-shrink-0" onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }} />
                      ) : null}
                      <div className={`w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ${payToken.logo ? 'hidden' : ''}`}>
                        <span className="text-[10px] text-white font-bold">
                          {payToken.symbol.length <= 4 ? payToken.symbol : payToken.symbol.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-left">{payTokenSymbol}</span>
                      {walletAddress && (
                        <span className="text-[10px] text-gray-500 ml-1">({payBalanceDisplay})</span>
                      )}
                      <svg className="w-3 h-3 text-gray-400 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1 h-12">
                    <input
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="bg-transparent text-white text-lg focus:outline-none placeholder-gray-500 w-full"
                      placeholder="0.0"
                    />
                  </div>
                </div>

                {renderQuickButtons(
                  "flex gap-2 mt-2 mb-2",
                  `${quickButtonClass} bg-gray-800/60 text-gray-300 hover:text-white hover:bg-blue-500/20`
                )}

                <div className="flex items-center justify-center my-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBuy((prev) => !prev);
                      const currentPay = payAmount;
                      setPayAmount(receiveAmount);
                      setReceiveAmount(currentPay);
                      if (walletAddress) {
                        const quoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
                        fetchQuoteTokenBalance(walletAddress, quoteTokenAddress);
                        if (pair?.baseToken?.address) {
                          fetchTokenBalance(walletAddress, pair.baseToken.address);
                        }
                      }
                    }}
                    className="w-10 h-10 border border-gray-800 bg-gray-900/60 text-gray-300 hover:text-white flex items-center justify-center"
                  >
                    <SwapArrowsIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className={`bg-gray-900/50 border border-gray-800 ${swapFieldPadding} ${isMobile ? "mb-2" : "mb-3"}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">You Receive</div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-300">
                      <div className="flex-shrink-0">{receiveTokenIcon}</div>
                      <span>{receiveTokenSymbol}</span>
                    </div>
                  </div>
                  <div className={`flex items-center justify-between mt-1 ${swapButtonHeight} relative`}>
                    <input
                      value={receiveAmount || ""}
                      readOnly
                      className="bg-transparent text-white text-lg w-full pr-20"
                      placeholder="Enter amount above"
                    />
                    {quoteExpiresAt && receiveAmount && (
                      <div className="absolute right-0 text-xs">
                        {isQuoteExpired ? (
                          <span className="text-red-400">Expired</span>
                        ) : (
                          <span className="text-gray-500">
                            <span className="text-yellow-400">{quoteCountdown}s</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {walletAddress ? (
                  <>
                    {swapError && (
                      <div className="mb-2 text-xs text-red-400 text-center">{swapError}</div>
                    )}
                    
                    {/* Advanced Order Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          orderManagementRef.current?.openModal("LIMIT_BUY", payAmount);
                        }}
                        className="px-1.5 sm:px-3 py-2 bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 text-gray-300 hover:text-blue-400 text-[9px] sm:text-xs font-semibold transition-all hover:bg-blue-500/10"
                      >
                        Limit Buy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          orderManagementRef.current?.openModal("LIMIT_SELL", payAmount);
                        }}
                        className="px-1.5 sm:px-3 py-2 bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 text-gray-300 hover:text-blue-400 text-[9px] sm:text-xs font-semibold transition-all hover:bg-blue-500/10"
                      >
                        Limit Sell
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          orderManagementRef.current?.openModal("STOP_LOSS", payAmount);
                        }}
                        className="px-1.5 sm:px-3 py-2 bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 text-gray-300 hover:text-blue-400 text-[9px] sm:text-xs font-semibold transition-all hover:bg-blue-500/10"
                      >
                        Stop Loss
                      </button>
                    </div>
                    
                    <button
                      type="button"
                      onClick={executeSwap}
                      disabled={
                        !payAmount ||
                        !receiveAmount ||
                        parseFloat(payAmount || "0") <= 0 ||
                        parseFloat(receiveAmount || "0") <= 0 ||
                        isQuoteExpired ||
                        !pair?.baseToken?.address ||
                        isSwapping
                      }
                      className={`w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors select-none focus:outline-none ${
                        isBuy
                          ? "bg-green-600/30 hover:bg-green-600/40 active:bg-green-600/40 focus:bg-green-600/40 text-green-400"
                          : "bg-red-600/30 hover:bg-red-600/40 active:bg-red-600/40 focus:bg-red-600/40 text-red-400"
                      }`}
                    >
                      {isSwapping ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Processing...</span>
                        </div>
                      ) : isQuoteExpired ? (
                        "Quote Expired"
                      ) : (
                        `${isBuy ? "Buy" : "Sell"} ${receiveTokenSymbol}`
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        (window as any).dispatchEvent(new CustomEvent("open-wallet"));
                      } catch {}
                    }}
                    className="w-full bg-blue-600/90 hover:bg-blue-600 text-white py-3"
                  >
                    Connect Wallet
                  </button>
                )}

                <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
                  <span>Slippage</span>
                  <div className="inline-flex border border-gray-800">
                    {[0.5, 1, 2].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlippage(s)}
                        className={`px-2 py-1 ${slippage === s ? "bg-blue-500/20 text-blue-300" : "text-gray-300 hover:bg-blue-500/10 hover:text-blue-200"}`}
                      >
                        {s}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Orders Section */}
            {walletAddress && (
              <div className="border-t border-gray-800 mt-2">
                <div className="px-4 py-2">
                  <OrderManagement 
                    ref={orderManagementRef}
                    walletAddress={walletAddress}
                    tokenOutAddress={pair?.baseToken?.address || ""}
                    tokenOut={pair?.baseToken?.symbol || ""}
                    currentPrice={pair?.priceUsd ? parseFloat(pair.priceUsd) : undefined}
                    showHeader={false}
                    onOrderCreate={() => {
                      // Refresh orders if we're on orders tab
                      if (activeDataTab === 'orders') {
                        setTimeout(() => {
                          setOrdersInitialized(false);
                          fetchOrders();
                        }, 1000);
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Token Selector Dropdown - Within Swap Panel */}
            <AnimatePresence>
              {showTokenSelector && (
                <>
                  {/* Backdrop - only covers swap panel */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/40"
                    onClick={() => setShowTokenSelector(false)}
                    style={{ zIndex: 30 }}
                  />
                  {/* Dropdown - positioned within swap panel */}
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute inset-0 bg-gray-950 flex flex-col"
                    style={{ zIndex: 40 }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950 flex-shrink-0">
                      <h2 className="text-base font-semibold text-white">Select Token</h2>
                      <button
                        onClick={() => setShowTokenSelector(false)}
                        className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
          </div>

                    {/* Search Bar */}
                    <div className="px-4 py-3 border-b border-gray-800 bg-gray-950 flex-shrink-0 border-t-0">
                      <div className="relative">
                        <input
                          type="text"
                          value={tokenSearchQuery}
                          onChange={(e) => setTokenSearchQuery(e.target.value)}
                          placeholder="Search by name, symbol, or address"
                          className="w-full bg-gray-900/50 border border-gray-700/50 rounded-lg px-3 py-2 pl-9 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                          autoFocus
                        />
                        <svg className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {isSearchingTokens && (
                          <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Token List */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-2">
                      {isLoadingTokens ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : (
                        <>
                          {/* Search Results */}
                          {tokenSearchQuery && tokenSearchResults.length > 0 && (
                            <div className="mb-3">
                              <div className="text-xs text-gray-400 mb-2 px-2">Search Results</div>
                              <div className="space-y-1">
                                {tokenSearchResults.map((token, idx) => (
                                  <button
                                    key={`search-${token.address}-${idx}`}
                                    onClick={() => handleTokenSelect(token)}
                                    className="w-full flex items-center justify-between p-2.5 bg-gray-900/50 hover:bg-gray-800/50 rounded-lg border border-gray-700/50 transition-colors group"
                                  >
                                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                                      {token.logo ? (
                                        <img src={token.logo} alt={token.symbol} className="w-7 h-7 rounded-full flex-shrink-0" onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                        }} />
                                      ) : null}
                                      <div className={`w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ${token.logo ? 'hidden' : ''}`}>
                                        <span className="text-xs text-white font-bold">
                                          {token.symbol.length <= 4 ? token.symbol : token.symbol.substring(0, 2).toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="flex-1 min-w-0 text-left">
                                        <div className="text-white text-sm font-medium truncate">{token.symbol}</div>
                                        <div className="text-xs text-gray-400 truncate">{token.name || token.symbol}</div>
                                      </div>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* No Search Results */}
                          {tokenSearchQuery && !isSearchingTokens && tokenSearchResults.length === 0 && (
                            <div className="text-center py-8">
                              <div className="text-gray-400 text-sm mb-1">No tokens found</div>
                              <div className="text-xs text-gray-500">Try searching by symbol, name, or contract address</div>
                            </div>
                          )}

                          {/* Recent Tokens (ETH + Recent) */}
                          {!tokenSearchQuery && (
                            <div>
                              <div className="text-xs text-gray-400 mb-2 px-2">Recent Tokens</div>
                              <div className="space-y-1">
                                {availableTokens.length === 0 ? (
                                  <div className="text-center py-8 text-gray-400 text-sm">No recent tokens</div>
                                ) : (
                                  availableTokens.map((token, idx) => {
                                    const isSelected = payToken.address.toLowerCase() === token.address.toLowerCase();
                                    
                                    return (
                                      <button
                                        key={`token-${token.address}-${idx}`}
                                        onClick={() => handleTokenSelect(token)}
                                        disabled={isSelected}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                                          isSelected 
                                            ? 'bg-blue-500/20 border-blue-500/50 cursor-not-allowed' 
                                            : 'bg-gray-900/50 hover:bg-gray-800/50 border-gray-700/50'
                                        } group`}
                                      >
                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                          {token.logo ? (
                                            <img src={token.logo} alt={token.symbol} className="w-7 h-7 rounded-full flex-shrink-0" onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                            }} />
                                          ) : null}
                                          <div className={`w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ${token.logo ? 'hidden' : ''}`}>
                                            <span className="text-xs text-white font-bold">
                                              {token.symbol.length <= 4 ? token.symbol : token.symbol.substring(0, 2).toUpperCase()}
                                            </span>
                                          </div>
                                          <div className="flex-1 min-w-0 text-left">
                                            <div className="text-white text-sm font-medium truncate">{token.symbol}</div>
                                            <div className="text-xs text-gray-400 truncate">{token.name || token.symbol}</div>
                                          </div>
                                        </div>
                                        {isSelected ? (
                                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                            <FiCheck className="w-2.5 h-2.5 text-white" />
                                          </div>
                                        ) : (
                                          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        )}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </aside>

        </div>

        <div
          className="xl:hidden fixed inset-x-0 z-[60] border-t border-gray-900 bg-gray-950"
          style={{ bottom: `calc(${footerHeight}px + env(safe-area-inset-bottom, 0px))` }}
        >
          <div
            className="max-w-4xl mx-auto flex items-center justify-between px-3 py-1.5 text-[10px] font-medium"
            style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))" }}
          >
            {MOBILE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeMobileTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveMobileTab(tab.id)}
                  className={`group flex-1 mx-1 flex flex-col items-center gap-[3px] px-2 py-1 border-b-2 transition-colors ${
                    isActive
                      ? "text-blue-200 border-blue-500"
                      : "text-gray-400 border-transparent hover:text-gray-200"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? "text-blue-200" : "text-gray-500 group-hover:text-gray-300"
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Success Banner - Bottom Left */}
      <AnimatePresence>
        {swapSuccess && (
          <motion.div
            initial={{ opacity: 0, x: -100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`fixed bottom-6 left-6 z-50 min-w-[320px] max-w-md w-auto ${
              swapSuccess.type === 'buy'
                ? 'bg-green-500/20 border-green-500/40 text-green-400'
                : 'bg-red-500/20 border-red-500/40 text-red-400'
            } border backdrop-blur-xl rounded-lg px-4 py-2.5 shadow-2xl`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 ${
                swapSuccess.type === 'buy' ? 'text-green-400' : 'text-red-400'
              }`}>
                {swapSuccess.type === 'buy' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium leading-tight">
                    {swapSuccess.type === 'buy' ? 'Buy' : 'Sell'} Successful!
                  </p>
                  <p className="text-xs text-gray-300 leading-tight mt-0.5">
                    Received <span className="font-semibold">{swapSuccess.received} {swapSuccess.tokenSymbol}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    router.push(`/discover/${poolAddress}/tx/${swapSuccess.txHash}`);
                  }}
                  className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors text-blue-400 whitespace-nowrap"
                >
                  View TX
                </button>
              </div>
              <button
                onClick={() => setSwapSuccess(null)}
                className={`flex-shrink-0 ${
                  swapSuccess.type === 'buy' ? 'text-green-400' : 'text-red-400'
                } hover:opacity-70 transition-opacity`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copy Notification */}
      <AnimatePresence>
        {showCopyNotification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-6 z-[9999] bg-gray-800/90 backdrop-blur-sm border border-gray-700/50 rounded-lg px-4 py-3 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <FiCheck className="w-4 h-4 text-green-400" />
              <span className="text-white text-sm">Address copied to clipboard</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap Confirmation Dialog */}
      <AnimatePresence>
        {showSwapConfirmation && pendingSwapData && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowSwapConfirmation(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 rounded-2xl p-6 z-50 max-w-md mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Confirm Swap</h3>
                <button
                  onClick={() => setShowSwapConfirmation(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">You Pay</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-white">{pendingSwapData.payAmount}</span>
                    <span className="text-sm text-gray-300">{pendingSwapData.payToken}</span>
                  </div>
                </div>
                <div className="flex justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">You Receive</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-white">{pendingSwapData.receiveAmount}</span>
                    <span className="text-sm text-gray-300">{pendingSwapData.receiveToken}</span>
                  </div>
                </div>
                {insufficientFunds && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Insufficient funds. You have {tokenBalance} {pendingSwapData.payToken}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSwapConfirmation(false)}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => !insufficientFunds && executeSwap()}
                  disabled={insufficientFunds}
                  className="flex-1 px-4 py-3 bg-[#1d4ed8] hover:bg-[#2563eb] disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold"
                >
                  Confirm Swap
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Watchlist Modal */}
      <AnimatePresence>
        {showWatchlistModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWatchlistModal(false)}
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                  <h3 className="text-lg font-semibold text-white">Add to Watchlist</h3>
                  <button
                    onClick={() => setShowWatchlistModal(false)}
                    className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                  {watchlists.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No watchlists found. Create one from the discover page.</p>
                  ) : (
                    watchlists.map((watchlist) => {
                      const isInList = poolAddress && isInWatchlist(watchlist.id, poolAddress);
                      return (
                        <button
                          key={watchlist.id}
                          onClick={async () => {
                            if (poolAddress) {
                              if (isInList) {
                                await removeFromWatchlist(watchlist.id, poolAddress);
                              } else {
                                await addToWatchlist(watchlist.id, poolAddress);
                              }
                            }
                            setShowWatchlistModal(false);
                          }}
                          className={`w-full p-3 rounded-lg border transition-colors ${
                            isInList
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                              : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 text-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{watchlist.name}</span>
                            {isInList && <FiCheck className="w-5 h-5" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Price Alert Modal */}
      <AnimatePresence>
        {showAlertModal && poolAddress && pair?.baseToken?.address && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAlertModal(false)}
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                  <h3 className="text-lg font-semibold text-white">Set Price Alert</h3>
                  <button
                    onClick={() => setShowAlertModal(false)}
                    className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Alert when price goes
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAlertDirection("above")}
                        className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                          alertDirection === "above"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        Above
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlertDirection("below")}
                        className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                          alertDirection === "below"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        Below
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Price Threshold (USD)
                    </label>
                    <input
                      type="number"
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(e.target.value)}
                      placeholder={currentPrice ? currentPrice.toFixed(6) : "0.0"}
                      step="any"
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    {currentPrice && (
                      <p className="text-xs text-gray-500 mt-1">
                        Current: ${currentPrice.toFixed(6)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAlertModal(false)}
                      className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!alertThreshold || parseFloat(alertThreshold) <= 0) {
                          return;
                        }
                        if (pair.baseToken?.address) {
                          await createAlert(
                            pair.baseToken.address,
                            pair.baseToken.symbol || "TOKEN",
                            parseFloat(alertThreshold),
                            alertDirection
                          );
                        }
                        setShowAlertModal(false);
                        setAlertThreshold("");
                      }}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                      Create Alert
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


