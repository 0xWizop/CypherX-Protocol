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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-gray-950 border border-gray-800/50 rounded-[16px] shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Subtle top accent strip */}
            <div className={`absolute top-0 left-0 right-0 h-[4px] ${isBuy ? 'bg-green-500' : 'bg-red-500'}`} />
            
            {/* Subtle left border accent */}
            <div className={`absolute top-0 bottom-0 left-0 w-[3px] ${isBuy ? 'bg-green-500/30' : 'bg-red-500/30'}`} />
            
            {/* Progress bar - subtle at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800/50">
              <motion.div
                className={`h-full ${isBuy ? 'bg-green-500/60' : 'bg-red-500/60'}`}
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors z-10"
            >
              <FiX className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="pt-8 pb-6 px-6">
              {/* Success icon - minimal */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.1 }}
                className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center bg-gray-800/50 border border-gray-700/50"
              >
                <FiCheck className={`w-7 h-7 ${isBuy ? 'text-green-400' : 'text-red-400'}`} />
              </motion.div>

              {/* Title */}
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-xl font-semibold text-white text-center mb-2"
              >
                Order Successful
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-gray-400 text-center mb-6"
              >
                {isBuy ? 'Buy' : 'Sell'} order executed successfully
              </motion.p>

              {/* Order details */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-gray-900/40 rounded-xl p-4 space-y-3 border border-gray-800/30"
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Token</span>
                  <span className="text-white font-medium text-sm">{orderDetails.tokenSymbol}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Amount</span>
                  <span className="text-white font-medium text-sm">{orderDetails.amount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Price</span>
                  <span className="text-white font-medium text-sm">${orderDetails.price}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-800/50">
                  <span className="text-gray-400 text-sm font-medium">Total</span>
                  <span className={`text-base font-semibold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
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
                  className="mt-5"
                >
                  <Link
                    href={`/explorer/tx/${orderDetails.txHash}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 text-white font-medium text-sm rounded-lg transition-all duration-200"
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
