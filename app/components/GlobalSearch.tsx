"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { FaWallet, FaExchangeAlt, FaCube, FaCoins, FaNewspaper, FaChartLine, FaCalendar } from "react-icons/fa";
import { SiEthereum } from "react-icons/si";
import debounce from "lodash/debounce";

// Search result types
interface TokenSearchResult {
  type: "token";
  address: string;
  poolAddress?: string;
  name: string;
  symbol: string;
  marketCap?: number;
  volume24h?: number;
  priceUsd?: string;
  liquidity?: { usd: number };
  source: string;
  imageUrl?: string;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h1: number;
    h24: number;
  };
  txns?: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  // Additional metadata from DexScreener
  fdv?: number;
  pairCreatedAt?: number;
  dexId?: string;
  url?: string;
  metrics?: {
    priceChange24h: number;
    priceChange1h: number;
    priceChange6h: number;
    priceChange5m: number;
    totalTxns24h: number;
    totalTxns1h: number;
    totalTxns6h: number;
    buyRatio24h: number;
    buyRatio1h: number;
    volumeChange24h: number;
    liquidityChange24h: number;
  };
}

interface WalletSearchResult {
  type: "wallet";
  address: string;
  balance?: string;
  transactionCount?: number;
  lastActivity?: string;
}

interface TransactionSearchResult {
  type: "transaction";
  hash: string;
  blockNumber?: number;
  from: string;
  to: string;
  value?: string;
  status?: number;
  timestamp?: number;
}

interface BlockSearchResult {
  type: "block";
  number: number;
  hash: string;
  timestamp?: number;
  transactions?: number;
  gasUsed?: string;
  gasLimit?: string;
}

interface NewsSearchResult {
  type: "news";
  id: string;
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
  thumbnailUrl?: string;
}

interface IndexSearchResult {
  type: "index";
  indexName: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  weight: number;
  marketCap?: number;
  priceUsd?: string;
}

interface CalendarEventSearchResult {
  type: "calendar";
  id: string;
  projectId: string;
  projectName: string;
  projectTicker: string;
  title: string;
  description: string;
  date: string;
  time: string;
  eventType: string;
  status: string;
  votes: number;
}

