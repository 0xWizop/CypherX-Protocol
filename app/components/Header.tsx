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
                    className="relative flex items-center justify-center w-8 h-8 bg-[#111827] hover:bg-[#1f2937] text-white hover:text-blue-400 rounded-lg transition-all duration-200"
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
                    className="flex items-center justify-center w-8 h-8 bg-[#111827] hover:bg-[#1f2937] text-white hover:text-blue-400 rounded-lg transition-all duration-200"
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWatchlistsModal(false)}
          >
            <motion.div
              className="bg-gray-950 w-full h-[85vh] sm:h-auto sm:max-w-md sm:mx-4 sm:max-h-[80vh] sm:border sm:border-gray-800/60 sm:rounded-2xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile drag handle */}
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-600" />
              </div>
              
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/40 flex-shrink-0">
                <h3 className="text-sm text-white">Watchlists</h3>
                <button
                  onClick={() => setShowWatchlistsModal(false)}
                  className="p-2 text-gray-500 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3">
                {/* Favorites Section */}
                <div className="mb-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-800/40">
                    <div className="flex items-center gap-2">
                      <FiStar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-300">Favorites</span>
                    </div>
                    <span className="text-xs text-gray-500">{favorites.length}</span>
                  </div>
                  {favorites.length === 0 ? (
                    <div className="text-gray-500 text-xs py-4 text-center">
                      Star any token to add it here
                    </div>
                  ) : (
                    <div>
                      {(expandedFavorites ? favorites : favorites.slice(0, 3)).map((poolAddress) => (
                            <FavoriteTokenItem 
                              key={poolAddress} 
                              poolAddress={poolAddress} 
                              onRemove={() => toggleFavorite(poolAddress)}
                            />
                          ))}
                          {favorites.length > 3 && (
                            <button
                          onClick={() => setExpandedFavorites(!expandedFavorites)}
                          className="w-full text-xs text-gray-500 hover:text-gray-400 transition-colors py-2 text-center"
                        >
                          {expandedFavorites ? 'Show less' : `Show ${favorites.length - 3} more`}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Custom Watchlists */}
                {watchlists.length > 0 && watchlists.map((watchlist) => (
                  <div key={watchlist.id} className="mb-4">
                    <div className="flex items-center justify-between py-2 border-b border-gray-800/40">
                          <button
                            onClick={() => setExpandedWatchlist(expandedWatchlist === watchlist.id ? null : watchlist.id)}
                        className="text-sm text-gray-300 hover:text-white transition-colors"
                          >
                            {watchlist.name}
                          </button>
                      <span className="text-xs text-gray-500">{watchlist.tokens.length}</span>
                        </div>
                    <div>
                      {(expandedWatchlist === watchlist.id ? watchlist.tokens : watchlist.tokens.slice(0, 3)).map((poolAddress) => (
                        <div key={poolAddress} className="flex items-center justify-between py-2.5 border-b border-gray-800/30">
                          <span className="text-xs text-gray-400 font-mono">{poolAddress.slice(0, 8)}...{poolAddress.slice(-6)}</span>
                                  <button
                                    onClick={() => removeFromWatchlist(watchlist.id, poolAddress)}
                            className="text-gray-600 hover:text-red-400 transition-colors p-1"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              {watchlist.tokens.length > 3 && (
                                <button
                          onClick={() => setExpandedWatchlist(expandedWatchlist === watchlist.id ? null : watchlist.id)}
                          className="w-full text-xs text-gray-500 hover:text-gray-400 transition-colors py-2 text-center"
                                >
                          {expandedWatchlist === watchlist.id ? 'Show less' : `Show ${watchlist.tokens.length - 3} more`}
                                </button>
                          )}
                        </div>
                      </div>
                    ))}
                
                {/* Empty state */}
                {watchlists.length === 0 && favorites.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-10 h-10 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-2">
                      <FiStar className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-gray-500 text-sm">No saved tokens</p>
                    <p className="text-gray-600 text-xs mt-1">Star tokens to track them here</p>
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10001] lg:hidden"
            onClick={() => setShowFullPageSearch(false)}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 z-[10002] bg-gray-950 border-t border-gray-800/60 lg:hidden flex flex-col h-[70vh] max-h-[680px] rounded-t-[28px] overflow-hidden"
          >
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/40 flex-shrink-0">
              <h3 className="text-white text-sm font-medium">Search</h3>
              <button
                onClick={() => setShowFullPageSearch(false)}
                className="p-2 text-gray-500 hover:text-white transition-colors -mr-2"
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
  
  // Auto DCA State
  const DCA_ASSETS = [
    { symbol: 'cbBTC', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', name: 'Coinbase BTC' },
    { symbol: 'cbETH', address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', name: 'Coinbase ETH' },
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', name: 'Wrapped ETH' },
    { symbol: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', name: 'Aerodrome' },
  ];
  const [autoDcaEnabled, setAutoDcaEnabled] = useState<boolean>(false);
  const [autoDcaPercentage, setAutoDcaPercentage] = useState<number>(10);
  const [autoDcaAsset, setAutoDcaAsset] = useState<string>('cbBTC');
  
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

  // Load Auto DCA settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cypherx_auto_dca_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        setAutoDcaEnabled(settings.enabled || false);
        setAutoDcaPercentage(settings.percentage || 10);
        setAutoDcaAsset(settings.assetSymbol || 'cbBTC');
      }
    } catch (error) {
      console.error('Error loading DCA settings:', error);
    }
  }, []);

  // Save Auto DCA settings
  const saveAutoDcaSettings = (enabled: boolean, percentage: number, assetSymbol: string) => {
    try {
      localStorage.setItem('cypherx_auto_dca_settings', JSON.stringify({
        enabled,
        percentage,
        assetSymbol,
      }));
    } catch (error) {
      console.error('Error saving DCA settings:', error);
    }
  };

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
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-end sm:items-center sm:justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          ref={modalRef}
          className="bg-gray-950 w-full h-full sm:h-auto sm:max-w-[520px] sm:mx-4 sm:border sm:border-gray-800/60 shadow-2xl flex flex-col sm:max-h-[85vh] sm:rounded-2xl"
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
          
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/40 flex-shrink-0">
            <h3 className="text-sm text-white">Settings</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-white transition-colors"
              aria-label="Close"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3">
            {/* Profile Section */}
            <div className="mb-4">
              <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Profile</h4>
              <div className="flex items-center gap-3 py-3 border-b border-gray-800/40">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800">
                      {profilePicture ? (
                        <Image
                          src={profilePicture}
                          alt="Profile"
                        width={48}
                        height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FiUser className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      {uploadingImage && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                        </div>
                      )}
                    </div>
                  </div>
                <div className="flex-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                    Change photo
                    </button>
                    {uploadStatus !== 'idle' && uploadMessage && (
                    <p className={`text-xs mt-1 ${uploadStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {uploadMessage}
                    </p>
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

              <div className="py-3 border-b border-gray-800/40">
                <label className="block text-xs text-gray-500 mb-1.5">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
                  placeholder="Enter display name"
                    />
              </div>
            </div>

            {/* Notifications Section */}
            <div className="mb-4">
              <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Notifications</h4>
              {[
                { key: 'email', label: 'Email notifications' },
                { key: 'push', label: 'Push notifications' },
                { key: 'trading', label: 'Trading alerts' },
                { key: 'news', label: 'News updates' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between py-3 border-b border-gray-800/40 cursor-pointer">
                  <span className="text-sm text-gray-400">{label}</span>
                      <div className="relative">
                        <input
                          type="checkbox"
                      checked={notifications[key as keyof typeof notifications]}
                          onChange={(e) => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="sr-only"
                        />
                    <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                      notifications[key as keyof typeof notifications] ? 'bg-blue-500' : 'bg-gray-700'
                        }`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        notifications[key as keyof typeof notifications] ? 'translate-x-4' : ''
                      }`} />
                        </div>
                      </div>
                    </label>
              ))}
            </div>

            {/* Privacy Section */}
            <div className="mb-4">
              <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Privacy</h4>
              {[
                { key: 'showProfile', label: 'Show profile publicly' },
                { key: 'showTrades', label: 'Show trades' },
                { key: 'showBalance', label: 'Show balance' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between py-3 border-b border-gray-800/40 cursor-pointer">
                  <span className="text-sm text-gray-400">{label}</span>
                      <div className="relative">
                        <input
                          type="checkbox"
                      checked={privacy[key as keyof typeof privacy]}
                          onChange={(e) => setPrivacy(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="sr-only"
                        />
                    <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                      privacy[key as keyof typeof privacy] ? 'bg-blue-500' : 'bg-gray-700'
                        }`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        privacy[key as keyof typeof privacy] ? 'translate-x-4' : ''
                      }`} />
                        </div>
                      </div>
                    </label>
              ))}
            </div>

            {/* Trading Section */}
            <div className="mb-4">
              <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Trading</h4>
              
                {/* Quick Buy Amounts */}
              <div className="py-3 border-b border-gray-800/40">
                <label className="block text-xs text-gray-500 mb-2">Quick Buy Amounts (ETH)</label>
                  <div className="space-y-2">
                    {quickBuyAmounts.map((amount, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={amount}
                          onChange={(e) => handleUpdateAmount(index, e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
                          placeholder="0.01"
                        />
                        {quickBuyAmounts.length > 1 && (
                          <button
                            onClick={() => handleRemoveAmount(index)}
                          className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {quickBuyAmounts.length < 6 && (
                      <button
                        onClick={handleAddAmount}
                      className="w-full py-2 text-xs text-gray-500 hover:text-gray-400 transition-colors"
                      >
                      + Add amount
                      </button>
                    )}
                  </div>
                </div>

                {/* Default Slippage */}
              <div className="py-3 border-b border-gray-800/40">
                <label className="block text-xs text-gray-500 mb-1.5">Default Slippage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    value={defaultSlippage}
                    onChange={(e) => setDefaultSlippage(parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
                    placeholder="1"
                  />
                </div>

              {/* Preferred DEX */}
              <div className="py-3 border-b border-gray-800/40">
                <label className="block text-xs text-gray-500 mb-1.5">Preferred DEX</label>
                <select
                  value={preferredDex || ''}
                  onChange={(e) => setPreferredDex(e.target.value || null)}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-gray-600 transition-colors"
                >
                  <option value="">Auto (Best Price)</option>
                  <option value="uniswap">Uniswap</option>
                  <option value="sushiswap">SushiSwap</option>
                  <option value="0x">0x Protocol</option>
                </select>
                  </div>

              {/* Auto Approve */}
              <label className="flex items-center justify-between py-3 border-b border-gray-800/40 cursor-pointer">
                <span className="text-sm text-gray-400">Auto approve tokens</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="sr-only"
                    />
                  <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                      autoApprove ? 'bg-blue-500' : 'bg-gray-700'
                    }`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      autoApprove ? 'translate-x-4' : ''
                    }`} />
                    </div>
                  </div>
                </label>

              {/* Auto Profit DCA */}
              <label className="flex items-center justify-between py-3 border-b border-gray-800/40 cursor-pointer">
                <div>
                  <span className="text-sm text-gray-400">Auto Profit DCA</span>
                  <p className="text-xs text-gray-600">Auto-save trading profits</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={autoDcaEnabled}
                    onChange={(e) => {
                      setAutoDcaEnabled(e.target.checked);
                      saveAutoDcaSettings(e.target.checked, autoDcaPercentage, autoDcaAsset);
                    }}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                    autoDcaEnabled ? 'bg-blue-500' : 'bg-gray-700'
                  }`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      autoDcaEnabled ? 'translate-x-4' : ''
                    }`} />
                  </div>
                </div>
                  </label>

              {/* DCA Options - Show when enabled */}
              {autoDcaEnabled && (
                <div className="py-3 border-b border-gray-800/40 space-y-3">
                  {/* Percentage */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">Percentage of profit</span>
                      <span className="text-xs text-blue-400">{autoDcaPercentage}%</span>
                    </div>
                    <div className="flex gap-2">
                      {[5, 10, 25, 50].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => {
                            setAutoDcaPercentage(pct);
                            saveAutoDcaSettings(autoDcaEnabled, pct, autoDcaAsset);
                          }}
                          className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                            autoDcaPercentage === pct
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                </div>

                  {/* Asset Selection */}
                  <div>
                    <span className="text-xs text-gray-500 block mb-2">DCA into</span>
                    <div className="grid grid-cols-2 gap-2">
                      {DCA_ASSETS.map((asset) => (
                        <button
                          key={asset.symbol}
                          onClick={() => {
                            setAutoDcaAsset(asset.symbol);
                            saveAutoDcaSettings(autoDcaEnabled, autoDcaPercentage, asset.symbol);
                          }}
                          className={`py-2 px-3 text-xs rounded transition-colors ${
                            autoDcaAsset === asset.symbol
                              ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'
                          }`}
                        >
                          {asset.symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Save Trading Settings Button */}
              <div className="pt-3">
                <button
                  onClick={handleSaveQuickBuyConfig}
                  disabled={savingQuickBuy || quickBuyConfigLoading}
                  className="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
                >
                  {savingQuickBuy ? 'Saving...' : 'Save Trading Settings'}
                </button>
              </div>
            </div>

            {/* Settings Status Messages */}
            {settingsStatus !== 'idle' && settingsMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 text-xs flex items-center gap-2 rounded-xl ${
                  settingsStatus === 'success' 
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-red-500/15 text-red-400'
                }`}
              >
                {settingsStatus === 'success' ? <FiCheck className="w-4 h-4" /> : <FiAlertCircle className="w-4 h-4" />}
                <span>{settingsMessage}</span>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 px-4 sm:px-5 py-4 border-t border-gray-800/60 flex-shrink-0">
              <button
                onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-900/60 border border-gray-800/60 text-gray-300 hover:bg-gray-800/60 hover:border-gray-700 rounded-xl transition-all duration-200 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-200 flex items-center justify-center gap-2 font-medium text-sm"
              >
                {savingSettings ? (
                  <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Header;