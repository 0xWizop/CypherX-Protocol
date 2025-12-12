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

      const totalResults = results.tokens.length + results.wallets.length + results.transactions.length + results.blocks.length + (results.news?.length || 0);
      
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
  const totalResults = results.tokens.length + results.wallets.length + results.transactions.length + results.blocks.length + (results.news?.length || 0);

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
        <div className="px-4 py-2 bg-gray-900/30 border-b border-gray-800/20 sticky top-0 z-20">
           <span className="text-sm text-gray-400">{totalResults} result{totalResults !== 1 ? 's' : ''}</span>
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
             <div className="w-full">
               {results.tokens.map((token, index) => {
                 const globalIndex = index;
                 const isSelected = selectedIndex === globalIndex;
                 return (
                   <div
                     key={`${token.address}-${token.poolAddress || 'nopool'}`}
                     className={`px-4 py-2 hover:bg-gray-800/40 cursor-pointer border-b border-gray-800/20 ${isSelected ? "bg-gray-800/40" : ""}`}
                     onClick={() => handleResultClick({ type: "token", result: token })}
                   >
                     <div className="flex items-center gap-3">
                       {/* Token Icon */}
                       <div className="relative flex-shrink-0">
                         <img
                           src={token.imageUrl || `https://ui-avatars.com/api/?name=${token.symbol}&background=1f2937&color=60a5fa&size=32`}
                           alt={token.name}
                           className="w-8 h-8 rounded-full border border-gray-700"
                           onError={(e) => {
                             e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.symbol}&background=1f2937&color=60a5fa&size=32`;
                           }}
                         />
                       </div>
                       {/* Token Info */}
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="text-[15px] font-medium text-gray-200">{token.symbol}</span>
                           <span className="text-[13px] text-gray-500">{token.name.length > 20 ? token.name.substring(0, 20) + '...' : token.name}</span>
                           {token.priceChange?.h24 && (
                             <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                               parseFloat(token.priceChange.h24.toString()) > 0 
                                 ? 'bg-green-500/10 text-green-400' 
                                 : 'bg-red-500/10 text-red-400'
                             }`}>
                               {parseFloat(token.priceChange.h24.toString()) > 0 ? '+' : ''}{parseFloat(token.priceChange.h24.toString()).toFixed(1)}%
                             </span>
                           )}
                         </div>
                         <div className="text-[13px] text-gray-500 mt-0.5">
                           {token.priceUsd && <span>${parseFloat(token.priceUsd).toFixed(6)}</span>}
                           {token.marketCap && <span className="ml-3">MC: ${formatNumber(token.marketCap)}</span>}
                           {token.volume?.h24 && <span className="ml-3">Vol: ${formatNumber(token.volume.h24)}</span>}
                         </div>
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
           )}

           {/* Wallets */}
           {results.wallets.length > 0 && (
             <div className="w-full">
               {results.wallets.map((wallet, index) => {
                 const globalIndex = results.tokens.length + index;
                 const isSelected = selectedIndex === globalIndex;
                 return (
                   <div
                     key={wallet.address}
                     className={`px-4 py-2 hover:bg-gray-800/40 cursor-pointer border-b border-gray-800/20 ${isSelected ? "bg-gray-800/40" : ""}`}
                     onClick={() => handleResultClick({ type: "wallet", result: wallet })}
                   >
                     <div className="flex items-center gap-3">
                       <div className="w-7 h-7 rounded bg-green-500/20 flex items-center justify-center">
                         <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                         </svg>
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="text-[15px] text-gray-200 font-mono">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">ADDRESS</span>
                            {wallet.isContract && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">CONTRACT</span>}
                          </div>
                          <div className="text-[13px] text-gray-500 mt-0.5">
                            {wallet.balance && <span>{parseFloat(wallet.balance).toFixed(4)} ETH</span>}
                            {wallet.transactionCount !== undefined && <span className="ml-3">{wallet.transactionCount.toLocaleString()} txns</span>}
                         </div>
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
           )}

           {/* Transactions */}
           {results.transactions.length > 0 && (
             <div className="w-full">
               {results.transactions.map((tx, index) => {
                 const globalIndex = results.tokens.length + results.wallets.length + index;
                 const isSelected = selectedIndex === globalIndex;
                 return (
                   <div
                     key={tx.hash}
                     className={`px-4 py-2 hover:bg-gray-800/40 cursor-pointer border-b border-gray-800/20 ${isSelected ? "bg-gray-800/40" : ""}`}
                     onClick={() => handleResultClick({ type: "transaction", result: tx })}
                   >
                     <div className="flex items-center gap-3">
                       <div className="w-7 h-7 rounded bg-purple-500/20 flex items-center justify-center">
                         <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                         </svg>
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="text-[15px] text-gray-200 font-mono">{tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">TX</span>
                            {tx.status !== undefined && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${tx.status === 1 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                {tx.status === 1 ? 'SUCCESS' : 'FAILED'}
                              </span>
                            )}
                          </div>
                          <div className="text-[13px] text-gray-500 mt-0.5">
                            {tx.blockNumber && <span>Block {tx.blockNumber.toLocaleString()}</span>}
                            {tx.value && parseFloat(tx.value) > 0 && <span className="ml-3">{parseFloat(tx.value).toFixed(4)} ETH</span>}
                         </div>
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
           )}

           {/* Blocks */}
           {results.blocks.length > 0 && (
             <div className="w-full">
               {results.blocks.map((block, index) => {
                 const globalIndex = results.tokens.length + results.wallets.length + results.transactions.length + index;
                 const isSelected = selectedIndex === globalIndex;
                 return (
                   <div
                     key={block.number}
                     className={`px-4 py-2 hover:bg-gray-800/40 cursor-pointer border-b border-gray-800/20 ${isSelected ? "bg-gray-800/40" : ""}`}
                     onClick={() => handleResultClick({ type: "block", result: block })}
                   >
                     <div className="flex items-center gap-3">
                       <div className="w-7 h-7 rounded bg-orange-500/20 flex items-center justify-center">
                         <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                         </svg>
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="text-[15px] text-gray-200">Block #{block.number.toLocaleString()}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">BLOCK</span>
                            {block.transactions !== undefined && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400">{block.transactions} txs</span>
                            )}
                          </div>
                          <div className="text-[13px] text-gray-500 mt-0.5">
                            {block.hash && <span className="font-mono">{block.hash.slice(0, 10)}...{block.hash.slice(-6)}</span>}
                            {block.timestamp && <span className="ml-3">{new Date(block.timestamp).toLocaleString()}</span>}
                         </div>
                       </div>
                     </div>
                   </div>
                 );
               })}
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
