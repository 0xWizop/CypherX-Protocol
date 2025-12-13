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
  const [usdBalance, setUsdBalance] = useState<string>("");
  const walletLoadedRef = useRef(false);



  // Fetch wallet balance and total portfolio value
  const fetchBalance = useCallback(async (address: string) => {
    try {
      console.log(`🔍 Fetching balance for: ${address}`);
      
      // Fetch ETH balance and token balances in parallel
      const [balanceResponse, tokensResponse] = await Promise.all([
        fetch(`/api/wallet/balance?address=${address}`),
        fetch('/api/alchemy/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            action: 'tokens'
          })
        })
      ]);

      if (!balanceResponse.ok) {
        throw new Error(`HTTP ${balanceResponse.status}: ${balanceResponse.statusText}`);
      }

      const balanceData = await balanceResponse.json();
      
      if (balanceData.success) {
        console.log(`✅ Balance fetched: ${balanceData.ethBalance} ETH`);
        setEthBalance(balanceData.ethBalance);
        
        // Fetch ETH price and calculate total portfolio value
        try {
          const priceResponse = await fetch('/api/price/eth');
          const priceData = await priceResponse.json();
          const ethPrice = priceData.ethereum?.usd || 0;
          const ethUsdValue = parseFloat(balanceData.ethBalance) * ethPrice;
          
          // Calculate total token USD value
          let totalTokenValue = 0;
          if (tokensResponse.ok) {
            const tokensData = await tokensResponse.json();
            if (tokensData.success && tokensData.data?.tokenBalances) {
              totalTokenValue = tokensData.data.tokenBalances.reduce((sum: number, token: any) => {
                return sum + (token.usdValue || 0);
              }, 0);
            }
          }
          
          // Total portfolio value = ETH value + all token values
          const totalPortfolioValue = ethUsdValue + totalTokenValue;
          setUsdBalance(totalPortfolioValue.toFixed(2));
        } catch (priceError) {
          console.error("Error fetching ETH price:", priceError);
          setUsdBalance("0.00");
        }
        
        // Update global context with the fetched balance
        console.log("🔍 WalletDisplay - Updating global context with fetched balance:", balanceData.ethBalance);
        setSelfCustodialWallet({
          address: address,
          isConnected: true,
          ethBalance: balanceData.ethBalance,
          tokenBalance: balanceData.tokenBalance || ""
        });
      } else {
        throw new Error(balanceData.error || 'Failed to fetch balance');
      }
      
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }, [setSelfCustodialWallet]);

  // Load wallet from localStorage on component mount
  useEffect(() => {
    if (walletLoadedRef.current) return;
    
    const loadWallet = () => {
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
        }
        
        // Set loading to false regardless of whether wallet was found
        setWalletLoading(false);
        walletLoadedRef.current = true;
      }
    };

    loadWallet();
  }, []);



  // Refresh balance periodically
  useEffect(() => {
    if (walletData?.address) {
      const interval = setInterval(() => {
        fetchBalance(walletData.address);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [walletData?.address, fetchBalance]);

  if (!walletData) {
    return (
      <button
        onClick={onToggleDropdown}
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

  return (
    <button
      onClick={onToggleDropdown}
      className="flex items-center justify-center h-8 sm:h-auto px-2.5 sm:px-3 sm:py-2 sm:space-x-2 rounded-lg sm:rounded-xl bg-gray-900/40 hover:bg-gray-900/60 transition-all duration-200"
    >
      {/* Wallet Icon - Hidden on Mobile */}
      <FaWallet className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
      
      {/* Separator - Hidden on Mobile */}
      <div className="w-px h-4 bg-gray-600 hidden sm:block"></div>
      
      {/* USD Balance Display - Hidden on Mobile */}
      <div className="hidden sm:flex flex-col items-start">
        <span className="text-white text-sm font-semibold">
          ${usdBalance || "0.00"}
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
