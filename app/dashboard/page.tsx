"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Header from "@/app/components/Header";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { FaLayerGroup } from "react-icons/fa";
import { FiChevronDown, FiCheck, FiRefreshCw } from "react-icons/fi";
import toast from "react-hot-toast";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatNumber = (value: number | string | undefined | null, decimals: number = 2): string => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  if (Math.abs(num) < 0.0001 && num !== 0) {
    return num.toExponential(2);
  }
  
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  
  return num.toFixed(decimals);
};

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

const shortenToken = (token: string | undefined | null): string => {
  if (!token) return '-';
  if (token.length <= 10) return token;
  if (token.startsWith('0x')) return `${token.slice(0, 6)}...${token.slice(-4)}`;
  return token;
};

const formatPercentage = (pct: number | null | undefined): string => {
  if (pct === null || pct === undefined || !isFinite(pct)) return '0';
  
  if (Math.abs(pct) < 0.01) return '0';
  if (pct > 9999) return '>9,999';
  if (pct < -9999) return '<-9,999';
  
  if (Math.abs(pct) >= 1000) return `${(pct / 1000).toFixed(1)}K`;
  if (Math.abs(pct) >= 100) return pct.toFixed(0);
  if (Math.abs(pct) >= 10) return pct.toFixed(1);
  return pct.toFixed(2);
};

const formatPnLValue = (pnl: number | null | undefined): string => {
  if (pnl === null || pnl === undefined || !isFinite(pnl)) return '0.00';
  if (Math.abs(pnl) < 0.01) return '0.00';
  return formatNumber(pnl);
};

