"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { FaWallet, FaChevronDown, FaCheck, FaPlus } from "react-icons/fa";
import { FiChevronDown, FiRefreshCw, FiDownload, FiFileText, FiTrendingUp, FiTrendingDown, FiDollarSign, FiActivity, FiX } from "react-icons/fi";

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
  }>;
};

type Wallet = {
  address: string;
  alias?: string;
};

export default function DashboardPage() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [allWallets, setAllWallets] = useState<Wallet[]>([]);
  const [selectedWalletIndex, setSelectedWalletIndex] = useState<number | 'all'>('all');
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "trades" | "analytics" | "tax">("overview");
  const [tradingData, setTradingData] = useState<TradingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const walletSelectorRef = useRef<HTMLDivElement>(null);
  
  // Tax report state
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  const [taxReport, setTaxReport] = useState<any>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [additionalWallets, setAdditionalWallets] = useState<string[]>([]);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  
  // Load wallets from localStorage
  useEffect(() => {
    const loadWallets = () => {
      try {
        const wallets: Wallet[] = [];
        
        // Load single wallet from cypherx_wallet
        const raw = typeof window !== "undefined" ? localStorage.getItem("cypherx_wallet") : null;
        if (raw) {
          const data = JSON.parse(raw);
          if (data?.address) {
            wallets.push({
              address: data.address,
              alias: data.alias || `Wallet ${wallets.length + 1}`
            });
          }
        }
        
        // Load multiple wallets from cypherx_wallets (if exists)
        const walletsRaw = typeof window !== "undefined" ? localStorage.getItem("cypherx_wallets") : null;
        if (walletsRaw) {
          try {
            const walletsData = JSON.parse(walletsRaw);
            if (Array.isArray(walletsData)) {
              walletsData.forEach((wallet: Wallet) => {
                if (wallet.address && !wallets.find(w => w.address.toLowerCase() === wallet.address.toLowerCase())) {
                  wallets.push({
                    address: wallet.address,
                    alias: wallet.alias || `Wallet ${wallets.length + 1}`
                  });
                }
              });
            }
          } catch (e) {
            console.error("Error parsing wallets:", e);
          }
        }
        
        setAllWallets(wallets);
        
        // Set initial wallet address
        if (wallets.length > 0) {
          setWalletAddress(wallets[0].address);
          setSelectedWalletIndex(0);
        }
      } catch (error) {
        console.error("Error loading wallets:", error);
      }
    };
    
    loadWallets();
    
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cypherx_wallet" || e.key === "cypherx_wallets") {
        loadWallets();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  
  // Update wallet address when selection changes
  useEffect(() => {
    if (selectedWalletIndex === 'all') {
      // For 'all', we could aggregate data, but for now just use first wallet
      if (allWallets.length > 0) {
        setWalletAddress(allWallets[0].address);
      } else {
        setWalletAddress("");
      }
    } else if (typeof selectedWalletIndex === 'number' && allWallets[selectedWalletIndex]) {
      setWalletAddress(allWallets[selectedWalletIndex].address);
    }
  }, [selectedWalletIndex, allWallets]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletSelectorRef.current && !walletSelectorRef.current.contains(event.target as Node)) {
        setShowWalletSelector(false);
      }
    };
    
    if (showWalletSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWalletSelector]);

  useEffect(() => {
    const fetchTradingData = async () => {
      if (!walletAddress) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const timeframeParam = timeframe === "7d" ? "7D" : timeframe === "30d" ? "30D" : timeframe === "90d" ? "90D" : "ALL";
        const response = await fetch(`/api/wallet/pnl?address=${walletAddress}&timeframe=${timeframeParam}`);
      if (response.ok) {
        const data = await response.json();
          setTradingData(data);
      }
    } catch (error) {
        console.error("Error fetching trading data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTradingData();
  }, [walletAddress, timeframe]);

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const openPositions = useMemo(() => {
    return tradingData?.positionsHistory?.filter(p => p.status === 'open') || [];
  }, [tradingData]);

  const closedPositions = useMemo(() => {
    return tradingData?.positionsHistory?.filter(p => p.status === 'closed') || [];
  }, [tradingData]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 pb-0 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-white">Trading Dashboard</h1>
            {/* Wallet Selector */}
            <div className="relative mt-2" ref={walletSelectorRef}>
              <button
                onClick={() => setShowWalletSelector(!showWalletSelector)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/40 rounded-lg hover:bg-gray-800/60 transition-colors text-sm"
              >
                <FaWallet className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-300">
                  {selectedWalletIndex === 'all' 
                    ? 'All Wallets' 
                    : allWallets[selectedWalletIndex]?.alias || `Wallet ${(selectedWalletIndex as number) + 1}`}
                </span>
                <span className="text-gray-500 text-xs font-mono">
                  {walletAddress ? `(${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})` : ''}
                </span>
                <FiChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showWalletSelector ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Wallet Dropdown */}
              {showWalletSelector && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-2">
                    {allWallets.length > 0 ? (
                      <div className="space-y-1">
                        {allWallets.map((wallet, index) => (
                          <button
                            key={wallet.address}
                            onClick={() => {
                              setSelectedWalletIndex(index);
                              setShowWalletSelector(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all ${
                              selectedWalletIndex === index
                                ? 'bg-blue-500/10 border border-blue-500/30'
                                : 'hover:bg-gray-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                selectedWalletIndex === index ? 'bg-blue-600' : 'bg-gray-800'
                              }`}>
                                <FaWallet className="w-3.5 h-3.5 text-white" />
                              </div>
                              <div className="text-left min-w-0 flex-1">
                                <p className="text-sm font-medium text-white truncate">
                                  {wallet.alias || `Wallet ${index + 1}`}
                                </p>
                                <p className="text-xs text-gray-500 font-mono truncate">
                                  {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                                </p>
                              </div>
                            </div>
                            {selectedWalletIndex === index && (
                              <FaCheck className="w-4 h-4 text-blue-400 shrink-0 ml-2" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        <FaWallet className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        <p>No wallets found</p>
                        <p className="text-xs mt-1">Connect a wallet to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (walletAddress) {
                const timeframeParam = timeframe === "7d" ? "7D" : timeframe === "30d" ? "30D" : timeframe === "90d" ? "90D" : "ALL";
                fetch(`/api/wallet/pnl?address=${walletAddress}&timeframe=${timeframeParam}`)
                  .then(r => r.json())
                  .then(data => setTradingData(data))
                  .catch(console.error);
              }
            }}
            className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800/60 rounded-lg transition-colors"
            title="Refresh data"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 flex-shrink-0">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">TOTAL P&L</div>
            <div className={`text-xl font-semibold ${(tradingData?.totalPnL ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${Math.abs(tradingData?.totalPnL ?? 0).toFixed(2)}
            </div>
            <div className={`text-xs ${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(tradingData?.totalPnLPercentage ?? 0).toFixed(2)}%
            </div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">TOTAL VOLUME</div>
            <div className="text-xl font-semibold text-white">
              ${(tradingData?.totalVolume ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">
              {tradingData?.totalTrades ?? 0} trades
            </div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">WIN RATE</div>
            <div className="text-xl font-semibold text-white">
              {(tradingData?.winRate ?? 0).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400">
              {tradingData?.completedTrades ?? 0} completed
            </div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">OPEN POSITIONS</div>
            <div className="text-xl font-semibold text-white">
              {openPositions.length}
            </div>
            <div className="text-xs text-gray-400">
              {closedPositions.length} closed
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 flex-shrink-0">
          {(["overview", "positions", "trades", "analytics", "tax"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner variant="dots" size="md" text="Loading trading data..." />
            </div>
          ) : !walletAddress ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-400 mb-4">Connect your wallet to view trading data</p>
                <button
                  onClick={() => {
                    try {
                      (window as any).dispatchEvent(new CustomEvent('open-wallet'));
                    } catch {}
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Connect Wallet
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full">
              {activeTab === "overview" && (
                <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* P&L Over Time */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-medium text-white">P&L Over Time</h3>
                      <div className="flex gap-2">
                        {(["7d", "30d", "90d", "all"] as const).map((tf) => (
                          <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-3 py-1 text-xs rounded ${
                              timeframe === tf
                                ? "bg-blue-600 text-white"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-40 flex items-center justify-center text-gray-400">
                      {tradingData?.dailyPnL && tradingData.dailyPnL.length > 0 ? (
                        <div className="text-xs">Chart visualization coming soon</div>
                      ) : (
                        <div className="text-xs">No data available</div>
                      )}
                    </div>
                  </div>

                  {/* Portfolio Allocation */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-base font-medium text-white mb-3">Portfolio Allocation</h3>
                    <div className="h-40 flex items-center justify-center text-gray-400">
                      {openPositions.length > 0 ? (
                        <div className="text-xs">Chart visualization coming soon</div>
                      ) : (
                        <div className="text-xs">No positions</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Trades */}
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-base font-medium text-white mb-3">Recent Trades</h3>
                  {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                      {tradingData.recentTrades.slice(0, 10).map((trade) => (
                        <div key={trade.id} className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              trade.type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {trade.type.toUpperCase()}
                            </span>
                            <span className="text-sm text-white">{trade.tokenOut}</span>
                            <span className="text-gray-400 text-xs">{formatTimeAgo(trade.timestamp)}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-white">{trade.amountOut}</div>
                            <div className="text-gray-400 text-xs">{trade.amountIn} {trade.tokenIn}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400 text-sm">No trades</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "positions" && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-3">Positions</h3>
                {openPositions.length > 0 || closedPositions.length > 0 ? (
                  <div className="space-y-4">
                    {openPositions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Open Positions</h4>
                        <div className="space-y-2">
                          {openPositions.map((pos) => (
                            <div key={pos.tokenAddress} className="p-3 bg-gray-700/30 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium text-white">{pos.tokenSymbol}</div>
                                  <div className="text-xs text-gray-400">Amount: {pos.amount}</div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-medium ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                                  </div>
                                  <div className={`text-xs ${pos.pnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {pos.pnlPercentage >= 0 ? '+' : ''}{pos.pnlPercentage.toFixed(2)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {closedPositions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Closed Positions</h4>
                        <div className="space-y-2">
                          {closedPositions.map((pos) => (
                            <div key={`${pos.tokenAddress}-${pos.exitDate}`} className="p-3 bg-gray-700/30 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium text-white">{pos.tokenSymbol}</div>
                                  <div className="text-xs text-gray-400">Closed: {formatDate(pos.exitDate)}</div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-medium ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                                  </div>
                                  <div className={`text-xs ${pos.pnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {pos.pnlPercentage >= 0 ? '+' : ''}{pos.pnlPercentage.toFixed(2)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <div className="mb-2">📄</div>
                    <div>No positions found</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "trades" && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-3">Trades</h3>
                {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                  <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-gray-400">
                        <tr>
                          <th className="text-left py-2">Time</th>
                          <th className="text-left py-2">Type</th>
                          <th className="text-left py-2">Token In</th>
                          <th className="text-left py-2">Token Out</th>
                          <th className="text-left py-2">Amount In</th>
                          <th className="text-left py-2">Amount Out</th>
                          <th className="text-left py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tradingData.recentTrades.map((trade) => (
                          <tr key={trade.id}>
                            <td className="py-2 text-gray-300">{formatTimeAgo(trade.timestamp)}</td>
                            <td className="py-2">
                              <span className={`font-medium ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.type.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2 text-gray-300">{trade.tokenIn}</td>
                            <td className="py-2 text-gray-300">{trade.tokenOut}</td>
                            <td className="py-2 text-gray-300">{trade.amountIn}</td>
                            <td className="py-2 text-gray-300">{trade.amountOut}</td>
                            <td className="py-2">
                              <span className={`px-2 py-1 text-xs rounded ${
                                trade.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                trade.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {trade.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">No trades</div>
                )}
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-base font-medium text-white mb-3">Trading Statistics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total Trades</span>
                      <span className="text-white">{tradingData?.totalTrades ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Completed Trades</span>
                      <span className="text-white">{tradingData?.completedTrades ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Positions Closed</span>
                      <span className="text-white">{tradingData?.positionsClosed ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total Bought</span>
                      <span className="text-green-400">${(tradingData?.bought ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total Sold</span>
                      <span className="text-red-400">${(tradingData?.sold ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Current Holdings</span>
                      <span className="text-white">${(tradingData?.holding ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h3 className="text-base font-medium text-white mb-3">Performance Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Win Rate</span>
                      <span className="text-white">{(tradingData?.winRate ?? 0).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total P&L</span>
                      <span className={`${(tradingData?.totalPnL ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${(tradingData?.totalPnL ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">P&L Percentage</span>
                      <span className={`${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(tradingData?.totalPnLPercentage ?? 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Average Trade Size</span>
                      <span className="text-white">
                        ${tradingData?.totalTrades && tradingData.totalTrades > 0 
                          ? ((tradingData.totalVolume / tradingData.totalTrades)).toFixed(2)
                          : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tax" && (
              <div className="space-y-4 sm:space-y-6">
                {/* Tax Report Header */}
                <div className="bg-gray-800/50 rounded-lg p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">Tax Report</h3>
                      <p className="text-xs text-gray-400">Generate comprehensive tax reports using FIFO accounting</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={taxYear}
                        onChange={(e) => setTaxYear(parseInt(e.target.value))}
                        className="px-4 py-2 bg-gray-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        {[2025, 2024, 2023, 2022, 2021].map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                      <button
                        onClick={async () => {
                          if (!walletAddress) return;
                          setTaxLoading(true);
                          try {
                            const response = await fetch(`/api/wallet/tax-report?address=${walletAddress}&year=${taxYear}`);
                            if (response.ok) {
                              const data = await response.json();
                              setTaxReport(data);
                            } else {
                              console.error("Failed to generate tax report");
                            }
                          } catch (error) {
                            console.error("Error generating tax report:", error);
                          } finally {
                            setTaxLoading(false);
                          }
                        }}
                        disabled={taxLoading || !walletAddress}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        {taxLoading ? (
                          <>
                            <FiRefreshCw className="w-4 h-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FiFileText className="w-4 h-4" />
                            Generate Report
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Tax Summary Cards */}
                  {taxReport && (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <div className="bg-gray-900/40 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <FiTrendingUp className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-gray-400">Realized Gains</span>
                          </div>
                          <div className="text-lg font-semibold text-emerald-400">
                            ${taxReport.totalRealizedGains?.toFixed(2) || '0.00'}
                          </div>
                        </div>
                        <div className="bg-gray-900/40 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <FiTrendingDown className="w-4 h-4 text-red-400" />
                            <span className="text-xs text-gray-400">Realized Losses</span>
                          </div>
                          <div className="text-lg font-semibold text-red-400">
                            ${taxReport.totalRealizedLosses?.toFixed(2) || '0.00'}
                          </div>
                        </div>
                        <div className="bg-gray-900/40 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <FiDollarSign className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-gray-400">Net Gain/Loss</span>
                          </div>
                          <div className={`text-lg font-semibold ${(taxReport.netRealizedGain || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ${taxReport.netRealizedGain?.toFixed(2) || '0.00'}
                          </div>
                        </div>
                        <div className="bg-gray-900/40 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <FiActivity className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-400">Gas Costs</span>
                          </div>
                          <div className="text-lg font-semibold text-white">
                            ${taxReport.totalGasCosts?.toFixed(2) || '0.00'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Transaction Summary Stats */}
                      {taxReport.summary && (
                        <div className="grid grid-cols-3 gap-3 mb-6">
                          <div className="bg-gray-900/40 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-400 mb-1">Total Buys</div>
                            <div className="text-base font-semibold text-white">{taxReport.summary.totalBuys || 0}</div>
                          </div>
                          <div className="bg-gray-900/40 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-400 mb-1">Total Sells</div>
                            <div className="text-base font-semibold text-white">{taxReport.summary.totalSells || 0}</div>
                          </div>
                          <div className="bg-gray-900/40 rounded-lg p-3 text-center">
                            <div className="text-xs text-gray-400 mb-1">Total Volume</div>
                            <div className="text-base font-semibold text-white">${(taxReport.summary.totalVolume || 0).toFixed(2)}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Tax Report Details */}
                  {taxReport && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white">Transaction Summary</h4>
                        <button
                          onClick={() => {
                            if (!taxReport) return;
                            const csv = [
                              ['Date', 'Type', 'Token', 'Amount', 'Cost Basis', 'Sale Price', 'Realized Gain/Loss', 'Gas Cost', 'TX Hash'].join(','),
                              ...taxReport.transactions.map((tx: any) => [
                                tx.date,
                                tx.type,
                                tx.tokenSymbol,
                                tx.amount,
                                tx.costBasis || 0,
                                tx.salePrice || 0,
                                tx.realizedGain || 0,
                                tx.gasCost || 0,
                                tx.txHash
                              ].join(','))
                            ].join('\n');
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `tax-report-${taxYear}.csv`;
                            a.click();
                            window.URL.revokeObjectURL(url);
                          }}
                          className="px-4 py-2 bg-gray-900/40 hover:bg-gray-800/60 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <FiDownload className="w-4 h-4" />
                          Export CSV
                        </button>
                      </div>
                      
                      {taxReport.transactions && taxReport.transactions.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-400">
                                <th className="text-left py-2 px-2">Date</th>
                                <th className="text-left py-2 px-2">Type</th>
                                <th className="text-left py-2 px-2">Token</th>
                                <th className="text-right py-2 px-2">Amount</th>
                                <th className="text-right py-2 px-2">Cost Basis</th>
                                <th className="text-right py-2 px-2">Sale Price</th>
                                <th className="text-right py-2 px-2">Gain/Loss</th>
                                <th className="text-right py-2 px-2">Gas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {taxReport.transactions.slice(0, 50).map((tx: any, idx: number) => (
                                <tr key={idx} className="border-t border-gray-800/30 hover:bg-gray-800/30">
                                  <td className="py-2 px-2 text-gray-300">{tx.date}</td>
                                  <td className="py-2 px-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      tx.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                      {tx.type}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-gray-300">{tx.tokenSymbol}</td>
                                  <td className="py-2 px-2 text-gray-300 text-right font-mono">{tx.amount.toFixed(4)}</td>
                                  <td className="py-2 px-2 text-gray-300 text-right">${tx.costBasis?.toFixed(2) || '0.00'}</td>
                                  <td className="py-2 px-2 text-gray-300 text-right">${tx.salePrice?.toFixed(2) || '0.00'}</td>
                                  <td className={`py-2 px-2 text-right font-medium ${
                                    (tx.realizedGain || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                                  }`}>
                                    ${tx.realizedGain?.toFixed(2) || '0.00'}
                                  </td>
                                  <td className="py-2 px-2 text-gray-400 text-right">${tx.gasCost?.toFixed(2) || '0.00'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {taxReport.transactions.length > 50 && (
                            <p className="text-xs text-gray-500 mt-2 text-center">
                              Showing first 50 of {taxReport.transactions.length} transactions
                            </p>
                          )}
                        </div>
                      ) : taxReport ? (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          No transactions found for {taxYear}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Multi-Wallet Tracking */}
                  <div className="mt-6 pt-6 border-t border-gray-800/30">
                    <h4 className="text-sm font-semibold text-white mb-3">Multi-Wallet Tracking</h4>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newWalletAddress}
                          onChange={(e) => setNewWalletAddress(e.target.value)}
                          placeholder="Enter wallet address (0x...)"
                          className="flex-1 px-4 py-2 bg-gray-900/40 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                        <button
                          onClick={() => {
                            if (newWalletAddress && !additionalWallets.includes(newWalletAddress.toLowerCase())) {
                              setAdditionalWallets([...additionalWallets, newWalletAddress.toLowerCase()]);
                              setNewWalletAddress("");
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800/60 rounded-lg transition-colors"
                          title="Add wallet"
                        >
                          <FaPlus className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {additionalWallets.length > 0 && (
                        <div className="space-y-2">
                          {additionalWallets.map((addr, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-900/40 rounded-lg">
                              <span className="text-xs text-gray-300 font-mono">{addr.slice(0, 10)}...{addr.slice(-8)}</span>
                              <button
                                onClick={() => setAdditionalWallets(additionalWallets.filter((_, i) => i !== idx))}
                                className="text-gray-500 hover:text-red-400 transition-colors"
                              >
                                <FiX className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Primary Wallet Display */}
                  <div className="mt-4 pt-4 border-t border-gray-800/30">
                    <h4 className="text-sm font-semibold text-white mb-2">Primary Wallet</h4>
                    <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FaWallet className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-gray-300 font-mono">
                          {walletAddress || 'No wallet connected'}
                        </span>
                      </div>
                      {walletAddress && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

