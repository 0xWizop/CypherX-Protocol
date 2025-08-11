"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/app/components/Header";
import Footer from "../../../components/Footer";
import Link from "next/link";

// Types
interface Token {
  name: string;
  symbol: string;
  balance: string;
  contractAddress: string;
  usdValue: number;
  recentActivity: number;
  tokenType: "ERC-20";
  logo?: string;
  decimals: number;
  priceChange24h?: number;
  priceChange7d?: number;
  priceChange30d?: number;
  priceUsd?: number;
  tokenImage?: string;
  liquidity?: number;
  volume24h?: number;
  dexId?: string;
  pairAddress?: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  gasUsed?: string;
  gasFeeUsd?: number;
  timestamp?: number;
  type?: string;
  gasPrice?: string;
  input?: string;
  blockNumber?: string;
  nonce?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  status?: string | number;
  effectiveGasPrice?: string;
  fromName?: string;
  toName?: string;
}

interface WalletData {
  ethBalance: number;
  ethUsdValue: number;
  totalUsdValue: number;
  tokens: Token[];
  txList: Transaction[];
  lastScannedBlock?: { number: string; timestamp: number };
  nonce?: number;
  isContract?: boolean;
  chainId?: string;
  portfolioAllocation?: { eth: number; tokens: number };
  firstTxDate?: number;
  mostActivePeriod?: string;
}

interface Ad {
  createdAt: string;
  destinationUrl: string;
  imageUrl: string;
  type: "banner" | "sidebar";
}

// Utility functions
const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatNumber = (num: number) => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
};

const formatTokenPrice = (price: number) => {
  if (price >= 1000) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else if (price >= 0.0001) {
    return `$${price.toFixed(6)}`;
  } else {
    return `$${price.toFixed(8)}`;
  }
};

  const formatEthValue = (value: number) => {
    if (value === 0) {
      return '0.0000';
    } else if (value < 0.0001) {
      return value.toFixed(8);
    } else if (value < 1) {
      return value.toFixed(4);
    } else {
      return value.toFixed(4);
    }
  };

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};

const getTransactionType = (tx: Transaction) => {
  if (tx.value === "0x0") return "Contract Interaction";
  return "Transfer";
};

