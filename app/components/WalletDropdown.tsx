"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { FaWallet, FaDownload, FaEye, FaEyeSlash, FaArrowLeft, FaLock } from "react-icons/fa";
import { FiSettings, FiExternalLink, FiX, FiCopy, FiCheck } from "react-icons/fi";
import { SiEthereum } from "react-icons/si";
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
  const [isRefreshingHoldings, setIsRefreshingHoldings] = useState<boolean>(false);
  const lastHoldingsFetchRef = useRef<number>(0);
  const [holdingsError, setHoldingsError] = useState<string>('');
  const [transactionsError, setTransactionsError] = useState<string>('');
  const [balanceError, setBalanceError] = useState<string>('');
  const [hiddenTokens, setHiddenTokens] = useState<Set<string>>(new Set());
  const [showHiddenSection, setShowHiddenSection] = useState<boolean>(false);
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
  const [swapPayToken, setSwapPayToken] = useState<{symbol: string; address: string; logo?: string; priceUsd?: number}>({symbol: 'ETH', address: '0x4200000000000000000000000000000000000006'});
  const [swapReceiveToken, setSwapReceiveToken] = useState<{symbol: string; address: string; logo?: string; priceUsd?: number}>({symbol: 'USDC', address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', priceUsd: 1});
  const [showUsdValues, setShowUsdValues] = useState<boolean>(false);
  const [swapQuote, setSwapQuote] = useState<any>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const [showSwapConfirmation, setShowSwapConfirmation] = useState(false);
  const [pendingSwapData, setPendingSwapData] = useState<any>(null);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [swapSuccess, setSwapSuccess] = useState<{
    type: 'buy' | 'sell';
    amount: string;
    tokenSymbol: string;
    txHash: string;
    received: string;
  } | null>(null);
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
  const tokenSearchInputRef = useRef<HTMLInputElement>(null);

  // Auto Profit DCA State
  const DCA_ASSETS = [
    { symbol: 'cbBTC', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', name: 'Coinbase Wrapped BTC', logo: 'https://assets.coingecko.com/coins/images/40143/standard/cbbtc.webp' },
    { symbol: 'cbETH', address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', name: 'Coinbase Wrapped ETH', logo: 'https://assets.coingecko.com/coins/images/27008/standard/cbeth.png' },
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', name: 'Wrapped Ether', logo: 'https://assets.coingecko.com/coins/images/2518/standard/weth.png' },
    { symbol: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', name: 'Aerodrome', logo: 'https://assets.coingecko.com/coins/images/31745/standard/token.png' },
  ];
  const [autoDcaEnabled, setAutoDcaEnabled] = useState<boolean>(false);
  const [autoDcaPercentage, setAutoDcaPercentage] = useState<number>(10);
  const [autoDcaAsset, setAutoDcaAsset] = useState<typeof DCA_ASSETS[0]>(DCA_ASSETS[0]);
  const [dcaExecutionLog, setDcaExecutionLog] = useState<Array<{timestamp: number; amount: string; asset: string; txHash?: string}>>([]);

  const isClient = typeof window !== 'undefined';

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load Auto DCA settings from localStorage
  useEffect(() => {
    if (!isClient) return;
    try {
      const savedDcaSettings = localStorage.getItem('cypherx_auto_dca');
      if (savedDcaSettings) {
        const settings = JSON.parse(savedDcaSettings);
        setAutoDcaEnabled(settings.enabled ?? false);
        setAutoDcaPercentage(settings.percentage ?? 10);
        const savedAsset = DCA_ASSETS.find(a => a.symbol === settings.assetSymbol);
        if (savedAsset) {
          setAutoDcaAsset(savedAsset);
        }
        setDcaExecutionLog(settings.executionLog ?? []);
      }
    } catch (error) {
      console.error('Error loading DCA settings:', error);
    }
  }, [isClient]);

  // Save Auto DCA settings to localStorage
  const saveDcaSettings = useCallback((
    enabled: boolean,
    percentage: number,
    asset: typeof DCA_ASSETS[0],
    executionLog: Array<{timestamp: number; amount: string; asset: string; txHash?: string}>
  ) => {
    if (!isClient) return;
    try {
      localStorage.setItem('cypherx_auto_dca', JSON.stringify({
        enabled,
        percentage,
        assetSymbol: asset.symbol,
        executionLog
      }));
    } catch (error) {
      console.error('Error saving DCA settings:', error);
    }
  }, [isClient]);

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

  // ETH token - using SiEthereum icon component
  const ETH_TOKEN = { symbol: 'ETH', address: '0x4200000000000000000000000000000000000006', name: 'Ethereum', logo: 'ETH_ICON_COMPONENT', isWalletToken: false };

  // Helper function to render token icon
  const renderTokenIcon = useCallback((token: {symbol: string; address: string; logo?: string}, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-5 h-5',
      md: 'w-6 h-6',
      lg: 'w-7 h-7'
    };
    const sizeClass = sizeClasses[size];
    
    // Check if it's ETH
    if (token.symbol === 'ETH' || token.symbol === 'WETH' || token.address.toLowerCase() === ETH_TOKEN.address.toLowerCase() || token.logo === 'ETH_ICON_COMPONENT') {
      return (
        <div className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 bg-blue-500/20`}>
          <SiEthereum className={`${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} text-blue-400`} />
        </div>
      );
    }
    
    // Generate fallback logo URL from DexScreener
    const dexScreenerLogoUrl = `https://dd.dexscreener.com/ds-data/tokens/base/${token.address.toLowerCase()}.png`;
    const logoUrl = token.logo && token.logo !== 'ETH_ICON_COMPONENT' ? token.logo : dexScreenerLogoUrl;
    
    // For other tokens, use image with fallback chain
    return (
      <div className={`${sizeClass} rounded-full flex-shrink-0 bg-slate-700 overflow-hidden`}>
        <img 
          src={logoUrl} 
          alt={token.symbol} 
          className={`${sizeClass} rounded-full object-cover`} 
          onError={(e) => {
            const target = e.currentTarget;
            // Try DexScreener URL if different from current
            if (target.src !== dexScreenerLogoUrl && token.logo !== dexScreenerLogoUrl) {
              target.src = dexScreenerLogoUrl;
            } else {
              // Final fallback - hide image and show text
              target.style.display = 'none';
              const fallback = target.nextElementSibling;
              if (fallback) {
                (fallback as HTMLElement).style.display = 'flex';
              }
            }
          }} 
        />
        <div 
          className={`${sizeClass} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center flex-shrink-0`}
          style={{ display: 'none' }}
        >
          <span className={`${size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-xs'} text-white font-bold`}>
            {token.symbol.length <= 4 ? token.symbol : token.symbol.substring(0, 2).toUpperCase()}
          </span>
        </div>
      </div>
    );
  }, []);

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

  // Load token logos and prices on mount
  useEffect(() => {
    const loadTokenData = async () => {
      // ETH logo and price
      const ethLogo = 'https://assets.coingecko.com/coins/images/279/small/ethereum.png';
      try {
        // Fetch ETH price
        const ethPriceResponse = await fetch('/api/price/eth');
        if (ethPriceResponse.ok) {
          const ethPriceData = await ethPriceResponse.json();
          setSwapPayToken(prev => ({ ...prev, logo: ethLogo, priceUsd: ethPriceData.price || ethPrice }));
        } else {
          setSwapPayToken(prev => ({ ...prev, logo: ethLogo, priceUsd: ethPrice }));
        }
      } catch {
        setSwapPayToken(prev => ({ ...prev, logo: ethLogo, priceUsd: ethPrice }));
      }
      
      // USDC logo and price (USDC is always ~$1)
      const usdcLogo = 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png';
      setSwapReceiveToken(prev => ({ ...prev, logo: usdcLogo, priceUsd: 1 }));
    };
    loadTokenData();
  }, [ethPrice]);

  // Fetch pay token balance when swap section opens or pay token changes
  useEffect(() => {
    if (currentSection === 'swap' && walletData?.address && swapPayToken?.address) {
      // Fetch balance for the current pay token
      const fetchBalance = async () => {
        try {
          const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
          const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
          
          if (swapPayToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
            const balance = await provider.getBalance(walletData.address);
            const balanceFormatted = parseFloat(ethers.formatEther(balance));
            setTokenBalance(balanceFormatted.toFixed(6));
          } else {
            const tokenContract = new ethers.Contract(
              swapPayToken.address,
              ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
              provider
            );
            const [balance, decimals] = await Promise.all([
              tokenContract.balanceOf(walletData.address),
              tokenContract.decimals().catch(() => 18)
            ]);
            const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
            setTokenBalance(balanceFormatted.toFixed(6));
          }
        } catch (error) {
          console.error('Error fetching swap pay token balance:', error);
          setTokenBalance('0');
        }
      };
      fetchBalance();
    }
  }, [currentSection, walletData?.address, swapPayToken?.address]);

  // Get token logo and price from DexScreener
  const getTokenData = useCallback(async (tokenAddress: string): Promise<{logo?: string; priceUsd?: number}> => {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const pair = data.pairs[0];
          // Try multiple sources for the logo
          const logo = pair.info?.imageUrl || 
                       pair.baseToken?.info?.imageUrl ||
                       pair.baseToken?.logoURI || 
                       pair.quoteToken?.logoURI ||
                       `https://dd.dexscreener.com/ds-data/tokens/base/${tokenAddress.toLowerCase()}.png`;
          const priceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : undefined;
          return { logo, priceUsd };
        }
      }
    } catch (error) {
      console.error('Error fetching token data:', error);
    }
    return {};
  }, []);

  // Legacy function for backwards compatibility
  const getTokenLogo = useCallback(async (tokenAddress: string): Promise<string | undefined> => {
    const data = await getTokenData(tokenAddress);
    return data.logo;
  }, [getTokenData]);

  // Load available tokens (ETH + wallet tokens + recent tokens)
  const loadAvailableTokens = useCallback(async () => {
    setIsLoadingTokens(true);
    try {
      // Start with ETH
      const tokens = [ETH_TOKEN];
      
      // Add wallet tokens (from tokenHoldings) with DexScreener data
      if (tokenHoldings && tokenHoldings.length > 0) {
        const walletTokenPromises = tokenHoldings
          .filter(token => token.contractAddress && 
            token.contractAddress.toLowerCase() !== ETH_TOKEN.address.toLowerCase())
          .map(async (token) => {
            const tokenAddress = token.contractAddress;
            // Try to get logo from DexScreener
            let logo = token.logo;
            if (!logo) {
              logo = await getTokenLogo(tokenAddress);
            }
            
            return {
              symbol: token.symbol || 'UNKNOWN',
              address: tokenAddress,
              name: token.name || token.symbol || 'Unknown Token',
              logo: logo || '',
              balance: token.tokenBalance || '0',
              isWalletToken: true
            };
          });
        
        const walletTokens = await Promise.all(walletTokenPromises);
        walletTokens.forEach((token) => {
          if (!tokens.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
            tokens.push(token);
          }
        });
      }
      
      // Add recent tokens (excluding ETH and wallet tokens if they're already there)
      recentTokens.forEach((token) => {
        if (token.address.toLowerCase() !== ETH_TOKEN.address.toLowerCase() && 
            !tokens.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
          tokens.push({
            symbol: token.symbol,
            address: token.address,
            name: token.name || token.symbol,
            logo: token.logo || '',
            isWalletToken: false
          });
        }
      });
      
      setAvailableTokens(tokens);
    } catch (error) {
      console.error('Error loading tokens:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  }, [recentTokens, tokenHoldings, getTokenLogo]);

  // Search tokens (prioritizes wallet tokens)
  const searchTokens = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setTokenSearchResults([]);
      return;
    }

    setIsSearchingTokens(true);
    try {
      const queryLower = query.toLowerCase();
      const results: Array<{symbol: string; address: string; name: string; logo?: string; isWalletToken?: boolean; balance?: string}> = [];
      
      // First, search wallet tokens (prioritize these)
      if (tokenHoldings && tokenHoldings.length > 0) {
        const walletMatches = tokenHoldings
          .filter(token => {
            const symbol = (token.symbol || '').toLowerCase();
            const name = (token.name || '').toLowerCase();
            const address = (token.contractAddress || '').toLowerCase();
            return symbol.includes(queryLower) || 
                   name.includes(queryLower) || 
                   address.includes(queryLower);
          })
          .slice(0, 10); // Limit to top 10 wallet matches
        
        const walletTokenPromises = walletMatches.map(async (token) => {
          const tokenAddress = token.contractAddress;
          let logo = token.logo;
          if (!logo) {
            logo = await getTokenLogo(tokenAddress);
          }
          
          return {
            symbol: token.symbol || 'UNKNOWN',
            address: tokenAddress,
            name: token.name || token.symbol || 'Unknown Token',
            logo: logo || '',
            isWalletToken: true,
            balance: token.tokenBalance || '0'
          };
        });
        
        const walletTokens = await Promise.all(walletTokenPromises);
        results.push(...walletTokens);
      }
      
      // Search by address
      if (query.startsWith('0x') && query.length === 42) {
        try {
          const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${query}`);
          const data = await response.json();
          
          if (data.pairs && data.pairs.length > 0) {
            const pair = data.pairs[0];
            const logo = pair.baseToken?.logoURI || pair.quoteToken?.logoURI || undefined;
            const tokenResult = {
              symbol: pair.baseToken?.symbol || 'UNKNOWN',
              address: query,
              name: pair.baseToken?.name || 'Unknown Token',
              logo: logo
            };
            
            // Only add if not already in results (from wallet tokens)
            if (!results.find(r => r.address.toLowerCase() === query.toLowerCase())) {
              results.push(tokenResult);
            }
          }
        } catch (error) {
          console.error('Error searching token by address:', error);
        }
        setTokenSearchResults(results);
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
            // Skip if already in wallet tokens
            if (!results.find(r => r.address.toLowerCase() === tokenAddress)) {
              const logo = pair.baseToken?.logoURI || pair.quoteToken?.logoURI || undefined;
              uniqueTokens.set(tokenAddress, {
                symbol: pair.baseToken?.symbol || 'UNKNOWN',
                address: pair.baseToken?.address,
                name: pair.baseToken?.name || pair.baseToken?.symbol || 'Unknown Token',
                logo: logo,
                isWalletToken: false
              });
            }
          }
        });
        
        // Add DexScreener results (limit to 20 total, wallet tokens already included)
        const dexResults = Array.from(uniqueTokens.values()).slice(0, 20 - results.length);
        results.push(...dexResults);
      }
      
      setTokenSearchResults(results);
    } catch (error) {
      console.error('Error searching tokens:', error);
      setTokenSearchResults([]);
    } finally {
      setIsSearchingTokens(false);
    }
  }, [tokenHoldings, getTokenLogo]);

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

  // Reload available tokens when tokenHoldings changes
  useEffect(() => {
    if (showTokenSelector && tokenHoldings) {
      loadAvailableTokens();
    }
  }, [tokenHoldings, showTokenSelector, loadAvailableTokens]);


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

  // Fetch token holdings (with throttle - minimum 30 seconds between fetches)
  const fetchTokenHoldings = useCallback(async (force: boolean = false) => {
    if (!walletData?.address) return;
    
    const now = Date.now();
    const timeSinceLastFetch = now - lastHoldingsFetchRef.current;
    const MIN_FETCH_INTERVAL = 30000; // 30 seconds
    
    // Skip if we fetched recently (unless forced)
    if (!force && timeSinceLastFetch < MIN_FETCH_INTERVAL) {
      console.log('🔍 Skipping token fetch - too recent:', Math.round(timeSinceLastFetch / 1000), 's ago');
      return;
    }
    
    lastHoldingsFetchRef.current = now;
    const isInitialLoad = tokenHoldings.length === 0;
    
    // Only show full loading spinner on initial load
    if (isInitialLoad) {
      setIsLoadingHoldings(true);
    } else {
      setIsRefreshingHoldings(true);
    }
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
        if (data.success && data.data && data.data.tokenBalances) {
          setTokenHoldings(data.data.tokenBalances);
        } else if (isInitialLoad) {
          setTokenHoldings([]);
        }
      } else {
        const errorMessage = getErrorMessage(`HTTP ${response.status}`, 'wallet');
        if (isInitialLoad) setHoldingsError(errorMessage);
        logError(`Token holdings response not ok: ${response.status}`, 'wallet');
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'wallet');
      if (isInitialLoad) setHoldingsError(errorMessage);
      logError(error, 'wallet');
    } finally {
      setIsLoadingHoldings(false);
      setIsRefreshingHoldings(false);
    }
  }, [walletData?.address, tokenHoldings.length]);

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
              const importedWalletData: WalletData = {
                address: data.address,
                privateKey: data.privateKey,
                createdAt: data.createdAt || Date.now()
              };
              
              localStorage.setItem("cypherx_wallet", JSON.stringify(importedWalletData));
              setWalletData(importedWalletData);
              
              // Set default account alias
              setUserAlias('Account 1');
              localStorage.setItem('userInfo', JSON.stringify({ alias: 'Account 1' }));
              
              setSelfCustodialWallet({
                address: importedWalletData.address,
                isConnected: true,
                ethBalance: "0.0",
                tokenBalance: "0.0"
              });
              
              // Dispatch custom event to notify other components
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wallet-updated"));
                window.dispatchEvent(new CustomEvent("wallet-connected", { detail: { address: importedWalletData.address } }));
              }
              
              walletLoadedRef.current = false; // Reset ref for imported wallet
              fetchBalance(importedWalletData.address);
              fetchTransactions();
              setShowOnboarding(false);
              setWalletLoading(false);
              console.log("Wallet imported successfully!");
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
      
      // Set default account alias
      setUserAlias('Account 1');
      localStorage.setItem('userInfo', JSON.stringify({ alias: 'Account 1' }));
      
      setSelfCustodialWallet({
        address: data.address,
        isConnected: true,
        ethBalance: "0.0",
        tokenBalance: "0.0"
      });
      
      // Dispatch custom event to notify other components
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("wallet-updated"));
        window.dispatchEvent(new CustomEvent("wallet-connected", { detail: { address: data.address } }));
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

  // Load hidden tokens from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cypherx_hidden_tokens');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHiddenTokens(new Set(parsed));
      } catch (e) {
        console.error('Failed to load hidden tokens:', e);
      }
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
      // Save to localStorage
      localStorage.setItem('cypherx_hidden_tokens', JSON.stringify([...newSet]));
      return newSet;
    });
  }, []);

  // Handle unhiding a single token
  const unhideToken = useCallback((contractAddress: string) => {
    setHiddenTokens(prev => {
      const newSet = new Set(prev);
      newSet.delete(contractAddress);
      localStorage.setItem('cypherx_hidden_tokens', JSON.stringify([...newSet]));
      return newSet;
    });
  }, []);

  // Handle showing all tokens
  const showAllTokens = useCallback(() => {
    setHiddenTokens(new Set());
    localStorage.removeItem('cypherx_hidden_tokens');
  }, []);

  // Handle back to main section
  const handleBackToMain = useCallback(() => {
    setCurrentSection('main');
    setCurrentView('main');
    setSendAmount('');
    setSendAddress('');
    setSelectedTokenForChart(null);
  }, []);

  // Fetch OHLC data using GeckoTerminal API (free OHLCV data)
  const fetchChartData = useCallback(async (tokenAddress: string, timeframe: string) => {
    setIsLoadingChart(true);
    setChartData([]);
    
    try {
      // Map timeframe to API parameters
      let geckoTimeframe = 'hour';
      let aggregate = 1;
      let limit = 100;
      
      switch (timeframe) {
        case '15m':
          geckoTimeframe = 'minute';
          aggregate = 15;
          limit = 96; // 24 hours of 15min candles
          break;
        case '1h':
          geckoTimeframe = 'hour';
          aggregate = 1;
          limit = 48; // 48 hours
          break;
        case '4h':
          geckoTimeframe = 'hour';
          aggregate = 4;
          limit = 42; // 7 days
          break;
        case '1d':
          geckoTimeframe = 'day';
          aggregate = 1;
          limit = 30; // 30 days
          break;
      }

      // For ETH/WETH, use the WETH address on Base
      const actualAddress = (tokenAddress === 'ethereum' || tokenAddress === 'ETH') 
        ? '0x4200000000000000000000000000000000000006' 
        : tokenAddress;

      // First, get pool address from GeckoTerminal
      const poolsResponse = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/tokens/${actualAddress}/pools?page=1`
      );
      
      if (!poolsResponse.ok) {
        throw new Error('Failed to fetch pools');
      }
      
      const poolsData = await poolsResponse.json();
      
      if (!poolsData.data || poolsData.data.length === 0) {
        throw new Error('No pools found');
      }
      
      // Get the pool with highest liquidity
      const pool = poolsData.data[0];
      const poolAddress = pool.attributes.address;
      
      // Fetch OHLCV data from GeckoTerminal
      const ohlcvResponse = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddress}/ohlcv/${geckoTimeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd`
      );
      
      if (!ohlcvResponse.ok) {
        throw new Error('Failed to fetch OHLCV');
      }
      
      const ohlcvData = await ohlcvResponse.json();
      
      if (ohlcvData.data && ohlcvData.data.attributes && ohlcvData.data.attributes.ohlcv_list) {
        // ohlcv_list format: [timestamp, open, high, low, close, volume]
        const candles = ohlcvData.data.attributes.ohlcv_list;
        const chartData = candles.map((candle: number[]) => ({
          time: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5]
        })).reverse(); // Reverse to get chronological order
        
        setChartData(chartData);
      } else {
        throw new Error('Invalid OHLCV data');
      }
    } catch (error) {
      console.error('Chart data fetch error:', error);
      
      // Fallback: Try CoinGecko for ETH
      if (tokenAddress === 'ethereum' || tokenAddress === 'ETH') {
        try {
          let days = 1;
          switch (timeframe) {
            case '15m': days = 1; break;
            case '1h': days = 2; break;
            case '4h': days = 7; break;
            case '1d': days = 30; break;
          }
          
          const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=${days}`
          );
          
          if (response.ok) {
            const data = await response.json();
            const prices = data.prices || [];
            // Sample data to reduce points
            const step = Math.max(1, Math.floor(prices.length / 50));
            const chartData = prices
              .filter((_: any, i: number) => i % step === 0)
              .map((price: [number, number]) => ({
                time: price[0] / 1000,
                close: price[1]
              }));
            setChartData(chartData);
          }
        } catch (e) {
          console.error('CoinGecko fallback failed:', e);
        }
      }
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
    setActiveBottomTab('home'); // Buy stays on home tab
  }, [walletData]);


  // Helper function to get token decimals (with caching)
  const tokenDecimalsCache = useRef<Map<string, number>>(new Map());
  
  const getTokenDecimals = useCallback(async (tokenAddress: string): Promise<number> => {
    const addr = tokenAddress.toLowerCase();
    
    // Check cache first
    if (tokenDecimalsCache.current.has(addr)) {
      return tokenDecimalsCache.current.get(addr)!;
    }

    // Known tokens with non-18 decimals
    const knownDecimals: Record<string, number> = {
      // USDC on Base: 6 decimals
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": 6,
      // USDT on Base: 6 decimals  
      "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": 6,
      // cBBTC on Base: 8 decimals
      "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": 8,
      // WETH on Base: 18 decimals
      "0x4200000000000000000000000000000000000006": 18,
    };

    if (knownDecimals[addr]) {
      tokenDecimalsCache.current.set(addr, knownDecimals[addr]);
      return knownDecimals[addr];
    }

    // Fetch from on-chain if not in cache or known list
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const tokenContract = new ethers.Contract(
        addr,
        ["function decimals() view returns (uint8)"],
        provider
      );
      const decimals = await tokenContract.decimals();
      const decimalsNum = Number(decimals);
      tokenDecimalsCache.current.set(addr, decimalsNum);
      return decimalsNum;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch decimals for ${addr}, defaulting to 18:`, error);
      // Default to 18 if fetch fails
      tokenDecimalsCache.current.set(addr, 18);
      return 18;
    }
  }, []);

  // Check token balance
  const checkTokenBalance = useCallback(async (tokenAddress: string, amount: string) => {
    if (!walletData?.address || !amount || parseFloat(amount) <= 0) {
      setTokenBalance('0');
      setInsufficientFunds(false);
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const decimals = await getTokenDecimals(tokenAddress);
      
      // Check if it's ETH/WETH
      const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
      if (tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        const balance = await provider.getBalance(walletData.address);
        const balanceFormatted = parseFloat(ethers.formatEther(balance));
        setTokenBalance(balanceFormatted.toFixed(6));
        setInsufficientFunds(balanceFormatted < parseFloat(amount));
      } else {
        // Check ERC20 token balance
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const balance = await tokenContract.balanceOf(walletData.address);
        const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
        setTokenBalance(balanceFormatted.toFixed(6));
        setInsufficientFunds(balanceFormatted < parseFloat(amount));
      }
    } catch (error) {
      console.error('Error checking token balance:', error);
      setTokenBalance('0');
      setInsufficientFunds(false);
    }
  }, [walletData?.address, getTokenDecimals]);

  // Fetch swap quote (always fetch even if insufficient funds)
  const fetchSwapQuote = useCallback(async (amount: string, tokenIn: {symbol: string; address: string}, tokenOut: {symbol: string; address: string}) => {
    if (!amount || parseFloat(amount) <= 0 || !tokenIn || !tokenOut) {
      setSwapReceiveAmount('0');
      setSwapQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    
    // Check balance in parallel but don't block quote fetching (still get quote even if insufficient funds)
    checkTokenBalance(tokenIn.address, amount).catch(err => console.error('Balance check error:', err));
    
    try {
      const sellToken = tokenIn.address;
      const buyToken = tokenOut.address;

      // Get actual decimals for both tokens
      const [sellTokenDecimals, buyTokenDecimals] = await Promise.all([
        getTokenDecimals(sellToken),
        getTokenDecimals(buyToken)
      ]);
      
      // Convert amount to wei using sell token's decimals
      const amountWei = (parseFloat(amount) * Math.pow(10, sellTokenDecimals)).toFixed(0);
      
      const params = new URLSearchParams({
        chainId: "8453",
        sellToken,
        buyToken,
        sellAmount: amountWei
      });

      const res = await fetch(`/api/0x/price?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data?.buyAmount) {
        // Convert buyAmount from wei using buy token's decimals
        const buyAmount = parseFloat(data.buyAmount) / Math.pow(10, buyTokenDecimals);
        let formattedAmt: string;
        if (buyAmount >= 1) {
          formattedAmt = buyAmount.toFixed(4);
        } else if (buyAmount >= 0.01) {
          formattedAmt = buyAmount.toFixed(6);
        } else if (buyAmount >= 0.0001) {
          formattedAmt = buyAmount.toFixed(8);
        } else {
          formattedAmt = buyAmount.toExponential(4);
        }
        setSwapReceiveAmount(formattedAmt);
        setSwapQuote({ ...data, sellTokenDecimals, buyTokenDecimals });
      } else {
        console.error('Quote API error:', data);
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
  }, [getTokenDecimals, checkTokenBalance]);

  // Fetch balance for the pay token (without checking against an amount)
  const fetchPayTokenBalance = useCallback(async (tokenAddress: string) => {
    if (!walletData?.address) {
      setTokenBalance('0');
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const decimals = await getTokenDecimals(tokenAddress);
      
      // Check if it's ETH/WETH
      const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
      if (tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        const balance = await provider.getBalance(walletData.address);
        const balanceFormatted = parseFloat(ethers.formatEther(balance));
        setTokenBalance(balanceFormatted.toFixed(6));
      } else {
        // Check ERC20 token balance
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const balance = await tokenContract.balanceOf(walletData.address);
        const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
        setTokenBalance(balanceFormatted.toFixed(6));
      }
    } catch (error) {
      console.error('Error fetching pay token balance:', error);
      setTokenBalance('0');
    }
  }, [walletData?.address, getTokenDecimals]);

  // Handle token selection
  const handleTokenSelect = useCallback(async (token: {symbol: string; address: string; logo?: string; name?: string; priceUsd?: number}) => {
    // Fetch logo and price from DexScreener if not available
    let tokenWithData = { ...token };
    
    if (token.address.toLowerCase() === ETH_TOKEN.address.toLowerCase()) {
      // ETH token - use known logo and current price
      tokenWithData.logo = 'https://assets.coingecko.com/coins/images/279/small/ethereum.png';
      tokenWithData.priceUsd = ethPrice;
    } else if (!token.logo || !token.priceUsd) {
      // Fetch from DexScreener for other tokens
      const data = await getTokenData(token.address);
      if (data.logo) tokenWithData.logo = data.logo;
      if (data.priceUsd) tokenWithData.priceUsd = data.priceUsd;
    }
    
    if (selectingTokenFor === 'pay') {
      setSwapPayToken(tokenWithData);
      // Fetch balance for the new pay token
      setTokenBalance('0');
      setInsufficientFunds(false);
      fetchPayTokenBalance(tokenWithData.address);
    } else if (selectingTokenFor === 'receive') {
      setSwapReceiveToken(tokenWithData);
    } else if (selectingTokenFor === 'send') {
      setSendToken(tokenWithData);
    }
    
    // Add to recent tokens (unless it's ETH)
    if (token.address.toLowerCase() !== ETH_TOKEN.address.toLowerCase()) {
      addToRecentTokens(tokenWithData);
    }
    
    setShowTokenSelector(false);
    setTokenSearchQuery('');
    setTokenSearchResults([]);
    
    // Refresh quote if amount is set
    if (swapPayAmount && parseFloat(swapPayAmount) > 0) {
      const tokenToUse = selectingTokenFor === 'pay' ? tokenWithData : swapPayToken;
      const receiveTokenToUse = selectingTokenFor === 'receive' ? tokenWithData : swapReceiveToken;
      if (tokenToUse && receiveTokenToUse) {
        fetchSwapQuote(swapPayAmount, tokenToUse, receiveTokenToUse);
      }
    }
  }, [selectingTokenFor, swapPayAmount, swapPayToken, swapReceiveToken, fetchSwapQuote, addToRecentTokens, getTokenData, fetchPayTokenBalance, ethPrice]);

  // Show swap confirmation dialog
  const handleSwapButtonClick = useCallback(async () => {
    if (!swapPayAmount || parseFloat(swapPayAmount) <= 0 || !swapReceiveAmount || !swapQuote) {
      setSwapError('Please enter a valid amount and wait for the quote.');
      return;
    }

    // Re-check balance before showing confirmation (final check)
    await checkTokenBalance(swapPayToken.address, swapPayAmount);
    
    if (insufficientFunds) {
      setSwapError('Insufficient funds. Please reduce the swap amount.');
      return;
    }

    // Store swap data for confirmation
    setPendingSwapData({
      payAmount: swapPayAmount,
      receiveAmount: swapReceiveAmount,
      payToken: swapPayToken,
      receiveToken: swapReceiveToken,
      quote: swapQuote
    });
    setShowSwapConfirmation(true);
    setSwapError(null); // Clear any previous errors
  }, [insufficientFunds, swapPayAmount, swapReceiveAmount, swapQuote, swapPayToken, swapReceiveToken, checkTokenBalance]);

  // Execute Auto DCA after profitable swap
  const executeAutoDca = useCallback(async (profitAmount: string, profitTokenAddress: string, profitTokenSymbol: string) => {
    if (!autoDcaEnabled || !walletData || parseFloat(profitAmount) <= 0) {
      return;
    }

    // Calculate DCA amount (percentage of profit)
    const dcaAmount = (parseFloat(profitAmount) * autoDcaPercentage / 100).toFixed(8);
    
    if (parseFloat(dcaAmount) <= 0) {
      console.log('DCA amount too small, skipping');
      return;
    }

    // Don't DCA if the profit token IS the DCA asset
    if (profitTokenAddress.toLowerCase() === autoDcaAsset.address.toLowerCase() ||
        profitTokenSymbol === autoDcaAsset.symbol) {
      console.log('Profit already in DCA asset, skipping');
      return;
    }

    console.log(`🔄 Executing Auto DCA: ${dcaAmount} ${profitTokenSymbol} → ${autoDcaAsset.symbol}`);

    try {
      const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
      const inputTokenAddress = profitTokenAddress.toLowerCase() !== WETH_ADDRESS.toLowerCase() 
        ? profitTokenAddress 
        : undefined;
      const outputTokenAddress = autoDcaAsset.address.toLowerCase() !== WETH_ADDRESS.toLowerCase() 
        ? autoDcaAsset.address 
        : undefined;

      const inputTokenSymbol = profitTokenSymbol === 'WETH' || profitTokenSymbol === 'ETH' ? 'ETH' : profitTokenSymbol;
      const outputTokenSymbol = autoDcaAsset.symbol === 'WETH' ? 'ETH' : autoDcaAsset.symbol;

      const dcaResponse = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputToken: inputTokenSymbol,
          outputToken: outputTokenSymbol,
          inputAmount: dcaAmount,
          outputAmount: '0', // Will be determined by swap
          slippage: 1.0, // 1% slippage for DCA
          walletAddress: walletData.address,
          privateKey: walletData.privateKey,
          tokenAddress: inputTokenAddress,
          outputTokenAddress: outputTokenAddress
        }),
      });

      const dcaData = await dcaResponse.json();

      if (dcaResponse.ok && dcaData.success) {
        console.log(`✅ Auto DCA successful: ${dcaAmount} ${profitTokenSymbol} → ${autoDcaAsset.symbol}`);
        
        // Add to execution log
        const newLog = {
          timestamp: Date.now(),
          amount: dcaAmount,
          asset: autoDcaAsset.symbol,
          txHash: dcaData.transactionHash
        };
        const updatedLog = [...dcaExecutionLog, newLog].slice(-10); // Keep last 10 entries
        setDcaExecutionLog(updatedLog);
        saveDcaSettings(autoDcaEnabled, autoDcaPercentage, autoDcaAsset, updatedLog);
      } else {
        console.error('Auto DCA failed:', dcaData.error);
      }
    } catch (error) {
      console.error('Auto DCA execution error:', error);
    }
  }, [autoDcaEnabled, autoDcaPercentage, autoDcaAsset, walletData, dcaExecutionLog, saveDcaSettings]);

  // Execute swap (after confirmation)
  const executeSwap = useCallback(async () => {
    if (!walletData || !swapPayAmount || !swapReceiveAmount || !swapPayToken || !swapReceiveToken || !swapQuote) {
      console.error('Missing required swap data');
      setSwapError('Missing swap data. Please try again.');
      return;
    }

    if (!walletData.privateKey) {
      console.error('Wallet private key not found');
      setSwapError('Wallet private key not found. Please reconnect your wallet.');
      return;
    }

    // Final check for insufficient funds before executing
    if (insufficientFunds) {
      setSwapError('Insufficient funds. Please reduce the swap amount.');
      setShowSwapConfirmation(false);
      return;
    }

    setIsSwapping(true);
    setSwapError(null);
    setShowSwapConfirmation(false);
    
    try {
      // Get token decimals
      const [_sellTokenDecimals, _buyTokenDecimals] = await Promise.all([
        getTokenDecimals(swapPayToken.address),
        getTokenDecimals(swapReceiveToken.address)
      ]);

      // Determine token symbols (handle ETH/WETH)
      const inputTokenSymbol = swapPayToken.symbol === 'WETH' || swapPayToken.symbol === 'ETH' ? 'ETH' : swapPayToken.symbol;
      const outputTokenSymbol = swapReceiveToken.symbol === 'WETH' || swapReceiveToken.symbol === 'ETH' ? 'ETH' : swapReceiveToken.symbol;

      // Call the swap execute API
      // Determine correct token addresses for both input and output
      const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
      const inputTokenAddress = swapPayToken.address.toLowerCase() !== WETH_ADDRESS.toLowerCase() 
        ? swapPayToken.address 
        : undefined;
      const outputTokenAddress = swapReceiveToken.address.toLowerCase() !== WETH_ADDRESS.toLowerCase() 
        ? swapReceiveToken.address 
        : undefined;

      const executeResponse = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputToken: inputTokenSymbol,
          outputToken: outputTokenSymbol,
          inputAmount: swapPayAmount,
          outputAmount: swapReceiveAmount,
          slippage: 0.5, // 0.5% slippage
          walletAddress: walletData.address,
          privateKey: walletData.privateKey,
          tokenAddress: inputTokenAddress, // For selling token
          outputTokenAddress: outputTokenAddress // For buying token
        }),
      });

      const executeData = await executeResponse.json();

      if (!executeResponse.ok || !executeData.success) {
        throw new Error(executeData.error || 'Swap execution failed');
      }

      // Success!
      console.log('✅ Swap successful!', executeData);
      
      // Close confirmation dialog
      setShowSwapConfirmation(false);
      setPendingSwapData(null);
      
      // Determine swap type (buy = receiving token, sell = paying token)
      const isBuy = swapReceiveToken.symbol !== 'ETH' && swapReceiveToken.symbol !== 'WETH';
      
      // Show success notification
      setSwapSuccess({
        type: isBuy ? 'buy' : 'sell',
        amount: swapPayAmount,
        tokenSymbol: swapReceiveToken.symbol,
        txHash: executeData.transactionHash || '',
        received: swapReceiveAmount
      });
      
      // Auto-hide success banner after 8 seconds
      setTimeout(() => {
        setSwapSuccess(null);
      }, 8000);
      
      // Execute Auto DCA if enabled and swap was profitable (selling for ETH/stables)
      // DCA is triggered when selling tokens for ETH/USDC/USDT (taking profits)
      const profitableOutputs = ['ETH', 'WETH', 'USDC', 'USDT', 'DAI'];
      if (autoDcaEnabled && profitableOutputs.includes(swapReceiveToken.symbol.toUpperCase())) {
        // Execute DCA with a slight delay to let the main swap settle
        setTimeout(() => {
          executeAutoDca(swapReceiveAmount, swapReceiveToken.address, swapReceiveToken.symbol);
        }, 3000);
      }
      
      // Refresh wallet data to show updated balances
      // Trigger reload by reloading wallet from storage
      if (walletData.address) {
        loadWallet();
      }
      
      // Reset form after a short delay
      setTimeout(() => {
        setSwapPayAmount('0');
        setSwapReceiveAmount('0');
        setSwapQuote(null);
        setInsufficientFunds(false);
        setTokenBalance('0');
        setSwapError(null);
      }, 2000);
      
    } catch (error) {
      console.error('❌ Error executing swap:', error);
      const errorMessage = error instanceof Error ? error.message : 'Swap failed. Please try again.';
      setSwapError(errorMessage);
      
      // Clear error after 5 seconds
      setTimeout(() => setSwapError(null), 5000);
    } finally {
      setIsSwapping(false);
    }
  }, [walletData, swapPayAmount, swapReceiveAmount, swapPayToken, swapReceiveToken, swapQuote, insufficientFunds, getTokenDecimals, loadWallet, autoDcaEnabled, executeAutoDca]);

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
    setActiveBottomTab('send');
  }, [walletData]);

  // Handle receive
  const handleReceive = useCallback(() => {
    if (!walletData) {
      console.error("Action failed");
      return;
    }
    setCurrentSection('receive');
    setActiveBottomTab('send'); // Receive is part of the send tab
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
      // Clear localStorage
      localStorage.removeItem("cypherx_wallet");
      localStorage.removeItem("userInfo");
      
      // Clear state
      setSelfCustodialWallet(null);
      setWalletData(null);
      setEthBalance("0.0");
      setTransactions([]);
      setUserAlias('');
      setShowOnboarding(true);
      
      // Dispatch event to notify WalletDisplay
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("wallet-updated"));
      }
      
      console.log("Wallet cleared successfully");
    }
  }, [setSelfCustodialWallet, setShowOnboarding]);

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
      // Show wallet loaded toast only once when wallet is first loaded
      if (!walletLoadedRef.current) {
        console.log("Action completed");
        walletLoadedRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletData?.address]);
  
  // Separate effect for history tab
  useEffect(() => {
    if (activeTab === "history" && walletData?.address) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, walletData?.address]);

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
    // Only count visible tokens (exclude hidden ones)
    const visibleTokensValue = tokenHoldings
      .filter(token => !hiddenTokens.has(token.contractAddress))
      .reduce((sum, token) => sum + (token.usdValue || 0), 0);
    const totalBalance = ethPrice > 0 ? (parseFloat(ethBalance) * ethPrice + visibleTokensValue).toFixed(2) : '0.00';
    
    if (!showBalance) {
      return '*'.repeat(totalBalance.length);
    }
    return `$${totalBalance}`;
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
                key="loading-backdrop"
                className="fixed inset-0 bg-[#02050d]/80 backdrop-blur-sm z-[9999998]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
              />
            )}
            <motion.div
            key="loading-wallet-dropdown"
            className={isMobile
              ? "fixed inset-0 bottom-0 w-full bg-[#0d1628] border-t border-[#1f2a44] shadow-2xl z-[9999999] h-[70vh] max-h-[640px] flex flex-col overflow-hidden rounded-none"
              : "fixed top-[85px] right-8 w-[400px] bg-[#0d1628] border border-[#1f2a44] shadow-2xl z-[9999999] max-h-[70vh] overflow-hidden rounded-[24px] flex flex-col"
              }
              style={!isMobile ? {
                top: '85px'
              } : undefined}
              initial={isMobile ? { opacity: 0, y: 200 } : { opacity: 0, scale: 0.95, y: 0 }}
              animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { opacity: 0, y: 200 } : { opacity: 0, scale: 0.95, y: 0 }}
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
              key="password-modal"
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
              key="mobile-backdrop"
              className="fixed inset-0 bg-[#02050d]/80 backdrop-blur-sm z-[9999998]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
          )}

          <motion.div
            key="wallet-dropdown"
            data-wallet-dropdown
            className={isMobile
              ? "fixed left-0 right-0 bottom-0 w-screen bg-[#0d1628] border-t border-[#1f2a44] shadow-2xl z-[9999999] h-[70vh] max-h-[680px] flex flex-col overflow-hidden rounded-t-[28px]"
              : "fixed top-[85px] right-8 w-[400px] bg-[#0d1628] border border-[#1f2a44] shadow-2xl z-[9999999] max-h-[70vh] overflow-hidden rounded-[24px] flex flex-col"
        }
            style={!isMobile ? {
              top: '85px',
              transform: 'translateY(0)'
            } : {}}
            initial={isMobile 
              ? { opacity: 0, y: 200 }
              : { opacity: 0, scale: 0.95 }
            }
            animate={isMobile 
              ? { opacity: 1, y: 0 }
              : { opacity: 1, scale: 1 }
            }
            exit={isMobile 
              ? { opacity: 0, y: 200 }
              : { opacity: 0, scale: 0.95, y: 0 }
            }
            transition={{ duration: 0.3 }}
          >
            {isMobile && (
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-12 h-1.5 rounded-full bg-gray-500/60" />
              </div>
            )}
            {/* Wallet Header */}
            <div className={`px-4 py-3 border-b border-gray-800/50 ${isMobile ? "rounded-t-[28px]" : "rounded-t-[24px]"}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center">
                    <FaWallet className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <button
                      onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                      className="flex items-center gap-1 text-sm font-medium text-white hover:text-gray-300 transition-colors"
                    >
                      <span>{userAlias || 'Account 1'}</span>
                      <svg className={`w-3 h-3 text-gray-500 transition-transform ${showWalletDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-gray-500">
                        {walletData?.address ? `${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}` : 'Not Connected'}
                      </span>
                      <button onClick={copyAddress} className="text-gray-500 hover:text-gray-400 transition-colors">
                        <FiCopy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-800/50 transition-colors rounded-lg"
                    title="Settings"
                  >
                    <FiSettings className="w-4 h-4" />
                  </button>
                  {walletData?.address && (
                    <button
                      onClick={() => window.open(`/explorer/address/${walletData.address}`, '_blank')}
                      className="p-2 text-gray-500 hover:text-white hover:bg-gray-800/50 transition-colors rounded-lg"
                      title="View in Explorer"
                    >
                      <FiExternalLink className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-500 hover:text-white hover:bg-gray-800/50 transition-colors rounded-lg"
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
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
                {currentSection === 'main' && (
                  <div className="px-4 py-4 flex-1">
                    <div className="space-y-1">
                      {/* Send Option */}
                      <button
                        onClick={handleSend}
                        className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-800/30 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <div className="text-sm text-white">Send</div>
                            <div className="text-xs text-gray-500">Transfer tokens</div>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      <div className="border-b border-gray-800/50 my-1" />

                      {/* Receive Option */}
                      <button
                        onClick={handleReceive}
                        className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-800/30 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <div className="text-sm text-white">Receive</div>
                            <div className="text-xs text-gray-500">Show address & QR</div>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {currentSection === 'send' && (
                  <div className="px-4 py-4 flex-1 overflow-y-auto scrollbar-hide">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setCurrentSection('main')}
                        className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="text-sm font-medium text-white">Send</span>
                    </div>

                    <div className="space-y-4">
                      {/* Token Selection */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-2">Token</label>
                        <button
                          onClick={() => {
                            setSelectingTokenFor('send');
                            setShowTokenSelector(true);
                            setTokenSearchQuery('');
                            setTokenSearchResults([]);
                          }}
                          className="w-full flex items-center justify-between gap-2 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5 hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {renderTokenIcon(sendToken, 'sm')}
                            <span className="text-sm text-white">{sendToken.symbol}</span>
                          </div>
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Amount */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-2">Amount</label>
                        <input
                          type="number"
                          value={sendAmount}
                          onChange={(e) => setSendAmount(e.target.value)}
                          placeholder="0.0"
                          className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
                        />
                        <div className="text-xs text-gray-500 mt-1.5">
                          Balance: {sendToken.symbol === 'ETH' ? parseFloat(ethBalance).toFixed(6) : 
                            tokenHoldings.find(t => t.symbol === sendToken.symbol)?.tokenBalance || '0'} {sendToken.symbol}
                        </div>
                      </div>

                      {/* Address */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-2">To Address</label>
                        <input
                          type="text"
                          value={sendAddress}
                          onChange={(e) => setSendAddress(e.target.value)}
                          placeholder="0x..."
                          className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
                        />
                      </div>

                      {sendError && (
                        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                          {sendError}
                        </div>
                      )}
                      {sendTxHash && (
                        <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                          Sent!{' '}
                          <a href={`/explorer/tx/${sendTxHash}`} className="underline hover:text-green-300" target="_blank" rel="noopener noreferrer">
                            View tx
                          </a>
                        </div>
                      )}

                      {/* Send Button */}
                      <button
                        onClick={handleSendTransaction}
                        disabled={isSending}
                        className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {isSending ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Token Selector Dropdown - For Send Section */}
                <AnimatePresence>
                  {showTokenSelector && selectingTokenFor === 'send' && (
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
                              ref={tokenSearchInputRef}
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
                          </div>
                        </div>

                        {/* Token List */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3">
                          {isLoadingTokens ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                            </div>
                          ) : (
                            <>
                              {tokenSearchQuery && tokenSearchResults.length > 0 && (
                                <div className="mb-3">
                                  <div className="text-xs text-gray-400 mb-2 px-2">Search Results</div>
                                  <div className="space-y-1">
                                    {tokenSearchResults.map((token, idx) => {
                                      const isSelected = sendToken.address.toLowerCase() === token.address.toLowerCase();
                                      
                                      return (
                                        <button
                                          key={`token-${token.address}-${idx}`}
                                          onClick={() => {
                                            handleTokenSelect(token);
                                            setShowTokenSelector(false);
                                          }}
                                          disabled={isSelected}
                                          className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                                            isSelected 
                                              ? 'bg-blue-500/20 border-blue-500/50 cursor-not-allowed' 
                                              : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/50'
                                          } group`}
                                        >
                                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                                            {renderTokenIcon(token, 'lg')}
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
                                    })}
                                  </div>
                                </div>
                              )}

                              {tokenSearchQuery && !isSearchingTokens && tokenSearchResults.length === 0 && (
                                <div className="text-center py-8">
                                  <div className="text-gray-400 text-sm mb-1">No tokens found</div>
                                  <div className="text-xs text-gray-500">Try searching by symbol, name, or contract address</div>
                                </div>
                              )}

                              {!tokenSearchQuery && (
                                <div>
                                  {/* Wallet Tokens Section */}
                                  {availableTokens.filter(t => t.isWalletToken).length > 0 && (
                                    <div className="mb-4">
                                      <div className="text-xs text-gray-400 mb-2 px-2 flex items-center gap-1.5">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                        <span>Your Wallet</span>
                                      </div>
                                      <div className="space-y-1">
                                        {availableTokens
                                          .filter(t => t.isWalletToken)
                                          .map((token, idx) => {
                                            const isSelected = sendToken.address.toLowerCase() === token.address.toLowerCase();
                                            
                                            return (
                                              <button
                                                key={`token-${token.address}-${idx}`}
                                                onClick={() => {
                                                  handleTokenSelect(token);
                                                  setShowTokenSelector(false);
                                                }}
                                                disabled={isSelected}
                                                className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                                                  isSelected 
                                                    ? 'bg-blue-500/20 border-blue-500/50 cursor-not-allowed' 
                                                    : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/50'
                                                } group`}
                                              >
                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                  {renderTokenIcon(token, 'lg')}
                                                  <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-white text-sm font-medium truncate">{token.symbol}</span>
                                                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded uppercase font-medium">Wallet</span>
                                                    </div>
                                                    <div className="text-xs text-gray-400 truncate">
                                                      {token.name || token.symbol}
                                                      {token.balance && ` • ${parseFloat(token.balance).toFixed(4)}`}
                                                    </div>
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
                                          })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Recent Tokens Section */}
                                  {availableTokens.filter(t => !t.isWalletToken).length > 0 && (
                                    <div>
                                      <div className="text-xs text-gray-400 mb-2 px-2">Recent Tokens</div>
                                      <div className="space-y-1">
                                        {availableTokens
                                          .filter(t => !t.isWalletToken)
                                          .map((token, idx) => {
                                            const isSelected = sendToken.address.toLowerCase() === token.address.toLowerCase();
                                            
                                            return (
                                              <button
                                                key={`token-${token.address}-${idx}`}
                                                onClick={() => {
                                                  handleTokenSelect(token);
                                                  setShowTokenSelector(false);
                                                }}
                                                disabled={isSelected}
                                                className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                                                  isSelected 
                                                    ? 'bg-blue-500/20 border-blue-500/50 cursor-not-allowed' 
                                                    : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/50'
                                                } group`}
                                              >
                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                  {renderTokenIcon(token, 'lg')}
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
                                          })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {currentSection === 'receive' && (
                  <div className={`px-4 ${isMobile ? "py-3 pb-20" : "py-4 pb-6"} flex-1 overflow-y-auto scrollbar-hide`}>
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
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Swap UI */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
                  {/* Header with Slippage */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-white">Swap</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Slippage:</span>
                      {[0.5, 1, 2].map((slip) => (
                        <button
                          key={slip}
                          className="px-2 py-1 text-xs bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white rounded-md transition-colors"
                        >
                          {slip}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* You Pay Section */}
                  <div className={`bg-gray-800/30 rounded-xl p-4 mb-2 ${insufficientFunds ? 'ring-1 ring-red-500/50' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500">You Pay</span>
                      <button
                        onClick={() => setShowUsdValues(!showUsdValues)}
                        className={`text-xs px-2 py-0.5 rounded transition-colors ${
                          showUsdValues ? 'text-white bg-gray-700' : 'text-gray-500 hover:text-gray-400'
                        }`}
                      >
                        USD
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={swapPayAmount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setSwapPayAmount(value);
                          setSwapError(null);
                          setInsufficientFunds(false);
                          if (value && parseFloat(value) > 0 && swapPayToken && swapReceiveToken) {
                            fetchSwapQuote(value, swapPayToken, swapReceiveToken);
                          } else {
                            setSwapReceiveAmount('0');
                            setSwapQuote(null);
                            setInsufficientFunds(false);
                          }
                        }}
                        placeholder="0"
                        className={`flex-1 text-2xl font-light bg-transparent outline-none min-w-0 ${insufficientFunds ? 'text-red-400' : 'text-white'} placeholder-gray-600`}
                      />
                      <button 
                        onClick={() => {
                          setSelectingTokenFor('pay');
                          setShowTokenSelector(true);
                        }}
                        className="flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700/80 rounded-full pl-2 pr-3 py-1.5 transition-colors flex-shrink-0"
                      >
                        {renderTokenIcon(swapPayToken, 'sm')}
                        <span className="text-sm text-white">{swapPayToken.symbol}</span>
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* USD Value */}
                    {showUsdValues && swapPayToken.priceUsd && parseFloat(swapPayAmount) > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        ≈ ${(parseFloat(swapPayAmount) * swapPayToken.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                    
                    {/* Balance & Quick Actions */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/30">
                      <div className="flex items-center gap-1">
                        {[25, 50, 75].map((pct) => (
                          <button 
                            key={pct}
                            onClick={() => {
                              if (parseFloat(tokenBalance) > 0) {
                                const amount = (parseFloat(tokenBalance) * (pct / 100)).toFixed(6);
                                setSwapPayAmount(amount);
                                setInsufficientFunds(false);
                                if (swapReceiveToken) fetchSwapQuote(amount, swapPayToken, swapReceiveToken);
                              }
                            }}
                            disabled={parseFloat(tokenBalance) <= 0}
                            className="px-2 py-1 text-xs bg-gray-700/50 hover:bg-gray-700 disabled:opacity-40 text-gray-400 hover:text-white rounded transition-colors"
                          >
                            {pct}%
                          </button>
                        ))}
                        <button 
                          onClick={() => {
                            if (parseFloat(tokenBalance) > 0) {
                              const isEth = swapPayToken.address.toLowerCase() === '0x4200000000000000000000000000000000000006';
                              const maxAmount = isEth ? Math.max(0, parseFloat(tokenBalance) - 0.001).toFixed(6) : tokenBalance;
                              setSwapPayAmount(maxAmount);
                              setInsufficientFunds(false);
                              if (swapReceiveToken) fetchSwapQuote(maxAmount, swapPayToken, swapReceiveToken);
                            }
                          }}
                          disabled={parseFloat(tokenBalance) <= 0}
                          className="px-2 py-1 text-xs bg-gray-700/50 hover:bg-gray-700 disabled:opacity-40 text-gray-400 hover:text-white rounded transition-colors"
                        >
                          Max
                        </button>
                      </div>
                      <span className="text-xs text-gray-500">
                        Bal: {parseFloat(tokenBalance).toFixed(4)} {swapPayToken.symbol}
                      </span>
                    </div>

                    {insufficientFunds && (
                      <div className="mt-2 text-xs text-red-400">Insufficient balance</div>
                    )}
                  </div>

                  {/* Swap Direction Button */}
                  <div className="flex justify-center -my-3 relative z-10">
                    <button
                      onClick={() => {
                        const temp = swapPayToken;
                        setSwapPayToken(swapReceiveToken);
                        setSwapReceiveToken(temp);
                        setSwapPayAmount(swapReceiveAmount);
                        setSwapReceiveAmount(swapPayAmount);
                      }}
                      className="w-9 h-9 bg-blue-500/20 hover:bg-blue-500/30 border-4 border-[#0d1628] rounded-full flex items-center justify-center transition-colors"
                    >
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </button>
                  </div>

                  {/* You Receive Section */}
                  <div className="bg-gray-800/30 rounded-xl p-4 mb-4">
                    <span className="text-xs text-gray-500 block mb-3">You Receive</span>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-2xl font-light text-white truncate">
                          {isLoadingQuote ? '...' : swapReceiveAmount || '0'}
                        </div>
                        {showUsdValues && swapReceiveToken.priceUsd && parseFloat(swapReceiveAmount) > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            ≈ ${(parseFloat(swapReceiveAmount) * swapReceiveToken.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setSelectingTokenFor('receive');
                          setShowTokenSelector(true);
                        }}
                        className="flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700/80 rounded-full pl-2 pr-3 py-1.5 transition-colors flex-shrink-0"
                      >
                        {renderTokenIcon(swapReceiveToken, 'sm')}
                        <span className="text-sm text-white">{swapReceiveToken.symbol}</span>
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {swapError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                      {swapError}
                    </div>
                  )}

                  {/* Swap Progress */}
                  {isSwapping && (
                    <div className="mb-4 p-4 bg-gray-800/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <div>
                          <div className="text-sm text-white">Processing swap...</div>
                          <div className="text-xs text-gray-500">Please wait</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Swap Button */}
                  {!isSwapping && (
                    <button
                      onClick={handleSwapButtonClick}
                      disabled={!swapPayAmount || parseFloat(swapPayAmount) <= 0 || !swapReceiveToken || isSwapping || isLoadingQuote || !swapQuote || !swapReceiveAmount || parseFloat(swapReceiveAmount) <= 0}
                      className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-xl transition-colors"
                    >
                      {isLoadingQuote ? 'Getting quote...' : insufficientFunds ? 'Insufficient funds' : !swapQuote ? 'Enter amount' : 'Swap'}
                    </button>
                  )}
                </div>

                {/* Swap Confirmation Dialog - Full Page Slide Up */}
                <AnimatePresence>
                  {showSwapConfirmation && pendingSwapData && (
                    <motion.div
                      initial={{ opacity: 0, y: '100%' }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: '100%' }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      className="absolute inset-0 z-50 bg-[#0b1220] flex flex-col"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 flex-shrink-0">
                        <button
                          onClick={() => setShowSwapConfirmation(false)}
                          className="p-2 -ml-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <h3 className="text-base font-semibold text-white">Confirm Swap</h3>
                        <button
                          onClick={() => setShowSwapConfirmation(false)}
                          className="p-2 -mr-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <FiX className="w-5 h-5" />
                        </button>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
                        <div className="space-y-4">
                          {/* You Pay */}
                          <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">You Pay</div>
                            <div className="flex items-center justify-between">
                              <span className="text-xl font-medium text-white">{pendingSwapData.payAmount}</span>
                              <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-2 rounded-xl">
                                {renderTokenIcon(pendingSwapData.payToken, 'md')}
                                <span className="text-sm font-medium text-gray-200">{pendingSwapData.payToken.symbol}</span>
                              </div>
                            </div>
                            {showUsdValues && pendingSwapData.payToken.priceUsd && (
                              <div className="text-xs text-gray-400 mt-1">
                                ≈ ${(parseFloat(pendingSwapData.payAmount) * pendingSwapData.payToken.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                          
                          {/* Swap Arrow */}
                          <div className="flex justify-center -my-2 relative z-10">
                            <div className="w-12 h-12 bg-[#1d4ed8] rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              </svg>
                            </div>
                          </div>
                          
                          {/* You Receive */}
                          <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">You Receive</div>
                            <div className="flex items-center justify-between">
                              <span className="text-xl font-medium text-white">{pendingSwapData.receiveAmount}</span>
                              <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-2 rounded-xl">
                                {renderTokenIcon(pendingSwapData.receiveToken, 'md')}
                                <span className="text-sm font-medium text-gray-200">{pendingSwapData.receiveToken.symbol}</span>
                              </div>
                            </div>
                            {showUsdValues && pendingSwapData.receiveToken.priceUsd && (
                              <div className="text-xs text-gray-400 mt-1">
                                ≈ ${(parseFloat(pendingSwapData.receiveAmount) * pendingSwapData.receiveToken.priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                          
                          {/* Swap Details */}
                          <div className="bg-slate-800/40 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Rate</span>
                              <span className="text-gray-200">
                                1 {pendingSwapData.payToken.symbol} = {(parseFloat(pendingSwapData.receiveAmount) / parseFloat(pendingSwapData.payAmount)).toFixed(6)} {pendingSwapData.receiveToken.symbol}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Slippage</span>
                              <span className="text-gray-200">0.5%</span>
                            </div>
                          </div>
                          
                          {/* Insufficient Funds Warning */}
                          {insufficientFunds && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-red-400">Insufficient funds</div>
                                <div className="text-xs text-red-400/70">You have {tokenBalance} {pendingSwapData.payToken.symbol}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons - Fixed at bottom */}
                      <div className="flex-shrink-0 px-4 py-4 border-t border-slate-700/50 bg-[#0b1220] space-y-3">
                        <button
                          onClick={() => !insufficientFunds && executeSwap()}
                          disabled={insufficientFunds}
                          className="w-full py-4 bg-[#1d4ed8] hover:bg-[#2563eb] active:bg-[#1e40af] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-base"
                        >
                          Confirm Swap
                        </button>
                        <button
                          onClick={() => setShowSwapConfirmation(false)}
                          className="w-full py-3 bg-transparent hover:bg-slate-800 active:bg-slate-700 text-gray-400 hover:text-white font-medium rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                              ref={tokenSearchInputRef}
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
                                    {tokenSearchResults.map((token, idx) => {
                                      const isWalletToken = token.isWalletToken || false;
                                      const isSelected = (selectingTokenFor === 'pay' && swapPayToken.address.toLowerCase() === token.address.toLowerCase()) ||
                                                        (selectingTokenFor === 'receive' && swapReceiveToken.address.toLowerCase() === token.address.toLowerCase()) ||
                                                        (selectingTokenFor === 'send' && sendToken.address.toLowerCase() === token.address.toLowerCase());
                                      
                                      return (
                                        <button
                                          key={`search-${token.address}-${idx}`}
                                          onClick={() => handleTokenSelect(token)}
                                          className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors group ${
                                            isWalletToken 
                                              ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20' 
                                              : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/50'
                                          }`}
                                        >
                                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                                            {renderTokenIcon(token, 'lg')}
                                            <div className="flex-1 min-w-0 text-left">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-white text-sm font-medium truncate">{token.symbol}</span>
                                                {isWalletToken && (
                                                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded uppercase font-medium">Wallet</span>
                                                )}
                                              </div>
                                              <div className="text-xs text-gray-400 truncate">
                                                {token.name || token.symbol}
                                                {isWalletToken && token.balance && ` • ${parseFloat(token.balance).toFixed(4)}`}
                                              </div>
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
                                    })}
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

                              {/* Available Tokens (Wallet Tokens + Recent) */}
                              {!tokenSearchQuery && (
                                <div>
                                  {/* Wallet Tokens Section */}
                                  {availableTokens.filter(t => t.isWalletToken).length > 0 && (
                                <div className={`${isMobile ? "mb-3" : "mb-4"}`}>
                                  <div className={`${isMobile ? "text-[10px] mb-1.5" : "text-xs mb-2"} text-gray-400 px-2 flex items-center gap-1.5`}>
                                    <svg className={`${isMobile ? "w-2.5 h-2.5" : "w-3 h-3"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                    <span>Your Wallet</span>
                                  </div>
                                  <div className={`${isMobile ? "space-y-0.5" : "space-y-1"}`}>
                                        {availableTokens
                                          .filter(t => t.isWalletToken)
                                          .map((token, idx) => {
                                            const isSelected = (selectingTokenFor === 'pay' && swapPayToken.address.toLowerCase() === token.address.toLowerCase()) ||
                                                              (selectingTokenFor === 'receive' && swapReceiveToken.address.toLowerCase() === token.address.toLowerCase()) ||
                                                              (selectingTokenFor === 'send' && sendToken.address.toLowerCase() === token.address.toLowerCase());
                                            
                                            return (
                                              <button
                                                key={`wallet-token-${token.address}-${idx}`}
                                                onClick={() => handleTokenSelect(token)}
                                                disabled={isSelected}
                                                className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                                                  isSelected 
                                                    ? 'bg-blue-500/20 border-blue-500/50 cursor-not-allowed' 
                                                    : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30'
                                                } group`}
                                              >
                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                  {renderTokenIcon(token, 'lg')}
                                                  <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-white text-sm font-medium truncate">{token.symbol}</span>
                                                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded uppercase font-medium">Wallet</span>
                                                    </div>
                                                    <div className="text-xs text-gray-400 truncate">
                                                      {token.name || token.symbol}
                                                      {token.balance && ` • ${parseFloat(token.balance).toFixed(4)}`}
                                                    </div>
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
                                          })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Recent Tokens Section */}
                                  {availableTokens.filter(t => !t.isWalletToken).length > 0 && (
                                    <div>
                                      <div className="text-xs text-gray-400 mb-2 px-2">Recent Tokens</div>
                                      <div className="space-y-1">
                                        {availableTokens
                                          .filter(t => !t.isWalletToken)
                                          .map((token, idx) => {
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
                                                  {renderTokenIcon(token, 'lg')}
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
                                          })}
                                      </div>
                                    </div>
                                  )}

                                  {/* No Tokens Message */}
                                  {availableTokens.length === 0 && (
                                    <div className="text-center py-8 text-gray-400 text-sm">No tokens available</div>
                                  )}
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
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                  {/* Balance Section */}
                  {walletData ? (
                    <div className="px-4 py-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-2xl font-semibold text-white">{getDisplayBalance()}</span>
                        <button 
                          onClick={toggleBalanceVisibility}
                          className="p-1.5 text-gray-500 hover:text-gray-400 transition-colors"
                          title={showBalance ? "Hide balance" : "Show balance"}
                        >
                          {showBalance ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <button onClick={handleEthClick} className="hover:text-gray-400 transition-colors">
                          {getDisplayEthBalance()} ETH
                        </button>
                        <span>•</span>
                        <span>{tokenHoldings.filter(t => !hiddenTokens.has(t.contractAddress)).length + (parseFloat(ethBalance) > 0 ? 1 : 0)} tokens</span>
                        {isRefreshingHoldings && (
                          <div className="w-3 h-3 border border-gray-600 border-t-blue-400 rounded-full animate-spin" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <FaWallet className="w-5 h-5 text-gray-500" />
                      </div>
                      <h3 className="text-sm font-medium text-white mb-1">Welcome to CypherX</h3>
                      <p className="text-xs text-gray-500 mb-4">Create or import a wallet to get started</p>
                      <div className="space-y-2">
                        <button onClick={createWallet} className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors">
                          Create New Wallet
                        </button>
                        <button onClick={importWallet} className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors">
                          Import Existing Wallet
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  {walletData && (
                    <div className="px-4 pb-3">
                      <div className="flex items-center justify-between">
                        <button onClick={handleBuySell} className="flex flex-col items-center flex-1 py-2">
                          <div className="w-9 h-9 bg-blue-500/15 hover:bg-blue-500/25 rounded-full flex items-center justify-center mb-1.5 transition-colors">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <span className="text-[10px] text-gray-400">Buy</span>
                        </button>
                        <button onClick={handleSwap} className="flex flex-col items-center flex-1 py-2">
                          <div className="w-9 h-9 bg-blue-500/15 hover:bg-blue-500/25 rounded-full flex items-center justify-center mb-1.5 transition-colors">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </div>
                          <span className="text-[10px] text-gray-400">Swap</span>
                        </button>
                        <button onClick={handleSend} className="flex flex-col items-center flex-1 py-2">
                          <div className="w-9 h-9 bg-blue-500/15 hover:bg-blue-500/25 rounded-full flex items-center justify-center mb-1.5 transition-colors">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          </div>
                          <span className="text-[10px] text-gray-400">Send</span>
                        </button>
                        <button onClick={handleReceive} className="flex flex-col items-center flex-1 py-2">
                          <div className="w-9 h-9 bg-blue-500/15 hover:bg-blue-500/25 rounded-full flex items-center justify-center mb-1.5 transition-colors">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </div>
                          <span className="text-[10px] text-gray-400">Receive</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Navigation Tabs */}
                  <div className="px-4 py-2 border-b border-gray-800/50">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setActiveTab("overview")}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          activeTab === "overview" 
                            ? "text-blue-400 bg-blue-500/10" 
                            : "text-gray-500 hover:text-gray-400"
                        }`}
                      >
                        Tokens
                      </button>
                      <button
                        onClick={() => setActiveTab("history")}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          activeTab === "history" 
                            ? "text-blue-400 bg-blue-500/10" 
                            : "text-gray-500 hover:text-gray-400"
                        }`}
                      >
                        Activity
                      </button>
                    </div>
                  </div>

                  {/* Content Sections */}
                  {activeTab === "overview" && (
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                      {/* Token List */}
                      {(tokenHoldings.length > 0 || parseFloat(ethBalance) > 0) ? (
                        <div>
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

                          {/* ETH Balance */}
                          {parseFloat(ethBalance) > 0 && !balanceError && (
                            <button 
                              onClick={handleEthClick}
                              className="w-full flex items-center py-3.5 px-4 hover:bg-gray-800/30 transition-colors border-b border-gray-800/40 group"
                            >
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0 mr-3">
                                <img 
                                  src="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
                                  alt="ETH"
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm font-medium text-white">Ethereum</div>
                                <div className="text-xs text-gray-500">{getDisplayEthBalance()} ETH</div>
                              </div>
                              <div className="text-right ml-3">
                                <div className="text-sm font-medium text-white">${ethPrice > 0 ? (parseFloat(ethBalance) * ethPrice).toFixed(2) : '0.00'}</div>
                                <div className="text-xs text-gray-500">${ethPrice > 0 ? ethPrice.toFixed(2) : '—'}</div>
                              </div>
                            </button>
                          )}

                          {/* Token Holdings Loading State - Only on initial load */}
                          {isLoadingHoldings && tokenHoldings.length === 0 && (
                            <div className="flex items-center justify-center py-12">
                              <LoadingSpinner size="md" text="Loading..." />
                            </div>
                          )}

                          {/* Token Holdings Error State */}
                          {holdingsError && !isLoadingHoldings && tokenHoldings.length === 0 && (
                            <div className="p-4">
                              <ErrorDisplay 
                                error={holdingsError} 
                                variant="card" 
                                onRetry={() => fetchTokenHoldings(true)}
                              />
                            </div>
                          )}

                          {/* Other Token Holdings */}
                          {tokenHoldings
                            .filter(token => !hiddenTokens.has(token.contractAddress))
                            .map((token, index) => (
                            <button 
                              key={token.contractAddress || index} 
                              onClick={() => handleTokenClick(token)}
                              className="w-full flex items-center py-3.5 px-4 hover:bg-gray-800/30 transition-colors border-b border-gray-800/40 group relative"
                            >
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0 mr-3">
                                {token.logo ? (
                                  <img 
                                    src={token.logo} 
                                    alt={token.symbol}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const fallback = e.currentTarget.parentElement?.querySelector('.token-fallback');
                                      if (fallback) fallback.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`token-fallback w-full h-full flex items-center justify-center text-gray-400 font-medium text-sm ${token.logo ? 'hidden' : ''}`}>
                                  {(token.symbol || 'T').charAt(0).toUpperCase()}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm font-medium text-white truncate">{token.name || token.symbol}</div>
                                <div className="text-xs text-gray-500">{parseFloat(token.tokenBalance || '0').toFixed(4)} {token.symbol}</div>
                              </div>
                              <div className="text-right ml-3">
                                <div className="text-sm font-medium text-white">${token.usdValue ? parseFloat(token.usdValue).toFixed(2) : '0.00'}</div>
                                <div className="text-xs text-gray-500">${token.priceUsd ? parseFloat(token.priceUsd).toFixed(2) : '—'}</div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTokenVisibility(token.contractAddress);
                                }}
                                className="absolute right-4 opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-gray-300 transition-all"
                                title="Hide token"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </button>
                          ))}
                          
                          {/* Hidden Tokens Section */}
                          {hiddenTokens.size > 0 && (
                            <div className="border-t border-gray-800/40">
                              <button
                                onClick={() => setShowHiddenSection(!showHiddenSection)}
                                className="w-full flex items-center justify-between py-3 px-4 text-gray-500 hover:text-gray-400 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                  </svg>
                                  <span className="text-xs">Hidden ({hiddenTokens.size})</span>
                                </div>
                                <svg className={`w-4 h-4 transition-transform ${showHiddenSection ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              
                              {showHiddenSection && (
                                <div className="px-4 pb-3">
                                  <div className="bg-gray-800/20 rounded-lg overflow-hidden">
                                    {tokenHoldings
                                      .filter(token => hiddenTokens.has(token.contractAddress))
                                      .map((token, index) => (
                                        <div 
                                          key={token.contractAddress || index}
                                          className="flex items-center justify-between py-2.5 px-3 border-b border-gray-800/30 last:border-b-0"
                                        >
                                          <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0 opacity-50">
                                              {token.logo ? (
                                                <img src={token.logo} alt={token.symbol} className="w-full h-full object-cover" />
                                              ) : (
                                                <span className="text-gray-500 text-xs">{(token.symbol || 'T').charAt(0)}</span>
                                              )}
                                            </div>
                                            <div className="opacity-60">
                                              <div className="text-xs text-gray-400">{token.symbol}</div>
                                              <div className="text-[10px] text-gray-600">${token.usdValue ? parseFloat(token.usdValue).toFixed(2) : '0.00'}</div>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => unhideToken(token.contractAddress)}
                                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                          >
                                            Unhide
                                          </button>
                                        </div>
                                      ))}
                                  </div>
                                  <button
                                    onClick={showAllTokens}
                                    className="w-full mt-2 py-2 text-xs text-gray-500 hover:text-gray-400 transition-colors"
                                  >
                                    Unhide all
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 px-4">
                          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-400">No tokens found</p>
                          <p className="text-xs text-gray-500 mt-1">Your tokens will appear here</p>
                        </div>
                      )}
                    </div>
                  )}

                        {activeTab === "history" && !walletLoading && (
                    <div className="h-96 overflow-y-auto scrollbar-hide">
                      {isLoadingTransactions ? (
                        <div className="flex items-center justify-center py-12">
                          <LoadingSpinner size="md" text="Loading..." />
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
                        <div>
                          {transactions.map((tx, index) => {
                            const isIncoming = tx.type === 'incoming' || tx.type === 'buy';
                            const isOutgoing = tx.type === 'outgoing' || tx.type === 'sell';
                            
                            const formattedAmount = tx.amount && parseFloat(tx.amount) > 0 
                              ? (parseFloat(tx.amount) < 0.0001 
                                  ? parseFloat(tx.amount).toExponential(2) 
                                  : parseFloat(tx.amount).toFixed(6))
                              : '0';

                            const getLabel = () => {
                              switch (tx.type) {
                                case 'incoming': return 'Received';
                                case 'outgoing': return 'Sent';
                                case 'buy': return 'Bought';
                                case 'sell': return 'Sold';
                                case 'swap': return 'Swapped';
                                default: return 'Transaction';
                              }
                            };

                            return (
                              <div 
                                key={tx.hash || tx.id || index}
                                className={`flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 border-b border-gray-800/40 cursor-pointer transition-colors`}
                                onClick={() => tx.hash && (window.location.href = `/explorer/tx/${tx.hash}`)}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Simple icon */}
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    isIncoming ? 'bg-green-500/15 text-green-400' :
                                    isOutgoing ? 'bg-red-500/15 text-red-400' :
                                    'bg-gray-700/50 text-gray-400'
                                  }`}>
                                    {isIncoming ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                      </svg>
                                    ) : isOutgoing ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                      </svg>
                                    )}
                                  </div>
                                  
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-white">{getLabel()}</span>
                                      {tx.status === 'pending' && (
                                        <span className="text-[10px] text-yellow-400">• Pending</span>
                                      )}
                                      {tx.status === 'failed' && (
                                        <span className="text-[10px] text-red-400">• Failed</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                      }) + ' at ' + new Date(tx.timestamp).toLocaleTimeString([], {
                                        hour: '2-digit', 
                                        minute: '2-digit'
                                      }) : 'Unknown'}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className={`text-sm ${
                                    isIncoming ? 'text-green-400' : 
                                    isOutgoing ? 'text-red-400' : 
                                    'text-white'
                                  }`}>
                                    {isIncoming ? '+' : isOutgoing ? '-' : ''}{formattedAmount} {tx.token || 'ETH'}
                                  </div>
                                  {tx.usdValue && parseFloat(tx.usdValue) > 0 && (
                                    <div className="text-xs text-gray-500">
                                      ${parseFloat(tx.usdValue).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 px-4">
                          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-400">No transactions yet</p>
                          <p className="text-xs text-gray-500 mt-1">Activity will appear here</p>
                        </div>
                      )}
                    </div>
               )}

               {/* Settings Tab */}
               {activeTab === "settings" && !walletLoading && (
                 <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
                   {/* Header */}
                   {isMobile && (
                     <div className="flex items-center gap-2 mb-4">
                       <button
                         onClick={() => setActiveTab("overview")}
                         className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
                       >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                         </svg>
                       </button>
                       <span className="text-sm font-medium text-white">Settings</span>
                     </div>
                   )}

                   {/* Settings List */}
                   <div className="space-y-1">
                     {/* Private Key */}
                     <button
                       onClick={() => setShowPrivateKey(!showPrivateKey)}
                       className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-800/30 rounded-lg transition-colors group"
                     >
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                           {showPrivateKey ? <FaEyeSlash className="w-3.5 h-3.5 text-gray-400" /> : <FaEye className="w-3.5 h-3.5 text-gray-400" />}
                         </div>
                         <div className="text-left">
                           <div className="text-sm text-white">Private Key</div>
                           <div className="text-xs text-gray-500">{showPrivateKey ? 'Tap to hide' : 'Reveal your key'}</div>
                         </div>
                       </div>
                       <svg className={`w-4 h-4 text-gray-500 transition-transform ${showPrivateKey ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                       </svg>
                     </button>

                     {/* Private Key Expanded */}
                     <AnimatePresence>
                       {showPrivateKey && walletData && (
                         <motion.div
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: 'auto', opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           className="overflow-hidden"
                         >
                           <div className="ml-11 mb-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                             <div className="flex items-center gap-1.5 text-yellow-500 text-xs mb-2">
                               <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                 <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                               </svg>
                               Keep this secret!
                             </div>
                             <div className="text-[11px] font-mono text-gray-300 break-all bg-gray-900/50 p-2 rounded mb-2">
                               {walletData.privateKey}
                             </div>
                             <button
                               onClick={copyPrivateKey}
                               className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded transition-colors"
                             >
                               Copy to Clipboard
                             </button>
                           </div>
                         </motion.div>
                       )}
                     </AnimatePresence>

                     <div className="border-b border-gray-800/50 my-2" />

                     {/* Auto DCA Toggle */}
                     <div className="py-3 px-1">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                             <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                             </svg>
                           </div>
                           <div>
                             <div className="text-sm text-white">Auto Profit DCA</div>
                             <div className="text-xs text-gray-500">Auto-save profits</div>
                           </div>
                         </div>
                         <button
                           onClick={() => {
                             const newEnabled = !autoDcaEnabled;
                             setAutoDcaEnabled(newEnabled);
                             saveDcaSettings(newEnabled, autoDcaPercentage, autoDcaAsset, dcaExecutionLog);
                           }}
                           className={`relative w-10 h-5 rounded-full transition-colors ${autoDcaEnabled ? 'bg-blue-500' : 'bg-gray-700'}`}
                         >
                           <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoDcaEnabled ? 'left-5' : 'left-0.5'}`} />
                         </button>
                       </div>

                       {/* DCA Options */}
                       <AnimatePresence>
                         {autoDcaEnabled && (
                           <motion.div
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: 'auto', opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="overflow-hidden"
                           >
                             <div className="mt-3 ml-11 space-y-3">
                               {/* Percentage */}
                               <div>
                                 <div className="flex items-center justify-between mb-2">
                                   <span className="text-xs text-gray-500">Percentage</span>
                                   <span className="text-xs text-blue-400">{autoDcaPercentage}%</span>
                                 </div>
                                 <div className="flex gap-1.5">
                                   {[5, 10, 25, 50].map((pct) => (
                                     <button
                                       key={pct}
                                       onClick={() => {
                                         setAutoDcaPercentage(pct);
                                         saveDcaSettings(autoDcaEnabled, pct, autoDcaAsset, dcaExecutionLog);
                                       }}
                                       className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                                         autoDcaPercentage === pct
                                           ? 'bg-blue-500 text-white'
                                           : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                       }`}
                                     >
                                       {pct}%
                                     </button>
                                   ))}
                                 </div>
                               </div>

                               {/* Asset */}
                               <div>
                                 <span className="text-xs text-gray-500 block mb-2">Convert to</span>
                                 <div className="flex gap-1.5">
                                   {DCA_ASSETS.map((asset) => (
                                     <button
                                       key={asset.symbol}
                                       onClick={() => {
                                         setAutoDcaAsset(asset);
                                         saveDcaSettings(autoDcaEnabled, autoDcaPercentage, asset, dcaExecutionLog);
                                       }}
                                       className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded transition-colors ${
                                         autoDcaAsset.symbol === asset.symbol
                                           ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
                                           : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                       }`}
                                     >
                                       <img 
                                         src={asset.logo} 
                                         alt={asset.symbol}
                                         className="w-4 h-4 rounded-full"
                                         onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${asset.symbol}&background=374151&color=fff&size=16`)}
                                       />
                                       <span className="text-xs">{asset.symbol}</span>
                                     </button>
                                   ))}
                                 </div>
                               </div>

                               <p className="text-[11px] text-gray-500">
                                 When selling to ETH/USDC, {autoDcaPercentage}% auto-converts to {autoDcaAsset.symbol}
                               </p>
                             </div>
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </div>

                     <div className="border-b border-gray-800/50 my-2" />

                     {/* Backup */}
                     <button
                       onClick={handleBackup}
                       className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-800/30 rounded-lg transition-colors"
                     >
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                           <FaDownload className="w-3.5 h-3.5 text-gray-400" />
                         </div>
                         <div className="text-left">
                           <div className="text-sm text-white">Backup Wallet</div>
                           <div className="text-xs text-gray-500">Download backup file</div>
                         </div>
                       </div>
                       <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                       </svg>
                     </button>

                     {/* Import */}
                     <button
                       onClick={handleImport}
                       className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-800/30 rounded-lg transition-colors"
                     >
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                           <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                           </svg>
                         </div>
                         <div className="text-left">
                           <div className="text-sm text-white">Import Wallet</div>
                           <div className="text-xs text-gray-500">Restore from backup</div>
                         </div>
                       </div>
                       <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                       </svg>
                     </button>

                     <div className="border-b border-gray-800/50 my-2" />

                     {/* Clear Wallet */}
                     <button
                       onClick={handleClearWallet}
                       className="w-full flex items-center justify-between py-3 px-1 hover:bg-red-500/10 rounded-lg transition-colors group"
                     >
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gray-800 group-hover:bg-red-500/20 flex items-center justify-center transition-colors">
                           <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                           </svg>
                         </div>
                         <div className="text-left">
                           <div className="text-sm text-red-400">Clear Wallet</div>
                           <div className="text-xs text-gray-500">Remove from device</div>
                         </div>
                       </div>
                     </button>
                   </div>

                   {/* Footer */}
                   <div className="mt-6 pt-4 border-t border-gray-800/50">
                     <div className="flex items-center justify-between text-xs text-gray-500">
                       <span>Created</span>
                       <span className="text-gray-400">
                         {walletData ? new Date(walletData.createdAt || Date.now()).toLocaleDateString() : 'Unknown'}
                       </span>
                     </div>
                   </div>
                 </div>
               )}
                  </div>
                  
                  {/* Bottom Tab Navigation */}
                  <div className="border-t border-gray-800/50 px-2 py-2 flex items-center justify-around flex-shrink-0 bg-[#0a0f1a]">
                    <button
                      onClick={() => {
                        setActiveBottomTab('home');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className={`flex flex-col items-center py-1.5 px-4 rounded-lg transition-colors ${(activeBottomTab as string) === 'home' ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500 hover:text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="text-[10px] mt-0.5">Home</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('swap');
                        setCurrentSection('swap');
                      }}
                      className={`flex flex-col items-center py-1.5 px-4 rounded-lg transition-colors ${(activeBottomTab as string) === 'swap' ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500 hover:text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      <span className="text-[10px] mt-0.5">Swap</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('history');
                        setActiveTab('history');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className={`flex flex-col items-center py-1.5 px-4 rounded-lg transition-colors ${(activeBottomTab as string) === 'history' ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500 hover:text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[10px] mt-0.5">Activity</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('send');
                        setCurrentSection('main');
                      }}
                      className={`flex flex-col items-center py-1.5 px-4 rounded-lg transition-colors ${(activeBottomTab as string) === 'send' ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500 hover:text-gray-400'}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span className="text-[10px] mt-0.5">Send</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Asset Details Section */}
              {walletSystem === "self-custodial" && currentSection === 'main' && currentView === 'asset-details' && selectedTokenForChart && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50">
                      <button
                        onClick={handleBackToMain}
                        className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
                      >
                        <FaArrowLeft className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
                          <img 
                            src={selectedTokenForChart.logo || `https://ui-avatars.com/api/?name=${selectedTokenForChart.symbol}&background=1f2937&color=60a5fa&size=32`}
                            alt={selectedTokenForChart.symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${selectedTokenForChart.symbol}&background=1f2937&color=60a5fa&size=32`;
                            }}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{selectedTokenForChart.name || selectedTokenForChart.symbol}</div>
                          <div className="text-xs text-gray-500">{selectedTokenForChart.symbol}</div>
                        </div>
                      </div>
                      {(selectedTokenForChart.contractAddress || selectedTokenForChart.symbol === 'ETH') && (
                        <button
                          onClick={() => {
                            const addressToCopy = selectedTokenForChart.contractAddress || '0x4200000000000000000000000000000000000006';
                            copyTokenAddress(addressToCopy);
                          }}
                          className={`p-2 rounded-lg transition-colors ${copiedAddress ? 'text-green-400' : 'text-gray-500 hover:text-white hover:bg-gray-800/50'}`}
                        >
                          <FiCopy className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Price & Change */}
                    <div className="px-4 py-4">
                      <div className="text-3xl font-semibold text-white mb-1">
                        {formatTokenPrice(selectedTokenForChart.price || 0)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${(selectedTokenForChart.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(selectedTokenForChart.priceChange || 0) >= 0 ? '+' : ''}{(selectedTokenForChart.priceChange || 0).toFixed(2)}%
                        </span>
                        <span className="text-xs text-gray-500">24h</span>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="px-4 pb-4">
                      <div className="h-40 bg-gray-800/30 rounded-xl overflow-hidden relative">
                        {isLoadingChart ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                          </div>
                        ) : chartData.length > 0 ? (
                          <div className="w-full h-full p-2">
                            <Sparklines data={getSparklineData()} width={340} height={130} margin={5}>
                              <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={(selectedTokenForChart.priceChange || 0) >= 0 ? "#22c55e" : "#ef4444"} stopOpacity="0.3" />
                                  <stop offset="100%" stopColor={(selectedTokenForChart.priceChange || 0) >= 0 ? "#22c55e" : "#ef4444"} stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <SparklinesLine
                                color={(selectedTokenForChart.priceChange || 0) >= 0 ? "#22c55e" : "#ef4444"}
                                style={{ strokeWidth: 2, fill: "none" }}
                              />
                              <SparklinesCurve
                                color={(selectedTokenForChart.priceChange || 0) >= 0 ? "#22c55e" : "#ef4444"}
                                style={{ fill: "url(#chartGradient)" }}
                              />
                            </Sparklines>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                            No chart data
                          </div>
                        )}
                      </div>
                      
                      {/* Timeframe Selector */}
                      <div className="flex justify-center gap-1 mt-3">
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
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              selectedTimeframe === period
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'text-gray-500 hover:text-gray-400'
                            }`}
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Your Holdings */}
                    <div className="px-4 pb-4">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your Holdings</div>
                      <div className="bg-gray-800/30 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-gray-400 text-sm">Balance</span>
                          <span className="text-white text-sm font-medium">
                            {parseFloat(selectedTokenForChart.balance || '0').toFixed(6)} {selectedTokenForChart.symbol}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm">Value</span>
                          <span className="text-white text-sm font-medium">
                            {formatUSDValue(parseFloat(selectedTokenForChart.usdValue || '0'))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="px-4 pb-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setSwapPayToken({
                              symbol: selectedTokenForChart.symbol,
                              address: selectedTokenForChart.contractAddress || '0x4200000000000000000000000000000000000006',
                              logo: selectedTokenForChart.logo,
                              priceUsd: selectedTokenForChart.price
                            });
                            setCurrentSection('swap');
                            setCurrentView('main');
                          }}
                          className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors"
                        >
                          Swap
                        </button>
                        <button 
                          onClick={() => {
                            setSendToken({
                              symbol: selectedTokenForChart.symbol,
                              name: selectedTokenForChart.name || selectedTokenForChart.symbol,
                              address: selectedTokenForChart.contractAddress || '0x4200000000000000000000000000000000000006',
                              logo: selectedTokenForChart.logo
                            });
                            setCurrentSection('send');
                            setCurrentView('main');
                          }}
                          className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
                        >
                          Send
                        </button>
                      </div>
                    </div>

                    {/* Token Info */}
                    {selectedTokenForChart.contractAddress && (
                      <div className="px-4 pb-4">
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Contract</div>
                        <div className="bg-gray-800/30 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-mono truncate mr-2">
                              {selectedTokenForChart.contractAddress.slice(0, 8)}...{selectedTokenForChart.contractAddress.slice(-6)}
                            </span>
                            <button
                              onClick={() => window.open(`/explorer/address/${selectedTokenForChart.contractAddress}`, '_blank')}
                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Bottom Navigation */}
                  <div className="border-t border-gray-800/50 px-2 py-2 flex items-center justify-around flex-shrink-0 bg-[#0a0f1a]">
                    <button
                      onClick={() => {
                        setActiveBottomTab('home');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className="flex flex-col items-center py-1.5 px-4 rounded-lg text-gray-500 hover:text-gray-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="text-[10px] mt-0.5">Home</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('swap');
                        setCurrentSection('swap');
                      }}
                      className="flex flex-col items-center py-1.5 px-4 rounded-lg text-gray-500 hover:text-gray-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      <span className="text-[10px] mt-0.5">Swap</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('history');
                        setActiveTab('history');
                        setCurrentSection('main');
                        setCurrentView('main');
                      }}
                      className="flex flex-col items-center py-1.5 px-4 rounded-lg text-gray-500 hover:text-gray-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[10px] mt-0.5">Activity</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveBottomTab('send');
                        setCurrentSection('main');
                      }}
                      className="flex flex-col items-center py-1.5 px-4 rounded-lg text-gray-500 hover:text-gray-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span className="text-[10px] mt-0.5">Send</span>
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
                      onClick={() => window.location.href = '/discover'}
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
      {showCopyNotification && (
        <motion.div
          key="copy-notification"
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

      {/* Swap Success Banner */}
      {swapSuccess && (
        <motion.div
          key="swap-success-banner"
          initial={{ opacity: 0, x: -100, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -100, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`fixed bottom-6 left-6 z-[99999999] min-w-[320px] max-w-md w-auto ${
            swapSuccess.type === 'buy'
              ? 'bg-green-500/20 border-green-500/40 text-green-400'
              : 'bg-red-500/20 border-red-500/40 text-red-400'
          } border backdrop-blur-xl rounded-lg px-4 py-2.5 shadow-2xl`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 ${
              swapSuccess.type === 'buy' ? 'text-green-400' : 'text-red-400'
            }`}>
              {swapSuccess.type === 'buy' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium leading-tight">
                  {swapSuccess.type === 'buy' ? 'Buy' : 'Sell'} Successful!
                </p>
                <p className="text-xs text-gray-300 leading-tight mt-0.5">
                  Received <span className="font-semibold">{swapSuccess.received} {swapSuccess.tokenSymbol}</span>
                </p>
              </div>
              <button
                onClick={() => setSwapSuccess(null)}
                className={`text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors ${
                  swapSuccess.type === 'buy' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

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

