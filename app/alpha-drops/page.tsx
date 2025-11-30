"use client";

import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useLoading } from "../components/LoadingProvider";
import { useAuth } from "@/app/providers";
import { 
  FiPlus,
  FiRefreshCw,
  FiZap
} from "react-icons/fi";
import CreatePredictionModal from "../components/CreatePredictionModal";
import PredictionPoolCard from "../components/PredictionPoolCard";

interface PredictionPool {
  id: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  predictionType: 'PUMP' | 'DUMP';
  threshold: number;
  timeframe: number;
  status: 'ACTIVE' | 'RESOLVING' | 'RESOLVED' | 'CANCELLED';
  startTime: number;
  endTime: number;
  resolvedAt?: number;
  startPrice: number;
  endPrice?: number;
  participants: Array<{
    walletAddress: string;
    stakeAmount: number;
    prediction: 'YES' | 'NO';
    isWinner?: boolean;
    payout?: number;
  }>;
  totalStaked: number;
  winnerCount: number;
  loserCount: number;
  totalPot: number;
  gasFeePool: number;
  winnerPayout?: number;
  outcome?: 'YES' | 'NO';
  priceChange?: number;
}

export default function AlphaDropsPage() {
  const { user } = useAuth();
  const { isLoading: pageLoading } = useLoading();
  const [pools, setPools] = useState<PredictionPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ACTIVE');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch pools
  const fetchPools = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/predictions/list?status=${filter}&limit=50`);
      const data = await response.json();
      
      if (data.success) {
        setPools(data.pools || []);
      }
    } catch (error) {
      console.error("Error fetching pools:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPools();
  }, [filter]);

  // Auto-refresh every 10 seconds for active pools
  useEffect(() => {
    if (filter === 'ACTIVE') {
      const interval = setInterval(() => {
        fetchPools(true);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [filter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPools();
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchPools();
  };

  // Filter pools by status
  const filteredPools = pools.filter(pool => {
    if (filter === 'ALL') return true;
    return pool.status === filter;
  });

  // Sort pools: active first, then by creation time
  const sortedPools = [...filteredPools].sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
    return b.startTime - a.startTime;
  });

  if (pageLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <FiZap className="text-blue-500" />
                Gasless Alpha Drops
              </h1>
              <p className="text-gray-400 text-lg">
                Predict token movements. Winners split the pot. Losers pay gas fees.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
              >
                <FiPlus className="w-5 h-5" />
                Create Prediction
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-800">
            {(['ALL', 'ACTIVE', 'RESOLVED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 font-medium transition-colors ${
                  filter === status
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {status}
                {status !== 'ALL' && (
                  <span className="ml-2 text-xs bg-gray-800 px-2 py-0.5 rounded">
                    {pools.filter(p => p.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Active Pools</div>
            <div className="text-2xl font-bold text-white">
              {pools.filter(p => p.status === 'ACTIVE').length}
            </div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Total Staked</div>
            <div className="text-2xl font-bold text-white">
              ${pools.reduce((sum, p) => sum + p.totalStaked, 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Total Participants</div>
            <div className="text-2xl font-bold text-white">
              {pools.reduce((sum, p) => sum + p.participants.length, 0)}
            </div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Resolved Today</div>
            <div className="text-2xl font-bold text-white">
              {pools.filter(p => p.status === 'RESOLVED' && p.resolvedAt && (Date.now() - p.resolvedAt < 86400000)).length}
            </div>
          </div>
        </div>

        {/* Pools Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : sortedPools.length === 0 ? (
          <div className="text-center py-20">
            <FiZap className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No prediction pools found</h3>
            <p className="text-gray-500 mb-6">Be the first to create a prediction pool!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Create Prediction Pool
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sortedPools.map((pool) => (
              <PredictionPoolCard
                key={pool.id}
                pool={pool}
                onJoin={() => fetchPools(true)}
                currentUser={user}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />

      {/* Create Prediction Modal */}
      <CreatePredictionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}

