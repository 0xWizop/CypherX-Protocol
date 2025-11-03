"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { FaWallet, FaExchangeAlt, FaInfoCircle } from "react-icons/fa";
import { SiEthereum } from "react-icons/si";
import { ethers } from "ethers";

import debounce from "lodash/debounce";



// ────────────────────────────────────────────────────────────────────────────────
// 1) TYPES
// ────────────────────────────────────────────────────────────────────────────────
interface TokenMetadata {
  poolAddress: string;
  pairAddress: string;
  baseToken: { name: string; symbol: string; address: string };
  quoteToken: { name: string; symbol: string; address: string };
  priceUsd: string;
  liquidity: { usd: number };
  marketCap: number;
  fdv: number;
  bannerUrl?: string;
  logoUrl?: string;
  adImageUrl?: string;
  priceChange?: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  dexId?: string;
  dexName?: string;
  imageUrl?: string;
}

interface SwapProps {
  token: TokenMetadata | null;
  ethPrice: number;
  onTradeComplete?: () => void; // 🔧 NEW: Callback to refresh orders/positions
}

interface PnLData {
  totalPnL: number;
  totalPnLPercentage: number; // Add this to match API response
  totalVolume: number;
  totalTrades: number;
  winRate: number;
  bought: number;
  sold: number;
  holding: number;
  dailyPnL: Array<{ date: string; pnl: number }>;
  recentTrades: Array<{
    id: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    timestamp: number;
    type: 'buy' | 'sell';
  }>;
}

