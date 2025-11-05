"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
import LoadingSpinner from "../../../../components/LoadingSpinner";

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
  const [showCopyNotification, setShowCopyNotification] = useState<boolean>(false);
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
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
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

  const gasUsedPercentage = block ? Math.round((parseInt(block.gasUsed) / parseInt(block.gasLimit)) * 100) : 0;

  return (
    <div className="h-screen bg-[#0f172a] flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 bg-[#0f172a] overflow-hidden">
        <div className="h-full max-w-[1280px] mx-auto px-5 lg:px-8 pt-6 pb-0 flex flex-col">
          {/* Header */}
          <div className="text-left mb-4 flex-shrink-0">
            <h1 className="text-base font-semibold mb-0.5 text-white">Block #{blockNumber}</h1>
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
              <LoadingSpinner variant="dots" size="lg" text={`Loading Block ${blockNumber}...`} />
            </div>
          )}

          {/* Block Details */}
          {!loading && block && (
            <div className="space-y-4">
              {/* Block Overview Card */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700/50">
                <h2 className="text-sm text-white">
                  Block Overview
                </h2>
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-900/30 text-green-400 border border-green-500/30 rounded-full">
                  <div className="w-2 h-2 bg-green-400 mr-2 rounded-full"></div>
                  {block.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Block Number</span>
                    <span className="text-white font-medium">#{block.number.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Timestamp</span>
                    <span className="text-white">{block.timestamp}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Transactions</span>
                    <span className="text-white font-medium">{block.transactions}</span>
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
                    <a
                      href={`/explorer/address/${block.miner}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm truncate max-w-xs"
                    >
                      {block.miner}
                    </a>
                  </div>
                </div>
              </div>
              </div>

              {/* Gas Information Card */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700/50">
                  <h2 className="text-sm text-white">
                    Gas Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Gas Used</span>
                  <p className="text-lg text-white">{parseInt(block.gasUsed).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Gas Limit</span>
                  <p className="text-lg text-white">{parseInt(block.gasLimit).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Usage</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 h-2 rounded-full">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${gasUsedPercentage}%` }}
                      ></div>
                    </div>
                    <span className="text-white font-medium">{gasUsedPercentage}%</span>
                  </div>
                </div>
                </div>
              </div>

              {/* Transactions Card */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-gray-700/50">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm text-white">
                    Transactions ({block.transactions})
                  </h2>
                  <div className="text-sm text-gray-400">
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
                              <Link
                                href={`/explorer/tx/${tx.hash}`}
                                className="text-blue-400 hover:text-blue-300 text-sm truncate block max-w-xs"
                              >
                                {tx.hash}
                              </Link>
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
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-4 text-center">
                  <p className="text-gray-400">No transactions in this block</p>
                </div>
              )}
              </div>
            </div>
          )}

          {/* No Block Data */}
          {!loading && !block && !error && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No block data available</p>
              <p className="text-gray-500 text-sm mt-2">Please check the block number or try again later.</p>
            </div>
          )}
        </div>
      </main>
      
      <Footer />

      {/* Copy Notification */}
      <AnimatePresence>
        {showCopyNotification && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-6 z-50 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-lg px-4 py-3 shadow-lg"
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