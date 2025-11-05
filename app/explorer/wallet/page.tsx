"use client";

import React, { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import LoadingSpinner from "../../components/LoadingSpinner";

type Order = {
  id: string;
  type: "buy" | "sell";
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  price: string;
  value: number;
  timestamp: number;
  status: "completed" | "pending" | "failed";
  transactionHash: string;
};

type Position = {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  avgPrice: string;
  currentPrice: string;
  pnl?: string;
  pnlValue?: string;
  pnlPercentage?: number;
  status: "open" | "closed";
  entryDate: number;
  exitDate?: number;
  totalBought?: number;
  totalSold?: number;
  remainingAmount?: number;
};

export default function WalletDashboardPage() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"orders" | "positions">("orders");

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);

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
    const loadOrders = async () => {
      if (!walletAddress) return;
      setOrdersLoading(true);
      try {
        const res = await fetch(`/api/wallet/orders?address=${walletAddress}`);
        const data = await res.json();
        if (res.ok) setOrders(data.orders || []);
        else setOrders([]);
      } catch {
        setOrders([]);
      } finally {
        setOrdersLoading(false);
      }
    };
    if (activeTab === "orders") loadOrders();
  }, [walletAddress, activeTab]);

  useEffect(() => {
    const loadPositions = async () => {
      if (!walletAddress) return;
      setPositionsLoading(true);
      try {
        const res = await fetch(`/api/wallet/positions?address=${walletAddress}`);
        const data = await res.json();
        if (res.ok) setPositions(data.positions || []);
        else setPositions([]);
      } catch {
        setPositions([]);
      } finally {
        setPositionsLoading(false);
      }
    };
    if (activeTab === "positions") loadPositions();
  }, [walletAddress, activeTab]);

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const totalPnLSummary = useMemo(() => {
    if (!positions || positions.length === 0) return { value: 0, pct: 0 };
    const vals = positions.map(p => {
      const amt = parseFloat(p.amount || "0");
      const avg = parseFloat(p.avgPrice || "0");
      const cur = parseFloat(p.currentPrice || "0");
      return (cur - avg) * amt;
    });
    const sum = vals.reduce((a, b) => a + b, 0);
    // Simple percentage proxy
    const base = positions.reduce((a, p) => a + (parseFloat(p.avgPrice || "0") * parseFloat(p.amount || "0")), 0);
    const pct = base > 0 ? (sum / base) * 100 : 0;
    return { value: sum, pct };
  }, [positions]);

  return (
    <div className="h-screen bg-[#0f172a] text-gray-200 flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1280px] mx-auto px-5 lg:px-8 pt-6 pb-0 flex flex-col min-h-0">
        <div className="text-left mb-4 flex-shrink-0">
          <h1 className="text-base font-semibold mb-0.5 text-white">Portfolio</h1>
          <div className="text-sm text-gray-400">
            {walletAddress ? (
              <span>Wallet: {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
            ) : (
              <button onClick={() => { try { (window as any).dispatchEvent(new CustomEvent('open-wallet')); } catch {} }} className="text-blue-400 hover:text-blue-300">Connect Wallet</button>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-4">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
            <div className="text-xs text-gray-400">Open Positions</div>
            <div className="text-white text-base font-semibold">{positions.filter(p => p.status === 'open').length}</div>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
            <div className="text-xs text-gray-400">Closed Positions</div>
            <div className="text-white text-base font-semibold">{positions.filter(p => p.status === 'closed').length}</div>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
            <div className="text-xs text-gray-400">PnL (est.)</div>
            <div className={`text-lg font-semibold ${totalPnLSummary.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnLSummary.value >= 0 ? '+' : '-'}${Math.abs(totalPnLSummary.value).toFixed(2)}
              <span className="text-xs text-gray-400 ml-2">({totalPnLSummary.pct.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-gray-700/50 mb-2">
          <div className="flex gap-6 text-sm">
            <button onClick={() => setActiveTab('orders')} className={`pb-2 ${activeTab==='orders' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-300'}`}>Orders</button>
            <button onClick={() => setActiveTab('positions')} className={`pb-2 ${activeTab==='positions' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-300'}`}>Positions</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {activeTab === 'orders' && (
            <div className="h-full flex flex-col">
              {ordersLoading ? (
                <div className="p-6 text-center flex items-center justify-center">
                  <LoadingSpinner variant="dots" size="md" text="Loading orders..." />
                </div>
              ) : orders.length === 0 ? (
                <div className="p-6 text-center text-gray-400">No orders yet.</div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto pb-40 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-400 border-b border-gray-700/50 sticky top-0 bg-slate-800/30">
                      <tr>
                        <th className="text-left py-2 pl-4">Time</th>
                        <th className="text-left py-2">Type</th>
                        <th className="text-left py-2">Token</th>
                        <th className="text-left py-2">Amount</th>
                        <th className="text-left py-2">Price</th>
                        <th className="text-left py-2">Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} className="border-b border-gray-700/30">
                          <td className="py-2 pl-4 text-gray-300">{formatTimeAgo(o.timestamp)}</td>
                          <td className="py-2"><span className={`font-medium ${o.type==='buy' ? 'text-green-400' : 'text-red-400'}`}>{o.type.toUpperCase()}</span></td>
                          <td className="py-2 text-gray-300">{o.tokenSymbol}</td>
                          <td className="py-2 text-gray-300">{parseFloat(o.amount).toLocaleString()}</td>
                          <td className="py-2 text-gray-300">${parseFloat(o.price).toFixed(6)}</td>
                          <td className="py-2 text-blue-400"><a className="hover:underline" href={`https://basescan.org/tx/${o.transactionHash}`} target="_blank" rel="noreferrer">View</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'positions' && (
            <div className="h-full flex flex-col">
              {positionsLoading ? (
                <div className="p-6 text-center flex items-center justify-center">
                  <LoadingSpinner variant="dots" size="md" text="Loading positions..." />
                </div>
              ) : positions.length === 0 ? (
                <div className="p-6 text-center text-gray-400">No positions yet.</div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto pb-40 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-400 border-b border-gray-700/50 sticky top-0 bg-slate-800/30">
                      <tr>
                        <th className="text-left py-2 pl-4">Token</th>
                        <th className="text-left py-2">Amount</th>
                        <th className="text-left py-2">Avg Price</th>
                        <th className="text-left py-2">Current</th>
                        <th className="text-left py-2">P&L</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p) => {
                        const pnlPct = p.pnlPercentage ?? 0;
                        const pnlColor = pnlPct >= 0 ? 'text-green-400' : 'text-red-400';
                        return (
                          <tr key={p.id} className="border-b border-gray-700/30">
                            <td className="py-2 pl-4 text-gray-300">{p.tokenSymbol}</td>
                            <td className="py-2 text-gray-300">{parseFloat(p.amount).toLocaleString()}</td>
                            <td className="py-2 text-gray-300">${parseFloat(p.avgPrice).toFixed(6)}</td>
                            <td className="py-2 text-gray-300">${parseFloat(p.currentPrice).toFixed(6)}</td>
                            <td className={`py-2 font-medium ${pnlColor}`}>
                              {p.pnl ?? (p.pnlValue ?? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`)}
                            </td>
                            <td className="py-2 text-gray-300">{p.status}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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


