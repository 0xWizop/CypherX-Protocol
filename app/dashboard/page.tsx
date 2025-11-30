"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Header from "@/app/components/Header";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { FaWallet, FaLayerGroup } from "react-icons/fa";
import { FiChevronDown, FiCheck, FiRefreshCw } from "react-icons/fi";

// Format number to abbreviated form with max 4 decimal places
const formatNumber = (value: number | string | undefined | null, decimals: number = 2): string => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  // Handle very small numbers (scientific notation)
  if (Math.abs(num) < 0.0001 && num !== 0) {
    return num.toExponential(2);
  }
  
  // Handle large numbers
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  
  return num.toFixed(decimals);
};

// Format token amount - smart formatting based on value
const formatTokenAmount = (value: string | number | undefined | null): string => {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  
  if (num === 0) return '0';
  if (Math.abs(num) < 0.000001) return '<0.000001';
  if (Math.abs(num) < 0.0001) return num.toFixed(6);
  if (Math.abs(num) < 1) return num.toFixed(4);
  if (Math.abs(num) < 1000) return num.toFixed(2);
  return formatNumber(num);
};

// Shorten token address/name
const shortenToken = (token: string | undefined | null): string => {
  if (!token) return '-';
  if (token.length <= 10) return token;
  if (token.startsWith('0x')) return `${token.slice(0, 6)}...${token.slice(-4)}`;
  return token;
};

// Format percentage with sane limits and handle edge cases
const formatPercentage = (pct: number | null | undefined): string => {
  if (pct === null || pct === undefined || !isFinite(pct)) return '0';
  
  // Handle extremely small values (essentially zero)
  if (Math.abs(pct) < 0.01) return '0';
  
  // Cap at reasonable display values
  if (pct > 9999) return '>9,999';
  if (pct < -9999) return '<-9,999';
  
  // Format based on magnitude
  if (Math.abs(pct) >= 1000) return `${(pct / 1000).toFixed(1)}K`;
  if (Math.abs(pct) >= 100) return pct.toFixed(0);
  if (Math.abs(pct) >= 10) return pct.toFixed(1);
  return pct.toFixed(2);
};

// Format P&L value, handling tiny/zero values
const formatPnLValue = (pnl: number | null | undefined): string => {
  if (pnl === null || pnl === undefined || !isFinite(pnl)) return '0.00';
  
  // Handle extremely small values (dust)
  if (Math.abs(pnl) < 0.01) return '0.00';
  
  return formatNumber(pnl);
};

const POSITIONS_PER_PAGE = 5;

type TradingData = {
  totalPnL: number;
  totalPnLPercentage: number;
  totalVolume: number;
  totalTrades: number;
  winRate: number;
  bought: number;
  sold: number;
  holding: number;
  positionsClosed: number;
  completedTrades: number;
  dailyPnL: Array<{ date: string; pnl: number }>;
  recentTrades: Array<{
    id: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    timestamp: number;
    type: 'buy' | 'sell';
    status: 'completed' | 'pending' | 'failed';
    walletAddress?: string;
  }>;
  positionsHistory: Array<{
    tokenAddress: string;
    tokenSymbol: string;
    entryPrice: number;
    exitPrice: number;
    amount: number;
    pnl: number;
    pnlPercentage: number;
    entryDate: string;
    exitDate: string;
    status: 'open' | 'closed';
    walletAddress?: string;
  }>;
};

interface WalletData {
  address: string;
  privateKey: string;
  createdAt: number;
  alias?: string;
}

interface WalletsStorage {
  wallets: WalletData[];
  activeIndex: number;
}

