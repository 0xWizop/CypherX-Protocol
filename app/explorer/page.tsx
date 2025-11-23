'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
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
  const previousTxHashesRef = useRef<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      const [blocksRes, transactionsRes] = await Promise.all([
        fetch('/api/explorer/blocks?limit=15').catch(() => null),
        fetch('/api/explorer/transactions?limit=15').catch(() => null)
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
    } catch (error) {
      console.error('Error fetching explorer data:', error);
    } finally {
      setLoading(false);
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
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatHash = (hash: string) => {
    if (!hash) return 'N/A';
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner variant="dots" size="lg" text="Loading Explorer..." />
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        @media (min-width: 769px) {
          body {
            overflow: hidden !important;
          }
        }
      `}</style>
      <div className="min-h-screen sm:h-screen bg-gray-950 flex flex-col sm:overflow-hidden">
        <Header />
        <div className="flex-1 bg-gray-950 sm:overflow-hidden">
          <div className="h-full w-full max-w-[1280px] mx-auto px-4 sm:px-5 lg:px-8 pt-6 pb-20 sm:pb-6 flex flex-col gap-5 sm:overflow-y-auto sm:scrollbar-hide">
          {/* Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-base font-normal text-white sm:text-xl">Explorer</h1>
              <p className="text-gray-400 text-xs sm:text-sm">
                Monitor the latest Base blocks and transactions in real time.
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-stretch">
            {/* Latest Blocks */}
            <div className="bg-slate-800/30 rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-3 sm:px-4 pt-3 pb-2">
                <h2 className="text-sm font-semibold text-white">Latest Blocks</h2>
                <Link href="/explorer/latest/block" className="text-blue-400 hover:text-blue-300 text-xs">
                  View all
                </Link>
              </div>
              
              <div className="flex-1">
                <div className="grid grid-cols-1">
                  {blocks.slice(0, 15).map((block) => (
                    <div key={block.number} className="flex items-center gap-2 px-3 sm:px-4 py-2.5">
                    <div className="flex items-center flex-1 min-w-0">
                      <a 
                        href={`/explorer/latest/block/${parseInt(block.number, 16)}`}
                        className="text-blue-400 hover:text-blue-300 font-mono text-xs truncate"
                      >
                        #{parseInt(block.number, 16)}
                      </a>
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0">
                      <span>{block.transactionCount} tx</span>
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0 min-w-[70px] text-right">
                      {formatTimeAgo(block.timestamp)}
                    </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Latest Transactions */}
            <div className="bg-slate-800/30 rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-3 sm:px-4 pt-3 pb-2">
                <h2 className="text-sm font-semibold text-white">Latest Transactions</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1">
                  <AnimatePresence mode="popLayout">
                    {transactions.slice(0, 15).map((tx) => {
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
                          <div className="flex items-center gap-2">
                            <div className="flex items-center flex-1 min-w-0">
                              <a href={`/explorer/tx/${tx.hash}`} className="font-mono text-xs text-blue-400 hover:text-blue-300 truncate">
                                {formatHash(tx.hash)}
                              </a>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <a 
                                href={`/explorer/address/${tx.from}`}
                                className="text-xs text-white hover:text-blue-300 truncate max-w-[45px] sm:max-w-none"
                                title={tx.from}
                              >
                                {formatAddress(tx.from)}
                              </a>
                              <FiArrowRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              <a 
                                href={`/explorer/address/${tx.to}`}
                                className="text-xs text-white hover:text-blue-300 truncate max-w-[45px] sm:max-w-none"
                                title={tx.to}
                              >
                                {formatAddress(tx.to)}
                              </a>
                            </div>
                            <div className="text-xs text-gray-400 flex-shrink-0 min-w-[70px] text-right">
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
    </>
  );
}
