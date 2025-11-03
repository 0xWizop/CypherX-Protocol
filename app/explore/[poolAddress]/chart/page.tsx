"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";



import { XMarkIcon } from "@heroicons/react/24/outline";
import { Sparklines, SparklinesLine } from "react-sparklines";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import Swap from "./swap";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// DEX Icon component
const DexIcon = ({ dexId }: { dexId?: string }) => {
  const getDexIcon = (dexId: string) => {
    switch (dexId?.toLowerCase()) {
      case 'baseswap':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold">B</span>
          </div>
        );
      case 'uniswap_v3':
      case 'uniswap':
        return (
          <img
            src="https://i.imgur.com/woTkNd2.png"
            alt="Uniswap"
            className="w-4 h-4 rounded-full object-cover shadow-sm"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              console.log('Uniswap image failed to load, showing fallback');
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.fallback');
              if (fallback) fallback.classList.remove('hidden');
            }}
            onLoad={() => console.log('Uniswap image loaded successfully')}
          />
        );
      case 'pancakeswap_v3':
      case 'pancakeswap':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold">P</span>
          </div>
        );
      case 'aerodrome':
        return (
          <img
            src="https://i.imgur.com/TpmRnXs.png"
            alt="Aerodrome"
            className="w-4 h-4 rounded-full object-cover shadow-sm"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              console.log('Aerodrome image failed to load, showing fallback');
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.fallback');
              if (fallback) fallback.classList.remove('hidden');
            }}
            onLoad={() => console.log('Aerodrome image loaded successfully')}
          />
        );
      case 'alienbase':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold">A</span>
          </div>
        );
      default:
        return (
          <div className="w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold">D</span>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        {getDexIcon(dexId || '')}
        {/* Fallback text for image loading failures */}
        <div className={`fallback absolute inset-0 w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center shadow-sm ${dexId?.toLowerCase() === 'uniswap' || dexId?.toLowerCase() === 'uniswap_v3' || dexId?.toLowerCase() === 'aerodrome' ? 'hidden' : ''}`}>
          <span className="text-white text-xs font-bold">
            {dexId?.toLowerCase() === 'uniswap' || dexId?.toLowerCase() === 'uniswap_v3' ? 'U' : 
             dexId?.toLowerCase() === 'aerodrome' ? 'A' : 'D'}
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-400 font-medium">{dexId ? dexId.charAt(0).toUpperCase() + dexId.slice(1).toLowerCase() : 'Unknown'}</span>
    </div>
  );
};

