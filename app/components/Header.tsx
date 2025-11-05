"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth, useLoginModal, useWalletSystem } from "@/app/providers";
import { useFavorites } from "@/app/hooks/useFavorites";
import { useWatchlists } from "@/app/hooks/useWatchlists";

import WalletDropdown from "./WalletDropdown";
import WalletDisplay from "./WalletDisplay";
import TierProgressionModal from "./TierProgressionModal";
import GlobalSearch from "./GlobalSearch";
import UserProfileDropdown from "./UserProfileDropdown";

import { motion, AnimatePresence } from "framer-motion";
import { FiBarChart, FiMenu, FiX, FiStar, FiTrash2, FiUser, FiSettings, FiCheck, FiAlertCircle } from "react-icons/fi";
import { createPortal } from "react-dom";
import Image from "next/image";

// Favorite Token Item Component
const FavoriteTokenItem = ({ poolAddress, onRemove }: { poolAddress: string; onRemove: () => void }) => {
  const [tokenData, setTokenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${poolAddress}`);
        const data = await response.json();
        setTokenData(data.pair);
      } catch (error) {
        console.error('Error fetching token data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [poolAddress]);

  if (loading) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700/50 rounded-full animate-pulse"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-700/50 rounded w-20 animate-pulse"></div>
            <div className="h-3 bg-gray-700/50 rounded w-16 animate-pulse"></div>
            <div className="h-3 bg-gray-700/50 rounded w-12 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700/50 rounded-full"></div>
          <div className="text-gray-400 text-sm">
            {poolAddress.slice(0, 8)}...{poolAddress.slice(-6)}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const priceChange = tokenData.priceChange?.h24 || 0;
  const priceChangeColor = priceChange >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30 rounded-xl hover:bg-gray-800/70 transition-all duration-200">
      <div className="flex items-center space-x-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
          {tokenData.info?.imageUrl && (
            <img src={tokenData.info.imageUrl} alt={tokenData.baseToken?.symbol || 'Token'} className="w-full h-full object-cover" />
          )}
          {!tokenData.info?.imageUrl && tokenData.baseToken?.symbol && (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20"></div>
          )}
          {!tokenData.info?.imageUrl && tokenData.baseToken?.symbol ? (
            <span className="text-xs font-bold text-gray-100 relative z-10">
              {tokenData.baseToken.symbol.slice(0, 2)}
            </span>
          ) : !tokenData.info?.imageUrl && (
            <span className="text-xs font-bold text-gray-400">??</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-100 truncate">
            {tokenData.baseToken?.symbol || 'Unknown'}
          </div>
          <div className="text-xs text-gray-400">
            ${parseFloat(tokenData.priceUsd || '0').toFixed(6)}
          </div>
          {tokenData.marketCap && (
            <div className="text-xs text-gray-500">
              ${(tokenData.marketCap / 1000000).toFixed(2)}M
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <div className="text-right">
          <span className={`text-sm font-medium ${priceChangeColor}`}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
          </span>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const Header: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();
  const { watchlists, removeFromWatchlist } = useWatchlists();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('normie');
  const [showTierModal, setShowTierModal] = useState(false);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [showWatchlistsModal, setShowWatchlistsModal] = useState(false);
  const [expandedWatchlist, setExpandedWatchlist] = useState<string | null>(null);
  const [expandedFavorites, setExpandedFavorites] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { setShowLoginModal, setRedirectTo } = useLoginModal();


  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Fetch user stats from API
  useEffect(() => {
    const fetchUserStats = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setPoints(userData.points || 0);
            setTier(userData.tier || 'normie');
          }
        } catch (error) {
          console.error("Error fetching user stats:", error);
        }
      }
    };

    fetchUserStats();
  }, [user]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      
      
      const target = event.target as Node;
      const isWalletDropdownOpen = showWalletDropdown;
      const isClickInWalletButton = walletDropdownRef.current?.contains(target);
      const isClickInWalletDropdown = document.querySelector('[data-wallet-dropdown]')?.contains(target);
      
      if (isWalletDropdownOpen && !isClickInWalletButton && !isClickInWalletDropdown) {
        setShowWalletDropdown(false);
      }

      // Check if click is outside mobile menu AND not on the mobile menu button
      const isClickInMobileMenuButton = (event.target as Element)?.closest('[data-mobile-menu-button]');
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node) && !isClickInMobileMenuButton) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showWalletDropdown]);

  // Close mobile menu on route change
  useEffect(() => {
    const handleRouteChange = () => {
      setIsMenuOpen(false);
      
      setShowWalletDropdown(false);
    };

    handleRouteChange();
  }, [pathname]);

  return (
    <>
             <header className="bg-gray-950 border-b border-gray-800/20 sticky top-0 z-50">
        <div className="w-full">
                     <div className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
             {/* Left Side - Logo & Navigation */}
             <div className="flex items-center space-x-8">
               {/* Logo */}
               <div className="flex-shrink-0">
                 <Link href="/" className="flex items-center group">
                   <motion.div
                     whileHover={{ scale: 1.05 }}
                     transition={{ duration: 0.2 }}
                   >
                     <span className="text-lg sm:text-xl font-cypherx-gradient">
                       CYPHERX
                     </span>
                   </motion.div>
                 </Link>
               </div>

                               {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center space-x-8">
                 <Link
                   href="/explore"
                   className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                   prefetch={true}
                 >
                   <span className="relative">
                     Trade
                     <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                   </span>
                 </Link>

                 <Link
                   href="/radar"
                   className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                   prefetch={true}
                 >
                   <span className="relative">
                     Radar
                     <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                   </span>
                 </Link>

                                   <Link
                    href="/events"
                    className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                    prefetch={true}
                  >
                    <span className="relative">
                      Events
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                    </span>
                  </Link>

                  <Link
                    href="/rewards"
                    className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                    prefetch={true}
                  >
                    <span className="relative">
                      <span>Rewards</span>
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                    </span>
                  </Link>


                 <Link
                   href="/insights"
                   className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                   prefetch={true}
                 >
                   <span className="relative">
                     Insights
                     <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                   </span>
                 </Link>

                 <Link
                   href="/explorer"
                   className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                   prefetch={true}
                 >
                   <span className="relative">
                     Explorer
                     <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                   </span>
                 </Link>




               </nav>
             </div>

                           {/* Right Side - Search, Button, Wallet & Profile */}
              <div className="flex items-center space-x-4">
                {/* Global Search */}
                <div className="hidden lg:flex items-center">
                  <GlobalSearch 
                    placeholder="Search by token or CA..."
                    variant="header"
                  />
                </div>

                {/* Action Buttons */}
                <div className="hidden lg:flex items-center space-x-2">
                  <motion.button
                    className="relative flex items-center justify-center w-8 h-8 bg-gray-950/50 backdrop-blur-sm hover:bg-gray-900/50 text-white hover:text-blue-400 rounded-lg transition-all duration-200 border border-gray-600 hover:border-gray-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Watchlist"
                    onClick={() => setShowWatchlistsModal(true)}
                  >
                    <FiStar className="w-3.5 h-3.5" />
                    {(favorites.length > 0 || watchlists.length > 0) && (
                      <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold leading-none">
                        {favorites.length + watchlists.length > 9 ? '9+' : favorites.length + watchlists.length}
                      </span>
                    )}
                  </motion.button>
                  
                  <motion.button
                    className="flex items-center justify-center w-8 h-8 bg-gray-950/50 backdrop-blur-sm hover:bg-gray-900/50 text-white hover:text-blue-400 rounded-lg transition-all duration-200 border border-gray-600 hover:border-gray-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Settings"
                    onClick={() => setShowSettingsModal(true)}
                  >
                    <FiSettings className="w-3.5 h-3.5" />
                  </motion.button>
                </div>

                {/* Wallet Display & Dropdown */}
                <div className="relative" ref={walletDropdownRef}>
                  <WalletDisplay
                    onToggleDropdown={() => setShowWalletDropdown(!showWalletDropdown)}
                    isDropdownOpen={showWalletDropdown}
                  />
                </div>
               
               {/* Profile Button or Login Button - Hidden on mobile */}
               <div className="relative hidden lg:block">
                 {user ? (
                   <UserProfileDropdown />
                 ) : (
                   <button
                     onClick={() => {
                       setRedirectTo(pathname);
                       setShowLoginModal(true);
                     }}
                     className="w-8 h-8 rounded-full bg-gray-950/50 backdrop-blur-sm border border-gray-600 flex items-center justify-center hover:bg-gray-900/50 hover:border-gray-500 transition-all duration-200"
                   >
                     <FiUser className="w-5 h-5 text-gray-300" />
                   </button>
                 )}
               </div>

               {/* Mobile Menu Button */}
               <motion.button
                 data-mobile-menu-button
                 onClick={() => setIsMenuOpen(!isMenuOpen)}
                 className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200"
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
               >
                 <AnimatePresence mode="wait">
                   {isMenuOpen ? (
                     <motion.div
                       key="close"
                       initial={{ rotate: -90, opacity: 0 }}
                       animate={{ rotate: 0, opacity: 1 }}
                       exit={{ rotate: 90, opacity: 0 }}
                       transition={{ duration: 0.2 }}
                     >
                       <FiX className="w-5 h-5 text-gray-300" />
                     </motion.div>
                   ) : (
                     <motion.div
                       key="menu"
                       initial={{ rotate: 90, opacity: 0 }}
                       animate={{ rotate: 0, opacity: 1 }}
                       exit={{ rotate: -90, opacity: 0 }}
                       transition={{ duration: 0.2 }}
                     >
                       <FiMenu className="w-5 h-5 text-gray-300" />
                     </motion.div>
                   )}
                 </AnimatePresence>
               </motion.button>
             </div>
           </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                ref={mobileMenuRef}
                                 className="xl:hidden border-t border-gray-800/20 bg-gray-950"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div className="px-4 py-4 space-y-4">
                  {/* Mobile Search */}
                  <div className="mb-4">
                    <GlobalSearch 
                      placeholder="Search tokens, addresses, transactions..."
                      variant="header"
                    />
                  </div>

                  {/* Mobile Navigation Links */}
                  <div className="space-y-1">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Link href="/explore" className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group" prefetch={true}>
                        <span className="text-gray-200 text-sm font-medium">Trade</span>
                      </Link>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <Link href="/radar" className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group" prefetch={true}>
                        <span className="text-gray-200 text-sm font-medium">Radar</span>
                      </Link>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                                          <Link href="/events" className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group" prefetch={true}>
                      <span className="text-gray-200 text-sm font-medium">Events</span>
                    </Link>
                    
                    <Link href="/rewards" className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group" prefetch={true}>
                      <span className="text-gray-200 text-sm font-medium">Rewards</span>
                    </Link>
                    </motion.div>
                    
                    {/* Mobile Login Button */}
                    {!user && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 }}
                      >
                        <button
                          onClick={() => {
                            setRedirectTo(pathname);
                            setShowLoginModal(true);
                            setIsMenuOpen(false);
                          }}
                          className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group w-full text-left"
                        >
                          <FiUser className="w-4 h-4 text-gray-400 group-hover:text-blue-400" />
                          <span className="text-gray-200 text-sm font-medium">Login</span>
                        </button>
                      </motion.div>
                    )}
                    
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      <Link href="/insights" className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group" prefetch={true}>
                        <span className="text-gray-200 text-sm font-medium">Insights</span>
                      </Link>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Link href="/explorer" className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group" prefetch={true}>
                        <span className="text-gray-200 text-sm font-medium">Explorer</span>
                      </Link>
                    </motion.div>
                  </div>

                  {/* Mobile Favorites & Watchlist */}
                  <div className="space-y-1">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 }}
                    >
                      <button 
                        onClick={() => setShowWatchlistsModal(true)}
                        className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group"
                      >
                        <div className="flex items-center space-x-2">
                          <FiStar className="w-4 h-4 text-yellow-400" />
                          <span className="text-gray-200 text-sm font-medium">My Watchlists</span>
                        </div>
                        {(favorites.length > 0 || watchlists.length > 0) && (
                          <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 font-bold">
                            {favorites.length + watchlists.length > 9 ? '9+' : favorites.length + watchlists.length}
                          </span>
                        )}
                      </button>
                    </motion.div>
                  </div>

                  {/* Mobile Dropdowns */}
                  <div className="space-y-2">

                    
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
    
      {/* Tier Progression Modal */}
      <TierProgressionModal
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
        currentTier={tier}
        currentPoints={points || 0}
      />
    
      {/* Watchlists Modal */}
      <AnimatePresence>
        {showWatchlistsModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWatchlistsModal(false)}
          >
            <motion.div
              className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-none p-6 w-full max-w-md shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-100">
                  My Watchlists
                </h3>
                <button
                  onClick={() => setShowWatchlistsModal(false)}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {/* Default Watchlist (Favorites) */}
                <div className="bg-gray-800/50 rounded-none p-3 border border-gray-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-200">
                      Favorites
                    </h4>
                    <span className="text-xs text-gray-400">{favorites.length} tokens</span>
                  </div>
                  {favorites.length === 0 ? (
                    <div className="text-gray-400 text-xs">
                      No tokens in your favorites yet. Click the star icon on any token to add it.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {expandedFavorites ? (
                        favorites.map((poolAddress) => (
                          <FavoriteTokenItem 
                            key={poolAddress} 
                            poolAddress={poolAddress} 
                            onRemove={() => toggleFavorite(poolAddress)}
                          />
                        ))
                      ) : (
                        <>
                          {favorites.slice(0, 3).map((poolAddress) => (
                            <FavoriteTokenItem 
                              key={poolAddress} 
                              poolAddress={poolAddress} 
                              onRemove={() => toggleFavorite(poolAddress)}
                            />
                          ))}
                          {favorites.length > 3 && (
                            <button
                              onClick={() => setExpandedFavorites(true)}
                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                            >
                              +{favorites.length - 3} more tokens
                            </button>
                          )}
                        </>
                      )}
                      {expandedFavorites && favorites.length > 3 && (
                        <button
                          onClick={() => setExpandedFavorites(false)}
                          className="text-xs text-gray-400 hover:text-gray-300 transition-colors cursor-pointer"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Custom Watchlists */}
                {watchlists.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-300 border-t border-gray-700/30 pt-3">Custom Watchlists</h4>
                    {watchlists.map((watchlist) => (
                      <div key={watchlist.id} className="bg-gray-800/50 rounded-none p-3 border border-gray-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <button
                            onClick={() => setExpandedWatchlist(expandedWatchlist === watchlist.id ? null : watchlist.id)}
                            className="text-sm font-medium text-gray-200 hover:text-white transition-colors cursor-pointer"
                          >
                            {watchlist.name}
                          </button>
                          <span className="text-xs text-gray-400">{watchlist.tokens.length} tokens</span>
                        </div>
                        <div className="space-y-2">
                          {expandedWatchlist === watchlist.id ? (
                            <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                              {watchlist.tokens.map((poolAddress) => (
                                <div key={poolAddress} className="flex items-center justify-between text-xs py-1">
                                  <span className="text-gray-300 truncate">{poolAddress.slice(0, 8)}...{poolAddress.slice(-6)}</span>
                                  <button
                                    onClick={() => removeFromWatchlist(watchlist.id, poolAddress)}
                                    className="text-gray-400 hover:text-red-400 transition-colors"
                                  >
                                    <FiTrash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              {watchlist.tokens.slice(0, 3).map((poolAddress) => (
                                <div key={poolAddress} className="flex items-center justify-between text-xs">
                                  <span className="text-gray-300 truncate">{poolAddress.slice(0, 8)}...{poolAddress.slice(-6)}</span>
                                  <button
                                    onClick={() => removeFromWatchlist(watchlist.id, poolAddress)}
                                    className="text-gray-400 hover:text-red-400 transition-colors"
                                  >
                                    <FiTrash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {watchlist.tokens.length > 3 && (
                                <button
                                  onClick={() => setExpandedWatchlist(watchlist.id)}
                                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                                >
                                  +{watchlist.tokens.length - 3} more tokens
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    
      {/* Wallet Dropdown */}
      <WalletDropdown
        isOpen={showWalletDropdown}
        onClose={() => setShowWalletDropdown(false)}
        walletSystem="self-custodial"
      />

      {/* Settings Modal */}
      {showSettingsModal && createPortal(
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      , document.body
      )}

    </>
  );
};

// Settings Modal Component
const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
  const walletAddress = selfCustodialWallet?.address;
  const [profilePicture, setProfilePicture] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    trading: true,
    news: false
  });
  const [privacy, setPrivacy] = useState({
    showProfile: true,
    showTrades: true,
    showBalance: false
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch user profile data
  useEffect(() => {
    if (user || walletAddress) {
      const fetchProfile = async () => {
        try {
          const documentId = walletAddress || user?.uid;
          if (!documentId) return;
          
          const userDocRef = doc(db, "users", documentId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setProfilePicture(userData.profilePicture || userData.photoURL || "");
            setDisplayName(userData.displayName || "");
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      };
      fetchProfile();
    }
  }, [user, walletAddress]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isOpen && modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setUploadStatus('error');
      setUploadMessage('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadStatus('error');
      setUploadMessage('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    setUploadStatus('idle');

    try {
      const storageRef = ref(storage, `users/${user.uid}/profile/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setProfilePicture(downloadURL);

      const documentId = user.uid;
      await updateDoc(doc(db, "users", documentId), {
        profilePicture: downloadURL,
        photoURL: downloadURL,
        updatedAt: new Date(),
      });

      setUploadStatus('success');
      setUploadMessage('Profile picture updated!');
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadMessage('');
      }, 3000);
    } catch (error) {
      console.error("Error uploading image:", error);
      setUploadStatus('error');
      setUploadMessage('Failed to upload image');
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadMessage('');
      }, 5000);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    
    setSavingSettings(true);
    setSettingsStatus('idle');
    
    try {
      const documentId = user.uid;
      await updateDoc(doc(db, "users", documentId), {
        displayName: displayName.trim(),
        updatedAt: new Date(),
      });
      
      setSettingsStatus('success');
      setSettingsMessage('Settings saved successfully!');
      setTimeout(() => {
        setSettingsStatus('idle');
        setSettingsMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSettingsStatus('error');
      setSettingsMessage('Failed to save settings');
      setTimeout(() => {
        setSettingsStatus('idle');
        setSettingsMessage('');
      }, 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          ref={modalRef}
          className="bg-gray-900 rounded-xl w-full max-w-[500px] flex flex-col border border-gray-700 max-h-[85vh]"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-white text-xl font-semibold">Account Settings</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Profile Section */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <h4 className="text-white font-medium mb-2">Profile Information</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-700 border-2 border-gray-600">
                      {profilePicture ? (
                        <Image
                          src={profilePicture}
                          alt="Profile"
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FiUser className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full flex items-center justify-center transition-colors"
                    >
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                      ) : (
                        <FiUser className="w-3 h-3 text-white" />
                      )}
                    </button>
                  </div>
                  <div className="flex-1">
                    <h5 className="text-white font-medium text-sm">Profile Picture</h5>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs transition-colors mt-2"
                    >
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    </button>
                    {uploadStatus !== 'idle' && uploadMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-2 p-2 rounded-lg text-xs flex items-center space-x-2 ${
                          uploadStatus === 'success' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {uploadStatus === 'success' ? (
                          <FiCheck className="w-3 h-3" />
                        ) : (
                          <FiAlertCircle className="w-3 h-3" />
                        )}
                        <span>{uploadMessage}</span>
                      </motion.div>
                    )}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <div>
                  <label className="block text-gray-300 text-sm mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Enter your display name"
                  />
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <h4 className="text-white font-medium mb-2">Notifications</h4>
              <div className="space-y-2">
                {Object.entries(notifications).map(([key, value]) => (
                  <label key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <span className="text-gray-300 text-sm font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${
                        value ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          value ? 'translate-x-5' : 'translate-x-1'
                        }`}></div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Privacy Section */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <h4 className="text-white font-medium mb-2">Privacy</h4>
              <div className="space-y-2">
                {Object.entries(privacy).map(([key, value]) => (
                  <label key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <span className="text-gray-300 text-sm font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setPrivacy(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${
                        value ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          value ? 'translate-x-5' : 'translate-x-1'
                        }`}></div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Settings Status Messages */}
            {settingsStatus !== 'idle' && settingsMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg text-sm flex items-center space-x-2 ${
                  settingsStatus === 'success' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {settingsStatus === 'success' ? (
                  <FiCheck className="w-4 h-4" />
                ) : (
                  <FiAlertCircle className="w-4 h-4" />
                )}
                <span>{settingsMessage}</span>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex gap-3 p-4 border-t border-gray-700">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {savingSettings ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Header;