"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
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
import { FiMenu, FiX, FiStar, FiTrash2, FiUser, FiSettings, FiCheck, FiAlertCircle } from "react-icons/fi";
import { createPortal } from "react-dom";
import Image from "next/image";

const MobileChainBadge: React.FC = () => (
  <div className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-900/40">
    <Image
      src="https://i.imgur.com/k4HafXg.png"
      alt="Base Chain"
      width={24}
      height={24}
      className="w-4 h-4"
    />
  </div>
);

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
      <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700/50 rounded-lg animate-pulse"></div>
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
      <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700/50 rounded-lg"></div>
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
    <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl hover:bg-gray-900/60 transition-all duration-200">
      <div className="flex items-center space-x-3">
        <div className="relative w-10 h-10 overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center">
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


  const navLinks: Array<{ href: string; label: string; isActive: (path: string) => boolean; soon?: boolean }> = [
    {
      href: "/discover",
      label: "Discover",
      isActive: (path) =>
        path === "/discover" ||
        path.startsWith("/discover/"),
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      isActive: (path) => path === "/dashboard" || path.startsWith("/dashboard/"),
    },
    {
      href: "/radar",
      label: "Radar",
      isActive: (path) => path === "/radar" || path.startsWith("/radar/"),
    },
    {
      href: "/predict",
      label: "Predict",
      isActive: (path) => path === "/predict" || path.startsWith("/predict/"),
      soon: true,
    },
    {
      href: "/rewards",
      label: "Rewards",
      isActive: (path) => path === "/rewards" || path.startsWith("/rewards/"),
    },
    {
      href: "/explorer",
      label: "Explorer",
      isActive: (path) => path === "/explorer" || path.startsWith("/explorer/"),
    },
  ];

  const currentPath = pathname ?? "";

  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(72);

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

  // Measure header height
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        setHeaderHeight(height);
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Listen for 'open-wallet' event to open wallet dropdown
  useEffect(() => {
    const handleOpenWallet = () => {
      setShowWalletDropdown(true);
    };

    window.addEventListener('open-wallet', handleOpenWallet as EventListener);
    return () => {
      window.removeEventListener('open-wallet', handleOpenWallet as EventListener);
    };
  }, []);

  return (
    <>
            <header ref={headerRef} className="bg-gray-950 border-b border-gray-800/20 sticky top-0 z-40">
        <div className="w-full">
                     <div className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
            {/* Left Side - Menu, Logo & Navigation */}
            <div className="flex items-center space-x-3 lg:space-x-8 lg:pl-0 xl:-ml-4 2xl:-ml-8">
              {/* Mobile Menu Button */}
              <motion.button
                data-mobile-menu-button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-300 transition-all duration-200"
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
                      <FiX className="w-4 h-4 text-gray-300" />
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

              {/* Logo */}
              <div className="flex-shrink-0 lg:-ml-4 xl:-ml-6 2xl:-ml-10">
                <Link href="/" className="flex items-center group">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center"
                  >
                    <Image
                      src="https://i.imgur.com/b9l8Ndl.png"
                      alt="CypherX"
                      width={160}
                      height={40}
                      className="h-9 w-auto lg:hidden"
                    />
                    <div className="hidden lg:flex items-center space-x-2">
                      <Image
                        src="https://i.imgur.com/0DvpsA9.png"
                        alt="CypherX"
                        width={32}
                        height={32}
                        className="w-8 h-8"
                      />
                      <span className="text-lg text-blue-400 font-semibold" style={{ fontFamily: "'Poppins', sans-serif", letterSpacing: '0.02em' }}>
                        CYPHERX
                      </span>
                    </div>
                  </motion.div>
                </Link>
              </div>

                              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-2">
                {navLinks.map(({ href, label, isActive, soon }) => {
                  const active = isActive(currentPath);
                  const baseClasses =
                    "text-sm font-normal px-3 py-2 transition-all duration-200";
                  const stateClasses = active
                    ? "text-blue-300"
                    : "text-white hover:text-blue-300";

                  if (soon) {
                    return (
                      <span
                        key={href}
                        className={`${baseClasses} ${stateClasses} opacity-60 cursor-not-allowed flex items-center gap-1.5`}
                      >
                        {label}
                        <span className="text-[10px] text-gray-400 font-medium">(Soon)</span>
                      </span>
                    );
                  }

                  return (
                 <Link
                      key={href}
                      href={href}
                      className={`${baseClasses} ${stateClasses}`}
                   prefetch={true}
                 >
                      {label}
                 </Link>
                  );
                })}
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
                    className="relative flex items-center justify-center w-8 h-8 bg-gray-900/40 hover:bg-gray-900/60 text-white hover:text-blue-400 rounded-lg transition-all duration-200"
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
                    className="flex items-center justify-center w-8 h-8 bg-gray-900/40 hover:bg-gray-900/60 text-white hover:text-blue-400 rounded-lg transition-all duration-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Settings"
                    onClick={() => setShowSettingsModal(true)}
                  >
                    <FiSettings className="w-3.5 h-3.5" />
                  </motion.button>
                </div>

                {/* Mobile Quick Actions */}
                <div className="flex items-center space-x-2 lg:hidden">
                  <MobileChainBadge />
                  <motion.button
                    onClick={() => setShowSettingsModal(true)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-900/40 text-gray-300 hover:text-white hover:bg-gray-900/60 transition-all duration-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Settings"
                  >
                    <FiSettings className="w-3 h-3" />
                  </motion.button>
                  <div className="lg:hidden">
                    <UserProfileDropdown variant="rounded" />
                  </div>
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
                     className="w-8 h-8 rounded-full bg-gray-900/40 flex items-center justify-center hover:bg-gray-900/60 transition-all duration-200"
                   >
                     <FiUser className="w-5 h-5 text-gray-300" />
                   </button>
                 )}
               </div>

             </div>
           </div>

          {/* Mobile Menu */}
          {typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
              {isMenuOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  {/* Menu */}
                  <motion.div
                    ref={mobileMenuRef}
                    className="fixed left-0 right-0 bottom-0 z-50 bg-gray-950 lg:hidden overflow-hidden"
                    style={{ top: `${headerHeight}px` }}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <div className="h-full overflow-y-auto px-4 py-5 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white text-xs font-semibold tracking-[0.3em] uppercase">
                          Menu
                        </h3>
                        <button
                          onClick={() => setIsMenuOpen(false)}
                          className="text-gray-400 hover:text-white transition-colors"
                          aria-label="Close menu"
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <GlobalSearch 
                        placeholder="Search tokens, addresses, transactions..."
                        variant="header"
                      />

                      <div className="space-y-2">
                        {[{
                          href: "/discover",
                          label: "Discover",
                          delay: 0.05
                        }, {
                          href: "/dashboard",
                          label: "Dashboard",
                          delay: 0.075
                        }, {
                          href: "/radar",
                          label: "Radar",
                          delay: 0.1
                        }, {
                          href: "/predict",
                          label: "Predict",
                          delay: 0.125,
                          soon: true
                        }, {
                          href: "/rewards",
                          label: "Rewards",
                          delay: 0.15
                        }, {
                          href: "/explorer",
                          label: "Explorer",
                          delay: 0.25
                        }].map(({ href, label, delay, soon }, index) => (
                          <motion.div
                            key={href}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay }}
                          >
                            {soon ? (
                              <span className="block px-2 py-2 text-white text-sm font-normal tracking-wide opacity-60 cursor-not-allowed flex items-center gap-1.5">
                                {label}
                                <span className="text-[10px] text-gray-400 font-medium">(Soon)</span>
                              </span>
                            ) : (
                              <Link
                                href={href}
                                className="block px-2 py-2 text-white text-sm font-normal tracking-wide hover:text-blue-300 transition-colors"
                                prefetch={true}
                                onClick={() => setIsMenuOpen(false)}
                              >
                                {label}
                              </Link>
                            )}
                            {index < 5 && <div className="h-px bg-gray-800/60" />}
                          </motion.div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            setShowWatchlistsModal(true);
                          }}
                          className="px-3 py-2 rounded-lg bg-gray-900/50 text-white text-xs font-medium hover:bg-gray-900/80 transition-colors"
                        >
                          Watchlists
                        </button>
                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            setShowSettingsModal(true);
                          }}
                          className="px-3 py-2 rounded-lg bg-gray-900/50 text-white text-xs font-medium hover:bg-gray-900/80 transition-colors"
                        >
                          Settings
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body
          )}
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 sm:flex sm:items-center sm:justify-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWatchlistsModal(false)}
          >
            <motion.div
              className="bg-gray-950 w-full h-full sm:h-auto sm:max-w-lg sm:max-w-xl shadow-2xl p-5 sm:p-6 flex flex-col sm:max-h-[85vh] rounded-t-3xl sm:rounded-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile drag handle */}
              <div className="sm:hidden flex justify-center pt-2 pb-3">
                <div className="w-10 h-1 rounded-full bg-gray-600" />
              </div>
              <div className="relative flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  My Watchlists
                </h3>
                <button
                  onClick={() => setShowWatchlistsModal(false)}
                  className="absolute top-0 right-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200"
                  aria-label="Close"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-4 overflow-y-auto scrollbar-hide pr-0.5">
                {/* Default Watchlist (Favorites) */}
                <div className="bg-gray-900/40 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-100">
                      Favorites
                    </h4>
                    <span className="text-xs text-gray-400">{favorites.length} tokens</span>
                  </div>
                  {favorites.length === 0 ? (
                    <div className="text-gray-400 text-xs">
                      No tokens in your favorites yet. Tap the star icon on any token to add it.
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
                    <h4 className="text-sm font-medium text-gray-300">Custom Watchlists</h4>
                    {watchlists.map((watchlist) => (
                      <div key={watchlist.id} className="bg-gray-900/40 rounded-xl p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <button
                            onClick={() => setExpandedWatchlist(expandedWatchlist === watchlist.id ? null : watchlist.id)}
                            className="text-sm font-medium text-gray-200 hover:text-white transition-colors cursor-pointer text-left flex-1"
                          >
                            {watchlist.name}
                          </button>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{watchlist.tokens.length} tokens</span>
                        </div>
                        <div className="space-y-2">
                          {expandedWatchlist === watchlist.id ? (
                            <div className="max-h-48 overflow-y-auto scrollbar-hide pr-0.5">
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
  const DEFAULT_NOTIFICATIONS = {
    email: true,
    push: true,
    trading: true,
    news: false,
  } as const;
  const DEFAULT_PRIVACY = {
    showProfile: true,
    showTrades: true,
    showBalance: false,
  } as const;
  const [notifications, setNotifications] = useState(() => ({ ...DEFAULT_NOTIFICATIONS }));
  const [privacy, setPrivacy] = useState(() => ({ ...DEFAULT_PRIVACY }));
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
            setNotifications(userData.notifications ? { ...DEFAULT_NOTIFICATIONS, ...userData.notifications } : { ...DEFAULT_NOTIFICATIONS });
            setPrivacy(userData.privacy ? { ...DEFAULT_PRIVACY, ...userData.privacy } : { ...DEFAULT_PRIVACY });
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

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
      await setDoc(doc(db, "users", documentId), {
        displayName: displayName.trim(),
        notifications,
        privacy,
        updatedAt: new Date(),
        // Quick buy config will be saved separately via useQuickBuyConfig hook
      }, { merge: true });
      
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
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] sm:flex sm:items-center sm:justify-center sm:p-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          ref={modalRef}
          className="bg-gray-950 w-full h-full sm:h-auto sm:max-w-[520px] sm:mx-0 shadow-2xl flex flex-col sm:max-h-[82vh] sm:my-auto rounded-t-3xl sm:rounded-xl overflow-hidden"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>
          <div className="relative flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800/20 bg-gray-950">
            <div className="text-left">
              <span className="text-[10px] uppercase tracking-[0.3em] text-blue-400/70 font-medium">Profile</span>
              <h3 className="text-white text-base sm:text-2xl font-semibold mt-1">Account Settings</h3>
            </div>
            <button
              onClick={onClose}
              className="absolute top-3 sm:top-4 right-4 sm:right-6 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200"
              aria-label="Close"
            >
              <FiX className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6 py-4 space-y-4 sm:space-y-6">
            {/* Profile Section */}
            <div className="bg-gray-900/40 rounded-xl p-3 sm:p-4 mt-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                <h4 className="text-white font-semibold text-sm sm:text-base">Profile Information</h4>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-2 sm:gap-3">
                  <div className="relative self-center sm:self-auto">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 overflow-hidden bg-gray-900/40 rounded-xl shadow-lg">
                      {profilePicture ? (
                        <Image
                          src={profilePicture}
                          alt="Profile"
                          width={72}
                          height={72}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                          <FiUser className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                      {uploadingImage && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="absolute -bottom-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center transition-colors shadow-lg rounded-lg"
                    >
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-2.5 w-2.5 border-b border-white"></div>
                      ) : (
                        <FiUser className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                      )}
                    </button>
                  </div>
                  <div className="flex-1 w-full">
                    <h5 className="text-white font-semibold text-xs sm:text-sm">Profile Picture</h5>
                    <p className="text-gray-400 text-xs mb-2">
                      Upload an image with a minimum size of 256x256 for best clarity.
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-gray-900/40 hover:bg-gray-900/60 rounded-lg text-xs sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                    >
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    </button>
                    {uploadStatus !== 'idle' && uploadMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-3 px-3 py-2 text-xs sm:text-sm flex items-center gap-2 rounded-lg ${
                          uploadStatus === 'success' 
                            ? 'bg-green-500/15 text-green-300'
                            : 'bg-red-500/15 text-red-300'
                        }`}
                      >
                        {uploadStatus === 'success' ? (
                          <FiCheck className="w-4 h-4" />
                        ) : (
                          <FiAlertCircle className="w-4 h-4" />
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-gray-300 text-xs sm:text-sm font-medium mb-2">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900/40 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-sm transition"
                      placeholder="Enter your display name"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="bg-gray-900/40 rounded-xl p-3 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                <h4 className="text-white font-semibold text-base sm:text-lg">Notifications</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {Object.entries(notifications).map(([key, value]) => {
                  const label = key.replace(/([A-Z])/g, ' $1').trim();
                  const descriptions: Record<string, string> = {
                    email: 'Cycle insights and important updates.',
                    push: 'Instant signals delivered to your device.',
                    trading: 'Get notified about positions and P&L shifts.',
                    news: 'Macro stories and curated market commentary.'
                  };
                  return (
                    <label key={key} className="group flex items-center justify-between gap-3 p-3 bg-gray-900/40 hover:bg-gray-900/60 rounded-xl transition-colors cursor-pointer capitalize">
                      <div>
                        <span className="text-gray-200 text-sm font-medium">{label}</span>
                        <p className="text-[11px] sm:text-xs text-gray-500 mt-1">{descriptions[key] || 'Stay in the loop without the noise.'}</p>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                          value ? 'bg-blue-500' : 'bg-gray-700'
                        }`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                            value ? 'translate-x-5' : 'translate-x-0'
                          }`}></div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Privacy Section */}
            <div className="bg-gray-900/40 rounded-xl p-3 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                <h4 className="text-white font-semibold text-base sm:text-lg">Privacy</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {Object.entries(privacy).map(([key, value]) => {
                  const label = key.replace(/([A-Z])/g, ' $1').trim();
                  const descriptions: Record<string, string> = {
                    showProfile: 'Allow others to discover and follow you.',
                    showTrades: 'Share recent trades with your followers.',
                    showBalance: 'Reveal your wallet balance on your profile.'
                  };
                  return (
                    <label key={key} className="group flex items-center justify-between gap-3 p-3 bg-gray-900/40 hover:bg-gray-900/60 rounded-xl transition-colors cursor-pointer capitalize">
                      <div>
                        <span className="text-gray-200 text-sm font-medium">{label}</span>
                        <p className="text-[11px] sm:text-xs text-gray-500 mt-1">{descriptions[key] || 'Fine-tune visibility to match your comfort.'}</p>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setPrivacy(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                          value ? 'bg-blue-500' : 'bg-gray-700'
                        }`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                            value ? 'translate-x-5' : 'translate-x-0'
                          }`}></div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Settings Status Messages */}
            {settingsStatus !== 'idle' && settingsMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 sm:p-4 text-xs sm:text-sm flex items-center gap-2 sm:gap-3 rounded-lg ${
                  settingsStatus === 'success' 
                    ? 'bg-green-500/15 text-green-300'
                    : 'bg-red-500/15 text-red-300'
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
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-0">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-gray-900/40 text-gray-300 hover:bg-gray-900/60 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
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