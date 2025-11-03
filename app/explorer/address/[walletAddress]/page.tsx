"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/app/components/Header";
import Footer from "../../../components/Footer";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { SiEthereum } from "react-icons/si";

// Types
interface Token {
  name: string;
  symbol: string;
  balance: string;
  contractAddress: string;
  usdValue: number;
  recentActivity: number;
  tokenType: "ERC-20";
  logo?: string;
  decimals: number;
  priceChange24h?: number;
  priceChange7d?: number;
  priceChange30d?: number;
  priceUsd?: number;
  tokenImage?: string;
  liquidity?: number;
  volume24h?: number;
  dexId?: string;
  pairAddress?: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  category: string;
  timestamp: number;
  blockNumber: string;
  type: 'incoming' | 'outgoing' | 'internal';
  description: string;
  amount: string;
  status: 'confirmed' | 'pending' | 'failed';
  // Enhanced fields
  gasUsed?: string;
  gasPrice?: string;
  gasLimit?: string;
  gasFeeEth?: string;
  gasFeeUsd?: number;
  nonce?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  contractAddress?: string;
  contractName?: string;
  methodSignature?: string;
  inputData?: string;
  isContractCreation?: boolean;
  ethValueUsd?: number;
  tokenTransfers?: Array<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenName: string;
    value: string;
    decimals: number;
    usdValue?: number;
  }>;
  // Legacy fields for compatibility
  effectiveGasPrice?: string;
  fromName?: string;
  toName?: string;
}

interface WalletData {
  ethBalance: number;
  ethUsdValue: number;
  totalUsdValue: number;
  tokens: Token[];
  txList: Transaction[];
  lastScannedBlock?: { number: string; timestamp: number };
  nonce?: number;
  isContract?: boolean;
  chainId?: string;
  portfolioAllocation?: { eth: number; tokens: number };
  firstTxDate?: number;
  mostActivePeriod?: string;
}



// Utility functions
const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatNumber = (num: number) => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
};

const formatTokenPrice = (price: number) => {
  if (price >= 1000) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else if (price >= 0.0001) {
    return `$${price.toFixed(6)}`;
  } else {
    return `$${price.toFixed(8)}`;
  }
};

  const formatEthValue = (value: number) => {
    if (value === 0) {
      return '0.0000';
    } else if (value < 0.0001) {
      return value.toFixed(8);
    } else if (value < 1) {
      return value.toFixed(4);
    } else {
      return value.toFixed(4);
    }
  };

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const getTransactionType = (tx: Transaction) => {
  if (tx.value === "0x0") return "Contract Interaction";
  return "Transfer";
};