export default function DashboardPage() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "trades" | "analytics" | "tax">("overview");
  const [tradingData, setTradingData] = useState<TradingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d" | "all">("30d");
  
  // Multi-wallet state
  const [allWallets, setAllWallets] = useState<WalletData[]>([]);
  const [selectedWalletIndex, setSelectedWalletIndex] = useState<number | 'all'>(0);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const walletSelectorRef = useRef<HTMLDivElement>(null);
  
  // Pagination state for positions
  const [openPositionsPage, setOpenPositionsPage] = useState(1);
  const [closedPositionsPage, setClosedPositionsPage] = useState(1);

  // Close wallet selector on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletSelectorRef.current && !walletSelectorRef.current.contains(event.target as Node)) {
        setShowWalletSelector(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load all wallets from storage
  useEffect(() => {
    try {
      // Try loading from multi-wallet storage first
      const storedWallets = typeof window !== "undefined" ? localStorage.getItem("cypherx_wallets") : null;
      if (storedWallets) {
        const storage: WalletsStorage = JSON.parse(storedWallets);
        if (storage.wallets && storage.wallets.length > 0) {
          setAllWallets(storage.wallets);
          setSelectedWalletIndex(storage.activeIndex);
          setWalletAddress(storage.wallets[storage.activeIndex].address);
        }
      } else {
        // Fall back to single wallet storage
        const raw = typeof window !== "undefined" ? localStorage.getItem("cypherx_wallet") : null;
        if (raw) {
          const data = JSON.parse(raw);
          if (data?.address) {
            const walletWithAlias: WalletData = {
              ...data,
              alias: data.alias || 'Account 1'
            };
            setAllWallets([walletWithAlias]);
            setSelectedWalletIndex(0);
            setWalletAddress(data.address);
          }
        }
      }
    } catch {}
    
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cypherx_wallets" || e.key === "cypherx_wallet") {
        try {
          if (e.key === "cypherx_wallets" && e.newValue) {
            const storage: WalletsStorage = JSON.parse(e.newValue);
            if (storage.wallets && storage.wallets.length > 0) {
              setAllWallets(storage.wallets);
              if (selectedWalletIndex !== 'all') {
                const idx = Math.min(selectedWalletIndex, storage.wallets.length - 1);
                setSelectedWalletIndex(idx);
                setWalletAddress(storage.wallets[idx].address);
              }
            }
          } else if (e.key === "cypherx_wallet") {
            const data = e.newValue ? JSON.parse(e.newValue) : null;
            setWalletAddress(data?.address || "");
          }
        } catch {
          setWalletAddress("");
        }
      }
    };
    
    // Listen for wallet updates from the wallet dropdown
    const onWalletUpdate = () => {
      try {
        const storedWallets = localStorage.getItem("cypherx_wallets");
        if (storedWallets) {
          const storage: WalletsStorage = JSON.parse(storedWallets);
          if (storage.wallets && storage.wallets.length > 0) {
            setAllWallets(storage.wallets);
            if (selectedWalletIndex !== 'all') {
              // Adjust index if it's out of bounds (wallet was removed)
              const idx = Math.min(typeof selectedWalletIndex === 'number' ? selectedWalletIndex : 0, storage.wallets.length - 1);
              setSelectedWalletIndex(idx);
              setWalletAddress(storage.wallets[idx].address);
            }
            console.log("📊 Dashboard: Wallet updated, now have", storage.wallets.length, "wallets");
          } else {
            // All wallets were removed
            console.log("📊 Dashboard: All wallets removed");
            setAllWallets([]);
            setSelectedWalletIndex(0);
            setWalletAddress("");
            setTradingData(null);
          }
        } else {
          // No wallets in storage
          setAllWallets([]);
          setSelectedWalletIndex(0);
          setWalletAddress("");
          setTradingData(null);
        }
      } catch (error) {
        console.error("Error handling wallet update:", error);
      }
    };
    
    window.addEventListener("storage", onStorage);
    window.addEventListener("wallet-updated", onWalletUpdate);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wallet-updated", onWalletUpdate);
    };
  }, [selectedWalletIndex]);

  // Fetch trading data for a single wallet
  const fetchWalletData = useCallback(async (address: string, timeframeParam: string): Promise<TradingData | null> => {
    try {
      const response = await fetch(`/api/wallet/pnl?address=${address}&timeframe=${timeframeParam}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Dashboard: Fetched data for ${address.slice(0, 8)}...`, {
          totalTrades: data.totalTrades,
          positions: data.positionsHistory?.length || 0,
          recentTrades: data.recentTrades?.length || 0
        });
        return data;
      }
    } catch (error) {
      console.error("Error fetching trading data for", address, error);
    }
    return null;
  }, []);

  // Merge trading data from multiple wallets
  const mergeTradeData = useCallback((dataArray: (TradingData | null)[]): TradingData => {
    const validData = dataArray.filter((d): d is TradingData => d !== null);
    
    console.log(`📊 Merging data from ${validData.length} wallets:`);
    validData.forEach((d, i) => {
      console.log(`  Wallet ${i + 1}: P&L = $${d.totalPnL?.toFixed(2) || 0}, Volume = $${d.totalVolume?.toFixed(2) || 0}, Trades = ${d.totalTrades || 0}`);
    });
    
    if (validData.length === 0) {
      return {
        totalPnL: 0,
        totalPnLPercentage: 0,
        totalVolume: 0,
        totalTrades: 0,
        winRate: 0,
        bought: 0,
        sold: 0,
        holding: 0,
        positionsClosed: 0,
        completedTrades: 0,
        dailyPnL: [],
        recentTrades: [],
        positionsHistory: []
      };
    }

    // Merge numeric stats - sum P&L from all wallets
    const totalPnL = validData.reduce((sum, d) => sum + (d.totalPnL || 0), 0);
    console.log(`📊 Total combined P&L: $${totalPnL.toFixed(2)}`);
    const totalVolume = validData.reduce((sum, d) => sum + (d.totalVolume || 0), 0);
    const totalTrades = validData.reduce((sum, d) => sum + (d.totalTrades || 0), 0);
    const bought = validData.reduce((sum, d) => sum + (d.bought || 0), 0);
    const sold = validData.reduce((sum, d) => sum + (d.sold || 0), 0);
    const holding = validData.reduce((sum, d) => sum + (d.holding || 0), 0);
    const positionsClosed = validData.reduce((sum, d) => sum + (d.positionsClosed || 0), 0);
    const completedTrades = validData.reduce((sum, d) => sum + (d.completedTrades || 0), 0);
    
    // Calculate weighted win rate
    const totalWins = validData.reduce((sum, d) => sum + ((d.winRate || 0) / 100 * (d.completedTrades || 0)), 0);
    const winRate = completedTrades > 0 ? (totalWins / completedTrades) * 100 : 0;
    
    // Calculate P&L percentage based on total volume
    const totalPnLPercentage = totalVolume > 0 ? (totalPnL / totalVolume) * 100 : 0;

    // Merge daily PnL (aggregate by date)
    const dailyPnLMap = new Map<string, number>();
    validData.forEach(d => {
      (d.dailyPnL || []).forEach(({ date, pnl }) => {
        dailyPnLMap.set(date, (dailyPnLMap.get(date) || 0) + pnl);
      });
    });
    const dailyPnL = Array.from(dailyPnLMap.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Merge and sort trades by timestamp
    const recentTrades = validData
      .flatMap(d => d.recentTrades || [])
      .sort((a, b) => b.timestamp - a.timestamp);

    // Merge positions
    const positionsHistory = validData.flatMap(d => d.positionsHistory || []);

    return {
      totalPnL,
      totalPnLPercentage,
      totalVolume,
      totalTrades,
      winRate,
      bought,
      sold,
      holding,
      positionsClosed,
      completedTrades,
      dailyPnL,
      recentTrades,
      positionsHistory
    };
  }, []);

  useEffect(() => {
    const fetchTradingData = async () => {
      if (selectedWalletIndex === 'all') {
        // Fetch consolidated data from all wallets
        if (allWallets.length === 0) {
          setLoading(false);
          return;
        }
        
        setLoading(true);
        try {
          const timeframeParam = timeframe === "7d" ? "7D" : timeframe === "30d" ? "30D" : timeframe === "90d" ? "90D" : "ALL";
          const dataPromises = allWallets.map(w => fetchWalletData(w.address, timeframeParam));
          const allData = await Promise.all(dataPromises);
          const merged = mergeTradeData(allData);
          setTradingData(merged);
        } catch (error) {
          console.error("Error fetching consolidated data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        // Fetch data for single wallet
        if (!walletAddress) {
          setLoading(false);
          return;
        }
        
        setLoading(true);
        try {
          const timeframeParam = timeframe === "7d" ? "7D" : timeframe === "30d" ? "30D" : timeframe === "90d" ? "90D" : "ALL";
          const data = await fetchWalletData(walletAddress, timeframeParam);
          setTradingData(data);
        } catch (error) {
          console.error("Error fetching trading data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchTradingData();
  }, [walletAddress, timeframe, selectedWalletIndex, allWallets, fetchWalletData, mergeTradeData]);

  const formatTimeAgo = (timestamp: number | undefined | null): string => {
    if (!timestamp) return '-';
    
    // Detect if timestamp is in seconds or milliseconds
    // If timestamp is less than year 2000 in ms, it's probably in seconds
    const ts = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
    const now = Date.now();
    const diff = now - ts;
    
    // Handle invalid or future timestamps
    if (diff < 0 || isNaN(diff)) return '-';
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const openPositions = useMemo(() => {
    return (tradingData?.positionsHistory || []).filter(p => {
      if (!p || p.status !== 'open') return false;
      // Filter out positions with zero cost basis (airdrops/received tokens - not purchased)
      const costBasis = (p.entryPrice ?? 0) * (p.amount ?? 0);
      return costBasis > 0;
    });
  }, [tradingData]);

  const closedPositions = useMemo(() => {
    return (tradingData?.positionsHistory || []).filter(p => {
      if (!p || p.status !== 'closed') return false;
      // Filter out positions with zero cost basis (airdrops/received tokens - not purchased)
      const costBasis = (p.entryPrice ?? 0) * (p.amount ?? 0);
      return costBasis > 0;
    });
  }, [tradingData]);

  return (
    <div className="h-full bg-gray-950 text-gray-200 flex flex-col md:overflow-hidden overflow-y-auto">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-2 flex flex-col min-h-0 md:overflow-hidden">
        <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-white">Trading Dashboard</h1>
            
            {/* Wallet Selector */}
            <div className="relative mt-2" ref={walletSelectorRef}>
              <button
                onClick={() => setShowWalletSelector(!showWalletSelector)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:border-blue-500 transition-colors text-sm"
              >
                {selectedWalletIndex === 'all' ? (
                  <>
                    <FaLayerGroup className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-white">All Wallets ({allWallets.length})</span>
                  </>
                ) : (
                  <>
                    <FaWallet className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-white">
                      {allWallets[selectedWalletIndex]?.alias || `Account ${selectedWalletIndex + 1}`}
                    </span>
                    <span className="text-gray-400 text-xs">
                      ({walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "No wallet"})
                    </span>
                  </>
                )}
                <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showWalletSelector ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Wallet Dropdown */}
              {showWalletSelector && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-[#0b1220] border border-gray-800 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-2">
                    {/* All Wallets (Consolidated) Option */}
                    {allWallets.length > 1 && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedWalletIndex('all');
                            setWalletAddress(''); // Clear wallet address for consolidated view
                            setShowWalletSelector(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg transition-all duration-150 ${
                            selectedWalletIndex === 'all'
                              ? 'bg-blue-600/15 border border-blue-500/30'
                              : 'hover:bg-[#15233d]'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                              selectedWalletIndex === 'all' ? 'bg-blue-600' : 'bg-gray-700'
                            }`}>
                              <FaLayerGroup className="w-3 h-3 text-white" />
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-medium text-white">All Wallets</div>
                              <div className="text-[10px] text-gray-500">Consolidated ({allWallets.length} wallets)</div>
                            </div>
                          </div>
                          {selectedWalletIndex === 'all' && (
                            <FiCheck className="w-3.5 h-3.5 text-blue-400" />
                          )}
                        </button>
                        <div className="border-t border-gray-800 my-1.5"></div>
                      </>
                    )}
                    
                    {/* Individual Wallets */}
                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider px-1 py-1">Individual Wallets</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide">
                      {allWallets.map((wallet, index) => (
                        <button
                          key={wallet.address}
                          onClick={() => {
                            setSelectedWalletIndex(index);
                            setWalletAddress(wallet.address);
                            setShowWalletSelector(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg transition-all duration-150 ${
                            selectedWalletIndex === index
                              ? 'bg-blue-600/15 border border-blue-500/30'
                              : 'hover:bg-[#15233d]'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                              selectedWalletIndex === index ? 'bg-blue-600' : 'bg-gray-700'
                            }`}>
                              <FaWallet className="w-3 h-3 text-white" />
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-medium text-white">
                                {wallet.alias || `Account ${index + 1}`}
                              </div>
                              <div className="text-[10px] text-gray-500 font-mono">
                                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                              </div>
                            </div>
                          </div>
                          {selectedWalletIndex === index && (
                            <div className="flex items-center space-x-1 text-green-400">
                              <span className="text-[9px] font-medium">Active</span>
                              <FiCheck className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    
                    {allWallets.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-xs">
                        <FaWallet className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
                        No wallets found. Open wallet to create one.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (selectedWalletIndex === 'all' && allWallets.length > 0) {
                // Refresh consolidated data
                const timeframeParam = timeframe === "7d" ? "7D" : timeframe === "30d" ? "30D" : timeframe === "90d" ? "90D" : "ALL";
                Promise.all(allWallets.map(w => 
                  fetch(`/api/wallet/pnl?address=${w.address}&timeframe=${timeframeParam}`)
                    .then(r => r.json())
                    .catch(() => null)
                )).then(allData => {
                  const merged = mergeTradeData(allData);
                  setTradingData(merged);
                });
              } else if (walletAddress) {
                const timeframeParam = timeframe === "7d" ? "7D" : timeframe === "30d" ? "30D" : timeframe === "90d" ? "90D" : "ALL";
                fetch(`/api/wallet/pnl?address=${walletAddress}&timeframe=${timeframeParam}`)
                  .then(r => r.json())
                  .then(data => setTradingData(data))
                  .catch(console.error);
              }
            }}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Consolidated View Banner */}
        {selectedWalletIndex === 'all' && allWallets.length > 1 && (
          <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-3 mb-4 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <FaLayerGroup className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300 font-medium">Consolidated View</span>
              <span className="text-xs text-blue-400/70">•</span>
              <span className="text-xs text-blue-400/70">
                Showing combined data from {allWallets.length} wallets:
              </span>
              <div className="flex items-center space-x-1 flex-wrap">
                {allWallets.slice(0, 3).map((w, i) => (
                  <span key={w.address} className="text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded">
                    {w.alias || `Account ${i + 1}`}
                  </span>
                ))}
                {allWallets.length > 3 && (
                  <span className="text-xs text-blue-400/70">+{allWallets.length - 3} more</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 flex-shrink-0">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2.5 sm:p-3">
            <div className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Total P&L {selectedWalletIndex === 'all' && <span className="text-blue-400 normal-case">(All Wallets)</span>}
            </div>
            <div className={`text-base sm:text-lg font-semibold ${(tradingData?.totalPnL ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(tradingData?.totalPnL ?? 0) >= 0 ? '+' : '-'}${formatNumber(Math.abs(tradingData?.totalPnL ?? 0))}
            </div>
            <div className={`text-[9px] sm:text-[10px] ${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(tradingData?.totalPnLPercentage ?? 0) >= 0 ? '+' : ''}{formatNumber(tradingData?.totalPnLPercentage ?? 0)}%
            </div>
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2.5 sm:p-3">
            <div className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Total Volume {selectedWalletIndex === 'all' && <span className="text-blue-400 normal-case">(All Wallets)</span>}
            </div>
            <div className="text-base sm:text-lg font-semibold text-gray-200">
              ${formatNumber(tradingData?.totalVolume ?? 0)}
            </div>
            <div className="text-[9px] sm:text-[10px] text-gray-500">
              {tradingData?.totalTrades ?? 0} trades
            </div>
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2.5 sm:p-3">
            <div className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Win Rate {selectedWalletIndex === 'all' && <span className="text-blue-400 normal-case">(All Wallets)</span>}
            </div>
            <div className="text-base sm:text-lg font-semibold text-gray-200">
              {formatNumber(tradingData?.winRate ?? 0, 0)}%
            </div>
            <div className="text-[9px] sm:text-[10px] text-gray-500">
              {tradingData?.completedTrades ?? 0} completed
            </div>
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2.5 sm:p-3">
            <div className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Positions {selectedWalletIndex === 'all' && <span className="text-blue-400 normal-case">(All Wallets)</span>}
            </div>
            <div className="text-base sm:text-lg font-semibold text-gray-200">
              {openPositions.length} open
            </div>
            <div className="text-[9px] sm:text-[10px] text-gray-500">
              {closedPositions.length} closed
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 border-b border-gray-800 mb-4 flex-shrink-0 overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
          {(["overview", "positions", "trades", "analytics", "tax"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "text-blue-400 border-b-2 border-blue-400 -mb-[1px]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 md:overflow-hidden overflow-y-auto pb-4 md:pb-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner variant="dots" size="md" text="Loading trading data..." />
            </div>
          ) : (allWallets.length === 0 || (selectedWalletIndex !== 'all' && !walletAddress)) ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaWallet className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-gray-400 mb-4">
                  {allWallets.length === 0 
                    ? "Create or import a wallet to view trading data" 
                    : "Select a wallet to view trading data"}
                </p>
                <button
                  onClick={() => {
                    try {
                      (window as any).dispatchEvent(new CustomEvent('open-wallet'));
                    } catch {}
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  {allWallets.length === 0 ? "Open Wallet" : "Select Wallet"}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full">
              {activeTab === "overview" && (
                <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  {/* P&L Over Time */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-200">P&L Over Time</h3>
                      <div className="flex bg-gray-800 rounded-md p-0.5">
                        {(["7d", "30d", "90d", "all"] as const).map((tf) => (
                          <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium rounded transition-all ${
                              timeframe === tf
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            {tf === 'all' ? 'ALL' : tf.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-36">
                      {(() => {
                        // Filter data based on timeframe
                        const now = new Date();
                        const allData = tradingData?.dailyPnL || [];
                        const filteredData = allData.filter(d => {
                          if (timeframe === 'all') return true;
                          const date = new Date(d.date);
                          const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                          if (timeframe === '7d') return daysAgo <= 7;
                          if (timeframe === '30d') return daysAgo <= 30;
                          if (timeframe === '90d') return daysAgo <= 90;
                          return true;
                        });

                        if (filteredData.length === 0) {
                          return <div className="h-full flex items-center justify-center text-gray-500 text-xs">No P&L data for this period</div>;
                        }

                        // Calculate cumulative P&L and scale to match actual totalPnL
                        let cumulative = 0;
                        const rawCumulativeData = filteredData.map(d => {
                          cumulative += d.pnl;
                          return { ...d, cumPnl: cumulative };
                        });
                        
                        // Scale the cumulative values to match actual totalPnL
                        const rawTotal = rawCumulativeData[rawCumulativeData.length - 1]?.cumPnl || 0;
                        const actualTotal = tradingData?.totalPnL ?? 0;
                        const scaleFactor = rawTotal !== 0 ? actualTotal / rawTotal : 1;
                        
                        const cumulativeData = rawCumulativeData.map(d => ({
                          ...d,
                          cumPnl: d.cumPnl * scaleFactor
                        }));

                        const values = cumulativeData.map(d => d.cumPnl);
                        const minVal = Math.min(...values, 0);
                        const maxVal = Math.max(...values, 0);
                        const range = maxVal - minVal || 1;
                        const padding = range * 0.1; // 10% padding
                        const adjustedMin = minVal - padding;
                        const adjustedMax = maxVal + padding;
                        const adjustedRange = adjustedMax - adjustedMin || 1;

                        // Chart dimensions
                        const chartWidth = 340;
                        const chartHeight = 80;
                        const leftPadding = 45;
                        const rightPadding = 10;
                        const topPadding = 5;
                        const bottomPadding = 20;

                        const points = cumulativeData.map((d, i) => {
                          const x = leftPadding + (i / (cumulativeData.length - 1 || 1)) * (chartWidth - leftPadding - rightPadding);
                          const y = topPadding + (1 - (d.cumPnl - adjustedMin) / adjustedRange) * chartHeight;
                          return `${x},${y}`;
                        }).join(' ');

                        const lastValue = tradingData?.totalPnL ?? 0; // Use actual total P&L
                        const isPositive = lastValue >= 0;
                        
                        // Create area fill points
                        const firstX = leftPadding;
                        const lastX = leftPadding + (chartWidth - leftPadding - rightPadding);
                        const baseY = topPadding + chartHeight;
                        const areaPoints = `${firstX},${baseY} ${points} ${lastX},${baseY}`;

                        // Y-axis labels (3 points: max, mid, min)
                        const yLabels = [
                          { value: adjustedMax, y: topPadding },
                          { value: (adjustedMax + adjustedMin) / 2, y: topPadding + chartHeight / 2 },
                          { value: adjustedMin, y: topPadding + chartHeight }
                        ];

                        // X-axis labels (start, middle, end)
                        const xLabels = [
                          { date: cumulativeData[0]?.date, x: leftPadding },
                          { date: cumulativeData[Math.floor(cumulativeData.length / 2)]?.date, x: leftPadding + (chartWidth - leftPadding - rightPadding) / 2 },
                          { date: cumulativeData[cumulativeData.length - 1]?.date, x: lastX }
                        ];

                        // Zero line position
                        const zeroY = topPadding + (1 - (0 - adjustedMin) / adjustedRange) * chartHeight;

                        return (
                          <div className="w-full h-full">
                            <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight + topPadding + bottomPadding}`} preserveAspectRatio="xMidYMid meet">
                              {/* Grid lines */}
                              {[0, 1, 2].map(i => (
                                <line
                                  key={`grid-${i}`}
                                  x1={leftPadding}
                                  y1={topPadding + (chartHeight / 2) * i}
                                  x2={chartWidth - rightPadding}
                                  y2={topPadding + (chartHeight / 2) * i}
                                  stroke="#1f2937"
                                  strokeWidth="1"
                                />
                              ))}
                              
                              {/* Zero line (if in range) */}
                              {adjustedMin < 0 && adjustedMax > 0 && (
                                <line
                                  x1={leftPadding}
                                  y1={zeroY}
                                  x2={chartWidth - rightPadding}
                                  y2={zeroY}
                                  stroke="#4b5563"
                                  strokeWidth="1"
                                  strokeDasharray="4,2"
                                />
                              )}

                              {/* Area fill */}
                              <polygon
                                points={areaPoints}
                                fill={isPositive ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)"}
                              />

                              {/* Line */}
                              <polyline
                                points={points}
                                fill="none"
                                stroke={isPositive ? "#22c55e" : "#ef4444"}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* End point dot */}
                              {cumulativeData.length > 0 && (
                                <circle
                                  cx={lastX}
                                  cy={topPadding + (1 - (lastValue - adjustedMin) / adjustedRange) * chartHeight}
                                  r="3"
                                  fill={isPositive ? "#22c55e" : "#ef4444"}
                                />
                              )}

                              {/* Y-axis labels */}
                              {yLabels.map((label, i) => (
                                <text
                                  key={`y-${i}`}
                                  x={leftPadding - 4}
                                  y={label.y + 3}
                                  textAnchor="end"
                                  className="fill-gray-500"
                                  style={{ fontSize: '9px' }}
                                >
                                  ${formatNumber(label.value, 0)}
                                </text>
                              ))}

                              {/* X-axis labels */}
                              {xLabels.map((label, i) => (
                                <text
                                  key={`x-${i}`}
                                  x={label.x}
                                  y={chartHeight + topPadding + 14}
                                  textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                                  className="fill-gray-500"
                                  style={{ fontSize: '9px' }}
                                >
                                  {label.date ? new Date(label.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                                </text>
                              ))}
                            </svg>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Portfolio Allocation */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
                    <h3 className="text-sm font-medium text-gray-200 mb-3">Portfolio Allocation</h3>
                    <div className="h-32">
                      {tradingData?.holding && tradingData.holding > 0 ? (
                        <div className="flex items-center h-full gap-4">
                          {/* Simple donut chart */}
                          <div className="relative w-24 h-24 flex-shrink-0">
                            <svg viewBox="0 0 36 36" className="w-full h-full">
                              <circle
                                cx="18" cy="18" r="14"
                                fill="none"
                                stroke="#1f2937"
                                strokeWidth="4"
                              />
                              <circle
                                cx="18" cy="18" r="14"
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="4"
                                strokeDasharray={`${(tradingData.holding / (tradingData.bought || 1)) * 88} 88`}
                                strokeLinecap="round"
                                transform="rotate(-90 18 18)"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-medium text-white">${formatNumber(tradingData.holding)}</span>
                            </div>
                          </div>
                          {/* Legend */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span className="text-xs text-gray-400">Holdings</span>
                              </div>
                              <span className="text-xs text-white">${formatNumber(tradingData.holding)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="text-xs text-gray-400">Bought</span>
                              </div>
                              <span className="text-xs text-white">${formatNumber(tradingData.bought)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <span className="text-xs text-gray-400">Sold</span>
                              </div>
                              <span className="text-xs text-white">${formatNumber(tradingData.sold)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-500 text-xs">No holdings</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Trades */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
                  <h3 className="text-sm font-medium text-gray-200 mb-3">Recent Trades</h3>
                  {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-hide">
                      {tradingData.recentTrades.slice(0, 10).map((trade, idx) => (
                        <div key={trade.id || idx} className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                              trade.type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {(trade.type || 'BUY').toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-200">{shortenToken(trade.tokenOut)}</span>
                            <span className="text-gray-500 text-[10px]">{trade.timestamp ? formatTimeAgo(trade.timestamp) : ''}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-200">{formatTokenAmount(trade.amountOut)}</div>
                            <div className="text-gray-500 text-[10px]">{formatTokenAmount(trade.amountIn)} {trade.tokenIn === 'ETH' ? 'ETH' : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-xs">No recent trades</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "positions" && (() => {
              const openTotalPages = Math.ceil(openPositions.length / POSITIONS_PER_PAGE);
              const closedTotalPages = Math.ceil(closedPositions.length / POSITIONS_PER_PAGE);
              const paginatedOpenPositions = openPositions.slice(
                (openPositionsPage - 1) * POSITIONS_PER_PAGE,
                openPositionsPage * POSITIONS_PER_PAGE
              );
              const paginatedClosedPositions = closedPositions.slice(
                (closedPositionsPage - 1) * POSITIONS_PER_PAGE,
                closedPositionsPage * POSITIONS_PER_PAGE
              );
              
              return (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4 md:max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-hide">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-200">Positions</h3>
                    <div className="text-xs text-gray-500">
                      {openPositions.length} open · {closedPositions.length} closed
                    </div>
                  </div>
                  {openPositions.length > 0 || closedPositions.length > 0 ? (
                    <div className="space-y-4">
                      {/* Open Positions Section */}
                      {openPositions.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Open Positions</h4>
                            {openTotalPages > 1 && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setOpenPositionsPage(p => Math.max(1, p - 1))}
                                  disabled={openPositionsPage === 1}
                                  className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-700/50 text-sm text-gray-300 hover:bg-gray-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  ‹
                                </button>
                                <span className="text-xs text-gray-400 min-w-[40px] text-center">{openPositionsPage} / {openTotalPages}</span>
                                <button
                                  onClick={() => setOpenPositionsPage(p => Math.min(openTotalPages, p + 1))}
                                  disabled={openPositionsPage === openTotalPages}
                                  className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-700/50 text-sm text-gray-300 hover:bg-gray-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  ›
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {paginatedOpenPositions.map((pos, idx) => {
                              const pnl = pos.pnl ?? 0;
                              const pnlPct = pos.pnlPercentage ?? 0;
                              const isPositive = pnl >= 0 && Math.abs(pnl) >= 0.01;
                              const isNeutral = Math.abs(pnl) < 0.01;
                              
                              return (
                                <div key={pos.tokenAddress || idx} className="p-2.5 bg-gray-700/30 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-medium text-gray-200 truncate">{shortenToken(pos.tokenSymbol)}</div>
                                      <div className="text-[10px] text-gray-500">Qty: {formatTokenAmount(pos.amount)}</div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                      <div className={`text-xs font-medium ${isNeutral ? 'text-gray-400' : isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                        {isNeutral ? '$0.00' : `${pnl >= 0 ? '+' : '-'}$${formatPnLValue(Math.abs(pnl))}`}
                                      </div>
                                      <div className={`text-[10px] ${isNeutral ? 'text-gray-500' : isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                        {isNeutral ? '0%' : `${pnlPct >= 0 ? '+' : '-'}${formatPercentage(Math.abs(pnlPct))}%`}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Closed Positions Section */}
                      {closedPositions.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Closed Positions</h4>
                            {closedTotalPages > 1 && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setClosedPositionsPage(p => Math.max(1, p - 1))}
                                  disabled={closedPositionsPage === 1}
                                  className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-700/50 text-sm text-gray-300 hover:bg-gray-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  ‹
                                </button>
                                <span className="text-xs text-gray-400 min-w-[40px] text-center">{closedPositionsPage} / {closedTotalPages}</span>
                                <button
                                  onClick={() => setClosedPositionsPage(p => Math.min(closedTotalPages, p + 1))}
                                  disabled={closedPositionsPage === closedTotalPages}
                                  className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-700/50 text-sm text-gray-300 hover:bg-gray-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  ›
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {paginatedClosedPositions.map((pos, idx) => {
                              const pnl = pos.pnl ?? 0;
                              const pnlPct = pos.pnlPercentage ?? 0;
                              const isPositive = pnl >= 0 && Math.abs(pnl) >= 0.01;
                              const isNeutral = Math.abs(pnl) < 0.01;
                              
                              return (
                                <div key={`${pos.tokenAddress || idx}-${pos.exitDate || idx}`} className="p-2.5 bg-gray-700/30 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-medium text-gray-200 truncate">{shortenToken(pos.tokenSymbol)}</div>
                                      <div className="text-[10px] text-gray-500">{pos.exitDate ? formatDate(pos.exitDate) : ''}</div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                      <div className={`text-xs font-medium ${isNeutral ? 'text-gray-400' : isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                        {isNeutral ? '$0.00' : `${pnl >= 0 ? '+' : '-'}$${formatPnLValue(Math.abs(pnl))}`}
                                      </div>
                                      <div className={`text-[10px] ${isNeutral ? 'text-gray-500' : isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                        {isNeutral ? '0%' : `${pnlPct >= 0 ? '+' : '-'}${formatPercentage(Math.abs(pnlPct))}%`}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-xs">No positions found</div>
                  )}
                </div>
              );
            })()}

            {activeTab === "trades" && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm font-medium text-gray-200 mb-3">Trade History</h3>
                {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                  <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full">
                      <thead className="text-[10px] text-gray-500 border-b border-gray-700 uppercase tracking-wider">
                        <tr>
                          <th className="text-left py-2 font-medium">Time</th>
                          <th className="text-left py-2 font-medium">Type</th>
                          <th className="text-left py-2 font-medium">Token In</th>
                          <th className="text-left py-2 font-medium">Token Out</th>
                          <th className="text-right py-2 font-medium">Amount In</th>
                          <th className="text-right py-2 font-medium">Amount Out</th>
                          <th className="text-center py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tradingData.recentTrades.map((trade, idx) => (
                          <tr key={trade.id || idx} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                            <td className="py-2 text-xs text-gray-400">{trade.timestamp ? formatTimeAgo(trade.timestamp) : '-'}</td>
                            <td className="py-2">
                              <span className={`text-xs font-medium ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                {(trade.type || 'BUY').toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2 text-xs text-gray-300">{trade.tokenIn === 'ETH' ? 'ETH' : shortenToken(trade.tokenIn)}</td>
                            <td className="py-2 text-xs text-gray-300">{trade.tokenOut === 'ETH' ? 'ETH' : shortenToken(trade.tokenOut)}</td>
                            <td className="py-2 text-xs text-gray-300 text-right font-mono">{formatTokenAmount(trade.amountIn)}</td>
                            <td className="py-2 text-xs text-gray-300 text-right font-mono">{formatTokenAmount(trade.amountOut)}</td>
                            <td className="py-2 text-center">
                              <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                                trade.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                trade.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {trade.status || 'completed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-xs">No trades found</div>
                )}
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
                  <h3 className="text-sm font-medium text-gray-200 mb-3">Trading Statistics</h3>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Total Trades</span>
                      <span className="text-gray-200">{tradingData?.totalTrades ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Completed</span>
                      <span className="text-gray-200">{tradingData?.completedTrades ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Positions Closed</span>
                      <span className="text-gray-200">{tradingData?.positionsClosed ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Total Bought</span>
                      <span className="text-green-400 font-mono">${formatNumber(tradingData?.bought ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Total Sold</span>
                      <span className="text-red-400 font-mono">${formatNumber(tradingData?.sold ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Holdings</span>
                      <span className="text-gray-200 font-mono">${formatNumber(tradingData?.holding ?? 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-200 mb-3">Performance Metrics</h3>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Win Rate</span>
                      <span className="text-gray-200">{formatNumber(tradingData?.winRate ?? 0)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Total P&L</span>
                      <span className={`font-mono ${(tradingData?.totalPnL ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${formatNumber(tradingData?.totalPnL ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">P&L %</span>
                      <span className={`${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatNumber(tradingData?.totalPnLPercentage ?? 0)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Avg Trade Size</span>
                      <span className="text-gray-200 font-mono">
                        ${tradingData?.totalTrades && tradingData.totalTrades > 0 
                          ? formatNumber(tradingData.totalVolume / tradingData.totalTrades)
                          : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tax" && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-200 mb-4">Tax Report</h3>
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Generate Report</label>
                    <div className="flex gap-2">
                      <select className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-xs text-gray-200">
                        <option>2025</option>
                        <option>2024</option>
                        <option>2023</option>
                      </select>
                      <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors">
                        Generate
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Multi-Wallet Tracking</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter wallet address"
                        className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-xs text-gray-200 placeholder-gray-500"
                      />
                      <button className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors">
                        + Add
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Primary Wallet</label>
                    <div className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 font-mono text-[10px]">
                      {walletAddress || 'No wallet connected'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
