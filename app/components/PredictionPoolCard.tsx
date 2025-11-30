"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";

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

interface PredictionPoolCardProps {
  pool: PredictionPool;
  onJoin: () => void;
  currentUser: any;
}

export default function PredictionPoolCard({
  pool,
  onJoin,
  currentUser
}: PredictionPoolCardProps) {
  const [timeRemaining, setTimeRemaining] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("0.50");
  const [prediction, setPrediction] = useState<'YES' | 'NO'>('YES');
  const [joining, setJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    if (currentUser && pool.participants) {
      const userWallet = localStorage.getItem('cypherx_wallet');
      if (userWallet) {
        try {
          const walletData = JSON.parse(userWallet);
          const address = walletData.address?.toLowerCase();
          const joined = pool.participants.some(
            (p) => p.walletAddress?.toLowerCase() === address
          );
          setHasJoined(joined);
        } catch (e) {
          // Ignore
        }
      }
    }
  }, [currentUser, pool.participants]);

  useEffect(() => {
    const updateTime = () => {
      if (pool.status === 'ACTIVE') {
        const now = Date.now();
        const remaining = pool.endTime - now;
        
        if (remaining <= 0) {
          setTimeRemaining("Expired");
          return;
        }
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining("Resolved");
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [pool.endTime, pool.status]);

  const handleJoin = async () => {
    if (!currentUser) {
      toast.error("Please log in to join a prediction");
      return;
    }

    const userWallet = localStorage.getItem('cypherx_wallet');
    if (!userWallet) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const walletData = JSON.parse(userWallet);
      const walletAddress = walletData.address;

      if (!walletAddress) {
        toast.error("Wallet address not found");
        return;
      }

      setJoining(true);

      const response = await fetch('/api/predictions/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId: pool.id,
          userId: currentUser.uid,
          walletAddress,
          stakeAmount: parseFloat(stakeAmount),
          prediction
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join prediction');
      }

      toast.success("Successfully joined prediction pool!");
      setShowJoinModal(false);
      setHasJoined(true);
      onJoin();
    } catch (error: any) {
      console.error("Error joining prediction:", error);
      toast.error(error.message || "Failed to join prediction pool");
    } finally {
      setJoining(false);
    }
  };

  const getPriceChangeDisplay = () => {
    if (pool.status !== 'RESOLVED' || pool.endPrice === undefined) {
      return null;
    }

    const change = ((pool.endPrice - pool.startPrice) / pool.startPrice) * 100;
    const isPositive = change >= 0;
    
    return (
      <span className={`font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </span>
    );
  };

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded p-4 hover:border-gray-700 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-white">
                {pool.tokenName || pool.tokenSymbol || 'Unknown Token'}
              </h3>
              {pool.tokenSymbol && (
                <span className="text-xs text-gray-400">({pool.tokenSymbol})</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded ${
                pool.predictionType === 'PUMP' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {pool.predictionType === 'PUMP' ? 'Pump' : 'Dump'}
              </span>
              <span className="text-gray-400">
                {pool.threshold}% in {pool.timeframe}min
              </span>
            </div>
          </div>
          <div className={`px-2 py-0.5 rounded text-xs font-medium ${
            pool.status === 'ACTIVE' 
              ? 'bg-green-500/20 text-green-400'
              : pool.status === 'RESOLVED'
              ? 'bg-gray-500/20 text-gray-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {pool.status}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Pot</div>
            <div className="text-sm font-semibold text-white">
              ${pool.totalStaked.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Participants</div>
            <div className="text-sm font-semibold text-white">
              {pool.participants.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Time</div>
            <div className="text-sm font-semibold text-white">
              {timeRemaining}
            </div>
          </div>
        </div>

        {pool.status === 'RESOLVED' && (
          <div className="mb-3 p-2 bg-gray-800/50 rounded text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-400">Start:</span>
              <span className="text-white">${pool.startPrice.toFixed(6)}</span>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-400">End:</span>
              <span className="text-white">${pool.endPrice?.toFixed(6)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-700">
              <span className="text-gray-400">Change:</span>
              {getPriceChangeDisplay()}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-700 mt-1">
              <span className="text-gray-400">Outcome:</span>
              <span className={`font-medium ${pool.outcome === 'YES' ? 'text-green-400' : 'text-red-400'}`}>
                {pool.outcome === 'YES' ? 'YES' : 'NO'} Won
              </span>
            </div>
          </div>
        )}

        {pool.status === 'ACTIVE' && (
          <button
            onClick={() => setShowJoinModal(true)}
            disabled={hasJoined}
            className={`w-full py-2 text-xs font-medium rounded transition-colors ${
              hasJoined
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {hasJoined ? 'Joined' : 'Join'}
          </button>
        )}

        {pool.status === 'RESOLVED' && (
          <div className="text-center text-xs text-gray-400 pt-2 border-t border-gray-800">
            {pool.winnerCount} winners • {pool.loserCount} losers
            {pool.totalPot > 0 && (
              <div className="mt-1 text-blue-400">
                Pot: ${pool.totalPot.toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div>

      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 rounded p-5 max-w-sm w-full">
            <h3 className="text-sm font-semibold text-white mb-4">Join Prediction</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Stake Amount (USD)
                </label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  min="0.50"
                  max={pool.maxBetSize || undefined}
                  step="0.10"
                  className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-800 rounded text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Min: $0.50{pool.maxBetSize ? ` • Max: $${pool.maxBetSize}` : ''}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Your Prediction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrediction('YES')}
                    className={`py-2 text-sm rounded border transition-all ${
                      prediction === 'YES'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-gray-800 bg-gray-900 text-gray-400'
                    }`}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrediction('NO')}
                    className={`py-2 text-sm rounded border transition-all ${
                      prediction === 'NO'
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : 'border-gray-800 bg-gray-900 text-gray-400'
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                >
                  {joining ? "Joining..." : "Join"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