interface SearchResults {
  tokens: TokenSearchResult[];
  wallets: WalletSearchResult[];
  transactions: TransactionSearchResult[];
  blocks: BlockSearchResult[];
  news: NewsSearchResult[];
  calendar: CalendarEventSearchResult[];
}

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
  variant?: "header" | "homepage";
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ 
  placeholder = "Search for tokens, symbols, addresses, transactions, blocks...",
  className = "",
  variant = "header"
}) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    tokens: [],
    wallets: [],
    transactions: [],
    blocks: [],
    news: [],
    calendar: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState("");
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [isMouseInResults, setIsMouseInResults] = useState(false);

  // Debounced search function
  const debouncedSearch = useRef(
    debounce(async (searchQuery: string) => {
      if (!searchQuery || searchQuery.length < 2) {
        setResults({ tokens: [], wallets: [], transactions: [], blocks: [], news: [], calendar: [] });
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || { tokens: [], wallets: [], transactions: [], blocks: [], news: [], calendar: [] });
        } else {
          setError("Search failed");
        }
      } catch (error) {
        console.error("Search error:", error);
        setError("Search failed");
      } finally {
        setIsLoading(false);
      }
    }, 300)
  ).current;

  // Handle search query changes
  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showResults) return;

      const totalResults = results.tokens.length + results.wallets.length + results.transactions.length + results.blocks.length;
      
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(prev => prev < totalResults - 1 ? prev + 1 : prev);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0) {
            handleResultClick(getResultByIndex(selectedIndex));
          }
          break;
        case "Escape":
          setShowResults(false);
          setSelectedIndex(-1);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showResults, results, selectedIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle mouse enter/leave for results container
  useEffect(() => {
    const handleMouseEnter = () => {
      setIsMouseInResults(true);
    };

    const handleMouseLeave = () => {
      setIsMouseInResults(false);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const resultsContainer = resultsRef.current;
      if (resultsContainer) {
        const rect = resultsContainer.getBoundingClientRect();
        const isInResults = e.clientX >= rect.left && e.clientX <= rect.right && 
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
        setIsMouseInResults(isInResults);
      }
    };

    const resultsContainer = resultsRef.current;
    if (resultsContainer && showResults) {
      resultsContainer.addEventListener('mouseenter', handleMouseEnter);
      resultsContainer.addEventListener('mouseleave', handleMouseLeave);
      document.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      if (resultsContainer) {
        resultsContainer.removeEventListener('mouseenter', handleMouseEnter);
        resultsContainer.removeEventListener('mouseleave', handleMouseLeave);
      }
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [showResults]);

  // Prevent page scroll when mouse is in results area
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isMouseInResults && showResults) {
        const resultsContainer = resultsRef.current;
        if (resultsContainer) {
          const scrollTop = resultsContainer.scrollTop;
          const scrollHeight = resultsContainer.scrollHeight;
          const clientHeight = resultsContainer.clientHeight;
          
          // Check if we can scroll in the results container
          const canScrollUp = scrollTop > 0;
          const canScrollDown = scrollTop < scrollHeight - clientHeight;
          
          // Prevent page scroll if we can scroll within the results container
          if ((e.deltaY > 0 && canScrollDown) || (e.deltaY < 0 && canScrollUp)) {
            e.preventDefault();
            
            // Manually scroll the results container
            const newScrollTop = scrollTop + e.deltaY;
            resultsContainer.scrollTop = Math.max(0, Math.min(newScrollTop, scrollHeight - clientHeight));
          }
        }
      }
    };

    if (isMouseInResults && showResults) {
      document.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isMouseInResults, showResults]);



  // Get result by index across all result types
  const getResultByIndex = (index: number) => {
    let currentIndex = 0;
    
    // Check tokens
    if (index < results.tokens.length) {
      return { type: "token", result: results.tokens[index] };
    }
    currentIndex += results.tokens.length;
    
    // Check wallets
    if (index < currentIndex + results.wallets.length) {
      return { type: "wallet", result: results.wallets[index - currentIndex] };
    }
    currentIndex += results.wallets.length;
    
    // Check transactions
    if (index < currentIndex + results.transactions.length) {
      return { type: "transaction", result: results.transactions[index - currentIndex] };
    }
    currentIndex += results.transactions.length;
    
    // Check blocks
    if (index < currentIndex + results.blocks.length) {
      return { type: "block", result: results.blocks[index - currentIndex] };
    }
    currentIndex += results.blocks.length;
    
    // Check news
    if (index < currentIndex + results.news.length) {
      return { type: "news", result: results.news[index - currentIndex] };
    }
    currentIndex += results.news.length;
    
    
    // Check calendar
    if (index < currentIndex + results.calendar.length) {
      return { type: "calendar", result: results.calendar[index - currentIndex] };
    }
    
    return null;
  };

  // Handle result click
  const handleResultClick = (resultData: any) => {
    if (!resultData) return;
    
    const { type, result } = resultData;
    
    console.log('Search result clicked:', { type, result });
    
    switch (type) {
      case "token":
        if (result.poolAddress) {
          console.log('Navigating to token with pool:', result.poolAddress);
          router.push(`/explore/${result.poolAddress}/chart`);
        } else {
          console.log('Navigating to token:', result.address);
          router.push(`/explore/${result.address}/chart`);
        }
        break;
      case "wallet":
        console.log('Navigating to wallet:', result.address);
        router.push(`/explorer/address/${result.address}`);
        break;
      case "transaction":
        console.log('Navigating to transaction:', result.hash);
        router.push(`/explorer/tx/${result.hash}`);
        break;
      case "block":
        console.log('Navigating to block:', result.number);
        router.push(`/explorer/latest/block/${result.number}`);
        break;
      case "news":
        console.log('Navigating to news:', result.slug);
        router.push(`/insights/${result.slug}`);
        break;
      case "index":
        console.log('Navigating to index token:', result.tokenAddress);
        router.push(`/explore/${result.tokenAddress}/chart`);
        break;
      case "calendar":
        console.log('Navigating to calendar');
        router.push(`/calendar`);
        break;
    }
    
    setShowResults(false);
    setQuery("");
    setSelectedIndex(-1);
  };

  // Get total results count
  const totalResults = results.tokens.length + results.wallets.length + results.transactions.length + results.blocks.length + results.news.length + results.calendar.length;

  // Format number for display
  const formatNumber = (num: number | undefined) => {
    if (!num) return "0";
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Get result icon
  const getResultIcon = (type: string) => {
    switch (type) {
      case "token":
        return <FaCoins className="w-4 h-4 text-yellow-400" />;
      case "wallet":
        return <FaWallet className="w-4 h-4 text-blue-400" />;
      case "transaction":
        return <FaExchangeAlt className="w-4 h-4 text-green-400" />;
      case "block":
        return <FaCube className="w-4 h-4 text-purple-400" />;
      case "news":
        return <FaNewspaper className="w-4 h-4 text-orange-400" />;
      case "index":
        return <FaChartLine className="w-4 h-4 text-indigo-400" />;
      case "calendar":
        return <FaCalendar className="w-4 h-4 text-pink-400" />;
      default:
        return <SiEthereum className="w-4 h-4 text-gray-400" />;
    }
  };



  // Highlight search terms in text
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-500/30 text-yellow-200 font-medium">
          {part}
        </span>
      ) : part
    );
  };

  return (
    <div ref={searchRef} className={`relative ${className} ${variant === "homepage" ? "z-[9999999]" : ""}`}>
      {/* Search Input */}
      <div className={`relative group ${variant === "header" ? "mr-2" : ""}`}>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (query.length >= 2) {
              setShowResults(true);
            }
          }}
          className={`w-full pl-12 pr-12 py-2 text-sm text-gray-100 bg-gray-950 border border-gray-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 placeholder-gray-400 shadow-lg group-hover:border-blue-400 ${
            variant === "header" ? "max-w-[580px]" : ""
          }`}
        />
        
        {/* Search Icon */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors duration-300" />
        </div>
        
        {/* Status Indicator */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
          ) : query.length >= 2 ? (
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          ) : (
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          )}
        </div>
        
        {/* Clear Button */}
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setShowResults(false);
              setSelectedIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {showResults && (query.length >= 2 || totalResults > 0) && (
          <motion.div
                         className={`absolute top-full left-0 right-0 bg-gray-950 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col ${
              variant === "homepage" ? "w-full max-h-[300px]" : "w-full max-w-xl max-h-[60vh]"
            }`}
            style={{
              top: variant === "header" ? "calc(100% + 8px)" : "calc(100% + 4px)",
              zIndex: variant === "homepage" ? 9999999 : 9999999,
              maxHeight: variant === "homepage" ? "300px" : "auto",
              width: variant === "header" ? "min(580px, calc(100vw - 32px))" : "100%",
              position: variant === "homepage" ? "absolute" : "absolute",
              right: variant === "header" ? "16px" : "auto"
            }}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading State */}
            {isLoading && (
              <div className="p-4 text-center text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mx-auto mb-2"></div>
                Searching...
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-4 text-center text-red-400">
                {error}
              </div>
            )}

            {/* No Results */}
            {!isLoading && !error && totalResults === 0 && query.length >= 2 && (
              <div className="p-4 text-center text-gray-400">
                No results found for "{query}"
              </div>
            )}

            {/* Results Summary */}
            {!isLoading && !error && totalResults > 0 && (
              <div className="px-4 py-2 bg-gray-950 border-b border-gray-700/50 sticky top-0 z-20 flex-shrink-0">
                <div className="text-xs text-gray-400">
                  Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
                </div>
              </div>
            )}

            {/* Results Container */}
            <div 
              ref={resultsRef}
              className={`overflow-y-auto scrollbar-hide transition-all duration-200 ${
                variant === "homepage" ? "h-[250px] pr-2" : "max-h-[400px] pr-6"
              } ${isMouseInResults ? 'ring-1 ring-blue-400/30' : ''}`}
              style={{
                scrollBehavior: 'smooth',
                overscrollBehavior: 'contain'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Results */}
              {!isLoading && !error && totalResults > 0 && (
                <div className="pt-0 pb-2">
                 {/* Tokens */}
                 {results.tokens.length > 0 && (
                   <div className="mb-0">
                     <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 bg-gray-950 z-10">
                       Tokens ({results.tokens.length})
                     </div>
                     <div>
                       {results.tokens.map((token, index) => {
                         const globalIndex = index;
                         const isSelected = selectedIndex === globalIndex;
                         
                         return (
                           <motion.div
                             key={`${token.address}-${token.poolAddress || 'nopool'}`}
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: index * 0.05 }}
                             className={`p-3 hover:bg-blue-500/20 cursor-pointer border-b border-gray-700/50 last:border-b-0 transition-all duration-200 ${
                               isSelected ? "bg-blue-500/20" : ""
                             }`}
                             onClick={() => handleResultClick({ type: "token", result: token })}
                           >
                             <div className="flex items-start space-x-3">
                               {/* Token Icon */}
                               <div className="relative flex-shrink-0">
                                 {token.imageUrl ? (
                                   <img
                                     src={token.imageUrl}
                                     alt={token.name}
                                     className="w-10 h-10 rounded-full border border-gray-600"
                                     onError={(e) => {
                                       e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.symbol}&background=1f2937&color=60a5fa&size=40`;
                                     }}
                                   />
                                 ) : (
                                   <img
                                     src={`https://ui-avatars.com/api/?name=${token.symbol}&background=1f2937&color=60a5fa&size=40`}
                                     alt={token.name}
                                     className="w-10 h-10 rounded-full border border-gray-600"
                                   />
                                 )}
                                 <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800"></div>
                               </div>
                               
                               {/* Token Info - Compact Layout */}
                               <div className="flex-1 min-w-0">
                                 {/* First Row: Symbol, Name, and Metrics */}
                                 <div className="flex items-center justify-between mb-2">
                                   <div className="flex items-center space-x-2 min-w-0">
                                     <span className="font-bold text-gray-200 truncate">{token.symbol}</span>
                                     <span className="text-sm text-gray-400 truncate max-w-[120px]">
                                       ({token.name.length > 20 ? token.name.substring(0, 20) + '...' : token.name})
                                     </span>
                                   </div>
                                   <div className="flex items-center space-x-2">
                                     {token.priceChange?.h24 && (
                                       <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                                         parseFloat(token.priceChange.h24.toString()) > 0 
                                           ? 'bg-green-500/20 text-green-400' 
                                           : 'bg-red-500/20 text-red-400'
                                       }`}>
                                         {parseFloat(token.priceChange.h24.toString()) > 0 ? '+' : ''}{parseFloat(token.priceChange.h24.toString()).toFixed(2)}%
                                       </span>
                                     )}
                                     {token.dexId && (
                                       <span
                                         className={`text-xs px-2 py-1 rounded-md font-medium border uppercase ${
                                                                                                                               token.dexId?.toLowerCase() === 'aerodrome'
                                            ? 'bg-blue-500/40 text-white border-blue-400/50'
                                            : (token.dexId?.toLowerCase() === 'uniswap' || token.dexId?.toLowerCase() === 'uniswap_v3')
                                              ? 'bg-pink-500/40 text-white border-pink-400/50'
                                               : 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                                         }`}
                                       >
                                         {token.dexId}
                                       </span>
                                     )}
                                     {token.metrics && token.metrics.buyRatio24h > 0 && (
                                       <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                                         token.metrics.buyRatio24h > 0.6 ? 'bg-green-500/20 text-green-400' : 
                                         token.metrics.buyRatio24h > 0.4 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                                       }`}>
                                         Buy: {(token.metrics.buyRatio24h * 100).toFixed(0)}%
                                       </span>
                                     )}
                                                                           {token.metrics && token.metrics.volumeChange24h !== 0 && (
                                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                                          token.metrics.volumeChange24h > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                                        }`}>
                                          Vol: {token.metrics.volumeChange24h > 0 ? '+' : ''}{token.metrics.volumeChange24h.toFixed(1)}%
                                        </span>
                                      )}
                                   </div>
                                 </div>
                                 
                                 {/* Second Row: Market Cap, Volume, Transactions */}
                                 <div className="flex items-center justify-between">
                                   <div className="flex items-center space-x-4 text-xs text-gray-400">
                                     <span>MC: ${formatNumber(token.marketCap)}</span>
                                     {token.volume?.h24 && (
                                       <span>Vol: ${formatNumber(token.volume.h24)}</span>
                                     )}
                                     {token.liquidity?.usd !== undefined && (
                                       <span>Liq: ${formatNumber(token.liquidity.usd)}</span>
                                     )}
                                     {token.txns?.h24 && (
                                       <span>{token.txns.h24.buys + token.txns.h24.sells} txns</span>
                                     )}
                                   </div>
                                 </div>
                               </div>
                             </div>
                           </motion.div>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {/* Separator */}
                 {results.tokens.length > 0 && (results.wallets.length > 0 || results.transactions.length > 0 || results.blocks.length > 0 || results.news.length > 0 || results.calendar.length > 0) && (
                   <div className="py-0">
                     <div className="border-t border-gray-700/50"></div>
                   </div>
                 )}

                 {/* Wallets */}
                 {results.wallets.length > 0 && (
                   <div className="mb-0">
                     <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 bg-gray-950 z-10">
                       Wallets ({results.wallets.length})
                     </div>
                     <div>
                       {results.wallets.map((wallet, index) => {
                         const globalIndex = results.tokens.length + index;
                         const isSelected = selectedIndex === globalIndex;
                         
                         return (
                           <motion.div
                             key={wallet.address}
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: index * 0.05 }}
                             className={`p-3 hover:bg-blue-500/20 cursor-pointer border-b border-gray-700/50 last:border-b-0 transition-all duration-200 ${
                               isSelected ? "bg-blue-500/20" : ""
                             }`}
                             onClick={() => handleResultClick({ type: "wallet", result: wallet })}
                           >
                             <div className="flex items-center space-x-3">
                               <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                 {getResultIcon("wallet")}
                               </div>
                               <div className="flex-1 min-w-0">
                                 <div className="font-mono text-sm text-gray-200 truncate">
                                   {wallet.address}
                                 </div>
                                 <div className="text-xs text-gray-400 mt-1">
                                   {wallet.balance ? `${parseFloat(wallet.balance).toFixed(4)} ETH` : "0 ETH"} • {wallet.transactionCount || 0} txs
                                 </div>
                               </div>
                             </div>
                           </motion.div>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {/* Separator */}
                 {results.wallets.length > 0 && (results.transactions.length > 0 || results.blocks.length > 0 || results.news.length > 0 || results.calendar.length > 0) && (
                   <div className="py-0">
                     <div className="border-t border-gray-700/50"></div>
                   </div>
                 )}

                 {/* Transactions */}
                 {results.transactions.length > 0 && (
                   <div className="mb-0">
                     <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 bg-gray-950 z-10">
                       Transactions ({results.transactions.length})
                     </div>
                     <div>
                       {results.transactions.map((tx, index) => {
                         const globalIndex = results.tokens.length + results.wallets.length + index;
                         const isSelected = selectedIndex === globalIndex;
                         
                         return (
                           <motion.div
                             key={tx.hash}
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: index * 0.05 }}
                             className={`p-3 hover:bg-blue-500/20 cursor-pointer border-b border-gray-700/50 last:border-b-0 transition-all duration-200 ${
                               isSelected ? "bg-blue-500/20" : ""
                             }`}
                             onClick={() => handleResultClick({ type: "transaction", result: tx })}
                           >
                             <div className="flex items-center space-x-3">
                               <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                 {getResultIcon("transaction")}
                               </div>
                               <div className="flex-1 min-w-0">
                                 <div className="font-mono text-sm text-gray-200 truncate">
                                   {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                                 </div>
                                 <div className="text-xs text-gray-400 mt-1">
                                   Block {tx.blockNumber} • {tx.status === 1 ? "Success" : "Failed"}
                                 </div>
                               </div>
                             </div>
                           </motion.div>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {/* Separator */}
                 {results.transactions.length > 0 && (results.blocks.length > 0 || results.news.length > 0 || results.calendar.length > 0) && (
                   <div className="py-0">
                     <div className="border-t border-gray-700/50"></div>
                   </div>
                 )}

                 {/* Blocks */}
                 {results.blocks.length > 0 && (
                   <div className="mb-0">
                     <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 bg-gray-950 z-10">
                       Blocks ({results.blocks.length})
                     </div>
                     <div>
                       {results.blocks.map((block, index) => {
                         const globalIndex = results.tokens.length + results.wallets.length + results.transactions.length + index;
                         const isSelected = selectedIndex === globalIndex;
                         
                         return (
                           <motion.div
                             key={block.number}
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: index * 0.05 }}
                             className={`p-3 hover:bg-blue-500/20 cursor-pointer border-b border-gray-700/50 last:border-b-0 transition-all duration-200 ${
                               isSelected ? "bg-blue-500/20" : ""
                             }`}
                             onClick={() => handleResultClick({ type: "block", result: block })}
                           >
                             <div className="flex items-center space-x-3">
                               <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                 {getResultIcon("block")}
                               </div>
                               <div className="flex-1 min-w-0">
                                 <div className="font-semibold text-gray-200">
                                   Block #{block.number}
                                 </div>
                                 <div className="text-xs text-gray-400 mt-1">
                                   {block.transactions || 0} transactions • {block.timestamp ? new Date(block.timestamp).toLocaleString() : "Unknown time"}
                                 </div>
                               </div>
                             </div>
                           </motion.div>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {/* Separator */}
                 {results.blocks.length > 0 && (results.news.length > 0 || results.calendar.length > 0) && (
                   <div className="py-0">
                     <div className="border-t border-gray-700/50"></div>
                   </div>
                 )}

                 {/* News Articles */}
                 {results.news.length > 0 && (
                   <div className="mb-0">
                                         <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 bg-gray-950 z-10">
                       News ({results.news.length})
                     </div>
                     <div>
                      {results.news.map((article, index) => {
                        const globalIndex = results.tokens.length + results.wallets.length + results.transactions.length + results.blocks.length + index;
                        const isSelected = selectedIndex === globalIndex;
                        
                        return (
                          <motion.div
                            key={article.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-3 hover:bg-blue-500/20 cursor-pointer border-b border-gray-700/50 last:border-b-0 transition-all duration-200 ${
                              isSelected ? "bg-blue-500/20" : ""
                            }`}
                            onClick={() => handleResultClick({ type: "news", result: article })}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                                {getResultIcon("news")}
                              </div>
                              <div className="flex-1 min-w-0">
                                                                 <div className="font-semibold text-gray-200 truncate max-w-[280px]">
                                   {highlightSearchTerm(article.title.length > 60 ? article.title.substring(0, 60) + '...' : article.title, query)}
                                 </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {article.author} • {article.source} • {new Date(article.publishedAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                 {/* Separator */}
                 {results.news.length > 0 && results.calendar.length > 0 && (
                   <div className="py-0">
                     <div className="border-t border-gray-700/50"></div>
                   </div>
                 )}


                 {/* Calendar Events */}
                 {results.calendar.length > 0 && (
                   <div className="mb-0">
                                          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 bg-gray-950 z-10">
                       Events ({results.calendar.length})
                     </div>
                     <div>
                      {results.calendar.map((event, index) => {
                        const globalIndex = results.tokens.length + results.wallets.length + results.transactions.length + results.blocks.length + results.news.length + index;
                        const isSelected = selectedIndex === globalIndex;
                        
                        return (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-3 hover:bg-blue-500/20 cursor-pointer border-b border-gray-700/50 last:border-b-0 transition-all duration-200 ${
                              isSelected ? "bg-blue-500/20" : ""
                            }`}
                            onClick={() => handleResultClick({ type: "calendar", result: event })}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                                {getResultIcon("calendar")}
                              </div>
                              <div className="flex-1 min-w-0">
                                                                 <div className="font-semibold text-gray-200 truncate max-w-[280px]">
                                   {event.title.length > 50 ? event.title.substring(0, 50) + '...' : event.title}
                                 </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {event.projectName} ({event.projectTicker}) • {event.date} • {event.votes} votes
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                                 )}
              </div>
            )}
            
            {/* Scroll Indicator */}
            {!isLoading && !error && totalResults > 0 && (
              <div className="px-4 py-2 bg-gradient-to-t from-gray-950 to-transparent border-t border-gray-700/50 flex-shrink-0">
                <div className="text-xs text-gray-400 text-center">
                  {isMouseInResults ? "Scroll to see more results" : "Hover to scroll results"}
                </div>
              </div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlobalSearch;
