"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/providers";
import toast from "react-hot-toast";
import { getTokenLiquidity, getMaxBetSize, MIN_LIQUIDITY } from "@/lib/liquidity-utils";

interface CreatePredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePredictionModal({
  isOpen,
  onClose,
  onSuccess
}: CreatePredictionModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [predictionType, setPredictionType] = useState<'PUMP' | 'DUMP'>('PUMP');
  const [threshold, setThreshold] = useState("15");
  const [timeframe, setTimeframe] = useState("60");
  const [description, setDescription] = useState("");
  const [liquidity, setLiquidity] = useState<number | null>(null);
  const [maxBet, setMaxBet] = useState<number | null>(null);
  const [checkingLiquidity, setCheckingLiquidity] = useState(false);

  useEffect(() => {
    if (tokenAddress && tokenAddress.length === 42 && tokenAddress.startsWith('0x')) {
      fetchTokenInfo(tokenAddress);
    } else {
      setLiquidity(null);
      setMaxBet(null);
      setTokenSymbol("");
      setTokenName("");
    }
  }, [tokenAddress]);

  const fetchTokenInfo = async (address: string) => {
    setCheckingLiquidity(true);
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs.find((p: any) => p.chainId === 'base') || data.pairs[0];
        setTokenSymbol(pair.baseToken?.symbol || "");
        setTokenName(pair.baseToken?.name || "");
        
        // Check liquidity
        const liquidityInfo = await getTokenLiquidity(address);
        if (liquidityInfo) {
          setLiquidity(liquidityInfo.liquidity);
          setMaxBet(getMaxBetSize(liquidityInfo.liquidity));
        } else {
          setLiquidity(0);
          setMaxBet(0);
        }
      } else {
        setLiquidity(0);
        setMaxBet(0);
      }
    } catch (error) {
      console.error("Error fetching token info:", error);
      setLiquidity(null);
      setMaxBet(null);
    } finally {
      setCheckingLiquidity(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Please log in to create a prediction");
      return;
    }

    if (!tokenAddress || !threshold || !timeframe) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/predictions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creatorId: user.uid,
          tokenAddress,
          tokenSymbol,
          tokenName,
          predictionType,
          threshold: parseFloat(threshold),
          timeframe: parseInt(timeframe),
          autoExecuteTrades: true,
          description
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create prediction');
      }

      toast.success("Prediction pool created successfully!");
      onSuccess();
    } catch (error: any) {
      console.error("Error creating prediction:", error);
      toast.error(error.message || "Failed to create prediction pool");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-950 sm:border sm:border-gray-800 shadow-2xl w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">Create Prediction</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Token Address *
                  </label>
                  <input
                    type="text"
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-800 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  {tokenSymbol && (
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-gray-400">
                        {tokenName} ({tokenSymbol})
                      </p>
                      {checkingLiquidity ? (
                        <p className="text-xs text-gray-500">Checking liquidity...</p>
                      ) : liquidity !== null && (
                        <div className="text-xs">
                          {liquidity < MIN_LIQUIDITY ? (
                            <p className="text-red-400">
                              Liquidity: ${(liquidity / 1_000_000).toFixed(2)}M (Minimum $1M required)
                            </p>
                          ) : (
                            <p className="text-green-400">
                              Liquidity: ${(liquidity / 1_000_000).toFixed(2)}M • Max bet: ${maxBet}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Prediction Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPredictionType('PUMP')}
                      className={`py-2 text-sm rounded border transition-all ${
                        predictionType === 'PUMP'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      Will Pump
                    </button>
                    <button
                      type="button"
                      onClick={() => setPredictionType('DUMP')}
                      className={`py-2 text-sm rounded border transition-all ${
                        predictionType === 'DUMP'
                          ? 'border-red-500 bg-red-500/10 text-red-400'
                          : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      Will Dump
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Threshold (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      min="1"
                      max="100"
                      step="0.1"
                      className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-800 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      %
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Price must {predictionType === 'PUMP' ? 'increase' : 'decrease'} by {threshold}% or more
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Timeframe (minutes) *
                  </label>
                  <input
                    type="number"
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    min="60"
                    step="5"
                    className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-800 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Duration: {timeframe} minutes (minimum 60 minutes to prevent manipulation)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Description (Optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Will $BRETT pump >15% in next 15 min?"
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-800 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || (liquidity !== null && liquidity < MIN_LIQUIDITY)}
                    className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
