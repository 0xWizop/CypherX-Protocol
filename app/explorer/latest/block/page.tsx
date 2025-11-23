"use client";

import React, { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { db } from "../../../../lib/firebase.ts";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";
import LoadingSpinner from "../../../components/LoadingSpinner";

interface Block {
  number: number;
  status: string;
  timestamp: string;
  hash: string;
  transactions: number;
}

const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL || "";

export default function CypherScanPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [_page] = useState<number>(1);
  const [_searchQuery] = useState<string>("");
  const [_filterStatus] = useState<string>("All");
  const [_viewMode] = useState<"grid" | "list">("list");
  const [_showStats] = useState<boolean>(true);
  const blocksPerPage = 50;

  const fetchBlocks = async (startPage: number) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch the latest block number
      const alchemyBlockRes = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });

      if (!alchemyBlockRes.ok) {
        const errorText = await alchemyBlockRes.text();
        throw new Error(`Alchemy API error: ${alchemyBlockRes.status} - ${errorText}`);
      }

      const alchemyBlockData = await alchemyBlockRes.json();
      if (!alchemyBlockData?.result) {
        throw new Error("Invalid Alchemy block number response: No result found");
      }

      const latestBlock = parseInt(alchemyBlockData.result, 16) || 0;
      if (latestBlock <= 0) {
        throw new Error("Invalid latest block number");
      }

      // Calculate the range for the last 100 blocks, adjusted for pagination
      const totalBlocksToFetch = 100;
      const startBlock = Math.max(latestBlock - totalBlocksToFetch + 1, 0);
      const endBlock = latestBlock;

      // Adjust for pagination
      const startIndex = (startPage - 1) * blocksPerPage;
      const blocksToFetch = Math.min(blocksPerPage, totalBlocksToFetch - startIndex);
      const fetchedBlocks: Block[] = [];

      // Fetch blocks in parallel for much faster loading
      const blockPromises = [];
      for (let i = 0; i < blocksToFetch; i++) {
        const blockNumber = endBlock - (startIndex + i);
        if (blockNumber < startBlock) break;

        blockPromises.push((async () => {
          // Check Firestore first
          const blockRef = doc(db, "blocks", blockNumber.toString());
          const blockSnap = await getDoc(blockRef);

          if (blockSnap.exists()) {
            const blockData = blockSnap.data() as Block;
            return { blockNumber, blockData };
          }

          // Fetch from Alchemy if not in Firestore
          const blockRes = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getBlockByNumber",
              params: [`0x${blockNumber.toString(16)}`, false],
              id: 1,
            }),
          });

          if (!blockRes.ok) {
            console.warn(`Failed to fetch block ${blockNumber}`);
            return null;
          }

          const blockData = await blockRes.json();
          const block = blockData?.result;

          if (block) {
            const timestamp = new Date(parseInt(block.timestamp, 16) * 1000);
            const timeAgo = formatDistanceToNow(timestamp, {
              addSuffix: true,
              includeSeconds: false,
            })
              .toUpperCase()
              .replace("LESS THAN A MINUTE", "1 MINUTE");
            const blockInfo: Block = {
              number: blockNumber,
              status: "Finalized",
              timestamp: timeAgo,
              hash: block.hash,
              transactions: block.transactions?.length || 0,
            };

            // Store in Firestore in background (don't wait for it)
            setDoc(blockRef, blockInfo).catch((writeError: unknown) => {
              const errorMessage = writeError instanceof Error ? writeError.message : "Unknown error";
              console.warn(`Failed to store block ${blockNumber} in Firestore: ${errorMessage}`);
            });

            return { blockNumber, blockData: blockInfo };
          }
          return null;
        })());
      }

      // Wait for all blocks to be fetched
      const results = await Promise.all(blockPromises);
      
      // Sort results by block number and add to fetchedBlocks
      results
        .filter(result => result !== null)
        .sort((a, b) => b!.blockNumber - a!.blockNumber)
        .forEach(result => {
          if (result) {
            fetchedBlocks.push(result.blockData);
          }
        });

      setBlocks(fetchedBlocks);
      if (fetchedBlocks.length === 0) {
        setError("No blocks found in the fetched range");
      }
    } catch (err: unknown) {
      console.error("Fetch blocks error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!db) {
      setError("Firestore is not initialized");
      return;
    }
    if (alchemyUrl) {
      fetchBlocks(_page);
    } else {
      setError("Alchemy URL is not configured");
    }
  }, [_page]);

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 bg-gray-950 overflow-hidden">
        <div className="h-full max-w-[1280px] mx-auto px-4 sm:px-5 lg:px-8 pt-4 pb-4 sm:pt-6 sm:pb-0 flex flex-col">
          {/* Header */}
          <div className="text-left mb-4 flex-shrink-0">
            <h1 className="text-xs sm:text-base font-semibold mb-0.5 text-white">Latest Blocks</h1>
            <p className="text-gray-400 text-xs">Real-time blockchain data from Base network</p>
          </div>



          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 p-3 mb-4 text-red-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 animate-pulse"></div>
                Error: {error}
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Latest Blocks */}
            <div className="bg-slate-800/30 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <h2 className="text-sm font-semibold text-white">Latest Blocks</h2>
                <Link href="/explorer/latest/block" className="text-blue-400 hover:text-blue-300 text-xs">
                  View all
                </Link>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner variant="dots" size="lg" text="Loading blocks..." />
                </div>
              )}

              {/* Blocks List */}
              {!loading && (
                <div>
                  {blocks.slice(0, 15).map((block, index) => (
                    <div key={block.number}>
                      <div className="flex items-center px-4 py-2">
                        <div className="flex items-center flex-1 min-w-0">
                          <a 
                            href={`/explorer/latest/block/${block.number}`}
                            className="text-blue-400 hover:text-blue-300 font-mono text-xs truncate"
                          >
                            #{block.number.toLocaleString()}
                          </a>
                        </div>
                        <div className="text-right mr-3 flex-shrink-0">
                          <div className="text-xs text-white">
                            {block.transactions} tx
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 min-w-[70px]">
                          <div className="text-xs text-gray-400">
                            {block.timestamp}
                          </div>
                        </div>
                      </div>
                      {index < 14 && (
                        <div></div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}