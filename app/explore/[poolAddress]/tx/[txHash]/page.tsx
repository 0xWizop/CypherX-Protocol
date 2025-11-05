"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";
import { ethers } from "ethers";

export default function TransactionPage() {
  const { poolAddress, txHash } = useParams<{ poolAddress: string; txHash: string }>();
  const router = useRouter();
  const [txData, setTxData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!txHash) return;
      
      try {
        setLoading(true);
        const BASE_RPC_URL = "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
        const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
        
        const receipt = await provider.getTransactionReceipt(txHash as string);
        const tx = await provider.getTransaction(txHash as string);
        
        if (!receipt) {
          setError("Transaction not found or still pending");
          return;
        }

        setTxData({
          hash: receipt.hash,
          from: receipt.from,
          to: receipt.to,
          status: receipt.status === 1 ? 'Success' : 'Failed',
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed?.toString(),
          gasPrice: receipt.gasPrice?.toString(),
          value: tx?.value?.toString() || '0',
          timestamp: Date.now(), // Would need to fetch from block
        });
      } catch (err: any) {
        console.error("Error fetching transaction:", err);
        setError(err.message || "Failed to fetch transaction");
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [txHash]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <Header />
      <div className="border-b border-gray-800"></div>
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <button
          onClick={() => router.back()}
          className="mb-6 text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Chart
        </button>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-400">Loading transaction...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {txData && !loading && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-6">Transaction Details</h1>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">Status</span>
                <span className={`font-semibold ${
                  txData.status === 'Success' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {txData.status}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">Transaction Hash</span>
                <span className="font-mono text-sm text-gray-300 break-all">{txData.hash}</span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">From</span>
                <span className="font-mono text-sm text-gray-300 break-all">{txData.from}</span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">To</span>
                <span className="font-mono text-sm text-gray-300 break-all">{txData.to}</span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">Block Number</span>
                <span className="text-gray-300">{txData.blockNumber}</span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <span className="text-gray-400">Gas Used</span>
                <span className="text-gray-300">{txData.gasUsed}</span>
              </div>
              
              <div className="pt-4">
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View on BaseScan
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}











