"use client";

import React from "react";
import { motion } from "framer-motion";

const PageLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        {/* Loading Spinner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-4"
        >
          <div className="relative">
            <div className="w-12 h-12 border-4 border-gray-700 rounded-full"></div>
            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        </motion.div>

        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <div className="text-gray-300 text-sm font-medium">Loading...</div>
        </motion.div>

        {/* Animated Dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="flex justify-center space-x-1 mt-3"
        >
          <motion.div
            className="w-1.5 h-1.5 bg-blue-600 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="w-1.5 h-1.5 bg-blue-600 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div
            className="w-1.5 h-1.5 bg-blue-600 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default PageLoader;
