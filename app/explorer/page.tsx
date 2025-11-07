'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBox, FiArrowRight } from 'react-icons/fi';
import Link from 'next/link';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';

interface Block {
  number: string;
  hash: string;
  timestamp: number;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  miner: string;
  size: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  nonce: string;
  blockNumber: string;
  blockHash: string;
  transactionIndex: string;
  timestamp: number;
  input: string;
  status: 'success' | 'failed' | 'pending';
}

export default function ExplorerPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [txCount24h, setTxCount24h] = useState<number | null>(null);
  const previousTxHashesRef = useRef<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      setRefreshing(true);
      
      const [blocksRes, transactionsRes, txCountRes] = await Promise.all([
        fetch('/api/explorer/blocks?limit=15').catch(() => null),
        fetch('/api/explorer/transactions?limit=15').catch(() => null),
        fetch('/api/explorer/stats?period=24h').catch(() => null)
      ]);

      if (blocksRes?.ok) {
        const blocksData = await blocksRes.json().catch(() => null);
        const normalizedBlocks = Array.isArray(blocksData?.data?.blocks)
          ? blocksData.data.blocks
          : Array.isArray(blocksData?.blocks)
          ? blocksData.blocks
          : [];
        setBlocks(normalizedBlocks.filter(Boolean));
      } else {
        setBlocks([]);
      }

      if (transactionsRes?.ok) {
        const transactionsData = await transactionsRes.json().catch(() => null);
        const newTransactions = Array.isArray(transactionsData?.data?.transactions)
          ? transactionsData.data.transactions
          : Array.isArray(transactionsData?.transactions)
          ? transactionsData.transactions
          : [];

        if (transactions.length === 0) {
          newTransactions.forEach((tx: Transaction) => {
            if (tx?.hash) {
              previousTxHashesRef.current.add(tx.hash);
            }
          });
        }
        setTransactions(newTransactions.filter(Boolean));
      } else {
        setTransactions([]);
      }

      if (txCountRes?.ok) {
        const statsData = await txCountRes.json().catch(() => null);
        const txCountValue =
          typeof statsData?.data?.txCount === 'number'
            ? statsData.data.txCount
            : typeof statsData?.txCount === 'number'
            ? statsData.txCount
            : null;
        setTxCount24h(txCountValue);
      }
    } catch (error) {
      console.error('Error fetching explorer data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatHash = (hash: string) => {
    if (!hash) return 'N/A';
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner variant="dots" size="lg" text="Loading Explorer..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      <Header />
      <div className="flex-1 bg-[#0f172a] overflow-hidden">
        <div className="h-full w-full max-w-[1280px] mx-auto px-4 sm:px-5 lg:px-8 pt-6 pb-6 flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-base font-normal text-white sm:text-xl">Explorer</h1>
              <p className="text-gray-400 text-xs sm:text-sm">
                Monitor the latest Base blocks and transactions in real time.
              </p>
            </div>
            {txCount24h !== null && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-blue-900/50 bg-[#101c3d]/70 px-3 py-2 text-xs font-medium text-blue-200">
                <FiBox className="h-4 w-4" />
                <span>24h tx: {txCount24h.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-stretch">
            {/* Latest Blocks */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-3 sm:px-4 pt-3 pb-2 border-b border-gray-700/50">
                <h2 className="text-sm font-semibold text-white">Latest Blocks</h2>
                <Link href="/explorer/latest/block" className="text-blue-400 hover:text-blue-300 text-xs">
                  View all
                </Link>
              </div>
              
              <div className="flex-1">
                <div className="grid grid-cols-1 divide-y divide-gray-700/30">
                  {blocks.slice(0, 15).map((block) => (
                    <div key={block.number} className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2.5">
                    <div className="flex items-center space-x-2 flex-1 min-w-[120px]">
                      <FiBox className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <a 
                        href={`/explorer/latest/block/${parseInt(block.number, 16)}`}
                        className="text-white hover:text-blue-300 font-mono text-xs"
                      >
                        #{parseInt(block.number, 16)}
                      </a>
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      <span>{block.transactionCount} tx</span>
                    </div>
                    <div className="text-xs text-gray-400 ml-auto min-w-[70px] text-right">
                      {formatTimeAgo(block.timestamp)}
                    </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Latest Transactions */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-3 sm:px-4 pt-3 pb-2 border-b border-gray-700/50">
                <h2 className="text-sm font-semibold text-white">Latest Transactions</h2>
                {txCount24h !== null && (
                  <span className="text-xs text-blue-400">
                    24h txs: <span className="text-blue-400">{txCount24h.toLocaleString()}</span>
                  </span>
                )}
              </div>
              
              <div className="flex-1">
                <div className="grid grid-cols-1 divide-y divide-gray-700/30">
                  <AnimatePresence mode="popLayout">
                    {transactions.slice(0, 15).map((tx, index) => {
                    const isNew = !previousTxHashesRef.current.has(tx.hash);
                    if (isNew) {
                      previousTxHashesRef.current.add(tx.hash);
                    }
                    return (
                      <motion.div
                        key={tx.hash}
                        initial={isNew ? { opacity: 0, y: -10 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      >
                          <div className="px-3 sm:px-4 py-2.5">
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <span className="font-mono text-xs text-blue-400">
                                <a href={`/explorer/tx/${tx.hash}`} className="hover:text-blue-300">
                                  {formatHash(tx.hash)}
                                </a>
                              </span>
                              <span className="hidden sm:inline text-gray-600">•</span>
                              <span className="text-[11px] text-gray-400 sm:hidden">{formatTimeAgo(tx.timestamp)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <a 
                                href={`/explorer/address/${tx.from}`}
                                className="text-xs text-white truncate hover:text-blue-300 max-w-[120px]"
                              >
                                {formatAddress(tx.from)}
                              </a>
                              <FiArrowRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              <a 
                                href={`/explorer/address/${tx.to}`}
                                className="text-xs text-white truncate hover:text-blue-300 max-w-[120px]"
                              >
                                {formatAddress(tx.to)}
                              </a>
                            </div>
                            <div className="hidden sm:flex text-xs text-gray-400 min-w-[60px] justify-end">
                              {formatTimeAgo(tx.timestamp)}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
