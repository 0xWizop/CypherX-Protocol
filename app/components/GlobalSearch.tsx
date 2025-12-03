"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
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

interface SearchResults {
  tokens: TokenSearchResult[];
  wallets: WalletSearchResult[];
  transactions: TransactionSearchResult[];
  blocks: BlockSearchResult[];
  news: NewsSearchResult[];
}

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
  variant?: "header" | "homepage";
  fullScreenMobile?: boolean;
  onSearchStateChange?: (hasActiveSearch: boolean) => void;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ 
  placeholder = "Search for tokens, symbols, addresses, transactions, blocks...",
  className = "",
  variant = "header",
  fullScreenMobile = false,
  onSearchStateChange
}) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    tokens: [],
    wallets: [],
    transactions: [],
    blocks: [],
    news: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState("");
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMouseInResults, setIsMouseInResults] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [homepagePosition, setHomepagePosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Notify parent when search state changes
  useEffect(() => {
    if (onSearchStateChange) {
      const hasActiveSearch = showResults && (query.length >= 2 || isLoading);
      onSearchStateChange(hasActiveSearch);
    }
  }, [showResults, query, isLoading, onSearchStateChange]);

  // Debounced search function
  const debouncedSearch = useRef(
    debounce(async (searchQuery: string) => {
      if (!searchQuery || searchQuery.length < 2) {
        setResults({ tokens: [], wallets: [], transactions: [], blocks: [], news: [] });
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'Accept': 'application/json',
          },
          // Add timeout for better error handling
          signal: AbortSignal.timeout(20000), // 20 second timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setResults(data.results || { tokens: [], wallets: [], transactions: [], blocks: [], news: [] });
          } else {
            setError(data.error || "Search failed");
            console.error("[GlobalSearch] Search API returned error:", data.error);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || `Search failed (${response.status})`;
          setError(errorMsg);
          console.error("[GlobalSearch] Search API error:", response.status, errorMsg);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[GlobalSearch] Search error:", errorMessage);
        
        // More specific error messages
        if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
          setError("Search timeout - please try again");
        } else if (errorMessage.includes('fetch')) {
          setError("Network error - check your connection");
        } else {
          setError("Search failed - please try again");
        }
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

      const totalResults = results.tokens.length;
      
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

  // Update dropdown position when it opens
  useEffect(() => {
    if (showResults && variant === "header" && query.length >= 2) {
      // Set a default position immediately so dropdown shows
      const setDefaultPosition = () => {
        const header = document.querySelector('header');
        const headerBottom = header ? header.getBoundingClientRect().bottom : 80;
        const minMargin = 16;
        const width = window.innerWidth - minMargin * 2;
        const left = minMargin;
        
        setDropdownPosition({
          top: headerBottom + 8,
          left: left,
          width: width
        });
      };
      
      // Set default position immediately
      setDefaultPosition();
      
      const updatePosition = () => {
        // Get the actual input element for precise alignment
        const inputElement = inputRef.current;
        
        // Find the wallet display element
        const walletDisplay = document.querySelector('[data-wallet-display]') as HTMLElement;
        
        if (!inputElement) {
          // If input not found, try to use search container as fallback
          const searchContainer = searchRef.current || document.querySelector('[data-search-container]') as HTMLElement;
          if (!searchContainer) {
            return;
          }
          const searchRect = searchContainer.getBoundingClientRect();
          const header = document.querySelector('header');
          const headerBottom = header ? header.getBoundingClientRect().bottom : searchRect.bottom;
          
          let width: number;
          if (walletDisplay) {
            const walletRect = walletDisplay.getBoundingClientRect();
            width = walletRect.right - searchRect.left;
        } else {
            width = window.innerWidth - searchRect.left - 16;
          }
          
          setDropdownPosition({
            top: headerBottom + 8,
            left: searchRect.left,
            width: Math.max(400, Math.min(width, window.innerWidth - searchRect.left - 8))
          });
          return;
        }
        
        const inputRect = inputElement.getBoundingClientRect();
        // Find the header element to get its bottom position (after separator)
        const header = document.querySelector('header');
        const headerBottom = header ? header.getBoundingClientRect().bottom : inputRect.bottom;
        
        // Calculate left position - align exactly with search input's left edge
        const left = inputRect.left;
        
        // Calculate width - from search input left edge to wallet display right edge
        let width: number;
        if (walletDisplay) {
          const walletRect = walletDisplay.getBoundingClientRect();
          // Width spans exactly from input left to wallet right (no padding)
          width = walletRect.right - inputRect.left;
        } else {
          // Fallback: use available width from input to viewport edge
          const rightMargin = 16;
          width = window.innerWidth - left - rightMargin;
        }
        
        // Ensure minimum width
        const minWidth = 500;
        width = Math.max(minWidth, width);
        
        // Ensure it doesn't overflow viewport (with small margin for safety)
        const maxWidth = window.innerWidth - left - 8; // 8px margin on right for safety
        width = Math.min(width, maxWidth);
        
        setDropdownPosition({
          top: headerBottom + 8, // 8px gap below header separator
          left: left,
          width: width
        });
      };
      
      // Calculate accurate position on next frame
      const rafId = requestAnimationFrame(updatePosition);
      
      // Also set up listeners for updates
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else if (!showResults || query.length < 2) {
      // Reset position when dropdown closes or query is too short
      setDropdownPosition(null);
    }
  }, [showResults, variant, query]);

  // Update homepage dropdown position when it opens
  useEffect(() => {
    if (showResults && variant !== "header" && query.length >= 2) {
      // Set default position immediately
      const setDefaultPosition = () => {
        if (searchRef.current) {
          const rect = searchRef.current.getBoundingClientRect();
          setHomepagePosition({
            top: rect.bottom + 12,
            left: rect.left,
            width: rect.width
          });
        } else {
          // Fallback position
          setHomepagePosition({
            top: 100,
            left: 16,
            width: Math.min(600, window.innerWidth - 32)
          });
        }
      };
      
      setDefaultPosition();
      
      const updatePosition = () => {
        if (!searchRef.current) return;
        
        const rect = searchRef.current.getBoundingClientRect();
        setHomepagePosition({
          top: rect.bottom + 12,
          left: rect.left,
          width: rect.width
        });
      };
      
      const rafId = requestAnimationFrame(updatePosition);
      
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else if (!showResults || query.length < 2) {
      setHomepagePosition(null);
    }
  }, [showResults, variant, query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is inside search container (input) or dropdown
      const isInSearchContainer = searchRef.current?.contains(target);
      const isInDropdown = dropdownRef.current?.contains(target);
      const isInInput = inputRef.current?.contains(target);
      
      // Only close if clicking completely outside the search component
      if (!isInSearchContainer && !isInDropdown && !isInInput) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    if (showResults) {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showResults]);

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
    // Only tokens now
    if (index < results.tokens.length) {
      return { type: "token", result: results.tokens[index] };
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
          router.push(`/discover/${result.poolAddress}/chart`);
        } else {
          console.log('Navigating to token:', result.address);
          router.push(`/discover/${result.address}/chart`);
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
    }
    
    setShowResults(false);
    setQuery("");
    setSelectedIndex(-1);
  };

  // Get total results count (only tokens)
  const totalResults = results.tokens.length;

  // Format number for display
  const formatNumber = (num: number | undefined) => {
    if (!num) return "0";
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Render search results
  const renderResults = () => (
    <>
      {/* Loading State */}
      {isLoading && (
        <div className={`${fullScreenMobile ? 'flex-1 flex items-center justify-center' : 'p-4 text-center'} text-gray-400`}>
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-blue-400 mb-3"></div>
            <p className="text-sm">Searching...</p>
          </div>
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
        <div className={`${fullScreenMobile ? 'w-full py-3' : 'px-4 py-2'} bg-gray-950 border-b border-gray-800/30 sticky top-0 z-20 flex-shrink-0`}>
          <div className={`${fullScreenMobile ? 'text-[11px] px-4' : 'text-xs'} text-gray-400`}>
            Found {totalResults} token{totalResults !== 1 ? 's' : ''} for "{query}"
          </div>
        </div>
      )}

      {/* Results Container - Always show when searching */}
      <div 
        ref={resultsRef}
        className={`${fullScreenMobile ? 'flex-1 min-h-0 overflow-y-auto w-full border-t border-gray-800/30' : 'overflow-y-auto scrollbar-hide'} transition-all duration-200 ${
          fullScreenMobile 
            ? "pb-4 pt-3" 
            : variant === "homepage" 
              ? "h-[250px] pr-2" 
              : "max-h-[400px] pr-6"
        } ${isMouseInResults ? 'ring-1 ring-blue-400/30' : ''}`}
        style={{
          scrollBehavior: 'smooth',
          overscrollBehavior: 'contain'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Results */}
        {!isLoading && !error && totalResults > 0 && (
          <div className="pt-0 pb-2 w-full">
           {/* Tokens */}
           {results.tokens.length > 0 && (
             <div className="mb-0 w-full">
               <div className="w-full">
                 {results.tokens.map((token, index) => {
                   const globalIndex = index;
                   const isSelected = selectedIndex === globalIndex;
                   
                   return (
                     <motion.div
                       key={`${token.address}-${token.poolAddress || 'nopool'}`}
                       initial={{ opacity: 0, x: -20 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: index * 0.05 }}
                      className={`${fullScreenMobile ? 'p-2.5 w-full' : 'p-3 w-full'} hover:bg-gray-800/50 cursor-pointer border-b border-gray-800/30 last:border-b-0 transition-all duration-200 ${
                         isSelected ? "bg-gray-800/50" : "bg-gray-950"
                       }`}
                      style={{ width: '100%' }}
                       onClick={() => handleResultClick({ type: "token", result: token })}
                     >
                       <div className={`flex items-center ${fullScreenMobile ? 'gap-2.5' : 'space-x-3'}`}>
                         {/* Token Icon */}
                         <div className="relative flex-shrink-0">
                           {token.imageUrl ? (
                             <img
                               src={token.imageUrl}
                               alt={token.name}
                               className={`${fullScreenMobile ? 'w-9 h-9' : 'w-10 h-10'} rounded-full border border-gray-600`}
                               onError={(e) => {
                                 e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.symbol}&background=1f2937&color=60a5fa&size=40`;
                               }}
                             />
                           ) : (
                             <img
                               src={`https://ui-avatars.com/api/?name=${token.symbol}&background=1f2937&color=60a5fa&size=40`}
                               alt={token.name}
                               className={`${fullScreenMobile ? 'w-9 h-9' : 'w-10 h-10'} rounded-full border border-gray-600`}
                             />
                           )}
                           {!fullScreenMobile && (
                             <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800"></div>
                           )}
                         </div>
                         
                         {/* Token Info - Mobile Optimized */}
                         <div className="flex-1 min-w-0">
                           {fullScreenMobile ? (
                             /* Mobile Layout - Simplified */
                             <>
                               <div className="flex items-center justify-between mb-1">
                                 <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                   <span className="font-semibold text-sm text-white truncate">{token.symbol}</span>
                                   {token.priceChange?.h24 && (
                                     <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                       parseFloat(token.priceChange.h24.toString()) > 0 
                                         ? 'bg-green-500/20 text-green-400' 
                                         : 'bg-red-500/20 text-red-400'
                                     }`}>
                                       {parseFloat(token.priceChange.h24.toString()) > 0 ? '+' : ''}{parseFloat(token.priceChange.h24.toString()).toFixed(1)}%
                                     </span>
                                   )}
                                 </div>
                               </div>
                               <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                 <span className="truncate">{token.name.length > 25 ? token.name.substring(0, 25) + '...' : token.name}</span>
                                 {token.priceUsd && (
                                   <span className="text-gray-300 flex-shrink-0">${parseFloat(token.priceUsd).toFixed(6)}</span>
                                 )}
                               </div>
                             </>
                           ) : (
                             /* Desktop Layout - Full Details */
                             <>
                               <div className="flex items-center justify-between mb-2">
                                 <div className="flex items-center space-x-2 min-w-0">
                                   <span className="font-bold text-gray-200 truncate">{token.symbol}</span>
                                   <span className="text-sm text-gray-400 truncate max-w-[120px]">
                                     ({token.name.length > 20 ? token.name.substring(0, 20) + '...' : token.name})
                                   </span>
                                 </div>
                                 <div className="flex items-center space-x-2 flex-wrap">
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
                                   {token.metrics && token.metrics.volumeChange24h !== 0 && (
                                     <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                                       token.metrics.volumeChange24h > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                                     }`}>
                                       Vol: {token.metrics.volumeChange24h > 0 ? '+' : ''}{token.metrics.volumeChange24h.toFixed(1)}%
                                     </span>
                                   )}
                                 </div>
                               </div>
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
                             </>
                           )}
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
      </div>
      
    </>
  );

  return (
    <div ref={searchRef} data-search-container className={`${fullScreenMobile ? 'relative flex flex-col flex-1 min-h-0' : 'relative'} ${className} ${variant === "homepage" ? "z-[9999999]" : ""}`}>
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
          onBlur={(e) => {
            // Don't close if in full-screen mobile mode
            if (fullScreenMobile) {
              return;
            }
            // Don't close if clicking into dropdown or search container
            const relatedTarget = e.relatedTarget as Node;
            const isClickingIntoDropdown = dropdownRef.current?.contains(relatedTarget);
            const isClickingIntoSearch = searchRef.current?.contains(relatedTarget);
            
            // Only close if clicking completely outside the search component
            if (!isClickingIntoDropdown && !isClickingIntoSearch && !isMouseInResults) {
              setTimeout(() => {
                // Double check that mouse is not in results before closing
                if (!isMouseInResults && !fullScreenMobile) {
                  setShowResults(false);
                }
              }, 200);
            }
          }}
          onClick={(e) => {
            // Prevent click from bubbling up in mobile menu
            if (fullScreenMobile) {
              e.stopPropagation();
            }
          }}
          className={`w-full pl-10 pr-10 py-1.5 text-sm text-gray-100 ${variant === "header" ? "bg-[#111827]" : "bg-gray-950"} border border-gray-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-gray-500 transition-all duration-300 placeholder-gray-400 shadow-lg group-hover:border-gray-500`}
        />
        
        {/* Search Icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors duration-300" />
        </div>
        
        {/* Status Indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
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
            className="absolute right-7 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {fullScreenMobile ? (
        // Inline results for full-screen mobile mode - positioned directly below search input
        <AnimatePresence>
          {showResults && (query.length >= 2 || isLoading) && (
            <motion.div
              ref={dropdownRef}
              key="search-dropdown"
              className="absolute top-full left-0 right-0 bg-gray-950 flex flex-col w-full"
              style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                right: '0',
                width: '100%',
                maxHeight: 'calc(100vh - 180px)',
                height: 'auto',
                zIndex: 100,
                marginTop: '1rem',
                overflow: 'visible'
              }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setIsMouseInResults(true)}
              onMouseLeave={() => setIsMouseInResults(false)}
            >
              {renderResults()}
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        // Portal results for desktop mode
        typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {showResults && (query.length >= 2 || totalResults > 0) && (
              <motion.div
                ref={dropdownRef}
                key="search-dropdown"
                className="fixed bg-gray-950 border border-gray-800/30 shadow-2xl overflow-hidden flex flex-col max-h-[60vh] rounded-xl"
                style={{
                top: `${variant === "header" 
                  ? (dropdownPosition?.top ?? 80)
                  : (homepagePosition?.top ?? 100)}px`,
                left: `${variant === "header"
                  ? (dropdownPosition?.left ?? 16)
                  : (homepagePosition?.left ?? 16)}px`,
                width: variant === "header"
                    ? (dropdownPosition?.width ? `${dropdownPosition.width}px` : '580px')
                  : (homepagePosition?.width ? `${homepagePosition.width}px` : (searchRef.current ? `${searchRef.current.getBoundingClientRect().width}px` : '100%')),
                maxWidth: variant === "header" 
                    ? (dropdownPosition?.width ? `${dropdownPosition.width}px` : '580px')
                  : 'none',
                zIndex: 99999
              }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setIsMouseInResults(true)}
              onMouseLeave={() => setIsMouseInResults(false)}
            >
              {renderResults()}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
        )
      )}
    </div>
  );
};

export default GlobalSearch;
