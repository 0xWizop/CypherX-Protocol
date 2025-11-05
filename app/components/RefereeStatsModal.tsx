import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
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
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const TIERS = {
    normie: { name: 'Normie', color: 'text-gray-400' },
    degen: { name: 'Degen', color: 'text-orange-500' },
    alpha: { name: 'Alpha', color: 'text-green-500' },
    mogul: { name: 'Mogul', color: 'text-yellow-500' },
    titan: { name: 'Titan', color: 'text-purple-500' },
  };

  const currentTier = stats?.userData.tier ? TIERS[stats.userData.tier as keyof typeof TIERS] : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-200">
                Referee Stats
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors duration-200"
              >
                <FaTimes className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {stats && !loading && (
              <div className="space-y-6">
                {/* User Info */}
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">User Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">User ID</p>
                      <p className="text-sm font-mono text-gray-200">{formatAddress(stats.refereeId)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Wallet Address</p>
                      <p className="text-sm font-mono text-gray-200">{formatAddress(stats.walletAddress)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Tier</p>
                      <p className={`text-sm font-bold ${currentTier?.color || 'text-gray-400'}`}>
                        {currentTier?.name || stats.userData.tier}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Points</p>
                      <p className="text-sm font-bold text-gray-200">{stats.userData.points.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Trading Stats */}
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">
                    Trading Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Total Volume</p>
                      <p className="text-lg font-bold text-green-400">
                        ${stats.stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Total Transactions</p>
                      <p className="text-lg font-bold text-gray-200">{stats.stats.totalTransactions}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Total Platform Fees</p>
                      <p className="text-sm font-bold text-gray-300">
                        ${stats.stats.totalPlatformFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Your Referral Earnings</p>
                      <p className="text-sm font-bold text-green-400 flex items-center space-x-1">
                        <SiEthereum className="w-4 h-4 text-gray-400" />
                        <span>{stats.stats.totalReferralRewards.toFixed(4)}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Volume Traded (All Time)</p>
                      <p className="text-sm font-bold text-gray-200">
                        ${stats.stats.volumeTraded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Total Trades (All Time)</p>
                      <p className="text-sm font-bold text-gray-200">{stats.stats.transactions}</p>
                    </div>
                  </div>
                </div>

                {/* Recent Trades */}
                {stats.recentTrades.length > 0 && (
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">
                      Recent Trades
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {stats.recentTrades.map((trade) => (
                        <div key={trade.id} className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/20">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${
                                trade.type === 'buy' ? 'bg-green-400' : 'bg-red-400'
                              }`}></div>
                              <p className="text-xs font-medium text-gray-300 capitalize">{trade.type}</p>
                            </div>
                            <p className="text-xs text-gray-400">{formatDate(trade.timestamp)}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-400">Value</p>
                              <p className="text-sm font-bold text-gray-200">
                                ${(trade.outputValue || trade.inputValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stats.recentTrades.length === 0 && (
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30 text-center">
                    <p className="text-sm text-gray-400">No recent trades found</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-700/30">
              <button
                onClick={onClose}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-4 rounded-lg transition-colors duration-200"
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

