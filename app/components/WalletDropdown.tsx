"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { FaWallet, FaDownload, FaEye, FaEyeSlash, FaArrowLeft, FaLock } from "react-icons/fa";
import { FiSettings, FiExternalLink, FiX, FiCopy, FiCheck } from "react-icons/fi";
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

const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
const ERC20_ABI = ["function transfer(address to, uint256 value) returns (bool)"];

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
  const [sendToken, setSendToken] = useState<{symbol: string; address: string; logo?: string; name?: string}>({symbol: 'ETH', address: '0x4200000000000000000000000000000000000006', name: 'Ethereum'});
  const [showBalance, setShowBalance] = useState(true);

  const [selectedTokenForChart, setSelectedTokenForChart] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'main' | 'asset-details'>('main');
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'15m' | '1h' | '4h' | '1d'>('1h');
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const walletLoadedRef = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string>("");
  const [sendTxHash, setSendTxHash] = useState<string | null>(null);
  
  // Swap state
  const [swapPayAmount, setSwapPayAmount] = useState<string>('0');
  const [swapReceiveAmount, setSwapReceiveAmount] = useState<string>('0');
  const [swapPayToken, setSwapPayToken] = useState<{symbol: string; address: string; logo?: string}>({symbol: 'ETH', address: '0x4200000000000000000000000000000000000006'});
  const [swapReceiveToken, setSwapReceiveToken] = useState<{symbol: string; address: string; logo?: string}>({symbol: 'USDC', address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'});
  const [swapQuote, setSwapQuote] = useState<any>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'home' | 'swap' | 'history' | 'send'>('home');
  const [tokenSearchQuery, setTokenSearchQuery] = useState<string>('');
  const [tokenSearchResults, setTokenSearchResults] = useState<any[]>([]);
  const [isSearchingTokens, setIsSearchingTokens] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [selectingTokenFor, setSelectingTokenFor] = useState<'pay' | 'receive' | 'send'>('pay');
  const [availableTokens, setAvailableTokens] = useState<any[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [recentTokens, setRecentTokens] = useState<Array<{symbol: string; address: string; logo?: string; name?: string}>>([]);

  const isClient = typeof window !== 'undefined';

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (walletData) {
      setShowOnboarding(false);
    }
  }, [walletData]);

  // Prevent background scroll when mobile sheet is open
  useEffect(() => {
    if (!isClient) return;
    const originalOverflow = document.body.style.overflow;

    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isMobile, isClient]);

  // ETH token
  const ETH_TOKEN = { symbol: 'ETH', address: '0x4200000000000000000000000000000000000006', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' };

  // Load recent tokens from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cypherx_recent_tokens');
      if (stored) {
        try {
          setRecentTokens(JSON.parse(stored));
        } catch (e) {
          console.error('Error loading recent tokens:', e);
        }
      }
    }
  }, []);

  // Save token to recent tokens
  const addToRecentTokens = useCallback((token: {symbol: string; address: string; logo?: string; name?: string}) => {
    if (typeof window === 'undefined') return;
    
    setRecentTokens(prev => {
      // Remove if already exists
      const filtered = prev.filter(t => t.address.toLowerCase() !== token.address.toLowerCase());
      // Add to beginning, limit to 10
      const updated = [token, ...filtered].slice(0, 10);
      localStorage.setItem('cypherx_recent_tokens', JSON.stringify(updated));
      return updated;
    });
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

  // Load available tokens (ETH + recent tokens)
  const loadAvailableTokens = useCallback(async () => {
    setIsLoadingTokens(true);
    try {
      // Start with ETH
      const tokens = [ETH_TOKEN];
      
      // Add recent tokens (excluding ETH if it's already there)
      recentTokens.forEach((token) => {
        if (token.address.toLowerCase() !== ETH_TOKEN.address.toLowerCase() && 
            !tokens.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
          tokens.push({
            symbol: token.symbol,
            address: token.address,
            name: token.name || token.symbol,
            logo: token.logo || ''
          });
        }
      });
      
      setAvailableTokens(tokens);
    } catch (error) {
      console.error('Error loading tokens:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  }, [recentTokens]);

  // Get token logo from DexScreener
  const getTokenLogo = useCallback(async (tokenAddress: string): Promise<string | undefined> => {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const pair = data.pairs[0];
          return pair.baseToken?.logoURI || pair.quoteToken?.logoURI || undefined;
        }
      }
    } catch (error) {
      console.error('Error fetching token logo:', error);
    }
    return undefined;
  }, []);

  // Search tokens
  const searchTokens = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setTokenSearchResults([]);
      return;
    }

    setIsSearchingTokens(true);
    try {
      // Search by address
      if (query.startsWith('0x') && query.length === 42) {
        try {
          const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${query}`);
          const data = await response.json();
          
          if (data.pairs && data.pairs.length > 0) {
            const pair = data.pairs[0];
            const logo = pair.baseToken?.logoURI || pair.quoteToken?.logoURI || undefined;
            setTokenSearchResults([{
              symbol: pair.baseToken?.symbol || 'UNKNOWN',
              address: query,
              name: pair.baseToken?.name || 'Unknown Token',
              logo: logo
            }]);
          } else {
            setTokenSearchResults([]);
          }
        } catch (error) {
          console.error('Error searching token by address:', error);
          setTokenSearchResults([]);
        }
        setIsSearchingTokens(false);
        return;
      }

      // Search by symbol/name using DexScreener
      const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        // Filter for Base chain and get unique tokens
        const basePairs = data.pairs.filter((pair: any) => 
          pair.chainId === 'base' || pair.chainId === '8453'
        );
        
        const uniqueTokens = new Map();
        basePairs.forEach((pair: any) => {
          const tokenAddress = pair.baseToken?.address?.toLowerCase();
          if (tokenAddress && !uniqueTokens.has(tokenAddress)) {
            const logo = pair.baseToken?.logoURI || pair.quoteToken?.logoURI || undefined;
            uniqueTokens.set(tokenAddress, {
              symbol: pair.baseToken?.symbol || 'UNKNOWN',
              address: pair.baseToken?.address,
              name: pair.baseToken?.name || pair.baseToken?.symbol || 'Unknown Token',
              logo: logo
            });
          }
        });
        
        setTokenSearchResults(Array.from(uniqueTokens.values()).slice(0, 20));
      } else {
        setTokenSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching tokens:', error);
      setTokenSearchResults([]);
    } finally {
      setIsSearchingTokens(false);
    }
  }, []);

  // Handle token search input
  useEffect(() => {
    if (showTokenSelector && tokenSearchQuery) {
      const timeoutId = setTimeout(() => {
        searchTokens(tokenSearchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (showTokenSelector && !tokenSearchQuery) {
      setTokenSearchResults([]);
    }
  }, [tokenSearchQuery, showTokenSelector, searchTokens]);

  // Load tokens when selector opens
  useEffect(() => {
    if (showTokenSelector) {
      loadAvailableTokens();
      setTokenSearchQuery('');
      setTokenSearchResults([]);
    }
  }, [showTokenSelector, loadAvailableTokens]);

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
    if (typeof window === "undefined") return;

    let foundWallet = false;

    try {
      setWalletLoading(true);

      if (secureWalletManager.hasWallet()) {
        const address = secureWalletManager.getWalletAddress();
        if (address) {
          foundWallet = true;
          setShowOnboarding(false);

          setSelfCustodialWallet({
            address,
            isConnected: true,
            ethBalance: "0.0",
            tokenBalance: "0.0"
          });

          setShowPasswordModal(true);
        }
      } else {
        const storedWallet = localStorage.getItem("cypherx_wallet");
        if (storedWallet) {
          try {
            const data = JSON.parse(storedWallet);
            if (data?.address && data?.privateKey) {
              foundWallet = true;
              setWalletData(data);
              setSelfCustodialWallet({
                address: data.address,
                isConnected: true,
                ethBalance: "0.0",
                tokenBalance: "0.0"
              });
              fetchBalance(data.address);
              fetchTransactions();
              setShowOnboarding(false);
            }
          } catch (error) {
            console.error("Error loading wallet:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error in loadWallet:", error);
    } finally {
      setWalletLoading(false);
      if (!foundWallet) {
        setWalletData(null);
      }
      setShowOnboarding(!foundWallet);
    }
  }, [setSelfCustodialWallet, fetchBalance, fetchTransactions, setWalletLoading, setShowOnboarding]);

  // Unlock wallet with password
  const unlockWallet = useCallback(async (password: string) => {
    try {
      setPasswordError('');
      const wallet = await secureWalletManager.unlockWallet(password);
      
      if (wallet) {
        
        setShowPasswordModal(false);
        setWalletPassword('');
        setShowOnboarding(false);
        setWalletLoading(false);

        if (wallet.address) {
          setWalletData({
            address: wallet.address,
            privateKey: wallet.privateKey ?? '__secured__',
            createdAt: Date.now()
          });
        }
        
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
            
            // Dispatch custom event to notify other components
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("wallet-updated"));
            }
            
            walletLoadedRef.current = false; // Reset ref for imported wallet
            fetchBalance(walletData.address);
              fetchTransactions();
              setShowOnboarding(false);
              setWalletLoading(false);
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
  }, [setSelfCustodialWallet, fetchBalance, fetchTransactions, setShowOnboarding, setWalletLoading]);

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
      
      // Dispatch custom event to notify other components
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("wallet-updated"));
      }
      
      walletLoadedRef.current = false; // Reset ref for new wallet
              console.log("Wallet created successfully!");
      setShowOnboarding(false);
      setWalletLoading(false);
    } catch (error) {
      console.error("Error creating wallet:", error);
              console.error("Failed to create wallet");
    }
  }, [setSelfCustodialWallet, setShowOnboarding, setWalletLoading]);

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
    if (!walletData) {
      console.error("Action failed");
      return;
    }
    if (!sendAmount || Number(sendAmount) <= 0) {
      setSendError("Enter an amount greater than zero");
      return;
    }
    if (!sendAddress || !ethers.isAddress(sendAddress)) {
      setSendError("Enter a valid address");
      return;
    }

    try {
      setSendError("");
      setIsSending(true);
      setSendTxHash(null);

      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const signer = new ethers.Wallet(walletData.privateKey, provider);

      let tx;
      if (sendToken.symbol === "ETH" || sendToken.address.toLowerCase() === '0x4200000000000000000000000000000000000006') {
        const balance = parseFloat(ethBalance);
        const amountNum = parseFloat(sendAmount);
        if (amountNum > balance) {
          setSendError("Insufficient balance");
          setIsSending(false);
          return;
        }
        const value = ethers.parseEther(sendAmount);
        tx = await signer.sendTransaction({
          to: sendAddress,
          value,
        });
      } else {
        if (!sendToken.address) {
          setSendError("Token address not found");
          setIsSending(false);
          return;
        }
        // Get token decimals - try to fetch from tokenHoldings first, otherwise default to 18
        const token = tokenHoldings.find((t) => t.symbol === sendToken.symbol);
        const decimals =
          token && typeof token.decimals === "number"
            ? token.decimals
            : token && typeof token.decimals === "string"
            ? parseInt(token.decimals, 10)
            : 18;
        const amount = ethers.parseUnits(sendAmount, decimals);
        const contract = new ethers.Contract(sendToken.address, ERC20_ABI, signer);
        tx = await contract.transfer(sendAddress, amount);
      }

      console.log(`Submitting transaction ${tx.hash}`);
      await tx.wait();
      console.log("Action completed");

      setSendTxHash(tx.hash);
      setSendAmount("");
      setSendAddress("");
      setCurrentSection("main");

      if (walletData.address) {
        fetchBalance(walletData.address);
        fetchTokenHoldings();
        fetchTransactions();
      }
    } catch (error: any) {
      console.error("Error sending transaction:", error);
      setSendError(error?.message || "Failed to send transaction");
    } finally {
      setIsSending(false);
    }
  }, [
    walletData,
    sendAmount,
    sendAddress,
    sendToken,
    ethBalance,
    tokenHoldings,
    fetchBalance,
    fetchTokenHoldings,
    fetchTransactions,
  ]);

  // Handle Buy/Sell button
  const handleBuySell = useCallback(() => {
    if (!walletData) {
      console.error("Action failed");
      return;
    }
    setCurrentSection('buy');
  }, [walletData]);


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

  // Handle token selection
  const handleTokenSelect = useCallback(async (token: {symbol: string; address: string; logo?: string; name?: string}) => {
    // Fetch logo from DexScreener if not available
    let tokenWithLogo = { ...token };
    if (!token.logo && token.address.toLowerCase() !== ETH_TOKEN.address.toLowerCase()) {
      const logo = await getTokenLogo(token.address);
      if (logo) {
        tokenWithLogo.logo = logo;
      }
    }
    
    if (selectingTokenFor === 'pay') {
      setSwapPayToken(tokenWithLogo);
    } else if (selectingTokenFor === 'receive') {
      setSwapReceiveToken(tokenWithLogo);
    } else if (selectingTokenFor === 'send') {
      setSendToken(tokenWithLogo);
    }
    
    // Add to recent tokens (unless it's ETH)
    if (token.address.toLowerCase() !== ETH_TOKEN.address.toLowerCase()) {
      addToRecentTokens(tokenWithLogo);
    }
    
    setShowTokenSelector(false);
    setTokenSearchQuery('');
    setTokenSearchResults([]);
    
    // Refresh quote if amount is set
    if (swapPayAmount && parseFloat(swapPayAmount) > 0) {
      const tokenToUse = selectingTokenFor === 'pay' ? tokenWithLogo : swapPayToken;
      const receiveTokenToUse = selectingTokenFor === 'receive' ? tokenWithLogo : swapReceiveToken;
      if (tokenToUse && receiveTokenToUse) {
        fetchSwapQuote(swapPayAmount, tokenToUse, receiveTokenToUse);
      }
    }
  }, [selectingTokenFor, swapPayAmount, swapPayToken, swapReceiveToken, fetchSwapQuote, addToRecentTokens, getTokenLogo]);

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
    setSendError("");
    setSendTxHash(null);
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
  // Safety check to prevent errors when wallet data is corrupted
  const isValidWalletData = walletData && walletData.address;
  
  // Check if we should show loading state
  const shouldShowLoading = isOpen && walletLoading && !showOnboarding && !showPasswordModal;

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
            {isMobile && (
              <motion.div
                className="fixed inset-0 bg-[#02050d]/80 backdrop-blur-sm z-[9999998]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
              />
            )}
            <motion.div
            className={isMobile
              ? "fixed inset-0 bottom-0 w-full bg-[#0d1628] border-t border-[#1f2a44] shadow-2xl z-[9999999] h-[70vh] max-h-[640px] flex flex-col overflow-hidden rounded-none"
              : "fixed top-20 right-8 w-[400px] bg-[#0d1628] border border-[#1f2a44] shadow-2xl z-[9999999] max-h-[70vh] overflow-hidden rounded-[24px]"
              }
              initial={isMobile ? { opacity: 0, y: 200 } : { opacity: 0, y: -10, scale: 0.95 }}
              animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
              exit={isMobile ? { opacity: 0, y: 200 } : { opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
            {isMobile && (
              <div className="pt-2 pb-1 flex justify-center">
                <div className="w-12 h-1.5 rounded-full bg-gray-500/70" />
              </div>
            )}
              <div className="flex flex-1 items-center justify-center">
                <div className="w-10 h-10 border-2 border-[#1d4ed8]/20 border-t-[#1d4ed8] rounded-full animate-spin"></div>
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
              className="fixed inset-0 bg-[#02050d]/80 backdrop-blur-sm z-[9999999] flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-[#0b1220] p-6 rounded-2xl border border-[#1f2a44] w-96 max-w-md"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-[#1d4ed8] rounded-full flex items-center justify-center shadow-lg shadow-blue-900/30">
                    <FaLock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Unlock Wallet</h3>
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
                      className="w-full p-3 bg-[#15233d] border border-[#1f2a44] rounded-lg text-gray-100 focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]"
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
                      className="flex-1 py-3 px-4 bg-[#1d4ed8] hover:bg-[#2563eb] text-white rounded-lg font-medium transition-colors shadow-sm shadow-blue-900/20"
                    >
                      Unlock
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordModal(false);
                        onClose();
                      }}
                      className="flex-1 py-3 px-4 bg-[#15233d] hover:bg-[#1d2a44] text-gray-200 rounded-lg font-medium transition-colors border border-transparent hover:border-[#1f2a44]"
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
          

          {isMobile && !showPasswordModal && (
            <motion.div
              className="fixed inset-0 bg-[#02050d]/80 backdrop-blur-sm z-[9999998]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
          )}

          <motion.div
            data-wallet-dropdown
            className={isMobile
              ? "fixed left-0 right-0 bottom-0 w-screen bg-[#0d1628] border-t border-[#1f2a44] shadow-2xl z-[9999999] h-[70vh] max-h-[680px] flex flex-col overflow-hidden rounded-t-[28px]"
              : "fixed top-20 right-8 w-[400px] bg-[#0d1628] border border-[#1f2a44] shadow-2xl z-[9999999] max-h-[70vh] overflow-hidden rounded-[24px] flex flex-col"
        }
            initial={isMobile 
              ? { opacity: 0, y: 200 }
              : { opacity: 0, y: -10, scale: 0.95 }
            }
            animate={isMobile 
              ? { opacity: 1, y: 0 }
              : { opacity: 1, y: 0, scale: 1 }
            }
            exit={isMobile 
              ? { opacity: 0, y: 200 }
              : { opacity: 0, y: -10, scale: 0.95 }
            }
            transition={{ duration: 0.3 }}
          >
            {isMobile && (
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-12 h-1.5 rounded-full bg-gray-500/60" />
              </div>
            )}
            {/* Wallet Header */}
            <div
              className={`px-4 py-3 border-b border-[#1f2a44] bg-[#0d1628] ${
                isMobile ? "rounded-t-[28px]" : "rounded-t-[24px]"
              }`}
            >
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
              <div className="wallet-dropdown-menu bg-[#101b33] border-b border-[#1f2a44]">
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-400 mb-2">Current Wallet</div>
                  <div className="flex items-center justify-between p-2.5 bg-[#15233d] border border-[#1f2a44] rounded-lg">
                             <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-[#1d4ed8] rounded-full flex items-center justify-center">
                        <FaWallet className="w-3 h-3 text-white" />
                             </div>
                      <div>
                        <div className="text-sm font-medium text-white">
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
                      className="w-full text-left p-2 text-sm text-gray-300 hover:bg-[#15233d] rounded-lg transition-colors"
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
                      className="w-full text-left p-2 text-sm text-gray-300 hover:bg-[#15233d] rounded-lg transition-colors"
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

            {/* Send/Receive Section */}
            {walletSystem === "self-custodial" && activeBottomTab === 'send' && !walletLoading && (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0b1220]">
                {currentSection === 'main' && (
                  <div className={`px-4 ${isMobile ? "py-3" : "py-4"} flex-1 flex flex-col`}>
                    <h3 className={`${isMobile ? "text-base" : "text-lg"} font-semibold text-gray-200 mb-4`}>Send / Receive</h3>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSend}
                        className={`flex flex-col items-center flex-1 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors ${isMobile ? "p-3" : "p-4"}`}
                      >
                        <div className={`${isMobile ? "w-10 h-10" : "w-12 h-12"} bg-[#1d4ed8] rounded-full flex items-center justify-center mb-2 hover:bg-[#2563eb] transition-colors`}>
                          {isMobile ? (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          )}
                        </div>
                        <span className={`${isMobile ? "text-xs" : "text-sm"} text-white font-medium`}>Send</span>
                      </button>
                      <button
                        onClick={handleReceive}
                        className={`flex flex-col items-center flex-1 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors ${isMobile ? "p-3" : "p-4"}`}
                      >
                        <div className={`${isMobile ? "w-10 h-10" : "w-12 h-12"} bg-[#1d4ed8] rounded-full flex items-center justify-center mb-2 hover:bg-[#2563eb] transition-colors`}>
                          {isMobile ? (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          )}
                        </div>
                        <span className={`${isMobile ? "text-xs" : "text-sm"} text-white font-medium`}>Receive</span>
                      </button>
                    </div>
                  </div>
                )}

                {currentSection === 'send' && (
                  <div className={`px-4 ${isMobile ? "py-3" : "py-4"} flex-1 overflow-y-auto`}>
                    <div className="flex items-center space-x-3 mb-4">
                      <button
                        onClick={() => setCurrentSection('main')}
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
                        <button
                          onClick={() => {
                            setSelectingTokenFor('send');
                            setShowTokenSelector(true);
                          }}
                          className="w-full flex items-center justify-between gap-2 bg-[#15233d] border border-[#1f2a44] rounded-lg px-3 py-3 text-gray-200 hover:border-[#2563eb] transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {sendToken.logo ? (
                              <img src={sendToken.logo} alt={sendToken.symbol} className="w-5 h-5 rounded-full flex-shrink-0" onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }} />
                            ) : null}
                            <div className={`w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ${sendToken.logo ? 'hidden' : ''}`}>
                              <span className="text-[10px] text-white font-bold">
                                {sendToken.symbol.length <= 4 ? sendToken.symbol : sendToken.symbol.substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-left text-sm font-medium">{sendToken.symbol}</span>
                          </div>
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Amount</label>
                        <input
                          type="number"
                          value={sendAmount}
                          onChange={(e) => setSendAmount(e.target.value)}
                          placeholder="0.0"
                          className="w-full p-3 bg-[#15233d] border border-[#1f2a44] rounded-lg text-gray-200 focus:outline-none focus:border-[#2563eb]"
                        />
                        <div className="text-xs text-gray-400 mt-1">
                          Balance: {sendToken.symbol === 'ETH' ? parseFloat(ethBalance).toFixed(6) : 
                            tokenHoldings.find(t => t.symbol === sendToken.symbol)?.tokenBalance || '0'} {sendToken.symbol}
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
                          className="w-full p-3 bg-[#15233d] border border-[#1f2a44] rounded-lg text-gray-200 focus:outline-none focus:border-[#2563eb]"
                        />
                      </div>

                      {sendError && (
                        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
                          {sendError}
                        </div>
                      )}
                      {sendTxHash && (
                        <div className="text-xs text-green-400 bg-green-900/10 border border-green-600/40 rounded-lg px-3 py-2">
                          Transaction sent:&nbsp;
                          <a
                            href={`/explorer/tx/${sendTxHash}`}
                            className="underline hover:text-green-300"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {sendTxHash.slice(0, 6)}...{sendTxHash.slice(-4)}
                          </a>
                        </div>
                      )}
                      {/* Send Button */}
                      <button
                        onClick={handleSendTransaction}
                        disabled={isSending}
                        className={`w-full ${isMobile ? "py-2.5" : "py-3"} px-4 bg-[#1d4ed8] hover:bg-[#2563eb] disabled:bg-[#1f2a44] disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors`}
                      >
                        {isSending ? "Sending..." : `Send ${sendToken.symbol}`}
                      </button>
                    </div>
                  </div>
                )}

                {currentSection === 'receive' && (
                  <div className={`px-4 ${isMobile ? "py-3" : "py-4"} flex-1 overflow-y-auto`}>
                    <div className="flex items-center space-x-3 mb-4">
                      <button
                        onClick={() => setCurrentSection('main')}
                        className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <h3 className="text-lg font-semibold text-gray-200">Receive</h3>
                    </div>

                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-[#1d4ed8]/20 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        className="w-full py-3 px-4 bg-[#1d4ed8] hover:bg-[#2563eb] text-white rounded-lg font-medium transition-colors"
                      >
                        Copy Address
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Tab Navigation */}
                <div className="border-t border-slate-700/50 px-4 py-3 flex items-center justify-around flex-shrink-0">
                  <button
                    onClick={() => {
                      setActiveBottomTab('home');
                      setCurrentSection('main');
                    }}
                    className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'home' ? 'text-blue-400' : 'text-gray-400'}`}
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
                    className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'swap' ? 'text-blue-400' : 'text-gray-400'}`}
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
                    className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'history' ? 'text-blue-400' : 'text-gray-400'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs">History</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveBottomTab('send');
                      setCurrentSection('main');
                    }}
                    className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'send' ? 'text-blue-400' : 'text-gray-400'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span className="text-xs">Send</span>
                  </button>
                </div>
              </div>
            )}

            {/* Swap Section - Full Screen */}
            {walletSystem === "self-custodial" && currentSection === 'swap' && !walletLoading && (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0b1220] relative">
                {/* Swap UI */}
                <div className={`flex-1 overflow-y-auto scrollbar-hide px-4 ${isMobile ? "py-2.5" : "py-6"}`}>
                  {/* You Pay Card */}
                  <div className={`bg-slate-800/50 rounded-2xl border border-slate-700/50 ${isMobile ? "p-3 mb-3" : "p-4 mb-4"}`}>
                    <div className="text-xs text-gray-400 mb-1.5">You Pay</div>
                    <div className="flex items-center justify-between mb-1.5">
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
                        className={`font-bold text-white bg-transparent border-none outline-none w-full ${isMobile ? "text-2xl" : "text-3xl"}`}
                      />
                      <button 
                        onClick={() => {
                          setSelectingTokenFor('pay');
                          setShowTokenSelector(true);
                        }}
                        className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-700 rounded-xl px-3 py-2 border border-slate-600/50 transition-colors"
                      >
                        {swapPayToken.logo ? (
                          <img src={swapPayToken.logo} alt={swapPayToken.symbol} className="w-6 h-6 rounded-full flex-shrink-0" onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }} />
                        ) : null}
                        <div className={`w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ${swapPayToken.logo ? 'hidden' : ''}`}>
                          <span className="text-xs text-white font-bold">
                            {swapPayToken.symbol.length <= 4 ? swapPayToken.symbol : swapPayToken.symbol.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-white font-medium text-left">{swapPayToken.symbol}</span>
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="flex justify-center -my-1.5 relative z-10">
                    <button
                      onClick={() => {
                        const temp = swapPayToken;
                        setSwapPayToken(swapReceiveToken);
                        setSwapReceiveToken(temp);
                        const tempAmount = swapPayAmount;
                        setSwapPayAmount(swapReceiveAmount);
                        setSwapReceiveAmount(tempAmount);
                      }}
                      className="w-12 h-12 bg-[#1d4ed8] hover:bg-[#2563eb] rounded-full flex items-center justify-center transition-colors shadow-lg"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </button>
                  </div>

                  {/* You Receive Card */}
                  <div className={`bg-slate-800/50 rounded-2xl border border-slate-700/50 ${isMobile ? "p-3 mb-3" : "p-4 mb-4"}`}>
                    <div className="text-xs text-gray-400 mb-1.5">You Receive</div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`font-bold text-white ${isMobile ? "text-2xl" : "text-3xl"}`}>
                        {isLoadingQuote ? '...' : swapReceiveAmount || '0'}
                      </div>
                      <button 
                        onClick={() => {
                          setSelectingTokenFor('receive');
                          setShowTokenSelector(true);
                        }}
                        className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-700 rounded-xl px-3 py-2 border border-slate-600/50 transition-colors"
                      >
                        {swapReceiveToken.logo ? (
                          <img src={swapReceiveToken.logo} alt={swapReceiveToken.symbol} className="w-6 h-6 rounded-full flex-shrink-0" onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }} />
                        ) : null}
                        <div className={`w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 ${swapReceiveToken.logo ? 'hidden' : ''}`}>
                          <span className="text-xs text-white font-bold">
                            {swapReceiveToken.symbol.length <= 4 ? swapReceiveToken.symbol : swapReceiveToken.symbol.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-white font-medium text-left">{swapReceiveToken.symbol}</span>
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className={`w-full bg-[#1d4ed8] hover:bg-[#2563eb] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors ${isMobile ? "py-3.5 mb-3" : "py-4 mb-4"}`}
                  >
                    {isSwapping ? 'Swapping...' : 'Swap'}
                  </button>
                </div>

                {/* Token Selector Dropdown - Within Wallet Component */}
                <AnimatePresence>
                  {showTokenSelector && (
                    <>
                      {/* Backdrop */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 z-40"
                        onClick={() => setShowTokenSelector(false)}
                      />
                      {/* Dropdown */}
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute inset-x-0 top-0 bottom-0 bg-[#0b1220] border-t border-slate-700/50 z-50 flex flex-col"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-[#0b1220] flex-shrink-0">
                          <h2 className="text-base font-semibold text-white">Select Token</h2>
                          <button
                            onClick={() => setShowTokenSelector(false)}
                            className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Search Bar */}
                        <div className="px-4 py-3 border-b border-slate-700/50 bg-[#0b1220] flex-shrink-0">
                          <div className="relative">
                            <input
                              type="text"
                              value={tokenSearchQuery}
                              onChange={(e) => setTokenSearchQuery(e.target.value)}
                              placeholder="Search by name, symbol, or address"
                              className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-3 py-2 pl-9 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                              autoFocus
                            />
                            <svg className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {isSearchingTokens && (
                              <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Token List */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-2">
                          {isLoadingTokens ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : (
                            <>
                              {/* Search Results */}
                              {tokenSearchQuery && tokenSearchResults.length > 0 && (
                                <div className="mb-3">
                                  <div className="text-xs text-gray-400 mb-2 px-2">Search Results</div>
                                  <div className="space-y-1">
                                    {tokenSearchResults.map((token, idx) => (
                                      <button
                                        key={`search-${token.address}-${idx}`}
                                        onClick={() => handleTokenSelect(token)}
                                        className="w-full flex items-center justify-between p-2.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-700/50 transition-colors group"
                                      >
                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                          {token.logo ? (
                                            <img src={token.logo} alt={token.symbol} className="w-7 h-7 rounded-full flex-shrink-0" onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                            }} />
                                          ) : null}
                                          <div className={`w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ${token.logo ? 'hidden' : ''}`}>
                                            <span className="text-xs text-white font-bold">
                                              {token.symbol.length <= 4 ? token.symbol : token.symbol.substring(0, 2).toUpperCase()}
                                            </span>
                                          </div>
                                          <div className="flex-1 min-w-0 text-left">
                                            <div className="text-white text-sm font-medium truncate">{token.symbol}</div>
                                            <div className="text-xs text-gray-400 truncate">{token.name || token.symbol}</div>
                                          </div>
                                        </div>
                                        <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* No Search Results */}
                              {tokenSearchQuery && !isSearchingTokens && tokenSearchResults.length === 0 && (
                                <div className="text-center py-8">
                                  <div className="text-gray-400 text-sm mb-1">No tokens found</div>
                                  <div className="text-xs text-gray-500">Try searching by symbol, name, or contract address</div>
                                </div>
                              )}

                              {/* Recent Tokens (ETH + Recent) */}
                              {!tokenSearchQuery && (
                                <div>
                                  <div className="text-xs text-gray-400 mb-2 px-2">Recent Tokens</div>
                                  <div className="space-y-1">
                                    {availableTokens.length === 0 ? (
                                      <div className="text-center py-8 text-gray-400 text-sm">No recent tokens</div>
                                    ) : (
                                      availableTokens.map((token, idx) => {
                                        const isSelected = (selectingTokenFor === 'pay' && swapPayToken.address.toLowerCase() === token.address.toLowerCase()) ||
                                                          (selectingTokenFor === 'receive' && swapReceiveToken.address.toLowerCase() === token.address.toLowerCase()) ||
                                                          (selectingTokenFor === 'send' && sendToken.address.toLowerCase() === token.address.toLowerCase());
                                        
                                        return (
                                          <button
                                            key={`token-${token.address}-${idx}`}
                                            onClick={() => handleTokenSelect(token)}
                                            disabled={isSelected}
                                            className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                                              isSelected 
                                                ? 'bg-blue-500/20 border-blue-500/50 cursor-not-allowed' 
                                                : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/50'
                                            } group`}
                                          >
                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                              {token.logo ? (
                                                <img src={token.logo} alt={token.symbol} className="w-7 h-7 rounded-full flex-shrink-0" onError={(e) => {
                                                  e.currentTarget.style.display = 'none';
                                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                }} />
                                              ) : null}
                                              <div className={`w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ${token.logo ? 'hidden' : ''}`}>
                                                <span className="text-xs text-white font-bold">
                                                  {token.symbol.length <= 4 ? token.symbol : token.symbol.substring(0, 2).toUpperCase()}
                                                </span>
                                              </div>
                                              <div className="flex-1 min-w-0 text-left">
                                                <div className="text-white text-sm font-medium truncate">{token.symbol}</div>
                                                <div className="text-xs text-gray-400 truncate">{token.name || token.symbol}</div>
                                              </div>
                                            </div>
                                            {isSelected ? (
                                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                <FiCheck className="w-2.5 h-2.5 text-white" />
                                              </div>
                                            ) : (
                                              <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                              </svg>
                                            )}
                                          </button>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Bottom Tab Navigation */}
                <div className="border-t border-slate-700/50 px-4 py-3 flex items-center justify-around flex-shrink-0">
                    <button
                      onClick={() => {
                        setActiveBottomTab('home');
                        setCurrentSection('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'home' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="text-xs">Home</span>
                    </button>
                    <button
                      onClick={() => setActiveBottomTab('swap')}
                      className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'swap' ? 'text-blue-400' : 'text-gray-400'}`}
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
                      className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'history' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs">History</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('send');
                        setCurrentSection('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'send' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span className="text-xs">Send</span>
                    </button>
                </div>
              </div>
            )}

            <div className={`flex-1 flex flex-col overflow-hidden bg-[#0b1220] ${currentSection === 'swap' || (activeBottomTab as string) === 'send' ? 'hidden' : ''}`}>
              {/* Wallet Loading State */}
              {walletLoading && (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" text="Loading wallet..." />
                </div>
              )}

              {walletSystem === "self-custodial" && currentSection === 'main' && currentView === 'main' && !walletLoading && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#0b1220]">
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                  {/* Balance Section */}
                  {walletData ? (
                    <div className={`px-4 ${isMobile ? "py-3" : "py-6"}`}>
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
                  <div className="flex items-center space-x-2 text-sm text-slate-300/80">
                          <button 
                            onClick={handleEthClick}
                      className="hover:text-slate-100 transition-colors cursor-pointer"
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
                    <div className={`${isMobile ? "px-4 py-3 bg-transparent border-0 rounded-none" : "px-4 py-5 bg-[#0b1220] border border-[#1f2a44] rounded-xl"} text-center`}>
                      {!isMobile && (
                        <div className="w-14 h-14 bg-[#15233d] rounded-xl flex items-center justify-center mx-auto mb-3">
                          <FaWallet className="w-7 h-7 text-[#60a5fa]" />
                        </div>
                      )}
                      <h3 className="text-base font-semibold text-white mb-1.5">Welcome to CypherX</h3>
                      <p className="text-sm text-gray-300 mb-4">Create or import a wallet to start exploring the network.</p>
                      <div className="space-y-2">
                        <button
                          onClick={createWallet}
                          className="w-full py-2.5 px-4 bg-[#1d4ed8] hover:bg-[#2563eb] text-white rounded-lg font-semibold transition-colors text-sm shadow-sm shadow-blue-900/30"
                        >
                          Create New Wallet
                        </button>
                        <button
                          onClick={importWallet}
                          className="w-full py-2.5 px-4 bg-[#0b1220] hover:bg-[#0d1628] text-gray-200 rounded-lg font-medium border border-[#1f2a44] transition-colors text-sm"
                        >
                          Import Existing Wallet
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  {walletData && (
                    <div className={`px-4 ${isMobile ? "py-2" : "py-3"}`}>
                      <div className="flex items-center justify-between gap-3">
                              <button
                          onClick={handleBuySell}
                          className="flex flex-col items-center flex-1"
                        >
                          <div className="w-12 h-12 bg-[#1d4ed8] rounded-full flex items-center justify-center mb-2 hover:bg-[#2563eb] transition-colors">
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
                          <div className="w-12 h-12 bg-[#1d4ed8] rounded-full flex items-center justify-center mb-2 hover:bg-[#2563eb] transition-colors">
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
                          <div className="w-12 h-12 bg-[#1d4ed8] rounded-full flex items-center justify-center mb-2 hover:bg-[#2563eb] transition-colors">
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
                          <div className="w-12 h-12 bg-[#1d4ed8] rounded-full flex items-center justify-center mb-2 hover:bg-[#2563eb] transition-colors">
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
                  <div className={`px-4 ${isMobile ? "py-2" : "py-3"} border-b border-slate-700/50 ${isMobile ? "rounded-none" : "rounded-t-lg"}`}>
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
                    <div className={`px-4 ${isMobile ? "py-3" : "py-4"} h-96 overflow-y-auto scrollbar-hide`}>
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
                              className={`flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 transition-all duration-200 group cursor-pointer ${isMobile ? "rounded-none border-l-0 border-r-0" : "rounded-xl"}`}
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
                              className={`flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 transition-all duration-200 group cursor-pointer ${isMobile ? "rounded-none border-l-0 border-r-0" : "rounded-xl"}`}
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
                    <div className={`px-4 ${isMobile ? "py-3" : "py-4"} h-96 overflow-y-auto scrollbar-hide`}>
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
                              <div key={tx.hash || tx.id || index} className={`flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 transition-all duration-200 ${isMobile ? "rounded-none border-l-0 border-r-0" : "rounded-xl"}`}>
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
                      className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'home' ? 'text-blue-400' : 'text-gray-400'}`}
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
                      className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'swap' ? 'text-blue-400' : 'text-gray-400'}`}
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
                      className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'history' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs">History</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('send');
                        setCurrentSection('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'send' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span className="text-xs">Send</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Asset Details Section */}
              {walletSystem === "self-custodial" && currentSection === 'main' && currentView === 'asset-details' && selectedTokenForChart && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#0b1220]">
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
                          <div className="w-8 h-8 border-2 border-[#1d4ed8]/20 border-t-[#1d4ed8] rounded-full animate-spin"></div>
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
                      className="flex flex-col items-center space-y-1 text-gray-400"
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
                      className="flex flex-col items-center space-y-1 text-gray-400"
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
                      className="flex flex-col items-center space-y-1 text-gray-400"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs">History</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('send');
                        setCurrentSection('main');
                      }}
                      className={`flex flex-col items-center space-y-1 ${(activeBottomTab as string) === 'send' ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span className="text-xs">Send</span>
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
                    <div className="w-16 h-16 bg-[#1d4ed8]/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                       </div>
                    
                         <div>
                      <h4 className="text-lg font-medium text-gray-200 mb-2">Buy & Sell Tokens</h4>
                      <p className="text-gray-400">Advanced trading functionality coming soon</p>
                         </div>

                    <button
                      onClick={() => window.location.href = '/explore'}
                      className="w-full py-3 px-4 bg-[#1d4ed8] hover:bg-[#2563eb] text-white rounded-lg font-medium transition-colors"
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

