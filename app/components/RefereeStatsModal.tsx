import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { SiEthereum } from 'react-icons/si';
import { useAuth } from '../providers';

interface RefereeStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  refereeId: string;
}

interface RefereeStats {
  refereeId: string;
  walletAddress: string | null;
  userData: {
    points: number;
    tier: string;
    email: string | null;
  };
  stats: {
    totalVolume: number;
    totalPlatformFees: number;
    totalReferralRewards: number;
    totalTransactions: number;
    volumeTraded: number;
    transactions: number;
  };
  recentTrades: Array<{
    id: string;
    timestamp: any;
    inputValue: number;
    outputValue: number;
    type: string;
  }>;
  joinedAt: string | null;
}

export default function RefereeStatsModal({ isOpen, onClose, refereeId }: RefereeStatsModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RefereeStats | null>(null);

  useEffect(() => {
    if (isOpen && refereeId && user) {
      fetchRefereeStats();
    }
  }, [isOpen, refereeId, user]);

  const fetchRefereeStats = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const response = await fetch(`/api/rewards/referee?refereeId=${refereeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch referee stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch referee stats');
      console.error('Error fetching referee stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string | null) => {
    if (!address) return 'Not linked';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div>
                <h2 className="text-base font-semibold text-white">Referee Details</h2>
                {stats && (
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {formatAddress(stats.refereeId)}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-700 border-t-blue-500"></div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {stats && !loading && (
                <div className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Volume</p>
                      <p className="text-lg font-semibold text-white">
                        ${stats.stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Transactions</p>
                      <p className="text-lg font-semibold text-white">{stats.stats.totalTransactions}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Platform Fees</p>
                      <p className="text-lg font-semibold text-white">
                        ${stats.stats.totalPlatformFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Your Earnings</p>
                      <p className="text-lg font-semibold text-white flex items-center gap-1">
                        <SiEthereum className="w-4 h-4 text-gray-400" />
                        {stats.stats.totalReferralRewards.toFixed(4)}
                      </p>
                    </div>
                  </div>

                  {/* Wallet Info */}
                  {stats.walletAddress && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Wallet Address</p>
                      <p className="text-sm font-mono text-gray-300">{stats.walletAddress}</p>
                    </div>
                  )}

                  {/* Recent Trades */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-3">Recent Trades</h3>
                    {stats.recentTrades.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                        {stats.recentTrades.map((trade) => (
                          <div key={trade.id} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  trade.type === 'buy' ? 'bg-green-400' : 'bg-red-400'
                                }`}></div>
                                <span className="text-xs font-medium text-gray-300 capitalize">{trade.type}</span>
                              </div>
                              <span className="text-[10px] text-gray-500">{formatDate(trade.timestamp)}</span>
                            </div>
                            <p className="text-sm font-medium text-white mt-1">
                              ${(trade.outputValue || trade.inputValue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50 text-center">
                        <p className="text-sm text-gray-500">No trades yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800">
              <button
                onClick={onClose}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
