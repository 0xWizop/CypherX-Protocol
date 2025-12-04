"use client";

import { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiInfo, FiAlertCircle } from "react-icons/fi";

interface OrderManagementProps {
  walletAddress: string;
  tokenOutAddress: string;
  tokenOut: string;
  currentPrice?: number;
  showHeader?: boolean;
  onOrderCreate?: () => void;
}

export interface OrderManagementHandle {
  openModal: (type: "LIMIT_BUY" | "LIMIT_SELL" | "STOP_LOSS", amount?: string) => void;
}

const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base WETH

const OrderManagement = forwardRef<OrderManagementHandle, OrderManagementProps>(
  ({ walletAddress, tokenOutAddress, tokenOut, currentPrice, showHeader = true, onOrderCreate }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [orderType, setOrderType] = useState<"LIMIT_BUY" | "LIMIT_SELL" | "STOP_LOSS">("LIMIT_BUY");
    const [amount, setAmount] = useState("");
    const [targetPrice, setTargetPrice] = useState("");
    const [stopPrice, setStopPrice] = useState("");
    const [slippage, setSlippage] = useState("0.5");
    const [goodTillCancel, setGoodTillCancel] = useState(true);
    const [expirationDays, setExpirationDays] = useState("30");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useImperativeHandle(ref, () => ({
      openModal: (type: "LIMIT_BUY" | "LIMIT_SELL" | "STOP_LOSS", defaultAmount?: string) => {
        setOrderType(type);
        setAmount(defaultAmount || "");
        setTargetPrice("");
        setStopPrice("");
        setError(null);
        setSuccess(false);
        setIsOpen(true);
      },
    }));

    // Set default target price based on current price
    useEffect(() => {
      if (isOpen && currentPrice && !targetPrice && !stopPrice) {
        if (orderType === "LIMIT_BUY") {
          // Set target 5% below current price for limit buy
          setTargetPrice((currentPrice * 0.95).toFixed(6));
        } else if (orderType === "LIMIT_SELL") {
          // Set target 5% above current price for limit sell
          setTargetPrice((currentPrice * 1.05).toFixed(6));
        } else if (orderType === "STOP_LOSS") {
          // Set stop 10% below current price for stop loss
          setStopPrice((currentPrice * 0.90).toFixed(6));
        }
      }
    }, [isOpen, currentPrice, orderType, targetPrice, stopPrice]);

    const handleSubmit = async () => {
      setError(null);
      setSuccess(false);

      // Validation
      if (!amount || parseFloat(amount) <= 0) {
        setError("Please enter a valid amount");
        return;
      }

      if ((orderType === "LIMIT_BUY" || orderType === "LIMIT_SELL") && (!targetPrice || parseFloat(targetPrice) <= 0)) {
        setError("Please enter a valid target price");
        return;
      }

      if (orderType === "STOP_LOSS" && (!stopPrice || parseFloat(stopPrice) <= 0)) {
        setError("Please enter a valid stop price");
        return;
      }

      if (!tokenOutAddress) {
        setError("Token address is required");
        return;
      }

      setLoading(true);

      try {
        // Determine token addresses based on order type
        let tokenInAddress: string;
        let tokenOutAddressFinal: string;
        let tokenInSymbol: string;
        let tokenOutSymbolFinal: string;

        if (orderType === "LIMIT_BUY") {
          // Buying token with ETH
          tokenInAddress = WETH_ADDRESS;
          tokenOutAddressFinal = tokenOutAddress;
          tokenInSymbol = "ETH";
          tokenOutSymbolFinal = tokenOut;
        } else {
          // Selling token for ETH (LIMIT_SELL or STOP_LOSS)
          tokenInAddress = tokenOutAddress;
          tokenOutAddressFinal = WETH_ADDRESS;
          tokenInSymbol = tokenOut;
          tokenOutSymbolFinal = "ETH";
        }

        // Calculate expiration time
        const expirationTime = goodTillCancel 
          ? undefined 
          : Math.floor(Date.now() / 1000) + (parseInt(expirationDays) * 24 * 60 * 60);

        // Create order
        const response = await fetch("/api/orders/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletAddress: walletAddress.toLowerCase(),
            orderType,
            tokenIn: tokenInSymbol,
            tokenOut: tokenOutSymbolFinal,
            tokenInAddress,
            tokenOutAddress: tokenOutAddressFinal,
            amountIn: amount,
            targetPrice: orderType !== "STOP_LOSS" ? targetPrice : undefined,
            stopPrice: orderType === "STOP_LOSS" ? stopPrice : undefined,
            slippage: parseFloat(slippage) || 0.5,
            expirationTime,
            goodTillCancel,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create order");
        }

        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
          if (onOrderCreate) {
            onOrderCreate();
          }
        }, 2000);

      } catch (err: any) {
        setError(err.message || "Failed to create order");
      } finally {
        setLoading(false);
      }
    };

    const getOrderTypeLabel = () => {
      switch (orderType) {
        case "LIMIT_BUY":
          return "Limit Buy";
        case "LIMIT_SELL":
          return "Limit Sell";
        case "STOP_LOSS":
          return "Stop Loss";
      }
    };

    const getOrderTypeDescription = () => {
      switch (orderType) {
        case "LIMIT_BUY":
          return "Buy when price drops to or below target price";
        case "LIMIT_SELL":
          return "Sell when price rises to or above target price";
        case "STOP_LOSS":
          return "Sell immediately when price drops to or below stop price";
      }
    };

    if (!isOpen) return null;

    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            >
              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md overflow-hidden"
              >
                {/* Header */}
                {showHeader && (
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                    <h3 className="text-lg font-semibold text-white">{getOrderTypeLabel()}</h3>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <FiX className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                )}

                {/* Content */}
                <div className="p-4 space-y-4">
                  {/* Info Banner */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <FiInfo className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-300">
                        <p className="font-medium mb-1">{getOrderTypeLabel()}</p>
                        <p className="text-blue-400/80">{getOrderTypeDescription()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Current Price */}
                  {currentPrice && (
                    <div className="text-sm text-gray-400">
                      Current Price: <span className="text-white font-medium">${currentPrice.toFixed(6)}</span>
                    </div>
                  )}

                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Amount ({orderType === "LIMIT_BUY" ? "ETH" : tokenOut})
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0"
                      step="any"
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Target Price (for Limit Buy/Sell) */}
                  {(orderType === "LIMIT_BUY" || orderType === "LIMIT_SELL") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Target Price (USD)
                      </label>
                      <input
                        type="number"
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        placeholder="0.0"
                        step="any"
                        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                      {currentPrice && targetPrice && (
                        <p className="text-xs text-gray-500 mt-1">
                          {orderType === "LIMIT_BUY" 
                            ? `Will buy when price ≤ $${parseFloat(targetPrice).toFixed(6)}`
                            : `Will sell when price ≥ $${parseFloat(targetPrice).toFixed(6)}`
                          }
                        </p>
                      )}
                    </div>
                  )}

                  {/* Stop Price (for Stop Loss) */}
                  {orderType === "STOP_LOSS" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Stop Price (USD)
                      </label>
                      <input
                        type="number"
                        value={stopPrice}
                        onChange={(e) => setStopPrice(e.target.value)}
                        placeholder="0.0"
                        step="any"
                        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                      {currentPrice && stopPrice && (
                        <p className="text-xs text-gray-500 mt-1">
                          Will sell immediately when price ≤ ${parseFloat(stopPrice).toFixed(6)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Slippage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Slippage Tolerance (%)
                    </label>
                    <input
                      type="number"
                      value={slippage}
                      onChange={(e) => setSlippage(e.target.value)}
                      placeholder="0.5"
                      step="0.1"
                      min="0"
                      max="50"
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Expiration */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={goodTillCancel}
                        onChange={(e) => setGoodTillCancel(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">Good Till Cancel</span>
                    </label>
                    {!goodTillCancel && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Expires In (days)
                        </label>
                        <input
                          type="number"
                          value={expirationDays}
                          onChange={(e) => setExpirationDays(e.target.value)}
                          placeholder="30"
                          min="1"
                          max="365"
                          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                      <FiAlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Success Message */}
                  {success && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <p className="text-sm text-green-400">Order created successfully!</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-800 flex gap-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                  >
                    {loading ? "Creating..." : "Create Order"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }
);

OrderManagement.displayName = "OrderManagement";

export default OrderManagement;
