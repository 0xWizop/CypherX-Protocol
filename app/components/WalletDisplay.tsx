"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaWallet, FaChevronDown } from "react-icons/fa";
import { useWalletSystem } from "@/app/providers";

interface WalletDisplayProps {
  onToggleDropdown: () => void;
  isDropdownOpen: boolean;
}

interface WalletData {
  address: string;
  privateKey: string;
  createdAt: number;
}

const WalletDisplay: React.FC<WalletDisplayProps> = ({
  onToggleDropdown,
  isDropdownOpen
}) => {
  const { setSelfCustodialWallet, setWalletLoading } = useWalletSystem();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [ethBalance, setEthBalance] = useState<string>("");
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(0);
  const walletLoadedRef = useRef(false);



  // Fetch wallet balance
  const fetchBalance = useCallback(async (address: string) => {
    try {
      console.log(`🔍 Fetching balance for: ${address}`);
      
      const response = await fetch(`/api/wallet/balance?address=${address}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Balance fetched: ${data.ethBalance} ETH`);
        setEthBalance(data.ethBalance);
        
        // Update global context with the fetched balance
        console.log("🔍 WalletDisplay - Updating global context with fetched balance:", data.ethBalance);
        setSelfCustodialWallet({
          address: address,
          isConnected: true,
          ethBalance: data.ethBalance,
          tokenBalance: data.tokenBalance || ""
        });
      } else {
        throw new Error(data.error || 'Failed to fetch balance');
      }
      
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }, [setSelfCustodialWallet]);

  // Load wallet from localStorage
  const loadWallet = useCallback(() => {
      if (typeof window !== "undefined") {
        const storedWallet = localStorage.getItem("cypherx_wallet");
        if (storedWallet) {
          try {
            const data = JSON.parse(storedWallet);
            console.log("🔍 WalletDisplay - Loading wallet from localStorage:", data.address);
            setWalletData(data);
            
            // Update global context so other components can access the wallet
            console.log("🔍 WalletDisplay - Updating global context with wallet:", data.address);
            setSelfCustodialWallet({
              address: data.address,
              isConnected: true,
              ethBalance: "",
              tokenBalance: ""
            });
            
            fetchBalance(data.address);
          } catch (error) {
            console.error("Error loading wallet:", error);
          }
        } else {
          console.log("🔍 WalletDisplay - No wallet found in localStorage");
        setWalletData(null);
        setSelfCustodialWallet(null);
        }
        
        // Set loading to false regardless of whether wallet was found
        setWalletLoading(false);
    }
  }, [fetchBalance, setSelfCustodialWallet, setWalletLoading]);

  // Load wallet on component mount
  useEffect(() => {
    if (walletLoadedRef.current) return;
    loadWallet();
        walletLoadedRef.current = true;
  }, [loadWallet]);

  // Listen for wallet updates from WalletDropdown
  useEffect(() => {
    const handleWalletUpdate = () => {
      console.log("🔍 WalletDisplay - Received wallet-updated event, reloading wallet...");
      loadWallet();
    };

    const handleWalletConnected = (event: CustomEvent) => {
      console.log("🔍 WalletDisplay - Received wallet-connected event:", event.detail);
    loadWallet();
    };

    window.addEventListener("wallet-updated", handleWalletUpdate);
    window.addEventListener("wallet-connected", handleWalletConnected as EventListener);

    return () => {
      window.removeEventListener("wallet-updated", handleWalletUpdate);
      window.removeEventListener("wallet-connected", handleWalletConnected as EventListener);
    };
  }, [loadWallet]);



  // Fetch ETH price
  const fetchEthPrice = useCallback(async () => {
    try {
      const response = await fetch('/api/price/eth');
      if (response.ok) {
        const data = await response.json();
        const price = data.ethereum?.usd || 0;
        setEthPrice(price);
        return price;
      }
    } catch (error) {
      console.error("Error fetching ETH price:", error);
    }
    return 0;
  }, []);

  // Fetch total portfolio value (ETH + all tokens) - same method as WalletDropdown
  const fetchPortfolioValue = useCallback(async (address: string) => {
    try {
      // Use the same API endpoint as WalletDropdown
      const response = await fetch('/api/alchemy/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address,
          action: 'tokens'
        })
      });
      
      if (!response.ok) return;

      const data = await response.json();
      
      if (data.success && data.data && data.data.tokenBalances) {
        // Calculate total from token holdings (same as WalletDropdown)
        const visibleTokensValue = data.data.tokenBalances
          .reduce((sum: number, token: any) => sum + (token.usdValue || 0), 0);
        
        // Get ETH value
        const ethBal = parseFloat(ethBalance || "0");
        const ethValue = ethPrice > 0 ? ethBal * ethPrice : 0;
        
        // Total portfolio value (same calculation as WalletDropdown)
        const totalValue = ethValue + visibleTokensValue;
        setTotalPortfolioValue(totalValue);
      }
    } catch (error) {
      console.error("Error fetching portfolio value:", error);
    }
  }, [ethBalance, ethPrice]);

  // Fetch ETH price on mount and periodically
  useEffect(() => {
    fetchEthPrice();
    const priceInterval = setInterval(fetchEthPrice, 60000); // Refresh every minute
    return () => clearInterval(priceInterval);
  }, [fetchEthPrice]);

  // Fetch portfolio value immediately when wallet data, balance, or price changes
  useEffect(() => {
    if (walletData?.address && ethBalance && ethPrice > 0) {
      // Load immediately on mount/change
      fetchPortfolioValue(walletData.address);
    }
  }, [walletData?.address, ethBalance, ethPrice, fetchPortfolioValue]);

  // Refresh balance and portfolio value periodically
  useEffect(() => {
    if (walletData?.address) {
      const interval = setInterval(() => {
        fetchBalance(walletData.address);
        if (ethPrice > 0) {
          fetchPortfolioValue(walletData.address);
        }
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [walletData?.address, ethBalance, ethPrice, fetchBalance, fetchPortfolioValue]);

  if (!walletData) {
    return (
      <button
        onClick={onToggleDropdown}
        data-wallet-display
        className="h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors duration-200 flex items-center justify-center"
      >
        Connect
      </button>
    );
  }

  // Format wallet address for display (mobile)
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Format USD value with proper decimal layouting
  const formatUSDValue = (value: number): string => {
    if (!value || value === 0) return '$0.00';
    
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    } else if (value >= 1) {
      return `$${value.toFixed(2)}`;
    } else if (value >= 0.01) {
      return `$${value.toFixed(4)}`;
    } else {
      return `$${value.toFixed(6)}`;
    }
  };

  return (
    <button
      onClick={onToggleDropdown}
      data-wallet-display
      className="flex items-center justify-center h-8 px-2.5 sm:px-3 sm:py-1.5 sm:space-x-2 rounded-lg sm:rounded-xl bg-[#111827] hover:bg-[#1f2937] transition-all duration-200"
    >
      {/* Wallet Icon - Hidden on Mobile */}
      <FaWallet className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
      
      {/* Separator - Hidden on Mobile */}
      <div className="w-px h-4 bg-gray-600 hidden sm:block"></div>
      
      {/* Total Portfolio Value Display - Hidden on Mobile */}
      <div className="hidden sm:flex flex-col items-start">
        <span className="text-white text-sm font-semibold">
          {formatUSDValue(totalPortfolioValue)}
        </span>
      </div>
      
      {/* Mobile: Simple Address Display */}
      <span className="sm:hidden text-white text-xs font-medium">
        {formatAddress(walletData.address)}
      </span>
      
      {/* Dropdown Arrow - Hidden on Mobile */}
      <FaChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''} hidden sm:block`} />
    </button>
  );
};

export default WalletDisplay;
