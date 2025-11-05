'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBox, FiArrowRight, FiRefreshCw } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';
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
        fetch('/api/explorer/blocks?limit=15'),
        fetch('/api/explorer/transactions?limit=15'),
        fetch('/api/explorer/stats?period=24h')
      ]);

      if (blocksRes.ok) {
        const blocksData = await blocksRes.json();
        setBlocks(blocksData.data.blocks);
      }

      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        const newTransactions = transactionsData.data.transactions;
        
        // On initial load, add all transactions to the ref so they don't animate
        if (transactions.length === 0) {
          newTransactions.forEach((tx: Transaction) => {
            previousTxHashesRef.current.add(tx.hash);
          });
        }
        
        setTransactions(newTransactions);
      }

      if (txCountRes.ok) {
        const statsData = await txCountRes.json();
        setTxCount24h(statsData.data?.txCount || statsData.txCount || null);
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

  const formatValue = (value: string) => {
    if (!value) return '0';
    const wei = parseInt(value, 16);
    const eth = wei / Math.pow(10, 18);
    return eth.toFixed(4);
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
    <div className="h-screen bg-[#0f172a] flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 bg-[#0f172a] overflow-hidden">
        <div className="h-full w-full max-w-[1280px] mx-auto px-5 lg:px-8 pt-6 pb-0 flex flex-col">
          {/* Header */}
          <div className="text-left mb-4 flex-shrink-0">
            <h1 className="text-base font-semibold mb-0.5 text-white">Explorer</h1>
            <p className="text-gray-400 text-xs">Latest blocks and transactions</p>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Latest Blocks */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-700/50">
                <h2 className="text-sm font-semibold text-white">Latest Blocks</h2>
                <a href="/explorer/latest/block" className="text-blue-400 hover:text-blue-300 text-xs">
                  View all
                </a>
              </div>
              
              <div>
                {blocks.slice(0, 15).map((block, index) => (
                  <div key={block.number}>
                    <div className="flex items-center px-4 py-1.5">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <FiBox className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <a 
                          href={`/explorer/latest/block/${parseInt(block.number, 16)}`}
                          className="text-white hover:text-blue-300 font-mono text-xs"
                        >
                          #{parseInt(block.number, 16)}
                        </a>
                      </div>
                      <div className="text-right min-w-[65px] flex-shrink-0">
                        <div className="text-xs text-gray-400">
                          {block.transactionCount} tx
                        </div>
                      </div>
                      <div className="text-right min-w-[65px] flex-shrink-0 ml-auto">
                        <div className="text-xs text-gray-400">
                          {formatTimeAgo(block.timestamp)}
                        </div>
                      </div>
                    </div>
                    {index < 14 && (
                      <div className="border-b border-gray-700/50"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Latest Transactions */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-700/50">
                <h2 className="text-sm font-semibold text-white">Latest Transactions</h2>
                {txCount24h !== null && (
                  <span className="text-xs text-blue-400">
                    24h txs: <span className="text-blue-400">{txCount24h.toLocaleString()}</span>
                  </span>
                )}
              </div>
              
              <div>
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
                        <div className="flex items-center px-4 py-1.5">
                          <div className="min-w-[120px] flex-shrink-0">
                            <a 
                              href={`/explorer/tx/${tx.hash}`}
                              className="text-blue-400 hover:text-blue-300 font-mono text-xs block truncate"
                            >
                              {formatHash(tx.hash)}
                            </a>
                          </div>
                          <div className="flex-1"></div>
                          <div className="text-left min-w-[85px] flex-shrink-0">
                            <a 
                              href={`/explorer/address/${tx.from}`}
                              className="text-xs text-white truncate hover:text-blue-300 block"
                            >
                              {formatAddress(tx.from)}
                            </a>
                          </div>
                          <div className="flex items-center justify-center flex-shrink-0 w-4 mx-3">
                            <FiArrowRight className="w-3 h-3 text-gray-400" />
                          </div>
                          <div className="text-left min-w-[85px] flex-shrink-0">
                            <a 
                              href={`/explorer/address/${tx.to}`}
                              className="text-xs text-white truncate hover:text-blue-300 block"
                            >
                              {formatAddress(tx.to)}
                            </a>
                          </div>
                          <div className="text-right min-w-[65px] flex-shrink-0 ml-auto">
                            <div className="text-xs text-gray-400">
                              {formatTimeAgo(tx.timestamp)}
                            </div>
                          </div>
                        </div>
                        {index < 14 && (
                          <div className="border-b border-gray-700/50"></div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
