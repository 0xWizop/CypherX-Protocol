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

  return (
    <button
      onClick={onToggleDropdown}
      data-wallet-display
      className="flex items-center justify-center h-8 px-2.5 sm:px-3 sm:py-1.5 sm:space-x-2 rounded-lg sm:rounded-xl bg-[#111827] border border-gray-700/60 sm:border-gray-600 hover:bg-[#1f2937] hover:border-gray-500 transition-all duration-200"
    >
      {/* Wallet Icon - Hidden on Mobile */}
      <FaWallet className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
      
      {/* Separator - Hidden on Mobile */}
      <div className="w-px h-4 bg-gray-600 hidden sm:block"></div>
      
      {/* ETH Balance Display - Hidden on Mobile */}
      <div className="hidden sm:flex flex-col items-start">
        <span className="text-white text-sm font-semibold">
          {parseFloat(ethBalance).toFixed(4)} ETH
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
