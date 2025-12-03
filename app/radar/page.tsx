"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Header from "../components/Header";
import { useLoading, PageLoader } from "../components/LoadingProvider";
import LoadingSpinner from "../components/LoadingSpinner";
import { FiSettings, FiX } from "react-icons/fi";
import { SiEthereum } from "react-icons/si";
import { useWatchlists } from "../hooks/useWatchlists";
import { useFavorites } from "../hooks/useFavorites";

// Icons
const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);



// Tag logic functions
function getTokenTags(token: {
  address?: string;
  marketCap?: string | number;
  volume24h?: string | number;
  uniqueHolders?: string | number;
  liquidity?: { usd?: string | number };
  marketCapDelta24h?: string | number;
  createdAt?: string;
  tags?: string[];
}) {
  // Start with existing tags if they exist, otherwise empty array
  const tags: string[] = token.tags ? [...token.tags] : [];
  
  const marketCap = typeof token.marketCap === 'string' ? parseFloat(token.marketCap) : (token.marketCap || 0);
  const volume = typeof token.volume24h === 'string' ? parseFloat(token.volume24h) : (token.volume24h || 0);
  const holders = typeof token.uniqueHolders === 'string' ? parseInt(token.uniqueHolders) : (token.uniqueHolders || 0);
  const liquidity = typeof token.liquidity?.usd === 'string' ? parseFloat(token.liquidity.usd) : (token.liquidity?.usd || 0);
  const marketCapDelta24h = typeof token.marketCapDelta24h === 'string' ? parseFloat(token.marketCapDelta24h) : (token.marketCapDelta24h || 0);
  
  // NEW tag - if created in last 10 days (always check, even if tags exist)
  if (token.createdAt) {
    try {
      const created = new Date(token.createdAt);
      const now = new Date();
      const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 10 && daysDiff >= 0) {
        if (!tags.includes("NEW")) {
          tags.push("NEW");
        }
      }
    } catch (dateError) {
      // Invalid date, skip NEW tag
      console.warn("Invalid createdAt date for token:", token.address, token.createdAt);
    }
  }
  
  // SPIKE tag - if volume > $100K in 24h
  if (volume > 100000) {
    tags.push("SPIKE");
  }
  
  // VOLUME tag - if volume > $50K in 24h
  if (volume > 50000) {
    tags.push("VOLUME");
  }
  
  // RUNNER tag - if market cap < $500K and volume > $10K
  if (marketCap < 500000 && volume > 10000) {
    tags.push("RUNNER");
  }
  
  // TRENDING tag - if holders > 500
  if (holders > 500) {
    tags.push("TRENDING");
  }
  
  // LIQUIDITY tag - if liquidity > $50K
  if (liquidity > 50000) {
    tags.push("LIQUIDITY");
  }
  
  // MOONSHOT tag - if market cap < $100K but volume > $5K
  if (marketCap < 100000 && volume > 5000) {
    tags.push("MOONSHOT");
  }
  
  // ESTABLISHED tag - if market cap > $5M
  if (marketCap > 5000000) {
    tags.push("ESTABLISHED");
  }
  
  // GAINER tag - if market cap delta > 20%
  if (marketCapDelta24h > 20) {
    tags.push("GAINER");
  }
  
  return tags;
}

function formatNumber(num: string | number | undefined) {
  if (!num) return "-";
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n)) return "-";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function getAgeFromTimestamp(timestamp: string) {
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes > 0) return `${diffMinutes}m`;
  return "now";
}

