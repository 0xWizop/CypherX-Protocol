"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { FaWallet, FaDownload, FaEye, FaEyeSlash, FaArrowLeft, FaLock } from "react-icons/fa";
import { FiSettings, FiExternalLink, FiX, FiUser, FiCopy, FiCheck } from "react-icons/fi";
import { Sparklines, SparklinesLine, SparklinesCurve } from "react-sparklines";
import { ethers } from "ethers";

import { motion, AnimatePresence } from "framer-motion";
import { useWalletSystem } from "@/app/providers";
import { secureWalletManager } from "@/lib/secure-wallet";
import { realtimeDataService } from "@/lib/realtime-data";
import LoadingSpinner from "./LoadingSpinner";
import ErrorDisplay from "./ErrorDisplay";
import { getErrorMessage, logError } from "@/app/utils/errorHandling";


// Error Boundary Component
class WalletDropdownErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('WalletDropdown Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Wallet Error</h3>
            <p className="text-gray-400 text-sm mb-4">There was an error loading the wallet interface.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface WalletDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  walletSystem: "wagmi" | "self-custodial";
}

interface WalletData {
  address: string;
  privateKey: string;
  createdAt: number;
}

// Removed unused interface WalletSecurityState

interface Transaction {
  id?: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  type?: string;
  amount?: string;
  token?: string;
  description?: string;
  usdValue?: string;
  priceAtTime?: number;
}