export default function WalletPage({ params }: { params: Promise<{ walletAddress: string }> }) {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [ads, setAds] = useState<Ad[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'tokens' | 'transactions'>('tokens');
  
  // Transaction pagination and filtering state
  const [txPage, setTxPage] = useState(1);
  const [txLimit] = useState(5);
  const [txFilter, setTxFilter] = useState<'all' | 'token_transfers' | 'internal'>('all');
  const [txPagination, setTxPagination] = useState({
    totalCount: 0,
    page: 1,
    limit: 5,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  // State for hidden tokens
  const [hiddenTokens, setHiddenTokens] = useState<Set<string>>(new Set());

  // Token visibility functions
  const hideToken = (contractAddress: string) => {
    setHiddenTokens((prev: Set<string>) => new Set([...prev, contractAddress]));
  };

  const showToken = (contractAddress: string) => {
    setHiddenTokens((prev: Set<string>) => {
      const newSet = new Set(prev);
      newSet.delete(contractAddress);
      return newSet;
    });
  };

  const isTokenHidden = (contractAddress: string) => {
    return hiddenTokens.has(contractAddress);
  };

  // Fetch ETH price
  useEffect(() => {
    async function fetchPrice() {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        setEthPrice(data.ethereum.usd);
      } catch (error) {
        console.error('Error fetching ETH price:', error);
        setEthPrice(2000); // Fallback price
      }
    }
    fetchPrice();
  }, []);

  // Fetch ads
  useEffect(() => {
    async function fetchAds() {
      try {
        const response = await fetch('/api/ads');
        if (response.ok) {
          const data = await response.json();
          setAds(data.ads || []);
        }
      } catch (error) {
        console.error('Error fetching ads:', error);
      }
    }
    fetchAds();
  }, []);

  // Fetch wallet data
  useEffect(() => {
    async function fetchData() {
      try {
        const resolvedParams = await params;
        const address = resolvedParams.walletAddress;
        setWalletAddress(address);

        // Fetch basic wallet data
        const basicResponse = await fetch('/api/alchemy/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'basic', address })
        });
        const basicResponseData = await basicResponse.json();
        const basicData = basicResponseData.data;

        // Fetch tokens
        const tokensResponse = await fetch('/api/alchemy/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'tokens', address })
        });
        const tokensResponseData = await tokensResponse.json();
        const tokensData = tokensResponseData.data;

        // Fetch transactions with pagination and filtering
        const txResponse = await fetch('/api/alchemy/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'transactions', 
            address,
            page: txPage,
            limit: txLimit,
            filter: txFilter
          })
        });
        const txResponseData = await txResponse.json();
        const txData = txResponseData.data;
        
        // Update pagination state
        if (txData) {
          setTxPagination({
            totalCount: txData.totalCount || 0,
            page: txData.page || 1,
            limit: txData.limit || 20,
            totalPages: txData.totalPages || 0,
            hasNextPage: txData.hasNextPage || false,
            hasPrevPage: txData.hasPrevPage || false
          });
        }

        // Process tokens with DEX Screener data
        let tokens = tokensData.tokenBalances || [];
        let totalTokenValue = 0;
        
        console.log('Raw tokens data:', tokensData);
        console.log('Tokens array:', tokens);

        // Transform token data to match frontend interface
        tokens = tokens.map((token: { name: string; symbol: string; tokenBalance: string; contractAddress: string; decimals: string; logo?: string }) => ({
          name: token.name,
          symbol: token.symbol,
          balance: token.tokenBalance,
          contractAddress: token.contractAddress,
          usdValue: 0, // Will be calculated below
          recentActivity: Math.floor(Math.random() * 10), // Placeholder
          tokenType: "ERC-20" as const,
          logo: token.logo,
          decimals: parseInt(token.decimals),
          priceUsd: 0, // Will be fetched from DEX Screener
          tokenImage: null, // Will be fetched from DEX Screener
          liquidity: 0,
          volume24h: 0,
          dexId: '',
          pairAddress: ''
        }));

        // Fetch token prices and images from DEX Screener
        const tokenPromises = tokens.map(async (token: Token) => {
          try {
            // Search for token on DEX Screener
            const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${token.contractAddress}`);
            if (dexResponse.ok) {
              const dexData = await dexResponse.json();
              const pairs = dexData.pairs || [];
              
              if (pairs.length > 0) {
                const pair = pairs[0]; // Get the first pair
                const tokenPrice = parseFloat(pair.priceUsd || "0");
                const usdValue = parseFloat(token.balance) * tokenPrice;
                totalTokenValue += usdValue;
                
                return { 
                  ...token, 
                  usdValue,
                  priceUsd: tokenPrice,
                  priceChange24h: parseFloat(pair.priceChange24h || "0"),
                  liquidity: pair.liquidity?.usd || 0,
                  volume24h: pair.volume?.h24 || 0,
                  dexId: pair.dexId,
                  pairAddress: pair.pairAddress,
                  tokenImage: pair.baseToken?.image || null
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching DEX data for ${token.symbol}:`, error);
          }
          
          // Fallback to placeholder price
          const tokenPrice = Math.random() * 100;
          const usdValue = parseFloat(token.balance) * tokenPrice;
          totalTokenValue += usdValue;
          return { ...token, usdValue, priceUsd: tokenPrice };
        });
        
        // Wait for all token price fetches to complete
        tokens = await Promise.all(tokenPromises);
        
        // Filter out tokens with ridiculous values and spam
        tokens = tokens.filter((token: Token) => {
          const usdValue = token.usdValue || 0;
          const tokenBalance = parseFloat(token.balance || '0');
          
          // Filter out tokens with value less than $1
          if (usdValue < 1) return false;
          
          // Filter out tokens with ridiculous token balances (likely spam/meme tokens)
          if (tokenBalance > 1000000000) return false; // Over 1 billion tokens
          
          // Filter out tokens with very long names/symbols (likely spam)
          if (token.name && token.name.length > 50) return false;
          if (token.symbol && token.symbol.length > 20) return false;
          
          // Filter out tokens with suspicious names (likely spam)
          const suspiciousKeywords = ['moon', 'doge', 'shib', 'inu', 'elon', 'safe', 'baby', 'rocket', 'moon', 'safe'];
          const nameLower = token.name?.toLowerCase() || '';
          const symbolLower = token.symbol?.toLowerCase() || '';
          
          if (suspiciousKeywords.some(keyword => nameLower.includes(keyword) || symbolLower.includes(keyword))) {
            return false;
          }
          
          return true;
        });
        console.log('Filtered tokens (removed spam/ridiculous values):', tokens.length);

        // Parse basic wallet data from JSON-RPC responses
        const chainId = parseInt(basicData[0]?.result || "0x1", 16);
        const blockNumber = parseInt(basicData[1]?.result || "0x0", 16);
        const nonce = parseInt(basicData[2]?.result || "0x0", 16);
        const isContract = basicData[3]?.result !== "0x";
        const ethBalance = parseInt(basicData[4]?.result || "0x0", 16) / 1e18;

        const ethUsdValue = ethBalance * ethPrice;
        const totalUsdValue = ethUsdValue + totalTokenValue;

        const portfolioAllocation = {
          eth: (ethUsdValue / totalUsdValue) * 100,
          tokens: (totalTokenValue / totalUsdValue) * 100
        };

        setWalletData({
          ethBalance,
          ethUsdValue,
          totalUsdValue,
          tokens,
          txList: txData.transactions || [],
          lastScannedBlock: { number: blockNumber.toString(), timestamp: Math.floor(Date.now() / 1000) },
          nonce,
          isContract,
          chainId: chainId.toString(),
          portfolioAllocation
        });

          setLoading(false);
      } catch (error) {
        console.error('Error fetching wallet data:', error);
        setError('Failed to load wallet data');
        setLoading(false);
      }
    }

    fetchData();
  }, [params, ethPrice]);

  // Refetch transactions when pagination or filter changes
  useEffect(() => {
    async function fetchTransactions() {
      if (!walletAddress) return;
      
      try {
        const txResponse = await fetch('/api/alchemy/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'transactions', 
            address: walletAddress,
            page: txPage,
            limit: txLimit,
            filter: txFilter
          })
        });
        const txResponseData = await txResponse.json();
        const txData = txResponseData.data;
        
        if (txData && walletData) {
          setWalletData({
            ...walletData,
            txList: txData.transactions || []
          });
          
          setTxPagination({
            totalCount: txData.totalCount || 0,
            page: txData.page || 1,
            limit: txData.limit || 20,
            totalPages: txData.totalPages || 0,
            hasNextPage: txData.hasNextPage || false,
            hasPrevPage: txData.hasPrevPage || false
          });
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      }
    }

    fetchTransactions();
  }, [walletAddress, txPage, txFilter, txLimit]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading wallet data...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !walletData) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-400 text-lg font-semibold mb-2">Error Loading Wallet</p>
            <p className="text-gray-400">{error || 'Unable to load wallet data'}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <Header />
      
      <div className="flex-1 w-full overflow-y-auto">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
          <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                    Wallet Explorer
                  </h1>
                  <p className="text-gray-400 text-sm sm:text-base">
                    <Link 
                      href={`/explorer/address/${walletAddress}`}
                      className="hover:text-blue-400 transition-colors break-all"
                    >
                      {formatAddress(walletAddress)}
                    </Link>
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-xs sm:text-sm text-gray-400">Total Value</p>
                    <p className="text-lg sm:text-2xl font-bold text-green-400">
                      ${formatNumber(walletData.totalUsdValue)}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-4"
                >
                  <p className="text-sm text-blue-300 mb-1">ETH Balance</p>
                  <p className="text-xl font-bold text-white">{walletData.ethBalance.toFixed(4)} ETH</p>
                  <p className="text-sm text-gray-400">${formatNumber(walletData.ethUsdValue)}</p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-4"
                >
                  <p className="text-sm text-green-300 mb-1">Tokens</p>
                  <p className="text-xl font-bold text-white">{walletData.tokens.length}</p>
                  <p className="text-sm text-gray-400">Different tokens</p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-4"
                >
                  <p className="text-sm text-purple-300 mb-1">Transactions</p>
                  <p className="text-xl font-bold text-white">{walletData.txList.length}</p>
                  <p className="text-sm text-gray-400">Recent activity</p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 rounded-xl p-4"
                >
                  <p className="text-sm text-orange-300 mb-1">Nonce</p>
                  <p className="text-xl font-bold text-white">{walletData.nonce || 0}</p>
                  <p className="text-sm text-gray-400">Next transaction</p>
                </motion.div>
              </div>
            </motion.div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6 lg:space-y-8">
                {/* Tab Navigation */}
                <div className="flex space-x-1 bg-gray-800/50 rounded-lg p-1 overflow-x-auto">
                  {[
                    { 
                      id: 'tokens', 
                      label: 'Tokens', 
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      )
                    },
                    { 
                      id: 'overview', 
                      label: 'Overview', 
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      )
                    },
                    { 
                      id: 'transactions', 
                      label: 'Transactions', 
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )
                    }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'overview' | 'tokens' | 'transactions')}
                      className={`flex-1 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center justify-center whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      <span className="mr-1 sm:mr-2">{tab.icon}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
                    className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6"
                  >
                    {activeTab === 'overview' && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold text-white mb-4">Portfolio Overview</h3>
                        
                        {/* Enhanced Portfolio Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Portfolio Allocation */}
                          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                            <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                              <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              Portfolio Allocation
                            </h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">ETH</span>
                                <span className="text-white font-medium">{walletData.portfolioAllocation?.eth.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">Tokens</span>
                                <span className="text-white font-medium">{walletData.portfolioAllocation?.tokens.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full" 
                                  style={{ width: `${walletData.portfolioAllocation?.eth || 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* Wallet Stats */}
                          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                            <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                              <svg className="w-5 h-5 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              Wallet Stats
                            </h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">Total Value</span>
                                <span className="text-green-400 font-medium">${formatNumber(walletData.totalUsdValue)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">ETH Balance</span>
                                <span className="text-white font-medium">{formatEthValue(walletData.ethBalance)} ETH</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">Token Count</span>
                                <span className="text-white font-medium">{walletData.tokens.filter(token => !isTokenHidden(token.contractAddress)).length}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">Transaction Count</span>
                                <span className="text-white font-medium">{walletData.txList.length}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Top Tokens by Value */}
                        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                          <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            Top Tokens by Value
                          </h4>
                          <div className="space-y-2">
                            {/* ETH as #1 */}
                            <div className="flex items-center justify-between p-2 bg-gray-900/30 rounded">
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-400 text-sm">#1</span>
                                <span className="text-white font-medium">ETH</span>
                              </div>
                              <span className="text-green-400 font-medium">${formatNumber(walletData.ethUsdValue)}</span>
                            </div>
                            {/* Top tokens */}
                            {walletData.tokens
                              .filter(token => !isTokenHidden(token.contractAddress))
                              .sort((a, b) => b.usdValue - a.usdValue)
                              .slice(0, 2)
                              .map((token, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-900/30 rounded">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-gray-400 text-sm">#{index + 2}</span>
                                    <span className="text-white font-medium">{token.symbol}</span>
                                  </div>
                                  <span className="text-green-400 font-medium">${formatNumber(token.usdValue)}</span>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                          <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            Recent Activity
                          </h4>
                          <div className="space-y-2">
                            {walletData.txList.slice(0, 3).map((tx, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-gray-900/30 rounded">
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-white text-sm">{getTransactionType(tx)}</p>
                                    <Link 
                                      href={`/explorer/tx/${tx.hash}`}
                                      className="text-blue-400 text-xs hover:underline"
                                    >
                                      {formatAddress(tx.hash)}
                                    </Link>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-white text-sm">{formatEthValue(parseFloat(tx.value) / 1e18)} ETH</p>
                                  <p className="text-gray-400 text-xs">
                                    {tx.timestamp ? formatTime(tx.timestamp) : 'Unknown'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'tokens' && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-white">Token Holdings</h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-400">
                            <span>Showing {walletData.tokens.filter(token => !isTokenHidden(token.contractAddress)).length} of {walletData.tokens.length} tokens</span>
                            {hiddenTokens.size > 0 && (
                              <button
                                onClick={() => setHiddenTokens(new Set())}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                Show All
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* ETH Balance Section */}
                        <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-white font-medium">Ethereum (ETH)</p>
                                <p className="text-gray-400 text-sm">Native token</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-medium">{formatEthValue(walletData.ethBalance)} ETH</p>
                              <p className="text-gray-400 text-sm">${formatNumber(walletData.ethUsdValue)}</p>
                            </div>
                          </div>
                        </div>
                        {walletData.tokens.length > 0 ? (
                          <div className="space-y-3">
                            {walletData.tokens
                              .filter(token => !isTokenHidden(token.contractAddress))
                              .map((token, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg"
                              >
                                                                 <div className="flex items-center space-x-3">
                                   <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                                     {token.tokenImage ? (
                                       <img 
                                         src={token.tokenImage} 
                                         alt={token.symbol}
                                         className="w-10 h-10 rounded-full"
                                         onError={(e) => {
                                           (e.currentTarget as HTMLImageElement).style.display = 'none';
                                           (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                         }}
                                       />
                                     ) : null}
                                     <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center" style={{ display: token.tokenImage ? 'none' : 'flex' }}>
                                       {/* Globe icon for all tokens */}
                                       <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                       </svg>
                                     </div>
                                   </div>
                                   <div className="flex-1">
                                     <p className="text-white font-medium">{token.symbol}</p>
                                     <p className="text-gray-400 text-sm">{token.name}</p>
                                     <div className="flex items-center space-x-2 mt-1">
                                       <span className="text-xs text-gray-500 font-mono">{formatAddress(token.contractAddress)}</span>
                                       <button
                                         onClick={(e) => {
                                           navigator.clipboard.writeText(token.contractAddress);
                                           // Simple feedback - could be replaced with a proper toast
                                           const button = e.currentTarget as HTMLButtonElement;
                                           const originalText = button.innerHTML;
                                           button.innerHTML = `
                                             <svg class="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                             </svg>
                                           `;
                                           setTimeout(() => {
                                             button.innerHTML = originalText;
                                           }, 1000);
                                         }}
                                         className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                         title="Copy address"
                                       >
                                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                         </svg>
                                       </button>
                                     </div>
                                   </div>
                                 </div>
                                <div className="text-right">
                                  <p className="text-white font-medium">{parseFloat(token.balance).toFixed(4)}</p>
                                  <p className="text-gray-400 text-sm">${formatNumber(token.usdValue)}</p>
                                  {token.priceUsd && (
                                    <p className="text-xs text-green-400">
                                      {formatTokenPrice(token.priceUsd)}
                                      {token.priceChange24h && (
                                        <span className="ml-1">
                                          ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%)
                                        </span>
                                      )}
                                    </p>
                                  )}
                                  <button
                                    onClick={() => hideToken(token.contractAddress)}
                                    className="mt-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
                                    title="Hide token"
                                  >
                                    Hide
                                  </button>
                                </div>
          </motion.div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                            </div>
                            <p className="text-gray-400 text-lg font-semibold mb-2">No Tokens Found</p>
                            <p className="text-gray-500">This wallet doesn&apos;t hold any tokens yet.</p>
                          </div>
                        )}
                        
                        {/* Hidden Tokens Section */}
                        {hiddenTokens.size > 0 && (
                          <div className="mt-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-lg font-semibold text-gray-400">Hidden Tokens ({hiddenTokens.size})</h4>
                              <button
                                onClick={() => setHiddenTokens(new Set())}
                                className="text-blue-400 hover:text-blue-300 transition-colors text-sm"
                              >
                                Show All
                              </button>
                            </div>
                            <div className="space-y-2">
                              {walletData.tokens
                                .filter(token => isTokenHidden(token.contractAddress))
                                .map((token, index) => (
                                  <div key={index} className="flex items-center justify-between p-3 bg-gray-900/20 rounded-lg opacity-60">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </div>
                                      <div>
                                        <p className="text-gray-400 font-medium">{token.symbol}</p>
                                        <p className="text-gray-500 text-xs">{token.name}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-gray-500 text-sm">${formatNumber(token.usdValue)}</span>
                                      <button
                                        onClick={() => showToken(token.contractAddress)}
                                        className="text-green-400 hover:text-green-300 transition-colors"
                                        title="Show token"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'transactions' && (
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                          <h3 className="text-xl font-bold text-white mb-4 sm:mb-0">Transaction History</h3>
                          
                          {/* Filter Controls */}
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={txFilter}
                              onChange={(e) => setTxFilter(e.target.value as 'all' | 'token_transfers' | 'internal')}
                              className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                            >
                              <option value="all">All Transactions</option>
                              <option value="token_transfers">Token Transfers</option>
                              <option value="internal">Internal Transactions</option>
                            </select>
                            
                            <div className="text-gray-400 text-sm flex items-center">
                              {txPagination.totalCount > 0 && (
                                <span>Showing {((txPagination.page - 1) * txPagination.limit) + 1}-{Math.min(txPagination.page * txPagination.limit, txPagination.totalCount)} of {txPagination.totalCount}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {walletData.txList.length > 0 ? (
                          <div className="space-y-3">
                            {walletData.txList.map((tx, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="p-4 bg-gray-900/30 rounded-lg"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-white font-medium">{getTransactionType(tx)}</p>
                                      <Link 
                                        href={`/explorer/tx/${tx.hash}`}
                                        className="text-blue-400 text-sm hover:underline"
                                      >
                                        {formatAddress(tx.hash)}
                                      </Link>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-white font-medium">
                                      {parseFloat(tx.value) > 0 
                                        ? `${formatEthValue(parseFloat(tx.value) / 1e18)} ETH`
                                        : '0.0000 ETH'
                                      }
                                    </p>
                                    <p className="text-gray-400 text-xs">
                                      {tx.timestamp ? formatTime(tx.timestamp) : 'Unknown'}
                                    </p>
                                    {tx.status === '0x0' || tx.status === 0 ? (
                                      <span className="text-red-400 text-xs">Failed</span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                                  <div>
                                    <span className="text-gray-500">From:</span> 
                                    <Link 
                                      href={`/explorer/address/${tx.from}`}
                                      className="hover:text-blue-400 transition-colors ml-1"
                                    >
                                      {formatAddress(tx.from)}
                                    </Link>
                                    {tx.fromName && (
                                      <div className="text-gray-500 text-xs mt-1">
                                        {tx.fromName}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-gray-500">To:</span> 
                                    <Link 
                                      href={`/explorer/address/${tx.to}`}
                                      className="hover:text-blue-400 transition-colors ml-1"
                                    >
                                      {formatAddress(tx.to)}
                                    </Link>
                                    {tx.toName && (
                                      <div className="text-gray-500 text-xs mt-1">
                                        {tx.toName}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Transaction Details */}
                                <div className="mt-3 pt-3 border-t border-gray-700/50">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                    <div>
                                      <span className="text-gray-500">Value:</span>
                                      <span className="text-white ml-1">
                                        {parseFloat(tx.value) > 0 
                                          ? `${formatEthValue(parseFloat(tx.value) / 1e18)} ETH`
                                          : '0.0000 ETH (Contract Interaction)'
                                        }
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Gas Price:</span>
                                      <span className="text-white ml-1">
                                        {tx.effectiveGasPrice 
                                          ? `${(parseInt(tx.effectiveGasPrice, 16) / 1e9).toFixed(3)} Gwei`
                                          : tx.gasPrice 
                                            ? `${(parseInt(tx.gasPrice, 16) / 1e9).toFixed(3)} Gwei`
                                            : 'N/A'
                                        }
                                      </span>
                                    </div>
                                    {tx.gasUsed && (
                                      <div>
                                        <span className="text-gray-500">Gas Used:</span>
                                        <span className="text-white ml-1">
                                          {parseInt(tx.gasUsed, 16).toLocaleString()}
                                        </span>
                                      </div>
                                    )}
                                    {tx.input && tx.input !== '0x' && (
                                      <div className="sm:col-span-3">
                                        <span className="text-gray-500">Method:</span>
                                        <span className="text-blue-400 ml-1 font-mono text-xs">
                                          {tx.input.slice(0, 10)}...
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                            
                            {/* Pagination Controls at Bottom */}
                            {txPagination.totalPages > 1 && (
                              <div className="flex justify-between items-center mt-6 p-4 bg-gray-800/30 rounded-lg">
                                <button
                                  onClick={() => setTxPage(Math.max(1, txPage - 1))}
                                  disabled={!txPagination.hasPrevPage}
                                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded text-sm transition-colors"
                                >
                                  Previous
                                </button>
                                
                                <div className="flex items-center space-x-2">
                                  {Array.from({ length: Math.min(5, txPagination.totalPages) }, (_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                      <button
                                        key={pageNum}
                                        onClick={() => setTxPage(pageNum)}
                                        className={`px-3 py-1 rounded text-sm transition-colors ${
                                          txPage === pageNum 
                                            ? 'bg-blue-500 text-white' 
                                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                        }`}
                                      >
                                        {pageNum}
                                      </button>
                                    );
                                  })}
                                  {txPagination.totalPages > 5 && (
                                    <span className="text-gray-400">...</span>
                                  )}
                                </div>
                                
                                <button
                                  onClick={() => setTxPage(txPage + 1)}
                                  disabled={!txPagination.hasNextPage}
                                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded text-sm transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <p className="text-gray-400 text-lg font-semibold mb-2">No Transactions Found</p>
                            <p className="text-gray-500">This wallet hasn&apos;t made any transactions yet.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
      </AnimatePresence>
              </div>

              {/* Right Sidebar */}
              <div className="space-y-4 lg:space-y-6">
                {/* Wallet Info */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6"
                >
                  <h3 className="text-lg font-bold text-white mb-4">Wallet Info</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Type</span>
                      <span className="text-white">{walletData.isContract ? 'Contract' : 'EOA'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Chain ID</span>
                      <span className="text-white">{walletData.chainId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Block</span>
                      <span className="text-white">{walletData.lastScannedBlock?.number || 'Unknown'}</span>
                    </div>
                  </div>
                </motion.div>

                {/* Ads */}
                {ads.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6"
                  >
                    <h3 className="text-lg font-bold text-white mb-4">Sponsored</h3>
                    {ads.map((ad, index) => (
                      <div key={index} className="mb-4 last:mb-0">
                        <a
                          href={ad.destinationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block hover:opacity-80 transition-opacity"
                        >
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <p className="text-white text-sm mb-2">{ad.type}</p>
                            <div className="w-full h-32 bg-gray-700 rounded-lg flex items-center justify-center">
                              <span className="text-gray-500 text-xs">Ad Image</span>
                            </div>
                          </div>
                        </a>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}