const POSITIONS_PER_PAGE = 4;

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'open':
      case 'completed':
        return 'text-emerald-400';
      case 'pending':
      case 'synced':
        return 'text-amber-400';
      case 'error':
      case 'failed':
      case 'closed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <span className={`text-[10px] uppercase tracking-wider ${getStatusColor()}`}>
      {status}
    </span>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export default function DashboardPage() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "trades" | "analytics" | "tax">("overview");
  const [tradingData, setTradingData] = useState<TradingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d" | "all">("30d");
  
  const [allWallets, setAllWallets] = useState<WalletData[]>([]);
  const [selectedWalletIndex, setSelectedWalletIndex] = useState<number | 'all'>(0);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const walletSelectorRef = useRef<HTMLDivElement>(null);
  
  const [openPositionsPage, setOpenPositionsPage] = useState(1);
  const [closedPositionsPage, setClosedPositionsPage] = useState(1);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletSelectorRef.current && !walletSelectorRef.current.contains(event.target as Node)) {
        setShowWalletSelector(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      const storedWallets = typeof window !== "undefined" ? localStorage.getItem("cypherx_wallets") : null;
      if (storedWallets) {
        const storage: WalletsStorage = JSON.parse(storedWallets);
        if (storage.wallets && storage.wallets.length > 0) {
          setAllWallets(storage.wallets);
          setSelectedWalletIndex(storage.activeIndex);
          setWalletAddress(storage.wallets[storage.activeIndex].address);
        }
      } else {
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
    
    const onWalletUpdate = () => {
      try {
        const storedWallets = localStorage.getItem("cypherx_wallets");
        if (storedWallets) {
          const storage: WalletsStorage = JSON.parse(storedWallets);
          if (storage.wallets && storage.wallets.length > 0) {
            setAllWallets(storage.wallets);
            if (selectedWalletIndex !== 'all') {
              const idx = Math.min(typeof selectedWalletIndex === 'number' ? selectedWalletIndex : 0, storage.wallets.length - 1);
              setSelectedWalletIndex(idx);
              setWalletAddress(storage.wallets[idx].address);
            }
          } else {
            setAllWallets([]);
            setSelectedWalletIndex(0);
            setWalletAddress("");
            setTradingData(null);
          }
        } else {
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

  const fetchWalletData = useCallback(async (address: string, timeframeParam: string): Promise<TradingData | null> => {
    try {
      const response = await fetch(`/api/wallet/pnl?address=${address}&timeframe=${timeframeParam}`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error("Error fetching trading data for", address, error);
    }
    return null;
  }, []);

  const mergeTradeData = useCallback((dataArray: (TradingData | null)[]): TradingData => {
    const validData = dataArray.filter((d): d is TradingData => d !== null);
    
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

    const totalPnL = validData.reduce((sum, d) => sum + (d.totalPnL || 0), 0);
    const totalVolume = validData.reduce((sum, d) => sum + (d.totalVolume || 0), 0);
    const totalTrades = validData.reduce((sum, d) => sum + (d.totalTrades || 0), 0);
    const bought = validData.reduce((sum, d) => sum + (d.bought || 0), 0);
    const sold = validData.reduce((sum, d) => sum + (d.sold || 0), 0);
    const holding = validData.reduce((sum, d) => sum + (d.holding || 0), 0);
    const positionsClosed = validData.reduce((sum, d) => sum + (d.positionsClosed || 0), 0);
    const completedTrades = validData.reduce((sum, d) => sum + (d.completedTrades || 0), 0);
    
    const totalWins = validData.reduce((sum, d) => sum + ((d.winRate || 0) / 100 * (d.completedTrades || 0)), 0);
    const winRate = completedTrades > 0 ? (totalWins / completedTrades) * 100 : 0;
    
    const totalPnLPercentage = totalVolume > 0 ? (totalPnL / totalVolume) * 100 : 0;

    const dailyPnLMap = new Map<string, number>();
    validData.forEach(d => {
      (d.dailyPnL || []).forEach(({ date, pnl }) => {
        dailyPnLMap.set(date, (dailyPnLMap.get(date) || 0) + pnl);
      });
    });
    const dailyPnL = Array.from(dailyPnLMap.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const recentTrades = validData
      .flatMap(d => d.recentTrades || [])
      .sort((a, b) => b.timestamp - a.timestamp);

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
    
    const ts = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
    const now = Date.now();
    const diff = now - ts;
    
    if (diff < 0 || isNaN(diff)) return '-';
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleRefresh = () => {
    if (selectedWalletIndex === 'all' && allWallets.length > 0) {
      const timeframeParam = timeframe === "7d" ? "7D" : timeframe === "30d" ? "30D" : timeframe === "90d" ? "90D" : "ALL";
      Promise.all(allWallets.map(w => 
        fetch(`/api/wallet/pnl?address=${w.address}&timeframe=${timeframeParam}`)
          .then(r => r.json())
          .catch(() => null)
      )).then(allData => {
        const merged = mergeTradeData(allData);
        setTradingData(merged);
        toast.success('Refreshed');
      });
    } else if (walletAddress) {
      const timeframeParam = timeframe === "7d" ? "7D" : timeframe === "30d" ? "30D" : timeframe === "90d" ? "90D" : "ALL";
      fetch(`/api/wallet/pnl?address=${walletAddress}&timeframe=${timeframeParam}`)
        .then(r => r.json())
        .then(data => {
          setTradingData(data);
          toast.success('Refreshed');
        })
        .catch(console.error);
    }
  };

  const openPositions = useMemo(() => {
    return (tradingData?.positionsHistory || []).filter(p => {
      if (!p || p.status !== 'open') return false;
      const costBasis = (p.entryPrice ?? 0) * (p.amount ?? 0);
      return costBasis > 0;
    });
  }, [tradingData]);

  const closedPositions = useMemo(() => {
    return (tradingData?.positionsHistory || []).filter(p => {
      if (!p || p.status !== 'closed') return false;
      const costBasis = (p.entryPrice ?? 0) * (p.amount ?? 0);
      return costBasis > 0;
    });
  }, [tradingData]);

  return (
    <div className="h-screen bg-gray-950 text-gray-200 flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-3 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-medium text-white">Trading Dashboard</h1>
            <div className="relative mt-1.5" ref={walletSelectorRef}>
              <button
                onClick={() => setShowWalletSelector(!showWalletSelector)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded-lg hover:border-gray-600/50 hover:bg-gray-800/70 transition-all text-sm text-gray-200 w-full sm:w-auto"
              >
                {selectedWalletIndex === 'all' ? (
                  <span className="text-gray-200">All Wallets ({allWallets.length})</span>
                ) : (
                  <span className="text-gray-200">
                    {allWallets[selectedWalletIndex]?.alias || `Account ${selectedWalletIndex + 1}`}
                    {walletAddress && (
                      <span className="text-gray-400 ml-1.5 text-xs">
                        ({walletAddress.slice(0, 6)}...{walletAddress.slice(-4)})
                      </span>
                    )}
                  </span>
                )}
                <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showWalletSelector ? 'rotate-180' : ''}`} />
              </button>
              
              {showWalletSelector && (
                <div className="absolute top-full left-0 mt-1.5 w-full sm:w-72 bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-2">
                    {allWallets.length > 1 && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedWalletIndex('all');
                            setWalletAddress('');
                            setShowWalletSelector(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm ${
                            selectedWalletIndex === 'all'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'text-gray-300 hover:bg-gray-800/60'
                          }`}
                        >
                          <span>All Wallets ({allWallets.length})</span>
                          {selectedWalletIndex === 'all' && <FiCheck className="w-4 h-4 text-blue-400" />}
                        </button>
                        <div className="border-t border-gray-700/50 my-2"></div>
                      </>
                    )}
                    
                    <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide">
                      {allWallets.map((wallet, index) => (
                        <button
                          key={wallet.address}
                          onClick={() => {
                            setSelectedWalletIndex(index);
                            setWalletAddress(wallet.address);
                            setShowWalletSelector(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm ${
                            selectedWalletIndex === index
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'text-gray-300 hover:bg-gray-800/60'
                          }`}
                        >
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm text-gray-200 truncate">{wallet.alias || `Account ${index + 1}`}</p>
                            <p className="text-xs text-gray-500 font-mono truncate">{wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}</p>
                          </div>
                          {selectedWalletIndex === index && <FiCheck className="w-4 h-4 text-blue-400 flex-shrink-0 ml-2" />}
                        </button>
                      ))}
                    </div>
                    
                    {allWallets.length === 0 && (
                      <div className="text-center py-4 text-gray-400 text-sm">No wallets found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/60 rounded-lg transition-colors flex-shrink-0 self-start sm:self-auto"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Consolidated Banner */}
        {selectedWalletIndex === 'all' && allWallets.length > 1 && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2 mb-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <FaLayerGroup className="w-3 h-3 text-blue-400" />
              <span className="text-blue-300">Consolidated: {allWallets.length} wallets</span>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3 flex-shrink-0">
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 sm:p-3">
            <div className="text-xs text-gray-400 mb-1">
              Total P&L {selectedWalletIndex === 'all' && <span className="text-blue-400 normal-case">(All)</span>}
            </div>
            <div className={`text-base sm:text-lg font-medium ${(tradingData?.totalPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(tradingData?.totalPnL ?? 0) >= 0 ? '+' : '-'}${formatNumber(Math.abs(tradingData?.totalPnL ?? 0))}
            </div>
            <div className={`text-xs font-medium ${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(tradingData?.totalPnLPercentage ?? 0) >= 0 ? '+' : ''}{formatNumber(tradingData?.totalPnLPercentage ?? 0)}%
            </div>
          </div>
          
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 sm:p-3">
            <div className="text-xs text-gray-400 mb-1">
              Volume {selectedWalletIndex === 'all' && <span className="text-blue-400 normal-case">(All)</span>}
            </div>
            <div className="text-base sm:text-lg font-medium text-gray-200">
              ${formatNumber(tradingData?.totalVolume ?? 0)}
            </div>
            <div className="text-xs text-gray-500">
              {tradingData?.totalTrades ?? 0} trades
            </div>
          </div>
          
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 sm:p-3">
            <div className="text-xs text-gray-400 mb-1">
              Win Rate {selectedWalletIndex === 'all' && <span className="text-blue-400 normal-case">(All)</span>}
            </div>
            <div className="text-base sm:text-lg font-medium text-gray-200">
              {formatNumber(tradingData?.winRate ?? 0, 0)}%
            </div>
            <div className="text-xs text-gray-500">
              {tradingData?.completedTrades ?? 0} completed
            </div>
          </div>
          
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 sm:p-3">
            <div className="text-xs text-gray-400 mb-1">
              Positions {selectedWalletIndex === 'all' && <span className="text-blue-400 normal-case">(All)</span>}
            </div>
            <div className="text-base sm:text-lg font-medium text-gray-200">
              {openPositions.length} open
            </div>
            <div className="text-xs text-gray-500">
              {closedPositions.length} closed
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 border-b border-gray-800/60 mb-2 flex-shrink-0 overflow-x-auto scrollbar-hide">
          {(["overview", "positions", "trades", "analytics", "tax"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 font-medium ${
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
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner variant="dots" size="md" text="Loading..." />
            </div>
          ) : !walletAddress ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-4">
                  Connect your wallet to view trading data
                </p>
                <button
                  onClick={() => {
                    try {
                      (window as any).dispatchEvent(new CustomEvent('open-wallet'));
                    } catch {}
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                >
                  Connect Wallet
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto scrollbar-hide">
              {activeTab === "overview" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* P&L Chart */}
                    <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 sm:p-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div className="text-sm font-medium text-gray-300">P&L Over Time</div>
                        <div className="flex bg-gray-800/60 rounded p-0.5">
                          {(["7d", "30d", "90d", "all"] as const).map((tf) => (
                            <button
                              key={tf}
                              onClick={() => setTimeframe(tf)}
                              className={`px-2 sm:px-3 py-1 text-xs rounded transition-colors font-medium ${
                                timeframe === tf
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-400 hover:text-gray-200"
                              }`}
                            >
                              {tf === 'all' ? 'ALL' : tf.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="h-32">
                        {(() => {
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
                            return <div className="h-full flex items-center justify-center text-gray-500 text-xs">No data</div>;
                          }

                          let cumulative = 0;
                          const rawCumulativeData = filteredData.map(d => {
                            cumulative += d.pnl;
                            return { ...d, cumPnl: cumulative };
                          });
                          
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
                          const padding = range * 0.1;
                          const adjustedMin = minVal - padding;
                          const adjustedMax = maxVal + padding;
                          const adjustedRange = adjustedMax - adjustedMin || 1;

                          const chartWidth = 300;
                          const chartHeight = 80;
                          const leftPadding = 40;
                          const rightPadding = 10;
                          const topPadding = 5;
                          const bottomPadding = 20;

                          const points = cumulativeData.map((d, i) => {
                            const x = leftPadding + (i / (cumulativeData.length - 1 || 1)) * (chartWidth - leftPadding - rightPadding);
                            const y = topPadding + (1 - (d.cumPnl - adjustedMin) / adjustedRange) * chartHeight;
                            return `${x},${y}`;
                          }).join(' ');

                          const lastValue = tradingData?.totalPnL ?? 0;
                          const isPositive = lastValue >= 0;
                          
                          const firstX = leftPadding;
                          const lastX = leftPadding + (chartWidth - leftPadding - rightPadding);
                          const baseY = topPadding + chartHeight;
                          const areaPoints = `${firstX},${baseY} ${points} ${lastX},${baseY}`;

                          const zeroY = topPadding + (1 - (0 - adjustedMin) / adjustedRange) * chartHeight;

                          return (
                            <div className="w-full h-full">
                              <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight + topPadding + bottomPadding}`} preserveAspectRatio="xMidYMid meet">
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
                                <polygon
                                  points={areaPoints}
                                  fill={isPositive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"}
                                />
                                <polyline
                                  points={points}
                                  fill="none"
                                  stroke={isPositive ? "#10b981" : "#ef4444"}
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                {cumulativeData.length > 0 && (
                                  <circle
                                    cx={lastX}
                                    cy={topPadding + (1 - (lastValue - adjustedMin) / adjustedRange) * chartHeight}
                                    r="3"
                                    fill={isPositive ? "#10b981" : "#ef4444"}
                                  />
                                )}
                              </svg>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Portfolio Allocation */}
                    <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 sm:p-3">
                      <div className="text-sm font-medium text-gray-300 mb-2">Portfolio Allocation</div>
                      <div className="h-32">
                        {tradingData?.holding && tradingData.holding > 0 ? (
                          <div className="flex items-center h-full gap-4">
                            <div className="relative w-20 h-20 flex-shrink-0">
                              <svg viewBox="0 0 36 36" className="w-full h-full">
                                <circle
                                  cx="18" cy="18" r="14"
                                  fill="none"
                                  stroke="#1f2937"
                                  strokeWidth="3"
                                />
                                <circle
                                  cx="18" cy="18" r="14"
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth="3"
                                  strokeDasharray={`${(tradingData.holding / (tradingData.bought || 1)) * 88} 88`}
                                  strokeLinecap="round"
                                  transform="rotate(-90 18 18)"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs text-gray-200">${formatNumber(tradingData.holding)}</span>
                              </div>
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Holdings</span>
                                <span className="text-gray-200 font-medium">${formatNumber(tradingData.holding)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Bought</span>
                                <span className="text-gray-200 font-medium">${formatNumber(tradingData.bought)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Sold</span>
                                <span className="text-gray-200 font-medium">${formatNumber(tradingData.sold)}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-500 text-xs">No holdings</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 sm:p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-300">Recent Activity</div>
                      <button 
                        onClick={() => setActiveTab('trades')}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
                      >
                        View All
                      </button>
                    </div>
                    {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                      <div className="space-y-1.5">
                        {tradingData.recentTrades.slice(0, 4).map((trade, idx) => (
                          <div 
                            key={trade.id || idx} 
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 p-2 bg-gray-800/40 rounded hover:bg-gray-800/60 transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                trade.type === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {trade.type.toUpperCase()}
                              </span>
                              <span className="text-sm font-medium text-gray-200 truncate">{shortenToken(trade.tokenOut)}</span>
                              <span className="text-xs text-gray-500">{formatTimeAgo(trade.timestamp)}</span>
                            </div>
                            <div className="text-left sm:text-right">
                              <div className="text-sm font-medium text-gray-200">{formatTokenAmount(trade.amountOut)}</div>
                              <div className="text-xs text-gray-500">{formatTokenAmount(trade.amountIn)} {trade.tokenIn === 'ETH' ? 'ETH' : ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-400 text-sm">No recent activity</div>
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
                  <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 sm:p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 mb-2">
                      <div className="text-sm font-medium text-gray-300">Positions</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Open: {openPositions.length}</span>
                        <span>•</span>
                        <span>Closed: {closedPositions.length}</span>
                      </div>
                    </div>
                    
                    {openPositions.length > 0 || closedPositions.length > 0 ? (
                      <div className="space-y-4">
                        {openPositions.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="text-xs text-gray-400 uppercase tracking-wider">Open</div>
                              {openTotalPages > 1 && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setOpenPositionsPage(p => Math.max(1, p - 1))}
                                    disabled={openPositionsPage === 1}
                                    className="w-7 h-7 flex items-center justify-center rounded bg-gray-800/60 text-sm text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition-colors"
                                  >
                                    ‹
                                  </button>
                                  <span className="text-xs text-gray-500 min-w-[30px] text-center">{openPositionsPage}/{openTotalPages}</span>
                                  <button
                                    onClick={() => setOpenPositionsPage(p => Math.min(openTotalPages, p + 1))}
                                    disabled={openPositionsPage === openTotalPages}
                                    className="w-7 h-7 flex items-center justify-center rounded bg-gray-800/60 text-sm text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition-colors"
                                  >
                                    ›
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              {paginatedOpenPositions.map((pos, idx) => {
                                const pnl = pos.pnl ?? 0;
                                const pnlPct = pos.pnlPercentage ?? 0;
                                const isPositive = pnl >= 0 && Math.abs(pnl) >= 0.01;
                                const isNeutral = Math.abs(pnl) < 0.01;
                                
                                return (
                                  <div 
                                    key={pos.tokenAddress || idx} 
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 p-2 bg-gray-800/40 rounded hover:bg-gray-800/60 transition-colors"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-200 truncate">{shortenToken(pos.tokenSymbol)}</div>
                                      <div className="text-xs text-gray-500">Qty: {formatTokenAmount(pos.amount)}</div>
                                    </div>
                                    <div className="text-left sm:text-right flex-shrink-0">
                                      <div className={`text-sm font-medium ${isNeutral ? 'text-gray-400' : isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isNeutral ? '$0.00' : `${pnl >= 0 ? '+' : '-'}$${formatPnLValue(Math.abs(pnl))}`}
                                      </div>
                                      <div className={`text-xs ${isNeutral ? 'text-gray-500' : isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                        {isNeutral ? '0%' : `${pnlPct >= 0 ? '+' : '-'}${formatPercentage(Math.abs(pnlPct))}%`}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {closedPositions.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="text-xs text-gray-400 uppercase tracking-wider">Closed</div>
                              {closedTotalPages > 1 && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setClosedPositionsPage(p => Math.max(1, p - 1))}
                                    disabled={closedPositionsPage === 1}
                                    className="w-7 h-7 flex items-center justify-center rounded bg-gray-800/60 text-sm text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition-colors"
                                  >
                                    ‹
                                  </button>
                                  <span className="text-[10px] text-gray-500 min-w-[30px] text-center">{closedPositionsPage}/{closedTotalPages}</span>
                                  <button
                                    onClick={() => setClosedPositionsPage(p => Math.min(closedTotalPages, p + 1))}
                                    disabled={closedPositionsPage === closedTotalPages}
                                    className="w-7 h-7 flex items-center justify-center rounded bg-gray-800/60 text-sm text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition-colors"
                                  >
                                    ›
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              {paginatedClosedPositions.map((pos, idx) => {
                                const pnl = pos.pnl ?? 0;
                                const pnlPct = pos.pnlPercentage ?? 0;
                                const isPositive = pnl >= 0 && Math.abs(pnl) >= 0.01;
                                const isNeutral = Math.abs(pnl) < 0.01;
                                
                                return (
                                  <div 
                                    key={`${pos.tokenAddress || idx}-${pos.exitDate || idx}`} 
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 p-2 bg-gray-800/40 rounded hover:bg-gray-800/60 transition-colors"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-200 truncate">{shortenToken(pos.tokenSymbol)}</div>
                                      <div className="text-xs text-gray-500">{pos.exitDate ? formatDate(pos.exitDate) : '—'}</div>
                                    </div>
                                    <div className="text-left sm:text-right flex-shrink-0">
                                      <div className={`text-sm font-medium ${isNeutral ? 'text-gray-400' : isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isNeutral ? '$0.00' : `${pnl >= 0 ? '+' : '-'}$${formatPnLValue(Math.abs(pnl))}`}
                                      </div>
                                      <div className={`text-xs ${isNeutral ? 'text-gray-500' : isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                        {isNeutral ? '0%' : `${pnlPct >= 0 ? '+' : '-'}${formatPercentage(Math.abs(pnlPct))}%`}
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
                <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-300 mb-2">Trade History</div>
                  {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                    <div className="overflow-x-auto scrollbar-hide">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="border-b border-gray-800/60">
                            <th className="text-left py-2 px-2 text-xs text-gray-400 uppercase tracking-wider">Time</th>
                            <th className="text-left py-2 px-2 text-xs text-gray-400 uppercase tracking-wider">Type</th>
                            <th className="text-left py-2 px-2 text-xs text-gray-400 uppercase tracking-wider">Token</th>
                            <th className="text-right py-2 px-2 text-xs text-gray-400 uppercase tracking-wider">Amount</th>
                            <th className="text-center py-2 px-2 text-xs text-gray-400 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tradingData.recentTrades.map((trade, idx) => (
                            <tr 
                              key={trade.id || idx} 
                              className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors"
                            >
                              <td className="py-2 px-2 text-sm text-gray-400">{formatTimeAgo(trade.timestamp)}</td>
                              <td className="py-2 px-2">
                                <span className={`text-sm font-medium ${trade.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {trade.type.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-sm font-medium text-gray-300">{trade.tokenOut === 'ETH' ? 'ETH' : shortenToken(trade.tokenOut)}</td>
                              <td className="py-2 px-2 text-sm font-medium text-gray-300 text-right font-mono">{formatTokenAmount(trade.amountOut)}</td>
                              <td className="py-2 px-1 text-center">
                                <StatusBadge status={trade.status || 'completed'} />
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 sm:p-3">
                    <div className="text-sm font-medium text-gray-300 mb-2">Trading Statistics</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm py-2 border-b border-gray-800/40">
                        <span className="text-gray-400">Total Trades</span>
                        <span className="text-gray-200 font-medium">{tradingData?.totalTrades ?? 0}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2 border-b border-gray-800/40">
                        <span className="text-gray-400">Completed</span>
                        <span className="text-gray-200 font-medium">{tradingData?.completedTrades ?? 0}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2 border-b border-gray-800/40">
                        <span className="text-gray-400">Positions Closed</span>
                        <span className="text-gray-200 font-medium">{tradingData?.positionsClosed ?? 0}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2 border-b border-gray-800/40">
                        <span className="text-gray-400">Total Bought</span>
                        <span className="text-emerald-400 font-medium">${formatNumber(tradingData?.bought ?? 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2 border-b border-gray-800/40">
                        <span className="text-gray-400">Total Sold</span>
                        <span className="text-red-400 font-medium">${formatNumber(tradingData?.sold ?? 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2">
                        <span className="text-gray-400">Holdings</span>
                        <span className="text-gray-200 font-medium">${formatNumber(tradingData?.holding ?? 0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-2.5 sm:p-3">
                    <div className="text-sm font-medium text-gray-300 mb-2">Performance Metrics</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm py-2 border-b border-gray-800/40">
                        <span className="text-gray-400">Win Rate</span>
                        <span className="text-gray-200 font-medium">{formatNumber(tradingData?.winRate ?? 0)}%</span>
                      </div>
                      <div className="flex justify-between text-sm py-2 border-b border-gray-800/40">
                        <span className="text-gray-400">Total P&L</span>
                        <span className={`font-medium ${(tradingData?.totalPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(tradingData?.totalPnL ?? 0) >= 0 ? '+' : ''}${formatNumber(tradingData?.totalPnL ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm py-2 border-b border-gray-800/40">
                        <span className="text-gray-400">P&L %</span>
                        <span className={`font-medium ${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(tradingData?.totalPnLPercentage ?? 0) >= 0 ? '+' : ''}{formatNumber(tradingData?.totalPnLPercentage ?? 0)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm py-2">
                        <span className="text-gray-400">Avg Trade Size</span>
                        <span className="text-gray-200 font-medium">
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
                <div className="h-full flex flex-col">
                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-24">
                    <div className="space-y-4">
                      {/* Tax Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">Realized Gains</div>
                          <div className="text-lg font-medium text-emerald-400">
                            ${(() => {
                              const closed = closedPositions.filter(p => p.pnl > 0);
                              return formatNumber(closed.reduce((sum, p) => sum + p.pnl, 0));
                            })()}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {closedPositions.filter(p => p.pnl > 0).length} profitable trades
                          </div>
                        </div>
                        
                        <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">Realized Losses</div>
                          <div className="text-lg font-medium text-red-400">
                            ${(() => {
                              const closed = closedPositions.filter(p => p.pnl < 0);
                              return formatNumber(Math.abs(closed.reduce((sum, p) => sum + p.pnl, 0)));
                            })()}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {closedPositions.filter(p => p.pnl < 0).length} losing trades
                          </div>
                        </div>
                        
                        <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">Net Realized P&L</div>
                          <div className={`text-lg font-medium ${(() => {
                            const net = closedPositions.reduce((sum, p) => sum + p.pnl, 0);
                            return net >= 0 ? 'text-emerald-400' : 'text-red-400';
                          })()}`}>
                            ${(() => {
                              const net = closedPositions.reduce((sum, p) => sum + p.pnl, 0);
                              return formatNumber(Math.abs(net));
                            })()}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {closedPositions.length} closed positions
                          </div>
                        </div>
                      </div>

                      {/* Main Tax Report Section */}
                      <div className="bg-gray-900/60 border border-gray-800/60 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-medium text-gray-200">Tax Report Generator</h3>
                        <p className="text-xs text-gray-500 mt-1">Generate comprehensive tax reports for your trading activity</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Generate Report */}
                      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4">
                        <label className="block text-sm font-medium text-gray-300 mb-3">Generate Tax Report</label>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <select className="px-4 py-2.5 bg-gray-800/60 border border-gray-700/60 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                            <option>2025</option>
                            <option>2024</option>
                            <option>2023</option>
                            <option>2022</option>
                          </select>
                          <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors whitespace-nowrap font-medium flex items-center justify-center gap-2">
                            <span>Generate Report</span>
                          </button>
                          <button className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors whitespace-nowrap font-medium flex items-center justify-center gap-2">
                            <span>Export CSV</span>
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Reports include all trades, realized gains/losses, and transaction history</p>
                      </div>
                      
                      {/* Wallet Management */}
                      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4">
                        <label className="block text-sm font-medium text-gray-300 mb-3">Multi-Wallet Tracking</label>
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row gap-3">
                            <input
                              type="text"
                              placeholder="Enter wallet address (0x...)"
                              className="flex-1 px-4 py-2.5 bg-gray-800/60 border border-gray-700/60 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                            />
                            <button className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors whitespace-nowrap font-medium">
                              + Add Wallet
                            </button>
                          </div>
                          
                          {/* Tracked Wallets List */}
                          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                            <div className="text-xs text-gray-400 mb-2">Tracked Wallets ({walletAddress ? 1 : 0})</div>
                            {walletAddress && (
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-800/40 border border-gray-700/40 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-200 truncate font-mono">{walletAddress}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Primary Wallet</p>
                                </div>
                                <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded">Active</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Tax Settings */}
                      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4">
                        <label className="block text-sm font-medium text-gray-300 mb-3">Tax Settings</label>
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm text-gray-200">Cost Basis Method</p>
                              <p className="text-xs text-gray-500 mt-0.5">How to calculate cost basis for tax purposes</p>
                            </div>
                            <select className="px-3 py-2 bg-gray-800/60 border border-gray-700/60 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 sm:w-auto w-full">
                              <option>FIFO (First In, First Out)</option>
                              <option>LIFO (Last In, First Out)</option>
                              <option>Average Cost</option>
                              <option>Specific Identification</option>
                            </select>
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                            <div className="flex-1">
                              <p className="text-sm text-gray-200">Include Unrealized Gains</p>
                              <p className="text-xs text-gray-500 mt-0.5">Report open positions in tax calculations</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                              <input type="checkbox" className="sr-only peer" />
                              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick Stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">Total Trades (2024)</div>
                          <div className="text-lg font-medium text-gray-200">{tradingData?.totalTrades ?? 0}</div>
                        </div>
                        <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">Total Volume (2024)</div>
                          <div className="text-lg font-medium text-gray-200">${formatNumber(tradingData?.totalVolume ?? 0)}</div>
                        </div>
                      </div>
                    </div>
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

