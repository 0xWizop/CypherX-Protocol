"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../../../lib/firebase.ts";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  FiHash,
  FiClock,
  FiActivity,
  FiCopy,
  FiCheck,
  FiExternalLink,
  FiBox,
  FiZap,
  FiEye,
} from "react-icons/fi";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";

interface Transaction {
  hash: string;
  from: string;
  to: string;
}

interface Block {
  number: number;
  status: string;
  timestamp: string;
  hash: string;
  transactions: number;
  parentHash: string;
  miner: string;
  gasUsed: string;
  gasLimit: string;
  difficulty: string;
  totalDifficulty: string;
  size: string;
  nonce: string;
  extraData: string;
  transactionList?: Transaction[];
}

const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL || "";

export default function BlockDetails() {
  const [block, setBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const blockNumber = params.blockNumber as string;

  const fetchBlock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!db) {
        throw new Error("Firestore is not initialized. Check Firebase configuration.");
      }

      if (!alchemyUrl) {
        throw new Error("Alchemy API URL is not configured.");
      }

      // Check Firestore first
      const blockRef = doc(db, "blocks", blockNumber);
      const blockSnap = await getDoc(blockRef);

      if (blockSnap.exists()) {
        const blockData = blockSnap.data() as Block;
        setBlock(blockData);
        console.log(`Block ${blockNumber} loaded from Firestore`);
        return;
      }

      // Fetch from Alchemy if not in Firestore
      const response = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBlockByNumber",
          params: [`0x${parseInt(blockNumber, 10).toString(16)}`, true],
          id: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alchemy API error: ${response.status} - ${errorText}`);
      }

      const blockData = await response.json();
      if (!blockData?.result) {
        throw new Error("Block not found in Alchemy response");
      }

      const block = blockData.result;
      const timestamp = new Date(parseInt(block.timestamp, 16) * 1000);
      const timeAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);

      const blockInfo: Block = {
        number: parseInt(block.number, 16),
        status: "Finalized",
        timestamp: `${timeAgo} SEC${timeAgo === 1 ? "" : "S"} AGO`,
        hash: block.hash || "N/A",
        transactions: block.transactions?.length || 0,
        parentHash: block.parentHash || "N/A",
        miner: block.miner || "N/A",
        gasUsed: parseInt(block.gasUsed, 16).toString() || "0",
        gasLimit: parseInt(block.gasLimit, 16).toString() || "0",
        difficulty: (parseInt(block.difficulty, 16) / 1e12).toFixed(2) + "T" || "0",
        totalDifficulty: (parseInt(block.totalDifficulty, 16) / 1e15).toFixed(2) + "P" || "0",
        size: block.size ? parseInt(block.size, 16).toString() + " bytes" : "0 bytes",
        nonce: block.nonce || "N/A",
        extraData: block.extraData || "N/A",
        transactionList: block.transactions?.map((tx: { hash?: string; from?: string; to?: string }) => ({
          hash: tx.hash || "N/A",
          from: tx.from || "N/A",
          to: tx.to || "N/A",
        })) || [],
      };

      setBlock(blockInfo);

      if (auth.currentUser) {
        try {
          await setDoc(blockRef, blockInfo);
          console.log(`Block ${blockNumber} stored in Firestore`);
        } catch (writeError: unknown) {
          const errorMessage = writeError instanceof Error ? writeError.message : "Unknown error";
          console.warn("Failed to write block to Firestore:", errorMessage);
        }
      } else {
        console.log("Skipping Firestore write: User not authenticated");
      }
    } catch (err: unknown) {
      console.error("Fetch block error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to fetch block: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [blockNumber]);

  useEffect(() => {
    if (!blockNumber) {
      router.push("/explorer/latest/block");
      return;
    }

    const blockNum = parseInt(blockNumber, 10);
    if (isNaN(blockNum) || blockNum < 0) {
      setError("Invalid block number: Must be a positive integer");
      router.push("/explorer/latest/block");
      return;
    }

    fetchBlock();
  }, [blockNumber, router, fetchBlock]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const gasUsedPercentage = block ? Math.round((parseInt(block.gasUsed) / parseInt(block.gasLimit)) * 100) : 0;

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 bg-slate-900 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col">
          {/* Header */}
          <div className="text-left mb-4 flex-shrink-0">
            <h1 className="text-lg font-normal mb-1 text-white">Block #{blockNumber}</h1>
            <p className="text-gray-400 text-xs">Detailed block information from Base network</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 p-4 mb-6 text-red-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 animate-pulse"></div>
                Error: {error}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-10 h-10 border-3 border-blue-400/20 border-t-blue-400 animate-spin"></div>
                  <div className="absolute inset-0 w-10 h-10 border-3 border-transparent border-r-blue-300/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                </div>
                <span className="text-gray-400 text-sm">Loading block details...</span>
              </div>
            </div>
          )}

          {/* Block Details */}
          {!loading && block && (
            <div className="space-y-4">
              {/* Block Overview Card */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <FiHash className="w-5 h-5 text-blue-400" />
                  Block Overview
                </h2>
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-900/30 text-green-400 border border-green-500/30">
                  <div className="w-2 h-2 bg-green-400 mr-2"></div>
                  {block.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Block Number</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">#{block.number.toLocaleString()}</span>
                      <a
                        href={`/explorer/latest/block/${block.number}`}
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
                      <span className="text-white">{block.timestamp}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Transactions</span>
                    <div className="flex items-center gap-2">
                      <FiActivity className="w-4 h-4 text-gray-400" />
                      <span className="text-white font-medium">{block.transactions}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Block Hash</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white text-sm truncate">{block.hash}</span>
                      <button
                        onClick={() => copyToClipboard(block.hash, "hash")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "hash" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Parent Hash</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white text-sm truncate">{block.parentHash}</span>
                      <button
                        onClick={() => copyToClipboard(block.parentHash, "parentHash")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "parentHash" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Miner</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white text-sm truncate">{block.miner}</span>
                      <a
                        href={`/explorer/address/${block.miner}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

              {/* Gas Information Card */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <FiZap className="w-5 h-5 text-blue-400" />
                Gas Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Gas Used</span>
                  <p className="text-lg font-bold text-white">{parseInt(block.gasUsed).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Gas Limit</span>
                  <p className="text-lg font-bold text-white">{parseInt(block.gasLimit).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Usage</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 h-2">
                      <div
                        className="bg-blue-500 h-2 transition-all duration-300"
                        style={{ width: `${gasUsedPercentage}%` }}
                      ></div>
                    </div>
                    <span className="text-white font-medium">{gasUsedPercentage}%</span>
                  </div>
                </div>
              </div>
            </motion.div>


              {/* Transactions Card */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <FiActivity className="w-5 h-5 text-blue-400" />
                    Transactions ({block.transactions})
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <FiEye className="w-4 h-4" />
                    {block.transactionList?.length || 0} loaded
                  </div>
                </div>
              </div>

              {block.transactionList && block.transactionList.length > 0 ? (
                <div className="overflow-x-auto max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-800/50 text-gray-300 text-sm">
                        <th className="px-4 py-2 text-left font-medium">Hash</th>
                        <th className="px-4 py-2 text-left font-medium">From</th>
                        <th className="px-4 py-2 text-left font-medium">To</th>
                        <th className="px-4 py-2 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {block.transactionList.map((tx, index) => (
                          <motion.tr
                            key={tx.hash}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="px-4 py-2">
                              <a
                                href={`/explorer/tx/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-sm truncate block max-w-xs"
                              >
                                {tx.hash}
                              </a>
                            </td>
                            <td className="px-4 py-2">
                              <a
                                href={`/explorer/address/${tx.from}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-sm truncate block max-w-xs"
                              >
                                {tx.from}
                              </a>
                            </td>
                            <td className="px-4 py-2">
                              <a
                                href={`/explorer/address/${tx.to}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-sm truncate block max-w-xs"
                              >
                                {tx.to}
                              </a>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <a
                                  href={`/explorer/tx/${tx.hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors"
                                >
                                  <FiEye className="w-3 h-3" />
                                  View
                                </a>
                                <a
                                  href={`/explorer/tx/${tx.hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 text-xs text-white transition-colors"
                                >
                                  <FiExternalLink className="w-3 h-3" />
                                  Explorer
                                </a>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-4 text-center">
                  <FiActivity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No transactions in this block</p>
                </div>
              )}
            </motion.div>
          </div>
        )}

          {/* No Block Data */}
          {!loading && !block && !error && (
            <div className="text-center py-12">
              <FiBox className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No block data available</p>
              <p className="text-gray-500 text-sm mt-2">Please check the block number or try again later.</p>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}