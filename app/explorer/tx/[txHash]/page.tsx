"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHash,
  FiClock,
  FiActivity,
  FiCopy,
  FiCheck,
  FiExternalLink,
  FiZap,
  FiSettings,
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiInfo,
  FiMinus,
  FiPlus,
} from "react-icons/fi";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";

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
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
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

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <FiCheckCircle className="w-5 h-5 text-green-400" />;
      case "failed":
        return <FiXCircle className="w-5 h-5 text-red-400" />;
      case "pending":
        return <FiClock className="w-5 h-5 text-blue-300" />;
      default:
        return <FiInfo className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-900/20 text-green-400 border-green-500/30";
      case "failed":
        return "bg-red-900/20 text-red-400 border-red-500/30";
      case "pending":
        return "bg-blue-800/30 text-blue-200 border-blue-400/40";
      default:
        return "bg-gray-800/50 text-gray-300 border-gray-600/50";
    }
  };

  const formatValue = (value: string) => {
    const numValue = parseFloat(value);
    if (numValue === 0) return "0 ETH";
    if (numValue < 0.001) return `${numValue.toFixed(6)} ETH`;
    if (numValue < 1) return `${numValue.toFixed(4)} ETH`;
    return `${numValue.toFixed(4)} ETH`;
  };

  const formatGasPrice = (gasPrice: string) => {
    const numPrice = parseFloat(gasPrice);
    if (numPrice < 1) return `${(numPrice * 1000).toFixed(2)} Gwei`;
    return `${numPrice.toFixed(2)} Gwei`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };


  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 bg-slate-900 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col">
          {/* Header */}
          <div className="text-left mb-4 flex-shrink-0">
            <h1 className="text-lg font-normal mb-1 text-white">Transaction Details</h1>
            <p className="text-gray-400 text-xs">Transaction information from Base network</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 p-4 mb-6 text-red-400">
              <div className="flex items-center gap-2">
                <FiAlertCircle className="w-5 h-5" />
                Error: {error}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-10 h-10 border-3 border-blue-400/20 border-t-blue-400 animate-spin"></div>
                  <div className="absolute inset-0 w-10 h-10 border-3 border-transparent border-r-blue-300/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                </div>
                <span className="text-gray-400 text-sm">Loading transaction details...</span>
              </div>
            </div>
          )}

          {/* Transaction Details */}
          {!loading && transaction && (
            <div className="space-y-5">
              {/* Transaction Overview Card */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiHash className="w-5 h-5 text-blue-400" />
                  Transaction Overview
                </h2>
                <div className="flex items-center gap-3">
                  {getStatusIcon(transaction.status)}
                  <span className={`inline-flex items-center px-3 py-1 text-sm font-semibold border ${getStatusColor(transaction.status)}`}>
                    {transaction.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Transaction Hash</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white font-mono text-sm truncate">{transaction.hash}</span>
                      <button
                        onClick={() => copyToClipboard(transaction.hash, "hash")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "hash" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Block Number</span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/explorer/latest/block/${transaction.blockNumber}`}
                        className="text-blue-400 hover:text-blue-300 font-mono font-medium"
                      >
                        #{transaction.blockNumber.toLocaleString()}
                      </Link>
                      <a
                        href={`/explorer/latest/block/${transaction.blockNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Timestamp</span>
                    <div className="flex items-center gap-2">
                      <FiClock className="w-4 h-4 text-gray-400" />
                      <span className="text-white">{formatTime(transaction.timestamp)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Value</span>
                    <div className="flex items-center gap-2">
                      <FiActivity className="w-4 h-4 text-blue-400" />
                      <span className="text-white font-medium">{formatValue(transaction.value)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">From Address</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white font-mono text-sm truncate">{transaction.from}</span>
                      <button
                        onClick={() => copyToClipboard(transaction.from, "from")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "from" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                      <a
                        href={`/explorer/address/${transaction.from}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">To Address</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white font-mono text-sm truncate">{transaction.to}</span>
                      <button
                        onClick={() => copyToClipboard(transaction.to, "to")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "to" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                      <a
                        href={`/explorer/address/${transaction.to}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Nonce</span>
                    <span className="text-white font-mono">{transaction.nonce}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Transaction Index</span>
                    <span className="text-white font-mono">{transaction.transactionIndex}</span>
                  </div>
                </div>
              </div>
            </motion.div>

              {/* Gas Information Card */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-5">
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <FiZap className="w-5 h-5 text-blue-400" />
                Gas Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm font-medium">Gas Used</span>
                  <p className="text-xl font-bold text-white">{parseInt(transaction.gasUsed).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm font-medium">Gas Limit</span>
                  <p className="text-xl font-bold text-white">{parseInt(transaction.gasLimit).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm font-medium">Gas Price</span>
                  <p className="text-lg font-bold text-white">{formatGasPrice(transaction.gasPrice)}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm font-medium">Total Cost</span>
                  <p className="text-lg font-bold text-white">{transaction.gasFeeEth.toFixed(6)} ETH</p>
                </div>
              </div>

              {/* Gas Usage Progress Bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm font-medium">Gas Usage Efficiency</span>
                  <span className="text-white text-sm font-semibold">
                    {Math.round((parseInt(transaction.gasUsed) / parseInt(transaction.gasLimit)) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700/50 h-2">
                  <div
                    className="bg-blue-500 h-2 transition-all duration-500"
                    style={{ 
                      width: `${Math.min((parseInt(transaction.gasUsed) / parseInt(transaction.gasLimit)) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
            </motion.div>

              {/* Advanced Details */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-5">
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <FiSettings className="w-5 h-5 text-blue-400" />
                Advanced Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Block Hash</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white text-xs truncate">{transaction.blockHash}</span>
                      <button
                        onClick={() => copyToClipboard(transaction.blockHash, "blockHash")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "blockHash" ? <FiCheck className="w-3 h-3" /> : <FiCopy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Input Data</span>
                    <span className="text-white text-xs">
                      {transaction.inputData === "0x" ? "No Data" : `${transaction.inputData.slice(0, 20)}...`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Receipt Status</span>
                    <span className="text-white text-xs">{transaction.receipt.status}</span>
                  </div>
                  {transaction.contractAddress && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Contract Address</span>
                      <div className="flex items-center gap-2 max-w-xs">
                        <span className="text-white text-xs truncate">{transaction.contractAddress}</span>
                        <button
                          onClick={() => copyToClipboard(transaction.contractAddress!, "contract")}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {copiedField === "contract" ? <FiCheck className="w-3 h-3" /> : <FiCopy className="w-3 h-3" />}
                        </button>
                        <a
                          href={`/explorer/address/${transaction.contractAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <FiExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {transaction.methodSignature && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Method</span>
                      <span className="text-white text-xs">{transaction.methodSignature}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">ETH Value (USD)</span>
                    <span className="text-white text-xs">${transaction.ethValueUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Gas Fee (USD)</span>
                    <span className="text-white text-xs">${transaction.gasFeeUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Logs Count</span>
                    <span className="text-white text-xs">{transaction.receipt.logs.length}</span>
                  </div>
                </div>
              </div>

              {/* Transaction Logs */}
              {transaction.receipt.logs.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-white">Transaction Logs</h3>
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors"
                    >
                      {showLogs ? <FiMinus className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
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
                          <div key={index} className="bg-gray-700/50 p-3 text-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-400">Log #{index + 1}</span>
                              <span className="text-gray-400">Address: {log.address}</span>
                            </div>
                            <div className="text-white text-xs break-all">
                              {log.data}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </div>
        )}

          {/* No Transaction Data */}
          {!loading && !transaction && !error && (
            <div className="text-center py-12">
              <FiActivity className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No transaction data available</p>
              <p className="text-gray-500 text-sm mt-2">Please check the transaction hash or try again later.</p>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