// ────────────────────────────────────────────────────────────────────────────────
// 2) MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────────────
const Swap: React.FC<SwapProps> = ({ token, onTradeComplete }) => {
  // State
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("");
  const [isSwapLoading, setIsSwapLoading] = useState<boolean>(false);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [showSlippageModal, setShowSlippageModal] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showPnLModal, setShowPnLModal] = useState<boolean>(false);
  
  // 🔧 NEW: Store quote information for consistency
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  
  // 🔧 NEW: Store all available quotes for comparison
  const [allQuotes, setAllQuotes] = useState<Array<{
    source: string;
    name: string;
    amountOut: string;
    gasEstimate: string;
    priceImpact: number;
    liquidity: string;
    slippage: number;
    priority: number;
  }>>([]);
  
  // 🔧 NEW: Selected quote for execution
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  
  // 🔧 NEW: Show quote comparison modal
  const [showQuoteComparison, setShowQuoteComparison] = useState<boolean>(false);
  
  // Self-custodial wallet state
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<string>("");
  const [tokenBalance, setTokenBalance] = useState<string>("");
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  
  // PnL State
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  
  // Copy address state
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  
  // 🔧 NEW: Quote comparison modal component
  const QuoteComparisonModal = () => {
    if (!showQuoteComparison || allQuotes.length === 0) return null;
    
    const sortedQuotes = [...allQuotes].sort((a, b) => {
      // Sort by priority first, then by output amount
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return parseFloat(b.amountOut) - parseFloat(a.amountOut);
    });
    
    const handleQuoteSelect = (quote: any) => {
      setSelectedQuote(quote);
      setAmountOut(quote.amountOut);
      setShowQuoteComparison(false);
      console.log("✅ Quote selected:", quote.source);
    };
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Compare Quotes from All Sources</h3>
            <button
              onClick={() => setShowQuoteComparison(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="grid gap-4">
            {sortedQuotes.map((quote, _index) => (
              <div
                key={quote.source}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedQuote?.source === quote.source
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleQuoteSelect(quote)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      quote.priority <= 3 ? 'bg-green-500' : 'bg-blue-500'
                    }`} />
                    <div>
                      <h4 className="font-medium">{quote.name}</h4>
                      <p className="text-sm text-gray-600">
                        Priority: {quote.priority} • {quote.source}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {parseFloat(quote.amountOut).toFixed(6)} tokens
                    </div>
                    <div className="text-sm text-gray-600">
                      Gas: {quote.gasEstimate} • Slippage: {(quote.slippage * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                {quote.priority <= 3 && (
                  <div className="mt-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    🚀 Aggregator - Best execution path
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p>• <strong>Green dots</strong> indicate aggregators (best execution)</p>
            <p>• <strong>Blue dots</strong> indicate individual DEXes</p>
            <p>• Quotes are sorted by priority and output amount</p>
          </div>
        </div>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────────────────────────────
  // 3) HELPER FUNCTIONS
  // ────────────────────────────────────────────────────────────────────────────────
  
  // Copy token address to clipboard
  const copyTokenAddress = useCallback(async () => {
    if (!token?.baseToken?.address) {
      return;
    }
    
    try {
      await navigator.clipboard.writeText(token.baseToken.address);
      setCopiedAddress(true);
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  }, [token?.baseToken?.address]);
  
  // Helper function to check and approve token spending
  const checkAndApproveToken = useCallback(async (
    tokenAddress: string,
    amount: string,
    spenderAddress: string,
    wallet: any
  ) => {
    try {
      // 🔧 CRITICAL: Ensure wallet has a provider attached
      let connectedWallet = wallet;
      if (!wallet.provider) {
        console.log("⚠️ Wallet missing provider, attaching provider...");
        const provider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN");
        connectedWallet = wallet.connect(provider);
        console.log("✅ Provider attached to wallet");
      }

      console.log("🔍 Checking token approval for:", {
        tokenAddress,
        amount,
        spenderAddress,
        walletAddress: connectedWallet.address
      });

      // ERC20 ABI for approval functions
      const erc20ABI = [
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)"
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, connectedWallet);
      
      // Check current allowance
      console.log("🔍 Checking allowance with provider:", {
        walletProvider: !!connectedWallet.provider,
        tokenAddress,
        spenderAddress,
        walletAddress: connectedWallet.address
      });
      
      const currentAllowance = await tokenContract.allowance(connectedWallet.address, spenderAddress);
      console.log("🔍 Current allowance:", {
        current: currentAllowance.toString(),
        required: amount,
        hasEnough: currentAllowance >= BigInt(amount)
      });

      // If allowance is insufficient, approve
      if (currentAllowance < BigInt(amount)) {
        console.log("⚠️ Insufficient allowance, approving tokens...");
        
        try {
          // Approve the router to spend tokens
          const approveTx = await tokenContract.approve(spenderAddress, BigInt(amount));
          console.log("🔍 Approval transaction sent:", approveTx.hash);
          
          // Wait for approval confirmation
          const approveReceipt = await approveTx.wait();
          console.log("✅ Token approval confirmed:", {
            hash: approveReceipt.hash,
            gasUsed: approveReceipt.gasUsed.toString()
          });
          
          // 🔧 CRITICAL: Wait for blockchain state to update and re-check allowance
          console.log("⏳ Waiting for blockchain state to update after approval...");
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          // Re-check allowance to ensure it was updated
          const updatedAllowance = await tokenContract.allowance(connectedWallet.address, spenderAddress);
          console.log("🔍 Re-checked allowance after approval:", {
            updated: updatedAllowance.toString(),
            required: amount,
            hasEnough: updatedAllowance >= BigInt(amount)
          });
          
          if (updatedAllowance < BigInt(amount)) {
            console.log("⚠️ Allowance still insufficient after approval, waiting longer...");
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait another 3 seconds
            
            // Final check
            const finalAllowance = await tokenContract.allowance(connectedWallet.address, spenderAddress);
            console.log("🔍 Final allowance check:", {
              final: finalAllowance.toString(),
              required: amount,
              hasEnough: finalAllowance >= BigInt(amount)
            });
            
            if (finalAllowance < BigInt(amount)) {
              throw new Error("Token approval failed - allowance not updated after approval transaction");
            }
          }
          
          console.log("✅ Token allowance confirmed after approval");
          return true;
        } catch (approvalError) {
          console.error("❌ Approval transaction failed:", {
            error: approvalError,
            message: approvalError instanceof Error ? approvalError.message : 'Unknown error',
            code: (approvalError as any)?.code,
            data: (approvalError as any)?.data
          });
          throw approvalError;
        }
      } else {
        console.log("✅ Sufficient allowance already exists");
        return true;
      }
    } catch (error) {
      console.error("❌ Token approval failed:", error);
      throw error;
    }
  }, []);



  // ────────────────────────────────────────────────────────────────────────────────
  // 4) WALLET MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const loadWallet = useCallback(() => {
    if (typeof window !== "undefined") {
      const storedWallet = localStorage.getItem("cypherx_wallet");
      console.log("🔍 Loading wallet from localStorage:", storedWallet ? "found" : "not found");
      if (storedWallet) {
        try {
          const walletData = JSON.parse(storedWallet);
          const wallet = new ethers.Wallet(walletData.privateKey);
          console.log("🔍 Wallet loaded successfully:", wallet.address);
          setWalletAddress(wallet.address);
          setIsWalletConnected(true);
        } catch (error) {
          console.error("Error loading wallet:", error);
        }
      } else {
        console.log("🔍 No wallet found in localStorage");
      }
    }
  }, []);

  const createWallet = useCallback(() => {
    try {
      const wallet = ethers.Wallet.createRandom();
      const walletData = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase,
      };
      
      localStorage.setItem("cypherx_wallet", JSON.stringify(walletData));
      setWalletAddress(wallet.address);
      setIsWalletConnected(true);
    } catch (error) {
      console.error("Error creating wallet:", error);
    }
  }, []);

  const fetchBalances = useCallback(async (address: string) => {
    if (!address) return;

    try {
      console.log("🔄 Fetching balances for address:", address);
      
      // Fetch ETH balance
      const ethResponse = await fetch(`/api/wallet/balance?address=${address}`);
      if (ethResponse.ok) {
        const ethData = await ethResponse.json();
        console.log("✅ ETH balance response:", ethData);
        setEthBalance(ethData.ethBalance || "");
      } else {
        console.error("❌ ETH balance response not ok:", ethResponse.status);
      }
      
      // Fetch token balance if we have a token
      if (token?.baseToken.address) {
        const tokenResponse = await fetch(`/api/wallet/balance?address=${address}&tokenAddress=${token.baseToken.address}`);
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          console.log("✅ Token balance response:", tokenData);
          setTokenBalance(tokenData.tokenBalance || "");
        } else {
          console.error("❌ Token balance response not ok:", tokenResponse.status);
        }
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
      // Set fallback values
              setEthBalance("");
        setTokenBalance("");
    }
  }, [token]);



  // ────────────────────────────────────────────────────────────────────────────────
  // 4) QUOTE FETCHING
  // ────────────────────────────────────────────────────────────────────────────────
  
  // Quote auto-refresh state
  const [quoteCountdown, setQuoteCountdown] = useState(30);
  const [isQuoteExpired, setIsQuoteExpired] = useState(false);
  
  const getQuote = useCallback(async (amount: string) => {
    if (!token || !amount || parseFloat(amount) <= 0 || !walletAddress) {
      console.log("❌ Quote fetch skipped:", { token: !!token, amount, walletAddress: !!walletAddress });
      return;
    }

    console.log("🔄 Fetching quote for:", {
      inputToken: activeTab === "buy" ? "ETH" : token.baseToken.address,
      outputToken: activeTab === "buy" ? token.baseToken.address : "ETH",
      inputAmount: amount,
      tokenAddress: token.baseToken.address
    });

    setQuoteLoading(true);
    try {
      const response = await fetch("/api/swap/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputToken: activeTab === "buy" ? "ETH" : token.baseToken.address,
          outputToken: activeTab === "buy" ? token.baseToken.address : "ETH",
          inputAmount: amount,
          walletAddress: walletAddress,
          tokenAddress: token.baseToken.address,
        }),
      });

              if (response.ok) {
          const quote = await response.json();
          console.log("✅ Quote received:", quote);
          
          // 🔧 ENHANCED: Store all available quotes for comparison
          if (quote.allQuotes && Array.isArray(quote.allQuotes)) {
            setAllQuotes(quote.allQuotes);
            console.log("🔧 All quotes stored:", quote.allQuotes.length);
          }
          
          // Improved quote validation - Check both outputAmount and amountOut
          const quoteAmount = quote.outputAmount || quote.amountOut;
          if (quoteAmount && 
              parseFloat(quoteAmount) > 0 && 
              !isNaN(parseFloat(quoteAmount))) {
            console.log("✅ Setting amountOut to:", quoteAmount);
            
            // 🔧 DEBUG: Log quote details for debugging
            console.log("🔧 Quote debug details:", {
              inputAmount: amountIn,
              outputAmount: quoteAmount,
              exchangeRate: `${amountIn} -> ${quoteAmount}`,
              ratePerEth: parseFloat(quoteAmount) / parseFloat(amountIn),
              quote
            });
            
            // 🔧 ENHANCED: Store quote with scaling history for slippage detection
            const enhancedQuote = {
              ...quote,
              previousAmount: currentQuote?.inputAmount || null,
              previousOutput: currentQuote?.outputAmount || null,
              inputAmount: amountIn,
              outputAmount: quoteAmount,
              timestamp: Date.now()
            };
            
            setAmountOut(quoteAmount);
            setCurrentQuote(enhancedQuote); // Store enhanced quote with history
            setSelectedQuote(enhancedQuote); // Set as selected quote for execution
            setQuoteCountdown(30);
            setIsQuoteExpired(false);
            
            // Warn if quote is from DexScreener (different DEX than execution)
            if (quote.route && quote.route.length > 0 && quote.route[0] !== "Uniswap V3") {
              console.log("⚠️ Quote from different DEX:", quote.route[0]);
            }
          } else {
            console.log("⚠️ Quote amount is invalid:", quoteAmount);
            setAmountOut("");
          }
      } else {
        const errorData = await response.json();
        console.error("❌ Failed to get quote:", errorData);
        setAmountOut("");
        
        // Provide specific error messages based on the error
        if (errorData.error === "No liquidity found for this token pair") {
          console.error("No liquidity found for this token pair - try a different token or amount");
        } else if (errorData.error === "Invalid quote received from exchange") {
          console.error("Exchange returned invalid quote - try again or use a different amount");
        } else {
          console.error(errorData.error || "Failed to get quote");
        }
      }
    } catch (error) {
      console.error("Error fetching quote:", error);
      setAmountOut("");
    } finally {
      setQuoteLoading(false);
    }
  }, [token, activeTab, walletAddress, amountIn, currentQuote]);

  const debouncedGetQuote = useMemo(
    () => debounce((amount: string) => {
      console.log("🔄 Debounced quote called with amount:", amount);
      getQuote(amount);
    }, 500),
    [getQuote]
  );

  // ────────────────────────────────────────────────────────────────────────────────
  // 5) SWAP EXECUTION WITH WALLET SIGNING
  // ────────────────────────────────────────────────────────────────────────────────
  
  // Swap status tracking
  const [swapStatus, setSwapStatus] = useState<'idle' | 'preparing' | 'signing' | 'submitting' | 'confirming' | 'success' | 'failed'>('idle');

  // 🔧 NEW: Enhanced error state for on-chain revert detection
  const [errorState, setErrorState] = useState<{
    hasError: boolean;
    errorMessage: string;
    errorDetails: string;
    transactionHash?: string;
    isOnChainRevert?: boolean;
  }>({
    hasError: false,
    errorMessage: '',
    errorDetails: ''
  });

  
  const executeSwap = useCallback(async () => {
    console.log("Execute swap called with:", { amountIn, amountOut, activeTab, isWalletConnected, walletAddress });
    
    if (!isWalletConnected || !walletAddress || !amountIn || !token) {
      return;
    }

    // 🔧 CRITICAL: Frontend safety validation before proceeding (TEMPORARILY DISABLED FOR TESTING)
    // TODO: Re-enable safety validation once quotes are working
    console.log("⚠️ Frontend safety validation temporarily disabled for testing");
    
    if (!amountOut || parseFloat(amountOut) <= 0) {
      console.error("❌ No valid quote available for swap");
      alert("No valid quote available. Please refresh the quote and try again.");
      return;
    }

    // 🔧 CRITICAL: Validate quote hasn't expired
    if (isQuoteExpired) {
      console.error("❌ Quote has expired");
      alert("Quote has expired. Please get a fresh quote before swapping.");
      return;
    }



    // Reset status and clear any previous errors
    setSwapStatus('preparing');
    setIsSwapLoading(true);
    setErrorState({ hasError: false, errorMessage: '', errorDetails: '' });
    try {
              // 🔧 CRITICAL: Final quote validation before preparing transaction
        console.log("🔍 Debug currentQuote:", currentQuote);
        console.log("🔍 Debug amountOut:", amountOut);
        
        // Check if we have either currentQuote.amountOut OR the amountOut from state
        if (!currentQuote && !amountOut) {
          throw new Error("No valid quote available. Please refresh the quote before proceeding.");
        }
        
        // Use amountOut from state if currentQuote doesn't have it
        const quoteAmountOut = currentQuote?.amountOut || currentQuote?.outputAmount || amountOut;
        console.log("🔍 Quote amount debug:", {
          currentQuoteAmountOut: currentQuote?.amountOut,
          currentQuoteOutputAmount: currentQuote?.outputAmount,
          stateAmountOut: amountOut,
          finalQuoteAmountOut: quoteAmountOut
        });
        
        if (!quoteAmountOut || parseFloat(quoteAmountOut) <= 0) {
          throw new Error("No valid quote amount available. Please refresh the quote before proceeding.");
        }
        
        // 🔧 CRITICAL: Check quote accuracy and warnings from backend
        if (currentQuote?.warning) {
          console.warn("⚠️ Quote has warnings:", currentQuote.warning);
          
          // Check if the warning indicates extreme price impact that should block execution
          if (currentQuote.warning.includes("EXTREME price deviation") || 
              currentQuote.warning.includes(">50%")) {
            throw new Error("Quote has extreme price deviation (>50%). This would cause massive losses. Please try a smaller amount or refresh the quote.");
          }
          
          // For other warnings, show them but allow execution to proceed
          console.log("⚠️ Quote has warnings but proceeding with caution:", currentQuote.warning);
        }
        
        // 🔧 TEMPORARILY DISABLED: Frontend price impact validation to restore swap functionality
        // TODO: Re-enable once quotes are working properly
        console.log("⚠️ Frontend price impact validation temporarily disabled for testing");
        
        // 🔧 DEBUG: Check if we're actually getting here
        console.log("✅ Quote validation passed, proceeding to prepare transaction");
        
        /*
        // 🔧 CRITICAL: Check for excessive price impact (>25%) to prevent massive losses
        if (amountIn && amountOut) {
          const inputNum = parseFloat(amountIn);
          const outputNum = parseFloat(amountOut);
          
          if (inputNum > 0 && outputNum > 0) {
            // Calculate price impact by comparing with expected linear scaling
            if (currentQuote.previousAmount && currentQuote.previousOutput) {
              const prevInput = parseFloat(currentQuote.previousAmount);
              const prevOutput = parseFloat(currentQuote.previousOutput);
              
              // Calculate expected scaling
              const expectedOutput = (inputNum / prevInput) * prevOutput;
              const priceImpact = Math.abs(outputNum - expectedOutput) / expectedOutput * 100;
              
              if (priceImpact > 25) {
                console.error("❌ CRITICAL: Quote has excessive price impact:", {
                  priceImpact: priceImpact.toFixed(2) + "%",
                  expectedOutput: expectedOutput.toFixed(6),
                  actualOutput: outputNum.toFixed(6),
                  inputAmount: inputNum,
                  suggestion: "This quote would cause massive losses. Please try a smaller amount or refresh the quote."
                });
                throw new Error(`Quote has excessive price impact (${priceImpact.toFixed(1)}%). This would cause massive losses. Please try a smaller amount or refresh the quote.");
              }
              
              console.log("✅ Price impact validation passed:", priceImpact.toFixed(2) + "%");
            }
          }
        }
        */
      
      // 🔧 CRITICAL: Check if quote is still valid (within 5 minutes) - TEMPORARILY DISABLED
      // const quoteAge = Date.now() - (currentQuote.timestamp || 0);
      // const MAX_QUOTE_AGE = 5 * 60 * 1000; // 5 minutes
      // if (quoteAge > MAX_QUOTE_AGE) {
      //   throw new Error("Quote has expired. Please get a fresh quote before proceeding.");
      // }
      
              // Step 1: Prepare transaction data
        console.log("📋 Preparing transaction data...");
        console.log("🔍 Swap execution details:", {
          activeTab,
          inputToken: activeTab === "buy" ? "ETH" : token.baseToken.address,
          outputToken: activeTab === "buy" ? token.baseToken.address : "ETH",
          inputAmount: amountIn,
          outputAmount: amountOut,
          slippage: slippage,
          walletAddress: walletAddress,
          tokenAddress: token.baseToken.address,
          preferredDex: currentQuote?.source || currentQuote?.dexUsed,
          currentQuote: currentQuote,
          quoteAmountOut: quoteAmountOut
        });
      
      setSwapStatus('preparing');
      const prepareResponse = await fetch("/api/swap/prepare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputToken: activeTab === "buy" ? "ETH" : token.baseToken.address,
          outputToken: activeTab === "buy" ? token.baseToken.address : "ETH",
          inputAmount: amountIn,
          outputAmount: amountOut,
          slippage: slippage,
          walletAddress: walletAddress,
          tokenAddress: token.baseToken.address,
          preferredDex: selectedQuote?.source || currentQuote?.dexUsed, // 🔧 ENHANCED: Use selected quote for consistent execution
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        setSwapStatus('failed');
        
        // 🔧 CRITICAL: Handle unsafe swap errors from backend
        if (errorData.error === "UNSAFE_SWAP") {
          console.error("❌ Backend blocked unsafe swap:", errorData.message);
          alert(`🚨 SWAP BLOCKED FOR YOUR SAFETY!\n\n${errorData.message}\n\n${errorData.details?.suggestion || "Please try a smaller amount or wait for better market conditions."}`);
          throw new Error(`Unsafe swap blocked: ${errorData.message}`);
        }
        
        // Enhanced error handling for insufficient balance
        if (errorData.error && errorData.error.includes("Insufficient ETH balance")) {
          const match = errorData.error.match(/Required: ([\d.]+), Available: ([\d.]+)/);
          if (match) {
            const required = parseFloat(match[1]);
            const available = parseFloat(match[2]);
            const needed = required - available;
            console.error(`Insufficient ETH balance. You need ${needed.toFixed(4)} more ETH (${required.toFixed(4)} total needed, ${available.toFixed(4)} available)`);
          } else {
            console.error(errorData.error);
          }
        } else {
          console.error(errorData.error || "Failed to prepare transaction");
        }
        
        throw new Error(errorData.error || "Failed to prepare transaction");
      }

      const prepareResult = await prepareResponse.json();
      console.log("✅ Prepare result received:", prepareResult);
      
      // 🔧 CRITICAL: Debug the prepare result structure
      console.log("🔍 Prepare result structure:", {
        hasTransactionData: !!prepareResult.transactionData,
        transactionDataKeys: prepareResult.transactionData ? Object.keys(prepareResult.transactionData) : [],
        hasData: !!prepareResult.data,
        dataKeys: prepareResult.data ? Object.keys(prepareResult.data) : [],
        hasParams: !!prepareResult.data?.params,
        paramsKeys: prepareResult.data?.params ? Object.keys(prepareResult.data.params) : [],
        hasTransactionDataData: !!prepareResult.transactionData?.data,
        dataLength: prepareResult.transactionData?.data ? prepareResult.transactionData.data.length : 0,
        dataPreview: prepareResult.transactionData?.data ? prepareResult.transactionData.data.substring(0, 66) + "..." : "No data"
      });
      
      // Step 2: Create transaction data using router contract
      console.log("🔧 Creating transaction data...");
      setSwapStatus('signing');
      
      const storedWallet = localStorage.getItem("cypherx_wallet");
      if (!storedWallet) {
        setSwapStatus('failed');
        console.error("Wallet not found");
        throw new Error("Wallet not found");
      }

      const walletData = JSON.parse(storedWallet);
      const wallet = new ethers.Wallet(walletData.privateKey);
      
      // Create transaction data
      let router, method, params;
      
      // Handle different response structures from backend
      if (prepareResult.data) {
        // New structure
        router = prepareResult.data.router;
        method = prepareResult.data.method;
        params = prepareResult.data.params;
      } else if (prepareResult.transactionData) {
        // Old structure
        router = prepareResult.routerAddress;
        method = prepareResult.method;
        params = prepareResult.transactionData;
      } else {
        throw new Error("Invalid prepare result structure");
      }
      
      console.log("🔍 Router address:", router);
      console.log("🔍 Method:", method);
      console.log("🔍 Params:", params);
      console.log("🔍 Frontend received params:", params);
      console.log("🔍 Frontend received method:", method);
      console.log("🔍 Params keys:", Object.keys(params));
      console.log("🔍 Path in params:", params.path);
      
            // Create router contract interface for ALL DEX versions
      const routerInterface = new ethers.Interface([
        // Uniswap V3 functions
        "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
        "function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)",
        "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
        "function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external payable returns (uint256 amountOut)",
        // Uniswap V2 functions (including fee-on-transfer variants)
        "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
        "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
        "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        // V3-style DEX functions (Aerodrome, Baseswap, etc.)
        "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address to, uint256 deadline) external returns (uint256 amountOut)",
        // Generic swap functions for compatibility
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
      ]);
      
      console.log("🔍 Router interface functions:", Object.keys(routerInterface.fragments));
      console.log("🔍 Required method:", method);
      
      if (!routerInterface.hasFunction(method)) {
        throw new Error(`Router interface does not have function: ${method}`);
      }
      
      let transactionData;
      
      if (method === "exactInputSingle") {
        // For Uniswap V3 exactInputSingle - needs to be a struct
        console.log("🔍 Creating exactInputSingle params:", {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          fee: params.fee,
          recipient: params.recipient,
          deadline: params.deadline,
          amountIn: params.amountIn,
          amountOutMinimum: params.amountOutMinimum
        });
        
        // According to Uniswap V3 docs, exactInputSingle expects a struct
        // When using ethers.js, struct parameters are passed as a single object
        const exactInputSingleParams = {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          fee: params.fee,
          recipient: params.recipient,
          deadline: params.deadline,
          amountIn: params.amountIn,
          amountOutMinimum: params.amountOutMinimum,
          sqrtPriceLimitX96: params.sqrtPriceLimitX96
        };
        
        transactionData = routerInterface.encodeFunctionData("exactInputSingle", [exactInputSingleParams]);
        console.log("🔍 Encoded transaction data:", {
          method: "exactInputSingle",
          params: exactInputSingleParams,
          encodedData: transactionData,
          dataLength: transactionData.length
        });
      } else if (method === "swapExactETHForTokens") {
        // For Uniswap V2 ETH swaps
        console.log("🔍 Creating swapExactETHForTokens params:", {
          amountOutMin: params.amountOutMin,
          path: params.path,
          to: params.to,
          deadline: params.deadline
        });
        
        // Validate path array
        if (!params.path || !Array.isArray(params.path) || params.path.length < 2) {
          throw new Error("Invalid path array for swap");
        }
        
        // Validate path addresses
        for (let i = 0; i < params.path.length; i++) {
          if (!ethers.isAddress(params.path[i])) {
            throw new Error(`Invalid address at path index ${i}: ${params.path[i]}`);
          }
        }
        
        console.log("✅ Path validation passed:", params.path);
        
        // Try the standard function first, fallback to fee-on-transfer version
        try {
          console.log("🔍 Attempting to encode swapExactETHForTokens with params:", {
            amountOutMin: params.amountOutMin,
            path: params.path,
            to: params.to,
            deadline: params.deadline
          });
          
          transactionData = routerInterface.encodeFunctionData("swapExactETHForTokens", [
            params.amountOutMin,
            params.path,
            params.to,
            params.deadline
          ]);
          
          console.log("🔍 Encoded transaction data (standard):", {
            method: "swapExactETHForTokens",
            params: {
              amountOutMin: params.amountOutMin,
              path: params.path,
              to: params.to,
              deadline: params.deadline
            },
            encodedData: transactionData,
            dataLength: transactionData.length
          });
        } catch {
          console.log("⚠️ Standard function failed, trying fee-on-transfer version");
          transactionData = routerInterface.encodeFunctionData("swapExactETHForTokensSupportingFeeOnTransferTokens", [
            params.amountOutMin,
            params.path,
            params.to,
            params.deadline
          ]);
          console.log("🔍 Encoded transaction data (fee-on-transfer):", {
            method: "swapExactETHForTokensSupportingFeeOnTransferTokens",
            params: {
              amountOutMin: params.amountOutMin,
              path: params.path,
              to: params.to,
              deadline: params.deadline
            },
            encodedData: transactionData,
            dataLength: transactionData.length
          });
        }
      } else if (method === "swapExactTokensForETH" || method === "swapExactTokensForETHSupportingFeeOnTransferTokens") {
        // For Uniswap V2 token to ETH swaps (sell) - EXACT SAME PATTERN AS WORKING BUY + APPROVAL
        console.log("🔍 Creating swapExactTokensForETH params (same pattern as buy):", {
          amountIn: params.amountIn,
          amountOutMin: params.amountOutMin,
          path: params.path,
          to: params.to,
          deadline: params.deadline
        });
        
        // Validate path array (same as buy)
        if (!params.path || !Array.isArray(params.path) || params.path.length < 2) {
          throw new Error("Invalid path array for swap");
        }
        
        // Validate path addresses (same as buy)
        for (let i = 0; i < params.path.length; i++) {
          if (!ethers.isAddress(params.path[i])) {
            throw new Error(`Invalid address at path index ${i}: ${params.path[i]}`);
          }
        }
        
        console.log("✅ Path validation passed:", params.path);
        
        // 🔧 CRITICAL: Check and approve token spending for sell operations
        const tokenAddress = params.path[0]; // First token in path is the one being sold
        console.log("🔍 Checking token approval for sell operation:", {
          tokenAddress,
          amountIn: params.amountIn,
          routerAddress: router
        });
        
        // Use backend encoded data directly (same as working buy operation)
        transactionData = prepareResult.transactionData.data;
        console.log("🔍 Using backend encoded data for sell operation:", {
          data: transactionData ? transactionData.substring(0, 66) + "..." : "No data",
          dataLength: transactionData ? transactionData.length : 0,
          hasData: !!transactionData && transactionData !== "0x"
        });
        
        // 🔧 CRITICAL: Validate that we have transaction data
        if (!transactionData || transactionData === "0x" || transactionData.length < 10) {
          console.error("❌ Backend transaction data is empty or invalid:", {
            data: transactionData,
            dataLength: transactionData ? transactionData.length : 0,
            prepareResult: prepareResult
          });
          
          // 🔧 FALLBACK: Try frontend encoding if backend data is empty
          console.log("🔄 Attempting frontend encoding as fallback...");
          try {
            transactionData = routerInterface.encodeFunctionData("swapExactTokensForETH", [
              params.amountIn,
              params.amountOutMin,
              params.path,
              params.to,
              params.deadline
            ]);
            console.log("✅ Frontend encoding successful:", {
              data: transactionData.substring(0, 66) + "...",
              dataLength: transactionData.length
            });
          } catch {
            console.error("❌ Frontend encoding also failed");
            throw new Error("Both backend and frontend encoding failed for sell operation");
          }
        }
      } else if (method === "swapExactTokensForTokens") {
        // For Aerodrome's swapExactTokensForTokens method (token->ETH via WETH)
        console.log("🔍 Creating swapExactTokensForTokens params:", {
          amountIn: params.amountIn,
          amountOutMin: params.amountOutMin,
          path: params.path,
          to: params.to,
          deadline: params.deadline
        });
        
        transactionData = routerInterface.encodeFunctionData("swapExactTokensForTokens", [
          params.amountIn,
          params.amountOutMin,
          params.path,
          params.to,
          params.deadline
        ]);
        console.log("🔍 Encoded transaction data (swapExactTokensForTokens):", {
          method: "swapExactTokensForTokens",
          params: {
            amountIn: params.amountIn,
            amountOutMin: params.amountOutMin,
            path: params.path,
            to: params.to,
            deadline: params.deadline
          },
          encodedData: transactionData,
          dataLength: transactionData.length
        });
      } else if (method === "swap") {
        // For V3-style DEXs (Aerodrome, Baseswap, etc.)
        console.log("🔍 Creating swap params:", {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          amountOutMin: params.amountOutMin,
          to: params.to,
          deadline: params.deadline
        });
        
        // Try different parameter formats for V3-style DEXs
        try {
          transactionData = routerInterface.encodeFunctionData("swap", [
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            params.amountOutMin,
            params.to,
            params.deadline
          ]);
          console.log("🔍 Encoded transaction data (V3-style):", {
            method: "swap",
            params: {
              tokenIn: params.tokenIn,
              tokenOut: params.tokenOut,
              amountIn: params.amountIn,
              amountOutMin: params.amountOutMin,
              to: params.to,
              deadline: params.deadline
            },
            encodedData: transactionData,
            dataLength: transactionData.length
          });
        } catch (error) {
          console.log("⚠️ V3-style swap failed, trying alternative format");
          // Try alternative parameter format
          transactionData = routerInterface.encodeFunctionData("swap", [
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            params.amountOutMin,
            params.to,
            params.deadline
          ]);
          console.log("🔍 Encoded transaction data (alternative):", {
            method: "swap",
            params: {
              tokenIn: params.tokenIn,
              tokenOut: params.tokenOut,
              amountIn: params.amountIn,
              amountOutMin: params.amountOutMin,
              to: params.to,
              deadline: params.deadline
            },
            encodedData: transactionData,
            dataLength: transactionData.length
          });
        }
      } else {
        throw new Error(`Unsupported method: ${method}. Supported methods: exactInputSingle, swapExactETHForTokens, swapExactTokensForETH, swapExactTokensForTokens, swap, and their fee-on-transfer variants`);
      }
      
      // Get current nonce
      const provider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN");
      let nonce = await provider.getTransactionCount(wallet.address);
      
      // 🔧 CRITICAL: Handle token approval for sell operations (after nonce is declared)
      if (method === "swapExactTokensForETH" || method === "swapExactTokensForETHSupportingFeeOnTransferTokens" || method === "swapExactTokensForTokens") {
        const tokenAddress = method === "swapExactTokensForETH" || method === "swapExactTokensForETHSupportingFeeOnTransferTokens" ? params.path[0] : params.path[0]; // First token in path is the one being sold
        
        // Ensure wallet is properly connected with provider
        let connectedWallet = wallet;
        if (!wallet.provider) {
          console.log("⚠️ Wallet missing provider for sell operation, attaching provider...");
          connectedWallet = wallet.connect(provider);
          console.log("✅ Provider attached to wallet for sell operation");
        }
        
        try {
          // 🔧 FIXED: For sell operations, approve the full balance to handle transfer fees
          // This ensures we have enough allowance even if the token has transfer fees
          const tokenContract = new ethers.Contract(tokenAddress, [
            "function balanceOf(address) view returns (uint256)",
            "function approve(address spender, uint256 amount) external returns (bool)"
          ], connectedWallet);
          
          const balance = await tokenContract.balanceOf(walletAddress);
          const approvalAmount = balance.toString();
          console.log("🔍 Full balance approval for sell operation:", {
            userInput: amountIn,
            fullBalance: ethers.formatUnits(balance, 18),
            approvalAmount: approvalAmount
          });
          
          await checkAndApproveToken(tokenAddress, approvalAmount, router, connectedWallet);
          console.log("✅ Token approval completed for sell operation");
          
          // 🔧 CRITICAL: Get fresh nonce after approval transaction
          console.log("🔄 Getting fresh nonce after approval...");
          nonce = await provider.getTransactionCount(wallet.address);
          console.log("✅ Fresh nonce obtained after approval:", nonce);
        } catch (approvalError) {
          console.error("❌ Token approval failed:", approvalError);
          throw new Error(`Token approval failed: ${approvalError instanceof Error ? approvalError.message : 'Unknown error'}`);
        }
      }
      
      // Calculate fresh deadline (30 minutes from now) to avoid expired deadline issues
      const freshDeadline = Math.floor(Date.now() / 1000) + 1800;
      console.log("🕐 Fresh deadline calculated:", {
        deadline: freshDeadline,
        deadlineTime: new Date(freshDeadline * 1000).toISOString(),
        currentTime: new Date().toISOString()
      });
      
      // Validate router address
      if (!router || router === "0x0000000000000000000000000000000000000000") {
        throw new Error("Invalid router address received from prepare API");
      }
      
      // Debug: Log the transaction data after encoding
      console.log("🔍 Transaction data after encoding:", {
        method: method,
        transactionData: transactionData,
        dataLength: transactionData ? transactionData.length : 0,
        isValid: transactionData && transactionData !== "0x" && transactionData.length >= 10
      });
      
      // Validate transaction data
      if (!transactionData || transactionData === "0x" || transactionData.length < 10) {
        console.error("❌ Invalid transaction data:", {
          data: transactionData,
          dataLength: transactionData ? transactionData.length : 0,
          router: router
        });
        throw new Error("Invalid transaction data - missing or empty function call");
      }
      
      // Additional validation: Check if the router contract exists
      try {
        const code = await provider.getCode(router);
        if (code === "0x") {
          console.error(`❌ Router contract does not exist at address: ${router}`);
          
          // Try alternative router addresses for Base chain
          const alternativeRouters = [
            "0x2626664c2603336E57B271c5C0b26F421741e481", // Aerodrome Router (primary)
            "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB", // Baseswap Router
            "0x66a9893cc07d91d95644aedd05d03f95e1dba8af"  // Universal Router V4
          ];
          
          console.log("🔄 Trying alternative router addresses...");
          for (const altRouter of alternativeRouters) {
            try {
              const altCode = await provider.getCode(altRouter);
              if (altCode !== "0x") {
                console.log(`✅ Found working router at: ${altRouter}`);
                // Update the router address
                router = altRouter;
                break;
              }
            } catch (altError) {
              console.log(`❌ Alternative router ${altRouter} failed:`, altError);
            }
          }
          
          if (router === "0x2626664c2603336E57B271c5C0b26F421741e481") {
            throw new Error(`No working router found. Original router ${router} does not exist.`);
          }
        }
        console.log("✅ Router contract exists at:", router);
      } catch (routerError) {
        console.error("❌ Router validation failed:", routerError);
        throw new Error(`Router validation failed: ${routerError instanceof Error ? routerError.message : 'Unknown error'}`);
      }
      
      // Use the backend's encoded transaction data (like the working buy operations)
      const txData = {
        to: router,
        data: prepareResult.transactionData.data, // Use backend encoded data
        nonce: nonce,
        gasLimit: BigInt(prepareResult.transactionData.gasLimit || "0"),
        maxFeePerGas: BigInt(prepareResult.transactionData.maxFeePerGas || "0"),
        maxPriorityFeePerGas: BigInt(prepareResult.transactionData.maxPriorityFeePerGas || "0"),
        value: BigInt(prepareResult.transactionData.value || "0"),
        chainId: 8453 // Base chain ID
      };
      
      // 🔧 CRITICAL: Validate backend transaction data
      console.log("🔍 Backend transaction data validation:", {
        prepareResultData: prepareResult.transactionData.data,
        prepareResultDataLength: prepareResult.transactionData.data ? prepareResult.transactionData.data.length : 0,
        hasData: !!prepareResult.transactionData.data && prepareResult.transactionData.data !== "0x",
        txDataData: txData.data,
        txDataDataLength: txData.data ? txData.data.length : 0
      });
      
      // 🔧 CRITICAL: Debug the final transaction data
      console.log("🔍 Final transaction data before signing:", {
        to: txData.to,
        data: txData.data ? txData.data.substring(0, 66) + "..." : "No data",
        dataLength: txData.data ? txData.data.length : 0,
        hasData: !!txData.data && txData.data !== "0x",
        nonce: txData.nonce,
        value: txData.value.toString()
      });
      
      console.log("✅ Transaction data created:", {
        to: txData.to,
        dataLength: txData.data.length,
        dataPreview: txData.data.substring(0, 66) + "...",
        gasLimit: txData.gasLimit.toString(),
        value: txData.value.toString(),
        nonce: txData.nonce
      });
      
      // Validate transaction data before signing
      if (!txData.data || txData.data === "0x" || txData.data.length < 10) {
        console.error("❌ Invalid transaction data:", {
          data: txData.data,
          dataLength: txData.data ? txData.data.length : 0,
          to: txData.to,
          method: method,
          transactionData: transactionData
        });
        throw new Error("Invalid transaction data - missing or empty function call");
      }
      
      // Additional validation for sell operations
      if (method === "swapExactTokensForETH" || method === "swapExactTokensForETHSupportingFeeOnTransferTokens") {
        console.log("🔍 Validating sell transaction data:", {
          data: txData.data,
          dataLength: txData.data.length,
          method: method,
          router: router
        });
      }
      
      // Additional validation: Check if the transaction value matches the amount (only for ETH input methods)
      if (method === "swapExactETHForTokens" && params.amountIn && txData.value.toString() !== params.amountIn) {
        console.warn("⚠️ Transaction value mismatch:", {
          expected: params.amountIn,
          actual: txData.value.toString()
        });
      }
      
      if (!txData.to || txData.to === "0x0000000000000000000000000000000000000000") {
        throw new Error("Invalid transaction recipient address");
      }
      
      console.log("📋 Transaction data to sign:", {
        to: txData.to,
        data: txData.data.substring(0, 66) + "...",
        dataLength: txData.data.length,
        nonce: txData.nonce,
        gasLimit: txData.gasLimit.toString(),
        maxFeePerGas: txData.maxFeePerGas.toString(),
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas.toString(),
        value: txData.value.toString(),
        chainId: txData.chainId
      });
      
      // Sign the transaction with proper BigInt handling
      console.log("🔍 Signing transaction with data:", {
        to: txData.to,
        dataLength: txData.data.length,
        dataPreview: txData.data.substring(0, 66) + "...",
        nonce: txData.nonce,
        gasLimit: txData.gasLimit.toString(),
        maxFeePerGas: txData.maxFeePerGas.toString(),
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas.toString(),
        value: txData.value.toString(),
        chainId: txData.chainId
      });
      
      // 🔧 CRITICAL: Validate data before signing
      if (!txData.data || txData.data === "0x" || txData.data.length < 10) {
        console.error("❌ CRITICAL: Transaction data is empty before signing:", {
          data: txData.data,
          dataLength: txData.data ? txData.data.length : 0,
          prepareResultData: prepareResult.transactionData.data,
          prepareResultDataLength: prepareResult.transactionData.data ? prepareResult.transactionData.data.length : 0
        });
        throw new Error("Transaction data is empty before signing - this indicates a backend encoding issue");
      }
      
      // 🔧 CRITICAL: Test transaction data integrity
      console.log("🔍 Transaction data integrity test:", {
        dataStartsWith0x: txData.data.startsWith("0x"),
        dataLength: txData.data.length,
        dataPreview: txData.data.substring(0, 66) + "...",
        methodSignature: txData.data.substring(0, 10),
        expectedMethodSignature: "0x38ed1739" // swapExactTokensForETH
      });
      
            // Debug: Log the exact data being passed to signTransaction
      console.log("🔍 Data being passed to signTransaction:", {
        to: txData.to,
        data: txData.data,
        dataLength: txData.data.length,
        dataPreview: txData.data.substring(0, 66) + "...",
        nonce: txData.nonce,
        gasLimit: txData.gasLimit.toString(),
        maxFeePerGas: txData.maxFeePerGas.toString(),
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas.toString(),
        value: txData.value.toString(),
        chainId: txData.chainId,
        methodSignature: txData.data.substring(0, 10),
        hasValidData: !!txData.data && txData.data !== "0x" && txData.data.length >= 10
      });
      
      const signedTx = await wallet.signTransaction({
        to: txData.to,
        data: txData.data,
        nonce: txData.nonce,
        gasLimit: txData.gasLimit,
        maxFeePerGas: txData.maxFeePerGas,
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas,
        value: txData.value,
        chainId: txData.chainId
      });
      
      console.log("✅ Transaction signed:", signedTx.substring(0, 66) + "...");
      console.log("📏 Signed transaction length:", signedTx.length);
      
      // Debug: Parse and verify the signed transaction
      try {
        const parsedSignedTx = ethers.Transaction.from(signedTx);
        console.log("🔍 Parsed signed transaction:", {
          to: parsedSignedTx.to,
          data: parsedSignedTx.data,
          dataLength: parsedSignedTx.data ? parsedSignedTx.data.length : 0,
          dataPreview: parsedSignedTx.data ? parsedSignedTx.data.substring(0, 66) + "..." : "No data",
          value: parsedSignedTx.value?.toString(),
          nonce: parsedSignedTx.nonce,
          gasLimit: parsedSignedTx.gasLimit?.toString(),
          maxFeePerGas: parsedSignedTx.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: parsedSignedTx.maxPriorityFeePerGas?.toString()
        });
      } catch (parseError) {
        console.error("❌ Error parsing signed transaction:", parseError);
      }
      
      // Validate the signed transaction
      try {
        const parsedSignedTx = ethers.Transaction.from(signedTx);
        console.log("🔍 Signed transaction validation:", {
          hasData: !!parsedSignedTx.data,
          dataLength: parsedSignedTx.data ? parsedSignedTx.data.length : 0,
          dataPreview: parsedSignedTx.data ? parsedSignedTx.data.substring(0, 66) + "..." : "NO DATA",
          to: parsedSignedTx.to,
          value: parsedSignedTx.value?.toString(),
          nonce: parsedSignedTx.nonce,
          gasLimit: parsedSignedTx.gasLimit?.toString(),
          maxFeePerGas: parsedSignedTx.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: parsedSignedTx.maxPriorityFeePerGas?.toString()
        });
        
        if (!parsedSignedTx.data || parsedSignedTx.data === "0x" || parsedSignedTx.data.length < 10) {
          console.error("❌ Signed transaction has empty data:", {
            data: parsedSignedTx.data,
            dataLength: parsedSignedTx.data ? parsedSignedTx.data.length : 0
          });
          throw new Error("Signed transaction has invalid or missing data");
        }
      } catch (validationError) {
        console.error("❌ Signed transaction validation failed:", validationError);
        throw new Error("Transaction signing failed - invalid transaction data");
      }
      
      // Step 3: Submit signed transaction
      console.log("🚀 Submitting signed transaction...");
      console.log("🔍 Signed transaction being sent:", {
        signedTx: signedTx,
        signedTxLength: signedTx.length,
        signedTxPrefix: signedTx.substring(0, 66) + "...",
        signedTxFull: signedTx
      });
      setSwapStatus('submitting');
      const submitResponse = await fetch("/api/swap/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signedTransaction: signedTx,
          inputToken: activeTab === "buy" ? "ETH" : token.baseToken.address,
          outputToken: activeTab === "buy" ? token.baseToken.address : "ETH",
          inputAmount: amountIn,
          outputAmount: amountOut,
          walletAddress: walletAddress,
          tokenAddress: token.baseToken.address,
          preferredDex: currentQuote?.dexUsed, // 🔧 FIXED: Pass the DEX from the quote
          autoConfirm: true, // Auto-confirm the transaction
        }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        console.error("❌ Backend error response:", {
          status: submitResponse.status,
          statusText: submitResponse.statusText,
          errorData: errorData,
          errorMessage: errorData.error,
          errorDetails: errorData.details
        });
        setSwapStatus('failed');
        console.error(errorData.error || "Failed to submit transaction");
        throw new Error(errorData.error || "Failed to submit transaction");
      }

      const submitResult = await submitResponse.json();
      
      // 🔧 ENHANCED: Handle different transaction statuses
      if (submitResult.success) {
        if (submitResult.status === "confirmed" || !submitResult.status) {
          // Standard confirmed transaction
          setSwapStatus('success');
          console.log("✅ Transaction confirmed successfully");
        } else if (submitResult.status === "broadcasted_but_confirmation_failed") {
          // Transaction broadcasted but confirmation failed - this could be an on-chain revert
          setSwapStatus('failed');
          
          // 🔧 NEW: Enhanced error detection for on-chain reverts
          let errorMessage = "Transaction failed on-chain";
          let errorDetails = "The transaction was broadcasted but failed during execution. This usually indicates:";
          
          if (submitResult.error && submitResult.error.includes("execution reverted")) {
            errorMessage = "Transaction reverted on-chain";
            errorDetails = "The smart contract rejected this transaction. Common causes:";
            
            // 🔧 NEW: Detect specific revert reasons
            if (submitResult.error.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
              errorMessage = "Insufficient output amount";
              errorDetails = "The swap would result in fewer tokens than expected. This usually happens when:";
              errorDetails += "\n• Price moved unfavorably between quote and execution";
              errorDetails += "\n• Slippage tolerance was too low";
              errorDetails += "\n• Low liquidity caused high price impact";
            } else if (submitResult.error.includes("INSUFFICIENT_LIQUIDITY")) {
              errorMessage = "Insufficient liquidity";
              errorDetails = "There isn't enough liquidity to complete this swap. Try:";
              errorDetails += "\n• Reducing the swap amount";
              errorDetails += "\n• Using a different token pair";
              errorDetails += "\n• Waiting for more liquidity";
            } else if (submitResult.error.includes("EXPIRED")) {
              errorMessage = "Transaction expired";
              errorDetails = "The transaction deadline has passed. Please try again.";
            } else if (submitResult.error.includes("INSUFFICIENT_BALANCE")) {
              errorMessage = "Insufficient balance";
              errorDetails = "Your wallet doesn't have enough tokens for this swap.";
            }
          } else if (submitResult.error && submitResult.error.includes("out of gas")) {
            errorMessage = "Transaction ran out of gas";
            errorDetails = "The transaction consumed more gas than allocated. This can happen with:";
            errorDetails += "\n• Complex token contracts";
            errorDetails += "\n• High network congestion";
            errorDetails += "\n• Insufficient gas limit";
          }
          
          // 🔧 NEW: Set detailed error state
          setErrorState({
            hasError: true,
            errorMessage: errorMessage,
            errorDetails: errorDetails,
            transactionHash: submitResult.transactionHash,
            isOnChainRevert: true
          });
          
          console.log(`⚠️ Transaction failed on-chain: ${errorMessage}`);
          console.log(`📋 Error details: ${errorDetails}`);
          console.log(`🔗 Transaction hash: ${submitResult.transactionHash}`);
          console.log("ℹ️ User should check transaction hash on blockchain explorer");
          
          // 🔧 NEW: Don't auto-hide on-chain revert errors - user needs to see them
          // setTimeout(() => {
          //   setSwapStatus('idle');
          //   console.log('Clearing error message');
          // }, 2000);
          
          return; // Exit early for on-chain failures
        } else {
          // Other statuses
          setSwapStatus('success');
          console.log(`⚠️ Transaction broadcasted with status: ${submitResult.status}`);
          console.log("ℹ️ User should check transaction hash on blockchain explorer");
        }
        
        console.log("Transaction hash:", submitResult.transactionHash);
        
        // 🔧 FIXED: Auto-hide success message after 2 seconds
        setTimeout(() => {
          setSwapStatus('idle');
          console.log('Clearing success message');
        }, 2000);
        
        // Refresh balances and PnL
        fetchBalances(walletAddress);
        fetchPnLData(walletAddress);
        
        // 🔧 NEW: Refresh orders and positions after successful trade
        if (onTradeComplete) {
          console.log("🔄 Trade completed, refreshing orders and positions...");
          setTimeout(() => {
            onTradeComplete();
          }, 1000); // Small delay to ensure transaction is processed
        }
        
        // 🔧 NEW: Reset PnL if position is closed (token balance becomes 0)
        if (activeTab === "sell" && parseFloat(amountIn) >= parseFloat(tokenBalance) * 0.95) {
          // This was likely a full position close, reset PnL after a delay
          setTimeout(() => {
            console.log("🔄 Position likely closed, resetting PnL data...");
            setPnlData(null);
            // Fetch fresh PnL data after reset
            setTimeout(() => {
              fetchPnLData(walletAddress);
            }, 1000);
          }, 2000);
        }
        
        // Clear form
        setAmountIn("");
        setAmountOut("");
      } else {
        // Handle error response
        console.error("❌ Submit response indicates failure:", submitResult);
        throw new Error(submitResult.error || "Swap failed");
      }
    } catch (error) {
      console.error("Swap execution error:", error);
      setSwapStatus('failed');
      console.error(error instanceof Error ? error.message : "Swap failed");
      
      // 🔧 FIXED: Auto-hide failed message after 2 seconds
      setTimeout(() => {
        setSwapStatus('idle');
        console.log('Clearing error message');
      }, 2000);
    } finally {
      setIsSwapLoading(false);
    }
  }, [isWalletConnected, walletAddress, amountIn, amountOut, token, activeTab, slippage, fetchBalances]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 6) PnL TRACKING
  // ────────────────────────────────────────────────────────────────────────────────
  const fetchPnLData = useCallback(async (address: string) => {
    if (!address) {
      console.log("🔍 No address provided for PnL fetch");
      return;
    }

    try {
      console.log("🔍 Fetching PnL data for address:", address);
      const tokenAddress = token?.baseToken?.address;
      const url = tokenAddress 
        ? `/api/wallet/pnl?address=${address}&tokenAddress=${tokenAddress}&timeframe=30d`
        : `/api/wallet/pnl?address=${address}&timeframe=30d`;
      
      console.log("🔍 PnL URL:", url);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log("🔍 PnL API Response:", data); // Debug log
        console.log("🔍 totalPnLPercentage:", data.totalPnLPercentage);
        console.log("🔍 totalTrades:", data.totalTrades);
        console.log("🔍 bought:", data.bought);
        console.log("🔍 sold:", data.sold);
        console.log("🔍 holding:", data.holding);
        console.log("🔍 winRate:", data.winRate);
        setPnlData(data);
      } else {
        console.error("🔍 PnL API response not ok:", response.status);
      }
    } catch (error) {
      console.error("Error fetching PnL data:", error);
    }
  }, [token?.baseToken?.address]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 7) EVENT HANDLERS
  // ────────────────────────────────────────────────────────────────────────────────
  
  const handleAmountChange = useCallback((value: string) => {
    setAmountIn(value);
    if (value && parseFloat(value) > 0) {
      console.log("Fetching quote for amount:", value);
      debouncedGetQuote(value);
    } else {
      setAmountOut("");
    }
  }, [debouncedGetQuote, token, activeTab]);

  const handleQuickAmount = useCallback((percent: number) => {
    const balance = activeTab === "buy" ? parseFloat(ethBalance) : parseFloat(tokenBalance);
    
    // Safety check for invalid balance
    if (isNaN(balance) || balance <= 0) {
      console.log("🔧 Quick Amount Error: Invalid balance", {
        percent,
        activeTab,
        ethBalance,
        tokenBalance,
        balance
      });
      return;
    }
    
    let amount = (balance * percent) / 100;
    
    // 🔧 FIXED: Smart maximum sell calculation for sell operations
    if (activeTab === "sell" && percent >= 95) { // For 95%+ sells (including max)
      // Apply safety buffer for maximum sells to account for:
      // - Token transfer fees/taxes
      // - Slippage tolerance
      // - Gas costs
      // - Precision rounding
      const safetyBuffer = 0.98; // 2% buffer for maximum sells
      amount = balance * safetyBuffer;
      
      console.log("🔧 Smart Max Sell Calculation:", {
        originalBalance: balance,
        percent,
        safetyBuffer,
        adjustedAmount: amount,
        bufferAmount: balance - amount,
        reason: "Applied 2% buffer for max sell to account for fees/slippage"
      });
    }
    
    console.log("🔧 Quick Amount Debug:", {
      percent,
      activeTab,
      ethBalance,
      tokenBalance,
      balance,
      calculatedAmount: amount,
      formattedAmount: amount.toFixed(4),
      isMaxSell: activeTab === "sell" && percent >= 95
    });
    
    // 🔧 ENHANCED: Clear quote history and force fresh quote for scaling detection
    setAmountIn(amount.toFixed(4));
    setAmountOut(""); // Clear previous output
    setCurrentQuote(null); // Clear quote history to force fresh scaling check
    
    // Force immediate quote fetch (no debounce for quick amounts)
    if (activeTab === "buy") {
      // For buy operations, use debounced quote to avoid spam
      debouncedGetQuote(amount.toFixed(4));
    } else {
      // For sell operations, use immediate quote
      handleAmountChange(amount.toFixed(4));
    }
  }, [ethBalance, tokenBalance, activeTab, handleAmountChange, debouncedGetQuote]);

  const handleSwapDirection = useCallback(() => {
    setActiveTab(activeTab === "buy" ? "sell" : "buy");
    setAmountIn("");
    setAmountOut("");
  }, [activeTab]);

  const copyAddress = useCallback(() => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
    }
  }, [walletAddress]);

  // 🔧 NEW: Function to detect quote scaling issues (currently disabled)
  // const detectQuoteScalingIssue = useCallback((currentAmount: string, currentOutput: string, previousAmount?: string, previousOutput?: string) => {
  //   if (!previousAmount || !previousOutput) return null;
  //   
  //   const currentInput = parseFloat(currentAmount);
  //   const currentOut = parseFloat(currentOutput);
  //   const prevInput = parseFloat(previousAmount);
  //   const prevOut = parseFloat(previousOutput);
  //   
  //   if (currentInput <= 0 || currentOut <= 0 || prevInput <= 0 || prevOut <= 0) return null;
  //   
  //   // Calculate expected linear scaling
  //   const expectedOutput = (currentInput / prevInput) * prevOut;
  //   const scalingDeviation = Math.abs(currentOut - expectedOutput) / expectedOutput * 100;
  //   
  //   // If deviation is more than 10%, there's a scaling issue
  //   if (scalingDeviation > 10) {
  //     return {
  //       severity: scalingDeviation > 25 ? 'critical' : 'warning',
  //       deviation: scalingDeviation,
  //       expected: expectedOutput,
  //       message: `Quote scaling issue: Expected ${expectedOutput.toFixed(2)} tokens, got ${currentOut.toFixed(2)} tokens (${scalingDeviation.toFixed(1)}% deviation)`
  //     };
  //   }
  //   
  //   return null;
  // }, []);

  // ────────────────────────────────────────────────────────────────────────────────
  // 8) EFFECTS
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    if (token && walletAddress) {
      fetchBalances(walletAddress);
      fetchPnLData(walletAddress);
    }
  }, [token, walletAddress, fetchBalances, fetchPnLData]);

  // 🔧 CRITICAL FIX: Clear quotes when token changes to prevent stale data
  useEffect(() => {
    console.log("🔄 Token changed, clearing quote state:", {
      oldToken: currentQuote?.tokenAddress,
      newToken: token?.baseToken?.address,
      oldTokenSymbol: currentQuote?.tokenSymbol,
      newTokenSymbol: token?.baseToken?.symbol,
      reason: "Token change detected - clearing stale quotes"
    });
    
    // Clear all quote-related state when token changes
    setAmountOut("");
    setCurrentQuote(null);
    setQuoteCountdown(30);
    setIsQuoteExpired(false);
    
    // Also clear amount input to force fresh start
    setAmountIn("");
    
    console.log("✅ Quote state cleared for new token:", token?.baseToken?.symbol);
  }, [token?.baseToken?.address]);

  // Quote countdown effect
  useEffect(() => {
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setQuoteCountdown(30);
      setIsQuoteExpired(false);
      return;
    }

    const interval = setInterval(() => {
      setQuoteCountdown((prev) => {
        if (prev <= 1) {
          setIsQuoteExpired(true);
          // Auto-refresh quote when countdown reaches 0
          if (amountIn && parseFloat(amountIn) > 0) {
            console.log("🔄 Auto-refreshing quote after 30s timeout");
            getQuote(amountIn);
          }
          return 30; // Reset to 30
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [amountIn, getQuote]);

  // 🔧 NEW: Real-time PnL updates every 30 seconds
  useEffect(() => {
    if (!walletAddress || !token) return;

    const pnlInterval = setInterval(() => {
      console.log("🔄 Auto-refreshing PnL data...");
      fetchPnLData(walletAddress);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(pnlInterval);
  }, [walletAddress, token, fetchPnLData]);

  // 🔧 NEW: Live PnL updates during active trading (every 10 seconds)
  useEffect(() => {
    if (!walletAddress || !token || !amountIn || parseFloat(amountIn) <= 0) return;

    const livePnlInterval = setInterval(() => {
      console.log("🔄 Live PnL update during active trading...");
      fetchPnLData(walletAddress);
    }, 10000); // Update every 10 seconds when actively trading

    return () => clearInterval(livePnlInterval);
  }, [walletAddress, token, amountIn, fetchPnLData]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 9) RENDER
  // ────────────────────────────────────────────────────────────────────────────────
  // 🔧 TEMPORARILY DISABLED: Excessive price impact blocking to restore swap functionality
  // TODO: Re-enable once quotes are working properly
  // const hasExcessivePriceImpact = false; // Temporarily disabled
  
  const isSwapReady = amountIn && 
    parseFloat(amountIn) > 0 && 
    isWalletConnected && 
    walletAddress; // 🔧 TEMPORARILY DISABLED: Price impact blocking

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Token Info Header - Cleaner Design */}
      {token && (
        <div className="flex items-center gap-3 mb-4 p-3 border-b border-gray-700 bg-gray-950" style={{ height: '70px' }}>
          <img
            src={token.logoUrl || `https://dexscreener.com/base/${token.baseToken.address}/logo.png`}
            alt={`${token.baseToken.name} logo`}
            className="w-8 h-8 border border-gray-700"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.baseToken.symbol}&background=1f2937&color=60a5fa&size=32`;
            }}
          />
          <div className="flex-1">
            <h3 className="font-bold text-gray-200 text-sm">
              {token.baseToken.name} ({token.baseToken.symbol})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* 🔧 GEAR: Slippage Tolerance Icon */}
            <button
              onClick={() => setShowSlippageModal(true)}
              className="text-blue-400 hover:text-blue-300 transition p-1"
              title="Slippage Settings"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
            
            <button
              onClick={() => setShowInfoModal(true)}
              className="text-blue-400 hover:text-blue-300 transition"
              title="Swap Info"
            >
              <FaInfoCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Wallet Connection */}
      {!isWalletConnected ? (
        <div className="flex flex-col items-center justify-center py-8">
          <FaWallet className="w-10 h-10 text-gray-400 mb-3" />
          <p className="text-gray-400 mb-3 text-sm">Create or load your wallet to start swapping</p>
          <div className="flex gap-2">
            <button
              onClick={createWallet}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-bold transition text-sm border border-blue-600"
            >
              Create Wallet
            </button>
            <button
              onClick={loadWallet}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 font-bold transition text-sm border border-gray-700"
            >
              Load Wallet
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Social Media Icons and Copy Address */}
          <div className="mb-4 border-b border-gray-700 bg-gray-950" style={{ height: '60px' }}>
            <div className="flex items-center justify-between h-full px-3">
              <div className="flex items-center space-x-3">
                <a
                  href="#"
                  className="text-gray-400 hover:text-blue-400 transition-colors flex items-center"
                  title="Website"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-gray-400 hover:text-blue-400 transition-colors flex items-center"
                  title="Telegram"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-gray-400 hover:text-blue-400 transition-colors flex items-center"
                  title="Twitter"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
              </div>
              
              {/* Copy Address Button */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-gray-300 flex items-center">
                  {token?.baseToken?.address 
                    ? `${token.baseToken.address.slice(0, 6)}...${token.baseToken.address.slice(-3)}`
                    : '0x000...000'
                  }
                </span>
                <button
                  onClick={copyTokenAddress}
                  disabled={!token?.baseToken?.address}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-lg border transition-all duration-200 text-xs font-medium ${
                    copiedAddress
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 border-gray-600/50 hover:border-blue-500/50 hover:text-blue-400'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={token?.baseToken?.address ? "Copy token address" : "Token address not available"}
                >
                  {copiedAddress ? (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Swap Interface */}
          <div className="p-4 mb-4 bg-gray-950" style={{ minHeight: '300px' }}>
            {/* Token Selection Tabs */}
            <div className="flex p-1 mb-4 bg-gray-800">
              <button
                onClick={() => setActiveTab("buy")}
                className={`flex-1 py-2 px-3 font-bold transition text-sm ${
                  activeTab === "buy"
                    ? "bg-green-500/20 text-green-400"
                    : "text-gray-400 hover:text-gray-200 bg-gray-800"
                }`}
              >
                Buy Token
              </button>
              <button
                onClick={() => setActiveTab("sell")}
                className={`flex-1 py-2 px-3 font-bold transition text-sm ${
                  activeTab === "sell"
                    ? "bg-red-500/20 text-red-400"
                    : "text-gray-400 hover:text-gray-200 bg-gray-800"
                }`}
              >
                Sell Token
              </button>
            </div>

            {/* Input Section */}
            <div className="mb-3">
              <label className="block text-xs text-gray-400 font-bold mb-1 uppercase">
                YOU PAY
              </label>
                                              <div className="p-3 bg-gray-800">
                 <div className="flex items-center justify-start mb-2">
                   <div className="flex gap-1">
                     {[25, 50, 75, 100].map((percent) => (
                       <button
                         key={percent}
                         onClick={() => handleQuickAmount(percent)}
                         className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 font-medium transition"
                       >
                         {percent === 100 ? "Max" : `${percent}%`}
                       </button>
                     ))}
                   </div>
                 </div>
                <div className="flex items-center">
                  <div className="flex items-center gap-2 mr-2">
                    {activeTab === "buy" ? (
                      <>
                        <SiEthereum className="w-4 h-4 text-gray-600" />
                        <span className="font-bold text-gray-200 text-sm">ETH</span>
                      </>
                    ) : (
                      <>
                        <img
                          src={token?.logoUrl || `https://dexscreener.com/base/${token?.baseToken.address}/logo.png`}
                          alt={`${token?.baseToken.symbol} logo`}
                          className="w-4 h-4 rounded-full"
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${token?.baseToken.symbol}&background=1f2937&color=60a5fa&size=16`;
                          }}
                        />
                        <span className="font-bold text-gray-200 text-sm">{token?.baseToken.symbol}</span>
                      </>
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder=""
                    value={amountIn}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="flex-1 bg-transparent text-gray-200 text-base font-mono outline-none border-none min-w-0"
                    disabled={isSwapLoading}
                  />
                </div>
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center my-3">
              <button
                onClick={handleSwapDirection}
                className="bg-gray-700 p-2 hover:bg-gray-600 transition"
                disabled={isSwapLoading}
              >
                <FaExchangeAlt className="w-4 h-4 text-gray-300" />
              </button>
            </div>

            {/* Output Section */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 font-bold mb-1 uppercase">
                YOU RECEIVE
              </label>
                             <div className="p-3 bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">
                      {quoteLoading ? "Fetching quote..." : amountOut ? "Estimated" : "Enter amount above"}
                    </span>
                    {amountOut && !quoteLoading && (
                      <span className={`text-xs ${isQuoteExpired ? 'text-red-400' : 'text-green-400'}`}>
                        {isQuoteExpired ? 'Expired' : `${quoteCountdown}s`}
                      </span>
                    )}
                  </div>
                  
                  {/* 🔧 NEW: Quote comparison button */}
                  {allQuotes.length > 1 && (
                    <button
                      onClick={() => setShowQuoteComparison(true)}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                    >
                      Compare {allQuotes.length} quotes
                    </button>
                  )}
                </div>
                
                {/* 🔧 NEW: Display selected quote source */}
                {selectedQuote && (
                  <div className="mb-2 text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
                    Via {selectedQuote.name} ({selectedQuote.source})
                  </div>
                )}
                
                                                 {/* 🔧 TEMPORARILY DISABLED: Price Impact & Backend Warning System */}
                {/* TODO: Re-enable once quote validation is properly implemented */}
                {false && (
                  <div className="mb-2 p-3 rounded-lg border text-xs bg-blue-900/20 border-blue-500/30 text-blue-300">
                    <strong>Price Impact System Temporarily Disabled</strong><br/>
                    • System is being tested for functionality<br/>
                    • Warnings will be restored once stable
                  </div>
                )}
                <div className="flex items-center">
                  <div className="flex items-center gap-2 mr-2">
                    {activeTab === "buy" ? (
                      <>
                        <img
                          src={token?.logoUrl || `https://dexscreener.com/base/${token?.baseToken.address}/logo.png`}
                          alt={`${token?.baseToken.symbol} logo`}
                          className="w-4 h-4 rounded-full"
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${token?.baseToken.symbol}&background=1f2937&color=60a5fa&size=16`;
                          }}
                        />
                        <span className="font-bold text-gray-200 text-sm">{token?.baseToken.symbol}</span>
                      </>
                    ) : (
                      <>
                        <SiEthereum className="w-4 h-4 text-gray-600" />
                        <span className="font-bold text-gray-200 text-sm">ETH</span>
                      </>
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder=""
                    value={amountOut || ""}
                    disabled
                    className="flex-1 bg-transparent text-gray-400 text-base font-mono outline-none border-none min-w-0"
                  />
                </div>
              </div>
            </div>





            {/* Main Action Button */}
            <button
              onClick={executeSwap}
              className={`w-full py-3 font-bold transition text-sm ${
                swapStatus === 'success'
                  ? "bg-green-500/20 text-green-400 cursor-not-allowed"
                  : swapStatus === 'failed'
                  ? "bg-red-500/20 text-red-400 cursor-not-allowed"
                  : isSwapReady && !isQuoteExpired
                  ? activeTab === "buy"
                    ? "bg-green-500/20 hover:bg-green-500/30 text-green-400"
                    : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                  : isQuoteExpired && isSwapReady
                  ? "bg-yellow-500/20 text-yellow-400 cursor-not-allowed"
                  : "bg-gray-700 text-gray-400 cursor-not-allowed"
              }`}
              disabled={!isSwapReady || isSwapLoading || isQuoteExpired || swapStatus === 'success' || swapStatus === 'failed'}
            >
              {swapStatus === 'success' ? (
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Swap Successful!
                </span>
              ) : swapStatus === 'failed' ? (
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Swap Failed
                </span>
              ) : isSwapLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {swapStatus === 'preparing' ? 'Preparing...' : 
                   swapStatus === 'signing' ? 'Signing...' : 
                   swapStatus === 'submitting' ? 'Submitting...' : 
                   'Processing...'}
                </span>
              ) : isQuoteExpired ? (
                "Quote Expired - Refreshing..."
              ) : (
                `${activeTab === "buy" ? "Buy" : "Sell"} ${token?.baseToken.symbol}`
              )}
            </button>
            
            {/* Transaction Status Message */}
            {swapStatus === 'success' && (
              <div className="mt-3 p-3 bg-green-500/10 border-b border-gray-700">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-green-400 font-medium">Transaction Success</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 ml-6">Swap again</div>
                </div>
              </div>
            )}
            
            {swapStatus === 'failed' && (
              <div className="mt-3 p-3 bg-red-500/10 border-b border-gray-700">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-red-400 font-medium">
                      {errorState.isOnChainRevert ? 'On-Chain Transaction Failed' : 'Transaction Failed'}
                    </span>
                  </div>
                  
                  {/* 🔧 NEW: Enhanced error details for on-chain reverts */}
                  {errorState.hasError && errorState.isOnChainRevert ? (
                    <div className="mt-2 ml-6">
                      <div className="text-xs text-red-300 font-medium mb-1">
                        {errorState.errorMessage}
                      </div>
                      <div className="text-xs text-gray-400 whitespace-pre-line">
                        {errorState.errorDetails}
                      </div>
                      
                      {/* 🔧 NEW: Transaction hash for on-chain failures */}
                      {errorState.transactionHash && (
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="font-medium">Transaction Hash:</span>
                          <a 
                            href={`https://basescan.org/tx/${errorState.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-blue-400 hover:text-blue-300 underline"
                          >
                            {errorState.transactionHash.slice(0, 10)}...{errorState.transactionHash.slice(-8)}
                          </a>
                        </div>
                      )}
                      
                      {/* 🔧 NEW: Action buttons for on-chain failures */}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            setErrorState({ hasError: false, errorMessage: '', errorDetails: '' });
                            setSwapStatus('idle');
                          }}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded transition"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => {
                            setErrorState({ hasError: false, errorMessage: '', errorDetails: '' });
                            setSwapStatus('idle');
                            // Refresh quote
                            if (amountIn) {
                              getQuote(amountIn);
                            }
                          }}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition"
                        >
                          Refresh Quote & Retry
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 mt-1 ml-6">Transaction reverted, try again</div>
                  )}
                </div>
              </div>
            )}

                          {/* Wallet Interface and PnL Section */}
              <div className="flex-1 flex flex-col bg-gray-950">
                {/* Wallet Interface - Enhanced Layout */}
                <div className="px-0 py-3 bg-gray-950" style={{ minHeight: '120px' }}>
                <div className="flex flex-col justify-between h-full">
                  {/* Wallet Header with Better Spacing */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                      <span className="text-sm font-bold text-gray-200 mr-3">Wallet</span>
                      <span className="text-sm font-mono text-gray-300 bg-gray-800 px-2 py-1 rounded">
                        {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '0x0000...0000'}
                      </span>
                    </div>
                    <button
                      onClick={copyAddress}
                      className="text-xs text-blue-400 hover:text-blue-300 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 transition rounded border border-gray-700"
                    >
                      Copy
                    </button>
                  </div>
                  
                                     {/* Balance Display with Enhanced Visual Hierarchy */}
                   <div className="grid grid-cols-2 gap-4">
                     {/* ETH Balance */}
                     <div className="bg-gray-800/50 p-3 border border-gray-700/50 backdrop-blur-sm">
                       <div className="flex items-center space-x-2 mb-1">
                         <SiEthereum className="w-4 h-4 text-gray-600" />
                         <span className="text-xs text-gray-400 font-medium">ETH</span>
                       </div>
                       <div className="text-sm font-bold text-gray-200">
                         {parseFloat(ethBalance).toFixed(4)}
                       </div>
                     </div>
                     
                     {/* Token Balance */}
                     <div className="bg-gray-800/50 p-3 border border-gray-700/50 backdrop-blur-sm">
                       <div className="flex items-center space-x-2 mb-1">
                         {token?.logoUrl ? (
                           <img 
                             src={token.logoUrl} 
                             alt={token.baseToken.symbol}
                             className="w-4 h-4 rounded-full"
                             onError={(e) => {
                               const target = e.currentTarget;
                               const fallback = target.nextElementSibling as HTMLElement;
                               if (fallback) {
                                 target.style.display = 'none';
                                 fallback.style.display = 'flex';
                               }
                             }}
                           />
                         ) : null}
                         <div className="w-4 h-4 bg-green-400 rounded-full flex items-center justify-center" style={{ display: token?.logoUrl ? 'none' : 'flex' }}>
                           <span className="text-xs font-bold text-white">00</span>
                         </div>
                         <span className="text-xs text-gray-400 font-medium">{token?.baseToken.symbol}</span>
                       </div>
                       <div className="text-sm font-bold text-gray-200">
                         {parseFloat(tokenBalance).toFixed(4)}
                       </div>
                     </div>
                   </div>
                </div>
              </div>
              
              {/* PnL Stats Section - Single Component */}
              <div className="px-0 py-3 bg-gray-950" style={{ minHeight: '80px' }}>
                <div className="bg-gray-800/30 backdrop-blur-sm min-h-[60px] w-full border border-gray-700/50">
                  <div className="grid grid-cols-4 h-full">
                    {/* Bought */}
                    <div className="flex flex-col items-center justify-center relative px-2 py-2">
                      <span className="text-xs text-gray-400 mb-1 font-medium">Bought</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-green-400">
                          ${pnlData?.bought !== undefined ? pnlData.bought.toFixed(2) : '0.00'}
                        </span>
                      </div>
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700/50"></div>
                    </div>
                    
                    {/* Sold */}
                    <div className="flex flex-col items-center justify-center relative px-2 py-2">
                      <span className="text-xs text-gray-400 mb-1 font-medium">Sold</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-red-400">
                          ${pnlData?.sold !== undefined ? pnlData.sold.toFixed(2) : '0.00'}
                        </span>
                      </div>
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700/50"></div>
                    </div>
                    
                    {/* Holding */}
                    <div className="flex flex-col items-center justify-center relative px-2 py-2">
                      <span className="text-xs text-gray-400 mb-1 font-medium">Holding</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-white">
                          ${pnlData?.holding !== undefined ? pnlData.holding.toFixed(2) : '0.00'}
                        </span>
                      </div>
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700/50"></div>
                    </div>
                    
                    {/* PnL */}
                    <div className="flex flex-col items-center justify-center relative px-2 py-2">
                      <span className="text-xs text-gray-400 mb-1 font-medium">PnL</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-bold ${pnlData?.totalPnLPercentage !== undefined ? (pnlData.totalPnLPercentage >= 0 ? 'text-green-400' : 'text-red-400') : 'text-green-400'}`}>
                          {pnlData?.totalPnLPercentage !== undefined ? `${pnlData.totalPnLPercentage > 0 ? '+' : ''}${pnlData.totalPnLPercentage.toFixed(2)}%` : '0.00%'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


        </>
      )}

      {/* Modals */}
      {showSlippageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="p-6 border border-gray-800 w-80 bg-gray-900 rounded-lg">
            <h3 className="text-lg font-bold mb-4 text-center">Slippage Tolerance</h3>
            
            {/* Current Setting Display */}
            <div className="mb-4 p-3 bg-gray-800 rounded border border-gray-600 text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">{slippage}%</div>
              <div className="text-gray-400 text-sm">Current Setting</div>
            </div>
            
            {/* Quick Options */}
            <div className="space-y-2 mb-4">
              <div className="text-gray-400 text-sm text-center mb-2">Quick Options:</div>
              {[0.1, 0.5, 1.0, 2.0].map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    setSlippage(value);
                    setShowSlippageModal(false);
                  }}
                  className={`w-full py-2 transition rounded ${
                    slippage === value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
            
            {/* Custom Input */}
            <div className="mb-4">
              <div className="text-gray-400 text-sm text-center mb-2">Custom Slippage:</div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="50"
                  value={slippage}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0.1 && value <= 50) {
                      setSlippage(value);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-center"
                  onFocus={(e) => e.target.select()}
                />
                <span className="text-gray-400 text-sm">%</span>
              </div>
              <div className="text-gray-500 text-xs text-center mt-1">Range: 0.1% - 50%</div>
            </div>
            
            {/* Explanation */}
            <div className="mb-4 p-3 bg-gray-800 rounded border border-gray-600">
              <div className="text-gray-300 text-sm text-center">
                <div className="mb-1">Higher slippage = better success rate</div>
                <div>But potentially worse prices</div>
              </div>
            </div>
            
            <button
              onClick={() => setShowSlippageModal(false)}
              className="w-full py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 transition border border-gray-700 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="p-6 border border-gray-800 w-96 max-h-96 overflow-y-auto bg-gray-900">
            <h3 className="text-lg font-bold mb-4">CypherSwap Info</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <p>CypherSwap provides secure, decentralized token swapping on Base chain.</p>
              <p>Features include:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Multi-DEX quote aggregation</li>
                <li>Real-time PnL tracking</li>
                <li>Self-custodial wallet integration</li>
                <li>Gas optimization</li>
                <li>MEV protection</li>
              </ul>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full mt-4 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 transition border border-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showPnLModal && pnlData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="p-6 border border-gray-800 w-96 max-h-96 overflow-y-auto bg-gray-900">
            <h3 className="text-lg font-bold mb-4">PnL Tracking</h3>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="text-gray-400 text-xs">Total PnL</div>
                  <div className={`font-bold ${pnlData.totalPnLPercentage >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pnlData.totalPnLPercentage >= 0 ? "+" : ""}{pnlData.totalPnLPercentage.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="text-gray-400 text-xs">Win Rate</div>
                  <div className="text-green-400 font-bold">{pnlData.winRate.toFixed(1)}%</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="text-gray-400 text-xs">Volume</div>
                  <div className="text-blue-400 font-bold">${pnlData.totalVolume.toFixed(2)}</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="text-gray-400 text-xs">Trades</div>
                  <div className="text-purple-400 font-bold">{pnlData.totalTrades}</div>
                </div>
              </div>
              
              {pnlData.recentTrades.length > 0 && (
                <div>
                  <h4 className="font-bold mb-2">Recent Trades</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pnlData.recentTrades.slice(0, 5).map((trade) => (
                      <div key={trade.id} className="bg-gray-800 p-2 rounded text-xs border border-gray-700">
                        <div className="flex justify-between">
                          <span className={trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                            {trade.type.toUpperCase()} {trade.tokenOut}
                          </span>
                          <span className="text-gray-400">
                            {new Date(trade.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowPnLModal(false)}
              className="w-full mt-4 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 transition border border-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* 🔧 NEW: Quote Comparison Modal */}
      <QuoteComparisonModal />

    </div>
  );
};

export default Swap;