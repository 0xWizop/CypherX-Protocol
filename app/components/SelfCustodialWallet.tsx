"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import { toast } from "react-hot-toast";
import { useWalletSystem } from "@/app/providers";
import { 
  FaWallet, 
  FaDownload, 
  FaUpload, 
  FaExchangeAlt, 
  FaHistory,
  FaShieldAlt,
  FaCopy,
  FaQrcode,
  FaEye,
  FaEyeSlash
} from "react-icons/fa";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

interface WalletData {
  address: string;
  privateKey: string;
  balance: {
    eth: string;
    usd: number;
  };
  tokens: TokenBalance[];
  transactions: Transaction[];
  isBackedUp: boolean;
}

interface TokenBalance {
  symbol: string;
  name: string;
  address: string;
  balance: string;
  usdValue: number;
  decimals: number;
  logo?: string;
}

interface Transaction {
  hash: string;
  type: "deposit" | "withdrawal" | "swap" | "transfer";
  amount: string;
  token: string;
  usdValue: number;
  timestamp: number;
  status: "pending" | "confirmed" | "failed";
  gasUsed?: string;
  gasPrice?: string;
}

interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  gasEstimate: string;
  route: string[];
  fees: number;
}

const SelfCustodialWallet: React.FC = () => {
  const { setSelfCustodialWallet, setWalletLoading } = useWalletSystem();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "swap" | "history" | "settings">("overview");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const [swapForm, setSwapForm] = useState({
    inputToken: "ETH",
    outputToken: "",
    inputAmount: "",
    slippage: 0.5
  });

  // Initialize or load wallet
  useEffect(() => {
    const loadWallet = () => {
      const savedWallet = localStorage.getItem("cypherx_wallet");
      if (savedWallet) {
        try {
          const wallet = JSON.parse(savedWallet);
          setWalletData(wallet);
          
          // Update global context so other components can access the wallet
          console.log("🔍 SelfCustodialWallet - Updating global context with wallet:", wallet.address);
          setSelfCustodialWallet({
            address: wallet.address,
            isConnected: true,
                    ethBalance: "",
        tokenBalance: ""
          });
          
          // Sync wallet address to user database record
          syncWalletAddressToDatabase(wallet.address);
          
          fetchWalletData(wallet.address);
        } catch (error) {
          console.error("Error loading wallet:", error);
          createNewWallet();
        }
        
        // Set loading to false regardless of whether wallet was found
        setWalletLoading(false);
      } else {
        createNewWallet();
      }
    };

    loadWallet();
  }, []); // Remove dependencies to prevent infinite loop

  const createNewWallet = useCallback(() => {
    try {
      const wallet = ethers.Wallet.createRandom();
      const walletData: WalletData = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        balance: { eth: "0", usd: 0 },
        tokens: [],
        transactions: [],
        isBackedUp: false
      };
      
      setWalletData(walletData);
      localStorage.setItem("cypherx_wallet", JSON.stringify(walletData));
      
      // Update global context so other components can access the wallet
      console.log("🔍 SelfCustodialWallet - Creating new wallet and updating global context:", wallet.address);
      setSelfCustodialWallet({
        address: wallet.address,
        isConnected: true,
        ethBalance: "",
        tokenBalance: ""
      });
      
      // Sync wallet address to user database record
      syncWalletAddressToDatabase(wallet.address);
      
      toast.success("New wallet created successfully!");
    } catch (error) {
      console.error("Error creating wallet:", error);
      toast.error("Failed to create wallet");
    } finally {
      setWalletLoading(false);
    }
  }, []); // Remove dependencies to prevent infinite loop

  // Function to sync wallet address to user database
  const syncWalletAddressToDatabase = async (walletAddress: string) => {
    try {
      // Get current user from auth context
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log("No authenticated user found for wallet sync");
        return;
      }

      // Use the new wallet linking API
      try {
        const response = await fetch('/api/wallet/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: walletAddress,
            userId: currentUser.uid
          })
        });

        if (response.ok) {
          console.log("✅ Wallet linked to user account:", walletAddress);
        } else {
          console.error("Failed to link wallet:", await response.text());
        }
      } catch (error) {
        console.error("Error linking wallet:", error);
        // Fallback to direct update if API fails
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, {
          walletAddress: walletAddress,
          lastUpdated: serverTimestamp()
        });
        console.log("✅ Wallet address synced to database (fallback):", walletAddress);
      }
    } catch (error) {
      console.error("Error syncing wallet address to database:", error);
    }
  };

  const fetchWalletData = useCallback(async (address: string) => {
    if (!address) return;
    
    setIsLoading(true);
    try {
      // Fetch ETH balance
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      const ethBalance = await provider.getBalance(address);
      const ethBalanceFormatted = ethers.formatEther(ethBalance);
      
      // Get ETH price for USD conversion
              const ethPriceResponse = await fetch("/api/price/eth");
      const ethPriceData = await ethPriceResponse.json();
      const ethPrice = ethPriceData.ethereum?.usd || 0;
      
      // Fetch token balances (you can expand this)
      const tokenBalances: TokenBalance[] = [];
      
      setWalletData(prev => prev ? {
        ...prev,
        balance: {
          eth: ethBalanceFormatted,
          usd: parseFloat(ethBalanceFormatted) * ethPrice
        },
        tokens: tokenBalances
      } : null);
      
      // Update global context with the fetched balance
      console.log("🔍 SelfCustodialWallet - Updating global context with fetched balance:", ethBalanceFormatted);
      setSelfCustodialWallet({
        address: address,
        isConnected: true,
        ethBalance: ethBalanceFormatted,
        tokenBalance: ""
      });
      
    } catch (error) {
      console.error("Error fetching wallet data:", error);
      toast.error("Failed to fetch wallet data");
    } finally {
      setIsLoading(false);
    }
  }, [setSelfCustodialWallet]);

  const getSwapQuote = useCallback(async () => {
    if (!swapForm.inputAmount || !swapForm.outputToken) return;
    
    try {
      const response = await fetch("/api/swap/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputToken: swapForm.inputToken,
          outputToken: swapForm.outputToken,
          inputAmount: swapForm.inputAmount,
          walletAddress: walletData?.address
        })
      });
      
      if (response.ok) {
        const quote = await response.json();
        setSwapQuote(quote);
      } else {
        toast.error("Failed to get quote");
      }
    } catch (error) {
      console.error("Error getting quote:", error);
      toast.error("Failed to get quote");
    }
  }, [swapForm, walletData?.address]);

  const executeSwap = useCallback(async () => {
    if (!swapQuote || !walletData) return;
    
    setIsLoading(true);
    try {
      const response = await fetch("/api/swap/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputToken: swapForm.inputToken,
          outputToken: swapForm.outputToken,
          inputAmount: swapForm.inputAmount,
          outputAmount: swapQuote.outputAmount,
          slippage: swapForm.slippage,
          walletAddress: walletData.address,
          privateKey: walletData.privateKey
        })
      });
      
      if (response.ok) {
        await response.json();
        toast.success("Swap executed successfully!");
        
        // Update wallet data
        fetchWalletData(walletData.address);
        setSwapQuote(null);
        setSwapForm({ inputToken: "ETH", outputToken: "", inputAmount: "", slippage: 0.5 });
      } else {
        const error = await response.json();
        toast.error(error.message || "Swap failed");
      }
    } catch (error) {
      console.error("Error executing swap:", error);
      toast.error("Swap failed");
    } finally {
      setIsLoading(false);
    }
  }, [swapQuote, walletData, swapForm, fetchWalletData]);

  const copyAddress = useCallback(() => {
    if (walletData?.address) {
      navigator.clipboard.writeText(walletData.address);
      toast.success("Address copied to clipboard!");
    }
  }, [walletData?.address]);

  const backupWallet = useCallback(() => {
    if (walletData) {
      const backupData = {
        address: walletData.address,
        privateKey: walletData.privateKey,
        backupDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cypherx-wallet-backup-${walletData.address.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      setWalletData(prev => prev ? { ...prev, isBackedUp: true } : null);
      toast.success("Wallet backed up successfully!");
    }
  }, [walletData]);

  if (!walletData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-blue-500/30 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
            <FaWallet className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-200">Wallet</h2>
            <p className="text-sm text-gray-400">Self-custodial trading wallet</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={copyAddress}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            title="Copy address"
          >
            <FaCopy className="w-4 h-4 text-gray-400" />
          </button>
                     <button
             onClick={() => {
               const explorerUrl = `/explorer/address/${walletData.address}`;
               window.open(explorerUrl, '_blank');
             }}
             className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
             title="View in Explorer"
           >
             <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
             </svg>
           </button>
          <button
            onClick={backupWallet}
            className="p-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg transition-colors border border-orange-500/30"
            title="Backup wallet"
          >
            <FaDownload className="w-4 h-4 text-orange-400" />
          </button>
        </div>
      </div>

      {/* Wallet Address */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">Wallet Address</p>
            <p className="text-sm font-mono text-gray-200">
              {walletData.address.slice(0, 6)}...{walletData.address.slice(-4)}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPrivateKey(!showPrivateKey)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              {showPrivateKey ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
            </button>
            <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
              <FaQrcode className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {showPrivateKey && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <p className="text-xs text-red-400 mb-2">⚠️ Keep this private key secure!</p>
            <p className="text-xs font-mono text-red-300 break-all">
              {walletData.privateKey}
            </p>
          </motion.div>
        )}
      </div>

      {/* Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
              <FaShieldAlt className="w-3 h-3 text-blue-400" />
            </div>
            <span className="text-sm text-gray-400">ETH Balance</span>
          </div>
          <p className="text-2xl font-bold text-gray-200">
            {parseFloat(walletData.balance.eth).toFixed(4)} ETH
          </p>
          <p className="text-sm text-gray-400">
            ≈ ${walletData.balance.usd.toFixed(2)} USD
          </p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
              <FaExchangeAlt className="w-3 h-3 text-green-400" />
            </div>
            <span className="text-sm text-gray-400">Total Value</span>
          </div>
          <p className="text-2xl font-bold text-gray-200">
            ${walletData.balance.usd.toFixed(2)}
          </p>
          <p className="text-sm text-gray-400">
            {walletData.tokens.length} tokens
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 mb-6">
        {[
          { id: "overview", label: "Overview", icon: FaWallet },
          { id: "swap", label: "Swap", icon: FaExchangeAlt },
          { id: "history", label: "History", icon: FaHistory },
          { id: "settings", label: "Settings", icon: FaShieldAlt }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'overview' | 'swap' | 'history' | 'settings')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">Token Balances</h3>
              {walletData.tokens.length > 0 ? (
                <div className="space-y-3">
                  {walletData.tokens.map((token) => (
                    <div key={token.address} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                          {token.logo ? (
                            <img src={token.logo} alt={token.symbol} className="w-6 h-6 rounded-full" />
                          ) : (
                            <span className="text-xs font-bold text-gray-400">{token.symbol[0]}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-200">{token.symbol}</p>
                          <p className="text-sm text-gray-400">{token.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-200">{token.balance}</p>
                        <p className="text-sm text-gray-400">${token.usdValue.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FaWallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No tokens found</p>
                  <p className="text-sm text-gray-500">Deposit tokens to get started</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "swap" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">Swap Tokens</h3>
              
              {/* Swap Form */}
              <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="block text-sm text-gray-400 mb-2">You Pay</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="number"
                      value={swapForm.inputAmount}
                      onChange={(e) => setSwapForm(prev => ({ ...prev, inputAmount: e.target.value }))}
                      placeholder=""
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <select
                      value={swapForm.inputToken}
                      onChange={(e) => setSwapForm(prev => ({ ...prev, inputToken: e.target.value }))}
                      className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ETH">ETH</option>
                      {/* Add more tokens */}
                    </select>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
                    <FaExchangeAlt className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="block text-sm text-gray-400 mb-2">You Receive</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={swapQuote?.outputAmount || ""}
                      placeholder=""
                      readOnly
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <select
                      value={swapForm.outputToken}
                      onChange={(e) => setSwapForm(prev => ({ ...prev, outputToken: e.target.value }))}
                      className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Select token</option>
                      {/* Add token options */}
                    </select>
                  </div>
                </div>

                {/* Quote Details */}
                {swapQuote && (
                  <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Price Impact:</span>
                      <span className="text-gray-200">{swapQuote.priceImpact.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Gas Estimate:</span>
                      <span className="text-gray-200">{swapQuote.gasEstimate} ETH</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Route:</span>
                      <span className="text-gray-200">{swapQuote.route.join(" → ")}</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={getSwapQuote}
                    disabled={!swapForm.inputAmount || !swapForm.outputToken || isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    {isLoading ? "Getting Quote..." : "Get Quote"}
                  </button>
                  
                  {swapQuote && (
                    <button
                      onClick={executeSwap}
                      disabled={isLoading}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
                    >
                      {isLoading ? "Executing..." : "Execute Swap"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">Transaction History</h3>
              {walletData.transactions.length > 0 ? (
                <div className="space-y-3">
                  {walletData.transactions.map((tx) => (
                    <div key={tx.hash} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.type === "swap" ? "bg-blue-500/20" :
                          tx.type === "deposit" ? "bg-green-500/20" :
                          "bg-gray-500/20"
                        }`}>
                          {tx.type === "swap" ? <FaExchangeAlt className="w-4 h-4 text-blue-400" /> :
                           tx.type === "deposit" ? <FaDownload className="w-4 h-4 text-green-400" /> :
                           <FaUpload className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-200 capitalize">{tx.type}</p>
                          <p className="text-sm text-gray-400">
                            {new Date(tx.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-200">{tx.amount} {tx.token}</p>
                        <p className="text-sm text-gray-400">${tx.usdValue.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FaHistory className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No transactions yet</p>
                  <p className="text-sm text-gray-500">Your trading history will appear here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">Wallet Settings</h3>
              
              <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="font-medium text-gray-200 mb-3">Security</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Wallet Backup</span>
                      <span className={`text-sm ${walletData.isBackedUp ? "text-green-400" : "text-red-400"}`}>
                        {walletData.isBackedUp ? "Backed up" : "Not backed up"}
                      </span>
                    </div>
                    <button
                      onClick={backupWallet}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium transition-colors"
                    >
                      Backup Wallet
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="font-medium text-gray-200 mb-3">Network</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Current Network</span>
                    <span className="text-sm text-blue-400">Base Chain</span>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="font-medium text-gray-200 mb-3">Danger Zone</h4>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this wallet? This action cannot be undone.")) {
                        localStorage.removeItem("cypherx_wallet");
                        window.location.reload();
                      }
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors"
                  >
                    Delete Wallet
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SelfCustodialWallet;
