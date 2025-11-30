"use client";

import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import { useLoading } from "../components/LoadingProvider";
import { useAuth } from "@/app/providers";
import CreatePredictionModal from "../components/CreatePredictionModal";
import PredictionPoolCard from "../components/PredictionPoolCard";
import PredictRulesModal from "../components/PredictRulesModal";

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
  liquidity?: number;
  maxBetSize?: number;
}

export default function PredictPage() {
  const { user } = useAuth();
  const { isLoading: pageLoading } = useLoading();
  const [pools, setPools] = useState<PredictionPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ACTIVE');
  const [refreshing, setRefreshing] = useState(false);

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

  const filteredPools = pools.filter(pool => {
    if (filter === 'ALL') return true;
    return pool.status === filter;
  });

  const sortedPools = [...filteredPools].sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
    return b.startTime - a.startTime;
  });

  if (pageLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl pb-0">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-white mb-1">Predict</h1>
                <p className="text-sm text-gray-400">
                  Predict token movements. Winners split the pot. Losers pay gas fees.
                </p>
              </div>
              <button
                onClick={() => setShowRulesModal(true)}
                className="w-8 h-8 flex items-center justify-center rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition-colors text-sm"
                title="View Rules"
              >
                ⓘ
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-3 py-1.5 text-sm bg-gray-900 hover:bg-gray-800 text-white rounded border border-gray-800 transition-colors disabled:opacity-50"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Create
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 border-b border-gray-800">
            {(['ALL', 'ACTIVE', 'RESOLVED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  filter === status
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {status}
                {status !== 'ALL' && (
                  <span className="ml-1.5 text-xs bg-gray-800 px-1.5 py-0.5 rounded">
                    {pools.filter(p => p.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">Active</div>
            <div className="text-lg font-semibold text-white">
              {pools.filter(p => p.status === 'ACTIVE').length}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">Total Staked</div>
            <div className="text-lg font-semibold text-white">
              ${pools.reduce((sum, p) => sum + p.totalStaked, 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">Participants</div>
            <div className="text-lg font-semibold text-white">
              {pools.reduce((sum, p) => sum + p.participants.length, 0)}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">Resolved Today</div>
            <div className="text-lg font-semibold text-white">
              {pools.filter(p => p.status === 'RESOLVED' && p.resolvedAt && (Date.now() - p.resolvedAt < 86400000)).length}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : sortedPools.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-sm font-medium text-gray-400 mb-1">No prediction pools found</h3>
            <p className="text-xs text-gray-500 mb-4">Be the first to create a prediction pool</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Create Pool
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-0">
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

      <CreatePredictionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      <PredictRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />
    </div>
  );
}
