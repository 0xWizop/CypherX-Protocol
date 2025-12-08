"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiExternalLink, FiRefreshCw } from "react-icons/fi";
import Link from "next/link";

interface Order {
  id: string;
  type: 'buy' | 'sell';
  tokenSymbol: string;
  amount: string;
  price: string;
  status: 'pending' | 'completed' | 'confirmed' | 'cancelled' | 'failed';
  timestamp: number;
  transactionHash?: string;
}

interface Position {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  remainingAmount?: number;
  avgPrice: string;
  currentPrice: string;
  pnl?: string;
  pnlValue?: string;
  pnlPercentage?: number;
  status: 'open' | 'closed' | 'partial';
  entryDate?: number;
}

interface OrdersPositionsPanelProps {
  activeTab: 'orders' | 'positions';
  onTabChange: (tab: 'orders' | 'positions') => void;
  orders: Order[];
  positions: Position[];
  ordersLoading: boolean;
  positionsLoading: boolean;
  currentPrice?: number;
  tokenSymbol?: string;
  tokenImageUrl?: string;
  onCancelOrder?: (orderId: string) => void;
  onClosePosition?: (positionId: string) => void;
  onRefresh?: () => void;
  isMobile?: boolean;
  footerHeight?: number;
}

const formatPrice = (price: number): string => {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
};

const OrdersPositionsPanel: React.FC<OrdersPositionsPanelProps> = ({
  activeTab,
  onTabChange,
  orders,
  positions,
  ordersLoading,
  positionsLoading,
  currentPrice = 0,
  tokenSymbol = 'TOKEN',
  tokenImageUrl,
  onRefresh,
  isMobile = false,
}) => {
  // Calculate live PnL
  const positionsWithLivePnL = useMemo(() => {
    if (!currentPrice || currentPrice === 0) return positions;
    return positions.map(position => {
      const amount = parseFloat(position.amount || position.remainingAmount?.toString() || '0');
      const avgPrice = parseFloat(position.avgPrice || '0');
      if (amount <= 0 || avgPrice <= 0) return position;
      const pnlValue = (currentPrice - avgPrice) * amount;
      const pnlPercentage = ((currentPrice - avgPrice) / avgPrice) * 100;
      return {
        ...position,
        currentPrice: currentPrice.toString(),
        pnlValue: pnlValue >= 0 ? `+$${pnlValue.toFixed(2)}` : `-$${Math.abs(pnlValue).toFixed(2)}`,
        pnlPercentage
      };
    });
  }, [positions, currentPrice]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Minimal Tab Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/40">
        <div className="flex gap-4">
          <button 
            onClick={() => onTabChange("orders")} 
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === 'orders' 
                ? 'text-white border-blue-500' 
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            Orders {orders.length > 0 && <span className="text-gray-500">({orders.length})</span>}
          </button>
          <button 
            onClick={() => onTabChange("positions")} 
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === 'positions' 
                ? 'text-white border-blue-500' 
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            Positions {positions.length > 0 && <span className="text-gray-500">({positions.length})</span>}
          </button>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="p-1.5 text-gray-500 hover:text-white transition-colors">
            <FiRefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="h-full flex flex-col"
            >
              {ordersLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  No orders yet
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {/* Header */}
                  <div className="grid grid-cols-4 gap-2 px-4 py-2 text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800/30 sticky top-0 bg-gray-950/95">
                    <div>Type</div>
                    <div>Amount</div>
                    <div>Price</div>
                    <div>Status</div>
                  </div>
                  {/* Rows */}
                  {orders.map((order, idx) => (
                    <div key={order.id || idx} className="grid grid-cols-4 gap-2 px-4 py-2.5 text-sm border-b border-gray-800/20 hover:bg-gray-800/20 transition-colors">
                      <div className={`flex items-center ${order.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        <span className="font-medium">{order.type.toUpperCase()}</span>
                      </div>
                      <div className="text-gray-300">{parseFloat(order.amount || '0').toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div className="text-gray-300">{formatPrice(parseFloat(order.price || '0'))}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${
                          order.status === 'completed' || order.status === 'confirmed' ? 'text-green-400' :
                          order.status === 'pending' ? 'text-yellow-400' : 'text-gray-500'
                        }`}>
                          {order.status === 'completed' || order.status === 'confirmed' ? 'Filled' : order.status}
                        </span>
                        {order.transactionHash && (
                          <Link href={`/explorer/tx/${order.transactionHash}`} className="text-gray-500 hover:text-blue-400">
                            <FiExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'positions' && (
            <motion.div
              key="positions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="h-full flex flex-col"
            >
              {positionsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : positionsWithLivePnL.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  No positions
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {/* Header */}
                  <div className={`grid ${isMobile ? 'grid-cols-3' : 'grid-cols-4'} gap-2 px-4 py-2 text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800/30 sticky top-0 bg-gray-950/95`}>
                    <div>Token</div>
                    <div>Amount</div>
                    <div className={isMobile ? 'hidden' : ''}>Entry</div>
                    <div>P&L</div>
                  </div>
                  {/* Rows */}
                  {positionsWithLivePnL.map((position, idx) => {
                    const pnl = position.pnlPercentage || 0;
                    const isPositive = pnl >= 0;
                    const amount = parseFloat(position.amount || position.remainingAmount?.toString() || '0');
                    return (
                      <div key={position.id || idx} className={`grid ${isMobile ? 'grid-cols-3' : 'grid-cols-4'} gap-2 px-4 py-2.5 text-sm border-b border-gray-800/20 hover:bg-gray-800/20 transition-colors items-center`}>
                        <div className="flex items-center gap-2">
                          {tokenImageUrl ? (
                            <img src={tokenImageUrl} alt={tokenSymbol} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-gray-400">
                              {tokenSymbol?.charAt(0) || 'T'}
                            </div>
                          )}
                          <span className="text-gray-200">{position.tokenSymbol}</span>
                        </div>
                        <div className="text-gray-300">{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div className={`text-gray-400 ${isMobile ? 'hidden' : ''}`}>{formatPrice(parseFloat(position.avgPrice || '0'))}</div>
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {position.pnlValue || '$0.00'}
                          </span>
                          <span className={`text-[11px] ${isPositive ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            {isPositive ? '+' : ''}{pnl.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OrdersPositionsPanel;
