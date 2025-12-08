"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiExternalLink, FiX } from "react-icons/fi";
import Link from "next/link";

interface OrderSuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
  orderDetails: {
    type: 'buy' | 'sell';
    tokenSymbol: string;
    amount: string;
    price: string;
    total: string;
    txHash?: string;
  } | null;
  autoCloseDelay?: number;
}

const OrderSuccessPopup: React.FC<OrderSuccessPopupProps> = ({
  isOpen,
  onClose,
  orderDetails,
  autoCloseDelay = 2500
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isOpen) {
      setProgress(100);
      return;
    }

    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / autoCloseDelay) * 100);
      setProgress(remaining);
      
      if (remaining > 0) {
        requestAnimationFrame(animate);
      } else {
        onClose();
      }
    };

    const animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isOpen, autoCloseDelay, onClose]);

  if (!orderDetails) return null;

  const isBuy = orderDetails.type === 'buy';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800">
              <motion.div
                className={`h-full ${isBuy ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="pt-8 pb-6 px-6">
              {/* Success icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.1 }}
                className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isBuy ? 'bg-green-500/20 border-2 border-green-500/30' : 'bg-red-500/20 border-2 border-red-500/30'
                }`}
              >
                <FiCheck className={`w-8 h-8 ${isBuy ? 'text-green-400' : 'text-red-400'}`} />
              </motion.div>

              {/* Title */}
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-xl font-semibold text-white text-center mb-1"
              >
                Order Successful
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`text-sm text-center mb-6 ${isBuy ? 'text-green-400' : 'text-red-400'}`}
              >
                {isBuy ? 'Buy' : 'Sell'} order executed
              </motion.p>

              {/* Order details */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-gray-800/50 rounded-xl p-4 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Token</span>
                  <span className="text-white font-medium">{orderDetails.tokenSymbol}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Amount</span>
                  <span className="text-white font-medium">{orderDetails.amount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Price</span>
                  <span className="text-white font-medium">${orderDetails.price}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
                  <span className="text-gray-400 text-sm">Total</span>
                  <span className={`font-semibold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                    {orderDetails.total}
                  </span>
                </div>
              </motion.div>

              {/* View transaction button */}
              {orderDetails.txHash && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4"
                >
                  <Link
                    href={`/explorer/tx/${orderDetails.txHash}`}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
                    onClick={onClose}
                  >
                    View Transaction
                    <FiExternalLink className="w-4 h-4" />
                  </Link>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrderSuccessPopup;
