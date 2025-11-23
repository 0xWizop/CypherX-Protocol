"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaWallet, FaDownload, FaUpload, FaHistory, FaChartLine, FaCopy } from "react-icons/fa";
import { toast } from "react-hot-toast";
import Image from "next/image";
import { getTokenPrice, getEthPrice } from '../../lib/price-utils';

interface TokenHolding {
  contractAddress: string;
  name: string;
  symbol: string;
  balance: string;
  decimals: number;
  logo?: string;
  usdValue: number;
  priceUsd: number;
  priceChange24h?: number;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  category: string;
  timestamp: number;
  blockNumber: string;
  type: 'incoming' | 'outgoing' | 'internal';
  description: string;
  amount: string;
  status: 'confirmed' | 'pending' | 'failed';
  priceAtTime?: number;
  usdValue?: number;
}

interface PnLData {
  tokenAddress: string;
  tokenSymbol: string;
  totalBought: number;
  totalSold: number;
  currentHolding: number;
  averageBuyPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  realizedPnL: number;
  totalPnL: number;
}

interface WalletData {
  address: string;
  privateKey: string;
  createdAt: number;
}

interface EnhancedWalletInterfaceProps {
  walletData: WalletData | null;
  onClose: () => void;
  isOpen: boolean;
}

export default function EnhancedWalletInterface({ 
  walletData, 
  onClose, 
  isOpen 
}: EnhancedWalletInterfaceProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "holdings" | "transactions" | "pnl">("overview");
  const [tokenHoldings, setTokenHoldings] = useState<TokenHolding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pnlData, setPnLData] = useState<PnLData[]>([]);
  const [ethBalance, setEthBalance] = useState<string>("0.0");
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const [showCopiedTooltip, setShowCopiedTooltip] = useState<boolean>(false);

  // Fetch ETH price
  const fetchEthPrice = useCallback(async () => {
    try {
      const price = await getEthPrice();
      setEthPrice(price);
    } catch (error) {
      console.error('Error fetching ETH price:', error);
      setEthPrice(3000); // Fallback price
    }
  }, []);

  // Fetch wallet balance
  const fetchBalance = useCallback(async (address: string) => {
    try {
      const response = await fetch(`/api/wallet/balance?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEthBalance(data.ethBalance);
        }
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, []);

  // Fetch token holdings with enhanced data
  const fetchTokenHoldings = useCallback(async (address: string) => {
    try {
      const response = await fetch('/api/alchemy/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          action: 'tokens'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.tokenBalances) {
          // Enhance token data with current prices and USD values
          const enhancedTokens = await Promise.all(
            data.data.tokenBalances.map(async (token: any) => {
              try {
                // Get current price using the new utility
                const priceUsd = await getTokenPrice(token.contractAddress);
                
                // Calculate USD value
                const balance = parseFloat(token.tokenBalance);
                const usdValue = balance * priceUsd;

                return {
                  contractAddress: token.contractAddress,
                  name: token.name,
                  symbol: token.symbol,
                  balance: token.tokenBalance,
                  decimals: parseInt(token.decimals),
                  logo: token.logo || `https://dexscreener.com/base/${token.contractAddress}/logo.png`,
                  usdValue,
                  priceUsd,
                  priceChange24h: 0 // Will be updated if needed
                };
              } catch (error) {
                console.error(`Error enhancing token ${token.contractAddress}:`, error);
                return {
                  contractAddress: token.contractAddress,
                  name: token.name,
                  symbol: token.symbol,
                  balance: token.tokenBalance,
                  decimals: parseInt(token.decimals),
                  logo: token.logo || `https://dexscreener.com/base/${token.contractAddress}/logo.png`,
                  usdValue: 0,
                  priceUsd: 0
                };
              }
            })
          );

          setTokenHoldings(enhancedTokens);
          
          // Calculate total portfolio value
          const ethValue = parseFloat(ethBalance) * ethPrice;
          const tokenValue = enhancedTokens.reduce((sum, token) => sum + token.usdValue, 0);
          setTotalPortfolioValue(ethValue + tokenValue);
        }
      }
    } catch (error) {
      console.error('Error fetching token holdings:', error);
    }
  }, [ethBalance, ethPrice]);

  // Fetch transactions with historical prices
  const fetchTransactions = useCallback(async (address: string) => {
    try {
      const response = await fetch('/api/alchemy/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          action: 'transactions',
          page: 1,
          limit: 50,
          filter: 'all'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.transactions) {
          // Enhance transactions with historical prices and USD values
          const enhancedTransactions = await Promise.all(
            data.data.transactions.map(async (tx: Transaction) => {
              try {
                let priceAtTime = 0;
                let usdValue = 0;

                if (tx.asset === 'ETH') {
                  // For ETH transactions, use current ETH price as approximation
                  priceAtTime = ethPrice;
                  usdValue = parseFloat(tx.amount) * ethPrice;
                } else {
                  // Historical price fetching removed to prevent CORS errors
                  priceAtTime = 0;
                  usdValue = 0;
                }

                return {
                  ...tx,
                  priceAtTime,
                  usdValue
                };
              } catch (error) {
                console.error(`Error enhancing transaction ${tx.hash}:`, error);
                return tx;
              }
            })
          );

          setTransactions(enhancedTransactions);
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  }, [ethPrice]);

  // Calculate PnL data
  const calculatePnL = useCallback(async () => {
    if (!transactions.length || !tokenHoldings.length) return;

    const pnlCalculations: PnLData[] = [];

    for (const token of tokenHoldings) {
      const tokenTxs = transactions.filter(tx => 
        tx.asset.toLowerCase() === token.contractAddress.toLowerCase()
      );

      if (tokenTxs.length === 0) continue;

      let totalBought = 0;
      let totalSold = 0;
      let totalBoughtValue = 0;
      let totalSoldValue = 0;

      tokenTxs.forEach(tx => {
        const amount = parseFloat(tx.amount);
        const usdValue = tx.usdValue || 0;

        if (tx.type === 'incoming') {
          totalBought += amount;
          totalBoughtValue += usdValue;
        } else if (tx.type === 'outgoing') {
          totalSold += amount;
          totalSoldValue += usdValue;
        }
      });

      const currentHolding = totalBought - totalSold;
      const averageBuyPrice = totalBought > 0 ? totalBoughtValue / totalBought : 0;
      const currentPrice = token.priceUsd;
      const unrealizedPnL = currentHolding * (currentPrice - averageBuyPrice);
      const unrealizedPnLPercentage = averageBuyPrice > 0 ? ((currentPrice - averageBuyPrice) / averageBuyPrice) * 100 : 0;
      const realizedPnL = totalSoldValue - (totalSold * averageBuyPrice);
      const totalPnL = unrealizedPnL + realizedPnL;

      pnlCalculations.push({
        tokenAddress: token.contractAddress,
        tokenSymbol: token.symbol,
        totalBought,
        totalSold,
        currentHolding,
        averageBuyPrice,
        currentPrice,
        unrealizedPnL,
        unrealizedPnLPercentage,
        realizedPnL,
        totalPnL
      });
    }

    setPnLData(pnlCalculations);
  }, [transactions, tokenHoldings]);

  // Load wallet data
  useEffect(() => {
    if (walletData?.address) {
      setLoading(true);
      Promise.all([
        fetchEthPrice(),
        fetchBalance(walletData.address),
        fetchTokenHoldings(walletData.address),
        fetchTransactions(walletData.address)
      ]).finally(() => setLoading(false));
    }
  }, [walletData?.address, fetchEthPrice, fetchBalance, fetchTokenHoldings, fetchTransactions]);

  // Calculate PnL when transactions and holdings are loaded
  useEffect(() => {
    calculatePnL();
  }, [calculatePnL]);

  // Copy address to clipboard
  const copyAddress = useCallback(async () => {
    if (walletData?.address) {
      try {
        await navigator.clipboard.writeText(walletData.address);
        setShowCopiedTooltip(true);
        setTimeout(() => setShowCopiedTooltip(false), 2000);
        toast.success("Address copied to clipboard!");
      } catch (error) {
        console.error("Failed to copy address:", error);
        toast.error("Failed to copy address");
      }
    }
  }, [walletData]);

  // Format USD values
  const formatUSD = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}k`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Format time ago
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0b1220] border border-[#1f2a44] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#0d1628] px-6 py-5 border-b border-[#1f2a44]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FaWallet className="text-[#3b82f6] text-xl" />
              <h2 className="text-xl font-bold text-white">Wallet Interface</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* Wallet Address */}
          {walletData && (
            <div className="mt-3 flex items-center space-x-3">
              <div className="flex-1 bg-[#15233d] border border-[#1f2a44] rounded-lg px-3 py-2 font-mono text-sm text-gray-200">
                {walletData.address}
              </div>
              <button
                onClick={copyAddress}
                className="bg-[#1d4ed8] hover:bg-[#2563eb] px-3 py-2 rounded-lg text-white text-sm transition-colors relative"
              >
                <FaCopy className="w-4 h-4" />
                {showCopiedTooltip && (
                  <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-[#15233d] text-white text-xs px-2 py-1 rounded">
                    Copied!
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  const explorerUrl = `/explorer/address/${walletData.address}`;
                  window.open(explorerUrl, '_blank');
                }}
                className="bg-[#15233d] hover:bg-[#1d2a44] px-3 py-2 rounded-lg text-white text-sm transition-colors border border-transparent hover:border-[#1f2a44]"
                title="View in Explorer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-[#0d1628] border-b border-[#1f2a44]">
          <div className="flex space-x-1 px-6">
            {[
              { id: "overview", label: "Overview", icon: FaWallet },
              { id: "holdings", label: "Holdings", icon: FaDownload },
              { id: "transactions", label: "Transactions", icon: FaHistory },
              { id: "pnl", label: "PnL", icon: FaChartLine }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#14213a] text-[#3b82f6] border-b-2 border-[#3b82f6]"
                    : "text-gray-400 hover:text-white hover:bg-[#15233d]"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] bg-[#0b1220]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3b82f6]"></div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {/* Portfolio Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-[#101b33] rounded-xl p-4 border border-[#1f2a44] shadow-sm">
                        <h3 className="text-gray-300 text-sm font-medium">Total Portfolio</h3>
                        <p className="text-2xl font-bold text-white">{formatUSD(totalPortfolioValue)}</p>
                      </div>
                      <div className="bg-[#101b33] rounded-xl p-4 border border-[#1f2a44] shadow-sm">
                        <h3 className="text-gray-300 text-sm font-medium">ETH Balance</h3>
                        <p className="text-2xl font-bold text-[#60a5fa]">{parseFloat(ethBalance).toFixed(4)} ETH</p>
                        <p className="text-sm text-gray-400">{formatUSD(parseFloat(ethBalance) * ethPrice)}</p>
                      </div>
                      <div className="bg-[#101b33] rounded-xl p-4 border border-[#1f2a44] shadow-sm">
                        <h3 className="text-gray-300 text-sm font-medium">Token Holdings</h3>
                        <p className="text-2xl font-bold text-[#3b82f6]">{tokenHoldings.length}</p>
                        <p className="text-sm text-gray-400">Different tokens</p>
                      </div>
                    </div>

                    {/* Recent Transactions */}
                    <div className="bg-[#101b33] rounded-xl p-5 border border-[#1f2a44] shadow-sm">
                      <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
                      <div className="space-y-3">
                        {transactions.slice(0, 5).map((tx) => (
                          <div key={tx.hash} className="flex items-center justify-between p-3 rounded-lg bg-[#15233d] border border-transparent hover:border-[#1f2a44] transition-colors">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                tx.type === 'incoming' ? 'bg-green-500/15' : 'bg-red-500/15'
                              }`}>
                                {tx.type === 'incoming' ? (
                                  <FaDownload className="w-4 h-4 text-green-400" />
                                ) : (
                                  <FaUpload className="w-4 h-4 text-red-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-100">{tx.description}</p>
                                <p className="text-sm text-gray-400">{formatTimeAgo(tx.timestamp)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-100">{tx.amount} {tx.asset}</p>
                              {tx.usdValue && (
                                <p className="text-sm text-gray-400">{formatUSD(tx.usdValue)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Holdings Tab */}
                {activeTab === "holdings" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Token Holdings</h3>
                    <div className="space-y-3">
                      {tokenHoldings.map((token) => (
                        <div key={token.contractAddress} className="bg-[#101b33] rounded-xl p-4 border border-[#1f2a44] shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <Image
                                  src={token.logo}
                                  alt={token.symbol}
                                  width={40}
                                  height={40}
                                  className="rounded-full"
                                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.symbol}&background=1f2937&color=60a5fa&size=40`;
                                  }}
                                />
                              </div>
                              <div>
                                <p className="font-semibold text-white">{token.name}</p>
                                <p className="text-sm text-gray-400">{token.symbol}</p>
                                {token.priceChange24h !== undefined && (
                                  <p className={`text-xs ${
                                    token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}% (24h)
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-white">{parseFloat(token.balance).toFixed(4)}</p>
                              <p className="text-sm text-gray-400">${token.priceUsd.toFixed(6)}</p>
                              <p className="text-sm font-medium text-[#60a5fa]">{formatUSD(token.usdValue)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transactions Tab */}
                {activeTab === "transactions" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Transaction History</h3>
                    <div className="space-y-3">
                      {transactions.map((tx) => (
                        <div key={tx.hash} className="bg-[#101b33] rounded-xl p-4 border border-[#1f2a44] shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                tx.type === 'incoming' ? 'bg-green-500/15' : 'bg-red-500/15'
                              }`}>
                                {tx.type === 'incoming' ? (
                                  <FaDownload className="w-5 h-5 text-green-400" />
                                ) : (
                                  <FaUpload className="w-5 h-5 text-red-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{tx.description}</p>
                                <p className="text-sm text-gray-400">{formatTimeAgo(tx.timestamp)}</p>
                                <p className="text-xs text-gray-500 font-mono">{tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-white">{tx.amount} {tx.asset}</p>
                              {tx.usdValue && (
                                <p className="text-sm text-gray-400">{formatUSD(tx.usdValue)}</p>
                              )}
                              {tx.priceAtTime && (
                                <p className="text-xs text-gray-500">${tx.priceAtTime.toFixed(6)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PnL Tab */}
                {activeTab === "pnl" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Profit & Loss Analysis</h3>
                    <div className="space-y-3">
                      {pnlData.map((pnl) => (
                        <div key={pnl.tokenAddress} className="bg-[#101b33] rounded-xl p-4 border border-[#1f2a44] shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-white">{pnl.tokenSymbol}</h4>
                            <div className={`text-sm font-medium ${
                              pnl.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {pnl.totalPnL >= 0 ? '+' : ''}{formatUSD(pnl.totalPnL)}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-400">Current Holding</p>
                              <p className="text-white">{pnl.currentHolding.toFixed(4)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Avg Buy Price</p>
                              <p className="text-white">${pnl.averageBuyPrice.toFixed(6)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Current Price</p>
                              <p className="text-white">${pnl.currentPrice.toFixed(6)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Unrealized PnL</p>
                              <p className={`${
                                pnl.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {pnl.unrealizedPnL >= 0 ? '+' : ''}{formatUSD(pnl.unrealizedPnL)} ({pnl.unrealizedPnLPercentage.toFixed(2)}%)
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}