const WalletDropdown: React.FC<WalletDropdownProps> = ({
  isOpen,
  onClose,
  walletSystem
}) => {
  const { setSelfCustodialWallet, setWalletLoading, walletLoading } = useWalletSystem();
  const [isMobile, setIsMobile] = useState(false);
  const [walletData, setWalletData] = useState<WalletData | null>(null);

  const [ethBalance, setEthBalance] = useState<string>("0.0");
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "settings">("overview");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [tokenHoldings, setTokenHoldings] = useState<any[]>([]);
  const [isLoadingHoldings, setIsLoadingHoldings] = useState<boolean>(false);
  const [holdingsError, setHoldingsError] = useState<string>('');
  const [transactionsError, setTransactionsError] = useState<string>('');
  const [balanceError, setBalanceError] = useState<string>('');
  const [hiddenTokens, setHiddenTokens] = useState<Set<string>>(new Set());
  const [showWalletDropdown, setShowWalletDropdown] = useState<boolean>(false);
  const [userAlias, setUserAlias] = useState<string>('');
  const [currentSection, setCurrentSection] = useState<'main' | 'send' | 'receive' | 'swap' | 'buy'>('main');
  const [walletPassword, setWalletPassword] = useState<string>('');
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>('');
  const [sendAmount, setSendAmount] = useState<string>('');
  const [sendAddress, setSendAddress] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<string>('ETH');
  const [showBalance, setShowBalance] = useState(true);

  const [selectedTokenForChart, setSelectedTokenForChart] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'main' | 'asset-details'>('main');
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'15m' | '1h' | '4h' | '1d'>('1h');
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const walletLoadedRef = useRef(false);
  
  // Swap state
  const [swapPayAmount, setSwapPayAmount] = useState<string>('0');
  const [swapReceiveAmount, setSwapReceiveAmount] = useState<string>('0');
  const [swapPayToken, setSwapPayToken] = useState<{symbol: string; address: string; logo?: string}>({symbol: 'ETH', address: '0x4200000000000000000000000000000000000006'});
  const [swapReceiveToken, setSwapReceiveToken] = useState<{symbol: string; address: string; logo?: string}>({symbol: 'USDC', address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'});
  const [swapQuote, setSwapQuote] = useState<any>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'home' | 'swap' | 'history' | 'search'>('home');
  const [showTokenSelector, setShowTokenSelector] = useState<'pay' | 'receive' | null>(null);
  const [tokenSearchQuery, setTokenSearchQuery] = useState<string>('');
  const [tokenSearchResults, setTokenSearchResults] = useState<any[]>([]);
  const [isSearchingTokens, setIsSearchingTokens] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load token logos on mount
  useEffect(() => {
    const loadTokenLogos = async () => {
      // ETH logo
      const ethLogo = 'https://assets.coingecko.com/coins/images/279/small/ethereum.png';
      setSwapPayToken(prev => ({ ...prev, logo: ethLogo }));
      
      // USDC logo
      const usdcLogo = 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png';
      setSwapReceiveToken(prev => ({ ...prev, logo: usdcLogo }));
    };
    loadTokenLogos();
  }, []);

  // Fetch user account information
  const fetchUserAccount = useCallback(async () => {
    try {
      // Try to get user info from localStorage or session
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        // You can replace this with your actual user info fetching logic
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
          const user = JSON.parse(userInfo);
          setUserAlias(user.alias || '');
        }
      }
    } catch (error) {
      console.error('Error fetching user account:', error);
    }
  }, []);

  // Fetch ETH price
  const fetchEthPrice = useCallback(async () => {
    try {
      const response = await fetch('/api/price/eth', { cache: 'no-store' });
      if (response.ok) {
      const data = await response.json();
      if (data.ethereum && data.ethereum.usd) {
        setEthPrice(data.ethereum.usd);
      }
      }
    } catch (error) {
      console.error('Error fetching ETH price:', error);
    }
  }, []);

  // Fetch wallet balance
  const fetchBalance = useCallback(async (address: string) => {
    setBalanceError('');
    try {
      const response = await fetch(`/api/wallet/balance?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEthBalance(data.ethBalance);
          setSelfCustodialWallet({
            address: address,
            isConnected: true,
            ethBalance: data.ethBalance,
            tokenBalance: data.tokenBalance || "0.0"
          });
        } else {
          const errorMessage = getErrorMessage('Balance fetch failed', 'wallet');
          setBalanceError(errorMessage);
        }
      } else {
        const errorMessage = getErrorMessage(`HTTP ${response.status}`, 'wallet');
        setBalanceError(errorMessage);
        logError(`Balance response not ok: ${response.status}`, 'wallet');
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'wallet');
      setBalanceError(errorMessage);
      logError(error, 'wallet');
    }
  }, [setSelfCustodialWallet]);

  // Fetch token holdings
  const fetchTokenHoldings = useCallback(async () => {
    if (!walletData?.address) return;
    
    console.log('🔍 Fetching token holdings for address:', walletData.address);
    setIsLoadingHoldings(true);
    setHoldingsError('');
    
    try {
      const response = await fetch('/api/alchemy/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletData.address,
          action: 'tokens'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Token holdings response:', data);
        if (data.success && data.data && data.data.tokenBalances) {
          console.log('🔍 Setting token holdings:', data.data.tokenBalances);
          setTokenHoldings(data.data.tokenBalances);
        } else {
          console.log('🔍 No token balances found in response');
          setTokenHoldings([]);
        }
      } else {
        const errorMessage = getErrorMessage(`HTTP ${response.status}`, 'wallet');
        setHoldingsError(errorMessage);
        logError(`Token holdings response not ok: ${response.status}`, 'wallet');
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'wallet');
      setHoldingsError(errorMessage);
      logError(error, 'wallet');
    } finally {
      setIsLoadingHoldings(false);
    }
  }, [walletData?.address]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!walletData?.address) return;
    
    console.log('🔍 Fetching transactions for address:', walletData.address);
    setIsLoadingTransactions(true);
    setTransactionsError('');
    
    try {
      const response = await fetch('/api/alchemy/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletData.address,
          action: 'transactions',
          page: 1,
          limit: 20
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Transactions response:', data);
        if (data.success && data.data && data.data.transactions) {
          console.log('🔍 Found transactions:', data.data.transactions.length);
          const processedTransactions = data.data.transactions.map((tx: any) => {
            console.log('🔍 Processing transaction:', tx);
            
            // Handle timestamp conversion properly
            let timestamp = Date.now();
            if (tx.timestamp) {
              // If timestamp is a number, it's likely a Unix timestamp
              if (typeof tx.timestamp === 'number') {
                // Check if it's in seconds or milliseconds
                if (tx.timestamp < 10000000000) {
                  // It's in seconds, convert to milliseconds
                  timestamp = tx.timestamp * 1000;
                } else {
                  // It's already in milliseconds
                  timestamp = tx.timestamp;
                }
              } else if (typeof tx.timestamp === 'string') {
                // Try to parse as a date string
                const parsed = new Date(tx.timestamp).getTime();
                if (!isNaN(parsed)) {
                  timestamp = parsed;
                }
              }
            }
            
            // Handle amount calculation properly
            let amount = '0';
            if (tx.amount) {
              // If amount is already calculated, use it
              const parsedAmount = parseFloat(tx.amount);
              if (!isNaN(parsedAmount)) {
                amount = parsedAmount.toFixed(6);
              }
            } else if (tx.value) {
              // If we have raw value, format it
              try {
                amount = ethers.formatEther(tx.value);
              } catch (error) {
                console.error('Error formatting value:', error);
                amount = '0';
              }
            }
            
            // Calculate USD value based on asset type
            let usdValue = '0';
            if (tx.asset === 'ETH') {
              const amountNum = parseFloat(amount);
              if (!isNaN(amountNum)) {
                usdValue = (amountNum * ethPrice).toFixed(2);
              }
            } else {
              // For tokens, we'll need to get price from elsewhere
              usdValue = '0'; // TODO: Get token price
            }
            
            return {
              id: tx.hash,
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: tx.value,
              gasUsed: tx.gasUsed || '0',
              gasPrice: tx.gasPrice || '0',
              timestamp: timestamp,
              status: tx.status || 'confirmed',
              type: tx.type || (tx.from.toLowerCase() === walletData.address.toLowerCase() ? 'outgoing' : 'incoming'),
              amount: amount,
              token: tx.asset || 'ETH',
              usdValue: usdValue
            };
          });
          console.log('🔍 Processed transactions:', processedTransactions);
          setTransactions(processedTransactions);
        } else {
          console.log('🔍 No transactions found in response');
          setTransactions([]);
        }
      } else {
        const errorMessage = getErrorMessage(`HTTP ${response.status}`, 'wallet');
        setTransactionsError(errorMessage);
        logError(`Transactions response not ok: ${response.status}`, 'wallet');
        setTransactions([]);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'wallet');
      setTransactionsError(errorMessage);
      logError(error, 'wallet');
      setTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [walletData?.address, ethPrice]);

  // Load existing wallet from secure storage
  const loadWallet = useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        // Check if secure wallet exists
        if (secureWalletManager.hasWallet()) {
          const address = secureWalletManager.getWalletAddress();
          if (address) {
            
            // Set wallet as connected but locked
            setSelfCustodialWallet({
              address: address,
              isConnected: true,
              ethBalance: "0.0",
              tokenBalance: "0.0"
            });
            
            // Show password modal to unlock
            setShowPasswordModal(true);
          }
        } else {
          // Fallback to old wallet system
          const storedWallet = localStorage.getItem("cypherx_wallet");
          if (storedWallet) {
            try {
              const data = JSON.parse(storedWallet);
              setWalletData(data);
              setSelfCustodialWallet({
                address: data.address,
                isConnected: true,
                ethBalance: "0.0",
                tokenBalance: "0.0"
              });
              fetchBalance(data.address);
              fetchTransactions();
            } catch (error) {
              console.error("Error loading wallet:", error);
            }
          }
        }
        setWalletLoading(false);
      }
    } catch (error) {
      console.error("Error in loadWallet:", error);
      setWalletLoading(false);
    }
  }, [setSelfCustodialWallet, fetchBalance, setWalletLoading]);

  // Unlock wallet with password
  const unlockWallet = useCallback(async (password: string) => {
    try {
      setPasswordError('');
      const wallet = await secureWalletManager.unlockWallet(password);
      
      if (wallet) {
        
        setShowPasswordModal(false);
        setWalletPassword('');
        
        // Fetch wallet data
        fetchBalance(wallet.address);
        fetchTransactions();
        
        // Subscribe to real-time updates
        realtimeDataService.subscribeToWallet(wallet.address, (walletUpdate) => {
          setEthBalance(walletUpdate.ethBalance);
          setTokenHoldings(walletUpdate.tokenBalances);
        });
      }
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to unlock wallet');
    }
  }, [fetchBalance, fetchTransactions]);



  // Import wallet from backup file
  const importWallet = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            if (data.address && data.privateKey) {
              const walletData: WalletData = {
                address: data.address,
                privateKey: data.privateKey,
                createdAt: data.createdAt || Date.now()
              };
              
            localStorage.setItem("cypherx_wallet", JSON.stringify(walletData));
            setWalletData(walletData);
            setSelfCustodialWallet({
              address: walletData.address,
              isConnected: true,
              ethBalance: "0.0",
              tokenBalance: "0.0"
            });
            
            walletLoadedRef.current = false; // Reset ref for imported wallet
            fetchBalance(walletData.address);
              fetchTransactions();
            }
          } catch (error) {
            console.error("Error importing wallet:", error);
            console.error("Failed to import wallet");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [setSelfCustodialWallet, fetchBalance]);

  // Create new wallet
  const createWallet = useCallback(() => {
    try {
      const wallet = ethers.Wallet.createRandom();
      const data: WalletData = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        createdAt: Date.now()
      };
      
      localStorage.setItem("cypherx_wallet", JSON.stringify(data));
      setWalletData(data);
      setEthBalance("0.0");
      
      setSelfCustodialWallet({
        address: data.address,
        isConnected: true,
        ethBalance: "0.0",
        tokenBalance: "0.0"
      });
      
      walletLoadedRef.current = false; // Reset ref for new wallet
              console.log("Wallet created successfully!");
    } catch (error) {
      console.error("Error creating wallet:", error);
              console.error("Failed to create wallet");
    }
  }, [setSelfCustodialWallet]);

  // Copy wallet address
  const copyAddress = useCallback(async () => {
    console.log("copyAddress called, walletData:", walletData);
    
    if (!walletData?.address) {
      console.error("No wallet address available");
      console.error("Action failed");
      return;
    }
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(walletData.address);
        console.log("Action completed");
        console.log("Address copied successfully:", walletData.address);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = walletData.address;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          console.log("Action completed");
          console.log("Address copied successfully (fallback):", walletData.address);
        } else {
          throw new Error("execCommand copy failed");
        }
      }
      
      setCopiedAddress(true);
      setShowCopyNotification(true);
      setTimeout(() => {
        setCopiedAddress(false);
        setShowCopyNotification(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
      console.error("Error details:", error instanceof Error ? error.message : 'Unknown error');
      console.error("Action failed");
    }
  }, [walletData]);

  // Copy private key
  const copyPrivateKey = useCallback(async () => {
    if (!walletData?.privateKey) {
      console.error("No private key available");
      console.error("Action failed");
      return;
    }
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(walletData.privateKey);
        console.log("Action completed");
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = walletData.privateKey;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          console.log("Action completed");
        } else {
          throw new Error("execCommand copy failed");
        }
      }
    } catch (error) {
      console.error("Failed to copy private key:", error);
      console.error("Action failed");
    }
  }, [walletData]);

  // Copy token address
  const copyTokenAddress = useCallback(async (address: string) => {
    console.log("copyTokenAddress called with:", address);
    console.log("Type of address:", typeof address);
    
    if (!address || typeof address !== 'string') {
      console.error("Invalid address:", address);
      console.error("Action failed");
      return;
    }
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(address);
        setCopiedAddress(true);
        console.log("Action completed");
        console.log("Address copied successfully:", address);
        
        // Reset the copied state after 2 seconds
        setTimeout(() => {
          setCopiedAddress(false);
        }, 2000);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = address;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          setCopiedAddress(true);
          console.log("Action completed");
          console.log("Address copied successfully (fallback):", address);
          
          setTimeout(() => {
            setCopiedAddress(false);
          }, 2000);
        } else {
          throw new Error("execCommand copy failed");
        }
      }
    } catch (error) {
      console.error("Failed to copy token address:", error);
      console.error("Error details:", error instanceof Error ? error.message : 'Unknown error');
      console.error("Action failed");
    }
  }, []);

  // Handle hiding/showing tokens
  const toggleTokenVisibility = useCallback((contractAddress: string) => {
    setHiddenTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contractAddress)) {
        newSet.delete(contractAddress);
      } else {
        newSet.add(contractAddress);
      }
      return newSet;
    });
  }, []);

  // Handle hiding all tokens
  const hideAllTokens = useCallback(() => {
    setHiddenTokens(new Set(tokenHoldings.map(token => token.contractAddress)));
  }, [tokenHoldings]);

  // Handle showing all tokens
  const showAllTokens = useCallback(() => {
    setHiddenTokens(new Set());
  }, []);

  // Handle back to main section
  const handleBackToMain = useCallback(() => {
    setCurrentSection('main');
    setCurrentView('main');
    setSendAmount('');
    setSendAddress('');
    setSelectedToken('ETH');
    setSelectedTokenForChart(null);
  }, []);

  // Fetch OHLC data using DexScreener API
  const fetchChartData = useCallback(async (tokenAddress: string, timeframe: string) => {
    setIsLoadingChart(true);
    try {
      // For ETH, use CoinGecko API with different timeframes
      if (tokenAddress === 'ethereum' || tokenAddress === 'ETH') {
        let days = 1;
        let interval = 'hourly';
        
        // Adjust parameters based on timeframe
        switch (timeframe) {
          case '15m':
            days = 1;
            interval = 'hourly';
            break;
          case '1h':
            days = 1;
            interval = 'hourly';
            break;
          case '4h':
            days = 7;
            interval = 'daily';
            break;
          case '1d':
            days = 30;
            interval = 'daily';
            break;
          default:
            days = 1;
            interval = 'hourly';
        }
        
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=${days}&interval=${interval}`);
        if (response.ok) {
          const data = await response.json();
          const prices = data.prices || [];
          const chartData = prices.map((price: [number, number]) => ({
            time: price[0] / 1000,
            close: price[1]
          }));
          setChartData(chartData);
        } else {
          throw new Error('Failed to fetch ETH data');
        }
      } else {
        // For tokens, try to get historical data from DexScreener
        // First get the pair data to find the pair address
        const pairResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
        if (pairResponse.ok) {
          const pairData = await pairResponse.json();
          if (pairData.pairs && pairData.pairs.length > 0) {
            // Get the most liquid pair on Base
            const basePairs = pairData.pairs.filter((pair: any) => 
              pair.chainId === 'base' || pair.dexId === 'uniswap_v3' || pair.dexId === 'aerodrome'
            );
            const pair = basePairs.length > 0 ? basePairs[0] : pairData.pairs[0];
            const pairAddress = pair.pairAddress;
            
            // Try to get historical data for this pair
            const historicalResponse = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${pairAddress}`);
            if (historicalResponse.ok) {
              const historicalData = await historicalResponse.json();
              if (historicalData.pair && historicalData.pair.priceHistory) {
                const chartData = historicalData.pair.priceHistory.map((price: any) => ({
                  time: new Date(price.timestamp).getTime() / 1000,
                  close: parseFloat(price.price)
                }));
                setChartData(chartData);
              } else {
                // Fallback: generate realistic data based on current price and timeframe
                const currentPrice = parseFloat(pair.priceUsd || '1');
                const priceChange = pair.priceChange?.h24 || 0;
                
                let dataPoints = 24;
                let timeInterval = 3600; // 1 hour
                
                switch (timeframe) {
                  case '15m':
                    dataPoints = 96; // 24 hours / 15 minutes
                    timeInterval = 900; // 15 minutes
                    break;
                  case '1h':
                    dataPoints = 24;
                    timeInterval = 3600;
                    break;
                  case '4h':
                    dataPoints = 42; // 7 days / 4 hours
                    timeInterval = 14400; // 4 hours
                    break;
                  case '1d':
                    dataPoints = 30;
                    timeInterval = 86400; // 1 day
                    break;
                }
                
                const chartData = Array.from({ length: dataPoints }, (_, i) => {
                  const time = Date.now() / 1000 - (dataPoints - i) * timeInterval;
                  const progress = i / dataPoints;
                  const trend = priceChange > 0 ? 1 : -1;
                  const variance = Math.sin(progress * Math.PI * 2) * 0.02 + (trend * progress * 0.01);
                  const price = currentPrice * (1 + variance);
                  return {
                    time,
                    close: price
                  };
                });
                setChartData(chartData);
              }
            } else {
              // Fallback: generate realistic data based on current price
              const currentPrice = parseFloat(pair.priceUsd || '1');
              const priceChange = pair.priceChange?.h24 || 0;
              
              let dataPoints = 24;
              let timeInterval = 3600;
              
              switch (timeframe) {
                case '15m':
                  dataPoints = 96;
                  timeInterval = 900;
                  break;
                case '1h':
                  dataPoints = 24;
                  timeInterval = 3600;
                  break;
                case '4h':
                  dataPoints = 42;
                  timeInterval = 14400;
                  break;
                case '1d':
                  dataPoints = 30;
                  timeInterval = 86400;
                  break;
              }
              
              const chartData = Array.from({ length: dataPoints }, (_, i) => {
                const time = Date.now() / 1000 - (dataPoints - i) * timeInterval;
                const progress = i / dataPoints;
                const trend = priceChange > 0 ? 1 : -1;
                const variance = Math.sin(progress * Math.PI * 2) * 0.02 + (trend * progress * 0.01);
                const price = currentPrice * (1 + variance);
                return {
                  time,
                  close: price
                };
              });
              setChartData(chartData);
            }
          } else {
            throw new Error('No pairs found for token');
          }
        } else {
          throw new Error('Failed to fetch pair data');
        }
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      // Fallback to mock data if all else fails
      const mockData = Array.from({ length: 24 }, (_, i) => {
        const time = Date.now() / 1000 - (24 - i) * 3600;
        const basePrice = 1;
        const variance = Math.sin(i * 0.5) * 0.1;
        const price = basePrice * (1 + variance);
        return {
          time,
          close: price
        };
      });
      setChartData(mockData);
    } finally {
      setIsLoadingChart(false);
    }
  }, []);

  // Fetch token price from DexScreener
  const fetchTokenPrice = useCallback(async (tokenAddress: string) => {
    try {
      // For ETH, use CoinGecko API
      if (tokenAddress === 'ethereum' || tokenAddress === 'ETH') {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true');
        if (response.ok) {
          const data = await response.json();
          const ethData = data.ethereum;
          return {
            price: ethData.usd || 0,
            priceChange: ethData.usd_24h_change || 0,
            volume24h: ethData.usd_24h_vol || 0,
            liquidity: ethData.usd_market_cap || 0
          };
        }
        return null;
      }

      // For tokens, use DexScreener
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        // Get the most liquid pair on Base
        const basePairs = data.pairs.filter((pair: any) => 
          pair.chainId === 'base' || pair.dexId === 'uniswap_v3' || pair.dexId === 'aerodrome'
        );
        
        const pair = basePairs.length > 0 ? basePairs[0] : data.pairs[0];
        
        return {
          price: parseFloat(pair.priceUsd || '0'),
          priceChange: pair.priceChange?.h24 || 0,
          volume24h: pair.volume?.h24 || 0,
          liquidity: pair.liquidity?.usd || 0,
          marketCap: pair.marketCap || 0,
          fdv: pair.fdv || 0
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching token price:', error);
      return null;
    }
  }, []);

  // Format USD value with proper abbreviation
  const formatUSDValue = (value: number): string => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Format token price with more decimal support
  const formatTokenPrice = (price: number): string => {
    if (price >= 1000) {
      return `$${price.toFixed(2)}`;
    } else if (price >= 1) {
      return `$${price.toFixed(4)}`;
    } else if (price >= 0.01) {
      return `$${price.toFixed(6)}`;
    } else if (price >= 0.0001) {
      return `$${price.toPrecision(4)}`;
    } else {
      return `$${price.toExponential(4)}`;
    }
  };

  // Convert OHLC data to sparkline data (closing prices)
  const getSparklineData = (): number[] => {
    if (!chartData || chartData.length === 0) {
      return [];
    }
    return chartData.map(item => item.close);
  };

  // Handle send transaction
  const handleSendTransaction = useCallback(async () => {
    if (!walletData || !sendAmount || !sendAddress) {
      console.error("Action failed");
      return;
    }

    try {
      // Basic validation
      if (selectedToken === 'ETH') {
        const amount = parseFloat(sendAmount);
        const balance = parseFloat(ethBalance);
        if (amount > balance) {
          console.error("Action failed");
          return;
        }
      }

      // For now, just show a success message
      // In a real implementation, you would sign and send the transaction
      console.log(`Sending ${sendAmount} ${selectedToken} to ${sendAddress?.slice(0, 6)}...${sendAddress?.slice(-4)}`);
      
      // Reset form and go back to main
      setSendAmount('');
      setSendAddress('');
      setCurrentSection('main');
    } catch (error) {
      console.error('Error sending transaction:', error);
      console.error("Action failed");
    }
  }, [walletData, sendAmount, sendAddress, selectedToken, ethBalance]);

  // Handle Buy/Sell button
  const handleBuySell = useCallback(() => {
    if (!walletData) {
      console.error("Action failed");
      return;
    }
    setCurrentSection('buy');
  }, [walletData]);

  // Search tokens
  const searchTokens = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setTokenSearchResults([]);
      return;
    }

    setIsSearchingTokens(true);
    try {
      // Search our tokens collection
      const response = await fetch(`/api/tokens?search=${encodeURIComponent(query)}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        if (data.tokens) {
          // Enhance with DexScreener data for logos
          const enhanced = await Promise.all(
            data.tokens.map(async (token: any) => {
              try {
                const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.address}`);
                if (dexRes.ok) {
                  const dexData = await dexRes.json();
                  const pair = dexData.pairs?.[0];
                  return {
                    ...token,
                    logo: pair?.baseToken?.logoURI || pair?.quoteToken?.logoURI || `https://dexscreener.com/base/${token.address}/logo.png`
                  };
                }
              } catch (e) {}
              return {
                ...token,
                logo: `https://dexscreener.com/base/${token.address}/logo.png`
              };
            })
          );
          setTokenSearchResults(enhanced);
        } else {
          setTokenSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Error searching tokens:', error);
      setTokenSearchResults([]);
    } finally {
      setIsSearchingTokens(false);
    }
  }, []);

  // Debounced token search
  useEffect(() => {
    if (!tokenSearchQuery) {
      setTokenSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(() => {
      searchTokens(tokenSearchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [tokenSearchQuery, searchTokens]);

  // Fetch swap quote
  const fetchSwapQuote = useCallback(async (amount: string, tokenIn: {symbol: string; address: string}, tokenOut: {symbol: string; address: string}) => {
    if (!amount || parseFloat(amount) <= 0 || !tokenIn || !tokenOut) {
      setSwapReceiveAmount('0');
      return;
    }

    setIsLoadingQuote(true);
    try {
      const sellToken = tokenIn.address;
      const buyToken = tokenOut.address;

      // Get decimals (simplified - in production you'd fetch these)
      const decimals = 18; // Most tokens use 18
      
      const amountWei = (parseFloat(amount) * Math.pow(10, decimals)).toFixed(0);
      
      const params = new URLSearchParams({
        chainId: "8453",
        sellToken,
        buyToken,
        sellAmount: amountWei
      });

      const res = await fetch(`/api/0x/price?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data?.buyAmount) {
        const buyAmount = parseFloat(data.buyAmount) / Math.pow(10, decimals);
        let formattedAmt: string;
        if (buyAmount >= 1) {
          formattedAmt = buyAmount.toFixed(4);
        } else if (buyAmount >= 0.01) {
          formattedAmt = buyAmount.toFixed(6);
        } else {
          formattedAmt = buyAmount.toFixed(8);
        }
        setSwapReceiveAmount(formattedAmt);
        setSwapQuote(data);
      } else {
        setSwapReceiveAmount('0');
        setSwapQuote(null);
      }
    } catch (error) {
      console.error('Error fetching swap quote:', error);
      setSwapReceiveAmount('0');
      setSwapQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, []);

  // Execute swap
  const executeSwap = useCallback(async () => {
    if (!walletData || !swapPayAmount || !swapReceiveToken || !swapQuote) {
      return;
    }

    setIsSwapping(true);
    try {
      const sellToken = swapPayToken.address;
      const buyToken = swapReceiveToken.address;

      // Get quote from 0x API for execution
      const quoteParams = new URLSearchParams({
        chainId: "8453",
        sellToken,
        buyToken,
        sellAmount: (parseFloat(swapPayAmount) * Math.pow(10, 18)).toFixed(0),
        taker: walletData.address,
        slippageBps: "50" // 0.5% slippage
      });

      const quoteRes = await fetch(`/api/0x/quote?${quoteParams.toString()}`);
      const quoteData = await quoteRes.json();

      if (!quoteRes.ok) {
        throw new Error(quoteData.error || "Failed to get swap quote");
      }

      // Here you would execute the swap using the wallet's private key
      // For now, we'll just show a success message
      console.log('Swap quote:', quoteData);
      
      // In a real implementation, you'd sign and send the transaction
      // using ethers.js with the wallet's private key
      
      setShowCopyNotification(true);
      setTimeout(() => setShowCopyNotification(false), 2000);
      
      // Reset form
      setSwapPayAmount('0');
      setSwapReceiveAmount('0');
      
    } catch (error) {
      console.error('Error executing swap:', error);
    } finally {
      setIsSwapping(false);
    }
  }, [walletData, swapPayAmount, swapPayToken, swapReceiveToken, swapQuote]);

  // Handle Swap button
  const handleSwap = useCallback(() => {
    if (!walletData) {
      console.error("Action failed");
      return;
    }
    setCurrentSection('swap');
    setActiveBottomTab('swap');
  }, [walletData]);

  // Handle Send button
  const handleSend = useCallback(() => {
    if (!walletData) {
      console.error("Action failed");
      return;
    }
    setCurrentSection('send');
  }, [walletData]);

  // Handle receive
  const handleReceive = useCallback(() => {
    if (!walletData) {
      console.error("Action failed");
      return;
    }
    setCurrentSection('receive');
  }, [walletData]);

  // Backup wallet
  const handleBackup = useCallback(() => {
    if (walletData) {
      const backupData = {
        address: walletData.address,
        privateKey: walletData.privateKey,
        createdAt: walletData.createdAt,
        backupDate: Date.now()
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json"
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cypherx-wallet-${walletData?.address?.slice(0, 8) || 'backup'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log("Action completed");
    }
  }, [walletData]);

  // Import wallet handler
  const handleImport = useCallback(() => {
    importWallet();
  }, [importWallet]);

  // Clear wallet
  const handleClearWallet = useCallback(() => {
    if (confirm('Are you sure you want to clear all wallet data?')) {
      setSelfCustodialWallet(null);
      setWalletData(null);
      setEthBalance("0.0");
      setTransactions([]);
      console.log("Action completed");
    }
  }, [setSelfCustodialWallet]);

  // Auto-load wallet when dropdown opens
  useEffect(() => {
    if (isOpen && walletSystem === "self-custodial" && !walletData) {
      try {
        // Use setTimeout to avoid state updates during render
        setTimeout(() => {
          loadWallet();
        }, 0);
      } catch (error) {
        console.error('Error loading wallet:', error);
        console.error("Action failed");
      }
    }
  }, [isOpen, walletSystem, walletData, loadWallet]);

  // Fetch data when wallet is loaded
  useEffect(() => {
    if (walletData?.address) {
      fetchTokenHoldings();
      if (activeTab === "history") {
        fetchTransactions();
      }
      // Show wallet loaded toast only once when wallet is first loaded
      if (!walletLoadedRef.current) {
        console.log("Action completed");
        walletLoadedRef.current = true;
      }
    }
  }, [walletData?.address, activeTab, fetchTokenHoldings, fetchTransactions]);

  // Fetch transactions when history tab is opened
  useEffect(() => {
    if (activeTab === "history" && walletData?.address) {
      console.log('🔍 History tab opened, fetching transactions...');
      fetchTransactions();
    }
  }, [activeTab, walletData?.address, fetchTransactions]);

  // Fetch user account and ETH price when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchUserAccount();
      fetchEthPrice();
    }
  }, [isOpen, fetchUserAccount, fetchEthPrice]);

  // Close wallet dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showWalletDropdown && !target.closest('.wallet-dropdown-menu')) {
        setShowWalletDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showWalletDropdown]);

  // Safety check to prevent rendering issues - move this after all hooks
  const isClient = typeof window !== 'undefined';
  
  // Safety check to prevent errors when wallet data is corrupted
  const isValidWalletData = walletData && walletData.address && walletData.privateKey;
  
  // Check if we should show loading state
  const shouldShowLoading = !walletData && isOpen;

  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance);
  };

  const getDisplayBalance = () => {
    if (!showBalance) {
      const totalBalance = ethPrice > 0 ? (parseFloat(ethBalance) * ethPrice + tokenHoldings.reduce((sum, token) => sum + (token.usdValue || 0), 0)).toFixed(2) : '0.00';
      return '*'.repeat(totalBalance.length);
    }
    return `$${ethPrice > 0 ? (parseFloat(ethBalance) * ethPrice + tokenHoldings.reduce((sum, token) => sum + (token.usdValue || 0), 0)).toFixed(2) : '0.00'}`;
  };

  const getDisplayEthBalance = () => {
    if (!showBalance) {
      const ethBalanceStr = parseFloat(ethBalance).toFixed(6);
      return '*'.repeat(ethBalanceStr.length);
    }
    return parseFloat(ethBalance).toFixed(6);
  };

  // Handle clicking on a token to show detailed chart
  const handleTokenClick = useCallback(async (token: any) => {
    setSelectedTokenForChart(token);
    setCurrentView('asset-details');
    
    // Fetch real-time price from DexScreener
    if (token.contractAddress) {
      const priceData = await fetchTokenPrice(token.contractAddress);
      if (priceData) {
        setSelectedTokenForChart({
          ...token,
          price: priceData.price,
          priceChange: priceData.priceChange
        });
      }
    }
    
    // Fetch chart data for the token using contract address
    if (token.contractAddress) {
      fetchChartData(token.contractAddress, '1h');
    }
  }, [fetchChartData, fetchTokenPrice]);

  // Handle clicking on ETH balance
  const handleEthClick = useCallback(async () => {
    // Fetch real-time ETH data
    const priceData = await fetchTokenPrice('ethereum');
    
    const ethToken = {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: ethBalance,
      usdValue: priceData ? (parseFloat(ethBalance) * priceData.price).toFixed(2) : '0.00',
      price: priceData ? priceData.price : ethPrice,
      priceChange: priceData ? priceData.priceChange : 0,
      logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
      coinGeckoId: 'ethereum'
    };
    setSelectedTokenForChart(ethToken);
    setCurrentView('asset-details');
    fetchChartData('ethereum', '1h');
  }, [ethBalance, ethPrice, fetchChartData, fetchTokenPrice]);



  // Don't render if not client-side
  if (!isClient) {
    return null;
  }

  // Don't render if wallet data is invalid
  if (walletData && !isValidWalletData) {
    console.error('Invalid wallet data detected');
    return null;
  }

  // Show loading state if needed
  if (shouldShowLoading) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-gray-900/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className="fixed top-20 right-8 w-[400px] bg-gray-900 border border-gray-700 shadow-2xl z-[9999999] max-h-[85vh] overflow-hidden"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-[#0052FF]/20 border-t-[#0052FF] rounded-full animate-spin"></div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Password Modal */}
          {showPasswordModal && (
            <motion.div
              className="fixed inset-0 bg-gray-900/80 z-[9999999] flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-96 max-w-md"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <FaLock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-200">Unlock Wallet</h3>
                    <p className="text-sm text-gray-400">Enter your password to access your wallet</p>
                  </div>
                </div>
                
                <form onSubmit={(e) => {
                  e.preventDefault();
                  unlockWallet(walletPassword);
                }}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={walletPassword}
                      onChange={(e) => setWalletPassword(e.target.value)}
                      className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:border-blue-500"
                      placeholder="Enter your wallet password"
                      autoFocus
                    />
                  </div>
                  
                  {passwordError && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
                      <p className="text-sm text-red-400">{passwordError}</p>
                    </div>
                  )}
                  
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Unlock
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordModal(false);
                        onClose();
                      }}
                      className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
                
                <div className="mt-4 text-center">
                  <button
                    onClick={() => {
                      secureWalletManager.clearWallet();
                      setShowPasswordModal(false);
                      onClose();
                    }}
                    className="text-sm text-gray-400 hover:text-red-400 transition-colors"
                  >
                    Clear Wallet Data
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
          

          <motion.div
            data-wallet-dropdown
                    className={isMobile
              ? "fixed inset-x-0 bottom-0 w-full bg-gray-950 border-t border-slate-700/50 shadow-2xl z-[9999999] h-[75vh] flex flex-col rounded-2xl"
              : "fixed top-20 right-8 w-[400px] bg-gray-950 border border-slate-700/50 shadow-2xl z-[9999999] max-h-[70vh] overflow-hidden rounded-2xl flex flex-col"
        }
            initial={isMobile 
              ? { opacity: 0, y: 100 }
              : { opacity: 0, y: -10, scale: 0.95 }
            }
            animate={isMobile 
              ? { opacity: 1, y: 0 }
              : { opacity: 1, y: 0, scale: 1 }
            }
            exit={isMobile 
              ? { opacity: 0, y: 100 }
              : { opacity: 0, y: -10, scale: 0.95 }
            }
            transition={{ duration: 0.3 }}
          >
            {/* Wallet Header - Blue Section */}
            <div className="bg-[#0052FF] px-4 py-3 border-b border-blue-600/50 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <button
                      onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                      className="flex items-center space-x-1 text-sm text-white hover:text-blue-100 transition-colors"
                    >
                      <span>{userAlias || 'Account 2'}</span>
                      <svg className={`w-3 h-3 transition-transform text-white ${showWalletDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-white">
                      {walletData?.address ? `${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}` : 'Not Connected'}
                    </span>
                    <button
                      onClick={copyAddress}
                      className="text-white hover:text-blue-100 transition-colors"
                    >
                      <FiCopy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="p-2 text-white hover:text-blue-100 transition-colors rounded-lg"
                    title="Settings"
                  >
                    <FiSettings className="w-4 h-4" />
                  </button>
                  {walletData?.address && (
                    <button
                      onClick={() => {
                        const explorerUrl = `/explorer/address/${walletData.address}`;
                        window.open(explorerUrl, '_blank');
                      }}
                      className="p-2 text-white hover:text-blue-100 transition-colors rounded-lg"
                      title="View in Explorer"
                    >
                      <FiExternalLink className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 text-white hover:text-blue-100 transition-colors rounded-lg"
                    title="Close"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Wallet Dropdown Menu */}
            {showWalletDropdown && (
              <div className="wallet-dropdown-menu bg-gray-800 border-b border-gray-700">
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-400 mb-2">Current Wallet</div>
                  <div className="flex items-center justify-between p-2 bg-gray-700 rounded">
                             <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-[#0052FF] rounded-full flex items-center justify-center">
                        <FaWallet className="w-3 h-3 text-white" />
                             </div>
                      <div>
                        <div className="text-sm font-medium text-gray-200">
                          {walletData?.address ? `${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}` : 'No Wallet'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {walletData ? `${parseFloat(ethBalance).toFixed(4)} ETH` : 'Create or import wallet'}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-green-400">Active</div>
                  </div>
                  
                  <div className="mt-3 space-y-1">
                             <button
                      onClick={() => {
                        createWallet();
                        setShowWalletDropdown(false);
                      }}
                      className="w-full text-left p-2 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                               </svg>
                        <span>Create New Wallet</span>
                           </div>
                    </button>
                                  <button
                      onClick={() => {
                        importWallet();
                        setShowWalletDropdown(false);
                      }}
                      className="w-full text-left p-2 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        <span>Import Wallet</span>
                      </div>
                                  </button>
                                    </div>
                                </div>
                              </div>
            )}

            {/* Swap Section - Full Screen */}
            {walletSystem === "self-custodial" && currentSection === 'swap' && !walletLoading && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleBackToMain}
                      className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                    <span className="text-sm text-white">{userAlias || 'Account 1'}</span>
                    <button
                      onClick={copyAddress}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <FiCopy className="w-3 h-3" />
                    </button>
                  </div>
                  <button className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors">
                    <FiSettings className="w-4 h-4" />
                  </button>
                </div>

                {/* Swap UI */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-6">
                  {/* You Pay Card */}
                  <div className="bg-slate-800/50 rounded-2xl p-4 mb-4 border border-slate-700/50">
                    <div className="text-xs text-gray-400 mb-2">You Pay</div>
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={swapPayAmount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setSwapPayAmount(value);
                          if (value && parseFloat(value) > 0 && swapPayToken && swapReceiveToken) {
                            fetchSwapQuote(value, swapPayToken, swapReceiveToken);
                          } else {
                            setSwapReceiveAmount('0');
                          }
                        }}
                        placeholder="0"
                        className="text-3xl font-bold text-white bg-transparent border-none outline-none w-full"
                      />
                      <button 
                        onClick={() => setShowTokenSelector('pay')}
                        className="flex items-center space-x-2 bg-slate-700/50 hover:bg-slate-700 rounded-xl px-3 py-2 border border-slate-600/50"
                      >
                        {swapPayToken.logo ? (
                          <img src={swapPayToken.logo} alt={swapPayToken.symbol} className="w-6 h-6 rounded-full" onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }} />
                        ) : null}
                        <div className={`w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center ${swapPayToken.logo ? 'hidden' : ''}`}>
                          <span className="text-xs text-white font-bold">{swapPayToken.symbol.charAt(0)}</span>
                        </div>
                        <span className="text-sm text-white font-medium">{swapPayToken.symbol}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-gray-400">
                      <span>&lt;0.01</span>
                      <button className="px-2 py-1 hover:text-white transition-colors">50%</button>
                      <button className="px-2 py-1 hover:text-white transition-colors">Max</button>
                      <button className="ml-auto">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-center -my-2 relative z-10">
                    <button
                      onClick={() => {
                        const temp = swapPayToken;
                        setSwapPayToken(swapReceiveToken);
                        setSwapReceiveToken(temp);
                        const tempAmount = swapPayAmount;
                        setSwapPayAmount(swapReceiveAmount);
                        setSwapReceiveAmount(tempAmount);
                      }}
                      className="w-12 h-12 bg-[#0052FF] hover:bg-[#0052FF]/80 rounded-full flex items-center justify-center transition-colors shadow-lg"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </button>
                  </div>

                  {/* You Receive Card */}
                  <div className="bg-slate-800/50 rounded-2xl p-4 mb-4 border border-slate-700/50">
                    <div className="text-xs text-gray-400 mb-2">You Receive</div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-3xl font-bold text-white">
                        {isLoadingQuote ? '...' : swapReceiveAmount || '0'}
                      </div>
                      <button 
                        onClick={() => setShowTokenSelector('receive')}
                        className="flex items-center space-x-2 bg-slate-700/50 hover:bg-slate-700 rounded-xl px-3 py-2 border border-slate-600/50"
                      >
                        {swapReceiveToken.logo ? (
                          <img src={swapReceiveToken.logo} alt={swapReceiveToken.symbol} className="w-6 h-6 rounded-full" onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }} />
                        ) : null}
                        <div className={`w-6 h-6 bg-green-500 rounded-full flex items-center justify-center ${swapReceiveToken.logo ? 'hidden' : ''}`}>
                          <span className="text-xs text-white font-bold">{swapReceiveToken.symbol.charAt(0)}</span>
                        </div>
                        <span className="text-sm text-white font-medium">{swapReceiveToken.symbol}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-xs text-gray-400">0.21</div>
                  </div>

                  {/* Swap Button */}
                  <button
                    onClick={executeSwap}
                    disabled={!swapPayAmount || parseFloat(swapPayAmount) <= 0 || !swapReceiveToken || isSwapping}
                    className="w-full py-4 bg-[#0052FF] hover:bg-[#0052FF]/80 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors mb-4"
                  >
                    {isSwapping ? 'Swapping...' : 'Swap'}
                  </button>
                </div>

                {/* Bottom Tab Navigation */}
                <div className="border-t border-slate-700/50 px-4 py-3 flex items-center justify-around flex-shrink-0">
                    <button
                      onClick={() => {
                        setActiveBottomTab('home');
                        setCurrentSection('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'home' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="text-xs">Home</span>
                    </button>
                    <button
                      onClick={() => setActiveBottomTab('swap')}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'swap' ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      <span className="text-xs">Swap</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('history');
                        setActiveTab('history');
                        setCurrentSection('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'history' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs">History</span>
                    </button>
                    <button
                      onClick={() => setActiveBottomTab('search')}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'search' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="text-xs">Search</span>
                    </button>
                </div>
              </div>
            )}

            <div className={`flex-1 flex flex-col overflow-hidden ${currentSection === 'swap' || activeBottomTab === 'search' ? 'hidden' : ''}`}>
              {/* Wallet Loading State */}
              {walletLoading && (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" text="Loading wallet..." />
                </div>
              )}

              {walletSystem === "self-custodial" && currentSection === 'main' && currentView === 'main' && !walletLoading && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                  {/* Balance Section */}
                  {walletData ? (
                    <div className="px-4 py-6">
                              <div className="flex items-center justify-between mb-3">
                        <span className="text-xl font-bold text-white">
                          {getDisplayBalance()}
                        </span>
                        <button 
                          onClick={toggleBalanceVisibility}
                          className="text-gray-400 hover:text-gray-300 transition-colors duration-200"
                          title={showBalance ? "Hide balance" : "Show balance"}
                        >
                          {showBalance ? (
                            <FaEyeSlash className="w-5 h-5" />
                          ) : (
                            <FaEye className="w-5 h-5" />
                          )}
                        </button>
                                </div>
                                              <div className="flex items-center space-x-2 text-sm text-gray-400">
                          <button 
                            onClick={handleEthClick}
                            className="hover:text-gray-300 transition-colors cursor-pointer"
                            title="Click to view ETH chart"
                          >
                            <span>{getDisplayEthBalance()} ETH</span>
                          </button>
                          <span>•</span>
                          <span>{tokenHoldings.length + (parseFloat(ethBalance) > 0 ? 1 : 0)} tokens</span>
                          <span>•</span>
                          <span className="text-red-400">-0.45%</span>
                        </div>
                                </div>
                  ) : (
                    <div className="px-4 py-6 bg-gray-800 text-center">
                      <div className="w-16 h-16 bg-[#0052FF]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaWallet className="w-8 h-8 text-[#0052FF]" />
                                </div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-2">Welcome to CypherX</h3>
                      <p className="text-gray-400 mb-6">Create or import your wallet to get started</p>
                      <div className="space-y-3">
                             <button
                               onClick={importWallet}
                          className="w-full py-3 px-4 bg-[#0052FF] hover:bg-[#0052FF]/80 text-white rounded-lg font-medium transition-colors"
                             >
                          Import Wallet
                             </button>
                                                            <button
                               onClick={createWallet}
                          className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors"
                        >
                          Create New Wallet
                               </button>
                           </div>
                         </div>
                       )}

                  {/* Quick Actions */}
                  {walletData && (
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                              <button
                          onClick={handleBuySell}
                          className="flex flex-col items-center flex-1"
                        >
                          <div className="w-12 h-12 bg-[#0052FF] rounded-full flex items-center justify-center mb-2 hover:bg-[#0052FF]/80 transition-colors">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <span className="text-xs text-white">Buy</span>
                        </button>
                              <button
                          onClick={handleSwap}
                          className="flex flex-col items-center flex-1"
                        >
                          <div className="w-12 h-12 bg-[#0052FF] rounded-full flex items-center justify-center mb-2 hover:bg-[#0052FF]/80 transition-colors">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </div>
                          <span className="text-xs text-white">Swap</span>
                              </button>
                              <button
                          onClick={handleSend}
                          className="flex flex-col items-center flex-1"
                        >
                          <div className="w-12 h-12 bg-[#0052FF] rounded-full flex items-center justify-center mb-2 hover:bg-[#0052FF]/80 transition-colors">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          </div>
                          <span className="text-xs text-white">Send</span>
                        </button>
                                 <button
                          onClick={handleReceive}
                          className="flex flex-col items-center flex-1"
                        >
                          <div className="w-12 h-12 bg-[#0052FF] rounded-full flex items-center justify-center mb-2 hover:bg-[#0052FF]/80 transition-colors">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </div>
                          <span className="text-xs text-white">Receive</span>
                                 </button>
                               </div>
                          </div>
                        )}

                  {/* Navigation Tabs */}
                  <div className="px-4 py-3 border-b border-slate-700/50 rounded-t-lg">
                    <div className="flex space-x-6">
                            <button
                        onClick={() => setActiveTab("overview")}
                        className={`pb-2 text-sm border-b-2 transition-colors ${
                          activeTab === "overview" 
                            ? "text-blue-400 border-blue-400" 
                            : "text-gray-400 border-transparent hover:text-gray-300"
                        }`}
                      >
                        Tokens
                            </button>
                            <button
                        onClick={() => setActiveTab("history")}
                        className={`pb-2 text-sm border-b-2 transition-colors ${
                          activeTab === "history" 
                            ? "text-blue-400 border-blue-400" 
                            : "text-gray-400 border-transparent hover:text-gray-300"
                        }`}
                      >
                        Activity
                      </button>
                              </div>
                  </div>

                  {/* Content Sections */}
                  {activeTab === "overview" && (
                    <div className="px-4 py-4 h-96 overflow-y-auto scrollbar-hide">
                      {/* Network Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-300">Base Network</span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        <button className="text-gray-400 hover:text-blue-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                          </svg>
                        </button>
                      </div>

                      

                       {/* Token List */}
                       {(tokenHoldings.length > 0 || parseFloat(ethBalance) > 0) ? (
                        <div className="space-y-3">
                                                    {/* ETH Balance Error State */}
                          {balanceError && (
                            <div className="p-4">
                              <ErrorDisplay 
                                error={balanceError} 
                                variant="card" 
                                onRetry={() => walletData?.address && fetchBalance(walletData.address)}
                              />
                            </div>
                          )}

                          {/* ETH Balance - Always show first if balance > 0 */}
                          {parseFloat(ethBalance) > 0 && !balanceError && (
                            <div 
                              onClick={handleEthClick}
                              className="flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50 transition-all duration-200 group cursor-pointer"
                              title="Click to view ETH chart"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden">
                                  <img 
                                    src="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
                                    alt="ETH"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMxRjFGMjMiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMiA3TDEyIDEyTDIyIDdMMTIgMloiIGZpbGw9IiM2QjcyODAiLz4KPHBhdGggZD0iTTIgMTdMMTIgMjJMMjIgMTdMMTIgMTJMMiAxN1oiIGZpbGw9IiM2QjcyODAiLz4KPHBhdGggZD0iTTIgMTJMMTIgMTdMMjIgMTJMMiAxNloiIGZpbGw9IiM2QjcyODAiLz4KPC9zdmc+Cjwvc3ZnPg==';
                                    }}
                                  />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-200">ETH</div>
                                  <div className="text-xs text-gray-400">
                                    {getDisplayEthBalance()} ETH
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-200">
                                    ${ethPrice > 0 ? (parseFloat(ethBalance) * ethPrice).toFixed(2) : '0.00'}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    ${ethPrice > 0 ? ethPrice.toFixed(2) : '0.00'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Token Holdings Loading State */}
                          {isLoadingHoldings && (
                            <div className="flex items-center justify-center py-8">
                              <LoadingSpinner size="md" text="Loading token holdings..." />
                            </div>
                          )}

                          {/* Token Holdings Error State */}
                          {holdingsError && !isLoadingHoldings && (
                            <div className="p-4">
                              <ErrorDisplay 
                                error={holdingsError} 
                                variant="card" 
                                onRetry={fetchTokenHoldings}
                              />
                            </div>
                          )}

                          {/* Other Token Holdings */}
                          {!isLoadingHoldings && !holdingsError && tokenHoldings
                            .filter(token => !hiddenTokens.has(token.contractAddress))
                            .map((token, index) => (
                            <div 
                              key={token.contractAddress || index} 
                              onClick={() => handleTokenClick(token)}
                              className="flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50 transition-all duration-200 group cursor-pointer"
                              title={`Click to view ${token.symbol} chart`}
                            >
                                                             <div className="flex items-center space-x-3">
                                 <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                                   {token.logo ? (
                                     <img 
                                       src={token.logo} 
                                       alt={token.symbol}
                                       className="w-full h-full object-cover"
                                       onError={(e) => {
                                         e.currentTarget.style.display = 'none';
                                         const fallback = e.currentTarget.parentElement?.querySelector('.token-fallback');
                                         if (fallback) {
                                           fallback.classList.remove('hidden');
                                         }
                                       }}
                                     />
                                   ) : null}
                                   <div className={`token-fallback w-full h-full flex items-center justify-center text-white font-medium text-sm ${token.logo ? 'hidden' : ''}`}>
                                     {(token.name || token.symbol || 'T').charAt(0).toUpperCase()}
                                   </div>
                                 </div>
                                                         <div className="flex items-center space-x-2">
                               <div>
                                 <div className="text-sm font-medium text-gray-200">{token.name || token.symbol}</div>
                                 <div className="text-xs text-gray-400">
                                   {parseFloat(token.tokenBalance || '0').toFixed(4)} {token.symbol}
                                 </div>
                               </div>
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   toggleTokenVisibility(token.contractAddress);
                                 }}
                                 className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-300 transition-opacity"
                                 title="Hide token"
                               >
                                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                 </svg>
                               </button>
                             </div>
                              </div>
                                                             <div className="text-right">
                                 <div className="text-sm font-medium text-gray-200">
                                   ${token.usdValue ? parseFloat(token.usdValue).toFixed(2) : '0.00'}
                                 </div>
                                 <div className="text-xs text-gray-400">
                                   ${token.priceUsd ? parseFloat(token.priceUsd).toFixed(2) : '0.00'}
                                 </div>
                               </div>
                        </div>
                          ))}
                          
                          {/* Show hidden tokens count */}
                          {hiddenTokens.size > 0 && (
                            <div className="text-center py-2">
                                  <button
                                onClick={showAllTokens}
                                className="text-xs text-gray-400 hover:text-gray-300 underline"
                                  >
                                Show {hiddenTokens.size} hidden token{hiddenTokens.size !== 1 ? 's' : ''}
                                  </button>
                                    </div>
                                  )}
                                </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="w-20 h-20 bg-slate-700/30 rounded-lg flex items-center justify-center mx-auto mb-4 border border-slate-600/50">
                            <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <p className="text-sm font-medium text-gray-300 mb-2">
                            No tokens found
                          </p>
                          <p className="text-xs text-gray-500">
                            Your tokens will appear here
                          </p>
                              </div>
                      )}
                      </div>
                    )}

                        {activeTab === "history" && !walletLoading && (
                    <div className="px-4 py-4 h-96 overflow-y-auto scrollbar-hide">
                          <div className="space-y-3">
                            {isLoadingTransactions ? (
                              <div className="flex items-center justify-center py-8">
                                <LoadingSpinner size="md" text="Loading transactions..." />
                              </div>
                            ) : transactionsError ? (
                              <div className="p-4">
                                <ErrorDisplay 
                                  error={transactionsError} 
                                  variant="card" 
                                  onRetry={fetchTransactions}
                                />
                              </div>
                            ) : transactions.length > 0 ? (
                          <div className="space-y-3">
                                {transactions.map((tx, index) => (
                              <div key={tx.hash || tx.id || index} className="flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50 transition-all duration-200">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-2 h-2 rounded-full ${
                                        tx.status === 'confirmed' ? 'bg-green-400' :
                                        tx.status === 'pending' ? 'bg-yellow-400' :
                                        'bg-red-400'
                                      }`}></div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-200">
                                            {tx.type === 'incoming' ? 'Received' : tx.type === 'outgoing' ? 'Sent' : tx.type === 'buy' ? 'Buy' : tx.type === 'sell' ? 'Sell' : 'Transaction'}
                                        </div>
                                    <div className="text-xs text-gray-400">
                                            {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric'
                                            }) + ' ' + new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown'}
                                        </div>
                                      </div>
                                    </div>
                                <div className="text-right">
                                  <div className={`text-sm font-medium ${tx.type === 'incoming' ? 'text-green-400' : tx.type === 'outgoing' ? 'text-red-400' : 'text-gray-200'}`}>
                                    {tx.type === 'incoming' ? '+' : tx.type === 'outgoing' ? '-' : ''}{tx.amount && parseFloat(tx.amount) > 0 ? `${parseFloat(tx.amount) < 0.0001 ? parseFloat(tx.amount).toExponential(2) : parseFloat(tx.amount).toFixed(6)} ${tx.token || 'ETH'}` : `0 ${tx.token || 'ETH'}`}
                                  </div>
                                  {tx.usdValue && parseFloat(tx.usdValue) > 0 && (
                                    <div className="text-xs text-gray-400">
                                      ${parseFloat(tx.usdValue).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                  <FaDownload className="w-6 h-6 text-gray-500" />
                                </div>
                                <p className="text-sm text-gray-400">No transactions found</p>
                                <p className="text-xs text-gray-500 mt-1">Your transaction history will appear here</p>
                              </div>
                                                         )}
                           </div>
                 </div>
               )}

               {/* Settings Tab */}
               {activeTab === "settings" && !walletLoading && (
                    <div className="px-4 py-4 space-y-4">
                   {/* Security Settings */}
                      <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                        <h4 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                         </svg>
                          Security & Backup
                        </h4>
                     
                       {/* Private Key Management */}
                        <div className="mb-6">
                         <div className="flex items-center justify-between mb-3">
                             <span className="text-sm font-medium text-gray-200">Private Key</span>
                           <button
                             onClick={() => setShowPrivateKey(!showPrivateKey)}
                              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600 transition-colors"
                           >
                             {showPrivateKey ? "Hide" : "Reveal"}
                           </button>
                         </div>
                         
                         {showPrivateKey && walletData && (
                            <div className="p-3 bg-gray-800 rounded border border-gray-600">
                              <div className="text-xs text-gray-300 mb-2 font-medium flex items-center">
                                <svg className="w-3 h-3 mr-1 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                WARNING: Keep this private and secure!
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-mono text-gray-300 break-all bg-gray-900 p-2 rounded border border-gray-700 flex-1 mr-2">
                                 {walletData.privateKey}
                               </div>
                               <button
                                 onClick={copyPrivateKey}
                                 className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600 transition-colors"
                                 title="Copy private key"
                               >
                                 Copy
                               </button>
                             </div>
                           </div>
                         )}
                       </div>

                       {/* Backup Wallet */}
                        <div className="mb-6">
                         <div className="flex items-center justify-between mb-3">
                             <span className="text-sm font-medium text-gray-200">Backup Wallet</span>
                           <button
                             onClick={handleBackup}
                              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600 transition-colors"
                           >
                             Download
                           </button>
                         </div>
                         <p className="text-xs text-gray-400">Download a secure backup file of your wallet</p>
                       </div>

                       {/* Import Wallet */}
                        <div className="mb-6">
                         <div className="flex items-center justify-between mb-3">
                             <span className="text-sm font-medium text-gray-200">Import Wallet</span>
                           <button
                             onClick={handleImport}
                              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600 transition-colors"
                           >
                             Import
                           </button>
                         </div>
                         <p className="text-xs text-gray-400">Import an existing wallet from backup file</p>
                   </div>

                        {/* Clear Wallet */}
                        <div>
                          <button
                            onClick={handleClearWallet}
                            className="w-full p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded border border-gray-600 transition-colors text-left"
                          >
                            <div className="flex items-center justify-between">
                              <span>Clear Wallet Data</span>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                         </svg>
                       </div>
                            <p className="text-xs text-gray-400 mt-1">Remove wallet from this device</p>
                          </button>
                     </div>
                     
                        {/* Wallet Creation Date */}
                        <div className="mt-6 pt-4 border-t border-gray-700">
                          <div className="flex justify-between items-center">
                         <span className="text-sm text-gray-400">Created</span>
                         <span className="text-sm font-medium text-gray-200">
                           {walletData ? new Date(walletData.createdAt || Date.now()).toLocaleDateString() : 'Unknown'}
                         </span>
                       </div>
                     </div>
                   </div>
                    </div>
                  )}
                  </div>
                  
                  {/* Bottom Tab Navigation */}
                  <div className="border-t border-slate-700/50 px-4 py-3 flex items-center justify-around flex-shrink-0">
                    <button
                      onClick={() => {
                        setActiveBottomTab('home');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'home' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="text-xs">Home</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('swap');
                        setCurrentSection('swap');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'swap' ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      <span className="text-xs">Swap</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('history');
                        setActiveTab('history');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'history' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs">History</span>
                    </button>
                    <button
                      onClick={() => setActiveBottomTab('search')}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'search' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="text-xs">Search</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Asset Details Section */}
              {walletSystem === "self-custodial" && currentSection === 'main' && currentView === 'asset-details' && selectedTokenForChart && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleBackToMain}
                        className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <FaArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-200">
                          {selectedTokenForChart.symbol}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {(selectedTokenForChart.contractAddress || selectedTokenForChart.symbol === 'ETH') && (
                        <button
                          onClick={() => {
                            console.log("Copy button clicked!");
                            console.log("selectedTokenForChart:", selectedTokenForChart);
                            
                            let addressToCopy = '';
                            if (selectedTokenForChart.contractAddress) {
                              addressToCopy = selectedTokenForChart.contractAddress;
                            } else if (selectedTokenForChart.symbol === 'ETH') {
                              addressToCopy = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
                            }
                            
                            console.log("Address to copy:", addressToCopy);
                            if (addressToCopy) {
                              copyTokenAddress(addressToCopy);
                            } else {
                              console.error("No address found to copy");
                              console.error("Action failed");
                            }
                          }}
                          className={`p-2 rounded-lg transition-colors active:bg-gray-700 ${
                            copiedAddress 
                              ? 'text-green-400 bg-green-900/20' 
                              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                          }`}
                          title={copiedAddress ? "Address copied!" : "Copy token address"}
                        >
                          {copiedAddress ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                            </svg>
                          )}
                        </button>
                      )}
                      <button className="p-2 text-gray-400 hover:text-gray-300">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Price Display */}
                  <div className="mb-6">
                    <div className="text-3xl font-bold text-gray-200 mb-2">
                      {formatTokenPrice(selectedTokenForChart.price || 0)}
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className={`${(selectedTokenForChart.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(selectedTokenForChart.priceChange || 0) >= 0 ? '▲' : '▼'} {Math.abs(selectedTokenForChart.priceChange || 0).toFixed(2)}%
                      </span>
                      <span className="text-gray-400">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="mb-6">
                    <div className="h-48 bg-gray-900 rounded-lg p-4">
                      {isLoadingChart ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="w-8 h-8 border-2 border-[#0052FF]/20 border-t-[#0052FF] rounded-full animate-spin"></div>
                        </div>
                      ) : chartData.length > 0 ? (
                        <div className="h-full flex items-center justify-center">
                          <Sparklines data={getSparklineData()} width={300} height={120} margin={5}>
                            <SparklinesLine
                              color="#3B82F6"
                              style={{ strokeWidth: 2 }}
                            />
                            <SparklinesCurve
                              color="#3B82F6"
                              style={{ fill: "url(#gradient)", opacity: 0.3 }}
                            />
                          </Sparklines>
                          <svg width="0" height="0">
                            <defs>
                              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center text-gray-400 text-sm">
                            No chart data available
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Time Period Selector */}
                    <div className="flex justify-center space-x-1 mt-4">
                      {(['15m', '1h', '4h', '1d'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => {
                            setSelectedTimeframe(period);
                            if (selectedTokenForChart.contractAddress) {
                              fetchChartData(selectedTokenForChart.contractAddress, period);
                            } else if (selectedTokenForChart.symbol === 'ETH') {
                              fetchChartData('ethereum', period);
                            }
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            selectedTimeframe === period
                              ? 'bg-gray-700 text-white shadow-lg shadow-gray-700/25'
                              : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                    

                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    <div className="bg-gray-800 p-2 rounded-xl border border-gray-600 shadow-lg">
                      <button 
                        onClick={() => {
                          setCurrentSection('buy');
                          setCurrentView('main');
                        }}
                        className="flex flex-col items-center p-3 bg-gray-800 rounded-lg transition-colors w-full"
                      >
                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mb-2">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Buy/Sell</span>
                      </button>
                    </div>
                    <div className="bg-gray-800 p-2 rounded-xl border border-gray-600 shadow-lg">
                      <button 
                        onClick={() => {
                          setCurrentSection('swap');
                          setCurrentView('main');
                        }}
                        className="flex flex-col items-center p-3 bg-gray-800 rounded-lg transition-colors w-full"
                      >
                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mb-2">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Swap</span>
                      </button>
                    </div>
                    <div className="bg-gray-800 p-2 rounded-xl border border-gray-600 shadow-lg">
                      <button 
                        onClick={() => {
                          setCurrentSection('send');
                          setSelectedToken(selectedTokenForChart.symbol || 'ETH');
                          setCurrentView('main');
                        }}
                        className="flex flex-col items-center p-3 bg-gray-800 rounded-lg transition-colors w-full"
                      >
                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mb-2">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Send</span>
                      </button>
                    </div>
                    <div className="bg-gray-800 p-2 rounded-xl border border-gray-600 shadow-lg">
                      <button 
                        onClick={() => {
                          setCurrentSection('receive');
                          setCurrentView('main');
                        }}
                        className="flex flex-col items-center p-3 bg-gray-800 rounded-lg transition-colors w-full"
                      >
                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mb-2">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Receive</span>
                      </button>
                    </div>
                  </div>

                  {/* Your Balance Section */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-200 mb-3">Your balance</h4>
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <img 
                          src={selectedTokenForChart.logo || `https://ui-avatars.com/api/?name=${selectedTokenForChart.symbol}&background=1f2937&color=60a5fa&size=32`}
                          alt={selectedTokenForChart.symbol}
                          className="w-8 h-8 rounded-full"
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${selectedTokenForChart.symbol}&background=1f2937&color=60a5fa&size=32`;
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-200">
                            {selectedTokenForChart.name || selectedTokenForChart.symbol}
                          </div>
                          <div className={`flex items-center space-x-1 text-xs ${(selectedTokenForChart.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            <span>{(selectedTokenForChart.priceChange || 0) >= 0 ? '▲' : '▼'}</span>
                            <span>{Math.abs(selectedTokenForChart.priceChange || 0).toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-200">
                          {formatUSDValue(parseFloat(selectedTokenForChart.usdValue || '0'))}
                        </div>
                        <div className="text-xs text-gray-400">
                          {parseFloat(selectedTokenForChart.balance || '0').toFixed(6)} {selectedTokenForChart.symbol}
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                  
                  {/* Bottom Tab Navigation */}
                  <div className="border-t border-slate-700/50 px-4 py-3 flex items-center justify-around flex-shrink-0">
                    <button
                      onClick={() => {
                        setActiveBottomTab('home');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'home' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="text-xs">Home</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('swap');
                        setCurrentSection('swap');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'swap' ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      <span className="text-xs">Swap</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('history');
                        setActiveTab('history');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'history' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs">History</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('search');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'search' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="text-xs">Search</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Search Section */}
              {walletSystem === "self-custodial" && activeBottomTab === 'search' && !walletLoading && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
                    {/* Search Header */}
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-white mb-2">Search</h3>
                      <p className="text-xs text-gray-400">Search for tokens, addresses, transactions, and blocks</p>
                    </div>

                    {/* Search Input */}
                    <div className="mb-4">
                      <div className="relative">
                        <input
                          type="text"
                          value={tokenSearchQuery}
                          onChange={(e) => setTokenSearchQuery(e.target.value)}
                          placeholder="Search by name, symbol, or address..."
                          className="w-full px-4 py-3 pl-10 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>

                    {/* Search Results */}
                    <div className="space-y-4">
                      {isSearchingTokens ? (
                        <div className="flex items-center justify-center py-8">
                          <LoadingSpinner size="md" text="Searching..." />
                        </div>
                      ) : tokenSearchResults.length > 0 ? (
                        <div>
                          <div className="text-sm font-medium text-gray-400 mb-3">
                            Tokens ({tokenSearchResults.length})
                          </div>
                          <div className="space-y-2">
                            {tokenSearchResults.map((token: any) => (
                              <div
                                key={token.address}
                                onClick={() => {
                                  // Navigate to token page or select token
                                  window.location.href = `/explore/${token.poolAddress || token.address}`;
                                }}
                                className="flex items-center space-x-3 p-3 bg-slate-800/50 hover:bg-slate-800/70 rounded-xl transition-colors cursor-pointer border border-slate-700/50"
                              >
                                {token.logo ? (
                                  <img 
                                    src={token.logo} 
                                    alt={token.symbol} 
                                    className="w-10 h-10 rounded-full" 
                                    onError={(e) => {
                                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.symbol}&background=0052FF&color=fff&size=40`;
                                    }} 
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                    <span className="text-sm text-white font-bold">{token.symbol?.charAt(0) || 'T'}</span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-white">{token.symbol}</span>
                                    {token.priceUsd && (
                                      <span className="text-xs text-gray-400">
                                        ${parseFloat(token.priceUsd).toFixed(6)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-400 truncate">{token.name}</div>
                                  <div className="text-xs text-gray-500 font-mono truncate">
                                    {token.address?.slice(0, 6)}...{token.address?.slice(-4)}
                                  </div>
                                </div>
                                {token.priceChange && (
                                  <div className={`text-xs font-medium ${
                                    parseFloat(token.priceChange.h24 || '0') >= 0 ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {parseFloat(token.priceChange.h24 || '0') >= 0 ? '+' : ''}
                                    {parseFloat(token.priceChange.h24 || '0').toFixed(2)}%
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : tokenSearchQuery.length >= 2 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <p className="text-gray-400 text-sm">No results found</p>
                          <p className="text-gray-500 text-xs mt-1">Try a different search term</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12">
                          <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <p className="text-gray-400 text-sm">Start searching</p>
                          <p className="text-gray-500 text-xs mt-1">Enter a token name, symbol, or address</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Tab Navigation */}
                  <div className="border-t border-slate-700/50 px-4 py-3 flex items-center justify-around flex-shrink-0">
                    <button
                      onClick={() => {
                        setActiveBottomTab('home');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'home' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="text-xs">Home</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('swap');
                        setCurrentSection('swap');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'swap' ? 'text-blue-400 border-b-2 border-blue-400 pb-1' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      <span className="text-xs">Swap</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('history');
                        setActiveTab('history');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'history' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs">History</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('search');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${activeBottomTab === 'search' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="text-xs">Search</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Send Section */}
              {walletSystem === "self-custodial" && currentSection === 'send' && !walletLoading && (
                <div className="px-4 py-4">
                     <div className="flex items-center space-x-3 mb-4">
                    <button
                      onClick={handleBackToMain}
                      className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                         </svg>
                    </button>
                    <h3 className="text-lg font-semibold text-gray-200">Send</h3>
                       </div>

                  <div className="space-y-4">
                    {/* Token Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Token</label>
                      <select
                        value={selectedToken}
                        onChange={(e) => setSelectedToken(e.target.value)}
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-[#0052FF]"
                      >
                        <option value="ETH">ETH</option>
                        {tokenHoldings.map((token) => (
                          <option key={token.contractAddress} value={token.symbol}>
                            {token.symbol}
                          </option>
                        ))}
                      </select>
                     </div>
                     
                    {/* Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Amount</label>
                      <input
                        type="number"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-[#0052FF]"
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        Balance: {selectedToken === 'ETH' ? parseFloat(ethBalance).toFixed(6) : 
                          tokenHoldings.find(t => t.symbol === selectedToken)?.tokenBalance || '0'} {selectedToken}
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">To Address</label>
                      <input
                        type="text"
                        value={sendAddress}
                        onChange={(e) => setSendAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-[#0052FF]"
                      />
                    </div>

                    {/* Send Button */}
                       <button
                      onClick={handleSendTransaction}
                      className="w-full py-3 px-4 bg-[#0052FF] hover:bg-[#0052FF]/80 text-white rounded-lg font-medium transition-colors"
                    >
                      Send {selectedToken}
                       </button>
                   </div>
                 </div>
               )}

              {/* Receive Section */}
              {walletSystem === "self-custodial" && currentSection === 'receive' && !walletLoading && (
                <div className="px-4 py-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <button
                      onClick={handleBackToMain}
                      className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h3 className="text-lg font-semibold text-gray-200">Receive</h3>
                  </div>

                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-[#0052FF]/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                           </svg>
                         </div>
                    
                    <div>
                      <h4 className="text-lg font-medium text-gray-200 mb-2">Your Wallet Address</h4>
                      <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                        <div className="text-sm font-mono text-gray-300 break-all">
                          {walletData ? walletData.address : 'No wallet loaded'}
                         </div>
                       </div>
                     </div>

                    <button
                      onClick={copyAddress}
                      className="w-full py-3 px-4 bg-[#0052FF] hover:bg-[#0052FF]/80 text-white rounded-lg font-medium transition-colors"
                    >
                      Copy Address
                    </button>
                         </div>
                       </div>
              )}

              {/* Buy/Sell Section */}
              {walletSystem === "self-custodial" && currentSection === 'buy' && (
                <div className="px-4 py-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <button
                      onClick={handleBackToMain}
                      className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                           </svg>
                    </button>
                    <h3 className="text-lg font-semibold text-gray-200">Buy/Sell</h3>
                         </div>

                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-[#0052FF]/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                       </div>
                    
                         <div>
                      <h4 className="text-lg font-medium text-gray-200 mb-2">Buy & Sell Tokens</h4>
                      <p className="text-gray-400">Advanced trading functionality coming soon</p>
                         </div>

                    <button
                      onClick={() => window.location.href = '/explore'}
                      className="w-full py-3 px-4 bg-[#0052FF] hover:bg-[#0052FF]/80 text-white rounded-lg font-medium transition-colors"
                    >
                      Go to Trade Page
                    </button>
                     </div>
                   </div>
                 )}
             </div>
           </motion.div>
        </>
      )}

      {/* Copy Notification */}
      <AnimatePresence>
        {showCopyNotification && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-6 z-[99999999] bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-lg px-4 py-3 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <FiCheck className="w-4 h-4 text-green-400" />
              <span className="text-white text-sm">Address copied to clipboard</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </AnimatePresence>
  );
};

const WalletDropdownWithErrorBoundary: React.FC<WalletDropdownProps> = (props) => {
  return (
    <WalletDropdownErrorBoundary>
      <WalletDropdown {...props} />
    </WalletDropdownErrorBoundary>
  );
};

export default WalletDropdownWithErrorBoundary;

