"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaExchangeAlt, FaChartLine, FaCog } from "react-icons/fa";
import { SiEthereum } from "react-icons/si";
import { ethers } from "ethers";
import { toast } from "react-hot-toast";
import debounce from "lodash/debounce";
import { formatUSDValue, formatPercentageChange } from "../../lib/price-utils";

// ────────────────────────────────────────────────────────────────────────────────
// 1. TYPES & INTERFACES
// ────────────────────────────────────────────────────────────────────────────────

interface SwapQuote {
  route: any;
  dexId: string;
  fee: number;
  version: "v3" | "v2";
  amountIn: string;
  amountOut: string;
  amountInUSD: number;
  amountOutUSD: number;
  effectiveRate: number;
  priceImpact: number;
  tokenInPrice: number;
  tokenOutPrice: number;
  gasEstimate: string;
  estimatedGasCost: string;
  routeQuality: "excellent" | "good" | "fair" | "poor";
  confidence: "high" | "medium" | "low";
  slippageTolerance: number;
  amountOutMin: string;
  pools: Array<{
    address: string;
    dexId: string;
    fee: number;
    liquidity: string;
    version: "v3" | "v2";
  }>;
  timestamp: number;
  expiresAt: number;
}

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  price?: number;
}

interface AdvancedSwapInterfaceProps {
  tokenIn?: TokenInfo;
  tokenOut?: TokenInfo;
  onSwapComplete?: (txHash: string) => void;
  walletAddress?: string;
  privateKey?: string;
}

// ────────────────────────────────────────────────────────────────────────────────
// 2. MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────────────

