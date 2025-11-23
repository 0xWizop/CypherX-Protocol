"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import { motion } from "framer-motion";
import { useWalletSystem } from "@/app/providers";

interface TradingStats {
  totalPnL: number;
  totalPnLPercentage: number;
  totalVolume: number;
  totalTrades: number;
  winRate: number;
  bought: number;
  sold: number;
  holding: number;
  positionsClosed: number;
  completedTrades: number;
  dailyPnL: Array<{ date: string; pnl: number }>;
  recentTrades: Array<{
    id: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    timestamp: number;
    type: 'buy' | 'sell';
    status: 'completed' | 'pending' | 'failed';
  }>;
  positionsHistory: Array<{
    tokenAddress: string;
    tokenSymbol: string;
    entryPrice: number;
    exitPrice: number;
    amount: number;
    pnl: number;
    pnlPercentage: number;
    entryDate: string;
    exitDate: string;
    status: 'open' | 'closed';
  }>;
}

interface Position {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  avgPrice: string;
  currentPrice: string;
  pnl?: string;
  pnlValue?: string;
  pnlPercentage?: number;
  status: "open" | "closed";
}

export default function TradingDashboard() {
  const router = useRouter();
  const { selfCustodialWallet } = useWalletSystem();
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [stats, setStats] = useState<TradingStats | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "trades" | "analytics">("overview");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [totalWalletValue, setTotalWalletValue] = useState<number>(0);
  const [positionsPage, setPositionsPage] = useState<number>(1);
  const [tradesPage, setTradesPage] = useState<number>(1);
  const itemsPerPage = 10;
  const [tokenNames, setTokenNames] = useState<Record<string, string>>({});
  const [allTokenHoldings, setAllTokenHoldings] = useState<any[]>([]);

  // Reset pagination when switching tabs
  useEffect(() => {
    setPositionsPage(1);
    setTradesPage(1);
  }, [activeTab]);

  // Force no scroll on body/html
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
    };
  }, []);

  // Get wallet address from wallet system context and localStorage (fallback)
  useEffect(() => {
    // First check the wallet system context
    if (selfCustodialWallet?.address) {
      setWalletAddress(selfCustodialWallet.address);
      return;
    }
    
    // Fallback to localStorage if context doesn't have address yet
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("cypherx_wallet") : null;
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.address) {
          setWalletAddress(data.address);
        }
      }
    } catch {}
  }, [selfCustodialWallet?.address]);

  // Also listen to localStorage changes as backup
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cypherx_wallet") {
        try {
          const data = e.newValue ? JSON.parse(e.newValue) : null;
          if (data?.address) {
            setWalletAddress(data.address);
          } else {
            setWalletAddress("");
          }
        } catch {
          setWalletAddress("");
        }
      }
    };
    
    // Also listen for custom storage event (for same-tab updates)
    const onCustomStorage = () => {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("cypherx_wallet") : null;
        if (raw) {
          const data = JSON.parse(raw);
          if (data?.address) {
            setWalletAddress(data.address);
          } else {
            setWalletAddress("");
          }
        } else {
          setWalletAddress("");
        }
      } catch {
        setWalletAddress("");
      }
    };
    
    window.addEventListener("storage", onStorage);
    window.addEventListener("wallet-updated", onCustomStorage);
    
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wallet-updated", onCustomStorage);
    };
  }, []);

  // Fetch trading data
  useEffect(() => {
    if (!walletAddress) {
      setLoadingState(false);
      return;
    }

    const fetchData = async () => {
      setLoadingState(true);
      try {
        // Fetch PnL stats (with cache-busting to ensure fresh data)
        const pnlRes = await fetch(`/api/wallet/pnl?address=${walletAddress}&t=${Date.now()}`, {
          cache: 'no-store'
        });
        const pnlData = await pnlRes.json();
        if (pnlRes.ok) {
          setStats(pnlData);
        }

        // Fetch positions
        const positionsRes = await fetch(`/api/wallet/positions?address=${walletAddress}`);
        const positionsData = await positionsRes.json();
        if (positionsRes.ok) {
          setPositions(positionsData.positions || []);
          
          // Token names are already fetched from Alchemy API via allTokenHoldings
          // No need to fetch from DexScreener (which causes CORS errors)
          // If we need names for positions that aren't in holdings, we can extract them from allTokenHoldings
          const namesMap: Record<string, string> = {};
          
          // Extract token names from allTokenHoldings if available
          if (allTokenHoldings.length > 0) {
            allTokenHoldings.forEach((token: any) => {
              if (token.contractAddress && token.name) {
                namesMap[token.contractAddress.toLowerCase()] = token.name;
              }
            });
          }
          
          setTokenNames(namesMap);
        }

        // Fetch wallet balance and calculate total value
        const balanceRes = await fetch(`/api/wallet/balance?address=${walletAddress}`);
        if (balanceRes.ok) {
          const balanceData = await balanceRes.json();
          const ethBalance = parseFloat(balanceData.ethBalance || "0");
          
          // Get ETH price via API route (to avoid CORS)
          let ethPrice = 0;
          try {
            const ethPriceRes = await fetch("/api/price/eth");
            if (ethPriceRes.ok) {
              const ethPriceData = await ethPriceRes.json();
              // API returns { ethereum: { usd: price } }
              ethPrice = ethPriceData.ethereum?.usd || ethPriceData.price || 0;
            } else {
              // Fallback price if API fails
              ethPrice = 2737;
            }
          } catch (error) {
            console.error("Error fetching ETH price:", error);
            // Fallback price if API fails
            ethPrice = 2737;
          }
          
          // Calculate ETH value
          const ethValue = ethBalance * ethPrice;
          
          // Fetch all token holdings using Alchemy API (like wallet dropdown)
          try {
            const holdingsRes = await fetch('/api/alchemy/wallet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address: walletAddress,
                action: 'tokens'
              })
            });
            
            if (holdingsRes.ok) {
              const holdingsData = await holdingsRes.json();
              if (holdingsData.success && holdingsData.data?.tokenBalances) {
                setAllTokenHoldings(holdingsData.data.tokenBalances);
                
                // Calculate total token holdings value from all tokens (excluding ETH to avoid double counting)
                let tokenHoldingsValue = holdingsData.data.tokenBalances.reduce((sum: number, token: any) => {
                  // Check if this is ETH token (contract address or symbol)
                  const isEth = token.contractAddress?.toLowerCase() === '0x4200000000000000000000000000000000000006' ||
                                token.symbol === 'ETH' || token.symbol === 'WETH';
                  
                  // If it's ETH, use ethValue instead to avoid double counting
                  // Otherwise, include all other token values
                  if (isEth) {
                    // ETH is already included in ethValue calculation above
                    return sum;
                  }
                  
                  return sum + (token.usdValue || 0);
                }, 0);
                
                // Total wallet value = ETH (already calculated) + all other token balances
                setTotalWalletValue(ethValue + tokenHoldingsValue);
              } else {
                setAllTokenHoldings([]);
                setTotalWalletValue(ethValue);
              }
            } else {
              // Fallback to positions if Alchemy fails
              let tokenHoldingsValue = 0;
              if (positionsData.positions && positionsData.positions.length > 0) {
                const openPositions = positionsData.positions.filter((p: Position) => p.status === 'open');
                tokenHoldingsValue = openPositions.reduce((sum: number, position: Position) => {
                  const amount = parseFloat(position.amount || "0");
                  const currentPrice = parseFloat(position.currentPrice || "0");
                  return sum + (amount * currentPrice);
                }, 0);
              }
              setTotalWalletValue(ethValue + tokenHoldingsValue);
            }
          } catch (error) {
            console.error("Error fetching token holdings:", error);
            setAllTokenHoldings([]);
            // Fallback to positions
            let tokenHoldingsValue = 0;
            if (positionsData.positions && positionsData.positions.length > 0) {
              const openPositions = positionsData.positions.filter((p: Position) => p.status === 'open');
              tokenHoldingsValue = openPositions.reduce((sum: number, position: Position) => {
                const amount = parseFloat(position.amount || "0");
                const currentPrice = parseFloat(position.currentPrice || "0");
                return sum + (amount * currentPrice);
              }, 0);
            }
            setTotalWalletValue(ethValue + tokenHoldingsValue);
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoadingState(false);
      }
    };

    fetchData();
    // Auto-refresh every 30 seconds without page reload
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Calculate portfolio allocation from all token holdings (including ETH)
  const portfolioAllocation = useMemo(() => {
    // Use a Map to deduplicate by address (case-insensitive) and combine values
    const allocationMap = new Map<string, {
      symbol: string;
      name: string | null;
      address: string;
      value: number;
      percentage: number;
      logo?: string;
    }>();
    
    // Calculate ETH value from token holdings
    let ethValue = 0;
    let ethTokenFromHoldings: any = null;
    
    // Check if ETH is in token holdings
    const ethToken = allTokenHoldings.find((t: any) => 
      t.contractAddress?.toLowerCase() === '0x4200000000000000000000000000000000000006' ||
      t.symbol === 'ETH'
    );
    
    if (ethToken && ethToken.usdValue > 0) {
      ethValue = ethToken.usdValue;
      ethTokenFromHoldings = ethToken;
      const ethAddress = '0x4200000000000000000000000000000000000006';
      allocationMap.set(ethAddress.toLowerCase(), {
        symbol: 'ETH',
        name: 'Ethereum',
        address: ethAddress,
        value: ethValue,
        percentage: 0,
        logo: ethToken.logo || 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
      });
    }
    
    // Add all other token holdings from Alchemy API (excluding ETH if already added)
    if (allTokenHoldings.length > 0) {
      allTokenHoldings.forEach((token) => {
        // Skip ETH if we already added it
        const isEth = token.contractAddress?.toLowerCase() === '0x4200000000000000000000000000000000000006' ||
                      token.symbol === 'ETH';
        
        if (!isEth && token.usdValue && token.usdValue > 0 && token.contractAddress) {
          const address = token.contractAddress.toLowerCase();
          
          // If token already exists in map, combine values
          if (allocationMap.has(address)) {
            const existing = allocationMap.get(address)!;
            existing.value += token.usdValue || 0;
          } else {
            allocationMap.set(address, {
              symbol: token.symbol || 'UNK',
              name: token.name || null,
              address: token.contractAddress,
              value: token.usdValue || 0,
              percentage: 0,
              logo: token.logo
            });
          }
        }
      });
    }
    
    // Fallback to positions if no holdings from Alchemy
    if (allocationMap.size === 0 && positions && positions.length > 0) {
      const openPositions = positions.filter(p => p.status === 'open');
      openPositions.forEach(p => {
        if (!p.tokenAddress) return; // Skip if no address
        
        const amount = parseFloat(p.amount || "0");
        const currentPrice = parseFloat(p.currentPrice || "0");
        const value = amount * currentPrice;
        if (value > 0) {
          const address = p.tokenAddress.toLowerCase();
          const tokenName = tokenNames[address] || null;
          
          // If position already exists in map, combine values
          if (allocationMap.has(address)) {
            const existing = allocationMap.get(address)!;
            existing.value += value;
          } else {
            allocationMap.set(address, {
              symbol: p.tokenSymbol,
              name: tokenName,
              address: p.tokenAddress,
              value,
              percentage: 0
            });
          }
        }
      });
    }
    
    // Convert map to array
    let allocation = Array.from(allocationMap.values());
    
    // Calculate total value from allocation
    let totalValue = allocation.reduce((sum, item) => sum + item.value, 0);
    
    // If we have totalWalletValue but no ETH in allocation, and totalValue is less than totalWalletValue,
    // add ETH difference as a separate entry (edge case handling)
    if (totalWalletValue > 0 && totalValue < totalWalletValue && !ethTokenFromHoldings) {
      const ethDifference = totalWalletValue - totalValue;
      if (ethDifference > 0.01) { // Only add if significant (> 1 cent)
        const ethAddress = '0x4200000000000000000000000000000000000006';
        allocation.unshift({
          symbol: 'ETH',
          name: 'Ethereum',
          address: ethAddress,
          value: ethDifference,
          percentage: 0,
          logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
        });
        totalValue = totalWalletValue;
      }
    }
    
    // Calculate percentages based on actual total value
    const finalTotalValue = Math.max(totalValue, totalWalletValue) || totalValue;
    
    // Filter out items without valid addresses and calculate percentages
    // Use a Set to track addresses we've seen to ensure complete deduplication
    const seenAddresses = new Set<string>();
    const deduplicatedAllocation: typeof allocation = [];
    
    for (const item of allocation) {
      if (!item.address || item.address.trim() === '') continue; // Skip items with empty addresses
      
      const addressLower = item.address.toLowerCase();
      if (!seenAddresses.has(addressLower)) {
        seenAddresses.add(addressLower);
        deduplicatedAllocation.push({
          ...item,
          percentage: finalTotalValue > 0 ? (item.value / finalTotalValue) * 100 : 0
        });
      }
    }
    
    return deduplicatedAllocation.sort((a, b) => b.value - a.value);
  }, [allTokenHoldings, positions, tokenNames, totalWalletValue]);

  // Filter daily PnL by time range with proper logic
  const filteredDailyPnL = useMemo(() => {
    if (!stats?.dailyPnL || stats.dailyPnL.length === 0) return [];
    
    if (timeRange === "all") {
      // Return all data for "all" time range
      return stats.dailyPnL;
    }
    
    const now = Date.now();
    let daysAgo = 7; // Default to 7d
    
    switch (timeRange) {
      case "7d":
        daysAgo = 7;
        break;
      case "30d":
        daysAgo = 30;
        break;
      case "90d":
        daysAgo = 90;
        break;
      default:
        daysAgo = 7;
    }
    
    const cutoff = now - (daysAgo * 24 * 60 * 60 * 1000);
    
    return stats.dailyPnL.filter(item => {
      const itemDate = new Date(item.date).getTime();
      return itemDate >= cutoff;
    });
  }, [stats?.dailyPnL, timeRange]);

  // Calculate cumulative PnL for chart
  const cumulativePnL = useMemo(() => {
    let cumulative = 0;
    return filteredDailyPnL.map(item => {
      cumulative += item.pnl;
      return {
        date: item.date,
        pnl: item.pnl,
        cumulative
      };
    });
  }, [filteredDailyPnL]);

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md w-full">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/20"></div>
            </div>
            <h2 className="text-2xl mb-3 text-white">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">Connect your wallet to view your trading dashboard and track your portfolio performance</p>
            <button
              onClick={() => {
                try {
                  (window as any).dispatchEvent(new CustomEvent('open-wallet'));
                } catch {}
              }}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white"
            >
              Connect Wallet
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-950 text-gray-200 flex flex-col overflow-hidden" style={{ height: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Header />
      
      <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden bg-gray-950 pb-24 sm:pb-28 lg:pb-10">
        <div className="max-w-[1400px] mx-auto px-2 sm:px-4 lg:px-5 flex flex-col min-h-0 py-2 sm:py-3">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 sm:mb-3 flex-shrink-0 pt-1 sm:pt-2">
            <div>
              <h1 className="text-base sm:text-lg lg:text-xl text-white">Trading Dashboard</h1>
              <p className="text-[10px] sm:text-xs text-gray-400">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
            </div>
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setLoadingState(true);
                try {
                  // Fetch PnL stats (with cache-busting to ensure fresh data)
                  const pnlRes = await fetch(`/api/wallet/pnl?address=${walletAddress}&t=${Date.now()}`, {
                    cache: 'no-store'
                  });
                  const pnlData = await pnlRes.json();
                  if (pnlRes.ok) setStats(pnlData);

                  const positionsRes = await fetch(`/api/wallet/positions?address=${walletAddress}`);
                  const positionsData = await positionsRes.json();
                  if (positionsRes.ok) {
                    setPositions(positionsData.positions || []);
                    
                    // Fetch token names from DexScreener
                    const uniqueAddresses = [...new Set((positionsData.positions || []).map((p: Position) => p.tokenAddress))] as string[];
                    const namePromises = uniqueAddresses.map(async (address: string) => {
                      try {
                        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
                        const data = await response.json();
                        const pair = data.pairs?.[0];
                        if (pair) {
                          return { address, name: pair.baseToken?.name || pair.quoteToken?.name || null };
                        }
                      } catch (error) {
                        console.error(`Error fetching token name for ${address}:`, error);
                      }
                      return { address, name: null };
                    });
                    
                    const nameResults = await Promise.all(namePromises);
                    const namesMap: Record<string, string> = {};
                    nameResults.forEach(({ address, name }) => {
                      if (name) namesMap[address.toLowerCase()] = name;
                    });
                    setTokenNames(namesMap);
                  }

                  // Fetch wallet balance and calculate total value (same logic as main fetch)
                  const balanceRes = await fetch(`/api/wallet/balance?address=${walletAddress}`);
                  if (balanceRes.ok) {
                    const balanceData = await balanceRes.json();
                    const ethBalance = parseFloat(balanceData.ethBalance || "0");
                    
                    // Get ETH price via API route (to avoid CORS)
                    let ethPrice = 0;
                    try {
                      const ethPriceRes = await fetch("/api/price/eth");
                      if (ethPriceRes.ok) {
                        const ethPriceData = await ethPriceRes.json();
                        ethPrice = ethPriceData.ethereum?.usd || ethPriceData.price || 0;
                      } else {
                        ethPrice = 2737;
                      }
                    } catch (error) {
                      console.error("Error fetching ETH price:", error);
                      ethPrice = 2737;
                    }
                    
                    // Calculate ETH value
                    const ethValue = ethBalance * ethPrice;
                    
                    // Fetch all token holdings using Alchemy API (same as main fetch)
                    try {
                      const holdingsRes = await fetch('/api/alchemy/wallet', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          address: walletAddress,
                          action: 'tokens'
                        })
                      });
                      
                      if (holdingsRes.ok) {
                        const holdingsData = await holdingsRes.json();
                        if (holdingsData.success && holdingsData.data?.tokenBalances) {
                          setAllTokenHoldings(holdingsData.data.tokenBalances);
                          
                          // Calculate total token holdings value (excluding ETH to avoid double counting)
                          let tokenHoldingsValue = holdingsData.data.tokenBalances.reduce((sum: number, token: any) => {
                            const isEth = token.contractAddress?.toLowerCase() === '0x4200000000000000000000000000000000000006' ||
                                          token.symbol === 'ETH' || token.symbol === 'WETH';
                            
                            if (isEth) {
                              return sum;
                            }
                            
                            return sum + (token.usdValue || 0);
                          }, 0);
                          
                          setTotalWalletValue(ethValue + tokenHoldingsValue);
                        } else {
                          setAllTokenHoldings([]);
                          setTotalWalletValue(ethValue);
                        }
                      } else {
                        // Fallback to positions if Alchemy fails
                        let tokenHoldingsValue = 0;
                        if (positionsData.positions && positionsData.positions.length > 0) {
                          const openPositions = positionsData.positions.filter((p: Position) => p.status === 'open');
                          tokenHoldingsValue = openPositions.reduce((sum: number, position: Position) => {
                            const amount = parseFloat(position.amount || "0");
                            const currentPrice = parseFloat(position.currentPrice || "0");
                            return sum + (amount * currentPrice);
                          }, 0);
                        }
                        setTotalWalletValue(ethValue + tokenHoldingsValue);
                      }
                    } catch (error) {
                      console.error("Error fetching token holdings:", error);
                      setAllTokenHoldings([]);
                      // Fallback to positions
                      let tokenHoldingsValue = 0;
                      if (positionsData.positions && positionsData.positions.length > 0) {
                        const openPositions = positionsData.positions.filter((p: Position) => p.status === 'open');
                        tokenHoldingsValue = openPositions.reduce((sum: number, position: Position) => {
                          const amount = parseFloat(position.amount || "0");
                          const currentPrice = parseFloat(position.currentPrice || "0");
                          return sum + (amount * currentPrice);
                        }, 0);
                      }
                      setTotalWalletValue(ethValue + tokenHoldingsValue);
                    }
                  }
                } catch (error) {
                  console.error("Error refreshing data:", error);
                } finally {
                  setLoadingState(false);
                }
              }}
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-800/80 hover:bg-gray-700/80 rounded-lg transition-colors text-[10px] sm:text-xs text-gray-200 border border-gray-700/50"
            >
              Refresh
            </button>
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="absolute top-20 right-4 z-50">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-700 border-t-gray-500"></div>
            </div>
          )}
          
              {/* Key Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2 mb-2 sm:mb-3 flex-shrink-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-900/80 border border-gray-600/50 rounded-lg p-2 sm:p-2.5"
                >
                  <div className="mb-1">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Total P&L</span>
                  </div>
                  <div className={`text-sm sm:text-base mb-0.5 ${(stats?.totalPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats?.totalPnL ? formatCurrency(stats.totalPnL) : "$0.00"}
                  </div>
                  <div className={`text-xs ${(stats?.totalPnLPercentage || 0) >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                    {stats?.totalPnLPercentage ? `${stats.totalPnLPercentage >= 0 ? '+' : ''}${stats.totalPnLPercentage.toFixed(2)}%` : '0.00%'}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gray-900/80 border border-gray-600/50 rounded-lg p-2 sm:p-2.5"
                >
                  <div className="mb-1">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Total Volume</span>
                  </div>
                  <div className="text-sm sm:text-base text-white mb-0.5">
                    {stats?.totalVolume ? formatCurrency(stats.totalVolume) : "$0.00"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {stats?.totalTrades || 0} trades
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gray-900/80 border border-gray-600/50 rounded-lg p-2 sm:p-2.5"
                >
                  <div className="mb-1">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Win Rate</span>
                  </div>
                  <div className="text-sm sm:text-base text-white mb-0.5">
                    {stats?.winRate ? `${stats.winRate.toFixed(1)}%` : "0%"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {stats?.completedTrades || 0} completed
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gray-900/80 border border-gray-600/50 rounded-lg p-2 sm:p-2.5"
                >
                  <div className="mb-1">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Open Positions</span>
                  </div>
                  <div className="text-sm sm:text-base text-white mb-0.5">
                    {positions.filter(p => p.status === 'open').length}
                  </div>
                  <div className="text-xs text-gray-400">
                    {positions.filter(p => p.status === 'closed').length} closed
                  </div>
                </motion.div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-0.5 sm:gap-1 mb-2 sm:mb-3 border-b border-gray-600/50 overflow-x-auto scrollbar-hide flex-shrink-0">
                {[
                  { id: "overview", label: "Overview" },
                  { id: "positions", label: "Positions" },
                  { id: "trades", label: "Trades" },
                  { id: "analytics", label: "Analytics" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-shrink-0 px-2 sm:px-3 lg:px-4 py-1.5 border-b-2 transition-all text-xs sm:text-sm ${
                      activeTab === tab.id
                        ? "border-blue-500 text-white"
                        : "border-transparent text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === "overview" && (
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 overflow-hidden pb-8 lg:pb-4">
                  {/* PnL Chart */}
                  <div className="bg-gray-900/80 border border-gray-600/50 rounded-lg p-2 sm:p-3 flex flex-col h-[240px] lg:h-[280px]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 flex-shrink-0">
                      <h3 className="text-xs sm:text-sm text-white">P&L Over Time</h3>
                      <div className="flex items-center gap-1">
                        {["7d", "30d", "90d", "all"].map((range) => (
                          <button
                            key={range}
                            onClick={() => setTimeRange(range as any)}
                            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded transition-colors ${
                              timeRange === range
                                ? "bg-blue-600 text-white"
                                : "bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300"
                            }`}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col">
                      {cumulativePnL.length > 0 ? (
                        <div className="flex-1 min-h-0 flex flex-col relative" style={{ paddingTop: '8px', paddingBottom: '32px' }}>
                          {/* Y-axis labels - Better positioned */}
                          <div className="absolute left-0 top-8 bottom-8 w-10 sm:w-12 flex flex-col justify-between text-[10px] sm:text-xs text-gray-400 pr-1 sm:pr-2 pointer-events-none z-0">
                            {(() => {
                              const maxPnL = Math.max(...cumulativePnL.map(i => i.cumulative), 0);
                              const minPnL = Math.min(...cumulativePnL.map(i => i.cumulative), 0);
                              const range = maxPnL - minPnL || 1;
                              
                              // Generate 5 evenly distributed labels from top to bottom
                              const labels = [];
                              for (let i = 0; i < 5; i++) {
                                const value = maxPnL - (range / 4 * i);
                                labels.push(value);
                              }
                              
                              return labels.map((value, i) => (
                                <div key={`y-label-${i}`} className="text-right">
                                  {formatCurrency(value)}
                                </div>
                              ));
                            })()}
                          </div>
                          
                          {/* Chart area with bars */}
                          <div className="flex-1 min-h-0 flex items-end justify-between gap-1 sm:gap-1.5 ml-10 sm:ml-12 relative">
                              {cumulativePnL.map((item, idx) => {
                                const maxPnL = Math.max(...cumulativePnL.map(i => i.cumulative), 0);
                                const minPnL = Math.min(...cumulativePnL.map(i => i.cumulative), 0);
                                const range = maxPnL - minPnL || 1;
                                const normalizedValue = (item.cumulative - minPnL) / range;
                                // Calculate bar height as percentage of available space
                                const height = Math.max(normalizedValue * 100, 5);
                                
                                // Format date for label
                                const date = new Date(item.date);
                                const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                
                                return (
                                  <div
                                    key={idx}
                                    className="flex-1 flex flex-col items-center justify-end group relative h-full"
                                  >
                                    {/* Bar */}
                                    <div
                                      className={`w-full rounded-t transition-all hover:opacity-90 cursor-pointer ${
                                        item.cumulative >= 0 
                                          ? "bg-green-500" 
                                          : "bg-red-500"
                                      }`}
                                      style={{ height: `${height}%`, minHeight: '4px' }}
                                      title={`${dateLabel}: ${item.cumulative >= 0 ? '+' : ''}${formatCurrency(item.cumulative)}`}
                                    />
                                    {/* Date label below bar */}
                                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">
                                      {dateLabel}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                          No data available
                        </div>
                      )}
                    </div>
                  </div>

                         {/* Portfolio Allocation */}
                         <div className="bg-gray-900/80 border border-gray-600/50 rounded-lg p-2 sm:p-3 flex flex-col h-[240px] lg:h-[280px]">
                           <h3 className="text-xs sm:text-sm text-white mb-2 flex-shrink-0">Portfolio Allocation</h3>
                           <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 scrollbar-thin lg:scrollbar-none">
                             {portfolioAllocation.length > 0 ? (
                               portfolioAllocation.slice(0, 8).map((item, idx) => {
                                 // Create a unique key that's guaranteed to be unique even if addresses duplicate
                                 const uniqueKey = `portfolio-${item.address?.toLowerCase() || `unknown-${idx}`}-${idx}`;
                                 return (
                                 <div key={uniqueKey} className="flex items-center gap-2">
                                   <div className="flex-1 min-w-0">
                                     <div className="flex items-center justify-between mb-1">
                                       <span className="text-sm text-white truncate" title={item.name || item.symbol || item.address}>
                                         {item.name || item.symbol || `${item.address?.slice(0, 6)}...${item.address?.slice(-4)}`}
                                       </span>
                                       <span className="text-sm text-gray-300 ml-2 flex-shrink-0">{item.percentage.toFixed(1)}%</span>
                                     </div>
                                     <div className="w-full bg-gray-800/50 rounded-full h-2 overflow-hidden">
                                       <div
                                         className="bg-gradient-to-r from-blue-500 via-blue-400 to-blue-300 h-full rounded-full transition-all"
                                         style={{ width: `${item.percentage}%` }}
                                       />
                                     </div>
                                   </div>
                                   <div className="text-sm text-white w-20 text-right">
                                     {formatCurrency(item.value)}
                                   </div>
                                 </div>
                                 );
                               })
                      ) : (
                        <div className="text-center text-gray-400 text-sm py-4">
                          No positions
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Trades */}
                  <div className="lg:col-span-2 bg-gray-900/80 border border-gray-600/50 rounded-lg p-2 sm:p-3 flex flex-col h-[250px] lg:h-[280px] mb-8 lg:mb-4">
                    <h3 className="text-xs sm:text-sm text-white mb-2 flex-shrink-0">Recent Trades</h3>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 scrollbar-thin lg:scrollbar-none">
                      {stats?.recentTrades && stats.recentTrades.length > 0 ? (
                        stats.recentTrades.slice(0, 8).map((trade) => (
                          <div
                            key={trade.id}
                            className="flex items-center justify-between p-2 bg-gray-800/50 hover:bg-gray-800/70 rounded transition-colors border border-gray-700/30"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-xs px-1 py-0.5 rounded ${
                                  trade.type === 'buy' 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {trade.type.toUpperCase()}
                                </span>
                                <span className="text-xs text-white truncate">{trade.tokenOut}</span>
                              </div>
                              <div className="text-xs text-gray-400">
                                {formatTimeAgo(trade.timestamp)}
                              </div>
                            </div>
                            <div className="text-right ml-2 flex-shrink-0">
                              <div className="text-xs text-white">
                                {parseFloat(trade.amountOut).toLocaleString()}
                              </div>
                              <div className={`text-xs mt-0.5 ${
                                trade.status === 'completed' 
                                  ? 'text-green-400/80' 
                                  : trade.status === 'pending'
                                  ? 'text-yellow-400/80'
                                  : 'text-red-400/80'
                              }`}>
                                {trade.status}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 text-xs py-4">
                          No trades
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "positions" && (() => {
                const totalPages = Math.ceil(positions.length / itemsPerPage);
                const startIndex = (positionsPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedPositions = positions.slice(startIndex, endIndex);
                
                return (
                  <div className="flex-1 min-h-0 bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden flex flex-col">
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                      <table className="w-full">
                        <thead className="bg-gray-700/20 border-b border-gray-700/50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Token</th>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide hidden sm:table-cell">Amount</th>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide hidden md:table-cell">Avg Price</th>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide hidden lg:table-cell">Current</th>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">P&L</th>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {positions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-4 text-gray-400 text-xs">
                                No positions found
                              </td>
                            </tr>
                          ) : (
                            paginatedPositions.map((position) => {
                              const pnlPct = position.pnlPercentage ?? 0;
                              const pnlColor = pnlPct >= 0 ? 'text-green-400' : 'text-red-400';
                              return (
                                <tr
                                  key={position.id}
                                  className="border-b border-gray-700/20 hover:bg-gray-700/10 cursor-pointer transition-colors"
                                  onClick={() => router.push(`/explore/${position.tokenAddress}/chart`)}
                                >
                                  <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-white text-xs sm:text-sm">{position.tokenSymbol}</td>
                                  <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-gray-300 text-xs sm:text-sm hidden sm:table-cell">
                                    {parseFloat(position.amount).toLocaleString()}
                                  </td>
                                  <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-gray-300 text-xs sm:text-sm hidden md:table-cell">
                                    ${parseFloat(position.avgPrice).toFixed(6)}
                                  </td>
                                  <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-gray-300 text-xs sm:text-sm hidden lg:table-cell">
                                    ${parseFloat(position.currentPrice || "0").toFixed(6)}
                                  </td>
                                  <td className={`py-2 px-2 sm:py-2.5 sm:px-3 text-xs sm:text-sm ${pnlColor}`}>
                                    {position.pnl || `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`}
                                  </td>
                                  <td className="py-2 px-2 sm:py-2.5 sm:px-3">
                                    <span
                                      className={`px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs ${
                                        position.status === 'open'
                                          ? 'bg-green-500/20 text-green-400'
                                          : 'bg-gray-500/20 text-gray-400'
                                      }`}
                                    >
                                      {position.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    {positions.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 sm:px-3 py-2 border-t border-gray-700/50 bg-gray-700/10 flex-shrink-0">
                        <div className="text-xs text-gray-400">
                          {positions.length > itemsPerPage ? (
                            <>Showing {startIndex + 1}-{Math.min(endIndex, positions.length)} of {positions.length}</>
                          ) : (
                            <>Showing {positions.length} {positions.length === 1 ? 'position' : 'positions'}</>
                          )}
                        </div>
                        {positions.length > itemsPerPage && (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <button
                              onClick={() => setPositionsPage(prev => Math.max(1, prev - 1))}
                              disabled={positionsPage === 1}
                              className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs text-white bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Prev
                            </button>
                            <span className="text-[10px] sm:text-xs text-gray-400">
                              {positionsPage}/{totalPages}
                            </span>
                            <button
                              onClick={() => setPositionsPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={positionsPage === totalPages}
                              className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs text-white bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {activeTab === "trades" && stats?.recentTrades && (() => {
                const totalPages = Math.ceil(stats.recentTrades.length / itemsPerPage);
                const startIndex = (tradesPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedTrades = stats.recentTrades.slice(startIndex, endIndex);
                
                return (
                  <div className="flex-1 min-h-0 bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden flex flex-col">
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                      <table className="w-full">
                        <thead className="bg-gray-700/20 border-b border-gray-700/50 sticky top-0 z-10">
                          <tr>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Time</th>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Type</th>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide hidden sm:table-cell">Token In</th>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Token Out</th>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide hidden md:table-cell">Amount</th>
                            <th className="text-left py-2 px-2 sm:py-2.5 sm:px-3 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentTrades.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-4 text-gray-400 text-xs">
                                No trades found
                              </td>
                            </tr>
                          ) : (
                            paginatedTrades.map((trade) => (
                              <tr
                                key={trade.id}
                                className="border-b border-gray-700/20 hover:bg-gray-700/10 transition-colors"
                              >
                                <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-gray-300 text-xs sm:text-sm">
                                  {formatTimeAgo(trade.timestamp)}
                                </td>
                                <td className="py-2 px-2 sm:py-2.5 sm:px-3">
                                  <span
                                    className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded ${
                                      trade.type === 'buy' 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : 'bg-red-500/20 text-red-400'
                                    }`}
                                  >
                                    {trade.type.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-gray-300 text-xs sm:text-sm hidden sm:table-cell">{trade.tokenIn}</td>
                                <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-gray-300 text-xs sm:text-sm">{trade.tokenOut}</td>
                                <td className="py-2 px-2 sm:py-2.5 sm:px-3 text-gray-300 text-xs sm:text-sm hidden md:table-cell">
                                  {parseFloat(trade.amountOut).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-xs ${
                                      trade.status === 'completed'
                                        ? 'bg-green-500/20 text-green-400'
                                        : trade.status === 'pending'
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : 'bg-red-500/20 text-red-400'
                                    }`}
                                  >
                                    {trade.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {stats.recentTrades.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 sm:px-3 py-2 border-t border-gray-700/50 bg-gray-700/10 flex-shrink-0">
                        <div className="text-[10px] sm:text-xs text-gray-400">
                          {stats.recentTrades.length > itemsPerPage ? (
                            <>Showing {startIndex + 1}-{Math.min(endIndex, stats.recentTrades.length)} of {stats.recentTrades.length}</>
                          ) : (
                            <>Showing {stats.recentTrades.length} {stats.recentTrades.length === 1 ? 'trade' : 'trades'}</>
                          )}
                        </div>
                        {stats.recentTrades.length > itemsPerPage && (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <button
                              onClick={() => setTradesPage(prev => Math.max(1, prev - 1))}
                              disabled={tradesPage === 1}
                              className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs text-white bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Prev
                            </button>
                            <span className="text-[10px] sm:text-xs text-gray-400">
                              {tradesPage}/{totalPages}
                            </span>
                            <button
                              onClick={() => setTradesPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={tradesPage === totalPages}
                              className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs text-white bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {activeTab === "analytics" && (
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 overflow-hidden">
                  {/* Trading Statistics */}
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 sm:p-3 flex flex-col overflow-hidden">
                    <h3 className="text-xs sm:text-sm text-white mb-2 flex-shrink-0">Trading Statistics</h3>
                    <div className="space-y-0">
                      <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
                        <span className="text-sm text-gray-400">Total Trades</span>
                        <span className="text-white text-sm">{stats?.totalTrades || 0}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
                        <span className="text-sm text-gray-400">Completed Trades</span>
                        <span className="text-white text-sm">{stats?.completedTrades || 0}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
                        <span className="text-sm text-gray-400">Positions Closed</span>
                        <span className="text-white text-sm">{stats?.positionsClosed || 0}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
                        <span className="text-sm text-gray-400">Total Bought</span>
                        <span className="text-green-400 text-sm">
                          {stats?.bought ? formatCurrency(stats.bought) : "$0.00"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
                        <span className="text-sm text-gray-400">Total Sold</span>
                        <span className="text-red-400 text-sm">
                          {stats?.sold ? formatCurrency(stats.sold) : "$0.00"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-400">Current Holdings</span>
                        <span className="text-white text-sm">
                          {(() => {
                            // Use stats.holding which is calculated from buy/sell amounts * current prices
                            // This ensures consistency with Total Bought and Total Sold
                            if (stats?.holding !== undefined && stats.holding >= 0) {
                              return formatCurrency(stats.holding);
                            }
                            // Fallback to totalWalletValue if stats.holding is not available
                            return formatCurrency(totalWalletValue);
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 sm:p-3 flex flex-col overflow-hidden">
                    <h3 className="text-xs sm:text-sm text-white mb-2 flex-shrink-0">Performance Metrics</h3>
                    <div className="space-y-0">
                      <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
                        <span className="text-sm text-gray-400">Win Rate</span>
                        <span className="text-white text-sm">
                          {stats?.winRate ? `${stats.winRate.toFixed(1)}%` : "0%"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
                        <span className="text-sm text-gray-400">Total P&L</span>
                        <span
                          className={`text-sm ${
                            (stats?.totalPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {stats?.totalPnL ? formatCurrency(stats.totalPnL) : "$0.00"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
                        <span className="text-sm text-gray-400">P&L Percentage</span>
                        <span
                          className={`text-sm ${
                            (stats?.totalPnLPercentage || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {stats?.totalPnLPercentage
                            ? `${stats.totalPnLPercentage >= 0 ? '+' : ''}${stats.totalPnLPercentage.toFixed(2)}%`
                            : '0.00%'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-400">Average Trade Size</span>
                        <span className="text-white text-sm">
                          {stats?.totalTrades && stats.totalTrades > 0
                            ? formatCurrency((stats.totalVolume || 0) / stats.totalTrades)
                            : "$0.00"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
        </div>
      </main>
    </div>
  );
}