export default function WalletPage({ params }: { params: Promise<{ walletAddress: string }> }) {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<'overview' | 'tokens' | 'transactions'>('tokens');
  const [copied, setCopied] = useState(false);
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});
  const [logoLoading, setLogoLoading] = useState<Record<string, boolean>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showNameTagModal, setShowNameTagModal] = useState(false);
  const [nameTagInput, setNameTagInput] = useState('');
  
  // Transaction pagination and filtering state
  const [txPage, setTxPage] = useState(1);
  const [txLimit] = useState(5);
  const [txFilter, setTxFilter] = useState<'all' | 'token_transfers' | 'internal'>('all');
  const [txPagination, setTxPagination] = useState({
    totalCount: 0,
    page: 1,
    limit: 5,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  // State for hidden tokens
  const [hiddenTokens, setHiddenTokens] = useState<Set<string>>(new Set());

  // Token visibility functions
  const hideToken = (contractAddress: string) => {
    setHiddenTokens((prev: Set<string>) => new Set([...prev, contractAddress]));
  };

  const showToken = (contractAddress: string) => {
    setHiddenTokens((prev: Set<string>) => {
      const newSet = new Set(prev);
      newSet.delete(contractAddress);
      return newSet;
    });
  };

  const isTokenHidden = (contractAddress: string) => {
    return hiddenTokens.has(contractAddress);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Address copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy address');
    }
  };

  const getTokenLogo = async (contractAddress: string, symbol: string): Promise<string | null> => {
    try {
      console.log(`Fetching logo for ${symbol} (${contractAddress})`);
      
      // Try DexScreener first (better for Base tokens) - using working approach
      const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`;
      console.log('Trying DexScreener:', dexScreenerUrl);
      const dexResponse = await fetch(dexScreenerUrl);
      
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        console.log('DexScreener response:', dexData);
        
        if (dexData.pairs && dexData.pairs.length > 0) {
          // Get the most liquid pair on Base (same logic as WalletDropdown)
          const basePairs = dexData.pairs.filter((pair: any) => 
            pair.chainId === 'base' || pair.dexId === 'uniswap_v3' || pair.dexId === 'aerodrome'
          );
          
          const bestPair = basePairs.length > 0 ? basePairs[0] : dexData.pairs[0];
          
          // Get logo from the pair info (same as Indexes component)
          const logoUrl = bestPair.info?.imageUrl || 
                         bestPair.baseToken?.logoURI || 
                         bestPair.quoteToken?.logoURI;
          
          if (logoUrl) {
            console.log(`Found logo from DexScreener: ${logoUrl}`);
            return logoUrl;
          }
        }
      }

      // Try alternative DexScreener search endpoint
      try {
        const searchUrl = `https://api.dexscreener.com/latest/dex/search/?q=${contractAddress}`;
        console.log('Trying DexScreener search:', searchUrl);
        const searchResponse = await fetch(searchUrl);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.pairs && searchData.pairs.length > 0) {
            for (const pair of searchData.pairs) {
              if (pair.baseToken?.address?.toLowerCase() === contractAddress.toLowerCase()) {
                if (pair.baseToken?.logoURI) {
                  console.log(`Found logo via search: ${pair.baseToken.logoURI}`);
                  return pair.baseToken.logoURI;
                }
              }
              if (pair.quoteToken?.address?.toLowerCase() === contractAddress.toLowerCase()) {
                if (pair.quoteToken?.logoURI) {
                  console.log(`Found logo via search: ${pair.quoteToken.logoURI}`);
                  return pair.quoteToken.logoURI;
                }
              }
            }
          }
        }
      } catch (searchError) {
        console.log('Search endpoint failed, continuing...');
      }

      // Fallback to DexScreener logo URL
      const fallbackLogo = `https://dexscreener.com/base/${contractAddress}/logo.png`;
      console.log(`Using DexScreener fallback logo for ${symbol}: ${fallbackLogo}`);
      return fallbackLogo;
    } catch (error) {
      console.error('Error fetching token logo:', error);
      // Return DexScreener logo URL as fallback
      return `https://dexscreener.com/base/${contractAddress}/logo.png`;
    }
  };

  const fetchTokenLogos = async (tokens: Token[]) => {
    // Set loading state for all tokens
    const loadingState: Record<string, boolean> = {};
    tokens.forEach(token => {
      loadingState[token.contractAddress] = true;
    });
    setLogoLoading(prev => ({ ...prev, ...loadingState }));

    const logoPromises = tokens.map(async (token) => {
      const logo = await getTokenLogo(token.contractAddress, token.symbol);
      return { address: token.contractAddress, logo };
    });

    const results = await Promise.allSettled(logoPromises);
    const newLogos: Record<string, string> = {};
    const finalLoadingState: Record<string, boolean> = {};

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.logo) {
        newLogos[result.value.address] = result.value.logo;
      }
      // Set loading to false for all tokens
      if (result.status === 'fulfilled') {
        finalLoadingState[result.value.address] = false;
      }
    });

    setTokenLogos(prev => ({ ...prev, ...newLogos }));
    setLogoLoading(prev => ({ ...prev, ...finalLoadingState }));
  };

  const getWalletAge = (firstTxDate?: number) => {
    if (!firstTxDate) return 'Unknown';
    
    const now = Math.floor(Date.now() / 1000);
    const diffInSeconds = now - firstTxDate;
    const diffInDays = Math.floor(diffInSeconds / (24 * 60 * 60));
    const diffInYears = Math.floor(diffInDays / 365);
    const remainingDays = diffInDays % 365;
    
    if (diffInYears > 0) {
      return `${diffInYears} yr ${remainingDays} days ago`;
    } else {
      return `${diffInDays} days ago`;
    }
  };

  // Fetch ETH price
  useEffect(() => {
    async function fetchPrice() {
      try {
        console.log('Fetching ETH price from CoinGecko...');
        const response = await fetch('/api/price/eth');
        console.log('ETH price response status:', response.status);
        const data = await response.json();
        console.log('ETH Price response data:', data);
        console.log('ETH Price fetched:', data.ethereum?.usd);
        if (data.ethereum && data.ethereum.usd) {
          console.log('Setting ETH price to:', data.ethereum.usd);
          setEthPrice(data.ethereum.usd);
        } else {
          console.error('Invalid ETH price data:', data);
          setEthPrice(0); // Don't use fallback price
        }
      } catch (error) {
        console.error('Error fetching ETH price:', error);
        setEthPrice(0); // Don't use fallback price
      }
    }
    fetchPrice();
  }, []);

  // Check if user is logged in
  useEffect(() => {
    // Simple check - you can replace this with your actual auth logic
    const checkAuth = () => {
      const token = localStorage.getItem('authToken');
      setIsLoggedIn(!!token);
    };
    checkAuth();
  }, []);

  // Fetch ads
  useEffect(() => {
    async function fetchAds() {
      try {
        const response = await fetch('/api/ads');
        if (response.ok) {
          await response.json();

        }
      } catch (error) {
        console.error('Error fetching ads:', error);
      }
    }
    fetchAds();
  }, []);

  // Recalculate wallet data when ETH price changes
  useEffect(() => {
    console.log('ETH price useEffect triggered - ethPrice:', ethPrice, 'walletData exists:', !!walletData);
    if (walletData && ethPrice > 0) {
      console.log('Recalculating wallet data with ETH price:', ethPrice);
      const ethUsdValue = walletData.ethBalance * ethPrice;
      const totalTokenValue = walletData.tokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);
      const totalUsdValue = ethUsdValue + totalTokenValue;

      console.log('ETH Balance:', walletData.ethBalance);
      console.log('ETH USD Value:', ethUsdValue);
      console.log('Total Token Value:', totalTokenValue);
      console.log('Total USD Value:', totalUsdValue);

      const portfolioAllocation = {
        eth: totalUsdValue > 0 ? (ethUsdValue / totalUsdValue) * 100 : 0,
        tokens: totalUsdValue > 0 ? (totalTokenValue / totalUsdValue) * 100 : 0
      };

      console.log('Portfolio allocation:', portfolioAllocation);

      setWalletData(prev => {
        if (!prev) return null;
        console.log('Updating wallet data with new ETH values');
        return {
          ...prev,
          ethUsdValue,
          totalUsdValue,
          portfolioAllocation
        };
      });
    } else {
      console.log('Skipping recalculation - ethPrice:', ethPrice, 'walletData exists:', !!walletData);
    }
  }, [ethPrice, walletData]);

  // Fetch wallet data
  useEffect(() => {
    async function fetchData() {
      try {
        const resolvedParams = await params;
        const address = resolvedParams.walletAddress;
        setWalletAddress(address);
        

        // Fetch basic wallet data
        const basicResponse = await fetch('/api/alchemy/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'basic', address })
        });
        const basicResponseData = await basicResponse.json();
        const basicData = basicResponseData.data;

        // Fetch tokens
        const tokensResponse = await fetch('/api/alchemy/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'tokens', address })
        });
        const tokensResponseData = await tokensResponse.json();
        const tokensData = tokensResponseData.data;

        // Fetch transactions with pagination and filtering
        const txResponse = await fetch('/api/alchemy/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'transactions', 
            address,
            page: txPage,
            limit: txLimit,
            filter: txFilter
          })
        });
        const txResponseData = await txResponse.json();
        const txData = txResponseData.data;
        
        // Update pagination state
        if (txData) {
          setTxPagination({
            totalCount: txData.totalCount || 0,
            page: txData.page || 1,
            limit: txData.limit || 20,
            totalPages: txData.totalPages || 0,
            hasNextPage: txData.hasNextPage || false,
            hasPrevPage: txData.hasPrevPage || false
          });
        }

        // Process tokens with DEX Screener data
        let tokens = tokensData.tokenBalances || [];
        let totalTokenValue = 0;
        
        console.log('Raw tokens data:', tokensData);
        console.log('Tokens array:', tokens);

        // Transform token data to match frontend interface
        tokens = tokens.map((token: { name: string; symbol: string; tokenBalance: string; contractAddress: string; decimals: string; logo?: string }) => ({
          name: token.name,
          symbol: token.symbol,
          balance: token.tokenBalance,
          contractAddress: token.contractAddress,
          usdValue: 0, // Will be calculated below
          recentActivity: Math.floor(Math.random() * 10), // Placeholder
          tokenType: "ERC-20" as const,
          logo: token.logo,
          decimals: parseInt(token.decimals),
          priceUsd: 0, // Will be fetched from DEX Screener
          tokenImage: `https://dexscreener.com/base/${token.contractAddress}/logo.png`, // DexScreener logo URL
          liquidity: 0,
          volume24h: 0,
          dexId: '',
          pairAddress: ''
        }));

                 // Fetch token prices and images from DEX Screener - using exact same pattern as WalletDropdown
         const tokenPromises = tokens.map(async (token: Token) => {
           try {
             const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.contractAddress}`);
             const data = await response.json();
             
             if (data.pairs && data.pairs.length > 0) {
               // Get the most liquid pair on Base (exact same logic as WalletDropdown)
               const basePairs = data.pairs.filter((pair: any) => 
                 pair.chainId === 'base' || pair.dexId === 'uniswap_v3' || pair.dexId === 'aerodrome'
               );
               
               const pair = basePairs.length > 0 ? basePairs[0] : data.pairs[0];
               
               // Get logo using the same pattern as alchemy/wallet/route.ts
               const tokenLogo = pair.info?.imageUrl || 
                                pair.mediaContent?.previewImage?.small || 
                                pair.baseToken?.image ||
                                pair.baseToken?.logoURI ||
                                pair.quoteToken?.logoURI ||
                                `https://dexscreener.com/base/${token.contractAddress}/logo.png`;
               
               const tokenPrice = parseFloat(pair.priceUsd || "0");
               const usdValue = parseFloat(token.balance) * tokenPrice;
               totalTokenValue += usdValue;
               
               return { 
                 ...token, 
                 usdValue,
                 priceUsd: tokenPrice,
                 priceChange24h: parseFloat(pair.priceChange?.h24 || "0"),
                 liquidity: pair.liquidity?.usd || 0,
                 tokenImage: tokenLogo,
                 volume24h: pair.volume?.h24 || 0,
                 dexId: pair.dexId,
                 pairAddress: pair.pairAddress
               };
             }
           } catch (error) {
             console.error(`Error fetching DEX data for ${token.symbol}:`, error);
           }
           
           // Fallback to placeholder price - but mark as no valid logo
           const tokenPrice = Math.random() * 100;
           const usdValue = parseFloat(token.balance) * tokenPrice;
           totalTokenValue += usdValue;
           return { ...token, usdValue, priceUsd: tokenPrice, tokenImage: '' };
         });
        
        // Wait for all token price fetches to complete
        tokens = await Promise.all(tokenPromises);
        
                 // Filter out tokens with ridiculous values and spam
         tokens = tokens.filter((token: Token) => {
           const tokenBalance = parseFloat(token.balance || '0');
           
           // Only show tokens that have a valid logo from DexScreener
           if (!token.tokenImage || 
               token.tokenImage === '' || 
               token.tokenImage.includes('placeholder') ||
               token.tokenImage.includes('dexscreener.com/base') && !token.tokenImage.includes('logo.png')) {
             return false;
           }
           
           // Filter out tokens with ridiculous token balances (likely spam/meme tokens)
           if (tokenBalance > 1000000000) return false; // Over 1 billion tokens
           
           // Filter out tokens with very long names/symbols (likely spam)
           if (token.name && token.name.length > 50) return false;
           if (token.symbol && token.symbol.length > 20) return false;
           
           // Filter out tokens with suspicious names (likely spam)
           const suspiciousKeywords = ['moon', 'doge', 'shib', 'inu', 'elon', 'safe', 'baby', 'rocket', 'moon', 'safe'];
           const nameLower = token.name?.toLowerCase() || '';
           const symbolLower = token.symbol?.toLowerCase() || '';
           
           if (suspiciousKeywords.some(keyword => nameLower.includes(keyword) || symbolLower.includes(keyword))) {
             return false;
           }
           
           return true;
         });
        console.log('Filtered tokens (removed spam/ridiculous values):', tokens.length);

        // Parse basic wallet data from JSON-RPC responses
        const chainId = parseInt(basicData[0]?.result || "0x1", 16);
        const blockNumber = parseInt(basicData[1]?.result || "0x0", 16);
        const nonce = parseInt(basicData[2]?.result || "0x0", 16);
        const isContract = basicData[3]?.result !== "0x";
        const ethBalance = parseInt(basicData[4]?.result || "0x0", 16) / 1e18;

        // Don't calculate ETH USD value here - wait for ETH price to be fetched
        const ethUsdValue = 0; // Will be calculated when ETH price is available
        const totalUsdValue = totalTokenValue; // Only token value for now

        const portfolioAllocation = {
          eth: 0, // Will be calculated when ETH price is available
          tokens: 100 // 100% tokens for now
        };

        // Get first transaction date - try to get from transaction data
        let firstTxDate = undefined;
        if (txData.transactions && txData.transactions.length > 0) {
          // Try to get the earliest transaction timestamp
          const timestamps = txData.transactions
            .map((tx: any) => tx.timestamp || tx.blockTimestamp || 0)
            .filter((timestamp: number) => timestamp > 0);
          
          if (timestamps.length > 0) {
            firstTxDate = Math.min(...timestamps);
            console.log('First transaction date found:', new Date(firstTxDate * 1000));
          }
        }
        
        // If no timestamp found, we'll need to fetch from block data
        if (!firstTxDate) {
          console.log('No transaction timestamps found, wallet age will show as Unknown');
        }

        setWalletData({
          ethBalance,
          ethUsdValue,
          totalUsdValue,
          tokens,
          txList: txData.transactions || [],
          lastScannedBlock: { number: blockNumber.toString(), timestamp: Math.floor(Date.now() / 1000) },
          nonce,
          isContract,
          chainId: chainId.toString(),
          portfolioAllocation,
          firstTxDate
        });

        // Fetch logos for tokens
        fetchTokenLogos(tokens);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching wallet data:', error);
        setError('Failed to load wallet data');
        setLoading(false);
      }
    }

    fetchData();
  }, [params, ethPrice]);

  // Refetch transactions when pagination or filter changes
  useEffect(() => {
    async function fetchTransactions() {
      if (!walletAddress) return;
      
      try {
        const txResponse = await fetch('/api/alchemy/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'transactions', 
            address: walletAddress,
            page: txPage,
            limit: txLimit,
            filter: txFilter
          })
        });
        const txResponseData = await txResponse.json();
        const txData = txResponseData.data;
        
        if (txData && walletData) {
          setWalletData({
            ...walletData,
            txList: txData.transactions || []
          });
          
          setTxPagination({
            totalCount: txData.totalCount || 0,
            page: txData.page || 1,
            limit: txData.limit || 20,
            totalPages: txData.totalPages || 0,
            hasNextPage: txData.hasNextPage || false,
            hasPrevPage: txData.hasPrevPage || false
          });
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      }
    }

    fetchTransactions();
  }, [walletAddress, txPage, txFilter, txLimit]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-gray-950">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {/* Cool Animated Dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <div className="flex justify-center space-x-3">
                <motion.div
                  className="w-4 h-4 bg-blue-400 rounded-full"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: 0
                  }}
                />
                <motion.div
                  className="w-4 h-4 bg-cyan-400 rounded-full"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: 0.2
                  }}
                />
                <motion.div
                  className="w-4 h-4 bg-cyan-400 rounded-full"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: 0.4
                  }}
                />
              </div>
            </motion.div>

            {/* Cool Loading Text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <div className="text-gray-300 text-sm font-medium tracking-wide">
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Loading
                </motion.span>
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                >
                  .
                </motion.span>
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                >
                  .
                </motion.span>
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
                >
                  .
                </motion.span>
              </div>
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !walletData) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-gray-950">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-400 text-lg font-semibold mb-2">Error Loading Wallet</p>
            <p className="text-gray-400">{error || 'Unable to load wallet data'}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-900 overflow-hidden">
      <Header />
      
      <main className="flex-1 bg-slate-900 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col">
          <div className="w-full">
            {/* Header */}
            <div className="text-left mb-4 flex-shrink-0">
              <h1 className="text-lg font-normal mb-1 text-white">Wallet {formatAddress(walletAddress)}</h1>
              <p className="text-gray-400 text-xs">Wallet information from Base network</p>
            </div>

            {/* Combined Information Card */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Overview Section */}
                <div className="md:border-r border-gray-700/50 md:pr-4">
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Overview
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs sm:text-sm">ETH BALANCE</span>
                      <span className="text-white font-mono text-xs sm:text-sm text-right">{walletData.ethBalance.toFixed(18)} ETH</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs sm:text-sm">ETH VALUE</span>
                      <div className="text-right">
                        <div className="text-white font-medium text-xs sm:text-sm">
                          {ethPrice > 0 ? `$${formatNumber(walletData.ethUsdValue)}` : 'Loading...'}
                        </div>
                        <div className="text-gray-500 text-xs">
                          @ ${ethPrice > 0 ? formatNumber(ethPrice) : 'Loading...'}/ETH
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs sm:text-sm">TOKEN HOLDINGS</span>
                      <div className="text-right">
                        <div className="text-white font-medium text-xs sm:text-sm">${formatNumber(walletData.tokens.reduce((sum, t) => sum + (t.usdValue || 0), 0))}</div>
                        <div className="text-gray-500 text-xs">{walletData.tokens.length} Tokens</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chain Info Section */}
                <div className="md:border-r border-gray-700/50 md:pr-4">
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Chain Info
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs sm:text-sm">PRIVATE NAME TAGS</span>
                      {isLoggedIn ? (
                        <button 
                          onClick={() => setShowNameTagModal(true)}
                          className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                        >
                          + Add
                        </button>
                      ) : (
                        <button 
                          onClick={() => toast.error('Please log in to add name tags')}
                          className="text-gray-500 hover:text-gray-400 text-xs"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs sm:text-sm">WALLET AGE</span>
                      <div className="text-right">
                        <div className="text-white font-mono text-xs">{formatAddress(walletAddress)}</div>
                        <div className="text-gray-500 text-xs">{getWalletAge(walletData.firstTxDate)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multichain Info Section */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Multichain Info
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs sm:text-sm">TOTAL VALUE</span>
                      <span className="text-white font-medium text-xs sm:text-sm">${formatNumber(walletData.totalUsdValue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs sm:text-sm">ADDRESSES</span>
                      <span className="text-white text-xs sm:text-sm">1 address found</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-2 sm:space-y-3 lg:space-y-4">
                {/* Tab Navigation */}
                <div className="flex bg-slate-800/30 border border-slate-700/50 rounded-lg p-1 mb-4 overflow-x-auto">
                  {[
                    { 
                      id: 'tokens', 
                      label: 'Tokens', 
                      count: walletData.tokens.length
                    },
                    { 
                      id: 'overview', 
                      label: 'Overview', 
                      count: 0
                    },
                    { 
                      id: 'transactions', 
                      label: 'Transactions', 
                      count: walletData.txList.length
                    }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'overview' | 'tokens' | 'transactions')}
                      className={`flex-1 py-2 px-2 sm:px-3 text-sm font-medium transition-all flex items-center justify-center space-x-1 whitespace-nowrap min-w-0 ${
                        activeTab === tab.id
                          ? 'bg-gray-700 text-white border-b-2 border-blue-400'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          activeTab === tab.id 
                            ? 'bg-blue-400/20 text-blue-300' 
                            : 'bg-gray-600 text-gray-300'
                        }`}>({tab.count})</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Transaction Info Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-gray-400 text-xs sm:text-sm">
                      Latest {walletData.txList.length} from a total of {walletData.txList.length} transactions
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setShowAdvancedFilter(!showAdvancedFilter);
                      toast.success(showAdvancedFilter ? 'Advanced filter closed' : 'Advanced filter opened');
                    }}
                    className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm font-medium transition-colors self-start sm:self-auto"
                  >
                    Advanced Filter
                  </button>
                </div>

                {/* Advanced Filter Panel */}
                {showAdvancedFilter && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-900/50 border border-gray-700/50 p-4 mb-4"
                  >
                    <h4 className="text-white font-medium mb-3">Advanced Filter Options</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-gray-400 text-sm mb-2">Transaction Type</label>
                        <select className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                          <option value="all">All Transactions</option>
                          <option value="incoming">Incoming</option>
                          <option value="outgoing">Outgoing</option>
                          <option value="contract">Contract Interaction</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-2">Date Range</label>
                        <select className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                          <option value="all">All Time</option>
                          <option value="24h">Last 24 Hours</option>
                          <option value="7d">Last 7 Days</option>
                          <option value="30d">Last 30 Days</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm mb-2">Amount Range</label>
                        <select className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                          <option value="all">All Amounts</option>
                          <option value="small">Small (&lt; 0.1 ETH)</option>
                          <option value="medium">Medium (0.1 - 1 ETH)</option>
                          <option value="large">Large (&gt; 1 ETH)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                      <button 
                        onClick={() => setShowAdvancedFilter(false)}
                        className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          toast.success('Filter applied successfully!');
                          setShowAdvancedFilter(false);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                      >
                        Apply Filter
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
                    className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4"
                  >
                    {activeTab === 'overview' && (
                      <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                        <h3 className="text-lg font-bold text-white mb-3">Portfolio Overview</h3>
                        
                        {/* Enhanced Portfolio Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Portfolio Allocation */}
                          <div className="bg-gray-900/50 border border-gray-700/50 p-1.5 sm:p-2">
                            <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                              <svg className="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              Portfolio Allocation
                            </h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">ETH</span>
                                <span className="text-white font-medium">{walletData.portfolioAllocation?.eth.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">Tokens</span>
                                <span className="text-white font-medium">{walletData.portfolioAllocation?.tokens.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" 
                                  style={{ width: `${walletData.portfolioAllocation?.eth || 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* Wallet Stats */}
                          <div className="bg-gray-900/50 border border-gray-700/50 p-1.5 sm:p-2">
                            <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                              <svg className="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              Wallet Stats
                            </h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">Total Value</span>
                                <span className="text-blue-400 font-medium">${formatNumber(walletData.totalUsdValue)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">ETH Balance</span>
                                <span className="text-white font-medium">{formatEthValue(walletData.ethBalance)} ETH</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">Token Count</span>
                                <span className="text-white font-medium">{walletData.tokens.filter(token => !isTokenHidden(token.contractAddress)).length}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300">Transaction Count</span>
                                <span className="text-white font-medium">{walletData.txList.length}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Top Tokens by Value */}
                        <div className="bg-gray-900/50 border border-gray-700/50 p-1.5 sm:p-2">
                          <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            Top Tokens by Value
                          </h4>
                          <div className="space-y-2">
                            {/* ETH as #1 */}
                            <div className="flex items-center justify-between p-2 bg-gray-900/30 rounded">
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-400 text-sm">#1</span>
                                <span className="text-white font-medium">ETH</span>
                              </div>
                              <span className="text-blue-400 font-medium">${formatNumber(walletData.ethUsdValue)}</span>
                            </div>
                            {/* Top tokens */}
                            {walletData.tokens
                              .filter(token => !isTokenHidden(token.contractAddress))
                              .sort((a, b) => b.usdValue - a.usdValue)
                              .slice(0, 2)
                              .map((token, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-900/30 rounded">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-gray-400 text-sm">#{index + 2}</span>
                                    <span className="text-white font-medium">{token.symbol}</span>
                                  </div>
                                  <span className="text-blue-400 font-medium">${formatNumber(token.usdValue)}</span>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-gray-900/50 border border-gray-700/50 p-1.5 sm:p-2">
                          <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            Recent Activity
                          </h4>
                          <div className="space-y-2">
                            {walletData.txList.slice(0, 3).map((tx) => (
                              <div key={tx.hash} className="flex items-center justify-between p-2 bg-gray-900/30 rounded">
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-white text-sm">{getTransactionType(tx)}</p>
                                    <Link 
                                      href={`/explorer/tx/${tx.hash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 text-xs hover:underline"
                                    >
                                      {formatAddress(tx.hash)}
                                    </Link>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-white text-sm">{formatEthValue(parseFloat(tx.value) / 1e18)} ETH</p>
                                  <p className="text-gray-400 text-xs">
                                    {tx.timestamp ? formatTime(tx.timestamp) : 'Unknown'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'tokens' && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-bold text-white">Token Holdings</h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-400">
                            <span>Showing {walletData.tokens.filter(token => !isTokenHidden(token.contractAddress)).length} of {walletData.tokens.length} tokens</span>
                            {hiddenTokens.size > 0 && (
                              <button
                                onClick={() => setHiddenTokens(new Set())}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                Show All
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* ETH Balance Section */}
                        <div className="mb-4 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 sm:space-x-3">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-500/20 flex items-center justify-center">
                                <SiEthereum className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm sm:text-base">Ethereum (ETH)</p>
                                <p className="text-gray-400 text-xs sm:text-sm">Native token</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-medium text-sm sm:text-base">{formatEthValue(walletData.ethBalance)} ETH</p>
                              <p className="text-gray-400 text-xs sm:text-sm">${formatNumber(walletData.ethUsdValue)}</p>
                            </div>
                          </div>
                        </div>
                        {walletData.tokens.length > 0 ? (
                          <div className="space-y-0 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                            {walletData.tokens
                              .filter(token => !isTokenHidden(token.contractAddress))
                              .map((token, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`flex items-center justify-between p-3 bg-slate-800/30 ${index > 0 ? 'border-t border-slate-700/50' : ''}`}
                              >
                                                                 <div className="flex items-center space-x-2 sm:space-x-3">
                                   <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                                     {logoLoading[token.contractAddress] ? (
                                       <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                                         <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                         </svg>
                                       </div>
                                     ) : (token.tokenImage || tokenLogos[token.contractAddress]) ? (
                                       <Image 
                                         src={token.tokenImage || tokenLogos[token.contractAddress]} 
                                         alt={token.symbol}
                                         width={48}
                                         height={48}
                                         className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
                                         onError={() => {
                                           // Fallback handled by the div below
                                         }}
                                       />
                                     ) : (
                                       <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                                       <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                       </svg>
                                     </div>
                                     )}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                     <p className="text-white font-medium text-sm sm:text-base truncate">{token.symbol}</p>
                                     <p className="text-gray-400 text-xs sm:text-sm truncate">{token.name}</p>
                                     <div className="flex items-center space-x-2 mt-1">
                                       <span className="text-xs text-gray-500 font-mono">{formatAddress(token.contractAddress)}</span>
                                       <button
                                         onClick={() => copyToClipboard(token.contractAddress)}
                                         className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                         title="Copy address"
                                       >
                                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                         </svg>
                                       </button>
                                     </div>
                                   </div>
                                 </div>
                                <div className="text-right min-w-0">
                                  <p className="text-white font-medium text-sm sm:text-base">{parseFloat(token.balance).toFixed(4)}</p>
                                  <p className="text-gray-400 text-xs sm:text-sm">${formatNumber(token.usdValue)}</p>
                                  {token.priceUsd && token.symbol !== 'ETH' && (
                                    <p className={`text-xs ${token.priceChange24h && token.priceChange24h < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                      {formatTokenPrice(token.priceUsd)}
                                      {token.priceChange24h && (
                                        <span className={`ml-1 ${token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                          ({token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%)
                                        </span>
                                      )}
                                    </p>
                                  )}
                                  <button
                                    onClick={() => hideToken(token.contractAddress)}
                                    className="mt-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
                                    title="Hide token"
                                  >
                                    Hide
                                  </button>
                                </div>
          </motion.div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                            </div>
                            <p className="text-gray-400 text-lg font-semibold mb-2">No Tokens Found</p>
                            <p className="text-gray-500">This wallet doesn&apos;t hold any tokens yet.</p>
                          </div>
                        )}
                        
                        {/* Hidden Tokens Section */}
                        {hiddenTokens.size > 0 && (
                          <div className="mt-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-lg font-semibold text-gray-400">Hidden Tokens ({hiddenTokens.size})</h4>
                              <button
                                onClick={() => setHiddenTokens(new Set())}
                                className="text-blue-400 hover:text-blue-300 transition-colors text-sm"
                              >
                                Show All
                              </button>
                            </div>
                            <div className="space-y-0 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                              {walletData.tokens
                                .filter(token => isTokenHidden(token.contractAddress))
                                .map((token, index) => (
                                  <div key={index} className={`flex items-center justify-between p-2 bg-gray-900/20 opacity-60 ${index > 0 ? 'border-t border-gray-700/30' : ''}`}>
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                                        {(token.tokenImage || tokenLogos[token.contractAddress]) ? (
                                          <Image 
                                            src={token.tokenImage || tokenLogos[token.contractAddress]} 
                                            alt={token.symbol}
                                            width={32}
                                            height={32}
                                            className="w-8 h-8 rounded-full object-cover"
                                          />
                                        ) : (
                                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                        </svg>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-gray-400 font-medium">{token.symbol}</p>
                                        <p className="text-gray-500 text-xs">{token.name}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-gray-500 text-sm">${formatNumber(token.usdValue)}</span>
                                      <button
                                        onClick={() => showToken(token.contractAddress)}
                                        className="text-green-400 hover:text-green-300 transition-colors"
                                        title="Show token"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'transactions' && (
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                          <h3 className="text-lg font-bold text-white mb-3 sm:mb-0">Transaction History</h3>
                          
                          {/* Filter Controls */}
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={txFilter}
                              onChange={(e) => setTxFilter(e.target.value as 'all' | 'token_transfers' | 'internal')}
                              className="px-3 py-2 bg-gray-800 border border-gray-600 text-white text-sm focus:outline-none focus:border-blue-500"
                            >
                              <option value="all">All Transactions</option>
                              <option value="token_transfers">Token Transfers</option>
                              <option value="internal">Internal Transactions</option>
                            </select>
                            
                            <div className="text-gray-400 text-sm flex items-center">
                              {txPagination.totalCount > 0 && (
                                <span>Showing {((txPagination.page - 1) * txPagination.limit) + 1}-{Math.min(txPagination.page * txPagination.limit, txPagination.totalCount)} of {txPagination.totalCount}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {walletData.txList.length > 0 ? (
                          <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                            {walletData.txList.map((tx, index) => (
                              <motion.div
                                key={tx.hash}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="p-3 bg-slate-800/30"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-white font-medium">{tx.description || getTransactionType(tx)}</p>
                                      <Link 
                                        href={`/explorer/tx/${tx.hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 text-sm hover:underline"
                                      >
                                        {formatAddress(tx.hash)}
                                      </Link>
                                      {tx.contractAddress && (
                                        <p className="text-gray-500 text-xs">
                                          Contract: {formatAddress(tx.contractAddress)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-white font-medium">
                                      {tx.amount ? `${tx.amount} ${tx.asset}` : 
                                        parseFloat(tx.value) > 0 
                                          ? `${formatEthValue(parseFloat(tx.value) / 1e18)} ETH`
                                          : '0.0000 ETH'
                                      }
                                    </p>
                                    {tx.ethValueUsd && tx.ethValueUsd > 0 && (
                                      <p className="text-gray-400 text-xs">
                                        ${formatNumber(tx.ethValueUsd)}
                                      </p>
                                    )}
                                    {tx.gasFeeEth && parseFloat(tx.gasFeeEth) > 0 && (
                                      <p className="text-gray-500 text-xs">
                                        Gas: {parseFloat(tx.gasFeeEth).toFixed(6)} ETH
                                        {tx.gasFeeUsd && tx.gasFeeUsd > 0 && (
                                          <span className="ml-1">(${formatNumber(tx.gasFeeUsd)})</span>
                                        )}
                                      </p>
                                    )}
                                    <p className="text-gray-400 text-xs">
                                      {tx.timestamp ? formatTime(tx.timestamp) : 'Unknown'}
                                    </p>
                                    {tx.status === 'failed' ? (
                                      <span className="text-red-400 text-xs">Failed</span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                                  <div>
                                    <span className="text-gray-500">From:</span> 
                                    <Link 
                                      href={`/explorer/address/${tx.from}`}
                                      className="hover:text-blue-400 transition-colors ml-1"
                                    >
                                      {formatAddress(tx.from)}
                                    </Link>
                                    {tx.fromName && (
                                      <div className="text-gray-500 text-xs mt-1">
                                        {tx.fromName}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-gray-500">To:</span> 
                                    <Link 
                                      href={`/explorer/address/${tx.to}`}
                                      className="hover:text-blue-400 transition-colors ml-1"
                                    >
                                      {formatAddress(tx.to)}
                                    </Link>
                                    {tx.toName && (
                                      <div className="text-gray-500 text-xs mt-1">
                                        {tx.toName}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Transaction Details */}
                                <div className="mt-3 pt-3 border-t border-gray-700/50">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                    <div>
                                      <span className="text-gray-500">Value:</span>
                                      <span className="text-white ml-1">
                                        {parseFloat(tx.value) > 0 
                                          ? `${formatEthValue(parseFloat(tx.value) / 1e18)} ETH`
                                          : '0.0000 ETH (Contract Interaction)'
                                        }
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Gas Price:</span>
                                      <span className="text-white ml-1">
                                        {tx.effectiveGasPrice 
                                          ? `${(parseInt(tx.effectiveGasPrice, 16) / 1e9).toFixed(3)} Gwei`
                                          : tx.gasPrice 
                                            ? `${(parseInt(tx.gasPrice, 16) / 1e9).toFixed(3)} Gwei`
                                            : 'N/A'
                                        }
                                      </span>
                                    </div>
                                    {tx.gasUsed && (
                                      <div>
                                        <span className="text-gray-500">Gas Used:</span>
                                        <span className="text-white ml-1">
                                          {parseInt(tx.gasUsed, 16).toLocaleString()}
                                        </span>
                                      </div>
                                    )}
                                    {tx.inputData && tx.inputData !== '0x' && (
                                      <div className="sm:col-span-3">
                                        <span className="text-gray-500">Method:</span>
                                        <span className="text-blue-400 ml-1 font-mono text-xs">
                                          {tx.inputData.slice(0, 10)}...
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                            
                            {/* Pagination Controls at Bottom */}
                            {txPagination.totalPages > 1 && (
                              <div className="flex justify-between items-center mt-6 p-4 bg-gray-800/30">
                                <button
                                  onClick={() => setTxPage(Math.max(1, txPage - 1))}
                                  disabled={!txPagination.hasPrevPage}
                                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded text-sm transition-colors"
                                >
                                  Previous
                                </button>
                                
                                <div className="flex items-center space-x-2">
                                  {Array.from({ length: Math.min(5, txPagination.totalPages) }, (_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                      <button
                                        key={pageNum}
                                        onClick={() => setTxPage(pageNum)}
                                        className={`px-3 py-1 rounded text-sm transition-colors ${
                                          txPage === pageNum 
                                            ? 'bg-blue-500 text-white' 
                                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                        }`}
                                      >
                                        {pageNum}
                                      </button>
                                    );
                                  })}
                                  {txPagination.totalPages > 5 && (
                                    <span className="text-gray-400">...</span>
                                  )}
                                </div>
                                
                                <button
                                  onClick={() => setTxPage(txPage + 1)}
                                  disabled={!txPagination.hasNextPage}
                                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded text-sm transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <p className="text-gray-400 text-lg font-semibold mb-2">No Transactions Found</p>
                            <p className="text-gray-500">This wallet hasn&apos;t made any transactions yet.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
      </AnimatePresence>
              </div>

              {/* Right Sidebar */}
              <div className="space-y-4 lg:space-y-6">
                {/* Ad Banner Placement */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 sm:p-6"
                  >
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                    </div>
                    <h3 className="text-white font-semibold mb-2">Ad Space Available</h3>
                    <p className="text-gray-400 text-sm mb-4">Perfect placement for your brand</p>
                    <div className="bg-gray-800/50 p-3 border border-gray-700/50">
                      <div className="w-full h-32 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                        <span className="text-gray-500 text-xs">Your Ad Here</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

              </div>
            </div>
          </div>
          </div>
        </div>
      </main>

      {/* Name Tag Modal */}
      {showNameTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 p-6 w-full max-w-md mx-4">
            <h3 className="text-white text-lg font-semibold mb-4">Add Private Name Tag</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Address</label>
                <div className="text-white font-mono text-sm bg-gray-800 p-2 rounded">
                  {formatAddress(walletAddress)}
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Name Tag</label>
                <input
                  type="text"
                  value={nameTagInput}
                  onChange={(e) => setNameTagInput(e.target.value)}
                  placeholder="Enter a name for this address"
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowNameTagModal(false);
                    setNameTagInput('');
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (nameTagInput.trim()) {
                      toast.success('Name tag added successfully!');
                      setShowNameTagModal(false);
                      setNameTagInput('');
                    } else {
                      toast.error('Please enter a name tag');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
        </div>
      </div>
      )}
      
      <Footer />
    </div>
  );
}