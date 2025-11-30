"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PredictRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PredictRulesModal({
  isOpen,
  onClose
}: PredictRulesModalProps) {
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
            <div className="bg-gray-950 sm:border sm:border-gray-800 shadow-2xl w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">Prediction Rules</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 p-4 space-y-4 text-sm">
                <div>
                  <h3 className="text-base font-semibold text-white mb-2">Liquidity Requirements</h3>
                  <ul className="space-y-1 text-gray-300">
                    <li>• Tokens must have at least <span className="text-blue-400 font-medium">$1M liquidity</span> to prevent manipulation</li>
                    <li>• Liquidity is checked via DexScreener when creating predictions</li>
                    <li>• Low liquidity tokens are disabled to prevent price manipulation</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-white mb-2">Betting Limits (Based on Liquidity)</h3>
                  <div className="bg-gray-900 border border-gray-800 rounded p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">$1M - $5M liquidity:</span>
                      <span className="text-white font-medium">Max $50 bet</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">$5M - $10M liquidity:</span>
                      <span className="text-white font-medium">Max $200 bet</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">$10M - $50M liquidity:</span>
                      <span className="text-white font-medium">Max $500 bet</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">$50M+ liquidity:</span>
                      <span className="text-white font-medium">Max $2,000 bet</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Smaller bets allowed on smaller tokens. Larger bets only on larger tokens to prevent manipulation.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-white mb-2">How It Works</h3>
                  <ul className="space-y-1 text-gray-300">
                    <li>• Create or join a prediction pool for any Base token</li>
                    <li>• Predict if the price will pump or dump by a certain percentage</li>
                    <li>• Minimum stake: <span className="text-blue-400 font-medium">$0.50</span></li>
                    <li>• Pool duration: Minimum 60 minutes (prevents manipulation)</li>
                    <li>• Winners split the pot proportionally to their stake</li>
                    <li>• Losers' stakes pay for winners' gas fees</li>
                    <li>• Trades are automatically executed for winners</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-white mb-2">Resolution</h3>
                  <ul className="space-y-1 text-gray-300">
                    <li>• Pools resolve automatically when the timeframe expires</li>
                    <li>• Price is compared at start vs end time</li>
                    <li>• Winners are determined based on the prediction outcome</li>
                    <li>• Payouts are distributed automatically</li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-gray-800">
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-400">Note:</span> All predictions are based on real-time price data from DexScreener. 
                    Results are final once the pool expires.
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-gray-800">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

