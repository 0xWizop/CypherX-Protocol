"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCopy,
  FiCheck,
  FiMinus,
  FiPlus,
} from "react-icons/fi";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";
import LoadingSpinner from "../../../components/LoadingSpinner";

interface Transaction {
  hash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  gasLimit: string;
  gasFeeEth: number;
  gasFeeUsd: number;
  nonce: number;
  inputData: string;
  transactionIndex: number;
  status: "success" | "failed" | "pending";
  timestamp: number;
  ethValueUsd: number;
  contractAddress?: string;
  contractName?: string;
  methodSignature?: string;
  isContractCreation: boolean;
  tokenTransfers: Array<{
    from: string;
    to: string;
    value: string;
    asset: string;
    category: string;
  }>;
  receipt: {
    status: string;
    gasUsed: string;
    logs: Array<{
      address: string;
      topics: string[];
      data: string;
      logIndex: string;
      transactionIndex: string;
      transactionHash: string;
      blockHash: string;
      blockNumber: string;
    }>;
    contractAddress?: string;
  };
}


export default function TransactionDetails() {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showCopyNotification, setShowCopyNotification] = useState<boolean>(false);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const router = useRouter();
  const params = useParams();
  const txHash = params.txHash as string;

  const fetchTransaction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use our dedicated transaction API endpoint
      const response = await fetch(`/api/alchemy/transaction?hash=${txHash}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (!data.success || !data.transaction) {
        throw new Error(data.error || "Transaction not found");
      }

      setTransaction(data.transaction);
      console.log(`Transaction ${txHash} loaded from API`);
    } catch (err: unknown) {
      console.error("Fetch transaction error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to fetch transaction: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [txHash]);

  useEffect(() => {
    if (!txHash) {
      router.push("/explorer");
      return;
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      setError("Invalid transaction hash format");
      return;
    }

    fetchTransaction();
  }, [txHash, router, fetchTransaction]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedField(field);
      setShowCopyNotification(true);
      setTimeout(() => {
        setCopiedField(null);
        setShowCopyNotification(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-900/30 text-green-400";
      case "failed":
        return "bg-red-900/30 text-red-400";
      case "pending":
        return "bg-blue-800/30 text-blue-200";
      default:
        return "bg-gray-800/50 text-gray-300";
    }
  };

  const formatValue = (value: string) => {
    const numValue = parseFloat(value);
    if (numValue === 0) return "0 ETH";
    if (numValue < 0.001) return `${numValue.toFixed(6)} ETH`;
    if (numValue < 1) return `${numValue.toFixed(4)} ETH`;
    return `${numValue.toFixed(4)} ETH`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatHash = (hash: string) => {
    if (!hash) return 'N/A';
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };


  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />

      <main className="flex-1 overflow-hidden bg-gray-950">
        <div className="h-full w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6 sm:pt-5 sm:pb-6 flex flex-col gap-4 sm:gap-5">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 flex-none">
            <Link href="/explorer" className="hover:text-blue-400 transition-colors">
              Explorer
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-300">Transaction Details</span>
          </div>
          
          {/* Header */}
          <div className="flex flex-col gap-1 flex-none">
            <h1 className="text-base font-normal text-white sm:text-lg">Transaction Details</h1>
            <p className="text-gray-400 text-xs sm:text-sm">Transaction information from Base network</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 p-4 mb-6 rounded-lg text-red-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 animate-pulse rounded-full"></div>
                Error: {error}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner variant="dots" size="lg" text={`Loading Tx ${txHash.slice(0, 10)}...`} />
            </div>
          )}

          {/* Transaction Details */}
          {!loading && transaction && (
            <div className="space-y-4">
              {/* Transaction Overview Card */}
              <div className="bg-slate-800/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4 pb-3">
                <h2 className="text-xs sm:text-sm text-white">
                  Transaction Overview
                </h2>
                <span className={`inline-flex items-center px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-full ${getStatusColor(transaction.status)}`}>
                  <div className={`hidden sm:block w-2 h-2 mr-2 rounded-full ${
                    transaction.status === "success" ? "bg-green-400" :
                    transaction.status === "failed" ? "bg-red-400" :
                    "bg-blue-300"
                  }`}></div>
                    {transaction.status.toUpperCase()}
                  </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Transaction Hash</span>
                    <div className="flex items-center gap-1 sm:gap-2 max-w-xs">
                      <span className="text-white text-xs font-mono truncate">{formatHash(transaction.hash)}</span>
                      <button
                        onClick={() => copyToClipboard(transaction.hash, "hash")}
                        className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                      >
                        {copiedField === "hash" ? <FiCheck className="w-3 h-3 sm:w-4 sm:h-4" /> : <FiCopy className="w-3 h-3 sm:w-4 sm:h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Block Number</span>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Link
                        href={`/explorer/latest/block/${transaction.blockNumber}`}
                        className="text-blue-400 hover:text-blue-300 text-xs"
                      >
                        #{transaction.blockNumber.toLocaleString()}
                      </Link>
                      <button
                        onClick={() => copyToClipboard(transaction.blockNumber.toString(), "blockNumber")}
                        className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                      >
                        {copiedField === "blockNumber" ? <FiCheck className="w-3 h-3 sm:w-4 sm:h-4" /> : <FiCopy className="w-3 h-3 sm:w-4 sm:h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Timestamp</span>
                    <span className="text-white text-xs">{formatTime(transaction.timestamp)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Value</span>
                    <div className="flex flex-col items-end">
                      <span className="text-white text-xs">{formatValue(transaction.value)}</span>
                      {transaction.ethValueUsd > 0 && (
                        <span className="text-gray-400 text-[10px]">${transaction.ethValueUsd.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">From Address</span>
                    <div className="flex items-center gap-1 sm:gap-2 max-w-xs">
                      <Link
                        href={`/explorer/address/${transaction.from}`}
                        className="text-blue-400 hover:text-blue-300 text-xs font-mono truncate"
                      >
                        {formatAddress(transaction.from)}
                      </Link>
                      <button
                        onClick={() => copyToClipboard(transaction.from, "from")}
                        className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                      >
                        {copiedField === "from" ? <FiCheck className="w-3 h-3 sm:w-4 sm:h-4" /> : <FiCopy className="w-3 h-3 sm:w-4 sm:h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">To Address</span>
                    <div className="flex items-center gap-1 sm:gap-2 max-w-xs">
                      <Link
                        href={`/explorer/address/${transaction.to}`}
                        className="text-blue-400 hover:text-blue-300 text-xs font-mono truncate"
                      >
                        {formatAddress(transaction.to)}
                      </Link>
                      <button
                        onClick={() => copyToClipboard(transaction.to, "to")}
                        className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                      >
                        {copiedField === "to" ? <FiCheck className="w-3 h-3 sm:w-4 sm:h-4" /> : <FiCopy className="w-3 h-3 sm:w-4 sm:h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Nonce</span>
                    <span className="text-white text-xs">{transaction.nonce}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Transaction Index</span>
                    <span className="text-white text-xs">{transaction.transactionIndex}</span>
                  </div>
                </div>
              </div>
            </div>

              {/* Gas Information Card */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700/50">
                  <h2 className="text-xs sm:text-sm text-white">
                Gas Information
              </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <span className="text-gray-400 text-xs">Gas Used</span>
                    <p className="text-xs text-white">{parseInt(transaction.gasUsed).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                    <span className="text-gray-400 text-xs">Gas Limit</span>
                    <p className="text-xs text-white">{parseInt(transaction.gasLimit).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                    <span className="text-gray-400 text-xs">Usage</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 h-2 rounded-full">
                  <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min((parseInt(transaction.gasUsed) / parseInt(transaction.gasLimit)) * 100, 100)}%` 
                    }}
                  ></div>
                      </div>
                      <span className="text-white text-xs">{Math.round((parseInt(transaction.gasUsed) / parseInt(transaction.gasLimit)) * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Details */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 mb-8 pb-8">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700/50">
                  <h2 className="text-xs sm:text-sm text-white font-semibold">
                Advanced Details
              </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Block Hash</span>
                    <div className="flex items-center gap-1 sm:gap-2 max-w-xs">
                        <span className="text-white text-xs font-mono truncate">{formatHash(transaction.blockHash)}</span>
                      <button
                        onClick={() => copyToClipboard(transaction.blockHash, "blockHash")}
                        className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                      >
                          {copiedField === "blockHash" ? <FiCheck className="w-3 h-3 sm:w-4 sm:h-4" /> : <FiCopy className="w-3 h-3 sm:w-4 sm:h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Input Data</span>
                      <div className="flex items-center gap-1 sm:gap-2 max-w-xs">
                        <span className="text-white text-xs truncate">
                      {transaction.inputData === "0x" ? "No Data" : `${transaction.inputData.slice(0, 10)}...`}
                    </span>
                        {transaction.inputData !== "0x" && (
                          <button
                            onClick={() => copyToClipboard(transaction.inputData, "inputData")}
                            className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                          >
                            {copiedField === "inputData" ? <FiCheck className="w-3 h-3 sm:w-4 sm:h-4" /> : <FiCopy className="w-3 h-3 sm:w-4 sm:h-4" />}
                          </button>
                        )}
                      </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Receipt Status</span>
                      <span className="text-white text-xs">{transaction.receipt.status}</span>
                  </div>
                  {transaction.contractAddress && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Contract Address</span>
                      <div className="flex items-center gap-1 sm:gap-2 max-w-xs">
                          <Link
                            href={`/explorer/address/${transaction.contractAddress}`}
                            className="text-blue-400 hover:text-blue-300 text-xs font-mono truncate"
                          >
                            {formatAddress(transaction.contractAddress)}
                          </Link>
                        <button
                          onClick={() => copyToClipboard(transaction.contractAddress!, "contract")}
                          className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                        >
                            {copiedField === "contract" ? <FiCheck className="w-3 h-3 sm:w-4 sm:h-4" /> : <FiCopy className="w-3 h-3 sm:w-4 sm:h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                  <div className="space-y-2">
                  {transaction.methodSignature && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Method</span>
                        <span className="text-white text-xs">{transaction.methodSignature}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">ETH Value (USD)</span>
                      <span className="text-white text-xs">${transaction.ethValueUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Gas Fee (USD)</span>
                      <span className="text-white text-xs">${transaction.gasFeeUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Logs Count</span>
                      <span className="text-white text-xs">{transaction.receipt.logs.length}</span>
                  </div>
                </div>
              </div>

              {/* Transaction Logs */}
              {transaction.receipt.logs.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs sm:text-sm text-white">Transaction Logs</h3>
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 text-xs sm:text-sm text-gray-200 transition-colors rounded-full border border-blue-500/30 hover:border-blue-500/50 uppercase font-sans"
                    >
                      <span className="hidden sm:inline">{showLogs ? <FiMinus className="w-3.5 h-3.5" /> : <FiPlus className="w-3.5 h-3.5" />}</span>
                      {showLogs ? "Hide" : "Show"} Logs
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {showLogs && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 max-h-40 overflow-y-auto"
                      >
                        {transaction.receipt.logs.map((log, index) => (
                          <div key={index} className="bg-gray-700/50 p-3 text-xs rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-400 text-xs">Log #{index + 1}</span>
                              <div className="flex items-center gap-1 sm:gap-2">
                                <span className="text-gray-400 text-xs hidden sm:inline">Address: </span>
                                <Link
                                  href={`/explorer/address/${log.address}`}
                                  className="text-blue-400 hover:text-blue-300 text-xs font-mono truncate max-w-xs"
                                >
                                  {formatAddress(log.address)}
                                </Link>
                                <button
                                  onClick={() => copyToClipboard(log.address, `logAddress-${index}`)}
                                  className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                                >
                                  {copiedField === `logAddress-${index}` ? <FiCheck className="w-3 h-3" /> : <FiCopy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-white text-xs break-all flex-1 mr-2">{log.data.slice(0, 20)}...</span>
                              <button
                                onClick={() => copyToClipboard(log.data, `logData-${index}`)}
                                className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                              >
                                {copiedField === `logData-${index}` ? <FiCheck className="w-3 h-3" /> : <FiCopy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}

          {/* No Transaction Data */}
          {!loading && !transaction && !error && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No transaction data available</p>
              <p className="text-gray-500 text-sm mt-2">Please check the transaction hash or try again later.</p>
            </div>
          )}
        </div>
      </main>
      
      <div className="pb-20 sm:pb-0">
        <Footer />
      </div>

      {/* Copy Notification */}
      <AnimatePresence>
        {showCopyNotification && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-6 z-50 bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <FiCheck className="w-4 h-4 text-green-400" />
              <span className="text-white text-sm">Address copied to clipboard</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