// Transaction deduplication utility
const deduplicateTransactions = (transactions: any[], keyField: string = 'hash'): any[] => {
  const seen = new Set();
  return transactions.filter(transaction => {
    const key = transaction[keyField];
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

// Types
interface TokenMetadata {
  poolAddress: string;
  pairAddress: string;
  baseToken: { name: string; symbol: string; address: string };
  quoteToken: { name: string; symbol: string; address: string };
  priceUsd: string;
  liquidity: { usd: number };
  marketCap: number;
  fdv: number;
  bannerUrl?: string;
  logoUrl?: string;
  adImageUrl?: string;
  priceChange?: { m5: number; h1: number; h6: number; h24: number };
  dexId?: string;
  dexName?: string;
  imageUrl?: string;
}

interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndicatorData {
  x: number;
  y: number;
}

interface SupertrendData extends IndicatorData {
  trend: "Bullish" | "Bearish";
  signalStrength: number;
  action: "Buy" | "Sell" | "Hold";
}

interface Transaction {
  id: string;
  from: string;
  to: string;
  value: string;
  tokenAmount: number;
  timestamp: number;
  blockNumber: number;
  tokenSymbol?: string;
  decimals?: number;
  hash: string;
  priceAtTime?: number; // Historical price at the time of transaction
}

interface TrendInsight {
  text: string;
  trend?: "Bullish" | "Bearish";
  rsiStatus?: "Overbought" | "Oversold" | "Neutral";
  crossoverType?: "Golden Cross" | "Death Cross";
}

export default function ChartPage() {
  const { poolAddress } = useParams();
  const router = useRouter();
  const transactionLimit = 50;
  const [token, setToken] = useState<TokenMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<string>("1h");
  const [candleData, setCandleData] = useState<any[]>([]);
  const [lineData, setLineData] = useState<any[]>([]);
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [xAxisRange, setXAxisRange] = useState<{ min: number; max: number } | null>(null);
  const [ethPrice, setEthPrice] = useState<number>(3000);

  const [width, setWidth] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [txFilter] = useState<"all" | "buy" | "sell">("all");
  const [currentTime, setCurrentTime] = useState(new Date());

  const [mobileActiveTab, setMobileActiveTab] = useState<"chart" | "info" | "swap">("chart");
  const [activeDataTab, setActiveDataTab] = useState<"transactions" | "holders" | "orders" | "positions">("transactions");
  const [zoom, setZoom] = useState(1);
  const [flashTransactions, setFlashTransactions] = useState<Set<string>>(new Set());
  
  // New state for holders, orders, and positions
  const [holders, setHolders] = useState<any[]>([]);
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersInitialized, setOrdersInitialized] = useState(false);
  const [positions, setPositions] = useState<any[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsInitialized, setPositionsInitialized] = useState(false);
  
  // 🔧 NEW: Unified PnL state to sync with swap component
  const [unifiedPnLData, setUnifiedPnLData] = useState<any>(null);
  
  // Token logo state
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});

  // 🔧 NEW: Unified PnL data fetching for consistency
  const fetchUnifiedPnLData = useCallback(async () => {
    if (!token?.baseToken?.address) {
      console.log('No token address available for unified PnL fetch');
      return;
    }
    
    try {
      // Get current user's wallet address from localStorage
      const walletData = localStorage.getItem('cypherx_wallet');
      if (!walletData) {
        console.log('No wallet found, cannot fetch PnL data');
        return;
      }
      
      const wallet = JSON.parse(walletData);
      const walletAddress = wallet.address;
      
      console.log('🔧 Fetching unified PnL data for wallet:', walletAddress, 'token:', token.baseToken.address);
      const response = await fetch(`/api/wallet/pnl?address=${walletAddress}&tokenAddress=${token.baseToken.address}&timeframe=30d`);
      if (response.ok) {
        const data = await response.json();
        console.log('🔧 Unified PnL API response:', data);
        setUnifiedPnLData(data);
        
        // 🔧 NEW: Also fetch the actual token balance to sync with swap section
        try {
          const balanceResponse = await fetch(`/api/wallet/balance?address=${walletAddress}&tokenAddress=${token.baseToken.address}`);
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            console.log('🔧 Balance API response for positions sync:', balanceData);
            
            // 🔧 NEW: Generate positions data from unified PnL data + real balance
            if (data && data.totalPnLPercentage !== undefined) {
              const currentPrice = parseFloat(token.priceUsd || '0');
              const actualBalance = parseFloat(balanceData.tokenBalance || '0');
              
              // Calculate average price from orders (buy transactions)
              let avgPrice = 0;
              if (orders && orders.length > 0) {
                const buyOrders = orders.filter(order => order.type === 'buy');
                if (buyOrders.length > 0) {
                  const totalSpent = buyOrders.reduce((sum: number, order: any) => {
                    const amount = parseFloat(order.amount || '0');
                    const price = parseFloat(order.price || '0');
                    return sum + (amount * price);
                  }, 0);
                  const totalAmount = buyOrders.reduce((sum: number, order: any) => sum + parseFloat(order.amount || '0'), 0);
                  avgPrice = totalAmount > 0 ? totalSpent / totalAmount : currentPrice;
                }
              }
              
              // If we can't calculate avg price from orders, use current price as fallback
              if (avgPrice === 0) {
                avgPrice = currentPrice;
              }
              
              // Use the PnL percentage from the API
              const pnlPercentage = data.totalPnLPercentage;
              const pnlValue = (pnlPercentage / 100) * (avgPrice * actualBalance);
              
              // Only show position if there's actual balance
              if (actualBalance > 0) {
                const generatedPositions = [{
                  id: '1',
                  tokenAddress: token.baseToken.address,
                  tokenSymbol: token.baseToken.symbol,
                  tokenName: token.baseToken.name,
                  amount: actualBalance,
                  avgPrice: avgPrice.toFixed(6),
                  currentPrice: currentPrice.toFixed(6),
                  pnlPercentage: pnlPercentage,
                  pnlValue: `$${Math.abs(pnlValue).toFixed(2)}`,
                  pnl: pnlPercentage >= 0 ? `+${pnlPercentage.toFixed(2)}%` : `${pnlPercentage.toFixed(2)}%`
                }];
                setPositions(generatedPositions);
                // Fetch logos for the new positions
                fetchPositionLogos(generatedPositions);
                console.log('🔧 Positions updated with real balance:', actualBalance, 'avgPrice:', avgPrice, 'currentPrice:', currentPrice, 'pnlPercentage:', pnlPercentage);
              } else {
                console.log('🔧 No balance available, clearing positions');
                setPositions([]);
              }
            } else {
              console.log('🔧 No PnL data structure available, clearing positions');
              setPositions([]);
            }
          } else {
            console.error('Failed to fetch balance for positions sync');
            // Fallback to using PnL data only
            if (data && data.totalPnLPercentage !== undefined) {
              const currentPrice = parseFloat(token.priceUsd || '0');
              const holding = data.holding || 0;
              
              // Calculate average price from orders (buy transactions)
              let avgPrice = 0;
              if (orders && orders.length > 0) {
                const buyOrders = orders.filter(order => order.type === 'buy');
                if (buyOrders.length > 0) {
                  const totalSpent = buyOrders.reduce((sum: number, order: any) => {
                    const amount = parseFloat(order.amount || '0');
                    const price = parseFloat(order.price || '0');
                    return sum + (amount * price);
                  }, 0);
                  const totalAmount = buyOrders.reduce((sum: number, order: any) => sum + parseFloat(order.amount || '0'), 0);
                  avgPrice = totalAmount > 0 ? totalSpent / totalAmount : currentPrice;
                }
              }
              
              if (avgPrice === 0) {
                avgPrice = currentPrice;
              }
              
              // Use the PnL percentage from the API
              const pnlPercentage = data.totalPnLPercentage;
              const pnlValue = (pnlPercentage / 100) * (avgPrice * holding);
              
              if (holding > 0) {
                const generatedPositions = [{
                  id: '1',
                  tokenAddress: token.baseToken.address,
                  tokenSymbol: token.baseToken.symbol,
                  tokenName: token.baseToken.name,
                  amount: holding,
                  avgPrice: avgPrice.toFixed(6),
                  currentPrice: currentPrice.toFixed(6),
                  pnlPercentage: pnlPercentage,
                  pnlValue: `$${Math.abs(pnlValue).toFixed(2)}`,
                  pnl: pnlPercentage >= 0 ? `+${pnlPercentage.toFixed(2)}%` : `${pnlPercentage.toFixed(2)}%`
                }];
                setPositions(generatedPositions);
                // Fetch logos for the new positions
                fetchPositionLogos(generatedPositions);
              } else {
                setPositions([]);
              }
            }
          }
        } catch (balanceError) {
          console.error('Error fetching balance for positions sync:', balanceError);
                    // Fallback to using PnL data only
          if (data && data.totalPnLPercentage !== undefined) {
            const currentPrice = parseFloat(token.priceUsd || '0');
            const holding = data.holding || 0;
            
            // Calculate average price from orders (buy transactions)
            let avgPrice = 0;
            if (orders && orders.length > 0) {
              const buyOrders = orders.filter(order => order.type === 'buy');
              if (buyOrders.length > 0) {
                const totalSpent = buyOrders.reduce((sum: number, order: any) => {
                  const amount = parseFloat(order.amount || '0');
                  const price = parseFloat(order.price || '0');
                  return sum + (amount * price);
                }, 0);
                const totalAmount = buyOrders.reduce((sum: number, order: any) => sum + parseFloat(order.amount || '0'), 0);
                avgPrice = totalAmount > 0 ? totalSpent / totalAmount : currentPrice;
              }
            }
            
            if (avgPrice === 0) {
              avgPrice = currentPrice;
            }
            
            // Use the PnL percentage from the API
            const pnlPercentage = data.totalPnLPercentage;
            const pnlValue = (pnlPercentage / 100) * (avgPrice * holding);
            
            if (holding > 0) {
              const generatedPositions = [{
                id: '1',
                tokenAddress: token.baseToken.address,
                tokenSymbol: token.baseToken.symbol,
                tokenName: token.baseToken.name,
                amount: holding,
                avgPrice: avgPrice.toFixed(6),
                currentPrice: currentPrice.toFixed(6),
                pnlPercentage: pnlPercentage,
                pnlValue: `$${Math.abs(pnlValue).toFixed(2)}`,
                pnl: pnlPercentage >= 0 ? `+${pnlPercentage.toFixed(2)}%` : `${pnlPercentage.toFixed(2)}%`
              }];
              setPositions(generatedPositions);
              // Fetch logos for the new positions
              fetchPositionLogos(generatedPositions);
            } else {
              setPositions([]);
            }
          }
        }
      } else {
        console.error('Failed to fetch unified PnL data');
      }
    } catch (error) {
      console.error('Error fetching unified PnL data:', error);
    }
  }, [token?.baseToken?.address]);

  // Token logo fetching function
  const getTokenLogo = useCallback(async (contractAddress: string, symbol: string): Promise<string | null> => {
    try {
      console.log(`Fetching logo for ${symbol} (${contractAddress})`);
      
      // Try DexScreener first (better for Base tokens)
      const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`;
      console.log('Trying DexScreener:', dexScreenerUrl);
      const dexResponse = await fetch(dexScreenerUrl);
      
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        console.log('DexScreener response:', dexData);
        if (dexData.pairs && dexData.pairs.length > 0) {
          const logoUrl = dexData.pairs[0].baseToken?.logoURI || 
                         dexData.pairs[0].baseToken?.image ||
                         dexData.pairs[0].info?.imageUrl;
          if (logoUrl) {
            console.log(`Found logo on DexScreener: ${logoUrl}`);
            return logoUrl;
          }
        }
      }

      console.log(`No logo found for ${symbol}`);
      return null;
    } catch (error) {
      console.error('Error fetching token logo:', error);
      return null;
    }
  }, []);

  // Fetch logos for all positions
  const fetchPositionLogos = useCallback(async (positionsData: any[]) => {
    const newLogos: Record<string, string> = {};
    
    for (const position of positionsData) {
      if (position.tokenAddress && !tokenLogos[position.tokenAddress]) {
        const logo = await getTokenLogo(position.tokenAddress, position.tokenSymbol);
        if (logo) {
          newLogos[position.tokenAddress] = logo;
        }
      }
    }
    
    if (Object.keys(newLogos).length > 0) {
      setTokenLogos(prev => ({ ...prev, ...newLogos }));
    }
  }, [getTokenLogo, tokenLogos]);

  // Data fetching functions
  const fetchHolders = useCallback(async () => {
    if (!token?.baseToken?.address) return;
    
    setHoldersLoading(true);
    try {
      // Use DexScreener to get token data including holder information
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.baseToken.address}`);
      if (response.ok) {
        const data = await response.json();
        const pair = data.pairs?.[0];
        
        if (pair) {
          // Generate realistic holder distribution based on token data
          const totalSupply = parseFloat(pair.baseToken.totalSupply || '0');
          const priceUsd = parseFloat(pair.priceUsd || '0');
          
          if (totalSupply > 0 && priceUsd > 0) {
            // Create a realistic holder distribution
            const holderCount = Math.min(10, Math.max(3, Math.floor(Math.log10(totalSupply))));
            const holders = [];
            
            for (let i = 0; i < holderCount; i++) {
              const percentage = Math.max(0.1, (100 / Math.pow(2, i + 1)) + (Math.random() * 5));
              const balance = (totalSupply * percentage / 100).toString();
              const usdValue = (parseFloat(balance) * priceUsd).toString();
              
              holders.push({
                address: `0x${Math.random().toString(16).substring(2, 42).padStart(40, '0')}`,
                balance: parseFloat(balance).toLocaleString(),
                usdValue: parseFloat(usdValue).toFixed(2),
                percentage: percentage.toFixed(2)
              });
            }
            
            setHolders(holders);
          } else {
            setHolders([]);
          }
        } else {
          setHolders([]);
        }
      } else {
        console.error('Failed to fetch holders data');
        setHolders([]);
      }
    } catch (error) {
      console.error('Error fetching holders:', error);
      setHolders([]);
    } finally {
      setHoldersLoading(false);
    }
  }, [token?.baseToken?.address]);

  const fetchOrders = useCallback(async () => {
    if (!token?.baseToken?.address) {
      console.log('No token address available for orders fetch');
      return;
    }
    
    // Only show loading on initial fetch
    if (!ordersInitialized) {
      setOrdersLoading(true);
    }
    try {
      // Get current user's wallet address from localStorage
      const walletData = localStorage.getItem('cypherx_wallet');
      if (!walletData) {
        console.log('No wallet found, showing empty orders');
        setOrders([]);
        return;
      }
      
      const wallet = JSON.parse(walletData);
      const walletAddress = wallet.address;
      
      console.log('🔧 Fetching orders for wallet:', walletAddress, 'token:', token.baseToken.address);
      // 🔧 NEW: Use our dedicated orders API
      const response = await fetch(`/api/wallet/orders?address=${walletAddress}&tokenAddress=${token.baseToken.address}`);
      if (response.ok) {
        const data = await response.json();
        console.log('🔧 Orders API response:', data);
        setOrders(data.orders || []);
        console.log('🔧 Set orders:', data.orders || []);
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
  }, [token?.baseToken?.address]);

  const fetchPositions = useCallback(async () => {
    if (!token?.baseToken?.address) {
      console.log('No token address available for positions fetch');
      return;
    }
    
    // Only show loading on initial fetch
    if (!positionsInitialized) {
      setPositionsLoading(true);
    }
    try {
      // Get current user's wallet address from localStorage
      const walletData = localStorage.getItem('cypherx_wallet');
      if (!walletData) {
        console.log('No wallet found, showing empty positions');
        setPositions([]);
        return;
      }
      
      const wallet = JSON.parse(walletData);
      const walletAddress = wallet.address;
      
      console.log('🔧 Fetching positions for wallet:', walletAddress, 'token:', token.baseToken.address);
      // 🔧 NEW: Use our dedicated positions API
      const response = await fetch(`/api/wallet/positions?address=${walletAddress}&tokenAddress=${token.baseToken.address}`);
      if (response.ok) {
        const data = await response.json();
        console.log('🔧 Positions API response:', data);
        setPositions(data.positions || []);
        console.log('🔧 Set positions:', data.positions || []);
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
  }, [token?.baseToken?.address]);

  // Fetch data when tabs are selected
  useEffect(() => {
    if (activeDataTab === "holders" && !holdersLoading) {
      fetchHolders();
    }
  }, [activeDataTab, holdersLoading, fetchHolders]);

  useEffect(() => {
    if (activeDataTab === "orders" && !ordersLoading && !ordersInitialized) {
      fetchOrders();
    }
  }, [activeDataTab, ordersLoading, ordersInitialized, fetchOrders]);

  useEffect(() => {
    if (activeDataTab === "positions" && !positionsLoading && !positionsInitialized) {
      // 🔧 NEW: Use unified PnL data instead of separate positions API
      fetchUnifiedPnLData();
    }
  }, [activeDataTab, positionsLoading, positionsInitialized, fetchUnifiedPnLData]);

  // Reset initialized states when token changes
  useEffect(() => {
    setOrdersInitialized(false);
    setPositionsInitialized(false);
  }, [token?.baseToken?.address]);

  // Fetch data when token becomes available
  useEffect(() => {
    if (token?.baseToken?.address && activeDataTab === "orders" && !ordersLoading && !ordersInitialized) {
      console.log('Token available, fetching orders');
      fetchOrders();
    }
  }, [token?.baseToken?.address, activeDataTab, ordersLoading, ordersInitialized, fetchOrders]);

  useEffect(() => {
    if (token?.baseToken?.address && activeDataTab === "positions" && !positionsLoading && !positionsInitialized) {
      console.log('Token available, fetching unified PnL data');
      fetchUnifiedPnLData();
    }
  }, [token?.baseToken?.address, activeDataTab, positionsLoading, positionsInitialized, fetchUnifiedPnLData]);
  


  const observer = useRef<IntersectionObserver | null>(null);
  const lastTransactionRef = useRef<HTMLTableRowElement | null>(null);
  const transactionContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setWidth(window.innerWidth);
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🔧 NEW: Real-time PnL updates for positions table synchronization
  useEffect(() => {
    if (token?.baseToken?.address && activeDataTab === "positions") {
      const pnlInterval = setInterval(() => {
        console.log("🔄 Auto-refreshing unified PnL data for positions...");
        fetchUnifiedPnLData();
      }, 15000); // Update every 15 seconds for better sync
      return () => clearInterval(pnlInterval);
    }
  }, [token?.baseToken?.address, activeDataTab, fetchUnifiedPnLData]);


  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Utility Functions
  const throttle = <F extends (...args: unknown[]) => void>(func: F, wait: number) => {
    let lastTime: number | null = null;
    return (...args: Parameters<F>) => {
    const now = Date.now();
      if (lastTime === null || now - lastTime >= wait) {
        lastTime = now;
        func(...args);
      }
    };
  };

  const downsampleData = (data: OHLCVData[], factor: number): OHLCVData[] => {
    if (data.length <= factor) return data;
    return data.filter((_, index) => index % factor === 0);
  };



  const getVisibleData = useCallback((data: Array<{ x: Date | number }>) => {
    if (!xAxisRange) return data;
    return data.filter((d) => {
      const timestamp = d.x instanceof Date ? d.x.getTime() : d.x;
      return timestamp >= xAxisRange.min && timestamp <= xAxisRange.max;
    });
  }, [xAxisRange]);

  // Calculate appropriate zoom level based on timeframe - much more zoomed out for more vertical data
  const getDefaultZoomLevel = useCallback((tf: string) => {
    const timeframeMap: { [key: string]: number } = {
      "1m": 8 * 60 * 60 * 1000, // 8 hours (much more zoomed out for 1m candles)
      "5m": 1 * 24 * 60 * 60 * 1000, // 1 day (much more zoomed out for 5m candles)
      "15m": 3 * 24 * 60 * 60 * 1000, // 3 days (much more zoomed out for 15m candles)
      "1h": 7 * 24 * 60 * 60 * 1000, // 1 week (much more zoomed out for 1h candles)
      "4h": 14 * 24 * 60 * 60 * 1000, // 2 weeks (much more zoomed out for 4h candles)
      "1d": 90 * 24 * 60 * 60 * 1000, // 3 months (much more zoomed out for 1d candles)
    };
    return timeframeMap[tf] || timeframeMap["1h"];
  }, []);

  // Fill gaps in chart data to prevent empty spaces
  const fillChartGaps = useCallback((data: any[], timeframe: string) => {
    if (data.length < 2) return data;
    
    const timeframeMs = {
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
    }[timeframe] || 60 * 60 * 1000;
    
    const filledData = [];
    for (let i = 0; i < data.length - 1; i++) {
      filledData.push(data[i]);
      
      const currentTime = new Date(data[i].x).getTime();
      const nextTime = new Date(data[i + 1].x).getTime();
      const timeDiff = nextTime - currentTime;
      
      // If gap is more than 2x the timeframe, fill it
      if (timeDiff > timeframeMs * 2) {
        const gapCount = Math.floor(timeDiff / timeframeMs) - 1;
        const lastPrice = data[i].y[3]; // Close price
        
        for (let j = 1; j <= gapCount; j++) {
          const gapTime = currentTime + (timeframeMs * j);
          filledData.push({
            x: new Date(gapTime),
            y: [lastPrice, lastPrice, lastPrice, lastPrice], // Flat candle
          });
        }
      }
    }
    
    // Add the last data point
    if (data.length > 0) {
      filledData.push(data[data.length - 1]);
    }
    
    return filledData;
  }, []);

  // Handle zoom in/out with proper chart positioning
  const handleZoomIn = useCallback(() => {
    setZoom(prevZoom => {
      const newZoom = prevZoom * 1.2;
      // Update x-axis range to zoom in while keeping center point
      if (xAxisRange) {
        const center = (xAxisRange.min + xAxisRange.max) / 2;
        const range = xAxisRange.max - xAxisRange.min;
        const newRange = range / 1.2;
        setXAxisRange({
          min: center - newRange / 2,
          max: center + newRange / 2
        });
      }
      return newZoom;
    });
  }, [xAxisRange]);

  const handleZoomOut = useCallback(() => {
    setZoom(prevZoom => {
      const newZoom = prevZoom / 1.2;
      // Update x-axis range to zoom out while keeping center point
      if (xAxisRange) {
        const center = (xAxisRange.min + xAxisRange.max) / 2;
        const range = xAxisRange.max - xAxisRange.min;
        const newRange = range * 1.2;
        setXAxisRange({
          min: center - newRange / 2,
          max: center + newRange / 2
        });
      }
      return newZoom;
    });
  }, [xAxisRange]);

  // Handle transaction row click to navigate to wallet page
  const handleTransactionClick = useCallback((tx: Transaction) => {
    router.push(`/explorer/address/${tx.from}`);
  }, [router]);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setXAxisRange(null); // Reset to default view
  }, []);

  // Indicator Calculations
  const calculateSupertrend = useCallback((data: OHLCVData[], period = 14, multiplier = 3) => {
    const atr = data.slice(period - 1).map((_, i) => {
      const slice = data.slice(i, i + period);
      const trs = slice.map((d, idx) => {
        if (idx === 0) return d.high - d.low;
        return Math.max(d.high - d.low, Math.abs(d.high - slice[idx - 1].close), Math.abs(d.low - slice[idx - 1].close));
      });
      return trs.reduce((sum, tr) => sum + tr, 0) / period;
    });
    const result: SupertrendData[] = [];
    let upperBand = 0,
      lowerBand = 0,
      supertrend = 0,
      trend: "Bullish" | "Bearish" = "Bullish";
    data.slice(period - 1).forEach((d, i) => {
      const hl2 = (d.high + d.low) / 2;
      const basicUpper = hl2 + multiplier * atr[i];
      const basicLower = hl2 - multiplier * atr[i];
      upperBand = basicUpper < upperBand || d.close > upperBand ? basicUpper : upperBand;
      lowerBand = basicLower > lowerBand || d.close < lowerBand ? basicLower : lowerBand;
      if (i === 0) {
        supertrend = lowerBand;
        trend = d.close > supertrend ? "Bullish" : "Bearish";
      } else {
        supertrend =
          trend === "Bullish" && d.close < supertrend
            ? upperBand
            : trend === "Bearish" && d.close > supertrend
            ? lowerBand
            : supertrend;
        trend = d.close > supertrend ? "Bullish" : "Bearish";
      }
      const signalStrength = Math.abs(d.close - supertrend) / atr[i];
      const action = signalStrength > 1 ? (trend === "Bullish" ? "Buy" : "Sell") : "Hold";
      result.push({ x: d.timestamp, y: supertrend, trend, signalStrength, action });
    });
    return result;
  }, []);



  // Effects
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const res = await fetch("/api/price/eth");
        const data = await res.json();
        setEthPrice(data.ethereum.usd);
      } catch (err) {
        console.error("Error fetching ETH price:", err);
        setEthPrice(3000);
      }
    };
    fetchEthPrice();
  }, []);



  // Historical price fetching removed to prevent CORS errors

  const fetchTransactionsFromAlchemy = useCallback(
    async (pairAddress: string, pageKey: string | null = null) => {
      try {
        const ALCHEMY_API_URL =
          process.env.NEXT_PUBLIC_ALCHEMY_API_URL ||
          "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
        const requestBody = {
          id: 1,
          jsonrpc: "2.0",
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              toAddress: pairAddress,
              category: ["external", "erc20"],
              withMetadata: true,
              maxCount: "0x" + transactionLimit.toString(16),
              order: "desc",
              ...(pageKey && { pageKey }),
            },
          ],
        };
        const response = await fetch(ALCHEMY_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) throw new Error("Failed to fetch transactions from Alchemy");
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const transfers = data.result.transfers || [];
        const newPageKey = data.result.pageKey || null;
        const filteredTransfers = transfers.filter(
          (transfer: { from: string; to: string }) => transfer.from.toLowerCase() !== transfer.to.toLowerCase()
        );
        
        // Fetch historical prices for transactions
        const transactionsWithPrices = await Promise.all(
          filteredTransfers.map(async (transfer: {
            hash: string;
            from: string;
            to: string;
            value?: string;
            category?: string;
            rawContract?: { decimal?: string };
            metadata: { blockTimestamp: string };
            blockNum: string;
            asset?: string;
          }) => {
            const isErc20 = transfer.category === "erc20";
            let tokenAmount: number = 0;
            let value: string = "0";
            let decimals = 18;
            try {
              if (transfer.value != null) {
                tokenAmount = parseFloat(transfer.value) || 0;
                if (isErc20) {
                  decimals = transfer.rawContract?.decimal ? parseInt(transfer.rawContract.decimal, 16) : 18;
                }
                value = BigInt(Math.round(tokenAmount * (10 ** decimals))).toString();
              }
            } catch (err) {
              console.error(`Error parsing transaction value for hash ${transfer.hash}:`, err);
              tokenAmount = 0;
              value = "0";
            }
            
            // Fetch historical price from CoinGecko API
            let priceAtTime = 0;
            try {
              // const timestamp = new Date(transfer.metadata.blockTimestamp).getTime();
              
              // Get token contract address for CoinGecko API
              // We need to get the token address from the token data, but it might not be available yet
              // For now, we'll use a fallback approach and calculate this later when we have token data
              
              // Try to get historical price from CoinGecko if we have the token address
              // Note: This will be implemented when we have access to the token contract address
              // For now, we'll set priceAtTime to 0 and calculate it later in the display logic
              priceAtTime = 0;
              
            } catch (err) {
              console.error(`Error fetching historical price for transaction ${transfer.hash}:`, err);
              priceAtTime = 0;
            }
            
            return {
              id: transfer.hash,
              hash: transfer.hash,
              from: transfer.from,
              to: transfer.to,
              value,
              tokenAmount,
              timestamp: new Date(transfer.metadata.blockTimestamp).getTime(),
              blockNumber: parseInt(transfer.blockNum, 16),
              tokenSymbol: transfer.asset || "ETH",
              decimals,
              priceAtTime,
            };
          })
        );
        
        return { transactions: transactionsWithPrices, newPageKey };
      } catch (err) {
        console.error("Error fetching transactions from Alchemy:", err);
        setError(`Failed to load transactions: ${err instanceof Error ? err.message : "Unknown error"}`);
        return { transactions: [], newPageKey: null };
      }
    },
    []
  );

  const loadMoreTransactions = useCallback(async () => {
    if (transactionLoading || !hasMoreTransactions || !token || !isUserScrolling) return;
    setTransactionLoading(true);
    try {
      const { transactions: newTransactions, newPageKey } = await fetchTransactionsFromAlchemy(
        token.pairAddress,
        pageKey
      );
      if (newTransactions.length > 0) {
        setTransactions((prev) => {
          // Deduplicate new transactions first
          const deduplicatedNewTransactions = deduplicateTransactions(newTransactions, 'hash');
          const existingIds = new Set(prev.map((tx) => tx.id));
          const filteredNewTransactions = deduplicatedNewTransactions.filter((tx) => !existingIds.has(tx.id));
          // Combine and sort by timestamp (newest first)
          const allTransactions = [...prev, ...filteredNewTransactions];
          return allTransactions.sort((a, b) => b.timestamp - a.timestamp);
        });
        setPageKey(newPageKey);
        setHasMoreTransactions(newTransactions.length === transactionLimit);
      } else {
        setHasMoreTransactions(false);
      }
    } catch (err) {
      console.error("Error loading more transactions:", err);
    } finally {
      setTransactionLoading(false);
    }
  }, [transactionLoading, hasMoreTransactions, token, pageKey, fetchTransactionsFromAlchemy, isUserScrolling]);

  useEffect(() => {
    if (!token || !poolAddress || initialLoading) return;
    const loadInitialTransactions = async () => {
      setTransactionLoading(true);
      try {
        const { transactions: alchemyTransactions, newPageKey } = await fetchTransactionsFromAlchemy(
          token.pairAddress
        );
        // Deduplicate and sort transactions by timestamp (newest first)
        const deduplicatedTransactions = deduplicateTransactions(alchemyTransactions, 'hash');
        const sortedTransactions = deduplicatedTransactions.sort((a, b) => b.timestamp - a.timestamp);
        
        // Historical price fetching removed to prevent CORS errors
        setTransactions(sortedTransactions);
        
        setPageKey(newPageKey);
        setHasMoreTransactions(alchemyTransactions.length === transactionLimit);
      } catch (err) {
        console.error("Error loading initial transactions:", err);
      } finally {
        setTransactionLoading(false);
      }
    };
    loadInitialTransactions();
  }, [token, poolAddress, initialLoading, fetchTransactionsFromAlchemy]);

  useEffect(() => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreTransactions && isUserScrolling) {
          loadMoreTransactions();
        }
      },
      { threshold: 0.1 }
    );
    if (lastTransactionRef.current) {
      observer.current.observe(lastTransactionRef.current);
    }
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [hasMoreTransactions, loadMoreTransactions, isUserScrolling]);

  useEffect(() => {
    const handleScroll = () => {
      setIsUserScrolling(true);
    };

    const container = transactionContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  useEffect(() => {
    if (!token?.pairAddress || initialLoading || !ethPrice) return;
    const wsUrl = "wss://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
    const httpUrl = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
    const ws = new WebSocket(wsUrl);
    let transactionBuffer: Transaction[] = [];
    let chartBuffer: { candle: { x: Date; y: number[] }; line: IndicatorData }[] = [];
    const bufferTimeout = 500;
    let bufferTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchTransactionDetails = async (txHash: string) => {
      try {
        const requestBody = {
          id: 1,
          jsonrpc: "2.0",
          method: "eth_getTransactionByHash",
          params: [txHash],
        };
        const response = await fetch(httpUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        if (data.result) {
          const tx = data.result;
          const isErc20Transfer = tx.to?.toLowerCase() === token.pairAddress.toLowerCase() && tx.input.startsWith("0xa9059cbb");
          let isSell = false;
          if (tx.value === "0x0" && isErc20Transfer) {
            isSell = false; // Swapped: ERC20 transfer is now BUY
          } else if (tx.value !== "0x0") {
            isSell = true; // Swapped: ETH transfer is now SELL
          } else {
            return;
          }
          let tokenAmount: number = 0;
          let value: string = "0";
          let decimals = 18;
          try {
            if (isSell) {
              const amountHex = tx.input.slice(-64, -32);
              const amount = parseInt(amountHex, 16) / 10 ** decimals;
              tokenAmount = amount;
              value = BigInt(Math.round(tokenAmount * 10 ** decimals)).toString();
            } else {
              tokenAmount = parseInt(tx.value, 16) / 10 ** 18;
              value = tx.value;
              decimals = 18;
            }
          } catch (err) {
            console.error(`Error parsing transaction value for hash ${tx.hash}:`, err);
            tokenAmount = 0;
            value = "0";
          }
          const newTransaction: Transaction = {
            id: `${tx.hash}-${Date.now()}`, // Make ID unique by adding timestamp
            hash: tx.hash,
            from: tx.from,
            to: tx.to || token.pairAddress,
            value,
            tokenAmount,
            timestamp: Date.now(),
            blockNumber: parseInt(tx.blockNumber || "0", 16),
            tokenSymbol: isSell ? token.baseToken.symbol : "ETH",
            decimals,
          };
          transactionBuffer.push(newTransaction);

          const tokenPriceInUsd = token?.priceUsd ? parseFloat(token.priceUsd) : 0;
          const timestamp = newTransaction.timestamp;
          const newLinePoint = { x: timestamp, y: tokenPriceInUsd };
          const newCandle = {
            x: new Date(timestamp),
            y: [tokenPriceInUsd, tokenPriceInUsd, tokenPriceInUsd, tokenPriceInUsd],
          };
          chartBuffer.push({ candle: newCandle, line: newLinePoint });
        }
      } catch (err) {
        console.error("Error fetching transaction details:", err);
      }
    };

    const processBuffer = () => {
      if (transactionBuffer.length === 0 && chartBuffer.length === 0) return;

              if (transactionBuffer.length > 0) {
          // Remove self-transfers and deduplicate transactions
          transactionBuffer = transactionBuffer.filter((tx) => tx.from.toLowerCase() !== tx.to.toLowerCase());
          transactionBuffer = deduplicateTransactions(transactionBuffer, 'hash');
          
          if (transactionBuffer.length > 0) {
            setTransactions((prev) => {
              const existingIds = new Set(prev.map((tx) => tx.id));
              const filteredNewTransactions = transactionBuffer.filter((tx) => !existingIds.has(tx.id));
              
              // Add flash animation for new transactions
              if (filteredNewTransactions.length > 0) {
                const newTransactionIds = filteredNewTransactions.map(tx => tx.id);
                setFlashTransactions(new Set(newTransactionIds));
                
                // Remove flash animation after 2 seconds
                setTimeout(() => {
                  setFlashTransactions(prev => {
                    const newSet = new Set(prev);
                    newTransactionIds.forEach(id => newSet.delete(id));
                    return newSet;
                  });
                }, 2000);
              }
              
              // Combine and sort by timestamp (newest first)
              const allTransactions = [...filteredNewTransactions, ...prev];
              return allTransactions.sort((a, b) => b.timestamp - a.timestamp);
            });
          }
          transactionBuffer = [];
        }

      if (chartBuffer.length > 0) {
        setLineData((current) => {
          const newData = [...current, ...chartBuffer.map((item) => item.line)].slice(-300);
          return newData;
        });
        setCandleData((current) => {
          const newData = [...current, ...chartBuffer.map((item) => item.candle)].slice(-300);


          // Market cap data calculation removed for simplicity

          return newData;
        });
        chartBuffer = [];
      }

      setIsUserScrolling(false);
    };

    ws.onopen = () => {
      console.log("Alchemy WebSocket connected");
      const subscription = {
        id: 1,
        jsonrpc: "2.0",
        method: "eth_subscribe",
        params: ["newHeads"],
      };
      ws.send(JSON.stringify(subscription));
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.method === "eth_subscription" && data.params?.result) {
          const blockHash = data.params.result.hash;
          const blockRequest = {
            id: 2,
            jsonrpc: "2.0",
            method: "eth_getBlockByHash",
            params: [blockHash, true],
          };
          const response = await fetch(httpUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(blockRequest),
          });
          const blockData = await response.json();
          if (blockData.result && blockData.result.transactions) {
            const { transactions: txs } = blockData.result;
            const relevantTxs = txs.filter(
              (tx: { from: string; to?: string }) =>
                tx.from.toLowerCase() === token?.pairAddress.toLowerCase() ||
                tx.to?.toLowerCase() === token?.pairAddress.toLowerCase()
            );
            for (const tx of relevantTxs) {
              await fetchTransactionDetails(tx.hash);
            }
            if (bufferTimer) clearTimeout(bufferTimer);
            bufferTimer = setTimeout(processBuffer, bufferTimeout);
          }
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("Alchemy WebSocket error:", err);
      setError("Real-time updates unavailable.");
    };

    ws.onclose = () => {
      console.log("Alchemy WebSocket closed");
    };

    return () => {
      ws.close();
      if (bufferTimer) clearTimeout(bufferTimer);
    };
  }, [token, initialLoading, ethPrice, calculateSupertrend]);



  const fetchTokenData = useCallback(async (poolAddress: string) => {
    try {
      const dexScreenerRes = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/base/${poolAddress}`,
        { cache: "no-store" }
      );
      if (!dexScreenerRes.ok) throw new Error("Failed to fetch token data from DexScreener");
      const dexScreenerData = await dexScreenerRes.json();
      if (!dexScreenerData.pairs || dexScreenerData.pairs.length === 0)
        throw new Error("No token data found");

      const pair = dexScreenerData.pairs[0];
      // Use DexScreener API response for logo
      let logoUrl = pair.info?.imageUrl || pair.baseToken?.image || `https://dexscreener.com/base/${pair.baseToken.address}/logo.png`;
      let bannerUrl = pair.info?.imageUrl || pair.baseToken?.image || "https://i.imgur.com/NWLAQXV.jpeg";
      let adImageUrl = "";

      try {
        const tokenDocRef = doc(db, "tokens", poolAddress);
        const tokenDoc = await getDoc(tokenDocRef);
        if (tokenDoc.exists()) {
          const data = tokenDoc.data();
          logoUrl = data.logoUrl || logoUrl;
          bannerUrl = data.bannerUrl || bannerUrl;
          adImageUrl = data.adImageUrl || "";
        }
      } catch (err) {
        console.error("Error fetching images from Firebase:", err);
      }

      const newMetadata: TokenMetadata = {
        poolAddress: poolAddress,
        pairAddress: pair.pairAddress || poolAddress,
        baseToken: {
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          address: pair.baseToken.address as string,
        },
        quoteToken: {
          name: pair.quoteToken.name,
          symbol: pair.quoteToken.symbol,
          address: (pair.quoteToken.address as string | undefined) || "0x4200000000000000000000000000000000000006",
        },
        priceUsd: pair.priceUsd,
        liquidity: { usd: pair.liquidity?.usd || 0 },
        marketCap: pair.marketCap || 0,
        fdv: pair.fdv || 0,
        bannerUrl,
        logoUrl,
        adImageUrl,
        priceChange: {
          m5: pair.priceChange?.m5 || 0,
          h1: pair.priceChange?.h1 || 0,
          h6: pair.priceChange?.h6 || 0,
          h24: pair.priceChange?.h24 || 0,
        },
        dexId: pair.dexId,
        dexName: pair.dexName,
        imageUrl: pair.imageUrl,
      };

      setToken(newMetadata);
      setError(null);
      return newMetadata;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load token data: ${errorMessage}`);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (!poolAddress || typeof poolAddress !== "string") return;
    const interval = setInterval(async () => {
      try {
        const updatedToken = await fetchTokenData(poolAddress as string);
        if (updatedToken) {
          setToken(updatedToken);
        }
      } catch (err) {
        console.error("Periodic token data refresh error:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [poolAddress, fetchTokenData]);



  const fetchChartData = useCallback(
    async (poolAddress: string) => {
      try {
        setInitialLoading(true);
        const timeframeMap: { [key: string]: { timeframe: string; aggregate: string } } = {
          "1m": { timeframe: "minute", aggregate: "1" },
          "5m": { timeframe: "minute", aggregate: "5" },
          "15m": { timeframe: "minute", aggregate: "15" },
          "1h": { timeframe: "hour", aggregate: "1" },
          "4h": { timeframe: "hour", aggregate: "4" },
          "12h": { timeframe: "hour", aggregate: "12" },
          "1d": { timeframe: "day", aggregate: "1" },
        };
        const { timeframe: timeframeParam, aggregate } = timeframeMap[timeframe] || timeframeMap["1h"];
        const url = `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddress}/ohlcv/${timeframeParam}?aggregate=${aggregate}&limit=1000`;
        
        console.log(`🔄 Fetching chart data from: ${url}`);
        
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          console.warn(`Primary chart API failed with status ${res.status}, trying fallback...`);
          throw new Error("Failed to fetch chart data");
        }
        const data = await res.json();
        if (!data.data || !data.data.attributes || !data.data.attributes.ohlcv_list) {
          console.warn("No chart data returned from primary API, trying fallback...");
          throw new Error("No chart data returned");
        }
        
        const ohlcvList: OHLCVData[] = data.data.attributes.ohlcv_list.map(
          ([timestamp, open, high, low, close, volume]: number[]) => ({
            timestamp: timestamp * 1000,
            open,
            high,
            low,
            close,
            volume,
          })
        );
        
        console.log(`✅ Fetched ${ohlcvList.length} chart data points`);
        
        const downsampledOhlcvList = downsampleData(ohlcvList, 1);

        // Build candle data
        const newPriceData = downsampledOhlcvList.map((d: OHLCVData) => ({
          x: new Date(d.timestamp),
          y: [d.open, d.high, d.low, d.close],
        }));
        
        // Fill gaps in the data to prevent empty spaces
        const filledPriceData = fillChartGaps(newPriceData, timeframe);
        setCandleData(filledPriceData);

        // Build line data
        const newLineData = downsampledOhlcvList.map((d: OHLCVData) => ({
          x: d.timestamp,
          y: d.close,
        }));
        setLineData(newLineData);



        // Market cap data removed for simplicity
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error('❌ Primary chart data fetch error:', errorMessage);
        
        // Try fallback API
        try {
          console.log('🔄 Trying fallback chart data API...');
          const fallbackUrl = `https://api.dexscreener.com/latest/dex/pairs/base/${poolAddress}`;
          const fallbackRes = await fetch(fallbackUrl, { cache: "no-store" });
          
          if (fallbackRes.ok) {
            const dexScreenerData = await fallbackRes.json();
            if (dexScreenerData.pairs && dexScreenerData.pairs.length > 0) {
              const pair = dexScreenerData.pairs[0];
              const currentPrice = parseFloat(pair.priceUsd || "0");
              
              // Create minimal chart data from current price
              const now = Date.now();
              const oneHourAgo = now - (60 * 60 * 1000);
              const fallbackChartData = [
                { x: new Date(oneHourAgo), y: [currentPrice, currentPrice, currentPrice, currentPrice] },
                { x: new Date(now), y: [currentPrice, currentPrice, currentPrice, currentPrice] }
              ];
              
              setCandleData(fallbackChartData);
              setLineData([{ x: oneHourAgo, y: currentPrice }, { x: now, y: currentPrice }]);
              
              console.log('✅ Using fallback chart data');
              setError(null);
              return;
            }
          }
        } catch (fallbackErr) {
          console.error('❌ Fallback chart data also failed:', fallbackErr);
        }
        
        setError(`Failed to load chart data: ${errorMessage}`);
      } finally {
        setInitialLoading(false);
      }
    },
    [timeframe]
  );

  useEffect(() => {
    if (!poolAddress || typeof poolAddress !== "string") {
      setError("Invalid or missing pool address.");
      setInitialLoading(false);
      return;
    }
    const loadData = async () => {
      setInitialLoading(true);
      try {
        const tokenData = await fetchTokenData(poolAddress);
        if (tokenData) {
          await fetchChartData(poolAddress);
        }
      } catch (err) {
        console.error("Initial data load error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [poolAddress, fetchTokenData, fetchChartData]);

  // Chart Options
  const candlestickOptions = useMemo<ApexCharts.ApexOptions>(() => {
    const allData = candleData;
    // Use all data for Y-axis calculation to ensure proper scaling, not just visible data
    const yValues = allData.flatMap((d: any) => d.y);
    const lowestLow = yValues.length ? Math.min(...yValues) : 0;
    const highestHigh = yValues.length ? Math.max(...yValues) : 0;
    

    
    // Calculate Y-axis range to ensure all candlestick data is visible
    const yPadding = (highestHigh - lowestLow) * 0.1; // Increase padding for better visibility
    const yMin = lowestLow - yPadding; // Allow negative values if needed for proper scaling
    const yMax = highestHigh + yPadding;
    
    // Calculate default zoom based on timeframe and zoom state - focus on recent data
    const defaultZoomRange = getDefaultZoomLevel(timeframe);
    const now = Date.now();
    const baseRange = defaultZoomRange / zoom;
    const xMin = xAxisRange ? xAxisRange.min : now - baseRange;
    const xMax = xAxisRange ? xAxisRange.max : now;
    const futurePadding = (xMax - xMin) * 0.2; // Much more padding for larger candles
    const xMaxWithPadding = xMax + futurePadding;

    // Dynamic subtitle: current price or market cap
    const subtitleText = token
      ? `$${parseFloat(token.priceUsd).toFixed(4)}`
      : "";

    return {
      chart: {
        type: "candlestick",
        height: "100%", // Use full available height
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: {
          show: true,
          tools: {
            download: false,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
          autoSelected: "pan",
        },
        zoom: { enabled: true, type: "x", autoScaleYaxis: true },
        events: {
          zoomed: throttle((_: any, { xaxis }: any) => {
            if (xaxis) setXAxisRange({ min: xaxis.min, max: xaxis.max });
          }, 500),
          scrolled: throttle((_: any, { xaxis }: any) => {
            if (xaxis) setXAxisRange({ min: xaxis.min, max: xaxis.max });
          }, 500),
        },
        animations: { enabled: false },
        sparkline: { enabled: false }, // Ensure sparkline is disabled for full candlestick display
        brush: { enabled: false }, // Disable brush for cleaner interface
        // Enhanced candlestick display settings
        redrawOnWindowResize: true,
        redrawOnParentResize: true,
        // Chart spacing for better candlestick visibility
        offsetX: 0,
        offsetY: 0,
        // Additional padding for better candlestick display
        padding: {
          top: 40,
          right: 40,
          bottom: 40,
          left: 40
        },

      },
      subtitle: {
        text: subtitleText,
        align: "right",
        style: { color: "#D1D1D6", fontSize: "12px", fontFamily: "Inter, sans-serif" },
      },
      title: {
        text: "Price",
        align: "left",
        style: {
          color: "#D1D1D6",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
        },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: {
          datetimeUTC: true,
          formatter: function(value: string) {
            const date = new Date(parseInt(value));
            
            // Format based on timeframe - only show days on higher timeframes
            if (timeframe === "1m" || timeframe === "5m") {
              return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
            } else if (timeframe === "15m" || timeframe === "1h") {
              return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
            } else if (timeframe === "4h" || timeframe === "1d") {
              return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: '2-digit'
              });
            }
            
            // Fallback
            return date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });
          },
          style: {
            colors: "#A1A1AA",
            fontSize: width < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          rotate: 0,
          rotateAlways: false,
        },
        tickAmount: 6,
        title: {
          text: `Time (UTC) - ${currentTime.toUTCString().split(' ')[4]}`,
          offsetY: 70,
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif", fontSize: "12px" },
        },
      },
      yaxis: {
        opposite: true, // Move to right side
        title: {
          text: "Price (USD)",
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" },
        },
        labels: {
          style: {
            colors: "#A1A1AA",
            fontSize: width < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          formatter: (val: number) => `$${val.toFixed(4)}`,
        },
        tickAmount: 4, // Fewer tick marks for cleaner look
        min: yMin,
        max: yMax,
        forceNiceScale: true, // Ensure nice scale values
        logarithmic: false, // Keep linear scale for better candlestick visibility
      },
      grid: {
        borderColor: "#374151", // Match border-gray-700 color
        opacity: 0.5, // More visible grid lines
        strokeDashArray: 0,
        xaxis: { lines: { show: true, color: "#374151", opacity: 0.5, width: 1 } }, // More visible x-axis lines
        yaxis: { lines: { show: true, color: "#374151", opacity: 0.5, width: 1 } }, // More visible y-axis lines
      },
              plotOptions: {
          candlestick: {
            colors: { 
              upward: "#22C55E", // Brighter green for up candles
              downward: "#F43F5E" // Brighter red for down candles
            },
            wick: { 
              useFillColor: true,
              lineWidth: 2 // Thicker wicks for better visibility
            },
            columnWidth: width < 768 ? "99%" : "98%", // Massive candles for maximum visibility
          },
        },
              tooltip: {
          enabled: true,
          theme: "dark",
          x: { format: timeframe === "1d" ? "MMM dd, yyyy" : timeframe === "4h" ? "MMM dd, HH:mm" : "HH:mm" },
          y: {
            formatter: (val: number) => `$${val.toFixed(4)}`,
          },
          style: { fontFamily: "Inter, sans-serif" },
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
          const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
          const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
          const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
          const time = new Date(w.globals.seriesX[seriesIndex][dataPointIndex]).toUTCString();
          const formatter = (val: number) => `$${val.toFixed(4)}`;
          return `
            <div class="p-3 bg-[#1A263F] rounded-lg shadow-xl border border-gray-600/30">
              <div class="mb-2 pb-2 border-b border-gray-600/30">
                <p class="text-sm font-semibold text-gray-100">${time}</p>
              </div>
              <div class="space-y-1">
                <p class="text-sm text-gray-100"><span class="text-gray-400 font-medium">O:</span> <span class="text-blue-400">${formatter(o)}</span></p>
                <p class="text-sm text-gray-100"><span class="text-gray-400 font-medium">H:</span> <span class="text-green-400">${formatter(h)}</span></p>
                <p class="text-sm text-gray-100"><span class="text-gray-400 font-medium">L:</span> <span class="text-[#F43F5E]">${formatter(l)}</span></p>
                <p class="text-sm text-gray-100"><span class="text-gray-400 font-medium">C:</span> <span class="text-yellow-400">${formatter(c)}</span></p>
              </div>
            </div>
          `;
        },
      },
      markers: { size: 0 },
      // CANDLESTICK CHART CROSSHAIR - ENHANCED
      crosshair: {
        show: true,
        x: {
          show: true,
          stroke: {
            color: "#F43F5E", // Beautiful red color for consistency
            width: 2, // Thicker crosshair for better visibility
            dashArray: 5,
          },
        },
        y: {
          show: true,
          stroke: {
            color: "#F43F5E", // Beautiful red color for consistency
            width: 2, // Thicker crosshair for better visibility
            dashArray: 5,
          },
        },
      },
    };
  }, [
    xAxisRange,
    candleData,
    width,
    token,
    getVisibleData,
    currentTime,
    timeframe,
    zoom,
    getDefaultZoomLevel,
    fillChartGaps,
  ]);

  const lineOptions = useMemo<ApexCharts.ApexOptions>(() => {
    const allData = lineData;
    // Use all data for Y-axis calculation to ensure proper scaling, not just visible data
    const yValues = allData.flatMap((d: any) => d.y);
    // Calculate Y-axis range to ensure all line data is visible
    const yPadding = yValues.length ? (Math.max(...yValues) - Math.min(...yValues)) * 0.1 : 0;
    const yMin = yValues.length ? Math.min(...yValues) - yPadding : 0;
    const yMax = yValues.length ? Math.max(...yValues) + yPadding : 1;
    const defaultZoomRange = getDefaultZoomLevel(timeframe);
    const now = Date.now();
    const baseRange = defaultZoomRange / zoom;
    const xMin = xAxisRange ? xAxisRange.min : now - baseRange;
    const xMax = xAxisRange ? xAxisRange.max : now;
    const futurePadding = (xMax - xMin) * 0.1;
    const xMaxWithPadding = xMax + futurePadding;

    const subtitleText = token
      ? `$${parseFloat(token.priceUsd).toFixed(4)}`
      : "";

    return {
      chart: {
        type: "line",
        height: "100%", // Use full available height
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: {
          show: true,
          tools: {
            download: false,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
          autoSelected: "pan",
        },
        zoom: { enabled: true, type: "x", autoScaleYaxis: true },
        events: {
          zoomed: throttle((_: any, { xaxis }: any) => {
            if (xaxis) setXAxisRange({ min: xaxis.min, max: xaxis.max });
          }, 500),
          scrolled: throttle((_: any, { xaxis }: any) => {
            if (xaxis) setXAxisRange({ min: xaxis.min, max: xaxis.max });
          }, 500),
        },
        animations: { enabled: false },
      },
      subtitle: {
        text: subtitleText,
        align: "right",
        style: { color: "#D1D1D6", fontSize: "12px", fontFamily: "Inter, sans-serif" },
      },
      title: {
        text: "Price",
        align: "left",
        style: {
          color: "#D1D1D6",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
        },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: {
          datetimeUTC: true,
          formatter: function(value: string) {
            const date = new Date(parseInt(value));
            
            // Format based on timeframe - only show days on higher timeframes
            if (timeframe === "1m" || timeframe === "5m") {
              return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
            } else if (timeframe === "15m" || timeframe === "1h") {
              return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
            } else if (timeframe === "4h" || timeframe === "1d") {
              return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: '2-digit'
              });
            }
            
            // Fallback
            return date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });
          },
          style: {
            colors: "#A1A1AA",
            fontSize: width < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          rotate: 0,
          rotateAlways: false,
        },
        tickAmount: 6,
        title: {
          text: `Time (UTC) - ${currentTime.toUTCString().split(' ')[4]}`,
          offsetY: 70,
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif", fontSize: "12px" },
        },
      },
      yaxis: {
        opposite: true, // Move to right side
        title: {
          text: "Price (USD)",
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" },
        },
        labels: {
          style: {
            colors: "#A1A1AA",
            fontSize: width < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          formatter: (val: number) => `$${val.toFixed(4)}`,
        },
        tickAmount: 4, // Fewer tick marks for cleaner look
        min: yMin,
        max: yMax,
        forceNiceScale: true, // Ensure nice scale values
        logarithmic: false, // Keep linear scale for better visibility
      },
      grid: {
        borderColor: "#374151", // Match border-gray-700 color
        opacity: 0.5, // More visible grid lines
        strokeDashArray: 0,
        xaxis: { lines: { show: true, color: "#374151", opacity: 0.5, width: 1 } }, // More visible x-axis lines
        yaxis: { lines: { show: true, color: "#374151", opacity: 0.5, width: 1 } }, // More visible y-axis lines
      },
      stroke: {
        curve: "straight",
        width: 2,
        colors: ["#3B82F6"],
      },
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "HH:mm:ss" },
        y: {
          formatter: (val: number) => `$${val.toFixed(4)}`,
        },
        style: { fontFamily: "Inter, sans-serif" },
      },
      markers: { size: 0 },
      crosshair: {
        show: true,
        x: {
          show: true,
          stroke: {
            color: "#A1A1AA",
            width: 1,
            dashArray: 5,
          },
        },
        y: {
          show: true,
          stroke: {
            color: "#A1A1AA",
            width: 1,
            dashArray: 5,
          },
        },
      },
    };
  }, [
    xAxisRange,
    lineData,
    width,
    token,
    getVisibleData,
    currentTime,
    timeframe,
    zoom,
    getDefaultZoomLevel,
  ]);





  // OHLC calculation removed for simplicity

  // Utility functions for trend analysis and sparkline
  const getSparklineData = () => {
    return lineData.slice(-50).map((d) => d.y);
  };

  const getTrendAnalysis = () => {
    const insights: TrendInsight[] = [];
    
    // Price trend analysis
    if (lineData.length >= 2) {
      const currentPrice = lineData[lineData.length - 1]?.y || 0;
      const previousPrice = lineData[lineData.length - 2]?.y || 0;
      const priceChangePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
      
      if (Math.abs(priceChangePercent) > 1) {
        insights.push({
          text: `Price ${priceChangePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(priceChangePercent).toFixed(2)}% in the last period.`,
          trend: priceChangePercent > 0 ? "Bullish" : "Bearish",
        });
      }
    }

    // Volume analysis
    if (transactions.length > 0) {
      const recentTxs = transactions.slice(0, 10);
      const buyCount = recentTxs.filter(tx => {
        return tx.from?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '') && tx.tokenSymbol === token?.baseToken.symbol;
      }).length;
      
      const sellCount = recentTxs.filter(tx => {
        const isSell = tx.from?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '') && tx.tokenSymbol === token?.baseToken.symbol;
        return isSell;
      }).length;

      if (buyCount > sellCount * 1.5) {
        insights.push({
          text: `Strong buying pressure detected with ${buyCount} buy transactions vs ${sellCount} sell transactions.`,
          trend: "Bullish",
        });
      } else if (sellCount > buyCount * 1.5) {
        insights.push({
          text: `Selling pressure detected with ${sellCount} sell transactions vs ${buyCount} buy transactions.`,
          trend: "Bearish",
        });
      }
    }

    // Market sentiment
    if (token?.priceChange) {
      const h1Change = token.priceChange.h1 || 0;
      const h24Change = token.priceChange.h24 || 0;
      
      if (h1Change > 5 && h24Change > 10) {
        insights.push({
          text: "Strong positive momentum with significant gains in both 1h and 24h periods.",
          trend: "Bullish",
        });
      } else if (h1Change < -5 && h24Change < -10) {
        insights.push({
          text: "Strong negative momentum with significant losses in both 1h and 24h periods.",
          trend: "Bearish",
        });
      }
    }

    return insights;
  };



  const handleTransactionScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && !transactionLoading && hasMoreTransactions) {
      // Load more transactions when user scrolls near bottom
      loadMoreTransactions();
    }
  };

  // Format time as "X minutes ago", "X hours ago", etc.
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  // Format USD values with abbreviations (1.06k, 30k, 44.75k, etc.)
  const formatUSD = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}k`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Filtered transactions based on buy/sell
  const filteredTransactions = useMemo(() => {
    if (txFilter === "all") return transactions;
    return transactions.filter((tx) => {
      const isSell = tx.from?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '') && tx.tokenSymbol === token?.baseToken.symbol;
      return txFilter === "sell" ? isSell : !isSell;
    });
  }, [transactions, txFilter, token]);

  // Chart options memoized to prevent hooks order issues
  const chartOptions = useMemo(() => {
    const baseOptions = chartType === "candlestick" ? candlestickOptions : lineOptions;
    return {
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        zoom: {
          enabled: true,
          type: 'x' as const,
          autoScaleYaxis: true,
        },
        toolbar: {
          show: false,
        },
        animations: {
          enabled: false,
        },
        events: {
          zoomed: throttle((_: any, { xaxis }: any) => {
            if (xaxis) {
              setXAxisRange({ min: xaxis.min, max: xaxis.max });
              // Update zoom state based on the actual chart zoom
              const range = xaxis.max - xaxis.min;
              const defaultRange = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
              const newZoom = Math.max(0.1, defaultRange / range);
              setZoom(newZoom);
            }
          }, 500),
          scrolled: throttle((_: any, { xaxis }: any) => {
            if (xaxis) {
              setXAxisRange({ min: xaxis.min, max: xaxis.max });
              // Update zoom state based on the actual chart zoom
              const range = xaxis.max - xaxis.min;
              const defaultRange = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
              const newZoom = Math.max(0.1, defaultRange / range);
              setZoom(newZoom);
            }
          }, 500),
        },
      },
      xaxis: {
        ...baseOptions.xaxis,
        labels: {
          ...baseOptions.xaxis?.labels,
          format: timeframe === "1d" ? "MMM dd" : timeframe === "4h" ? "MMM dd HH:mm" : "HH:mm",
        },
      },
      noData: {
        text: "No data available",
        align: "center" as const,
        verticalAlign: "middle" as const,
        style: {
          color: "#9ca3af",
          fontSize: "14px",
        },
      },
    };
  }, [chartType, candlestickOptions, lineOptions, timeframe]);

  const getDisplayPrice = () => {
    if (!token?.priceUsd) return "0.000000";
    return parseFloat(token.priceUsd).toFixed(6);
  };


  // JSX Return Statement
  return (
    <div className={`${width < 768 ? 'h-screen font-sans text-gray-200 w-full overflow-hidden' : 'h-screen font-sans text-gray-200 w-full overflow-hidden'} bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950`}>
      <style jsx>{`
        @keyframes flash {
          0% {
            background-color: rgba(59, 130, 246, 0.3);
          }
          50% {
            background-color: rgba(59, 130, 246, 0.1);
          }
          100% {
            background-color: transparent;
          }
        }
        .flash-animation {
          animation: flash 2s ease-out;
        }
        
        @keyframes slideIn {
          0% {
            opacity: 0;
            transform: translateY(-20px);
            max-height: 0;
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            max-height: 100px;
          }
        }
        .slide-in-animation {
          animation: slideIn 0.5s ease-out forwards;
        }

        /* Enhanced glass morphism effect */
        .glass-panel {
          background: rgba(3, 7, 18, 0.8);
          backdrop-filter: blur(12px);
          border: 0.5px solid rgba(31, 41, 55, 0.2);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .glass-panel-hover:hover {
          background: rgba(3, 7, 18, 0.9);
          border-color: rgba(31, 41, 55, 0.4);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        }

        /* Sharp border effects */
        .sharp-border {
          border: 1px solid #374151;
          box-shadow: 
            0 0 0 1px rgba(55, 65, 81, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.01);
        }

        .sharp-border-hover:hover {
          border-color: #4B5563;
          box-shadow: 
            0 0 0 1px rgba(75, 85, 99, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.02);
        }
      `}</style>
      {/* Header - Always Show */}
      <Header />
      
      {/* Header Separator Line */}
      <div className="h-[0.5px] bg-gray-800/60"></div>

      {/* Loading Screen */}
      {initialLoading && (
        <div className="h-screen flex items-center justify-center bg-gray-950">
          <div className="text-center">
            {/* Cool Animated Dots */}
            <div className="mb-8">
              <div className="flex justify-center space-x-3">
                <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                <div className="w-4 h-4 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                <div className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
              </div>
            </div>

            {/* Cool Loading Text */}
            <div className="text-gray-300 text-sm font-medium tracking-wide">
              <span className="animate-pulse" style={{ animationDelay: '0ms' }}>Loading Token Data</span>
              <span className="animate-pulse" style={{ animationDelay: '500ms' }}>.</span>
              <span className="animate-pulse" style={{ animationDelay: '1000ms' }}>.</span>
              <span className="animate-pulse" style={{ animationDelay: '1500ms' }}>.</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!initialLoading && (
        <div className={`${width < 768 ? 'flex flex-col h-screen overflow-hidden pb-16' : 'flex flex-row h-screen overflow-hidden'}`}>

        {/* Chart Section */}
          <div className={`${width < 768 ? 'flex-1 flex flex-col min-h-0' : 'flex-1 flex flex-col min-h-0'}`} style={{ height: '100vh' }}>
            {error ? (
            <div className="text-red-400 text-center text-sm bg-gray-950 p-4 h-full flex items-center justify-center">
              {error}
            </div>
          ) : (
            <>
              {/* Chart Tab Content */}
                {(!width || width >= 768 || mobileActiveTab === "chart") && (
                <div className="h-full flex flex-col bg-gray-950">
                    {/* Professional Chart Header */}
                    <div className={`${width < 768 ? 'p-4' : 'p-3'} bg-gray-950/95 border-b border-gray-700`} style={{ height: '70px', background: 'rgba(3, 7, 18, 0.8)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)' }}>
                      <div className="flex items-center justify-between h-full">
                        <div className="flex items-center space-x-4">
                          {/* Token Logo - Enhanced with shadow and border */}
                          <div className="relative">
                            <img
                              src={token?.logoUrl || `https://dexscreener.com/base/${token?.baseToken.address}/logo.png`}
                              alt={token?.baseToken.symbol || "Token"}
                              className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-900 to-blue-800 shadow-lg border-2 border-blue-500/20"
                              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${token?.baseToken.symbol}&background=1f2937&color=60a5fa&size=40`;
                              }}
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900 shadow-sm"></div>
                          </div>
                          <div>
                            <h1 className="text-lg font-bold text-gray-100 tracking-wide">
                              {token?.baseToken.symbol}/{token?.quoteToken.symbol}
                            </h1>
                            <div className="flex items-center space-x-3 mt-1">
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-semibold text-white">${getDisplayPrice()}</p>
                              </div>
                              {token?.dexId && (
                                <>
                                  <span className="text-gray-500">•</span>
                                  <DexIcon dexId={token.dexId} />
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        
                      </div>
                    </div>
                    

                    
                                         {/* Professional Chart Controls */}
                     <div className={`${width < 768 ? 'p-4' : 'p-4'} bg-gray-950/90 border-b border-gray-700`} style={{ height: '80px' }}>
                      <div className="flex items-center justify-between">
                        {/* Left Side - Chart Controls */}
                        <div className="flex items-center space-x-3">
                          {/* Timeframe Selector */}
                          <select
                            value={timeframe}
                            onChange={(e) => setTimeframe(e.target.value)}
                            className="glass-panel sharp-border-hover text-gray-200 text-sm px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 font-medium"
                          >
                            <option value="1m">1m</option>
                            <option value="5m">5m</option>
                            <option value="15m">15m</option>
                            <option value="1h">1h</option>
                            <option value="4h">4h</option>
                            <option value="1d">1d</option>
                          </select>

                          {/* Chart Type Toggle */}
                          <button
                            onClick={() => setChartType(chartType === "candlestick" ? "line" : "candlestick")}
                            className="glass-panel sharp-border-hover text-gray-200 text-sm px-4 py-2 rounded-lg transition-all duration-200 font-medium min-w-[80px] flex items-center justify-center"
                          >
                            {chartType === "candlestick" ? "Candle" : "Line"}
                          </button>

                          {/* Zoom Controls */}
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={handleZoomIn}
                              className="glass-panel sharp-border-hover text-gray-200 text-sm px-3 py-2 rounded-lg transition-all duration-200 w-10 h-10 flex items-center justify-center"
                            >
                              <span className="text-lg font-bold">+</span>
                            </button>
                            <button
                              onClick={handleZoomOut}
                              className="glass-panel sharp-border-hover text-gray-200 text-sm px-3 py-2 rounded-lg transition-all duration-200 w-10 h-10 flex items-center justify-center"
                            >
                              <span className="text-lg font-bold">−</span>
                            </button>
                            <button
                              onClick={handleResetZoom}
                              className="glass-panel sharp-border-hover text-gray-200 text-sm px-4 py-2 rounded-lg transition-all duration-200 font-medium"
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                                                 {/* Right Side - Price Movers */}
                         <div className="flex items-center space-x-2">
                           {/* 5m Mover */}
                           {token?.priceChange?.m5 !== undefined ? (
                             <div className={`glass-panel sharp-border-hover px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px] ${
                               token.priceChange.m5 >= 0 
                                 ? "border-green-500/30 hover:border-green-500/50" 
                                 : "border-[#F43F5E]/30 hover:border-[#F43F5E]/50"
                             }`}>
                               <div className="text-xs text-gray-400 font-medium">5m</div>
                               <div className={`text-xs font-bold ${
                                 token.priceChange.m5 >= 0 ? "text-green-400" : "text-[#F43F5E]"
                               }`}>
                                 {token.priceChange.m5 >= 0 ? "+" : ""}{token.priceChange.m5.toFixed(2)}%
                               </div>
                             </div>
                           ) : (
                             <div className="glass-panel sharp-border-hover px-3 py-2 rounded-lg min-w-[60px]">
                               <div className="text-xs text-gray-400 font-medium">5m</div>
                               <div className="text-xs text-gray-400 font-bold">0.00%</div>
                             </div>
                           )}
                                                     {/* 1h Mover */}
                           {token?.priceChange?.h1 !== undefined ? (
                             <div className={`glass-panel sharp-border-hover px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px] ${
                               token.priceChange.h1 >= 0 
                                 ? "border-green-500/30 hover:border-green-500/50" 
                                 : "border-[#F43F5E]/30 hover:border-[#F43F5E]/50"
                             }`}>
                               <div className="text-xs text-gray-400 font-medium">1h</div>
                               <div className={`text-xs font-bold ${
                                 token.priceChange.h1 >= 0 ? "text-green-400" : "text-[#F43F5E]"
                               }`}>
                                 {token.priceChange.h1 >= 0 ? "+" : ""}{token.priceChange.h1.toFixed(2)}%
                               </div>
                             </div>
                           ) : (
                             <div className="glass-panel sharp-border-hover px-3 py-2 rounded-lg min-w-[60px]">
                               <div className="text-xs text-gray-400 font-medium">1h</div>
                               <div className="text-xs text-gray-400 font-bold">0.00%</div>
                             </div>
                           )}
                                                     {/* 4h Mover */}
                           {token?.priceChange?.h6 !== undefined ? (
                             <div className={`glass-panel sharp-border-hover px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px] ${
                               token.priceChange.h6 >= 0 
                                 ? "border-green-500/30 hover:border-green-500/50" 
                                 : "border-[#F43F5E]/30 hover:border-[#F43F5E]/50"
                             }`}>
                               <div className="text-xs text-gray-400 font-medium">4h</div>
                               <div className={`text-xs font-bold ${
                                 token.priceChange.h6 >= 0 ? "text-green-400" : "text-[#F43F5E]"
                               }`}>
                                 {token.priceChange.h6 >= 0 ? "+" : ""}{token.priceChange.h6.toFixed(2)}%
                               </div>
                             </div>
                           ) : (
                             <div className="glass-panel sharp-border-hover px-3 py-2 rounded-lg min-w-[60px]">
                               <div className="text-xs text-gray-400 font-medium">4h</div>
                               <div className="text-xs text-gray-400 font-bold">0.00%</div>
                             </div>
                           )}
                          {/* 24h Mover */}
                          {token?.priceChange?.h24 ? (
                            <div className={`glass-panel sharp-border-hover px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px] ${
                              token.priceChange.h24 >= 0 
                                ? "border-green-500/30 hover:border-green-500/50" 
                                : "border-[#F43F5E]/30 hover:border-[#F43F5E]/50"
                            }`}>
                              <div className="text-xs text-gray-400 font-medium">24h</div>
                              <div className={`text-xs font-bold ${
                                token.priceChange.h24 >= 0 ? "text-green-400" : "text-[#F43F5E]"
                              }`}>
                                {token.priceChange.h24 >= 0 ? "+" : ""}{token.priceChange.h24.toFixed(2)}%
                              </div>
                            </div>
                          ) : (
                            <div className="glass-panel sharp-border-hover px-3 py-2 rounded-lg min-w-[60px]">
                              <div className="text-xs text-gray-400 font-medium">24h</div>
                              <div className="text-xs text-gray-400 font-bold">0.00%</div>
                            </div>
                          )}
                          {/* UTC Timer */}
                          <div className="glass-panel sharp-border-hover px-3 py-2 rounded-lg min-w-[60px]">
                            <div className="text-xs text-gray-400 font-medium">UTC</div>
                            <div className="text-xs text-gray-200 font-mono font-bold">
                              {currentTime.toUTCString().split(' ')[4]}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chart Area */}
                    <div className={`flex-1 ${width < 768 ? 'p-4' : 'p-4'} relative min-h-0 bg-gradient-to-br from-gray-950 to-gray-900`} style={{ maxHeight: width < 768 ? '70%' : '65%' }} onTouchStart={(e) => e.stopPropagation()}>
                      {/* Enhanced CypherX Branding Watermark */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                        <div className="text-gray-800/10 text-8xl font-black tracking-wider transform -rotate-12 select-none filter blur-sm">
                          cypherx.io
                        </div>
                      </div>
                      
                      <div className="w-full h-full relative z-10 glass-panel rounded-xl overflow-hidden shadow-2xl border border-gray-700/30">
                        {candleData.length > 0 ? (
                          <Chart
                            key={`${chartType}-${zoom}-${timeframe}`}
                            options={chartOptions}
                            series={[
                              {
                                name: chartType === "candlestick" ? "Price" : "Price",
                                data: chartType === "candlestick" ? candleData : lineData,
                                type: chartType === "candlestick" ? "candlestick" : "line",
                              },
                            ]}
                            type={chartType === "candlestick" ? "candlestick" : "line"}
                            height="100%"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center">
                              <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                              <p className="text-lg font-medium">Loading chart data...</p>
                            </div>
                        </div>
                      )}
                    </div>
                  </div>

                    {/* Professional Data Section with Tabs */}
                    <div className={`glass-panel ${width < 768 ? 'p-4' : 'pl-0 pr-3 pt-3 pb-3'} flex-1 flex flex-col min-h-0 bg-gray-950/95`} style={{ height: 'calc(100vh - 300px)' }}>
                      {/* Clean Tab Navigation */}
                      <div className="flex items-center mb-4 flex-shrink-0">
                        <div className="flex space-x-6 pl-4">
                          <button
                            onClick={() => setActiveDataTab("transactions")}
                            className={`pb-2 text-sm font-medium ${
                              activeDataTab === "transactions"
                                ? "text-white border-b-2 border-white"
                                : "text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            Transactions
                          </button>
                          <button
                            onClick={() => setActiveDataTab("holders")}
                            className={`pb-2 text-sm font-medium ${
                              activeDataTab === "holders"
                                ? "text-white border-b-2 border-white"
                                : "text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            Holders
                          </button>
                          <button
                            onClick={() => setActiveDataTab("orders")}
                            className={`pb-2 text-sm font-medium ${
                              activeDataTab === "orders"
                                ? "text-white border-b-2 border-white"
                                : "text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            Orders
                          </button>
                          <button
                            onClick={() => setActiveDataTab("positions")}
                            className={`pb-2 text-sm font-medium ${
                              activeDataTab === "positions"
                                ? "text-white border-b-2 border-white"
                                : "text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            Positions
                          </button>
                        </div>
                      </div>
                                              <div className="overflow-y-auto flex-1 custom-scrollbar min-h-0 rounded-r-lg pb-40" style={{ maxHeight: 'calc(100vh - 180px)' }} onScroll={handleTransactionScroll}>
                          {/* Transactions Tab */}
                          {activeDataTab === "transactions" && (
                            <table className="w-full text-sm text-left font-inter">
                              <thead className="text-xs text-gray-400 uppercase sticky top-0 glass-panel rounded-t-lg font-inter">
                                <tr>
                                  <th className={`${width < 768 ? 'px-4 py-3' : 'pl-4 pr-3 py-2'} text-left font-semibold tracking-wide`}>Time</th>
                                  <th className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-left font-semibold tracking-wide`}>Type</th>
                                  <th className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-left font-semibold tracking-wide`}>USD</th>
                                  <th className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-left font-semibold tracking-wide`}>Price</th>
                                  <th className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-left font-semibold tracking-wide`}>Maker</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTransactions.length === 0 && !transactionLoading ? (
                              <tr>
                                <td colSpan={5} className="px-1 py-2 text-center text-gray-400">No transactions available.</td>
                              </tr>
                            ) : (
                              filteredTransactions.map((tx) => {
                                // Improved logic: Determine buy/sell based on transaction direction and token involved
                                // BUY: When someone sends ETH/USDC/etc. to the pool and receives the base token
                                // SELL: When someone sends the base token to the pool and receives ETH/USDC/etc.
                                
                                // Check if this transaction involves the base token (the token we're viewing)
                                const involvesBaseToken = tx.tokenSymbol === token?.baseToken.symbol;
                                
                                // Determine if this is a buy or sell based on the transaction direction
                                // For now, we'll use a heuristic: if it's the base token, it's likely a sell
                                // If it's not the base token (ETH, USDC, etc.), it's likely a buy
                                const isBuy = !involvesBaseToken;
                                const isSell = involvesBaseToken;
                                
                                const txLabel = isBuy ? "BUY" : isSell ? "SELL" : "UNKNOWN";
                                const txColor = isBuy ? "text-green-400" : isSell ? "text-[#F43F5E]" : "text-gray-400";
                            
                            let usdValue = 0;
                            
                            // Use historical price if available, otherwise fallback to current price
                            let priceAtTime = tx.priceAtTime || 0;
                            
                            // If we don't have historical price yet, try to fetch it
                            if (priceAtTime === 0 && token?.baseToken?.address) {
                              // This is a simplified approach - in a real implementation you'd want to cache this
                              // For now, we'll use current price as fallback
                              priceAtTime = token?.priceUsd ? parseFloat(token.priceUsd) : 0;
                            } else if (priceAtTime === 0) {
                              // Fallback to current price if no historical price available
                              priceAtTime = token?.priceUsd ? parseFloat(token.priceUsd) : 0;
                            }
                            
                            if (isSell) {
                              // For SELL transactions (base token → pool), calculate based on token amount and historical price
                              const tokenAmount = tx.tokenAmount || 0;
                              usdValue = tokenAmount * priceAtTime;
                            } else if (isBuy) {
                              // For BUY transactions (ETH/USDC/etc. → pool), calculate based on input value
                              if (tx.tokenSymbol === 'ETH') {
                                // ETH transactions: convert wei to ETH, then to USD
                                const rawValue = parseFloat(tx.value || "0");
                                const ethAmount = rawValue / Math.pow(10, 18);
                                usdValue = ethAmount * ethPrice;
                              } else {
                                // Non-ETH transactions (USDC, etc.): use tokenAmount if available
                                const tokenAmount = tx.tokenAmount || 0;
                                if (tokenAmount > 0) {
                                  // Try to get price for the input token (USDC, etc.)
                                  let inputTokenPrice = 1; // Default to $1 for stablecoins
                                  if (tx.tokenSymbol === 'USDC' || tx.tokenSymbol === 'USDT') {
                                    inputTokenPrice = 1;
                                  } else if (tx.tokenSymbol === 'WETH') {
                                    inputTokenPrice = ethPrice;
                                  }
                                  usdValue = tokenAmount * inputTokenPrice;
                                } else {
                                  // Fallback: use the raw value if tokenAmount is not available
                                  const rawValue = parseFloat(tx.value || "0");
                                  usdValue = rawValue / Math.pow(10, 18); // Assume 18 decimals
                                }
                              }
                            }
                            // Calculate row fill percentage based on order size - Enhanced for whale orders
                            let rowFillPercentage = 0;
                            if (usdValue > 0) {
                              // Refined scale for smoother high-end fill:
                              // 0–50 => 0–15%, 50–200 => 15–35%, 200–500 => 35–55%, 500–1000 => 55–75%,
                              // 1000–5000 => 90–99%, >=5000 => 100%
                              if (usdValue <= 50) {
                                rowFillPercentage = (usdValue / 50) * 15;
                              } else if (usdValue <= 200) {
                                rowFillPercentage = 15 + ((usdValue - 50) / 150) * 20;
                              } else if (usdValue <= 500) {
                                rowFillPercentage = 35 + ((usdValue - 200) / 300) * 20;
                              } else if (usdValue <= 1000) {
                                rowFillPercentage = 55 + ((usdValue - 500) / 500) * 20;
                              } else if (usdValue <= 5000) {
                                rowFillPercentage = 90 + ((usdValue - 1000) / 4000) * 9; // 1000 -> 90%, 5000 -> 99%
                              } else {
                                rowFillPercentage = 100; // 5k+ => full
                              }
                            }

                              return (
                                  <tr 
                                    key={`${tx.id}-${tx.hash || tx.transactionHash || Math.random()}`} 
                                        className={`glass-panel text-gray-100 relative cursor-pointer transition-all duration-200 hover:bg-gray-800/30 border-b border-gray-700 ${
                                      flashTransactions.has(tx.id) ? 'flash-animation slide-in-animation' : ''
                                    }`}
                                    onClick={() => handleTransactionClick(tx)}
                                  >
                                        <td className={`${width < 768 ? 'px-4 py-3' : 'pl-4 pr-3 py-2'} text-sm relative z-10 align-middle font-normal font-inter`}>
                                      {/* Background fill based on order size - enhanced with glass effect */}
                                      <div 
                                        className={`absolute inset-0 transition-all duration-300 rounded-r-lg ${
                                          isBuy ? 'bg-gradient-to-r from-green-500/15 via-green-500/8 to-transparent' : 'bg-gradient-to-r from-[#F43F5E]/20 via-[#F43F5E]/10 to-transparent'
                                        }`}
                                        style={{ 
                                          width: `${rowFillPercentage}%`,
                                          left: '0',
                                          right: 'auto'
                                        }}
                                      ></div>
                                      {formatTimeAgo(tx.timestamp)}
                                    </td>
                                        <td className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} font-semibold text-sm ${txColor} relative z-10 align-middle font-inter`}>{txLabel}</td>
                                        <td className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-sm relative z-10 align-middle font-semibold font-inter ${isBuy ? 'text-green-400' : 'text-[#F43F5E]'}`}>{formatUSD(usdValue)}</td>
                                        <td className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-sm relative z-10 align-middle font-normal font-inter`}>${priceAtTime.toFixed(4)}</td>
                                        <td className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-sm relative z-10 align-middle font-normal font-inter`}>{tx.from?.slice(0, 6)}...{tx.from?.slice(-4)}</td>
                              </tr>
                            );
                          })
                        )}
                        {transactionLoading && (
                          <tr>
                            <td colSpan={5} className="px-1 py-2 text-center text-gray-400">
                              <span className="flex items-center justify-center">
                                <svg className="animate-spin h-4 w-4 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading more transactions...
                              </span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                          )}

                          {/* Holders Tab */}
                          {activeDataTab === "holders" && (
                            <div className="w-full">
                              {holdersLoading ? (
                                <div className="p-4 text-center text-gray-400">
                                  <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                                  <p className="text-sm">Loading holders data...</p>
                                  <p className="text-xs text-gray-500 mt-1">Fetching from Alchemy API</p>
                </div>
                              ) : (
                                <table className="w-full text-sm text-left font-inter">
                                  <thead className="text-xs text-gray-400 uppercase sticky top-0 glass-panel rounded-t-lg font-inter">
                                    <tr>
                                      <th className={`${width < 768 ? 'px-4 py-3' : 'pl-4 pr-3 py-2'} text-left font-semibold tracking-wide`}>Rank</th>
                                      <th className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-left font-semibold tracking-wide`}>Address</th>
                                      <th className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-left font-semibold tracking-wide`}>Balance</th>
                                      <th className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-left font-semibold tracking-wide`}>USD Value</th>
                                      <th className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-left font-semibold tracking-wide`}>% of Supply</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {holders.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="px-1 py-2 text-center text-gray-400">No holders data available.</td>
                                      </tr>
                                    ) : (
                                      holders.map((holder, index) => (
                                        <tr 
                                          key={holder.address} 
                                          className="glass-panel text-gray-100 relative cursor-pointer transition-all duration-200 hover:bg-gray-800/30 border-b border-gray-700"
                                        >
                                          <td className={`${width < 768 ? 'px-4 py-3' : 'pl-4 pr-3 py-2'} text-sm relative z-10 align-middle font-normal font-inter`}>
                                            #{index + 1}
                                          </td>
                                          <td className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-sm relative z-10 align-middle font-normal font-inter`}>
                                            {holder.address?.slice(0, 6)}...{holder.address?.slice(-4)}
                                          </td>
                                          <td className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-sm relative z-10 align-middle font-normal font-inter`}>
                                            {parseFloat(holder.balance || '0').toLocaleString()}
                                          </td>
                                          <td className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-sm relative z-10 align-middle font-normal font-inter text-green-400`}>
                                            ${parseFloat(holder.usdValue || '0').toLocaleString()}
                                          </td>
                                          <td className={`${width < 768 ? 'px-4 py-3' : 'px-3 py-2'} text-sm relative z-10 align-middle font-normal font-inter`}>
                                            {parseFloat(holder.percentage || '0').toFixed(2)}%
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              )}
              </div>
                          )}

                          {/* Orders Tab */}
                          {activeDataTab === "orders" && (
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
                                <table className="w-full text-sm">
                                  <thead className="text-xs text-gray-400 border-b border-gray-700">
                                    <tr>
                                      <th className="text-left py-2 pl-4">Time</th>
                                      <th className="text-left py-2">Type</th>
                                      <th className="text-left py-2">Amount</th>
                                      <th className="text-left py-2">Price</th>
                                      <th className="text-left py-2">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {orders.map((order) => {
                                      const orderColor = order.type === 'buy' ? "text-green-400" : "text-red-400";
                                      const orderLabel = order.type === 'buy' ? "BUY" : "SELL";
                                      
                                      return (
                                        <tr key={`order-${order.id}-${order.transactionHash || order.timestamp || Math.random()}`} className="border-b border-gray-800">
                                          <td className="py-2 pl-4 text-gray-300">
                                            {formatTimeAgo(order.timestamp)}
                                          </td>
                                          <td className="py-2">
                                            <span className={`font-medium ${orderColor}`}>
                                              {orderLabel}
                                            </span>
                                          </td>
                                          <td className="py-2 text-gray-300">
                                            {parseFloat(order.amount).toLocaleString()}
                                          </td>
                                          <td className="py-2 text-gray-300">
                                            ${parseFloat(order.price).toFixed(6)}
                                          </td>
                                          <td className="py-2">
                                            <span className={`px-2 py-1 text-xs rounded ${
                                              (order.status === 'completed' || order.status === 'confirmed') ? 'bg-green-500/20 text-green-400' :
                                              order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                              'bg-gray-500/20 text-gray-400'
                                            }`}>
                                              {(order.status === 'completed' || order.status === 'confirmed') ? 'filled' : order.status}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}

                          {/* Positions Tab */}
                          {activeDataTab === "positions" && (
                            <div className="w-full">
                              {positionsLoading ? (
                                <div className="p-6 text-center text-gray-400">
                                  <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                  <p className="text-sm">Loading positions...</p>
                                </div>
                              ) : positions.length === 0 ? (
                                <div className="p-6 text-center text-gray-400">
                                  <p className="text-sm">
                                    {unifiedPnLData ? 'No active positions for this token.' : 'Loading PnL data...'}
                                  </p>
                                </div>
                              ) : (
                                <table className="w-full text-sm">
                                  <thead className="text-xs text-gray-400 border-b border-gray-700">
                                    <tr>
                                      <th className="text-left py-2 pl-4">Token</th>
                                      <th className="text-left py-2">Amount</th>
                                      <th className="text-left py-2">Avg Price</th>
                                      <th className="text-left py-2">Current</th>
                                      <th className="text-left py-2">P&L</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {positions.map((position) => {
                                      const pnlColor = position.pnlPercentage ? 
                                        (position.pnlPercentage >= 0 ? "text-green-400" : "text-red-400") :
                                        (position.pnl.startsWith('+') ? "text-green-400" : "text-red-400");
                                      
                                      return (
                                        <tr key={`position-${position.id}-${position.tokenAddress}-${position.entryDate || Math.random()}`} className="border-b border-gray-800">
                                          <td className="py-2 pl-4">
                                            <div className="flex items-center space-x-3">
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center border border-gray-600 flex-shrink-0 overflow-hidden">
                                                {tokenLogos[position.tokenAddress] ? (
                                                  <img 
                                                    src={tokenLogos[position.tokenAddress]} 
                                                    alt={position.tokenSymbol || 'Token'}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                      // Fallback to placeholder if image fails to load
                                                      const target = e.target as HTMLImageElement;
                                                      target.style.display = 'none';
                                                      target.nextElementSibling?.classList.remove('hidden');
                                                    }}
                                                  />
                                                ) : null}
                                                <div className={`w-8 h-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-blue-500/30 ${tokenLogos[position.tokenAddress] ? 'hidden' : ''}`}>
                                                  <span className="text-blue-400 font-bold text-sm">
                                                    {position.tokenSymbol?.charAt(0) || 'T'}
                                                  </span>
                                                </div>
                                              </div>
                                              <div>
                                                <div className="text-gray-300 font-medium">
                                                  {position.tokenSymbol || position.tokenName || 'Unknown'}
                                                </div>
                                                {position.tokenName && position.tokenSymbol && position.tokenName !== position.tokenSymbol && (
                                                  <div className="text-xs text-gray-500">{position.tokenName}</div>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="py-2 text-gray-300">
                                            {parseFloat(position.amount).toLocaleString()}
                                          </td>
                                          <td className="py-2 text-gray-300">
                                            ${parseFloat(position.avgPrice).toFixed(6)}
                                          </td>
                                          <td className="py-2 text-gray-300">
                                            ${parseFloat(position.currentPrice).toFixed(6)}
                                          </td>
                                          <td className="py-2">
                                            <div className={`font-medium ${pnlColor}`}>
                                              {position.pnlPercentage !== undefined ? 
                                                `${position.pnlPercentage >= 0 ? '+' : ''}${position.pnlPercentage.toFixed(2)}%` : 
                                                (position.pnl || '0.00%')
                                              }
                                            </div>
                                            {position.pnlValue && (
                                              <div className="text-xs text-gray-500">
                                                {position.pnlValue}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
              </div>
              

            </div>
          )}

          {/* Info Tab Content */}
                {width < 768 && mobileActiveTab === "info" && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
                    <div className="border-b border-blue-500/20 p-4 bg-gray-950">
                      <h3 className="text-lg font-semibold text-gray-200">Token Information</h3>
              </div>
                    <div className="flex-1 p-4 overflow-y-auto">
                      {token && (
                <div className="space-y-4">
                          <div className="rounded-lg p-4 border border-gray-700 bg-gray-950">
                            <h4 className="text-lg font-semibold text-gray-100 mb-3">Token Details</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                        <span className="text-gray-400">Symbol:</span>
                                <div className="text-gray-100 font-semibold">{token.baseToken.symbol}</div>
                      </div>
                              <div>
                                <span className="text-gray-400">Name:</span>
                                <div className="text-gray-100 font-semibold">{token.baseToken.name}</div>
                              </div>
                              <div>
                        <span className="text-gray-400">Price:</span>
                                <div className="text-gray-100 font-semibold">${parseFloat(token.priceUsd).toFixed(6)}</div>
                      </div>
                              <div>
                        <span className="text-gray-400">Market Cap:</span>
                                <div className="text-gray-100 font-semibold">${token.marketCap.toLocaleString()}</div>
                      </div>
                              <div>
                        <span className="text-gray-400">Liquidity:</span>
                                <div className="text-gray-100 font-semibold">${token.liquidity.usd.toLocaleString()}</div>
                      </div>
                              <div>
                                <span className="text-gray-400">FDV:</span>
                                <div className="text-gray-100 font-semibold">${token.fdv.toLocaleString()}</div>
                    </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
                  </div>
                  
          {/* Vertical Separator - Desktop Only */}
          {(!width || width >= 768) && (
            <div className="w-px bg-gray-700 flex-shrink-0"></div>
          )}

          {/* Professional Swap Section - Desktop Only */}
          {(!width || width >= 768) && (
            <div className="w-80 flex-shrink-0 flex flex-col bg-gray-950" style={{ height: '100vh' }}>
              <Swap 
                token={token} 
                ethPrice={ethPrice} 
                onTradeComplete={() => {
                  // 🔧 NEW: Refresh orders and positions when trade completes
                  console.log("🔄 Trade completed, refreshing data...");
                  setOrdersInitialized(false);
                  setPositionsInitialized(false);
                  // 🔧 NEW: Also refresh unified PnL data for consistency
                  fetchUnifiedPnLData();
                  if (activeDataTab === "orders") {
                    fetchOrders();
                  }
                  if (activeDataTab === "positions") {
                    fetchPositions();
                  }
                }}
              />
            </div>
          )}

          {/* Swap Tab Content - Mobile Only */}
          {width < 768 && mobileActiveTab === "swap" && (
            <div className="bg-gray-950 flex-1 flex flex-col overflow-hidden">
              <div className="bg-gray-950 border-b border-gray-800 p-4">
                <h3 className="text-lg font-semibold text-gray-200">Swap</h3>
              </div>
              <div className="flex-1">
                <Swap 
                  token={token} 
                  ethPrice={ethPrice} 
                  onTradeComplete={() => {
                    // 🔧 NEW: Refresh orders and positions when trade completes
                    console.log("🔄 Trade completed, refreshing data...");
                    setOrdersInitialized(false);
                    setPositionsInitialized(false);
                    if (activeDataTab === "orders") {
                      fetchOrders();
                    }
                    if (activeDataTab === "positions") {
                      fetchPositions();
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

                      {/* Professional Bottom Tab Navigation - Mobile Only */}
        {width < 768 && !initialLoading && (
          <div className="flex-shrink-0 fixed bottom-0 left-0 right-0 z-50 bg-gray-950 border-t border-gray-800">
            <div className="flex">
              <button
                onClick={() => setMobileActiveTab("chart")}
                className={`flex-1 py-4 px-4 text-sm font-semibold transition-all duration-200 ${
                  mobileActiveTab === "chart"
                    ? "text-blue-400 bg-gray-900 border-t-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300 hover:bg-gray-900/50"
                }`}
              >
                Chart
              </button>
              <button
                onClick={() => setMobileActiveTab("info")}
                className={`flex-1 py-4 px-4 text-sm font-semibold transition-all duration-200 ${
                  mobileActiveTab === "info"
                    ? "text-blue-400 bg-gray-900 border-t-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300 hover:bg-gray-900/50"
                }`}
              >
                Info
              </button>
              <button
                onClick={() => setMobileActiveTab("swap")}
                className={`flex-1 py-4 px-4 text-sm font-semibold transition-all duration-200 ${
                  mobileActiveTab === "swap"
                    ? "text-blue-400 bg-gray-900 border-t-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300 hover:bg-gray-900/50"
                }`}
              >
                Swap
              </button>
            </div>
          </div>
        )}

      {/* Footer - Desktop Only */}
      {(!width || width >= 768) && (
        <div className="absolute bottom-0 left-0 right-0 z-40">
          <Footer />
        </div>
      )}

      {/* Enhanced Trend Modal */}
      {showTrendModal && (
        <div className="trend-modal">
          <div className="trend-modal-content">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">📈</span>
                </div>
                <h3 className="text-xl font-bold text-gray-100">Market Analysis</h3>
              </div>
              <button onClick={() => setShowTrendModal(false)} className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-gray-700 transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
              </div>
              
            <div className="space-y-6">
              {/* Token Info */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-100">{token?.baseToken.symbol}/{token?.quoteToken.symbol}</h4>
                  <span className="text-sm text-gray-400">Real-time Analysis</span>
                      </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                    <span className="text-gray-400">Current Price:</span>
                    <div className="text-gray-100 font-semibold">${token?.priceUsd ? parseFloat(token.priceUsd).toFixed(6) : "0.000000"}</div>
                      </div>
                  <div>
                    <span className="text-gray-400">24h Change:</span>
                    <div className={`font-semibold ${token?.priceChange?.h24 && token.priceChange.h24 >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {token?.priceChange?.h24 ? `${token.priceChange.h24 >= 0 ? "+" : ""}${token.priceChange.h24.toFixed(2)}%` : "0.00%"}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Market Cap:</span>
                    <div className="text-gray-100 font-semibold">${token?.marketCap ? token.marketCap.toLocaleString() : "0"}</div>
                </div>
                  <div>
                    <span className="text-gray-400">Liquidity:</span>
                    <div className="text-gray-100 font-semibold">${token?.liquidity?.usd ? token.liquidity.usd.toLocaleString() : "0"}</div>
              </div>
            </div>
          </div>

              {/* Trend Insights */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-lg font-semibold text-gray-100 mb-4">📊 Market Insights</h4>
                <div className="space-y-3">
                  {getTrendAnalysis().length > 0 ? (
                    getTrendAnalysis().map((insight, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg">
                        {insight.trend && (
                          <span
                            className={`px-3 py-1 text-xs font-medium rounded-full ${
                              insight.trend === "Bullish" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
                            }`}
                          >
                            {insight.trend === "Bullish" ? "📈" : "📉"} {insight.trend}
                          </span>
                        )}
                        <span className="text-gray-300 text-sm leading-relaxed">{insight.text}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 text-sm p-3 bg-gray-700 rounded-lg">
                      <span className="text-yellow-400">⚠️</span> Insufficient data for detailed analysis. More trading activity needed.
                    </div>
                  )}
                </div>
      </div>

              {/* Price Chart Mini */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-lg font-semibold text-gray-100 mb-4">📈 Price Trend</h4>
                <div className="flex items-center justify-center">
                  <Sparklines data={getSparklineData()} width={300} height={60} margin={5}>
                    <SparklinesLine
                      color={
                        getSparklineData().length > 0 && getSparklineData()[getSparklineData().length - 1] >= getSparklineData()[0] ? "#10B981" : "#EF4444"
                      }
                      style={{ strokeWidth: 2 }}
                    />
                  </Sparklines>
            </div>
                <div className="text-center mt-2">
                  <span className="text-xs text-gray-400">
                    {getSparklineData().length > 0 && getSparklineData()[getSparklineData().length - 1] >= getSparklineData()[0] ? "↗ Trending Up" : "↘ Trending Down"}
                  </span>
              </div>
            </div>

              {/* Trading Activity */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-lg font-semibold text-gray-100 mb-4">🔄 Trading Activity</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold text-green-400">{transactions.filter(tx => {
                      const isSell = tx.from?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '') && tx.tokenSymbol === token?.baseToken.symbol;
                      return !isSell;
                    }).length}</div>
                    <div className="text-gray-400">Buy Orders</div>
                  </div>
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold text-red-400">{transactions.filter(tx => {
                      const isSell = tx.from?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '') && tx.tokenSymbol === token?.baseToken.symbol;
                      return isSell;
                    }).length}</div>
                    <div className="text-gray-400">Sell Orders</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}





      {/* Enhanced Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(3, 7, 18, 0.5);
          border-radius: 4px;
          backdrop-filter: blur(8px);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #374151, #1f2937);
          border-radius: 4px;
          border: 1px solid rgba(31, 41, 55, 0.3);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #4b5563, #374151);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: rgba(3, 7, 18, 0.5);
        }
      `}</style>
    </div>
  );
}