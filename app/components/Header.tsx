"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth, useLoginModal, useWalletSystem } from "@/app/providers";
import { useFavorites } from "@/app/hooks/useFavorites";
import { useWatchlists } from "@/app/hooks/useWatchlists";
import { useQuickBuyConfig } from "@/app/hooks/useQuickBuyConfig";

import WalletDropdown from "./WalletDropdown";
import WalletDisplay from "./WalletDisplay";
import TierProgressionModal from "./TierProgressionModal";
import GlobalSearch from "./GlobalSearch";
import UserProfileDropdown from "./UserProfileDropdown";

import { motion, AnimatePresence } from "framer-motion";
import { FiMenu, FiX, FiStar, FiTrash2, FiUser, FiSettings, FiCheck, FiAlertCircle, FiBook, FiSearch } from "react-icons/fi";
import { createPortal } from "react-dom";
import Image from "next/image";

// Mobile Search Button Component
const MobileSearchButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <motion.button
    onClick={onClick}
    className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg border border-gray-700/60 bg-gray-900/40 text-gray-300 hover:text-white hover:border-gray-500 transition-all duration-200"
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    aria-label="Search"
  >
    <FiSearch className="w-4 h-4" />
  </motion.button>
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
      <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700/50 animate-pulse"></div>
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
      <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700/50"></div>
          <div className="text-gray-400 text-sm">
            {poolAddress.slice(0, 8)}...{poolAddress.slice(-6)}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const priceChange = tokenData.priceChange?.h24 || 0;
  const priceChangeColor = priceChange >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30 hover:bg-gray-800/70 transition-all duration-200">
      <div className="flex items-center space-x-3">
        <div className="relative w-10 h-10 overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
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
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();
  const { watchlists, removeFromWatchlist } = useWatchlists();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showFullPageSearch, setShowFullPageSearch] = useState(false);
  const [recentTokens, setRecentTokens] = useState<Array<{symbol: string; address: string; logo?: string; name?: string; poolAddress?: string}>>([]);
  const [hasActiveSearch, setHasActiveSearch] = useState(false);

  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('normie');
  const [showTierModal, setShowTierModal] = useState(false);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [showWatchlistsModal, setShowWatchlistsModal] = useState(false);
  const [expandedWatchlist, setExpandedWatchlist] = useState<string | null>(null);
  const [expandedFavorites, setExpandedFavorites] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { setShowLoginModal, setRedirectTo } = useLoginModal();

  // Load recent tokens from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && showFullPageSearch) {
      const stored = localStorage.getItem('cypherx_recent_tokens');
      if (stored) {
        try {
          setRecentTokens(JSON.parse(stored));
        } catch (e) {
          console.error('Error loading recent tokens:', e);
        }
      }
    }
  }, [showFullPageSearch]);


  const navLinks: Array<{ href: string; label: string; isActive: (path: string) => boolean; comingSoon?: boolean }> = [
    {
      href: "/discover",
      label: "Discover",
      isActive: (path) =>
        path === "/discover" ||
        path.startsWith("/discover/"),
    },
    {
      href: "/radar",
      label: "Radar",
      isActive: (path) => path === "/radar" || path.startsWith("/radar/"),
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      isActive: (path) => path === "/dashboard" || path.startsWith("/dashboard/"),
    },
    {
      href: "/predict",
      label: "Predict",
      isActive: (path) => path === "/predict" || path.startsWith("/predict/"),
      comingSoon: true,
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
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };
    
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    
    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  // Prevent body scroll and hide header/footer/banner when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('data-menu-open', 'true');
      // Hide header, footer, and banner
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');
      const banner = document.querySelector('[data-banner]');
      if (header) header.style.display = 'none';
      if (footer) footer.style.display = 'none';
      if (banner) (banner as HTMLElement).style.display = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-menu-open');
      // Show header, footer, and banner
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');
      const banner = document.querySelector('[data-banner]');
      if (header) header.style.display = '';
      if (footer) footer.style.display = '';
      if (banner) (banner as HTMLElement).style.display = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-menu-open');
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');
      const banner = document.querySelector('[data-banner]');
      if (header) header.style.display = '';
      if (footer) footer.style.display = '';
      if (banner) (banner as HTMLElement).style.display = '';
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
            <header ref={headerRef} className="bg-gray-950 border-b border-gray-800/20 sticky z-40" style={{ top: 'var(--banner-height, 0px)' }}>
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
                        src="https://i.imgur.com/b9l8Ndl.png"
                        alt="CypherX"
                        width={160}
                        height={40}
                        className="h-9 w-auto"
                      />
                      <span className="text-lg text-blue-400 font-semibold tracking-tight" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", letterSpacing: '0.05em' }}>
                        CYPHERX
                      </span>
                    </div>
                  </motion.div>
                </Link>
              </div>

                              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-2">
                {navLinks.map(({ href, label, isActive, comingSoon }) => {
                  const active = isActive(currentPath);
                  const baseClasses =
                    "text-sm font-normal px-3 py-2 transition-all duration-200";
                  const stateClasses = comingSoon
                    ? "text-gray-500 cursor-not-allowed"
                    : active
                    ? "text-blue-300"
                    : "text-white hover:text-blue-300";

                  if (comingSoon) {
                    return (
                      <div
                        key={href}
                        className={`${baseClasses} ${stateClasses} flex items-center gap-1.5`}
                      >
                        {label}
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 text-[10px] font-medium">Soon</span>
                      </div>
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
                    className="relative flex items-center justify-center w-8 h-8 bg-[#111827] hover:bg-[#1f2937] text-white hover:text-blue-400 rounded-lg transition-all duration-200 border border-gray-600 hover:border-gray-500"
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
                    className="flex items-center justify-center w-8 h-8 bg-[#111827] hover:bg-[#1f2937] text-white hover:text-blue-400 rounded-lg transition-all duration-200 border border-gray-600 hover:border-gray-500"
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
                  <MobileSearchButton onClick={() => setShowFullPageSearch(true)} />
                  <motion.button
                    onClick={() => setShowSettingsModal(true)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-700/60 bg-gray-900/40 text-gray-300 hover:text-white hover:border-gray-500 transition-all duration-200"
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
                     className="w-8 h-8 rounded-full bg-[#111827] border border-gray-600 flex items-center justify-center hover:bg-[#1f2937] hover:border-gray-500 transition-all duration-200"
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
                    className="fixed inset-0 z-[10001] bg-gray-950 lg:hidden overflow-hidden"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <div className="h-full flex flex-col px-5 py-5">
                      <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <Image
                          src="https://i.imgur.com/b9l8Ndl.png"
                          alt="CypherX"
                          width={160}
                          height={40}
                          className="h-9 w-auto"
                        />
                        <button
                          onClick={() => setIsMenuOpen(false)}
                          className="text-gray-400 hover:text-white transition-colors p-2"
                          aria-label="Close menu"
                        >
                          <FiX className="w-6 h-6" />
                        </button>
                      </div>

                      <div className="space-y-1 flex-1 overflow-y-auto min-h-0 mb-4">
                          {[{
                            href: "/discover",
                            label: "Discover",
                            delay: 0.05,
                            comingSoon: false
                          }, {
                            href: "/radar",
                            label: "Radar",
                            delay: 0.075,
                            comingSoon: false
                          }, {
                            href: "/dashboard",
                            label: "Dashboard",
                            delay: 0.1,
                            comingSoon: false
                          }, {
                            href: "/predict",
                            label: "Predict",
                            delay: 0.125,
                            comingSoon: true
                          }, {
                            href: "/rewards",
                            label: "Rewards",
                            delay: 0.15,
                            comingSoon: false
                          }, {
                            href: "/explorer",
                            label: "Explorer",
                            delay: 0.2,
                            comingSoon: false
                          }, {
                            href: "/docs",
                            label: "Docs",
                            icon: <FiBook className="w-5 h-5" />,
                            delay: 0.25,
                            comingSoon: false
                          }].map(({ href, label, icon, delay, comingSoon }, index) => (
                            <motion.div
                              key={href}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay }}
                            >
                              {comingSoon ? (
                                <div className="block px-4 py-3 text-gray-500 text-sm font-normal tracking-wide cursor-not-allowed flex items-center gap-2 rounded-lg">
                                  <span>{label}</span>
                                  <span className="px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 text-xs font-medium">Soon</span>
                                </div>
                              ) : (
                                <Link
                                  href={href}
                                  className="block px-4 py-3 text-white text-sm font-normal tracking-wide hover:text-blue-300 hover:bg-gray-800/30 transition-all rounded-lg flex items-center gap-3"
                                  prefetch={true}
                                  onClick={() => setIsMenuOpen(false)}
                                >
                                  {icon && <span className="text-blue-400">{icon}</span>}
                                  <span className="flex-1">{label}</span>
                                </Link>
                              )}
                              {index < 6 && <div className="h-px bg-gray-800/60 my-1" />}
                            </motion.div>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              setShowWatchlistsModal(true);
                            }}
                            className="px-4 py-2.5 rounded-full bg-gray-900/50 text-white text-sm font-medium hover:bg-gray-900/80 transition-colors border border-blue-500/30"
                          >
                            Watchlists
                          </button>
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              setShowSettingsModal(true);
                            }}
                            className="px-4 py-2.5 rounded-full bg-gray-900/50 text-white text-sm font-medium hover:bg-gray-900/80 transition-colors border border-blue-500/30"
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
              className="bg-gray-950 sm:border sm:border-gray-800 w-full h-full sm:h-auto sm:max-w-lg sm:max-w-xl shadow-2xl p-5 sm:p-6 flex flex-col sm:max-h-[85vh]"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  My Watchlists
                </h3>
                <button
                  onClick={() => setShowWatchlistsModal(false)}
                  className="absolute top-0 right-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200"
                  aria-label="Close"
                >
                  <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
              <div className="space-y-4 overflow-y-auto scrollbar-hide pr-0.5">
                {/* Default Watchlist (Favorites) */}
                <div className="bg-gray-900/50 border border-gray-800 p-3 sm:p-4">
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
                      <div key={watchlist.id} className="bg-gray-900/50 border border-gray-800 p-3 sm:p-4">
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

      {/* Full Page Search Overlay for Mobile */}
      {showFullPageSearch && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[10002] bg-gray-950 lg:hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <h3 className="text-white text-base font-semibold">Search</h3>
              <button
                onClick={() => setShowFullPageSearch(false)}
                className="text-gray-400 hover:text-white transition-colors p-1.5"
                aria-label="Close search"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            {/* Search Content */}
            <div className="flex-1 flex flex-col min-h-0 relative" style={{ overflow: 'visible' }}>
              <div className="px-4 pt-3 pb-2 flex-shrink-0 relative z-10 bg-gray-950">
                <GlobalSearch 
                  placeholder="Search tokens, addresses, transactions..."
                  variant="header"
                  fullScreenMobile={true}
                  onSearchStateChange={setHasActiveSearch}
                />
              </div>
              
              {/* Separator and Recent Tokens - only show when no active search */}
              {!hasActiveSearch && (
                <div id="recent-tokens-section" className="flex-1 overflow-y-auto min-h-0 relative z-0">
                <div className="w-full py-2 flex-shrink-0">
                  <div className="border-t border-gray-800"></div>
                </div>
                <div className="px-4 pb-4">
                {recentTokens.length > 0 ? (
                  <>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                      Recent Tokens
                    </h4>
                    <div className="space-y-1">
                      {recentTokens.map((token, index) => (
                        <motion.button
                          key={`${token.address}-${index}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          onClick={() => {
                            const targetPath = token.poolAddress 
                              ? `/discover/${token.poolAddress}/chart`
                              : `/discover/${token.address}/chart`;
                            router.push(targetPath);
                            setShowFullPageSearch(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800/50 transition-colors text-left group"
                        >
                          {/* Token Icon */}
                          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {token.logo ? (
                              <img 
                                src={token.logo} 
                                alt={token.symbol || 'Token'} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.nextElementSibling;
                                  if (fallback) {
                                    (fallback as HTMLElement).classList.remove('hidden');
                                  }
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full bg-blue-500/20 flex items-center justify-center ${token.logo ? 'hidden' : ''}`}>
                              <span className="text-xs text-blue-400 font-semibold">
                                {(token.symbol || token.name || 'T').slice(0, 1).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          
                          {/* Token Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium truncate">
                              {token.name || token.symbol || 'Unknown Token'}
                            </div>
                            <div className="text-gray-400 text-xs truncate">
                              {token.symbol && token.name && token.symbol !== token.name ? token.symbol : token.address.slice(0, 6) + '...' + token.address.slice(-4)}
                            </div>
                          </div>
                          
                          {/* Arrow Icon */}
                          <div className="text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center h-full">
                    <p className="text-gray-500 text-sm">No recent tokens</p>
                  </div>
                )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
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
  const { config: quickBuyConfig, saveConfig: saveQuickBuyConfig, loading: quickBuyConfigLoading } = useQuickBuyConfig();
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
  
  // Quick Buy Configuration State
  const [quickBuyAmounts, setQuickBuyAmounts] = useState<number[]>([0.01, 0.025, 0.05, 0.1]);
  const [defaultSlippage, setDefaultSlippage] = useState<number>(1);
  const [autoApprove, setAutoApprove] = useState<boolean>(false);
  const [preferredDex, setPreferredDex] = useState<string | null>(null);
  const [savingQuickBuy, setSavingQuickBuy] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load quick buy config when it's available
  useEffect(() => {
    if (!quickBuyConfigLoading && quickBuyConfig) {
      setQuickBuyAmounts(quickBuyConfig.amounts || [0.01, 0.025, 0.05, 0.1]);
      setDefaultSlippage(quickBuyConfig.defaultSlippage || 1);
      setAutoApprove(quickBuyConfig.autoApprove || false);
      setPreferredDex(quickBuyConfig.preferredDex || null);
    }
  }, [quickBuyConfig, quickBuyConfigLoading]);

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

  const handleSaveQuickBuyConfig = async () => {
    setSavingQuickBuy(true);
    try {
      const success = await saveQuickBuyConfig({
        amounts: quickBuyAmounts,
        defaultSlippage,
        autoApprove,
        preferredDex,
      });
      
      if (success) {
        setSettingsStatus('success');
        setSettingsMessage('Quick buy preferences saved!');
        setTimeout(() => {
          setSettingsStatus('idle');
          setSettingsMessage('');
        }, 3000);
      } else {
        setSettingsStatus('error');
        setSettingsMessage('Failed to save quick buy preferences');
        setTimeout(() => {
          setSettingsStatus('idle');
          setSettingsMessage('');
        }, 5000);
      }
    } catch (error) {
      console.error('Error saving quick buy config:', error);
      setSettingsStatus('error');
      setSettingsMessage('Failed to save quick buy preferences');
      setTimeout(() => {
        setSettingsStatus('idle');
        setSettingsMessage('');
      }, 5000);
    } finally {
      setSavingQuickBuy(false);
    }
  };

  const handleAddAmount = () => {
    if (quickBuyAmounts.length < 6) {
      setQuickBuyAmounts([...quickBuyAmounts, 0.1]);
    }
  };

  const handleRemoveAmount = (index: number) => {
    if (quickBuyAmounts.length > 1) {
      setQuickBuyAmounts(quickBuyAmounts.filter((_, i) => i !== index));
    }
  };

  const handleUpdateAmount = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    if (numValue >= 0) {
      const newAmounts = [...quickBuyAmounts];
      newAmounts[index] = numValue;
      setQuickBuyAmounts(newAmounts);
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
          className="bg-gray-950 w-full h-full sm:h-auto sm:max-w-[520px] sm:mx-0 sm:border sm:border-gray-800 shadow-2xl flex flex-col sm:max-h-[82vh] sm:my-auto"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800 bg-gray-950">
            <div className="text-left">
              <span className="text-[10px] uppercase tracking-[0.3em] text-blue-400/70 font-medium">Profile</span>
              <h3 className="text-white text-base sm:text-2xl font-semibold mt-1">Account Settings</h3>
            </div>
            <button
              onClick={onClose}
              className="absolute top-3 sm:top-4 right-4 sm:right-6 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200"
              aria-label="Close"
            >
              <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-6 py-4 space-y-4 sm:space-y-6">
            {/* Profile Section */}
            <div className="bg-gray-900/40 border border-gray-800 p-3 sm:p-5 shadow-inner mt-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                <h4 className="text-white font-semibold text-base sm:text-lg">Profile Information</h4>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-5 gap-3 sm:gap-4">
                  <div className="relative self-center sm:self-auto">
                    <div className="w-14 h-14 sm:w-20 sm:h-20 overflow-hidden bg-gray-900 border border-gray-800 shadow-lg">
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
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="absolute -bottom-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center transition-colors shadow-lg"
                    >
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                      ) : (
                        <FiUser className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                      )}
                    </button>
                  </div>
                  <div className="flex-1 w-full">
                    <h5 className="text-white font-semibold text-sm sm:text-base">Profile Picture</h5>
                    <p className="text-gray-400 text-xs sm:text-sm mb-3">
                      Upload an image with a minimum size of 256x256 for best clarity.
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-900/80 text-xs sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                    >
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    </button>
                    {uploadStatus !== 'idle' && uploadMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-3 px-3 py-2 text-xs sm:text-sm flex items-center gap-2 border ${
                          uploadStatus === 'success' 
                            ? 'bg-green-500/15 text-green-300 border-green-500/30'
                            : 'bg-red-500/15 text-red-300 border-red-500/30'
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
                      className="w-full px-3 py-2 bg-gray-950 border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/50 text-sm transition"
                      placeholder="Enter your display name"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="bg-gray-900/40 border border-gray-800 p-3 sm:p-5 shadow-inner">
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
                    <label key={key} className="group flex items-center justify-between gap-3 p-3 border border-gray-800/70 bg-gray-900/60 hover:border-gray-700 transition-colors cursor-pointer capitalize">
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
            <div className="bg-gray-900/40 border border-gray-800 p-3 sm:p-5 shadow-inner">
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
                    <label key={key} className="group flex items-center justify-between gap-3 p-3 border border-gray-800/70 bg-gray-900/60 hover:border-gray-700 transition-colors cursor-pointer capitalize">
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

            {/* Quick Buy Configuration Section */}
            <div className="bg-gray-900/40 border border-gray-800 p-3 sm:p-5 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div>
                  <h4 className="text-white font-semibold text-base sm:text-lg">Quick Buy Configuration</h4>
                  <p className="text-gray-400 text-xs sm:text-sm mt-1">Customize your quick buy button amounts and preferences</p>
                </div>
              </div>
              <div className="space-y-4">
                {/* Quick Buy Amounts */}
                <div>
                  <label className="block text-gray-300 text-xs sm:text-sm font-medium mb-2">
                    Quick Buy Amounts (ETH)
                  </label>
                  <div className="space-y-2">
                    {quickBuyAmounts.map((amount, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={amount}
                          onChange={(e) => handleUpdateAmount(index, e.target.value)}
                          className="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/50 text-sm transition"
                          placeholder="0.01"
                        />
                        {quickBuyAmounts.length > 1 && (
                          <button
                            onClick={() => handleRemoveAmount(index)}
                            className="px-3 py-2 bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors text-sm"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {quickBuyAmounts.length < 6 && (
                      <button
                        onClick={handleAddAmount}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-800 text-gray-300 hover:border-gray-600 hover:text-white transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <span>+ Add Amount</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Default Slippage */}
                <div>
                  <label className="block text-gray-300 text-xs sm:text-sm font-medium mb-2">
                    Default Slippage (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    value={defaultSlippage}
                    onChange={(e) => setDefaultSlippage(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/50 text-sm transition"
                    placeholder="1"
                  />
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                    Maximum price movement you're willing to accept (1-50%)
                  </p>
                </div>

                {/* Auto Approve */}
                <label className="group flex items-center justify-between gap-3 p-3 border border-gray-800/70 bg-gray-900/60 hover:border-gray-700 transition-colors cursor-pointer">
                  <div>
                    <span className="text-gray-200 text-sm font-medium">Auto Approve Tokens</span>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                      Automatically approve token spending for faster trades
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                      autoApprove ? 'bg-blue-500' : 'bg-gray-700'
                    }`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                        autoApprove ? 'translate-x-5' : 'translate-x-0'
                      }`}></div>
                    </div>
                  </div>
                </label>

                {/* Preferred DEX */}
                <div>
                  <label className="block text-gray-300 text-xs sm:text-sm font-medium mb-2">
                    Preferred DEX (Optional)
                  </label>
                  <select
                    value={preferredDex || ''}
                    onChange={(e) => setPreferredDex(e.target.value || null)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/50 text-sm transition"
                  >
                    <option value="">Auto (Best Price)</option>
                    <option value="uniswap">Uniswap</option>
                    <option value="sushiswap">SushiSwap</option>
                    <option value="0x">0x Protocol</option>
                  </select>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                    Prefer a specific DEX for swaps (defaults to best price)
                  </p>
                </div>

                {/* Save Quick Buy Config Button */}
                <button
                  onClick={handleSaveQuickBuyConfig}
                  disabled={savingQuickBuy || quickBuyConfigLoading}
                  className="w-full px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {savingQuickBuy ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Quick Buy Preferences</span>
                  )}
                </button>
              </div>
            </div>

            {/* Settings Status Messages */}
            {settingsStatus !== 'idle' && settingsMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 sm:p-4 text-xs sm:text-sm flex items-center gap-2 sm:gap-3 border ${
                  settingsStatus === 'success' 
                    ? 'bg-green-500/15 text-green-300 border-green-500/30'
                    : 'bg-red-500/15 text-red-300 border-red-500/30'
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
                className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-800 text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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