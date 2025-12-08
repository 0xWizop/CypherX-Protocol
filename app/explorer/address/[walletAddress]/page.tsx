"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Header from "@/app/components/Header";
import Footer from "../../../components/Footer";
import LoadingSpinner from "../../../components/LoadingSpinner";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { SiEthereum } from "react-icons/si";
import { FiCopy, FiCheck, FiExternalLink, FiChevronLeft, FiChevronRight } from "react-icons/fi";

// Types
interface Token {
  name: string;
  symbol: string;
  balance: string;
  contractAddress: string;
  usdValue: number;
  priceChange24h?: number;
  priceUsd?: number;
  tokenImage?: string;
  pairAddress?: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  timestamp: number;
  type: 'incoming' | 'outgoing' | 'internal';
  status: 'confirmed' | 'pending' | 'failed';
  gasFeeEth?: string;
  ethValueUsd?: number;
}

interface WalletData {
  ethBalance: number;
  ethUsdValue: number;
  totalUsdValue: number;
  tokens: Token[];
  txList: Transaction[];
  nonce?: number;
  isContract?: boolean;
  firstTxDate?: number;
}

// Utility functions
const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const formatEthValue = (value: number) => {
  if (value === 0) return '0.0000';
  if (value < 0.0001) return value.toFixed(8);
  return value.toFixed(4);
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

const getWalletAge = (firstTxDate?: number) => {
  if (!firstTxDate || firstTxDate <= 0) return '—';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - (firstTxDate > 1e12 ? Math.floor(firstTxDate / 1000) : firstTxDate);
  if (diff < 0) return '—';
  const days = Math.floor(diff / 86400);
  if (days > 365) return `${Math.floor(days / 365)}y`;
  return `${days}d`;
};

const TOKENS_PER_PAGE = 4;
const TXS_PER_PAGE = 4;

export default function WalletPage() {
  const params = useParams();
  const decodedAddress = params?.walletAddress ? decodeURIComponent(params.walletAddress as string) : "";
  
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'tokens' | 'transactions'>('tokens');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [tokenPage, setTokenPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [txFilter, setTxFilter] = useState<'all' | 'token_transfers' | 'internal'>('all');

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copied!');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(field);
      toast.success('Copied!');
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Paginated tokens
  const paginatedTokens = useMemo(() => {
    const tokens = walletData?.tokens || [];
    const start = (tokenPage - 1) * TOKENS_PER_PAGE;
    return tokens.slice(start, start + TOKENS_PER_PAGE);
  }, [walletData?.tokens, tokenPage]);

  const totalTokenPages = Math.ceil((walletData?.tokens?.length || 0) / TOKENS_PER_PAGE);

  // Paginated transactions
  const paginatedTxs = useMemo(() => {
    const txs = walletData?.txList || [];
    const start = (txPage - 1) * TXS_PER_PAGE;
    return txs.slice(start, start + TXS_PER_PAGE);
  }, [walletData?.txList, txPage]);

  const totalTxPages = Math.ceil((walletData?.txList?.length || 0) / TXS_PER_PAGE);

  // Fetch ETH price
  useEffect(() => {
    async function fetchPrice() {
      try {
        const response = await fetch('/api/price/eth');
        const data = await response.json();
        if (data.ethereum?.usd) setEthPrice(data.ethereum.usd);
      } catch (error) {
        console.error('Error fetching ETH price:', error);
      }
    }
    fetchPrice();
  }, []);

  // Update wallet data when ETH price changes
  useEffect(() => {
    if (ethPrice > 0 && walletData) {
      const ethUsdValue = walletData.ethBalance * ethPrice;
      const totalTokenValue = walletData.tokens.reduce((sum, t) => sum + (t.usdValue || 0), 0);
      setWalletData(prev => prev ? { ...prev, ethUsdValue, totalUsdValue: ethUsdValue + totalTokenValue } : null);
    }
  }, [ethPrice]);

  // Fetch wallet data
  useEffect(() => {
    async function fetchData() {
      if (!decodedAddress) return;
      
      try {
        const [basicRes, tokensRes, txRes] = await Promise.all([
          fetch('/api/alchemy/wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'basic', address: decodedAddress })
          }),
          fetch('/api/alchemy/wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'tokens', address: decodedAddress })
          }),
          fetch('/api/alchemy/wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'transactions', address: decodedAddress, page: 1, limit: 50, filter: 'all' })
          })
        ]);

        const [basicData, tokensData, txData] = await Promise.all([
          basicRes.json(),
          tokensRes.json(),
          txRes.json()
        ]);

        // Process tokens
        let tokens = (tokensData.data?.tokenBalances || []).map((t: any) => ({
          name: t.name,
          symbol: t.symbol,
          balance: t.tokenBalance,
          contractAddress: t.contractAddress,
          usdValue: t.usdValue || 0,
          priceUsd: t.priceUsd || 0,
          priceChange24h: t.priceChange24h || 0,
          tokenImage: t.logo || `https://dexscreener.com/base/${t.contractAddress}/logo.png`,
          pairAddress: t.pairAddress,
        })).filter((t: Token) => t.tokenImage && parseFloat(t.balance) <= 1e9);

        const basic = basicData.data;
        const nonce = parseInt(basic?.[2]?.result || "0x0", 16);
        const isContract = basic?.[3]?.result !== "0x";
        const ethBalance = parseInt(basic?.[4]?.result || "0x0", 16) / 1e18;

        let firstTxDate;
        const txs = txData.data?.transactions || [];
        if (txs.length > 0) {
          const timestamps = txs.map((tx: any) => tx.timestamp || 0).filter((t: number) => t > 0);
          if (timestamps.length > 0) firstTxDate = Math.min(...timestamps);
        }

        setWalletData({
          ethBalance,
          ethUsdValue: 0,
          totalUsdValue: tokens.reduce((sum: number, t: Token) => sum + (t.usdValue || 0), 0),
          tokens,
          txList: txs,
          nonce,
          isContract,
          firstTxDate
        });
        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load wallet');
        setLoading(false);
      }
    }
    fetchData();
  }, [decodedAddress]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner variant="dots" size="lg" text="Loading..." />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !walletData) {
    return (
      <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 text-lg mb-2">Error</p>
            <p className="text-gray-400">{error || 'Unable to load wallet'}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Calculate total tokens value for display
  const totalTokensValue = walletData.tokens.reduce((s, t) => s + (t.usdValue || 0), 0);

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      <Header />
      
      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto w-full px-3 sm:px-4 py-3 pb-6">
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2 flex-shrink-0">
            <Link href="/explorer" className="hover:text-blue-400">Explorer</Link>
            <span>/</span>
            <span className="text-gray-400">Address</span>
          </div>

          {/* Address Header */}
          <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-gray-100 font-mono text-sm sm:text-base truncate">{decodedAddress}</span>
                <button onClick={() => copyToClipboard(decodedAddress, "address")} className="text-gray-500 hover:text-blue-400 flex-shrink-0">
                  {copiedField === "address" ? <FiCheck className="w-4 h-4 text-green-400" /> : <FiCopy className="w-4 h-4" />}
                </button>
                <a href={`https://basescan.org/address/${decodedAddress}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-400 flex-shrink-0">
                  <FiExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mt-0.5">
                {walletData.isContract && <span className="text-purple-400">Contract</span>}
                <span>Age: {getWalletAge(walletData.firstTxDate)}</span>
                <span>Nonce: {walletData.nonce || 0}</span>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 flex-shrink-0">
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-lg px-3 py-2">
              <p className="text-gray-500 text-[10px] sm:text-xs uppercase tracking-wide">ETH Balance</p>
              <p className="text-gray-100 text-sm sm:text-base mt-0.5">{formatEthValue(walletData.ethBalance)} ETH</p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-lg px-3 py-2">
              <p className="text-gray-500 text-[10px] sm:text-xs uppercase tracking-wide">ETH Value</p>
              <p className="text-gray-100 text-sm sm:text-base mt-0.5">{ethPrice > 0 ? `$${walletData.ethUsdValue.toFixed(2)}` : '—'}</p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-lg px-3 py-2">
              <p className="text-gray-500 text-[10px] sm:text-xs uppercase tracking-wide">Tokens ({walletData.tokens.length})</p>
              <p className="text-gray-100 text-sm sm:text-base mt-0.5">${walletData.tokens.reduce((s, t) => s + (t.usdValue || 0), 0).toFixed(2)}</p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-lg px-3 py-2">
              <p className="text-gray-500 text-[10px] sm:text-xs uppercase tracking-wide">Total Value</p>
              <p className="text-blue-400 text-sm sm:text-base mt-0.5">${walletData.totalUsdValue.toFixed(2)}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-900/40 p-1 rounded-lg mb-2 flex-shrink-0">
            <button
              onClick={() => { setActiveTab('tokens'); setTokenPage(1); }}
              className={`flex-1 py-2 px-3 rounded-md text-sm sm:text-base transition-colors ${activeTab === 'tokens' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Tokens ({walletData.tokens.length})
            </button>
            <button
              onClick={() => { setActiveTab('transactions'); setTxPage(1); }}
              className={`flex-1 py-2 px-3 rounded-md text-sm sm:text-base transition-colors ${activeTab === 'transactions' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Transactions ({walletData.txList.length})
            </button>
          </div>

          {/* Content Area */}
          <div className="bg-gray-900/40 border border-gray-800/50 rounded-lg overflow-hidden">
            {activeTab === 'tokens' && (
              <div>
                {/* Token list */}
                <div>
                  {/* ETH Row */}
                  <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                        <SiEthereum className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-gray-100 text-base">Ethereum</p>
                        <p className="text-gray-500 text-sm">ETH</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-100 text-base">{formatEthValue(walletData.ethBalance)} ETH</p>
                      <p className="text-gray-500 text-sm">{ethPrice > 0 ? `$${walletData.ethUsdValue.toFixed(2)}` : '—'}</p>
                    </div>
                  </div>

                  {/* Token List */}
                  {paginatedTokens.length > 0 ? (
                    paginatedTokens.map((token) => (
                      <div key={token.contractAddress} className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-gray-800/30 hover:bg-gray-800/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {token.tokenImage ? (
                              <Image 
                                src={token.tokenImage} 
                                alt={token.symbol} 
                                width={40} 
                                height={40} 
                                className="w-10 h-10 object-cover" 
                                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                  e.currentTarget.style.display = 'none';
                                  const parent = e.currentTarget.parentElement;
                                  if (parent) {
                                    const fallback = document.createElement('span');
                                    fallback.className = 'text-gray-300 text-base font-medium';
                                    fallback.textContent = token.name?.charAt(0)?.toUpperCase() || token.symbol?.charAt(0)?.toUpperCase() || '?';
                                    parent.appendChild(fallback);
                                  }
                                }} 
                              />
                            ) : (
                              <span className="text-gray-300 text-base font-medium">{token.name?.charAt(0)?.toUpperCase() || token.symbol?.charAt(0)?.toUpperCase() || '?'}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-100 text-base truncate">{token.symbol}</span>
                              <Link href={`/discover/${token.pairAddress || token.contractAddress}/chart`} className="text-blue-400 hover:text-blue-300 text-xs flex-shrink-0">
                                Chart →
                              </Link>
                            </div>
                            <p className="text-gray-500 text-sm truncate max-w-[120px] sm:max-w-[180px]">{token.name}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-gray-100 text-base">{parseFloat(token.balance).toFixed(4)}</p>
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-gray-500 text-sm">${token.usdValue.toFixed(2)}</span>
                            {token.priceChange24h !== undefined && (
                              <span className={`text-xs ${token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-gray-500 text-base">No tokens found</div>
                  )}
                </div>

                {/* Token Pagination */}
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 bg-gray-900/80 border-t border-gray-800/50">
                  <span className="text-gray-400 text-sm">{walletData.tokens.length} tokens • ${totalTokensValue.toFixed(2)}</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTokenPage(Math.max(1, tokenPage - 1))}
                      disabled={tokenPage === 1}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <FiChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-gray-200 text-base min-w-[60px] text-center">{tokenPage} / {totalTokenPages || 1}</span>
                    <button
                      onClick={() => setTokenPage(Math.min(totalTokenPages, tokenPage + 1))}
                      disabled={tokenPage >= totalTokenPages}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <FiChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div>
                {/* Filter bar */}
                <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-800/50">
                  <select
                    value={txFilter}
                    onChange={(e) => setTxFilter(e.target.value as any)}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-sm focus:outline-none focus:border-gray-600"
                  >
                    <option value="all">All</option>
                    <option value="token_transfers">Tokens</option>
                    <option value="internal">Internal</option>
                  </select>
                  <span className="text-gray-400 text-sm">{walletData.txList.length} transactions</span>
                </div>

                {/* TX list */}
                <div>
                  {paginatedTxs.length > 0 ? (
                    paginatedTxs.map((tx) => (
                      <div key={tx.hash} className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-gray-800/30 hover:bg-gray-800/30">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-2 py-1 rounded text-xs flex-shrink-0 ${
                            tx.type === 'incoming' ? 'bg-green-500/15 text-green-400' :
                            tx.type === 'outgoing' ? 'bg-red-500/15 text-red-400' :
                            'bg-blue-500/15 text-blue-400'
                          }`}>
                            {tx.type === 'incoming' ? 'IN' : tx.type === 'outgoing' ? 'OUT' : 'INT'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link href={`/explorer/tx/${tx.hash}`} className="text-blue-400 hover:text-blue-300 text-sm sm:text-base font-mono truncate">
                                {formatAddress(tx.hash)}
                              </Link>
                              <button onClick={() => copyToClipboard(tx.hash, `tx-${tx.hash}`)} className="text-gray-500 hover:text-blue-400 flex-shrink-0">
                                {copiedField === `tx-${tx.hash}` ? <FiCheck className="w-3.5 h-3.5 text-green-400" /> : <FiCopy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <div className="flex gap-2 text-xs sm:text-sm text-gray-500 mt-0.5">
                              <span className="truncate">From: <Link href={`/explorer/address/${tx.from}`} className="text-gray-400 hover:text-blue-400">{formatAddress(tx.from)}</Link></span>
                              <span className="hidden sm:inline">→</span>
                              <span className="truncate">To: <Link href={`/explorer/address/${tx.to}`} className="text-gray-400 hover:text-blue-400">{formatAddress(tx.to)}</Link></span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-gray-100 text-sm sm:text-base">
                            {parseFloat(tx.value) > 0 ? `${formatEthValue(parseFloat(tx.value) / 1e18)} ETH` : '0 ETH'}
                          </p>
                          <p className="text-gray-500 text-xs sm:text-sm">{tx.timestamp ? formatTime(tx.timestamp) : '—'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-gray-500 text-base">No transactions found</div>
                  )}
                </div>

                {/* TX Pagination */}
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 bg-gray-900/80 border-t border-gray-800/50">
                  <span className="text-gray-400 text-sm">{walletData.txList.length} transactions</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTxPage(Math.max(1, txPage - 1))}
                      disabled={txPage === 1}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <FiChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-gray-200 text-base min-w-[60px] text-center">{txPage} / {totalTxPages || 1}</span>
                    <button
                      onClick={() => setTxPage(Math.min(totalTxPages, txPage + 1))}
                      disabled={txPage >= totalTxPages}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <FiChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
