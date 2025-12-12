"use client";

import React, { useState, useEffect, useMemo } from "react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import LoadingSpinner from "@/app/components/LoadingSpinner";

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

export default function DashboardPage() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "trades" | "analytics" | "tax">("overview");
  const [tradingData, setTradingData] = useState<TradingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d" | "all">("30d");
  
  useEffect(() => {
    try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("cypherx_wallet") : null;
        if (raw) {
          const data = JSON.parse(raw);
        if (data?.address) setWalletAddress(data.address);
      }
    } catch {}
    
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cypherx_wallet") {
        try {
            const data = e.newValue ? JSON.parse(e.newValue) : null;
            setWalletAddress(data?.address || "");
        } catch {
          setWalletAddress("");
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
          <div>
            <h1 className="text-xl font-semibold text-white">Trading Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect wallet to view trading data"}
            </p>
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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 flex-shrink-0">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">TOTAL P&L</div>
            <div className={`text-xl font-semibold ${(tradingData?.totalPnL ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${Math.abs(tradingData?.totalPnL ?? 0).toFixed(2)}
            </div>
            <div className={`text-xs ${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(tradingData?.totalPnLPercentage ?? 0).toFixed(2)}%
            </div>
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">TOTAL VOLUME</div>
            <div className="text-xl font-semibold text-white">
              ${(tradingData?.totalVolume ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">
              {tradingData?.totalTrades ?? 0} trades
            </div>
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">WIN RATE</div>
            <div className="text-xl font-semibold text-white">
              {(tradingData?.winRate ?? 0).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400">
              {tradingData?.completedTrades ?? 0} completed
            </div>
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
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
        <div className="flex items-center gap-1 border-b border-gray-700 mb-4 flex-shrink-0">
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
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
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
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
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
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
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
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
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
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-3">Trades</h3>
                {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                  <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-gray-400 border-b border-gray-700">
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
                          <tr key={trade.id} className="border-b border-gray-700/30">
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
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
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

                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
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
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-base font-medium text-white mb-4">Tax Report</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Generate Report</label>
                    <div className="flex gap-3">
                      <select className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                        <option>2025</option>
                        <option>2024</option>
                        <option>2023</option>
                      </select>
                      <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                        Generate Report
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Multi-Wallet Tracking</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Enter wallet address"
                        className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                      />
                      <button className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                        + Add Wallet
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Primary Wallet</label>
                    <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 font-mono text-sm">
                      {walletAddress}
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
        toast.success('Data refreshed');
      });
    } else if (walletAddress) {
      const timeframeParam = timeframe === "7d" ? "7D" : timeframe === "30d" ? "30D" : timeframe === "90d" ? "90D" : "ALL";
      fetch(`/api/wallet/pnl?address=${walletAddress}&timeframe=${timeframeParam}`)
        .then(r => r.json())
        .then(data => {
          setTradingData(data);
          toast.success('Data refreshed');
        })
        .catch(console.error);
    }
  };

  const copyAddress = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      toast.success('Address copied');
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

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-200 flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* ================================================================== */}
        {/* HEADER SECTION */}
        {/* ================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          {/* Title & Wallet Selector */}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Trading Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor your portfolio performance</p>
            
            {/* Wallet Selector */}
            <div className="relative mt-3" ref={walletSelectorRef}>
              <button
                onClick={() => setShowWalletSelector(!showWalletSelector)}
                className="flex items-center gap-2.5 px-3.5 py-2 bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl hover:border-blue-500/40 transition-all duration-200 text-sm group"
              >
                {selectedWalletIndex === 'all' ? (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <FaLayerGroup className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <span className="text-white font-medium">All Wallets</span>
                    <span className="text-gray-500 text-xs">({allWallets.length})</span>
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <FaWallet className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <span className="text-white font-medium">
                      {allWallets[selectedWalletIndex]?.alias || `Account ${selectedWalletIndex + 1}`}
                    </span>
                    <span className="text-gray-500 text-xs font-mono">
                      ({walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "—"})
                    </span>
                  </>
                )}
                <FiChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showWalletSelector ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Wallet Dropdown */}
              {showWalletSelector && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-800/60 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-2">
                    {/* All Wallets Option */}
                    {allWallets.length > 1 && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedWalletIndex('all');
                            setWalletAddress('');
                            setShowWalletSelector(false);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-150 ${
                            selectedWalletIndex === 'all'
                              ? 'bg-blue-500/10 border border-blue-500/30'
                              : 'hover:bg-gray-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              selectedWalletIndex === 'all' ? 'bg-blue-600' : 'bg-gray-800'
                            }`}>
                              <FaLayerGroup className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-white">All Wallets</p>
                              <p className="text-xs text-gray-500">Consolidated view ({allWallets.length} wallets)</p>
                            </div>
                          </div>
                          {selectedWalletIndex === 'all' && (
                            <FiCheck className="w-4 h-4 text-blue-400" />
                          )}
                        </button>
                        <div className="border-t border-gray-800/60 my-2"></div>
                      </>
                    )}
                    
                    {/* Individual Wallets */}
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider px-2 py-1.5">Individual Wallets</p>
                    <div className="space-y-1 max-h-52 overflow-y-auto">
                      {allWallets.map((wallet, index) => (
                        <button
                          key={wallet.address}
                          onClick={() => {
                            setSelectedWalletIndex(index);
                            setWalletAddress(wallet.address);
                            setShowWalletSelector(false);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-150 ${
                            selectedWalletIndex === index
                              ? 'bg-blue-500/10 border border-blue-500/30'
                              : 'hover:bg-gray-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              selectedWalletIndex === index ? 'bg-blue-600' : 'bg-gray-800'
                            }`}>
                              <FaWallet className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-white">
                                {wallet.alias || `Account ${index + 1}`}
                              </p>
                              <p className="text-xs text-gray-500 font-mono">
                                {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                              </p>
                            </div>
                          </div>
                          {selectedWalletIndex === index && (
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status="Active" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    
                    {allWallets.length === 0 && (
                      <div className="text-center py-6 text-gray-500">
                        <FaWallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No wallets found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {walletAddress && selectedWalletIndex !== 'all' && (
              <button
                onClick={copyAddress}
                className="p-2.5 text-gray-400 hover:text-white bg-gray-900/40 border border-gray-800/40 rounded-xl hover:bg-gray-800/60 hover:border-gray-700/60 transition-all duration-200"
                title="Copy Address"
              >
                <FiCopy className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleRefresh}
              className="p-2.5 text-gray-400 hover:text-white bg-gray-900/40 border border-gray-800/40 rounded-xl hover:bg-gray-800/60 hover:border-gray-700/60 transition-all duration-200"
              title="Refresh Data"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================================================================== */}
        {/* CONSOLIDATED BANNER */}
        {/* ================================================================== */}
        {selectedWalletIndex === 'all' && allWallets.length > 1 && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <FaLayerGroup className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">Consolidated View</span>
              </div>
              <div className="h-4 w-px bg-blue-500/30 hidden sm:block"></div>
              <p className="text-xs text-blue-400/70">
                Combined data from {allWallets.length} wallets
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {allWallets.slice(0, 3).map((w, i) => (
                  <span key={w.address} className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-md border border-blue-500/20">
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

        {/* ================================================================== */}
        {/* KPI CARDS */}
        {/* ================================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <MetricCard
            title="Total P&L"
            value={`${(tradingData?.totalPnL ?? 0) >= 0 ? '+' : '-'}$${formatNumber(Math.abs(tradingData?.totalPnL ?? 0))}`}
            subValue={`${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? '+' : ''}${formatNumber(tradingData?.totalPnLPercentage ?? 0)}%`}
            icon={<FiDollarSign className="w-4 h-4" />}
            trend={(tradingData?.totalPnL ?? 0) >= 0 ? 'up' : 'down'}
            trendValue={`${formatNumber(Math.abs(tradingData?.totalPnLPercentage ?? 0))}%`}
            tooltip="Total profit and loss across all trades"
            isConsolidated={selectedWalletIndex === 'all'}
          />
          
          <MetricCard
            title="Total Volume"
            value={`$${formatNumber(tradingData?.totalVolume ?? 0)}`}
            subValue={`${tradingData?.totalTrades ?? 0} trades`}
            icon={<FiActivity className="w-4 h-4" />}
            tooltip="Total trading volume"
            isConsolidated={selectedWalletIndex === 'all'}
          />
          
          <MetricCard
            title="Win Rate"
            value={`${formatNumber(tradingData?.winRate ?? 0, 0)}%`}
            subValue={`${tradingData?.completedTrades ?? 0} completed`}
            icon={<FiTarget className="w-4 h-4" />}
            trend={(tradingData?.winRate ?? 0) >= 50 ? 'up' : (tradingData?.winRate ?? 0) > 0 ? 'down' : 'neutral'}
            tooltip="Percentage of profitable trades"
            isConsolidated={selectedWalletIndex === 'all'}
          />
          
          <MetricCard
            title="Positions"
            value={`${openPositions.length} open`}
            subValue={`${closedPositions.length} closed`}
            icon={<FiPieChart className="w-4 h-4" />}
            tooltip="Active and closed positions"
            isConsolidated={selectedWalletIndex === 'all'}
          />
        </div>

        {/* ================================================================== */}
        {/* QUICK ACTIONS */}
        {/* ================================================================== */}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 mb-6">
          <QuickAction
            icon={<FiTrendingUp className="w-4 h-4" />}
            label="Trade"
            href="/discover"
          />
          <QuickAction
            icon={<FiPieChart className="w-4 h-4" />}
            label="Portfolio"
            href={walletAddress ? `/explorer/address/${walletAddress}` : '#'}
          />
          <QuickAction
            icon={<FiActivity className="w-4 h-4" />}
            label="History"
            onClick={() => setActiveTab('trades')}
          />
          <QuickAction
            icon={<FiBarChart2 className="w-4 h-4" />}
            label="Analytics"
            onClick={() => setActiveTab('analytics')}
          />
        </div>

        {/* ================================================================== */}
        {/* TABS */}
        {/* ================================================================== */}
        <div className="flex items-center gap-1 bg-gray-900/40 p-1 rounded-xl mb-6 overflow-x-auto">
          {(["overview", "positions", "trades", "analytics", "tax"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                activeTab === tab
                  ? "bg-gray-800/80 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ================================================================== */}
        {/* TAB CONTENT */}
        {/* ================================================================== */}
        <div className="pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner variant="dots" size="md" text="Loading trading data..." />
            </div>
          ) : (allWallets.length === 0 || (selectedWalletIndex !== 'all' && !walletAddress)) ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-900/60 border border-gray-800/60 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FaWallet className="w-10 h-10 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Wallet Connected</h3>
                <p className="text-gray-500 mb-6 max-w-sm">
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
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                >
                  {allWallets.length === 0 ? "Open Wallet" : "Select Wallet"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ============================================================ */}
              {/* OVERVIEW TAB */}
              {/* ============================================================ */}
              {activeTab === "overview" && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* P&L Chart */}
                    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white">P&L Over Time</h3>
                        <div className="flex bg-gray-800/60 rounded-lg p-0.5">
                          {(["7d", "30d", "90d", "all"] as const).map((tf) => (
                            <button
                              key={tf}
                              onClick={() => setTimeframe(tf)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
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
                      <div className="h-40">
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
                            return (
                              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                                No P&L data for this period
                              </div>
                            );
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

                          const chartWidth = 400;
                          const chartHeight = 100;
                          const leftPadding = 50;
                          const rightPadding = 10;
                          const topPadding = 10;
                          const bottomPadding = 25;

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

                          const yLabels = [
                            { value: adjustedMax, y: topPadding },
                            { value: (adjustedMax + adjustedMin) / 2, y: topPadding + chartHeight / 2 },
                            { value: adjustedMin, y: topPadding + chartHeight }
                          ];

                          const xLabels = [
                            { date: cumulativeData[0]?.date, x: leftPadding },
                            { date: cumulativeData[Math.floor(cumulativeData.length / 2)]?.date, x: leftPadding + (chartWidth - leftPadding - rightPadding) / 2 },
                            { date: cumulativeData[cumulativeData.length - 1]?.date, x: lastX }
                          ];

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
                                
                                {/* Zero line */}
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
                                  fill={isPositive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"}
                                />

                                {/* Line */}
                                <polyline
                                  points={points}
                                  fill="none"
                                  stroke={isPositive ? "#10b981" : "#ef4444"}
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />

                                {/* End point */}
                                {cumulativeData.length > 0 && (
                                  <circle
                                    cx={lastX}
                                    cy={topPadding + (1 - (lastValue - adjustedMin) / adjustedRange) * chartHeight}
                                    r="4"
                                    fill={isPositive ? "#10b981" : "#ef4444"}
                                  />
                                )}

                                {/* Y-axis labels */}
                                {yLabels.map((label, i) => (
                                  <text
                                    key={`y-${i}`}
                                    x={leftPadding - 6}
                                    y={label.y + 4}
                                    textAnchor="end"
                                    className="fill-gray-500"
                                    style={{ fontSize: '10px' }}
                                  >
                                    ${formatNumber(label.value, 0)}
                                  </text>
                                ))}

                                {/* X-axis labels */}
                                {xLabels.map((label, i) => (
                                  <text
                                    key={`x-${i}`}
                                    x={label.x}
                                    y={chartHeight + topPadding + 18}
                                    textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                                    className="fill-gray-500"
                                    style={{ fontSize: '10px' }}
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
                    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                      <h3 className="text-sm font-semibold text-white mb-4">Portfolio Allocation</h3>
                      <div className="h-40">
                        {tradingData?.holding && tradingData.holding > 0 ? (
                          <div className="flex items-center h-full gap-6">
                            {/* Donut chart */}
                            <div className="relative w-28 h-28 flex-shrink-0">
                              <svg viewBox="0 0 36 36" className="w-full h-full">
                                <circle
                                  cx="18" cy="18" r="14"
                                  fill="none"
                                  stroke="#1f2937"
                                  strokeWidth="3.5"
                                />
                                <circle
                                  cx="18" cy="18" r="14"
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth="3.5"
                                  strokeDasharray={`${(tradingData.holding / (tradingData.bought || 1)) * 88} 88`}
                                  strokeLinecap="round"
                                  transform="rotate(-90 18 18)"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-sm font-semibold text-white">${formatNumber(tradingData.holding)}</span>
                              </div>
                            </div>
                            {/* Legend */}
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                  <span className="text-sm text-gray-400">Holdings</span>
                                </div>
                                <span className="text-sm font-medium text-white">${formatNumber(tradingData.holding)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                  <span className="text-sm text-gray-400">Bought</span>
                                </div>
                                <span className="text-sm font-medium text-white">${formatNumber(tradingData.bought)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                  <span className="text-sm text-gray-400">Sold</span>
                                </div>
                                <span className="text-sm font-medium text-white">${formatNumber(tradingData.sold)}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-500 text-sm">No holdings data</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                      <button 
                        onClick={() => setActiveTab('trades')}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        View All
                      </button>
                    </div>
                    {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                      <div className="space-y-2">
                        {tradingData.recentTrades.slice(0, 5).map((trade, idx) => (
                          <div 
                            key={trade.id || idx} 
                            className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl hover:bg-gray-800/60 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                trade.type === 'buy' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                              }`}>
                                {trade.type === 'buy' ? (
                                  <FiArrowUpRight className={`w-4 h-4 text-emerald-400`} />
                                ) : (
                                  <FiArrowDownRight className={`w-4 h-4 text-red-400`} />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">{shortenToken(trade.tokenOut)}</p>
                                <p className="text-xs text-gray-500">{formatTimeAgo(trade.timestamp)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-white">{formatTokenAmount(trade.amountOut)}</p>
                              <p className="text-xs text-gray-500">
                                {formatTokenAmount(trade.amountIn)} {trade.tokenIn === 'ETH' ? 'ETH' : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 text-sm">No recent activity</div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* POSITIONS TAB */}
              {/* ============================================================ */}
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
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-white">Positions</h3>
                      <div className="flex items-center gap-2 text-xs">
                        <StatusBadge status="Open" />
                        <span className="text-gray-500">{openPositions.length}</span>
                        <span className="text-gray-700">|</span>
                        <StatusBadge status="Closed" />
                        <span className="text-gray-500">{closedPositions.length}</span>
                      </div>
                    </div>
                    
                    {openPositions.length > 0 || closedPositions.length > 0 ? (
                      <div className="space-y-6">
                        {/* Open Positions */}
                        {openPositions.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Open Positions</h4>
                              {openTotalPages > 1 && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setOpenPositionsPage(p => Math.max(1, p - 1))}
                                    disabled={openPositionsPage === 1}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  >
                                    ‹
                                  </button>
                                  <span className="text-xs text-gray-500 min-w-[40px] text-center">{openPositionsPage}/{openTotalPages}</span>
                                  <button
                                    onClick={() => setOpenPositionsPage(p => Math.min(openTotalPages, p + 1))}
                                    disabled={openPositionsPage === openTotalPages}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  >
                                    ›
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              {paginatedOpenPositions.map((pos, idx) => {
                                const pnl = pos.pnl ?? 0;
                                const pnlPct = pos.pnlPercentage ?? 0;
                                const isPositive = pnl >= 0 && Math.abs(pnl) >= 0.01;
                                const isNeutral = Math.abs(pnl) < 0.01;
                                
                                return (
                                  <div 
                                    key={pos.tokenAddress || idx} 
                                    className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl hover:bg-gray-800/60 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <FiTrendingUp className="w-4 h-4 text-blue-400" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-white">{shortenToken(pos.tokenSymbol)}</p>
                                        <p className="text-xs text-gray-500">Qty: {formatTokenAmount(pos.amount)}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-medium ${isNeutral ? 'text-gray-400' : isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isNeutral ? '$0.00' : `${pnl >= 0 ? '+' : '-'}$${formatPnLValue(Math.abs(pnl))}`}
                                      </p>
                                      <p className={`text-xs ${isNeutral ? 'text-gray-500' : isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                        {isNeutral ? '0%' : `${pnlPct >= 0 ? '+' : '-'}${formatPercentage(Math.abs(pnlPct))}%`}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Closed Positions */}
                        {closedPositions.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Closed Positions</h4>
                              {closedTotalPages > 1 && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setClosedPositionsPage(p => Math.max(1, p - 1))}
                                    disabled={closedPositionsPage === 1}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  >
                                    ‹
                                  </button>
                                  <span className="text-xs text-gray-500 min-w-[40px] text-center">{closedPositionsPage}/{closedTotalPages}</span>
                                  <button
                                    onClick={() => setClosedPositionsPage(p => Math.min(closedTotalPages, p + 1))}
                                    disabled={closedPositionsPage === closedTotalPages}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  >
                                    ›
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              {paginatedClosedPositions.map((pos, idx) => {
                                const pnl = pos.pnl ?? 0;
                                const pnlPct = pos.pnlPercentage ?? 0;
                                const isPositive = pnl >= 0 && Math.abs(pnl) >= 0.01;
                                const isNeutral = Math.abs(pnl) < 0.01;
                                
                                return (
                                  <div 
                                    key={`${pos.tokenAddress || idx}-${pos.exitDate || idx}`} 
                                    className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl hover:bg-gray-800/60 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-lg bg-gray-700/50 flex items-center justify-center">
                                        <FiTrendingDown className="w-4 h-4 text-gray-400" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-white">{shortenToken(pos.tokenSymbol)}</p>
                                        <p className="text-xs text-gray-500">{pos.exitDate ? formatDate(pos.exitDate) : '—'}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-medium ${isNeutral ? 'text-gray-400' : isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isNeutral ? '$0.00' : `${pnl >= 0 ? '+' : '-'}$${formatPnLValue(Math.abs(pnl))}`}
                                      </p>
                                      <p className={`text-xs ${isNeutral ? 'text-gray-500' : isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                        {isNeutral ? '0%' : `${pnlPct >= 0 ? '+' : '-'}${formatPercentage(Math.abs(pnlPct))}%`}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 bg-gray-800/60 rounded-xl flex items-center justify-center mx-auto mb-4">
                          <FiPieChart className="w-6 h-6 text-gray-500" />
                        </div>
                        <p className="text-sm text-gray-500">No positions found</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ============================================================ */}
              {/* TRADES TAB */}
              {/* ============================================================ */}
              {activeTab === "trades" && (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Trade History</h3>
                  {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-800/60">
                            <th className="text-left py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            <th className="text-left py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="text-left py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Token In</th>
                            <th className="text-left py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Token Out</th>
                            <th className="text-right py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Amount In</th>
                            <th className="text-right py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Amount Out</th>
                            <th className="text-center py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tradingData.recentTrades.map((trade, idx) => (
                            <tr 
                              key={trade.id || idx} 
                              className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors"
                            >
                              <td className="py-3 px-2 text-sm text-gray-400">{formatTimeAgo(trade.timestamp)}</td>
                              <td className="py-3 px-2">
                                <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                                  trade.type === 'buy' ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {trade.type === 'buy' ? <FiArrowUpRight className="w-3.5 h-3.5" /> : <FiArrowDownRight className="w-3.5 h-3.5" />}
                                  {(trade.type || 'BUY').toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-sm text-gray-300">{trade.tokenIn === 'ETH' ? 'ETH' : shortenToken(trade.tokenIn)}</td>
                              <td className="py-3 px-2 text-sm text-gray-300">{trade.tokenOut === 'ETH' ? 'ETH' : shortenToken(trade.tokenOut)}</td>
                              <td className="py-3 px-2 text-sm text-gray-300 text-right font-mono">{formatTokenAmount(trade.amountIn)}</td>
                              <td className="py-3 px-2 text-sm text-gray-300 text-right font-mono">{formatTokenAmount(trade.amountOut)}</td>
                              <td className="py-3 px-2 text-center">
                                <StatusBadge status={trade.status || 'completed'} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 bg-gray-800/60 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <FiClock className="w-6 h-6 text-gray-500" />
                      </div>
                      <p className="text-sm text-gray-500">No trades found</p>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* ANALYTICS TAB */}
              {/* ============================================================ */}
              {activeTab === "analytics" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Trading Statistics */}
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Trading Statistics</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <span className="text-sm text-gray-400">Total Trades</span>
                        <span className="text-sm font-medium text-white">{tradingData?.totalTrades ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <span className="text-sm text-gray-400">Completed</span>
                        <span className="text-sm font-medium text-white">{tradingData?.completedTrades ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <span className="text-sm text-gray-400">Positions Closed</span>
                        <span className="text-sm font-medium text-white">{tradingData?.positionsClosed ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <span className="text-sm text-gray-400">Total Bought</span>
                        <span className="text-sm font-medium text-emerald-400">${formatNumber(tradingData?.bought ?? 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <span className="text-sm text-gray-400">Total Sold</span>
                        <span className="text-sm font-medium text-red-400">${formatNumber(tradingData?.sold ?? 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-gray-400">Holdings</span>
                        <span className="text-sm font-medium text-white">${formatNumber(tradingData?.holding ?? 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Performance Metrics</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <div className="flex items-center gap-2">
                          <FiPercent className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-400">Win Rate</span>
                        </div>
                        <span className="text-sm font-medium text-white">{formatNumber(tradingData?.winRate ?? 0)}%</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <div className="flex items-center gap-2">
                          <FiDollarSign className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-400">Total P&L</span>
                        </div>
                        <span className={`text-sm font-medium ${(tradingData?.totalPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(tradingData?.totalPnL ?? 0) >= 0 ? '+' : ''}${formatNumber(tradingData?.totalPnL ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <div className="flex items-center gap-2">
                          <FiTrendingUp className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-400">P&L %</span>
                        </div>
                        <span className={`text-sm font-medium ${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(tradingData?.totalPnLPercentage ?? 0) >= 0 ? '+' : ''}{formatNumber(tradingData?.totalPnLPercentage ?? 0)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <div className="flex items-center gap-2">
                          <FiActivity className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-400">Avg Trade Size</span>
                        </div>
                        <span className="text-sm font-medium text-white">
                          ${tradingData?.totalTrades && tradingData.totalTrades > 0 
                            ? formatNumber(tradingData.totalVolume / tradingData.totalTrades)
                            : '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAX TAB */}
              {/* ============================================================ */}
              {activeTab === "tax" && (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-white mb-6">Tax Report</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Generate Report</label>
                      <div className="flex gap-3">
                        <select className="px-4 py-2.5 bg-gray-800/60 border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-blue-500/50 focus:outline-none transition-colors">
                          <option>2025</option>
                          <option>2024</option>
                          <option>2023</option>
                        </select>
                        <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                          Generate
                        </button>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-800/60 pt-6">
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Multi-Wallet Tracking</label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder="Enter wallet address"
                          className="flex-1 px-4 py-2.5 bg-gray-800/60 border border-gray-700/60 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500/50 focus:outline-none transition-colors"
                        />
                        <button className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors">
                          + Add
                        </button>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-800/60 pt-6">
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Primary Wallet</label>
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/40 border border-gray-700/40 rounded-xl">
                        <span className="text-gray-300 font-mono text-sm">
                          {walletAddress || 'No wallet connected'}
                        </span>
                        {walletAddress && (
                          <StatusBadge status="Synced" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

    
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
        toast.success('Data refreshed');
                });
              } else if (walletAddress) {
                const timeframeParam = timeframe === "7d" ? "7D" : timeframe === "30d" ? "30D" : timeframe === "90d" ? "90D" : "ALL";
                fetch(`/api/wallet/pnl?address=${walletAddress}&timeframe=${timeframeParam}`)
                  .then(r => r.json())
        .then(data => {
          setTradingData(data);
          toast.success('Data refreshed');
        })
                  .catch(console.error);
              }
  };

  const copyAddress = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      toast.success('Address copied');
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

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#0a0e17] text-gray-200 flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* ================================================================== */}
        {/* HEADER SECTION */}
        {/* ================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          {/* Title & Wallet Selector */}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Trading Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor your portfolio performance</p>
            
            {/* Wallet Selector */}
            <div className="relative mt-3" ref={walletSelectorRef}>
              <button
                onClick={() => setShowWalletSelector(!showWalletSelector)}
                className="flex items-center gap-2.5 px-3.5 py-2 bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl hover:border-blue-500/40 transition-all duration-200 text-sm group"
              >
                {selectedWalletIndex === 'all' ? (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <FaLayerGroup className="w-3.5 h-3.5 text-blue-400" />
        </div>
                    <span className="text-white font-medium">All Wallets</span>
                    <span className="text-gray-500 text-xs">({allWallets.length})</span>
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <FaWallet className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <span className="text-white font-medium">
                      {allWallets[selectedWalletIndex]?.alias || `Account ${selectedWalletIndex + 1}`}
              </span>
                    <span className="text-gray-500 text-xs font-mono">
                      ({walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "—"})
                  </span>
                  </>
                )}
                <FiChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showWalletSelector ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Wallet Dropdown */}
              {showWalletSelector && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-800/60 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-2">
                    {/* All Wallets Option */}
                    {allWallets.length > 1 && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedWalletIndex('all');
                            setWalletAddress('');
                            setShowWalletSelector(false);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-150 ${
                            selectedWalletIndex === 'all'
                              ? 'bg-blue-500/10 border border-blue-500/30'
                              : 'hover:bg-gray-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              selectedWalletIndex === 'all' ? 'bg-blue-600' : 'bg-gray-800'
                            }`}>
                              <FaLayerGroup className="w-4 h-4 text-white" />
              </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-white">All Wallets</p>
                              <p className="text-xs text-gray-500">Consolidated view ({allWallets.length} wallets)</p>
            </div>
          </div>
                          {selectedWalletIndex === 'all' && (
                            <FiCheck className="w-4 h-4 text-blue-400" />
                          )}
                        </button>
                        <div className="border-t border-gray-800/60 my-2"></div>
                      </>
                    )}
                    
                    {/* Individual Wallets */}
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider px-2 py-1.5">Individual Wallets</p>
                    <div className="space-y-1 max-h-52 overflow-y-auto">
                      {allWallets.map((wallet, index) => (
                        <button
                          key={wallet.address}
                          onClick={() => {
                            setSelectedWalletIndex(index);
                            setWalletAddress(wallet.address);
                            setShowWalletSelector(false);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-150 ${
                            selectedWalletIndex === index
                              ? 'bg-blue-500/10 border border-blue-500/30'
                              : 'hover:bg-gray-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              selectedWalletIndex === index ? 'bg-blue-600' : 'bg-gray-800'
                            }`}>
                              <FaWallet className="w-4 h-4 text-white" />
            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-white">
                                {wallet.alias || `Account ${index + 1}`}
                              </p>
                              <p className="text-xs text-gray-500 font-mono">
                                {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                              </p>
            </div>
            </div>
                          {selectedWalletIndex === index && (
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status="Active" />
                            </div>
                          )}
                        </button>
                      ))}
          </div>
          
                    {allWallets.length === 0 && (
                      <div className="text-center py-6 text-gray-500">
                        <FaWallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No wallets found</p>
            </div>
                    )}
            </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            {walletAddress && selectedWalletIndex !== 'all' && (
              <button
                onClick={copyAddress}
                className="p-2.5 text-gray-400 hover:text-white bg-gray-900/40 border border-gray-800/40 rounded-xl hover:bg-gray-800/60 hover:border-gray-700/60 transition-all duration-200"
                title="Copy Address"
              >
                <FiCopy className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleRefresh}
              className="p-2.5 text-gray-400 hover:text-white bg-gray-900/40 border border-gray-800/40 rounded-xl hover:bg-gray-800/60 hover:border-gray-700/60 transition-all duration-200"
              title="Refresh Data"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
            </div>
          </div>
          
        {/* ================================================================== */}
        {/* CONSOLIDATED BANNER */}
        {/* ================================================================== */}
        {selectedWalletIndex === 'all' && allWallets.length > 1 && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <FaLayerGroup className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">Consolidated View</span>
            </div>
              <div className="h-4 w-px bg-blue-500/30 hidden sm:block"></div>
              <p className="text-xs text-blue-400/70">
                Combined data from {allWallets.length} wallets
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {allWallets.slice(0, 3).map((w, i) => (
                  <span key={w.address} className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-md border border-blue-500/20">
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

        {/* ================================================================== */}
        {/* KPI CARDS */}
        {/* ================================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <MetricCard
            title="Total P&L"
            value={`${(tradingData?.totalPnL ?? 0) >= 0 ? '+' : '-'}$${formatNumber(Math.abs(tradingData?.totalPnL ?? 0))}`}
            subValue={`${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? '+' : ''}${formatNumber(tradingData?.totalPnLPercentage ?? 0)}%`}
            icon={<FiDollarSign className="w-4 h-4" />}
            trend={(tradingData?.totalPnL ?? 0) >= 0 ? 'up' : 'down'}
            trendValue={`${formatNumber(Math.abs(tradingData?.totalPnLPercentage ?? 0))}%`}
            tooltip="Total profit and loss across all trades"
            isConsolidated={selectedWalletIndex === 'all'}
          />
          
          <MetricCard
            title="Total Volume"
            value={`$${formatNumber(tradingData?.totalVolume ?? 0)}`}
            subValue={`${tradingData?.totalTrades ?? 0} trades`}
            icon={<FiActivity className="w-4 h-4" />}
            tooltip="Total trading volume"
            isConsolidated={selectedWalletIndex === 'all'}
          />
          
          <MetricCard
            title="Win Rate"
            value={`${formatNumber(tradingData?.winRate ?? 0, 0)}%`}
            subValue={`${tradingData?.completedTrades ?? 0} completed`}
            icon={<FiTarget className="w-4 h-4" />}
            trend={(tradingData?.winRate ?? 0) >= 50 ? 'up' : (tradingData?.winRate ?? 0) > 0 ? 'down' : 'neutral'}
            tooltip="Percentage of profitable trades"
            isConsolidated={selectedWalletIndex === 'all'}
          />
          
          <MetricCard
            title="Positions"
            value={`${openPositions.length} open`}
            subValue={`${closedPositions.length} closed`}
            icon={<FiPieChart className="w-4 h-4" />}
            tooltip="Active and closed positions"
            isConsolidated={selectedWalletIndex === 'all'}
          />
        </div>

        {/* ================================================================== */}
        {/* QUICK ACTIONS */}
        {/* ================================================================== */}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 mb-6">
          <QuickAction
            icon={<FiTrendingUp className="w-4 h-4" />}
            label="Trade"
            href="/discover"
          />
          <QuickAction
            icon={<FiPieChart className="w-4 h-4" />}
            label="Portfolio"
            href={walletAddress ? `/explorer/address/${walletAddress}` : '#'}
          />
          <QuickAction
            icon={<FiActivity className="w-4 h-4" />}
            label="History"
            onClick={() => setActiveTab('trades')}
          />
          <QuickAction
            icon={<FiBarChart2 className="w-4 h-4" />}
            label="Analytics"
            onClick={() => setActiveTab('analytics')}
          />
        </div>

        {/* ================================================================== */}
        {/* TABS */}
        {/* ================================================================== */}
        <div className="flex items-center gap-1 bg-gray-900/40 p-1 rounded-xl mb-6 overflow-x-auto">
          {(["overview", "positions", "trades", "analytics", "tax"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                activeTab === tab
                  ? "bg-gray-800/80 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ================================================================== */}
        {/* TAB CONTENT */}
        {/* ================================================================== */}
        <div className="pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner variant="dots" size="md" text="Loading trading data..." />
            </div>
          ) : (allWallets.length === 0 || (selectedWalletIndex !== 'all' && !walletAddress)) ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-900/60 border border-gray-800/60 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FaWallet className="w-10 h-10 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Wallet Connected</h3>
                <p className="text-gray-500 mb-6 max-w-sm">
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
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                >
                  {allWallets.length === 0 ? "Open Wallet" : "Select Wallet"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ============================================================ */}
              {/* OVERVIEW TAB */}
              {/* ============================================================ */}
              {activeTab === "overview" && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* P&L Chart */}
                    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white">P&L Over Time</h3>
                        <div className="flex bg-gray-800/60 rounded-lg p-0.5">
                        {(["7d", "30d", "90d", "all"] as const).map((tf) => (
                          <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
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
                      <div className="h-40">
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
                            return (
                              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                                No P&L data for this period
                              </div>
                            );
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

                          const chartWidth = 400;
                          const chartHeight = 100;
                          const leftPadding = 50;
                        const rightPadding = 10;
                          const topPadding = 10;
                          const bottomPadding = 25;

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

                        const yLabels = [
                          { value: adjustedMax, y: topPadding },
                          { value: (adjustedMax + adjustedMin) / 2, y: topPadding + chartHeight / 2 },
                          { value: adjustedMin, y: topPadding + chartHeight }
                        ];

                        const xLabels = [
                          { date: cumulativeData[0]?.date, x: leftPadding },
                          { date: cumulativeData[Math.floor(cumulativeData.length / 2)]?.date, x: leftPadding + (chartWidth - leftPadding - rightPadding) / 2 },
                          { date: cumulativeData[cumulativeData.length - 1]?.date, x: lastX }
                        ];

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
                              
                                {/* Zero line */}
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
                                  fill={isPositive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"}
                              />

                              {/* Line */}
                              <polyline
                                points={points}
                                fill="none"
                                  stroke={isPositive ? "#10b981" : "#ef4444"}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                                {/* End point */}
                              {cumulativeData.length > 0 && (
                                <circle
                                  cx={lastX}
                                  cy={topPadding + (1 - (lastValue - adjustedMin) / adjustedRange) * chartHeight}
                                    r="4"
                                    fill={isPositive ? "#10b981" : "#ef4444"}
                                />
                              )}

                              {/* Y-axis labels */}
                              {yLabels.map((label, i) => (
                                <text
                                  key={`y-${i}`}
                                    x={leftPadding - 6}
                                    y={label.y + 4}
                                  textAnchor="end"
                                  className="fill-gray-500"
                                    style={{ fontSize: '10px' }}
                                >
                                  ${formatNumber(label.value, 0)}
                                </text>
                              ))}

                              {/* X-axis labels */}
                              {xLabels.map((label, i) => (
                                <text
                                  key={`x-${i}`}
                                  x={label.x}
                                    y={chartHeight + topPadding + 18}
                                  textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                                  className="fill-gray-500"
                                    style={{ fontSize: '10px' }}
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
                    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                      <h3 className="text-sm font-semibold text-white mb-4">Portfolio Allocation</h3>
                      <div className="h-40">
                      {tradingData?.holding && tradingData.holding > 0 ? (
                          <div className="flex items-center h-full gap-6">
                            {/* Donut chart */}
                            <div className="relative w-28 h-28 flex-shrink-0">
                            <svg viewBox="0 0 36 36" className="w-full h-full">
                              <circle
                                cx="18" cy="18" r="14"
                                fill="none"
                                stroke="#1f2937"
                                  strokeWidth="3.5"
                              />
                              <circle
                                cx="18" cy="18" r="14"
                                fill="none"
                                stroke="#3b82f6"
                                  strokeWidth="3.5"
                                strokeDasharray={`${(tradingData.holding / (tradingData.bought || 1)) * 88} 88`}
                                strokeLinecap="round"
                                transform="rotate(-90 18 18)"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-sm font-semibold text-white">${formatNumber(tradingData.holding)}</span>
                            </div>

                          </div>
                          {/* Legend */}
                            <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                  <span className="text-sm text-gray-400">Holdings</span>
                              </div>
                                <span className="text-sm font-medium text-white">${formatNumber(tradingData.holding)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                  <span className="text-sm text-gray-400">Bought</span>
                              </div>
                                <span className="text-sm font-medium text-white">${formatNumber(tradingData.bought)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                  <span className="text-sm text-gray-400">Sold</span>
                              </div>
                                <span className="text-sm font-medium text-white">${formatNumber(tradingData.sold)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                          <div className="h-full flex items-center justify-center text-gray-500 text-sm">No holdings data</div>
                      )}
                    </div>
                  </div>
                </div>

                  {/* Recent Activity */}
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                      <button 
                        onClick={() => setActiveTab('trades')}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        View All
                      </button>
                    </div>
                  {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                      <div className="space-y-2">
                        {tradingData.recentTrades.slice(0, 5).map((trade, idx) => (
                          <div 
                            key={trade.id || idx} 
                            className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl hover:bg-gray-800/60 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                trade.type === 'buy' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                              }`}>
                                {trade.type === 'buy' ? (
                                  <FiArrowUpRight className={`w-4 h-4 text-emerald-400`} />
                                ) : (
                                  <FiArrowDownRight className={`w-4 h-4 text-red-400`} />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">{shortenToken(trade.tokenOut)}</p>
                                <p className="text-xs text-gray-500">{formatTimeAgo(trade.timestamp)}</p>
                              </div>
                          </div>
                          <div className="text-right">
                              <p className="text-sm font-medium text-white">{formatTokenAmount(trade.amountOut)}</p>
                              <p className="text-xs text-gray-500">
                                {formatTokenAmount(trade.amountIn)} {trade.tokenIn === 'ETH' ? 'ETH' : ''}
                              </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                      <div className="text-center py-8 text-gray-500 text-sm">No recent activity</div>
                  )}
                </div>
              </div>
            )}

              {/* ============================================================ */}
              {/* POSITIONS TAB */}
              {/* ============================================================ */}
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
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-white">Positions</h3>
                      <div className="flex items-center gap-2 text-xs">
                        <StatusBadge status="Open" />
                        <span className="text-gray-500">{openPositions.length}</span>
                        <span className="text-gray-700">|</span>
                        <StatusBadge status="Closed" />
                        <span className="text-gray-500">{closedPositions.length}</span>
                    </div>
                  </div>
                    
                  {openPositions.length > 0 || closedPositions.length > 0 ? (
                      <div className="space-y-6">
                        {/* Open Positions */}
                      {openPositions.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Open Positions</h4>
                            {openTotalPages > 1 && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setOpenPositionsPage(p => Math.max(1, p - 1))}
                                  disabled={openPositionsPage === 1}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  ‹
                                </button>
                                  <span className="text-xs text-gray-500 min-w-[40px] text-center">{openPositionsPage}/{openTotalPages}</span>
                                <button
                                  onClick={() => setOpenPositionsPage(p => Math.min(openTotalPages, p + 1))}
                                  disabled={openPositionsPage === openTotalPages}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  ›
                                </button>
                              </div>
                            )}
                          </div>
                            <div className="space-y-2">
                            {paginatedOpenPositions.map((pos, idx) => {
                              const pnl = pos.pnl ?? 0;
                              const pnlPct = pos.pnlPercentage ?? 0;
                              const isPositive = pnl >= 0 && Math.abs(pnl) >= 0.01;
                              const isNeutral = Math.abs(pnl) < 0.01;
                              
                              return (
                                  <div 
                                    key={pos.tokenAddress || idx} 
                                    className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl hover:bg-gray-800/60 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <FiTrendingUp className="w-4 h-4 text-blue-400" />
                                    </div>
                                      <div>
                                        <p className="text-sm font-medium text-white">{shortenToken(pos.tokenSymbol)}</p>
                                        <p className="text-xs text-gray-500">Qty: {formatTokenAmount(pos.amount)}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-medium ${isNeutral ? 'text-gray-400' : isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isNeutral ? '$0.00' : `${pnl >= 0 ? '+' : '-'}$${formatPnLValue(Math.abs(pnl))}`}
                                      </p>
                                      <p className={`text-xs ${isNeutral ? 'text-gray-500' : isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                        {isNeutral ? '0%' : `${pnlPct >= 0 ? '+' : '-'}${formatPercentage(Math.abs(pnlPct))}%`}
                                      </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                        {/* Closed Positions */}
                      {closedPositions.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Closed Positions</h4>
                            {closedTotalPages > 1 && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setClosedPositionsPage(p => Math.max(1, p - 1))}
                                  disabled={closedPositionsPage === 1}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  ‹
                                </button>
                                  <span className="text-xs text-gray-500 min-w-[40px] text-center">{closedPositionsPage}/{closedTotalPages}</span>
                                <button
                                  onClick={() => setClosedPositionsPage(p => Math.min(closedTotalPages, p + 1))}
                                  disabled={closedPositionsPage === closedTotalPages}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  ›
                                </button>
                              </div>
                            )}
                          </div>
                            <div className="space-y-2">
                            {paginatedClosedPositions.map((pos, idx) => {
                              const pnl = pos.pnl ?? 0;
                              const pnlPct = pos.pnlPercentage ?? 0;
                              const isPositive = pnl >= 0 && Math.abs(pnl) >= 0.01;
                              const isNeutral = Math.abs(pnl) < 0.01;
                              
                              return (
                                  <div 
                                    key={`${pos.tokenAddress || idx}-${pos.exitDate || idx}`} 
                                    className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl hover:bg-gray-800/60 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-lg bg-gray-700/50 flex items-center justify-center">
                                        <FiTrendingDown className="w-4 h-4 text-gray-400" />
                                    </div>
                                      <div>
                                        <p className="text-sm font-medium text-white">{shortenToken(pos.tokenSymbol)}</p>
                                        <p className="text-xs text-gray-500">{pos.exitDate ? formatDate(pos.exitDate) : '—'}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-medium ${isNeutral ? 'text-gray-400' : isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {isNeutral ? '$0.00' : `${pnl >= 0 ? '+' : '-'}$${formatPnLValue(Math.abs(pnl))}`}
                                      </p>
                                      <p className={`text-xs ${isNeutral ? 'text-gray-500' : isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                        {isNeutral ? '0%' : `${pnlPct >= 0 ? '+' : '-'}${formatPercentage(Math.abs(pnlPct))}%`}
                                      </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 bg-gray-800/60 rounded-xl flex items-center justify-center mx-auto mb-4">
                          <FiPieChart className="w-6 h-6 text-gray-500" />
                        </div>
                        <p className="text-sm text-gray-500">No positions found</p>
                      </div>
                  )}
                </div>
              );
            })()}

              {/* ============================================================ */}
              {/* TRADES TAB */}
              {/* ============================================================ */}
            {activeTab === "trades" && (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Trade History</h3>
                {tradingData?.recentTrades && tradingData.recentTrades.length > 0 ? (
                    <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-800/60">
                            <th className="text-left py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            <th className="text-left py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="text-left py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Token In</th>
                            <th className="text-left py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Token Out</th>
                            <th className="text-right py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Amount In</th>
                            <th className="text-right py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Amount Out</th>
                            <th className="text-center py-3 px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tradingData.recentTrades.map((trade, idx) => (
                            <tr 
                              key={trade.id || idx} 
                              className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors"
                            >
                              <td className="py-3 px-2 text-sm text-gray-400">{formatTimeAgo(trade.timestamp)}</td>
                              <td className="py-3 px-2">
                                <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                                  trade.type === 'buy' ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {trade.type === 'buy' ? <FiArrowUpRight className="w-3.5 h-3.5" /> : <FiArrowDownRight className="w-3.5 h-3.5" />}
                                {(trade.type || 'BUY').toUpperCase()}
                              </span>
                            </td>
                              <td className="py-3 px-2 text-sm text-gray-300">{trade.tokenIn === 'ETH' ? 'ETH' : shortenToken(trade.tokenIn)}</td>
                              <td className="py-3 px-2 text-sm text-gray-300">{trade.tokenOut === 'ETH' ? 'ETH' : shortenToken(trade.tokenOut)}</td>
                              <td className="py-3 px-2 text-sm text-gray-300 text-right font-mono">{formatTokenAmount(trade.amountIn)}</td>
                              <td className="py-3 px-2 text-sm text-gray-300 text-right font-mono">{formatTokenAmount(trade.amountOut)}</td>
                              <td className="py-3 px-2 text-center">
                                <StatusBadge status={trade.status || 'completed'} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 bg-gray-800/60 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <FiClock className="w-6 h-6 text-gray-500" />
                      </div>
                      <p className="text-sm text-gray-500">No trades found</p>
                    </div>
                )}
              </div>
            )}

              {/* ============================================================ */}
              {/* ANALYTICS TAB */}
              {/* ============================================================ */}
            {activeTab === "analytics" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Trading Statistics */}
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Trading Statistics</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <span className="text-sm text-gray-400">Total Trades</span>
                        <span className="text-sm font-medium text-white">{tradingData?.totalTrades ?? 0}</span>
                    </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <span className="text-sm text-gray-400">Completed</span>
                        <span className="text-sm font-medium text-white">{tradingData?.completedTrades ?? 0}</span>
                    </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <span className="text-sm text-gray-400">Positions Closed</span>
                        <span className="text-sm font-medium text-white">{tradingData?.positionsClosed ?? 0}</span>
                    </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <span className="text-sm text-gray-400">Total Bought</span>
                        <span className="text-sm font-medium text-emerald-400">${formatNumber(tradingData?.bought ?? 0)}</span>
                    </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <span className="text-sm text-gray-400">Total Sold</span>
                        <span className="text-sm font-medium text-red-400">${formatNumber(tradingData?.sold ?? 0)}</span>
                    </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-gray-400">Holdings</span>
                        <span className="text-sm font-medium text-white">${formatNumber(tradingData?.holding ?? 0)}</span>
                    </div>
                  </div>
                </div>

                  {/* Performance Metrics */}
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Performance Metrics</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <div className="flex items-center gap-2">
                          <FiPercent className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-400">Win Rate</span>
                    </div>
                        <span className="text-sm font-medium text-white">{formatNumber(tradingData?.winRate ?? 0)}%</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <div className="flex items-center gap-2">
                          <FiDollarSign className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-400">Total P&L</span>
                        </div>
                        <span className={`text-sm font-medium ${(tradingData?.totalPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(tradingData?.totalPnL ?? 0) >= 0 ? '+' : ''}${formatNumber(tradingData?.totalPnL ?? 0)}
                      </span>
                    </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800/40">
                        <div className="flex items-center gap-2">
                          <FiTrendingUp className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-400">P&L %</span>
                        </div>
                        <span className={`text-sm font-medium ${(tradingData?.totalPnLPercentage ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {(tradingData?.totalPnLPercentage ?? 0) >= 0 ? '+' : ''}{formatNumber(tradingData?.totalPnLPercentage ?? 0)}%
                      </span>
                    </div>
                      <div className="flex justify-between items-center py-2">
                        <div className="flex items-center gap-2">
                          <FiActivity className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-400">Avg Trade Size</span>
                        </div>
                        <span className="text-sm font-medium text-white">
                        ${tradingData?.totalTrades && tradingData.totalTrades > 0 
                          ? formatNumber(tradingData.totalVolume / tradingData.totalTrades)
                          : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* ============================================================ */}
              {/* TAX TAB */}
              {/* ============================================================ */}
            {activeTab === "tax" && (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/60 rounded-xl p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-white mb-6">Tax Report</h3>
                  <div className="space-y-6">
                  <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Generate Report</label>
                      <div className="flex gap-3">
                        <select className="px-4 py-2.5 bg-gray-800/60 border border-gray-700/60 rounded-xl text-sm text-gray-200 focus:border-blue-500/50 focus:outline-none transition-colors">
                        <option>2025</option>
                        <option>2024</option>
                        <option>2023</option>
                      </select>
                        <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
                        Generate
                      </button>
                    </div>
                  </div>
                  
                    <div className="border-t border-gray-800/60 pt-6">
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Multi-Wallet Tracking</label>
                      <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Enter wallet address"
                          className="flex-1 px-4 py-2.5 bg-gray-800/60 border border-gray-700/60 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500/50 focus:outline-none transition-colors"
                      />
                        <button className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors">
                        + Add
                      </button>
                    </div>
                  </div>
                  
                    <div className="border-t border-gray-800/60 pt-6">
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Primary Wallet</label>
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/40 border border-gray-700/40 rounded-xl">
                        <span className="text-gray-300 font-mono text-sm">
                      {walletAddress || 'No wallet connected'}
                        </span>
                        {walletAddress && (
                          <StatusBadge status="Synced" />
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

