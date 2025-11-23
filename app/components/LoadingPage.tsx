"use client";

import React from "react";
import { motion } from "framer-motion";

const LoadingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center -mt-20">
        {/* Cool Animated Dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex justify-center space-x-3">
            <motion.div
              className="w-4 h-4 bg-blue-600 rounded-full"
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                delay: 0
              }}
            />
            <motion.div
              className="w-4 h-4 bg-blue-600 rounded-full"
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                delay: 0.2
              }}
            />
            <motion.div
              className="w-4 h-4 bg-blue-600 rounded-full"
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                delay: 0.4
              }}
            />
          </div>
        </motion.div>



        {/* Cool Loading Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <div className="text-gray-300 text-sm font-medium tracking-wide">
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Loading
            </motion.span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoadingPage;