const AdvancedSwapInterface: React.FC<AdvancedSwapInterfaceProps> = ({
  tokenIn,
  tokenOut,
  onSwapComplete,
  walletAddress,
  privateKey
}) => {
  // ────────────────────────────────────────────────────────────────────────────────
  // STATE MANAGEMENT
  // ────────────────────────────────────────────────────────────────────────────────
  
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("");
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isQuoteLoading, setIsQuoteLoading] = useState<boolean>(false);
  const [currentQuote, setCurrentQuote] = useState<SwapQuote | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [showRouteDetails, setShowRouteDetails] = useState<boolean>(false);
  const [swapDirection, setSwapDirection] = useState<"buy" | "sell">("buy");
  const [gasPrice, setGasPrice] = useState<string>("20");
  const [deadline, setDeadline] = useState<number>(20); // minutes
  
  // Token balances
  const [tokenInBalance, setTokenInBalance] = useState<string>("0");
  const [tokenOutBalance, setTokenOutBalance] = useState<string>("0");
  
  // Swap status
  const [swapStatus, setSwapStatus] = useState<'idle' | 'approving' | 'preparing' | 'executing' | 'completed' | 'failed'>('idle');
  const [swapError, setSwapError] = useState<string>("");
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const [showSwapConfirmation, setShowSwapConfirmation] = useState(false);
  const [pendingSwapData, setPendingSwapData] = useState<any>(null);

  // ────────────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ────────────────────────────────────────────────────────────────────────────────

  // Fetch balances when wallet or tokens change
  useEffect(() => {
    if (walletAddress && tokenIn && tokenOut) {
      fetchBalances();
    }
  }, [walletAddress, tokenIn, tokenOut]);

  // Auto-fetch quote when amount changes
  const debouncedFetchQuote = useCallback(
    debounce(async (amount: string) => {
      if (amount && parseFloat(amount) > 0 && tokenIn && tokenOut) {
        await fetchQuote(amount);
      } else {
        setCurrentQuote(null);
        setAmountOut("");
      }
    }, 500),
    [tokenIn, tokenOut, slippageTolerance]
  );

  // Effect to fetch quote when amount changes (moved after checkBalanceBeforeSwap)
  // See useEffect after checkBalanceBeforeSwap definition

  // ────────────────────────────────────────────────────────────────────────────────
  // API FUNCTIONS
  // ────────────────────────────────────────────────────────────────────────────────

  const fetchBalances = async () => {
    if (!walletAddress) return;

    try {
      // Fetch ETH balance
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
                   const ethBalanceWei = await provider.getBalance(walletAddress);
             const ethBalanceFormatted = ethers.formatEther(ethBalanceWei);

      // Fetch token balances with better error handling
      if (tokenIn && tokenIn.address !== "0x4200000000000000000000000000000000000006") {
        try {
          const tokenContract = new ethers.Contract(tokenIn.address, [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
          ], provider);
          
          const [balance, decimals] = await Promise.all([
            tokenContract.balanceOf(walletAddress),
            tokenContract.decimals()
          ]);
          
          const tokenBalanceFormatted = ethers.formatUnits(balance, decimals);
          console.log(`✅ Token ${tokenIn.symbol} balance: ${tokenBalanceFormatted}`);
          setTokenInBalance(tokenBalanceFormatted);
        } catch (tokenError) {
          console.error(`Error fetching ${tokenIn.symbol} balance:`, tokenError);
          setTokenInBalance("0");
        }
      } else {
        setTokenInBalance(ethBalanceFormatted);
      }

      if (tokenOut && tokenOut.address !== "0x4200000000000000000000000000000000000006") {
        try {
          const tokenContract = new ethers.Contract(tokenOut.address, [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
          ], provider);
          
          const [balance, decimals] = await Promise.all([
            tokenContract.balanceOf(walletAddress),
            tokenContract.decimals()
          ]);
          
          const tokenBalanceFormatted = ethers.formatUnits(balance, decimals);
          console.log(`✅ Token ${tokenOut.symbol} balance: ${tokenBalanceFormatted}`);
          setTokenOutBalance(tokenBalanceFormatted);
        } catch (tokenError) {
          console.error(`Error fetching ${tokenOut.symbol} balance:`, tokenError);
          setTokenOutBalance("0");
        }
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  const fetchQuote = async (amount: string) => {
    if (!tokenIn || !tokenOut) return;

    setIsQuoteLoading(true);
    try {
      const response = await fetch('/api/swap/v3/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn: amount,
          slippageTolerance
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentQuote(data.data);
        setAmountOut(data.data.amountOut);
      } else {
        console.error("Quote error:", data.message);
        setCurrentQuote(null);
        setAmountOut("");
      }
    } catch (error) {
      console.error("Error fetching quote:", error);
      setCurrentQuote(null);
      setAmountOut("");
    } finally {
      setIsQuoteLoading(false);
    }
  };

  // Check balance before swap
  const checkBalanceBeforeSwap = useCallback(async () => {
    if (!amountIn || parseFloat(amountIn) <= 0 || !tokenIn || !walletAddress) {
      setInsufficientFunds(false);
      return;
    }

    try {
      const balance = parseFloat(tokenInBalance || "0");
      const amount = parseFloat(amountIn);
      setInsufficientFunds(balance < amount);
      if (balance < amount) {
        setSwapError(`Insufficient ${tokenIn.symbol} balance. You have ${tokenInBalance}`);
      }
    } catch (error) {
      console.error('Error checking balance:', error);
      setInsufficientFunds(false);
    }
  }, [amountIn, tokenIn, tokenInBalance, walletAddress]);

  // Effect to fetch quote and check balance when amount changes
  useEffect(() => {
    debouncedFetchQuote(amountIn);
    // Check balance when amount changes
    if (amountIn && parseFloat(amountIn) > 0 && tokenIn) {
      checkBalanceBeforeSwap();
    } else {
      setInsufficientFunds(false);
      setSwapError("");
    }
  }, [amountIn, slippageTolerance, debouncedFetchQuote, tokenIn, checkBalanceBeforeSwap]);

  // Show swap confirmation dialog
  const handleSwapButtonClick = async () => {
    if (!currentQuote || !walletAddress || !privateKey || !tokenIn || !tokenOut) {
      toast.error("Missing required parameters for swap");
      return;
    }

    // Check balance before showing confirmation
    await checkBalanceBeforeSwap();
    
    if (insufficientFunds) {
      toast.error(`Insufficient ${tokenIn.symbol} balance. You have ${tokenInBalance}`);
      return;
    }

    // Store swap data for confirmation
    setPendingSwapData({
      amountIn,
      amountOut,
      tokenIn: tokenIn.symbol,
      tokenOut: tokenOut.symbol
    });
    setShowSwapConfirmation(true);
    setSwapError("");
  };

  // 🔧 FIXED: Enhanced swap execution with token approval handling (after confirmation)
  const executeSwap = async () => {
    if (!currentQuote || !walletAddress || !privateKey || !tokenIn || !tokenOut) {
      toast.error("Missing required parameters for swap");
      return;
    }

    // Final balance check
    await checkBalanceBeforeSwap();
    if (insufficientFunds) {
      toast.error(`Insufficient ${tokenIn.symbol} balance. You have ${tokenInBalance}`);
      setShowSwapConfirmation(false);
      return;
    }

    setIsLoading(true);
    setSwapStatus('preparing');
    setSwapError("");
    setShowSwapConfirmation(false);

    try {
      // 🔧 FIXED: Check and handle token approval first
      if (tokenIn.address !== '0x4200000000000000000000000000000000000006') { // Not WETH
        setSwapStatus('approving');
        toast("Checking token approval...");
        
        try {
          const approvalResponse = await fetch('/api/swap/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokenAddress: tokenIn.address,
              amount: amountIn,
              walletAddress,
              privateKey,
              preferredDex: currentQuote.dexId,
              approvalType: 'buffer' // Use buffer to avoid repeated approvals
            })
          });

          const approvalData = await approvalResponse.json();
          
          if (!approvalData.success) {
            if (approvalData.error === 'APPROVAL_FAILED') {
              throw new Error(`Token approval failed: ${approvalData.message}`);
            } else {
              throw new Error(approvalData.message || "Approval check failed");
            }
          }

          if (approvalData.data.approvalNeeded === false) {
            toast.success("Token already approved");
          } else {
            toast.success(`Token approved! TX: ${approvalData.data.transactionHash}`);
          }
        } catch (approvalError) {
          console.error("Approval error:", approvalError);
          setSwapStatus('failed');
          setSwapError(approvalError instanceof Error ? approvalError.message : "Token approval failed");
          toast.error("Token approval failed. Please try again.");
          return;
        }
      }

      setSwapStatus('preparing');
      toast("Preparing swap transaction...");

      // Prepare transaction
      const prepareResponse = await fetch('/api/swap/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputToken: tokenIn.symbol,
          outputToken: tokenOut.symbol,
          amountIn: amountIn,
          slippage: slippageTolerance,
          walletAddress,
          tokenAddress: tokenIn.address !== '0x4200000000000000000000000000000000000006' ? tokenIn.address : undefined,
          preferredDex: currentQuote.dexId
        })
      });

      const prepareData = await prepareResponse.json();
      
      if (!prepareData.success) {
        throw new Error(prepareData.message || "Failed to prepare transaction");
      }

      setSwapStatus('executing');
      toast("Executing swap...");

      // Execute transaction
      const executeResponse = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputToken: tokenIn.symbol,
          outputToken: tokenOut.symbol,
          inputAmount: amountIn,
          outputAmount: amountOut,
          slippage: slippageTolerance,
          walletAddress,
          privateKey,
          tokenAddress: tokenIn.address !== '0x4200000000000000000000000000000000000006' ? tokenIn.address : undefined,
          preferredDex: currentQuote.dexId
        })
      });

      const executeData = await executeResponse.json();
      
      if (executeData.success) {
        setSwapStatus('completed');
        toast.success(`Swap completed! TX: ${executeData.transactionHash}`);
        onSwapComplete?.(executeData.transactionHash);
        
        // Refresh balances
        await fetchBalances();
      } else {
        throw new Error(executeData.error || "Swap execution failed");
      }

    } catch (error) {
      console.error("Swap error:", error);
      setSwapStatus('failed');
      setSwapError(error instanceof Error ? error.message : "Swap failed");
      toast.error("Swap failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ────────────────────────────────────────────────────────────────────────────────

  const getRouteQualityColor = (quality: string) => {
    switch (quality) {
      case "excellent": return "text-green-400";
      case "good": return "text-blue-400";
      case "fair": return "text-yellow-400";
      case "poor": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high": return "text-green-400";
      case "medium": return "text-yellow-400";
      case "low": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  const formatFee = (fee: number) => {
    return `${(fee / 10000).toFixed(2)}%`;
  };

  const isQuoteExpired = useMemo(() => {
    if (!currentQuote) return true;
    return Date.now() > currentQuote.expiresAt;
  }, [currentQuote]);

  const canExecuteSwap = useMemo(() => {
    return currentQuote && 
           !isQuoteExpired && 
           !isLoading && 
           parseFloat(amountIn) > 0 && 
           walletAddress && 
           privateKey;
  }, [currentQuote, isQuoteExpired, isLoading, amountIn, walletAddress, privateKey]);

  // ────────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <FaExchangeAlt className="text-blue-400 text-xl" />
          <h2 className="text-xl font-bold text-gray-100">Advanced Swap</h2>
        </div>
        <button
          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          className="text-gray-400 hover:text-gray-200 transition-colors"
        >
          <FaCog className="w-5 h-5" />
        </button>
      </div>

      {/* Swap Direction Toggle */}
      <div className="flex bg-gray-800 rounded-lg p-1 mb-6">
        <button
          onClick={() => setSwapDirection("buy")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            swapDirection === "buy"
              ? "bg-blue-500 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSwapDirection("sell")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            swapDirection === "sell"
              ? "bg-red-500 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Token Input */}
      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">You Pay</label>
            <div className="text-xs text-gray-500">
              Balance: {formatUSDValue(parseFloat(tokenInBalance) * (tokenIn?.price || 0))}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                setAmountIn(value);
                setSwapError("");
                setInsufficientFunds(false);
              }}
              placeholder="0.0"
              className={`flex-1 bg-gray-700 border ${insufficientFunds ? 'border-red-500' : 'border-gray-600'} rounded-lg px-3 py-2 ${insufficientFunds ? 'text-red-400' : 'text-gray-200'} placeholder-gray-500 focus:outline-none focus:border-blue-500`}
              disabled={isLoading}
            />
            <div className="flex items-center space-x-2 bg-gray-700 rounded-lg px-3 py-2">
              {tokenIn?.logo ? (
                <img src={tokenIn.logo} alt={tokenIn.symbol} className="w-6 h-6 rounded-full" />
              ) : (
                <SiEthereum className="w-6 h-6 text-blue-400" />
              )}
              <span className="text-gray-200 font-medium">{tokenIn?.symbol}</span>
            </div>
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center">
          <div className="bg-gray-800 rounded-full p-2">
            <FaExchangeAlt className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Token Output */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">You Receive</label>
            <div className="text-xs text-gray-500">
              Balance: {formatUSDValue(parseFloat(tokenOutBalance) * (tokenOut?.price || 0))}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              value={amountOut}
              placeholder="0.0"
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none"
              disabled
            />
            <div className="flex items-center space-x-2 bg-gray-700 rounded-lg px-3 py-2">
              {tokenOut?.logo ? (
                <img src={tokenOut.logo} alt={tokenOut.symbol} className="w-6 h-6 rounded-full" />
              ) : (
                <SiEthereum className="w-6 h-6 text-blue-400" />
              )}
              <span className="text-gray-200 font-medium">{tokenOut?.symbol}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Information */}
      {currentQuote && !isQuoteExpired && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-100">Swap Details</h3>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getRouteQualityColor(currentQuote.routeQuality)}`}>
                {currentQuote.routeQuality}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(currentQuote.confidence)}`}>
                {currentQuote.confidence}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Rate:</span>
              <div className="text-gray-200 font-medium">
                1 {tokenIn?.symbol} = {currentQuote.effectiveRate.toFixed(6)} {tokenOut?.symbol}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Price Impact:</span>
              <div className={`font-medium ${currentQuote.priceImpact < 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                {formatPercentageChange(currentQuote.priceImpact)}
              </div>
            </div>
            <div>
              <span className="text-gray-400">DEX:</span>
              <div className="text-gray-200 font-medium capitalize">
                {currentQuote.dexId.replace('_', ' ')} ({currentQuote.version})
              </div>
            </div>
            <div>
              <span className="text-gray-400">Fee:</span>
              <div className="text-gray-200 font-medium">
                {formatFee(currentQuote.fee)}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Gas Estimate:</span>
              <div className="text-gray-200 font-medium">
                {parseInt(currentQuote.gasEstimate).toLocaleString()} gas
              </div>
            </div>
            <div>
              <span className="text-gray-400">Gas Cost:</span>
              <div className="text-gray-200 font-medium">
                ~{currentQuote.estimatedGasCost} ETH
              </div>
            </div>
          </div>

          {/* Route Details */}
          <button
            onClick={() => setShowRouteDetails(!showRouteDetails)}
            className="mt-4 text-blue-400 hover:text-blue-300 text-sm flex items-center space-x-1"
          >
            <FaChartLine className="w-4 h-4" />
            <span>{showRouteDetails ? 'Hide' : 'Show'} Route Details</span>
          </button>

          <AnimatePresence>
            {showRouteDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-gray-700"
              >
                <h4 className="text-sm font-medium text-gray-300 mb-2">Pools Used:</h4>
                {currentQuote.pools.map((pool, index) => (
                  <div key={pool.address} className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Pool {index + 1}: {pool.address.slice(0, 8)}...{pool.address.slice(-6)}</span>
                    <span>{formatFee(pool.fee)} • {pool.version.toUpperCase()}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Advanced Settings */}
      <AnimatePresence>
        {showAdvancedSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Advanced Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Slippage Tolerance</label>
                <div className="flex space-x-2">
                  {[0.1, 0.5, 1.0, 5.0].map((value) => (
                    <button
                      key={value}
                      onClick={() => setSlippageTolerance(value)}
                      className={`px-3 py-1 rounded text-sm ${
                        slippageTolerance === value
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Gas Price (Gwei)</label>
                <input
                  type="number"
                  value={gasPrice}
                  onChange={(e) => setGasPrice(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Transaction Deadline (minutes)</label>
                <input
                  type="number"
                  value={deadline}
                  onChange={(e) => setDeadline(parseInt(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap Button */}
      <div className="mt-6">
        <button
          onClick={handleSwapButtonClick}
          disabled={!canExecuteSwap || insufficientFunds}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            canExecuteSwap
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>
                {swapStatus === 'approving' ? 'Approving Token...' :
                 swapStatus === 'preparing' ? 'Preparing...' :
                 swapStatus === 'executing' ? 'Executing...' :
                 'Processing...'}
              </span>
            </div>
          ) : isQuoteExpired ? (
            'Quote Expired - Refresh'
          ) : !currentQuote ? (
            'Enter Amount'
          ) : insufficientFunds ? (
            'Insufficient funds'
          ) : (
            `${swapDirection === 'buy' ? 'Buy' : 'Sell'} ${tokenOut?.symbol}`
          )}
        </button>
      </div>

      {/* Error Display */}
      {swapError && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm">{swapError}</p>
        </div>
      )}

      {/* Insufficient Funds Warning */}
      {insufficientFunds && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Insufficient {tokenIn?.symbol} balance. You have {tokenInBalance} {tokenIn?.symbol}
          </p>
        </div>
      )}

      {/* Swap Confirmation Dialog */}
      <AnimatePresence>
        {showSwapConfirmation && pendingSwapData && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowSwapConfirmation(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 rounded-2xl p-6 z-50 max-w-md mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Confirm Swap</h3>
                <button
                  onClick={() => setShowSwapConfirmation(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">You Pay</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-white">{pendingSwapData.amountIn}</span>
                    <span className="text-sm text-gray-300">{pendingSwapData.tokenIn}</span>
                  </div>
                </div>
                <div className="flex justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">You Receive</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-white">{pendingSwapData.amountOut}</span>
                    <span className="text-sm text-gray-300">{pendingSwapData.tokenOut}</span>
                  </div>
                </div>
                {insufficientFunds && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Insufficient funds. You have {tokenInBalance} {pendingSwapData.tokenIn}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSwapConfirmation(false)}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => !insufficientFunds && executeSwap()}
                  disabled={insufficientFunds}
                  className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold"
                >
                  Confirm Swap
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Loading States */}
      {isQuoteLoading && (
        <div className="mt-4 flex items-center justify-center space-x-2 text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
          <span>Finding best route...</span>
        </div>
      )}
    </div>
  );
};

export default AdvancedSwapInterface;
