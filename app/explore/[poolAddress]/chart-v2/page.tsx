"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";
import LightweightChart, { type LightweightChartHandle } from "./LightweightChart.tsx";
import { coinGeckoMapping } from "../../../tokenMapping";
import dayjs from "dayjs";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import { OverviewIcon, PerformanceIcon, SwapArrowsIcon, TradesIcon } from "../../../components/icons";

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

const TIMEFRAME_OPTIONS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
const MOBILE_TAB_HEIGHT = 44;

type MobileTabKey = typeof MOBILE_TABS[number]["id"];

export default function ChartV2Page() {
  const params = useParams();
  const poolAddress = params?.poolAddress as string | undefined;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [pair, setPair] = useState<DexPairResponse["pair"] | null>(null);
  const [candles, setCandles] = useState<Array<{ time: number; open: number; high: number; low: number; close: number }>>([]);
  const [activeDataTab, setActiveDataTab] = useState<"orders" | "positions">("orders");
  const [activeMiddleTab, setActiveMiddleTab] = useState<"trades" | "holders">("trades");
  const [transactions, setTransactions] = useState<Array<{ hash: string; timestamp: number; tokenAmount: number; tokenSymbol?: string; tokenAddress?: string; isBuy?: boolean }>>([]);
  const [timeframe, setTimeframe] = useState<string>("1d");
  const chartRef = React.useRef<LightweightChartHandle | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
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
  const [footerHeight, setFooterHeight] = useState(56);
  
  // Orders and Positions state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersInitialized, setOrdersInitialized] = useState(false);
  const [positions, setPositions] = useState<any[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsInitialized, setPositionsInitialized] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateLayoutMetrics = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setFooterHeight(0);
      } else {
        const footerEl = document.getElementById("app-footer");
        setFooterHeight(footerEl?.offsetHeight ?? 56);
      }
    };
    updateLayoutMetrics();
    window.addEventListener("resize", updateLayoutMetrics);
    return () => window.removeEventListener("resize", updateLayoutMetrics);
  }, []);

  const formatTimeAgo = useCallback((timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${Math.max(seconds, 1)}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }, []);

  const chartHeight = isMobile ? 260 : 480;
  const mobileBottomOffset = isMobile
    ? `calc(${footerHeight}px + ${MOBILE_TAB_HEIGHT}px + env(safe-area-inset-bottom, 0px))`
    : "0px";
  const swapButtonHeight = isMobile ? "h-10" : "h-12";
  const swapSectionSpacing = isMobile ? "mb-2" : "mb-3";
  const swapFieldPadding = isMobile ? "p-2.5" : "p-3";
  const quickButtonClass = isMobile ? "px-2 py-1 text-[10px]" : "px-2 py-1 text-[11px]";
  const desktopScrollable = !isMobile ? "overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" : "";
  const visibleOrders = isMobile ? orders.slice(0, 4) : orders;
  const visiblePositions = isMobile ? positions.slice(0, 4) : positions;

  // Detect connected wallet from localStorage (same key used elsewhere)
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('cypherx_wallet') : null;
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.address) {
          setWalletAddress(data.address);
          // Fetch balance when wallet is detected
          fetchWethBalance(data.address);
        }
      }
    } catch {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cypherx_wallet') {
        try { 
          const data = e.newValue ? JSON.parse(e.newValue) : null;
          const addr = data?.address || "";
          setWalletAddress(addr);
          if (addr) fetchWethBalance(addr);
        } catch { setWalletAddress(""); }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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


  // Fetch WETH balance (ETH + WETH on Base)
  const fetchWethBalance = async (address: string) => {
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
  };

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
      const res = await fetch('/api/explore/top-volume');
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
          const list: Array<{time:number;open:number;high:number;low:number;close:number}> = data?.candles || [];
          console.log("OHLC proxy result:", JSON.stringify({ tf: timeframe, count: list?.length, sample: list?.[list.length-1], first: list?.[0], rawData: data }));
          if (!cancelled && Array.isArray(list) && list.length > 0) {
            const mapped = list
              .map(c => ({ time: Math.floor(Number(c.time)), open: c.open, high: c.high, low: c.low, close: c.close }))
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

        // Determine sell and buy tokens based on isBuy and pair data
        const quoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS; // Fallback to WETH if no quote token
        
        const sellToken = isBuy ? quoteTokenAddress : pair.baseToken.address;
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
  }, [payAmount, pair?.baseToken?.address, pair?.quoteToken?.address, isBuy]);

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

  // Execute swap using 0x API with in-app wallet
  const executeSwap = async () => {
    if (!payAmount || !receiveAmount || isQuoteExpired || !pair?.baseToken?.address || !walletAddress) {
      return;
    }

    setIsSwapping(true);
    setSwapError(null);
    setSwapSuccess(null); // Clear any previous success message

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

      // Prepare swap parameters
      const swapQuoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS; // Fallback to WETH if no quote token
      
      const sellToken = isBuy ? swapQuoteTokenAddress : pair.baseToken.address;
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
      "15m": { path: "minute", agg: "15", periodSec: 900 },
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
      }, 15000);
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

      // Fill calculation for visual bar sizing with aggressive scaling after $1K
      // Strategy: Minimum fill covers text, minimal scaling $100-$1K, then very aggressive scaling $1K-$5K
      // - Minimum fill: 65% to ensure full text coverage (including $, decimals, K/M suffixes)
      // - <$100: 65% minimum (covers text)
      // - $100-$1K: Minimal scaling from 65% to 67% (keep small orders very similar)
      // - $1K-$5K: Extremely aggressive scaling from 67% to 100% (big jump for $1K+ orders)
      // - ≥$5K: 100% (full width)
      const MIN_FILL = 65; // Minimum to cover full text including suffixes and decimals
      const MID_FILL = 67; // Fill at $1K - keep it very close to minimum to maximize contrast
      
      let fill = 0;
      if (usd < 100) {
        // Below $100: Always use minimum to cover text
        fill = MIN_FILL;
      } else if (usd < 1000) {
        // $100-$1K: Minimal linear scaling from 65% to 67% (keep small orders very similar)
        const linear = (usd - 100) / (1000 - 100);
        fill = MIN_FILL + (linear * (MID_FILL - MIN_FILL)); // 65% to 67%
        // Example: $185 → 65.19%, $500 → 66.11%, $1000 → 67%
      } else if (usd >= 5000) {
        // $5K+: Full width
        fill = 100;
      } else {
        // $1K–$5K: Extremely aggressive scaling from 67% to 95% (not 100% - that's reserved for $5K+)
        // Use compressed exponential with very high power for extremely fast growth
        // Compress the range to $3K for faster scaling, but cap at 95% until $5K
        const compressedMax = 3000; // Compress from $5K to $3K for faster scaling
        const linear = Math.min(1, (usd - 1000) / (compressedMax - 1000));
        // Compressed exponential: 1 - (1-x)^3.5 gives extremely fast initial growth
        // Scale from 67% to 95% (not 100%)
        const compressed = 1 - Math.pow(1 - linear, 3.5);
        const maxFillBefore5K = 95; // Cap at 95% for orders below $5K
        fill = MID_FILL + (compressed * (maxFillBefore5K - MID_FILL)); // 67% to 95%
        // $1.24K (linear=0.12) → compressed≈0.42 → fill≈79%
        // $1.5K (linear=0.25) → compressed≈0.65 → fill≈85%
        // $2K (linear=0.5) → compressed≈0.87 → fill≈91%
        // $3K+ but <$5K (linear=1.0) → compressed=1.0 → fill=95%
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

  // Get token name for loading screen - try to get from pair if available, otherwise use pool address
  const tokenName = pair?.baseToken?.symbol || pair?.baseToken?.name || poolAddress?.slice(0, 8) || 'Token';

  if (loading || !pair) {
    return (
      <div className="h-screen bg-gray-950 text-gray-200 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-semibold text-white mb-2">Loading</div>
            <div className="text-lg text-gray-400">{tokenName}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 text-gray-200 flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_260px_440px] gap-0 overflow-hidden min-h-0">
          {/* Left: Chart & PnL */}
          <div
            className={`${(activeMobileTab === "overview" || activeMobileTab === "pnl") ? "flex" : "hidden"} flex-1 flex-col min-h-0 overflow-hidden xl:flex xl:overflow-y-auto`}
            style={isMobile ? { paddingBottom: mobileBottomOffset } : undefined}
          >
          <div className={`${activeMobileTab === "overview" ? "flex flex-col" : "hidden"} xl:flex xl:flex-col`}>
              {/* Pair header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950/90">
                <div className="flex items-center gap-3">
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
                    </div>
                    {showTopVolume && (
                      <div className="absolute mt-3 right-4 z-30 w-[720px] bg-gray-950 border border-gray-800 shadow-2xl rounded-md" style={{ maxWidth: 'calc(100vw - 24px)' }}>
                        <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-800">Top 10 by 24h Volume</div>
                        <div className="max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-gray-950 border-b border-gray-800 text-gray-400">
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
                                      className="hover:bg-gray-800/30 cursor-pointer"
                                      onClick={() => {
                                        setShowTopVolume(false);
                                        if (p.poolAddress) {
                                          try { window.location.href = `/explore/${p.poolAddress}/chart`; } catch {}
                                        }
                                      }}
                                    >
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-5 h-5 bg-gray-800 text-[10px] text-gray-300 flex items-center justify-center overflow-hidden">
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
                    <div className="text-xs text-gray-400">{(pair as any)?.dexId || (pair as any)?.dexName || "DEX"} • {poolAddress?.toString().slice(0, 6)}…{poolAddress?.toString().slice(-4)}</div>
                  </div>
                </div>
                {/* Right-side stats from Dexscreener */}
                <div className="hidden lg:flex items-center gap-6">
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
          <div className="flex-shrink-0">
            {/* Controls */}
            <div className="px-4 py-2 bg-gray-950">
              <div className="flex items-center gap-3 justify-between flex-nowrap overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {TIMEFRAME_OPTIONS.map((tf) => {
                    const isActive = timeframe === tf;
                    return (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          isActive
                            ? "text-blue-200 border-blue-500"
                            : "text-gray-300 border-transparent hover:text-white hover:border-gray-600"
                        }`}
                      >
                        {tf.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => chartRef.current?.zoomIn()}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-700 text-gray-300 hover:text-white hover:border-blue-500 transition-colors"
                  >
                    Zoom In
                  </button>
                  <button
                    onClick={() => chartRef.current?.zoomOut()}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-700 text-gray-300 hover:text-white hover:border-blue-500 transition-colors"
                  >
                    Zoom Out
                  </button>
                  <button
                    onClick={() => chartRef.current?.fit()}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-700 text-gray-300 hover:text-white hover:border-blue-500 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
            <LightweightChart ref={chartRef} height={chartHeight} theme="dark" candles={candles} />
          </div>

          {/* OHLC strip */}
          {!isMobile && (
            <div className="w-full px-4 py-2 border-t border-gray-800/50 text-xs text-gray-300 bg-gray-950">
              {candles.length > 0 ? (
                (() => { const c = candles[candles.length-1]; return (
                  <div className="flex gap-4">
                    <div>O <span className="text-gray-200">{c.open.toFixed(6)}</span></div>
                    <div>H <span className="text-gray-200">{c.high.toFixed(6)}</span></div>
                    <div>L <span className="text-gray-200">{c.low.toFixed(6)}</span></div>
                    <div>C <span className="text-gray-200">{c.close.toFixed(6)}</span></div>
                  </div>
                ); })() ) : <span className="text-gray-500">No OHLC data</span>}
            </div>
          )}

          {isMobile && (
            <div className="flex-1 flex flex-col px-4 pt-1 pb-1">
              <div className="flex-1 overflow-hidden flex flex-col -mx-4">
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <table className="w-full text-xs table-fixed">
                    <thead className="bg-gray-950 text-gray-400">
                      <tr>
                        <th className="text-left px-3 py-2 font-normal w-[38%]">USD</th>
                        <th className="text-center px-2 py-2 font-normal w-[36%]">Size ({pair?.baseToken?.symbol || "TOKEN"})</th>
                        <th className="text-center px-3 py-2 font-normal w-[26%]">Time</th>
                      </tr>
                    </thead>
                    <tbody className="text-white">
                      {augmentedTransactions.length === 0 && (
                        <tr>
                          <td className="px-3 py-5 text-center text-gray-500" colSpan={3}>
                            No recent trades
                          </td>
                        </tr>
                      )}
                        {augmentedTransactions.slice(0, 150).map((tx) => (
                        <tr
                          key={`mobile-trade-${tx.hash}-${tx.timestamp}-${tx.tokenAmount}`}
                          className="border-b border-gray-900/40 last:border-b-0"
                        >
                          <td className="px-3 py-2.5 relative overflow-hidden">
                            <motion.div
                              aria-hidden
                              className="absolute left-0 top-0 bottom-0"
                              style={{
                                background: tx.isBuy ? "rgba(34, 197, 94, 0.25)" : "rgba(244, 63, 94, 0.25)",
                                width: tx.fill === 100 ? "100%" : `${tx.fill}%`,
                                zIndex: 0,
                              }}
                              initial={{ width: 0, opacity: 0 }}
                              animate={{
                                width: tx.fill === 100 ? "100%" : `${tx.fill}%`,
                                opacity: 1,
                              }}
                              transition={{
                                duration: 0.6,
                                ease: [0.4, 0, 0.2, 1],
                                opacity: { duration: 0.3 },
                              }}
                            />
                            <span className={`relative z-10 ${tx.isBuy ? "text-green-400" : "text-red-400"}`}>
                              {tx.usdLabel}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center text-white">
                            {tx.tokenAmount > 0 ? (
                              tx.tokenAmount >= 1
                                ? tx.tokenAmount.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                    minimumFractionDigits: 0,
                                  })
                                : tx.tokenAmount.toLocaleString(undefined, {
                                    maximumFractionDigits: 6,
                                    minimumFractionDigits: 0,
                                  })
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-gray-400">
                            <span>{formatTimeAgo(tx.timestamp)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          </div>

          {/* Data sections below chart */}
          <div className={`${activeMobileTab === "pnl" ? "flex-1 min-h-0 flex flex-col" : "hidden"} xl:flex xl:flex-col xl:flex-1 xl:min-h-0`}>
            <div className="w-full px-4 pt-3 pb-2 flex gap-4 text-sm border-b border-gray-800/50">
              <button onClick={() => setActiveDataTab("orders")} className={`pb-2 transition-colors ${activeDataTab==='orders' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-300'}`}>Orders</button>
              <button onClick={() => setActiveDataTab("positions")} className={`pb-2 transition-colors ${activeDataTab==='positions' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-300'}`}>Positions</button>
            </div>
            <div className="px-4 py-4 text-sm text-white bg-gray-950 min-h-[160px] flex-1 min-h-0 overflow-hidden">
              {activeDataTab === 'orders' && (
                <div className="w-full">
                  {ordersLoading ? (
                    <div className="p-6 text-center text-gray-400">
                      <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-sm">Loading orders...</p>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                      <p className="text-sm">No orders available</p>
                    </div>
                  ) : (
                    <div className="w-full -mx-4">
                      <div className="w-full border-b border-gray-700/50 mb-3">
                        <div className="grid grid-cols-5 gap-4 px-4 py-2.5 text-xs text-gray-400">
                          <div>Time</div>
                          <div>Type</div>
                          <div>Amount</div>
                          <div>Price</div>
                          <div>Status</div>
                        </div>
                      </div>
                      <div className={`space-y-0 flex-1 min-h-0 ${desktopScrollable}`}>
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
                <div className="w-full">
                  {positionsLoading ? (
                    <div className="p-6 text-center text-gray-400">
                      <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-sm">Loading positions...</p>
                    </div>
                  ) : positions.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                      <p className="text-sm">No active positions for this token.</p>
                    </div>
                  ) : (
                    <div className="w-full -mx-4">
                      <div className="w-full border-b border-gray-700/50 mb-3">
                        <div className="grid grid-cols-5 gap-4 px-4 py-2.5 text-xs text-gray-400">
                          <div>Token</div>
                          <div>Amount</div>
                          <div>Avg Price</div>
                          <div>Current</div>
                          <div>P&L</div>
                        </div>
                      </div>
                      <div className={`space-y-0 flex-1 min-h-0 ${desktopScrollable}`}>
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
          className={`${activeMobileTab === "trades" ? "flex" : "hidden"} xl:flex flex-col bg-gray-950 border-t border-gray-900/60 xl:border-t-0 xl:border-l xl:border-gray-800 w-full xl:w-[260px] xl:max-w-[260px] overflow-hidden min-h-0 h-full xl:overflow-y-auto`}
          style={isMobile ? { paddingBottom: mobileBottomOffset } : undefined}
        >
          {/* Tab selector */}
          <div className="px-4 pt-3 pb-0 flex gap-2 text-sm border-b border-gray-800/50 h-[70px] items-end">
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
              }}
            >
              <table className="w-full text-xs" style={{ position: 'relative' }}>
                <thead className="text-gray-300 bg-gray-950 border-b border-gray-800 sticky top-0 z-20">
                  <tr>
                    <th className="text-left px-3 py-3 font-normal">USD</th>
                    <th className="text-center px-2 py-3 font-normal">Size ({pair?.baseToken?.symbol || "TOKEN"})</th>
                    <th className="text-center px-3 py-3 font-normal">Time</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {augmentedTransactions.length === 0 && (
                    <tr><td className="px-3 py-6 text-gray-400" colSpan={3}>No recent trades</td></tr>
                  )}
                  {augmentedTransactions.slice(0, 50).map((tx) => (
                    <tr 
                      key={`trade-${tx.hash}-${tx.timestamp}-${tx.tokenAmount}`} 
                      className="border-b border-gray-800/60"
                    >
                      {/* USD Value with improved animated bar - extends full width for large orders */}
                      <td className="px-3 py-2.5 relative" style={{ overflow: tx.fill === 100 ? 'visible' : 'hidden', position: 'relative' }}>
                        <motion.div 
                          aria-hidden 
                          className="absolute left-0 top-0 bottom-0"
                          style={{ 
                            background: tx.isBuy ? 'rgba(34, 197, 94, 0.3)' : 'rgba(244, 63, 94, 0.3)',
                            zIndex: 0,
                            // For orders >= $5k, extend from left of USD cell all the way to right edge of Time cell
                            // This spans the entire row width (all 3 columns)
                            width: tx.fill === 100 
                              ? 'calc(260px)' // Full width of the middle column container (260px)
                              : `${tx.fill}%`
                          }}
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ 
                            width: tx.fill === 100 
                              ? '260px' // Full width - extends past Time column and explorer link
                              : `${tx.fill}%`,
                            opacity: 1 
                          }}
                          transition={{ 
                            duration: 0.6, 
                            ease: [0.4, 0, 0.2, 1],
                            opacity: { duration: 0.3 }
                          }}
                        />
                        <span 
                          className={`relative z-10 ${tx.isBuy ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {tx.usdLabel}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center text-white">
                        {tx.tokenAmount > 0 ? (
                          tx.tokenAmount >= 1 
                            ? tx.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })
                            : tx.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 6, minimumFractionDigits: 0 })
                        ) : '0'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Link
                          href={`/explorer/tx/${tx.hash}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          className="text-white hover:text-gray-300 hover:underline transition-colors"
                          title={tx.hash}
                        >
                          {dayjs(tx.timestamp).format('HH:mm:ss')}
                          <ExternalLinkIcon />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Holders content */}
          {activeMiddleTab === 'holders' && (
            <div
              className="flex-1 overflow-y-auto px-4 py-4 text-sm text-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                paddingBottom: isMobile ? mobileBottomOffset : undefined
              }}
            >
              <div className="text-gray-300">Holders data will appear here.</div>
            </div>
          )}
        </div>

        {/* Right: Swap panel (refined UI) */}
        <aside
          className={`${activeMobileTab === "swap" ? "flex" : "hidden"} xl:flex flex-col bg-gray-950 border-t border-gray-900/60 xl:border-t-0 xl:border-l xl:border-gray-800 w-full xl:min-w-[440px] overflow-hidden ${isMobile ? "" : "xl:overflow-y-auto"}`}
          style={isMobile ? { paddingBottom: mobileBottomOffset } : undefined}
        >
          {/* Token Info Header */}
          <div className="px-4 py-3 pb-4">
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
            {/* Social Links */}
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
          
          {/* Full-width separator - matches left side pattern */}
          <div className="border-t border-gray-800"></div>

          {/* Buy/Sell and Swap Interface */}
          <div className={`px-4 ${isMobile ? "py-2" : "py-3"} flex-1 flex flex-col`}>
            <div className={`flex items-center justify-between ${swapSectionSpacing}`}>
              <div className="w-full bg-gray-900/40 backdrop-blur supports-[backdrop-filter]:bg-gray-900/30 border border-gray-800 flex">
                <button onClick={()=>setIsBuy(true)} className={`flex-1 ${swapButtonHeight} text-sm font-semibold ${isBuy ? 'bg-green-500/20 text-green-300' : 'text-gray-300 hover:text-white hover:bg-gray-800/50'}`}>Buy</button>
                <button onClick={()=>setIsBuy(false)} className={`flex-1 ${swapButtonHeight} text-sm font-semibold ${!isBuy ? 'bg-red-500/20 text-red-300' : 'text-gray-300 hover:text-white hover:bg-gray-800/50'}`}>Sell</button>
              </div>
            </div>
            <div className="text-[10px] text-gray-500 mb-2">Powered by 0x</div>

            {/* You Pay */}
            <div className={`bg-gray-900/50 border border-gray-800 ${swapFieldPadding}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">You Pay</div>
                <div className="flex items-center gap-2 text-[11px] text-gray-300">
                  {isBuy ? (
                    (() => {
                      const quoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
                      // Show appropriate icon for quote token (WETH, USDC, etc.)
                      if (quoteTokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
                        return <img src={'https://assets.coingecko.com/coins/images/2518/small/weth.png'} alt="WETH" className="w-4 h-4 border border-gray-700" />;
                      }
                      // For USDC or other tokens, try to show their icon or use a placeholder
                      return pair?.quoteToken?.symbol === 'USDC' ? (
                        <img src={'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'} alt="USDC" className="w-4 h-4 border border-gray-700" />
                      ) : (
                        <div className="w-4 h-4 border border-gray-700 rounded-full bg-gray-800 flex items-center justify-center text-[8px] text-gray-400">
                          {pair?.quoteToken?.symbol?.[0] || 'Q'}
                        </div>
                      );
                    })()
                  ) : (
                    pair?.info?.imageUrl ? (
                      <img src={pair.info.imageUrl} alt={pair?.baseToken?.symbol || 'Token'} className="w-4 h-4 border border-gray-700" />
                    ) : null
                  )}
                  <span>{isBuy ? (pair?.quoteToken?.symbol || 'WETH') : (pair?.baseToken?.symbol || 'TOKEN')}</span>
                  {walletAddress && (
                    <span className="text-[10px] text-gray-500 ml-1">
                      ({isBuy 
                        ? (() => {
                            const quoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
                            const balance = quoteTokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase() 
                              ? walletEthBalance 
                              : walletQuoteTokenBalance;
                            return balance > 0 ? (balance < 0.0001 ? balance.toFixed(8) : balance.toFixed(4)) : '0.0000';
                          })()
                        : (walletTokenBalance > 0 ? (walletTokenBalance < 0.0001 ? walletTokenBalance.toFixed(8) : walletTokenBalance.toFixed(4)) : '0.0000')
                      })
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1 h-12">
                <input value={payAmount} onChange={(e)=>setPayAmount(e.target.value)} className="bg-transparent text-white text-lg focus:outline-none placeholder-gray-500 w-full" placeholder="0.0" />
              </div>
            </div>

            {/* Quick % below You Pay */}
              <div className="flex gap-2 mt-2 mb-2">
              {['25%','50%','75%','MAX'].map((v, i) => {
                const pct = i < 3 ? (i+1)*25 : 100;
                return (
                  <button key={v} onClick={()=>{
                    const quoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
                    const quoteBalance = quoteTokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()
                      ? walletEthBalance 
                      : walletQuoteTokenBalance;
                    const basis = isBuy ? quoteBalance : walletTokenBalance;
                    if (basis > 0) {
                      const amount = (basis * pct) / 100;
                      setPayAmount(amount.toFixed(6));
                    }
                  }} disabled={!walletAddress || (() => {
                    const quoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
                    const quoteBalance = quoteTokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()
                      ? walletEthBalance 
                      : walletQuoteTokenBalance;
                    return isBuy ? quoteBalance <= 0 : walletTokenBalance <= 0;
                  })()} className={`${quickButtonClass} bg-gray-800/60 text-gray-300 hover:text-white hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed`}>{v}</button>
                );
              })}
            </div>

            {/* Swap arrows */}
            <div className="flex items-center justify-center my-2">
              <button onClick={()=>{ 
                setIsBuy(prev=>!prev); 
                const a = payAmount; 
                setPayAmount(receiveAmount); 
                setReceiveAmount(a);
                // Refresh balances when flipping
                if (walletAddress) {
                  const quoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
                  fetchQuoteTokenBalance(walletAddress, quoteTokenAddress);
                  if (pair?.baseToken?.address) {
                    fetchTokenBalance(walletAddress, pair.baseToken.address);
                  }
                }
              }} className="w-10 h-10 border border-gray-800 bg-gray-900/60 text-gray-300 hover:text-white flex items-center justify-center">
                <SwapArrowsIcon className="w-4 h-4" />
              </button>
            </div>

            {/* You Receive */}
            <div className={`bg-gray-900/50 border border-gray-800 ${swapFieldPadding} ${isMobile ? "mb-2" : "mb-3"}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">You Receive</div>
                <div className="flex items-center gap-2 text-[11px] text-gray-300">
                  {isBuy ? (
                    pair?.info?.imageUrl ? (
                      <img src={pair.info.imageUrl} alt={pair?.baseToken?.symbol || 'Token'} className="w-4 h-4 border border-gray-700" />
                    ) : null
                  ) : (
                    (() => {
                      const quoteTokenAddress = pair?.quoteToken?.address || WETH_ADDRESS;
                      // Show appropriate icon for quote token (WETH, USDC, etc.)
                      if (quoteTokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
                        return <img src={'https://assets.coingecko.com/coins/images/2518/small/weth.png'} alt="WETH" className="w-4 h-4 border border-gray-700" />;
                      }
                      // For USDC or other tokens, try to show their icon or use a placeholder
                      return pair?.quoteToken?.symbol === 'USDC' ? (
                        <img src={'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'} alt="USDC" className="w-4 h-4 border border-gray-700" />
                      ) : (
                        <div className="w-4 h-4 border border-gray-700 rounded-full bg-gray-800 flex items-center justify-center text-[8px] text-gray-400">
                          {pair?.quoteToken?.symbol?.[0] || 'Q'}
                        </div>
                      );
                    })()
                  )}
                  <span>{isBuy ? (pair?.baseToken?.symbol || 'TOKEN') : (pair?.quoteToken?.symbol || 'WETH')}</span>
                </div>
              </div>
              <div className={`flex items-center justify-between mt-1 ${swapButtonHeight} relative`}>
                <input value={receiveAmount || ''} readOnly className="bg-transparent text-white text-lg w-full pr-20" placeholder="Enter amount above" />
                {/* Quote expiration timer inline with amount */}
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

            {/* Action */}
            {walletAddress ? (
              <>
                {swapError && (
                  <div className="mb-2 text-xs text-red-400 text-center">{swapError}</div>
                )}
                <button 
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
                      ? 'bg-green-600/30 hover:bg-green-600/40 active:bg-green-600/40 focus:bg-green-600/40 text-green-400' 
                      : 'bg-red-600/30 hover:bg-red-600/40 active:bg-red-600/40 focus:bg-red-600/40 text-red-400'
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
                    `${isBuy ? 'Buy' : 'Sell'} ${isBuy ? (pair?.baseToken?.symbol || 'TOKEN') : (pair?.quoteToken?.symbol || 'WETH')}`
                  )}
                </button>
              </>
            ) : (
              <button onClick={()=>{ try { (window as any).dispatchEvent(new CustomEvent('open-wallet')); } catch {} }} className="w-full bg-blue-600/90 hover:bg-blue-600 text-white py-3">Connect Wallet</button>
            )}

            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
              <span>Slippage</span>
              <div className="inline-flex border border-gray-800">
                {[0.5,1,2].map(s => (
                  <button key={s} onClick={()=>setSlippage(s)} className={`px-2 py-1 ${slippage===s ? 'bg-blue-500/20 text-blue-300' : 'text-gray-300 hover:bg-blue-500/10 hover:text-blue-200'}`}>{s}%</button>
                ))}
              </div>
            </div>
          </div>

          {!isMobile && (
            <div className="px-4 py-4 border-t border-gray-800 text-xs text-gray-400">
              <div className="flex items-center justify-between mb-2"><span>Liquidity</span><span>{pair?.liquidity?.usd ? `$${pair.liquidity.usd.toLocaleString()}` : '-'}</span></div>
              <div className="flex items-center justify-between mb-2"><span>24h Txns</span><span>{pair?.txns?.h24 ? pair.txns.h24.buys + pair.txns.h24.sells : '-'}</span></div>
            </div>
          )}
        </aside>

        </div>

        <div
          className="xl:hidden fixed inset-x-0 z-50 border-t border-gray-900 bg-gray-950"
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

      {!isMobile && <Footer />}

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
                    router.push(`/explore/${poolAddress}/tx/${swapSuccess.txHash}`);
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
    </div>
  );
}


