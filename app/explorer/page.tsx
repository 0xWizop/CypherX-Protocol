'use client';

import { useState, useEffect } from 'react';
import { FiBox, FiArrowRight, FiRefreshCw } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

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

  const fetchData = async () => {
    try {
      setRefreshing(true);
      
      const [blocksRes, transactionsRes] = await Promise.all([
        fetch('/api/explorer/blocks?limit=15'),
        fetch('/api/explorer/transactions?limit=15')
      ]);

      if (blocksRes.ok) {
        const blocksData = await blocksRes.json();
        setBlocks(blocksData.data.blocks);
      }

      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData.data.transactions);
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
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading explorer data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 bg-slate-900 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col">
          {/* Header */}
          <div className="text-left mb-4 flex-shrink-0">
            <h1 className="text-lg font-normal mb-1 text-white">Explorer</h1>
            <p className="text-gray-400 text-xs">Latest blocks and transactions</p>
          </div>

          {/* Main Content */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
            {/* Latest Blocks */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-lg font-semibold text-white">Latest Blocks</h2>
                <a href="/explorer/latest/block" className="text-blue-400 hover:text-blue-300 text-sm">
                  View all
                </a>
              </div>
              
              <div>
                {blocks.slice(0, 15).map((block, index) => (
                  <div key={block.number}>
                    <div className="flex items-center px-4 py-1.5">
                      <div className="flex items-center space-x-2 flex-1">
                        <FiBox className="w-3.5 h-3.5 text-blue-400" />
                        <a 
                          href={`/explorer/latest/block/${parseInt(block.number, 16)}`}
                          className="text-blue-400 hover:text-blue-300 font-mono text-sm"
                        >
                          #{parseInt(block.number, 16).toLocaleString()}
                        </a>
                      </div>
                      <div className="text-right mr-4">
                        <div className="text-sm text-white">
                          {block.transactionCount} tx
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">
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
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-lg font-semibold text-white">Latest Transactions</h2>
              </div>
              
              <div>
                {transactions.slice(0, 15).map((tx, index) => (
                  <div key={tx.hash}>
                    <div className="flex items-center px-4 py-1.5">
                      <div className="flex-1 min-w-0">
                        <a 
                          href={`/explorer/tx/${tx.hash}`}
                          className="text-blue-400 hover:text-blue-300 font-mono text-sm block truncate"
                        >
                          {formatHash(tx.hash)}
                        </a>
                      </div>
                      <div className="text-right mr-2 min-w-[96px]">
                        <a 
                          href={`/explorer/address/${tx.from}`}
                          className="text-sm text-gray-400 truncate hover:text-blue-300"
                        >
                          {formatAddress(tx.from)}
                        </a>
                      </div>
                      <div className="flex items-center justify-center mr-2">
                        <FiArrowRight className="w-3 h-3 text-gray-400" />
                      </div>
                      <div className="text-right mr-4 min-w-[96px]">
                        <a 
                          href={`/explorer/address/${tx.to}`}
                          className="text-sm text-gray-400 truncate hover:text-blue-300"
                        >
                          {formatAddress(tx.to)}
                        </a>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">
                          {formatTimeAgo(tx.timestamp)}
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
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}