"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../../../lib/firebase.ts";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { FiCopy, FiCheck } from "react-icons/fi";
import Header from "../../../../components/Header";
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

  const gasUsedPercentage =
    block && parseInt(block.gasLimit, 10) > 0
      ? Math.min(100, Math.round((parseInt(block.gasUsed, 10) / parseInt(block.gasLimit, 10)) * 100))
      : 0;

  return (
    <>
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 bg-gray-950 overflow-y-auto lg:overflow-hidden min-h-0">
        <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-24 sm:pb-8 lg:pb-10 sm:py-5 flex flex-col gap-3 sm:gap-4">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 flex-none">
            <Link href="/explorer" className="hover:text-blue-400 transition-colors">
              Explorer
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-300">Block Details</span>
          </div>
          
          <div className="flex flex-col gap-1 flex-none">
            <h1 className="text-xs sm:text-base font-normal text-white sm:text-xl">Block #{blockNumber}</h1>
            <p className="text-gray-400 text-xs">Detailed information about this Base block.</p>
          </div>

          {error && (
            <div className="bg-red-900/20 p-4 rounded-xl text-red-400">
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                {error}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner variant="dots" size="lg" text={`Loading Block ${blockNumber}...`} />
            </div>
          )}

          {!loading && block && (
            <div className="flex flex-col gap-4 sm:gap-6">
              <section className="rounded-2xl bg-slate-900/35 flex-shrink-0">
                <div className="flex flex-row items-start sm:items-center justify-between gap-2 px-4 py-2.5">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Block Overview</h2>
                    <p className="text-xs text-gray-400 hidden sm:block">Snapshot of key block metadata.</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-green-900/25 px-2.5 py-1 text-xs font-semibold text-green-400 flex-shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    {block.status}
                  </span>
                </div>

                {/* Mobile Layout */}
                <div className="px-4 py-4 sm:hidden space-y-3 divide-y divide-slate-700/40">
                  {[{ label: "Block Number", value: `#${block.number.toLocaleString()}` }, { label: "Timestamp", value: block.timestamp }, { label: "Transactions", value: block.transactions.toLocaleString() }, { label: "Difficulty", value: block.difficulty }, { label: "Total Difficulty", value: block.totalDifficulty }, { label: "Size", value: block.size }].map((item) => (
                    <div key={item.label} className="flex items-center justify-between pt-3 first:pt-0">
                      <span className="text-xs text-gray-400 uppercase tracking-wide">{item.label}</span>
                      <span className="text-xs text-white font-semibold ml-4">{item.value}</span>
                    </div>
                  ))}
                  {[{ label: "Block Hash", value: block.hash, field: "hash" }, { label: "Parent Hash", value: block.parentHash, field: "parentHash" }].map((item) => {
                    const formatHash = (hash: string) => `${hash.slice(0, 8)}...${hash.slice(-6)}`;
                    return (
                    <div key={item.label} className="flex items-center justify-between gap-3 pt-3">
                      <span className="text-xs text-gray-400 uppercase tracking-wide">{item.label}</span>
                        <div className="flex items-center gap-1 max-w-[70%]">
                          <span className="text-xs text-white font-mono truncate">{formatHash(item.value)}</span>
                        <button onClick={() => copyToClipboard(item.value, item.field)} className="text-blue-400 hover:text-blue-200 flex-shrink-0">
                            {copiedField === item.field ? <FiCheck className="w-3 h-3" /> : <FiCopy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    );
                  })}
                  <div className="flex items-center justify-between gap-3 pt-3">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Miner</span>
                    <a href={`/explorer/address/${block.miner}`} className="text-xs text-blue-300 hover:text-blue-200 font-mono truncate max-w-[70%]">
                      {`${block.miner.slice(0, 6)}...${block.miner.slice(-4)}`}
                    </a>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:block px-4 py-3 text-sm text-slate-200">
                  <div className="grid grid-cols-12 gap-y-2 gap-x-3">
                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Block Number</span>
                    <span className="col-span-4 text-white font-medium">{`#${block.number.toLocaleString()}`}</span>
                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Block Hash</span>
                    <span className="col-span-4 flex items-center gap-2 font-mono text-xs text-blue-300">
                      <span className="truncate">{block.hash}</span>
                      <button onClick={() => copyToClipboard(block.hash, "hash")} className="text-blue-400 hover:text-blue-200">
                        {copiedField === "hash" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                    </span>

                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Timestamp</span>
                    <span className="col-span-4 text-white">{block.timestamp}</span>
                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Parent Hash</span>
                    <span className="col-span-4 flex items-center gap-2 font-mono text-xs text-blue-300">
                      <span className="truncate">{block.parentHash}</span>
                      <button onClick={() => copyToClipboard(block.parentHash, "parentHash")} className="text-blue-400 hover:text-blue-200">
                        {copiedField === "parentHash" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                    </span>

                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Transactions</span>
                    <span className="col-span-4 text-white">{block.transactions.toLocaleString()}</span>
                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Miner</span>
                    <span className="col-span-4 text-blue-300 hover:text-blue-200 truncate">
                      <a href={`/explorer/address/${block.miner}`}>{block.miner}</a>
                    </span>

                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Difficulty</span>
                    <span className="col-span-4 text-white">{block.difficulty}</span>
                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Total Difficulty</span>
                    <span className="col-span-4 text-white">{block.totalDifficulty}</span>

                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Size</span>
                    <span className="col-span-4 text-white">{block.size}</span>
                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Gas Used</span>
                    <span className="col-span-4 text-white">{parseInt(block.gasUsed, 10).toLocaleString()}</span>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-slate-900/35 flex-shrink-0">
                <div className="px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-white">Gas Information</h2>
                </div>
                <div className="px-4 py-4 sm:hidden space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Gas Used</span>
                      <span className="text-sm text-white">{parseInt(block.gasUsed, 10).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-xs text-gray-400 uppercase tracking-wide">Gas Limit</span>
                      <span className="text-sm text-white">{parseInt(block.gasLimit, 10).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Utilization</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-700">
                        <div className="h-2 rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${gasUsedPercentage}%` }} />
                      </div>
                      <span className="text-sm text-white font-semibold w-12 text-right">{gasUsedPercentage}%</span>
                    </div>
                  </div>
                </div>
                <div className="hidden sm:block px-4 py-3">
                  <div className="grid grid-cols-12 gap-y-2 gap-x-3 text-sm text-slate-200">
                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Gas Used</span>
                    <span className="col-span-4 text-white">{parseInt(block.gasUsed, 10).toLocaleString()}</span>
                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Gas Limit</span>
                    <span className="col-span-4 text-white">{parseInt(block.gasLimit, 10).toLocaleString()}</span>
                    <span className="col-span-2 text-[11px] uppercase tracking-wide text-slate-400">Gas Usage</span>
                    <span className="col-span-10 flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-gray-800">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${gasUsedPercentage}%` }} />
                      </div>
                      <span className="text-sm text-white font-semibold">{gasUsedPercentage}%</span>
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-slate-900/35">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
                  <h2 className="text-sm font-semibold text-white">Transactions ({block.transactions})</h2>
                  <span className="text-xs text-gray-400">{block.transactionList?.length || 0} loaded</span>
                </div>

                {block.transactionList && block.transactionList.length > 0 ? (
                  <>
                    <div className="sm:hidden">
                      <div className="max-h-[200px] overflow-y-auto scrollbar-hide overscroll-contain">
                        <div className="px-4 py-3 space-y-2 pb-4">
                          <AnimatePresence mode="popLayout">
                            {block.transactionList.map((tx, index) => {
                              const formatHash = (hash: string) => `${hash.slice(0, 8)}...${hash.slice(-6)}`;
                              const formatAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;
                              return (
                              <motion.div
                                key={tx.hash}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="py-2.5"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center flex-1 min-w-0">
                                    <Link href={`/explorer/tx/${tx.hash}`} className="font-mono text-xs text-blue-400 hover:text-blue-300 truncate">
                                      {formatHash(tx.hash)}
                                    </Link>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0 min-w-0">
                                    <a href={`/explorer/address/${tx.from}`} className="text-xs text-white hover:text-blue-300 truncate max-w-[45px]" title={tx.from}>
                                      {formatAddress(tx.from)}
                                    </a>
                                    <span className="text-gray-500">→</span>
                                    <a href={`/explorer/address/${tx.to}`} className="text-xs text-white hover:text-blue-300 truncate max-w-[45px]" title={tx.to}>
                                      {formatAddress(tx.to)}
                                    </a>
                                  </div>
                                </div>
                              </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:block">
                      <div className="grid grid-cols-12 px-4 py-2 text-[0.75rem] text-slate-400 border-b border-slate-700/50">
                        <span className="col-span-4">Hash</span>
                        <span className="col-span-3">From</span>
                        <span className="col-span-3">To</span>
                        <span className="col-span-2 text-right">Actions</span>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto scrollbar-hide overscroll-contain">
                        <div className="px-4 py-2 pb-4">
                          {block.transactionList.map((tx) => (
                            <div key={tx.hash} className="grid grid-cols-12 items-center py-2 text-xs text-slate-200">
                              <span className="col-span-4 font-mono text-blue-300 truncate pr-3">
                                <Link href={`/explorer/tx/${tx.hash}`} className="hover:text-blue-200">
                                  {tx.hash}
                                </Link>
                              </span>
                              <span className="col-span-3 truncate pr-2">
                                <a href={`/explorer/address/${tx.from}`} className="hover:text-blue-300">
                                  {tx.from}
                                </a>
                              </span>
                              <span className="col-span-3 truncate pr-2">
                                <a href={`/explorer/address/${tx.to}`} className="hover:text-blue-300">
                                  {tx.to}
                                </a>
                              </span>
                              <span className="col-span-2 text-right">
                                <a href={`/explorer/tx/${tx.hash}`} className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-100">
                                  View
                                </a>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-4 text-center text-sm text-gray-400">No transactions in this block.</div>
                )}
              </section>
            </div>
          )}

          {!loading && !block && !error && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No block data available</p>
              <p className="text-gray-500 text-sm mt-2">Please check the block number or try again later.</p>
            </div>
          )}
        </div>
      </main>
      
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
              <span className="text-white text-sm">Copied to clipboard</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </>
  );
}