const TagBadge = ({ tag }: { tag: string }) => {
  const tagColors: { [key: string]: string } = {
    NEW: "bg-green-500/20 text-green-300 border-green-500/30",
    SURGING: "bg-red-500/20 text-red-300 border-red-500/30",
    VOLUME: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    RUNNER: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    TRENDING: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    LIQUIDITY: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    MOONSHOT: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    ESTABLISHED: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    GAINER: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  };
  
  return (
    <span className={`inline-block px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] md:text-xs font-medium rounded-full border ${tagColors[tag] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}>
      {tag}
    </span>
  );
};

// DEX Icon component
const DexIcon = ({ dexId }: { dexId?: string }) => {
  const getDexIcon = (dexId: string) => {
    switch (dexId?.toLowerCase()) {
      case 'baseswap':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">B</span>
          </div>
        );
      case 'uniswap_v3':
      case 'uniswap':
        return (
          <img
            src="https://i.imgur.com/woTkNd2.png"
            alt="Uniswap"
            className="w-4 h-4 rounded-full object-cover"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              console.log('Uniswap image failed to load, showing fallback');
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.fallback');
              if (fallback) fallback.classList.remove('hidden');
            }}
            onLoad={() => console.log('Uniswap image loaded successfully')}
          />
        );
      case 'pancakeswap_v3':
      case 'pancakeswap':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
        );
      case 'aerodrome':
        return (
          <img
            src="https://i.imgur.com/TpmRnXs.png"
            alt="Aerodrome"
            className="w-4 h-4 rounded-full object-cover"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              console.log('Aerodrome image failed to load, showing fallback');
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.fallback');
              if (fallback) fallback.classList.remove('hidden');
            }}
            onLoad={() => console.log('Aerodrome image loaded successfully')}
          />
        );
      case 'alienbase':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
        );
      default:
        return (
          <div className="w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">D</span>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        {getDexIcon(dexId || '')}
        {/* Fallback text for image loading failures */}
        <div className={`fallback absolute inset-0 w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center ${dexId?.toLowerCase() === 'uniswap' || dexId?.toLowerCase() === 'uniswap_v3' || dexId?.toLowerCase() === 'aerodrome' ? 'hidden' : ''}`}>
          <span className="text-white text-xs font-bold">
            {dexId?.toLowerCase() === 'uniswap' || dexId?.toLowerCase() === 'uniswap_v3' ? 'U' : 
             dexId?.toLowerCase() === 'aerodrome' ? 'A' : 'D'}
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-400">{dexId ? dexId.charAt(0).toUpperCase() + dexId.slice(1).toLowerCase() : 'Unknown'}</span>
    </div>
  );
};



export default function RadarPage() {
  const router = useRouter();
  
  // New pairs from APIs/SDKs (all tokens, no threshold)
  const [newPairsTokens, setNewPairsTokens] = useState<Array<{
    id?: string;
    name: string;
    symbol: string;
    address: string;
    pairAddress?: string;
    marketCap?: string | number;
    volume24h?: string | number;
    uniqueHolders?: string | number;
    liquidity?: { usd?: string | number };
    createdAt?: string | Date;
    tags: string[];
    mediaContent?: { previewImage?: { small?: string; medium?: string } };
    source?: string;
    dexName?: string;
    marketCapDelta24h?: string | number;
    totalVolume?: string | number;
    creatorAddress?: string;
    totalSupply?: string | number;
    description?: string;
    website?: string;
    telegram?: string;
    twitter?: string;
    tokenUri?: string;
    lastUpdated?: string | Date;
    priceChange?: {
      m5?: number;
      h1?: number;
      h6?: number;
      h24?: number;
    };
    [key: string]: unknown;
  }>>([]);
  
  // Screener tokens from Firebase (meet thresholds: 50k MC, 10k volume)
  const [screenerTokens, setScreenerTokens] = useState<Array<{
    id?: string;
    name: string;
    symbol: string;
    address: string;
    pairAddress?: string;
    marketCap?: string | number;
    volume24h?: string | number;
    uniqueHolders?: string | number;
    liquidity?: { usd?: string | number };
    createdAt?: string | Date;
    tags: string[];
    mediaContent?: { previewImage?: { small?: string; medium?: string } };
    source?: string;
    dexName?: string;
    marketCapDelta24h?: string | number;
    totalVolume?: string | number;
    creatorAddress?: string;
    totalSupply?: string | number;
    description?: string;
    website?: string;
    telegram?: string;
    twitter?: string;
    tokenUri?: string;
    lastUpdated?: string | Date;
    priceChange?: {
      m5?: number;
      h1?: number;
      h6?: number;
      h24?: number;
    };
    [key: string]: unknown;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isLoading: pageLoading } = useLoading();
  
  // Compact filters
  const [search] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  
  // UI State
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder] = useState<"asc" | "desc">("desc");
  
  // Use the new favorites and watchlists hooks
  const { toggleFavorite, isFavorite } = useFavorites();
  const { watchlists, addToWatchlist, removeFromWatchlist } = useWatchlists();
  
  // Individual column filter states
  const [newPairsFilter, setNewPairsFilter] = useState("");
  const [surgingFilter, setSurgingFilter] = useState("");
  const [gainersFilter, setGainersFilter] = useState("");
  
  // Individual column filter amount states
  const [newPairsFilterAmount, setNewPairsFilterAmount] = useState("");
  const [surgingFilterAmount, setSurgingFilterAmount] = useState("");
  const [gainersFilterAmount, setGainersFilterAmount] = useState("");
  
  // Filter dropdown states
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  
  // Advanced filtering system (unused for now)
  // const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    timeframes: [] as string[],
    marketCapMin: "",
    marketCapMax: "",
    volumeMin: "",
    volumeMax: "",
    liquidityMin: "",
    liquidityMax: "",
    priceChangeMin: "",
    priceChangeMax: "",
    tokenAgeMin: "",
    tokenAgeMax: "",
    categories: [] as string[],
    protocols: [] as string[],
    quoteTokens: [] as string[],
    keywords: "",
    excludeKeywords: "",
  });
  
  // Quick buy/swap modal state (unused for now)
  // const [showQuickBuyModal, setShowQuickBuyModal] = useState(false); 
  // const [selectedTokenForBuy, setSelectedTokenForBuy] = useState<any>(null);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.filter-dropdown')) {
        setShowTagDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Helper function to check if token is in any watchlist
  const isInAnyWatchlist = (address: string) => {
    return watchlists.some(watchlist => watchlist.tokens.includes(address));
  };

  // Toggle watchlist using the new hook
  const toggleWatchlist = (address: string) => {
    if (isInAnyWatchlist(address)) {
      // Remove from the first watchlist that contains it
      const watchlistWithToken = watchlists.find(w => w.tokens.includes(address));
      if (watchlistWithToken) {
        removeFromWatchlist(watchlistWithToken.id, address);
      }
    } else {
      // Add to the first watchlist if available
      if (watchlists.length > 0) {
        addToWatchlist(watchlists[0].id, address);
      }
    }
  };

  // Fetch new pairs from APIs/SDKs (all tokens, no threshold filtering)
  useEffect(() => {
    let isMounted = true;
    
    async function fetchNewPairs(_silent = false) {
      if (!_silent) setLoading(true);
      try {
        // Fetch all tokens from APIs/SDKs
        const res = await fetch(`/api/cypherscope-tokens?t=${Date.now()}`);
        const data = await res.json();
        
        if (!isMounted) return;
        
        console.log("🔍 New Pairs API Response:", data);
        console.log("🔍 New Pairs from API:", data.tokens?.length || 0);
        
        // Process tokens with proper stats extraction - NO THRESHOLD FILTERING
        const tokensWithTags = (data.tokens || []).map((token: any) => {
          const processedToken = {
            ...token,
            volume24h: token.volume24h || (token.volume && typeof token.volume === 'object' && 'h24' in token.volume ? (token.volume as any).h24 : 0) || 0,
            marketCap: token.marketCap || 0,
            priceChange: token.priceChange || {
              m5: 0,
              h1: 0,
              h6: 0,
              h24: 0,
            },
            liquidity: token.liquidity || { usd: 0 },
            uniqueHolders: token.uniqueHolders || token.holders || 0,
            priceUsd: token.priceUsd || '0',
            txns: token.txns || {
              m5: { buys: 0, sells: 0 },
              h1: { buys: 0, sells: 0 },
              h6: { buys: 0, sells: 0 },
              h24: { buys: 0, sells: 0 },
            },
          };
          
          const tags = getTokenTags(processedToken);
          return {
            ...processedToken,
            tags: tags
          };
        });
        
        setNewPairsTokens(tokensWithTags);
        
        // Check for graduation: tokens that meet thresholds should be added to Firebase
        const tokensToGraduate = tokensWithTags.filter((token: any) => {
          const marketCap = typeof token.marketCap === 'string' ? parseFloat(token.marketCap) : (token.marketCap || 0);
          const volume24h = typeof token.volume24h === 'string' ? parseFloat(token.volume24h) : (token.volume24h || 0);
          const volumeFromNested = (token.volume && typeof token.volume === 'object' && 'h24' in token.volume) ? (typeof (token.volume as any).h24 === 'string' ? parseFloat((token.volume as any).h24) : (token.volume as any).h24 || 0) : 0;
          const finalVolume = volume24h || volumeFromNested;
          
          // Graduation criteria: >50k market cap AND >10k volume
          return marketCap > 50000 && finalVolume > 10000;
        });
        
        // Graduate tokens to Firebase
        if (tokensToGraduate.length > 0) {
          try {
            const graduateResponse = await fetch('/api/tokens/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                tokens: tokensToGraduate,
                source: 'radar-graduation'
              })
            });
            
            if (graduateResponse.ok) {
              const result = await graduateResponse.json();
              console.log(`🎓 Graduated ${tokensToGraduate.length} tokens to Firebase:`, result);
            }
          } catch (error) {
            console.warn('⚠️ Failed to graduate tokens:', error);
          }
        }
      } catch (error) {
        console.error("❌ Fetch new pairs error:", error);
        if (!_silent) setError("Failed to fetch new pairs.");
      } finally {
        if (!_silent) setLoading(false);
      }
    }
    
    // Fetch screener tokens from Firebase (meet thresholds: 50k MC, 10k volume)
    async function fetchScreenerTokens(_silent = false) {
      try {
        const res = await fetch(`/api/tokens?source=all&limit=500&sortBy=createdAt&sortOrder=desc`);
        const data = await res.json();
        
        if (!isMounted) return;
        
        console.log("🔍 Screener tokens:", data.tokens?.length || 0);
        
        // Process screener tokens (already meet thresholds)
        const tokensWithTags = (data.tokens || []).map((token: any) => {
          const processedToken = {
            ...token,
            volume24h: token.volume24h || (token.volume && typeof token.volume === 'object' && 'h24' in token.volume ? (token.volume as any).h24 : 0) || 0,
            marketCap: token.marketCap || 0,
            priceChange: token.priceChange || {
              m5: 0,
              h1: 0,
              h6: 0,
              h24: 0,
            },
            liquidity: token.liquidity || { usd: 0 },
            uniqueHolders: token.uniqueHolders || token.holders || 0,
            priceUsd: token.priceUsd || '0',
            txns: token.txns || {
              m5: { buys: 0, sells: 0 },
              h1: { buys: 0, sells: 0 },
              h6: { buys: 0, sells: 0 },
              h24: { buys: 0, sells: 0 },
            },
          };
          
          const tags = getTokenTags(processedToken);
          return {
            ...processedToken,
            tags: tags
          };
        });
        
        setScreenerTokens(tokensWithTags);
      } catch (error) {
        console.error("❌ Fetch screener tokens error:", error);
      }
    }
    
    // Initial fetch
    fetchNewPairs();
    fetchScreenerTokens();
    
    // Real-time polling every 30 seconds (reduced from 12s to avoid rate limiting)
    const pollInterval = setInterval(() => {
      fetchNewPairs(true);
      fetchScreenerTokens(true);
    }, 30 * 1000);
    
    // Background sync every 5 minutes (reduced frequency to avoid rate limiting)
    const syncInterval = setInterval(async () => {
      try {
        await fetch('/api/tokens/sync', { method: 'GET' });
        console.log('🔄 Background token sync completed');
        fetchNewPairs(true);
        fetchScreenerTokens(true);
      } catch (error) {
        console.warn('⚠️ Background sync failed:', error);
      }
    }, 5 * 60 * 1000);
    
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      clearInterval(syncInterval);
    };
  }, []);

  // Filter new pairs tokens (no threshold filtering - show all)
  // Also filter out tokens without volume after 24 hours
  const filteredNewPairs = newPairsTokens
    .filter((token) => {
      // Filter out tokens that don't have volume after 2 hours
      if (token.createdAt) {
        try {
          const created = new Date(token.createdAt);
          const now = new Date();
          const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
          
          const volume24h = typeof token.volume24h === 'string' ? parseFloat(token.volume24h) : (token.volume24h || 0);
          const volumeFromNested = (token.volume && typeof token.volume === 'object' && 'h24' in token.volume) ? (typeof (token.volume as any).h24 === 'string' ? parseFloat((token.volume as any).h24) : (token.volume as any).h24 || 0) : 0;
          const finalVolume = volume24h || volumeFromNested;
          
          // If token is older than 2 hours and has no volume, hide it
          if (hoursSinceCreation > 2 && finalVolume === 0) {
            return false;
          }
        } catch (dateError) {
          // If we can't parse the date, keep the token
          console.warn("Invalid createdAt date for token:", token.address, token.createdAt);
        }
      }
      
      if (showWatchlistOnly && !isInAnyWatchlist(token.address)) {
        return false;
      }
      
      const matchesSearch =
        token.name?.toLowerCase().includes(search.toLowerCase()) ||
        token.symbol?.toLowerCase().includes(search.toLowerCase()) ||
        token.address?.toLowerCase().includes(search.toLowerCase());
      
      let matchesTag = true;
      if (selectedTag && token.tags) {
        matchesTag = token.tags.includes(selectedTag);
      }
      
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      return bDate - aDate;
    });

  // Filter screener tokens (already meet thresholds)
  const filteredScreenerTokens = screenerTokens
    .filter((token) => {
      if (showWatchlistOnly && !isInAnyWatchlist(token.address)) {
        return false;
      }
      
      const matchesSearch =
        token.name?.toLowerCase().includes(search.toLowerCase()) ||
        token.symbol?.toLowerCase().includes(search.toLowerCase()) ||
        token.address?.toLowerCase().includes(search.toLowerCase());
      
      let matchesTag = true;
      if (selectedTag && token.tags) {
        matchesTag = token.tags.includes(selectedTag);
      }
      
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      let aVal: number | Date, bVal: number | Date;
      
      switch (sortBy) {
        case "createdAt":
          aVal = new Date(a.createdAt || 0);
          bVal = new Date(b.createdAt || 0);
          break;
        case "marketCap":
          aVal = typeof a.marketCap === 'string' ? parseFloat(a.marketCap) : (a.marketCap || 0);
          bVal = typeof b.marketCap === 'string' ? parseFloat(b.marketCap) : (b.marketCap || 0);
          break;
        case "volume24h":
          aVal = typeof a.volume24h === 'string' ? parseFloat(a.volume24h) : (a.volume24h || 0);
          bVal = typeof b.volume24h === 'string' ? parseFloat(b.volume24h) : (b.volume24h || 0);
          break;
        case "uniqueHolders":
          aVal = typeof a.uniqueHolders === 'string' ? parseInt(a.uniqueHolders) : (a.uniqueHolders || 0);
          bVal = typeof b.uniqueHolders === 'string' ? parseInt(b.uniqueHolders) : (b.uniqueHolders || 0);
          break;
        default:
          aVal = parseFloat(String(a[sortBy] || "0"));
          bVal = parseFloat(String(b[sortBy] || "0"));
      }
      
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  // Helper function to check if token is SURGING
  const isSurgingToken = (token: any) => {
    // Volume threshold: Must have at least $5K in 24h volume
    const volume24h = typeof token.volume24h === 'string' ? parseFloat(token.volume24h) : (token.volume24h || 0);
    const volumeFromNested = (token.volume && typeof token.volume === 'object' && 'h24' in token.volume) ? (typeof (token.volume as any).h24 === 'string' ? parseFloat((token.volume as any).h24) : (token.volume as any).h24 || 0) : 0;
    const finalVolume = volume24h || volumeFromNested;
    
    // Minimum volume requirement - filter out trash
    if (finalVolume < 5000) {
      return false;
    }
    
    // Must have SURGING tag from API
    if (token.tags?.includes("SURGING")) return true;
    
    // OR must meet surging criteria:
    // 1. Positive price movement (any positive gain)
    const priceChange24h = token.priceChange?.h24 || token.priceChange24h || 0;
    const priceChange6h = token.priceChange?.h6 || 0;
    const priceChange1h = token.priceChange?.h1 || 0;
    
    // 2. High volume (at least $10K in 24h) OR significant price movement with volume
    const hasHighVolume = finalVolume >= 10000;
    const hasSignificantGain = (priceChange24h > 10 || priceChange6h > 15 || priceChange1h > 20);
    
    // 3. Has activity tags indicating real momentum
    const hasActivityTags = token.tags?.some((tag: string) => 
      ['SPIKE', 'VOLUME', 'RUNNER', 'TRENDING', 'GAINER'].includes(tag)
    );
    
    // Show if: (significant gain with volume) OR (high volume) OR (has activity tags)
    return (hasSignificantGain && finalVolume >= 5000) || hasHighVolume || hasActivityTags;
  };

  // Helper function to check if token is a GAINER
  const isGainerToken = (token: any) => {
    // Volume threshold: Must have at least $5K in 24h volume
    const volume24h = typeof token.volume24h === 'string' ? parseFloat(token.volume24h) : (token.volume24h || 0);
    const volumeFromNested = (token.volume && typeof token.volume === 'object' && 'h24' in token.volume) ? (typeof (token.volume as any).h24 === 'string' ? parseFloat((token.volume as any).h24) : (token.volume as any).h24 || 0) : 0;
    const finalVolume = volume24h || volumeFromNested;
    
    // Minimum volume requirement - filter out trash
    if (finalVolume < 5000) {
      return false;
    }
    
    // Check all available price change timeframes
    const priceChange24h = token.priceChange?.h24 || token.priceChange24h || 0;
    const priceChange6h = token.priceChange?.h6 || 0;
    const priceChange1h = token.priceChange?.h1 || 0;
    const priceChange5m = token.priceChange?.m5 || 0;
    
    // Must have meaningful positive gain (at least 5% in any timeframe)
    const hasMeaningfulGain = priceChange24h > 5 || priceChange6h > 7 || priceChange1h > 10 || priceChange5m > 15;
    
    if (hasMeaningfulGain) {
      return true;
    }
    
    // Also check market cap delta if available (must be significant)
    const marketCapDelta = typeof token.marketCapDelta24h === 'string' ? 
      parseFloat(token.marketCapDelta24h) : (token.marketCapDelta24h || 0);
    if (marketCapDelta > 10) return true;
    
    // If it has GAINER tag and meets volume threshold
    if (token.tags?.includes("GAINER") && finalVolume >= 5000) {
      return true;
    }
    
    // High volume tokens (>= $20K) are considered gainers even with smaller gains
    if (finalVolume >= 20000 && (priceChange24h > 0 || priceChange6h > 0 || priceChange1h > 0)) {
      return true;
    }
    
    return false;
  };

  // Categorize tokens for 3-column layout
  // NEW PAIRS: ALL tokens from APIs/SDKs (filteredNewPairs) - NO FILTERING, show all
  // These should NEVER appear in surging or gainers
  // Filter out tokens that have graduated (are now in Firebase) to avoid duplicates
  const screenerAddresses = new Set(screenerTokens.map(t => t.address?.toLowerCase()).filter(Boolean));
  let newTokens = filteredNewPairs
    .filter(token => {
      // Exclude tokens that have already graduated to Firebase
      if (token.address && screenerAddresses.has(token.address.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      return bDate - aDate;
    });

  // SURGING: ONLY tokens from screener (Firebase tokens collection) with significant momentum
  // These are tokens that are already in /discover page (meet 50k MC, 10k volume thresholds)
  // EXPLICITLY exclude any tokens from newPairsTokens to ensure separation
  const newPairsAddresses = new Set(newPairsTokens.map(t => t.address?.toLowerCase()).filter(Boolean));
  let surgingTokens = filteredScreenerTokens
    .filter(token => {
      // Explicitly exclude tokens from new pairs
      if (token.address && newPairsAddresses.has(token.address.toLowerCase())) {
        return false;
      }
      // Screener tokens come from /api/tokens which only returns tokens from Firebase tokens collection
      return isSurgingToken(token);
    })
    .sort((a, b) => {
      const aChange = a.priceChange?.h24 || 0;
      const bChange = b.priceChange?.h24 || 0;
      return bChange - aChange;
    })
    .slice(0, 50); // Show top 50 surging tokens

  // TOP GAINERS: ONLY tokens from screener (Firebase tokens collection) with positive price increases
  // These are tokens that are already in /discover page (meet 50k MC, 10k volume thresholds)
  // EXPLICITLY exclude any tokens from newPairsTokens to ensure separation
  let gainerTokens = filteredScreenerTokens
    .filter(token => {
      // Explicitly exclude tokens from new pairs
      if (token.address && newPairsAddresses.has(token.address.toLowerCase())) {
        return false;
      }
      // Only use screener tokens - exclude any tokens that might be from new pairs sources
      // Screener tokens come from /api/tokens which only returns tokens from Firebase tokens collection
      return isGainerToken(token);
    })
    .sort((a, b) => {
      const aChange = a.priceChange?.h24 || a.priceChange?.h6 || a.priceChange?.h1 || 0;
      const bChange = b.priceChange?.h24 || b.priceChange?.h6 || b.priceChange?.h1 || 0;
      return bChange - aChange;
    })
    .slice(0, 100); // Show top 100 gainers

  // Debug categorization
  console.log("🔍 Categorization Debug:");
  console.log("🔍 New pairs tokens:", filteredNewPairs.length);
  console.log("🔍 Screener tokens:", filteredScreenerTokens.length);
  console.log("🔍 New tokens:", newTokens.length);
  console.log("🔍 Surging tokens:", surgingTokens.length);
  console.log("🔍 Gainer tokens:", gainerTokens.length);



  const TokenCard = ({ token }: { token: any; index: number }) => {
    // Animation tracking removed
    // Helper function to format price change with color
    const formatPriceChange = (change: number | undefined) => {
      if (change === undefined || change === null) return { text: "-", color: "text-gray-400" };
      const isPositive = change >= 0;
      const color = isPositive ? "text-green-400" : "text-red-400";
      const sign = isPositive ? "+" : "";
      return { text: `${sign}${change.toFixed(1)}%`, color };
    };

    // Helper function to calculate buy percentage
    const getBuyPercentage = () => {
      if (!token.txns?.h24) return { text: "-", color: "text-gray-400" };
      const { buys, sells } = token.txns.h24;
      const total = buys + sells;
      if (total === 0) return { text: "-", color: "text-gray-400" };
      const buyPercentage = (buys / total) * 100;
      const color = buyPercentage > 60 ? "text-green-400" : buyPercentage < 40 ? "text-red-400" : "text-yellow-400";
      return { text: `${buyPercentage.toFixed(0)}%`, color };
    };

    // Extract stats with fallbacks
    const priceChange24h = formatPriceChange(
      token.priceChange?.h24 !== undefined 
        ? token.priceChange.h24 
        : token.priceChange24h
    );
    const buyPercentage = getBuyPercentage();
    
    // Extract market cap properly - handle all possible formats and validate
    let marketCap = 0;
    if (token.marketCap !== undefined && token.marketCap !== null) {
      if (typeof token.marketCap === 'string') {
        marketCap = parseFloat(token.marketCap);
      } else if (typeof token.marketCap === 'number') {
        marketCap = token.marketCap;
      }
    }
    // Validate market cap - if it's unreasonably small (< $100) or large (> $1e15), it's probably wrong
    if (isNaN(marketCap) || marketCap < 100 || marketCap > 1e15) {
      marketCap = 0;
    }
    
    // Extract volume properly
    let volume24h = 0;
    if (token.volume24h !== undefined && token.volume24h !== null) {
      if (typeof token.volume24h === 'string') {
        volume24h = parseFloat(token.volume24h);
      } else if (typeof token.volume24h === 'number') {
        volume24h = token.volume24h;
      }
    }
    // Also check nested volume structure
    if (!volume24h && token.volume && typeof token.volume === 'object' && 'h24' in token.volume) {
      volume24h = typeof (token.volume as any).h24 === 'string' ? parseFloat((token.volume as any).h24) : ((token.volume as any).h24 || 0);
    }
    
    const priceUsd = token.priceUsd || '0';

    // Navigate to chart page
    const handleTokenClick = () => {
      const addressToUse = token.pairAddress || token.address;
      // Validate address before navigation (must be 42 characters: 0x + 40 hex)
      if (addressToUse && /^0x[a-fA-F0-9]{40}$/.test(addressToUse)) {
        router.push(`/discover/${addressToUse}/chart`);
      } else {
        console.warn("Invalid token address for navigation:", addressToUse);
      }
    };

    // Handle quick buy
    const handleQuickBuy = (token: any, amount: number) => {
      // Navigate to swap page with pre-filled amount
      router.push(`/swap?token=${token.address}&amount=${amount}`);
    };

    return (
      <motion.div
        className="bg-gray-800/30 border-b border-gray-700/50 p-1.5 md:p-2.5 hover:bg-gray-700/30 transition-all duration-300 cursor-pointer group"
        initial={false}
        animate={{}}
        transition={{
          duration: 0.5,
          ease: "easeOut",
        }}
        style={{ 
          minHeight: '60px',
        }}
        onClick={handleTokenClick}
      >
        <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                          <Image
            src={token.info?.imageUrl || token.mediaContent?.previewImage?.small || (token.address && /^0x[a-fA-F0-9]{40}$/.test(token.address) ? `https://dexscreener.com/base/${token.address}/logo.png` : '/placeholder-token.png')}
                            alt={token.symbol || "Token"}
            width={28}
            height={28}
            className="rounded-full bg-blue-900 md:w-8 md:h-8"
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.src = (token.address && /^0x[a-fA-F0-9]{40}$/.test(token.address) ? `https://dexscreener.com/base/${token.address}/logo.png` : '/placeholder-token.png');
                }}
                          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-200 group-hover:text-blue-200 transition truncate text-xs md:text-sm">
                              {token.name || "Unknown"}
                            </div>
            <div className="text-[10px] md:text-xs text-gray-400 truncate">{token.symbol}</div>
            {/* Price and 24h change */}
            {priceUsd && priceUsd !== '0' && (
              <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs">
                <span className="text-gray-300">${parseFloat(priceUsd).toFixed(6)}</span>
                <span className={priceChange24h.color}>{priceChange24h.text}</span>
              </div>
            )}
                        </div>
                        <div className="flex items-center gap-0.5 md:gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(token.address);
                            }}
                            className={`p-0.5 md:p-1 rounded transition ${
                              isFavorite(token.address)
                                ? "text-yellow-400 hover:text-yellow-300"
                                : "text-gray-400 hover:text-yellow-400"
                            }`}
                          >
                            <StarIcon filled={isFavorite(token.address)} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWatchlist(token.address);
                            }}
                            className={`p-0.5 md:p-1 rounded transition ${
                              isInAnyWatchlist(token.address)
                                ? "text-blue-400 hover:text-blue-300"
                                : "text-gray-400 hover:text-blue-400"
                            }`}
                            title="Add to watchlist"
                          >
                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill={isInAnyWatchlist(token.address) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
        <div className="grid grid-cols-2 gap-0.5 md:gap-2 text-[10px] md:text-xs mb-1 md:mb-2">
          <div>
            <span className="text-gray-400">MC:</span>
            <span className="text-gray-200 ml-0.5 md:ml-1">
              {marketCap > 0 ? formatNumber(marketCap) : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Vol:</span>
            <span className="text-gray-200 ml-0.5 md:ml-1">
              {volume24h > 0 ? formatNumber(volume24h) : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Buy:</span>
            <span className={`ml-0.5 md:ml-1 ${buyPercentage.color}`}>{buyPercentage.text}</span>
                      </div>
          <div>
            <span className="text-gray-400">Age:</span>
            <span className="text-gray-200 ml-0.5 md:ml-1">{token.createdAt ? getAgeFromTimestamp(token.createdAt) : "-"}</span>
                        </div>
                        </div>
        
        {/* DEX Row */}
        <div className="flex items-center justify-between text-[10px] md:text-xs mb-1 md:mb-2">
          <DexIcon dexId={token.dexId} />
                      </div>
                      
                      {token.tags && token.tags.length > 0 && (
          <div className="flex items-center justify-between gap-1 md:gap-2">
            <div className="flex gap-0.5 md:gap-1 flex-wrap flex-1 min-w-0">
              {token.tags.slice(0, 2).map((tag: string) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
            
            {/* Quick Buy Buttons - Compact on mobile */}
            <div className="flex items-center gap-0.5 md:gap-1.5 flex-shrink-0">
              {[0.01, 0.025, 0.05, 0.1].map((amount) => (
                <button
                  key={amount}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickBuy(token, amount);
                  }}
                  className="flex items-center gap-0.5 md:gap-1 px-1.5 md:px-3 py-0.5 md:py-1.5 text-[9px] md:text-sm bg-gray-700/20 border border-gray-600/30 rounded-full hover:bg-gray-600/30 transition text-gray-300 hover:text-gray-200"
                >
                  <SiEthereum className="w-2.5 h-2.5 md:w-3 md:h-3 text-gray-400" />
                  <span className="hidden sm:inline">{amount}</span>
                </button>
              ))}
            </div>
          </div>
                      )}
      </motion.div>
    );
  };

  const ColumnHeader = ({ title, count, filterValue, onFilterChange, filterAmount, onFilterAmountChange }: { 
    title: string; 
    count: number; 
    filterValue: string;
    onFilterChange: (value: string) => void;
    filterAmount: string;
    onFilterAmountChange: (value: string) => void;
  }) => (
    <div className="p-1.5 md:p-3 bg-gray-800/50 border-b border-gray-700/50 h-[45px] md:h-[60px] flex items-center">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5 md:gap-3 flex-1 min-w-0">
          <h2 className="text-xs md:text-base font-semibold text-gray-100 font-sans tracking-wide truncate">{title}</h2>
          <div className="flex items-center gap-1 md:gap-2">
            <select
              value={filterValue}
              onChange={(e) => onFilterChange(e.target.value)}
              className="bg-gray-900/50 border border-gray-700 rounded-lg px-1.5 md:px-3 py-0.5 md:py-1.5 text-[9px] md:text-xs text-gray-200 focus:border-blue-500/50 focus:outline-none hover:bg-gray-800/50 transition-colors font-sans uppercase"
            >
              <option value="">All</option>
              <option value="age">Age</option>
              <option value="liquidity">Liq</option>
              <option value="priceChange">Price</option>
              <option value="holders">Hold</option>
              <option value="volume">Vol</option>
              <option value="marketCap">MC</option>
            </select>
            {filterValue && (
              <input
                type="number"
                value={filterAmount}
                onChange={(e) => onFilterAmountChange(e.target.value)}
                placeholder="Val"
                className="bg-gray-900/50 border border-gray-700 rounded-lg px-1.5 md:px-3 py-0.5 md:py-1.5 text-[9px] md:text-xs text-gray-200 focus:border-blue-500/50 focus:outline-none hover:bg-gray-800/50 transition-colors w-12 md:w-20 font-sans"
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <span className="text-[10px] md:text-sm text-gray-400 font-sans">{count}</span>
          {count > 5 && (
            <div className="hidden md:flex items-center gap-1">
              <span className="text-xs text-gray-500 font-sans">(scroll for more)</span>
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-950 text-gray-200 font-sans flex flex-col overflow-hidden">
      <Header />
      
      {/* Page Loader - centered on page */}
      {pageLoading && <PageLoader />}
      
      {/* Compact Header */}
      <div className="bg-gray-800/50 flex-shrink-0 border-b border-gray-700/50">
        <div className="w-full px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center justify-between md:justify-start gap-4">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-gray-200">Radar</h1>
                <div className="hidden md:flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-gray-400">{newPairsTokens.length + screenerTokens.length} tokens</span>
                  <span className="text-blue-400">•</span>
                  <span className="text-gray-400">{watchlists.reduce((total, w) => total + w.tokens.length, 0)} watchlisted</span>
                </div>
                <div className="md:hidden flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-gray-400">{newPairsTokens.length + screenerTokens.length} tokens</span>
                </div>
              </div>
              
              {/* Mobile Filter Icons - Inline with title */}
              <div className="flex items-center gap-2 md:hidden">
                {/* Combined Filter Button */}
                <div className="relative filter-dropdown">
                  <button
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    className="p-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-300 hover:bg-gray-600/50 transition"
                  >
                    <FiSettings className="w-4 h-4" />
                  </button>
                  {showTagDropdown && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                      <div className="p-2 space-y-2">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Tag Filter</label>
                          <select
                            value={selectedTag}
                            onChange={(e) => setSelectedTag(e.target.value)}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 focus:border-blue-400 focus:outline-none"
                          >
                            <option value="">All Tags</option>
                            <option value="NEW">New</option>
                            <option value="SPIKE">Spike</option>
                            <option value="VOLUME">Volume</option>
                            <option value="RUNNER">Runner</option>
                            <option value="GAINER">Gainer</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Sort By</label>
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 focus:border-blue-400 focus:outline-none"
                          >
                            <option value="createdAt">Age</option>
                            <option value="marketCap">Market Cap</option>
                            <option value="volume24h">Volume</option>
                            <option value="uniqueHolders">Holders</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
                  className={`p-2 rounded-lg transition ${
                    showWatchlistOnly 
                      ? "bg-yellow-600/20 text-yellow-300 border border-yellow-500/30" 
                      : "bg-gray-700/50 text-gray-300 border border-gray-600/50 hover:bg-gray-600/50"
                  }`}
                >
                  <StarIcon filled={showWatchlistOnly} />
                </button>
              </div>
            </div>
                      
              {/* Desktop Compact Filters */}
            <div className="hidden md:flex items-center justify-end gap-2">
              {/* Filters Button */}
              <button
                onClick={() => setShowFiltersModal(true)}
                className="px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-300 hover:bg-gray-600/50 transition text-sm flex items-center gap-2"
              >
                <FiSettings className="w-4 h-4" />
                <span>Filters</span>
              </button>
              {/* Combined Filter Button */}
              <div className="relative filter-dropdown">
                <button
                  onClick={() => setShowTagDropdown(!showTagDropdown)}
                  className="p-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-300 hover:bg-gray-600/50 transition"
                >
                  <FiSettings className="w-4 h-4" />
                </button>
                {showTagDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                    <div className="p-2 space-y-2">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Tag Filter</label>
                        <select
                          value={selectedTag}
                          onChange={(e) => setSelectedTag(e.target.value)}
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 focus:border-blue-400 focus:outline-none"
                        >
                          <option value="">All Tags</option>
                          <option value="NEW">New</option>
                          <option value="SPIKE">Spike</option>
                          <option value="VOLUME">Volume</option>
                          <option value="RUNNER">Runner</option>
                          <option value="GAINER">Gainer</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Sort By</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 focus:border-blue-400 focus:outline-none"
                        >
                          <option value="createdAt">Age</option>
                          <option value="marketCap">Market Cap</option>
                          <option value="volume24h">Volume</option>
                          <option value="uniqueHolders">Holders</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
                        
              <button
                onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
                className={`p-2 rounded-lg transition ${
                  showWatchlistOnly 
                    ? "bg-yellow-600/20 text-yellow-300 border border-yellow-500/30" 
                    : "bg-gray-700/50 text-gray-300 border border-gray-600/50 hover:bg-gray-600/50"
                }`}
              >
                <StarIcon filled={showWatchlistOnly} />
              </button>
            </div>
                        </div>
                                                  </div>
                        </div>
                       
        {/* 3-Column Layout - Full Width */}
      <div className="flex-1 overflow-hidden min-h-0 min-w-0">
        {loading ? (
          <div className="flex items-center justify-center h-full" style={{ paddingTop: '40px' }}>
            <LoadingSpinner variant="dots" size="lg" text="Loading Radar..." />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-400 text-lg mb-2">{error}</div>
                        <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition"
            >
              Retry
                        </button>
                      </div>
        ) : (
          <div className="flex md:grid md:grid-cols-3 w-full h-full min-w-0 overflow-x-auto md:overflow-x-visible">
            {/* New Tokens Column */}
            <div className="flex flex-col h-full min-w-0 flex-shrink-0 w-full md:w-auto border-r border-gray-700/50">
              <ColumnHeader 
                title="New Pairs" 
                count={newTokens.length} 
                filterValue={newPairsFilter}
                onFilterChange={setNewPairsFilter}
                filterAmount={newPairsFilterAmount}
                onFilterAmountChange={setNewPairsFilterAmount}
              />
              <div className="flex-1 overflow-y-auto scrollbar-hide px-0" style={{ minHeight: 0 }}>
                  {newTokens.map((token, index) => (
                    <TokenCard key={`${token.address}-${index}`} token={token} index={index} />
                  ))}
              </div>
            </div>
                        
            {/* Surging Tokens Column */}
            <div className="flex flex-col h-full min-w-0 flex-shrink-0 w-full md:w-auto border-r border-gray-700/50">
              <ColumnHeader 
                title="Surging" 
                count={surgingTokens.length} 
                filterValue={surgingFilter}
                onFilterChange={setSurgingFilter}
                filterAmount={surgingFilterAmount}
                onFilterAmountChange={setSurgingFilterAmount}
              />
              <div className="flex-1 overflow-y-auto scrollbar-hide px-0" style={{ minHeight: 0 }}>
                  {surgingTokens.map((token, index) => (
                    <TokenCard key={`${token.address}-${index}`} token={token} index={index} />
                  ))}
              </div>
            </div>
                      
            {/* Gainer Tokens Column */}
            <div className="flex flex-col h-full min-w-0 flex-shrink-0 w-full md:w-auto">
              <ColumnHeader 
                title="Top Gainers" 
                count={gainerTokens.length} 
                filterValue={gainersFilter}
                onFilterChange={setGainersFilter}
                filterAmount={gainersFilterAmount}
                onFilterAmountChange={setGainersFilterAmount}
              />
              <div className="flex-1 overflow-y-auto scrollbar-hide px-0" style={{ minHeight: 0 }}>
                  {gainerTokens.map((token, index) => (
                    <TokenCard key={`${token.address}-${index}`} token={token} index={index} />
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Filters Modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4" onClick={() => setShowFiltersModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-200">Filters</h2>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="text-gray-400 hover:text-gray-200 transition"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Market Cap Range */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Market Cap</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.marketCapMin}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, marketCapMin: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.marketCapMax}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, marketCapMax: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              
              {/* Volume Range */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Volume (24h)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.volumeMin}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, volumeMin: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.volumeMax}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, volumeMax: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              
              {/* Liquidity Range */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Liquidity</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.liquidityMin}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, liquidityMin: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.liquidityMax}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, liquidityMax: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              
              {/* Price Change Range */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Price Change (24h)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Min %"
                    value={advancedFilters.priceChangeMin}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, priceChangeMin: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max %"
                    value={advancedFilters.priceChangeMax}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, priceChangeMax: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              
              {/* Token Age Range */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Token Age (days)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.tokenAgeMin}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, tokenAgeMin: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.tokenAgeMax}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, tokenAgeMax: e.target.value })}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    setAdvancedFilters({
                      timeframes: [],
                      marketCapMin: "",
                      marketCapMax: "",
                      volumeMin: "",
                      volumeMax: "",
                      liquidityMin: "",
                      liquidityMax: "",
                      priceChangeMin: "",
                      priceChangeMax: "",
                      tokenAgeMin: "",
                      tokenAgeMax: "",
                      categories: [],
                      protocols: [],
                      quoteTokens: [],
                      keywords: "",
                      excludeKeywords: "",
                    });
                  }}
                  className="px-4 py-2 text-gray-300 hover:text-gray-200 transition"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowFiltersModal(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 