"use client";

import { useState, useEffect } from "react";
import { motion, useScroll } from "framer-motion";
import Link from "next/link";

import Header from "./components/Header";
import GlobalSearch from "./components/GlobalSearch";
import CountUp from "./components/CountUp";

// Enhanced animation variants with scroll triggers

const heroVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 1.2,
      staggerChildren: 0.3,
      // Omit `ease` to keep types compatible with framer-motion's Transition definitions
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.8,
      // Omit `ease` to keep variants compatible with strict framer-motion typings
    },
  },
};

// Enhanced fadeInUp with scroll trigger
function fadeInUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 60, scale: 0.95 },
    whileInView: { opacity: 1, y: 0, scale: 1 },
    viewport: { once: true, margin: "-50px" },
    transition: { 
      duration: 0.8, 
      delay: delay * 0.15, 
      // `ease` removed to avoid TS type mismatch; default easing still looks smooth
    },
  };
}

// Lightweight background orbs using CSS animations
const LightweightOrbs = () => (
  <>
    {/* Desktop: 3 orbs */}
    <div className="hidden sm:block">
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>
    </div>
    {/* Mobile: 2 orbs */}
    <div className="block sm:hidden">
      <div className="orb orb-mobile-1"></div>
      <div className="orb orb-mobile-2"></div>
    </div>
  </>
);

export default function Page() {
  const { scrollYProgress } = useScroll();
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [totalTokens, setTotalTokens] = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Track scroll progress for scroll to top button
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      setShowScrollToTop(latest > 0.1);
    });
    return unsubscribe;
  }, [scrollYProgress]);

  // Fetch stats from APIs
  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch active users count
        const usersResponse = await fetch('/api/stats/active-users');
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          console.log('Active users API response:', usersData);
          if (usersData.success) {
            const count = usersData.activeUsers || 0;
            console.log('Setting active users to:', count);
            setActiveUsers(count);
          } else {
            console.error('Active users API returned success: false', usersData);
          }
        } else {
          console.error('Active users API failed with status:', usersResponse.status);
        }

        // Fetch total tokens count
        const tokensResponse = await fetch('/api/stats/tokens');
        if (tokensResponse.ok) {
          const tokensData = await tokensResponse.json();
          console.log('Tokens API response:', tokensData);
          if (tokensData.success) {
            const count = tokensData.totalTokens || 0;
            console.log('Setting total tokens to:', count);
            setTotalTokens(count);
          } else {
            console.error('Tokens API returned success: false', tokensData);
          }
        } else {
          console.error('Tokens API failed with status:', tokensResponse.status);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setStatsLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
      <div className="min-h-screen flex flex-col bg-gray-950 overflow-x-hidden">
        <Header />

        {/* Separator line between header and content */}
        <div className="border-b border-gray-800/50"></div>

        <main className="flex-1 text-gray-200 relative overflow-x-hidden" style={{ overflowY: 'visible' }}>
          <div className="fixed inset-0 bg-gray-950 -z-10"></div>

          {/* Hero Section */}
          <motion.div 
            className="relative w-full min-h-[60vh] sm:min-h-[60vh] flex items-center justify-center overflow-visible pt-8 sm:pt-0"
            variants={heroVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <LightweightOrbs />
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-950 via-gray-950/70 to-transparent pointer-events-none"></div>

            <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              {/* Enhanced Main Heading */}
              <motion.div
                variants={itemVariants}
                className="mb-8 sm:mb-6 pt-8 sm:pt-6 lg:pt-2"
              >
                {/* Small Badge */}
                <motion.div
                  variants={itemVariants}
                  className="flex justify-center mb-4"
                >
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                    INSTANT SWAP-EXECUTIONS
                  </span>
                </motion.div>
                
                {/* Enhanced Subtitle */}
                <motion.p 
                  className="text-lg sm:text-xl lg:text-2xl xl:text-[2.3rem] text-gray-300 max-w-4xl mx-auto font-light mb-8 sm:mb-6 leading-[1.95] tracking-[0.014em]"
                  variants={itemVariants}
                >
                  Advanced analytics, real-time insights, and{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-500 to-blue-300 font-semibold">
                    AI-powered intelligence
                  </span>{" "}
                  for the next generation of decentralized trading
                </motion.p>
              </motion.div>

              {/* Enhanced Global Search Bar */}
              <motion.div
                variants={itemVariants}
                className="mb-8 sm:mb-6 max-w-2xl mx-auto relative"
                style={{ overflow: 'visible' }}
              >
                <GlobalSearch 
                  placeholder="Search for tokens, addresses, txs, insights, events, or blocks..."
                  variant="homepage"
                />
                {/* Small status text */}
                <div className="flex justify-center mt-2">
                  <span className="text-xs text-gray-500 flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
                    Real-time data • {statsLoading ? '...' : totalTokens.toLocaleString()} tokens indexed
                  </span>
                </div>
              </motion.div>


              {/* Enhanced Stats Section */}
              <motion.div
                variants={itemVariants}
                className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-8 sm:mb-0"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
              >
                <motion.div 
                  className="text-center group"
                  variants={itemVariants}
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <CountUp 
                    key={activeUsers} // Force remount when value changes from 0 to real value
                    end={activeUsers || 0}
                    duration={2500}
                    delay={500}
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-400 mb-1 sm:mb-2 group-hover:text-blue-300 transition-colors"
                  />
                  <div className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">Active Users</div>
                </motion.div>
                <motion.div 
                  className="text-center group"
                  variants={itemVariants}
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <CountUp 
                    end={2}
                    duration={2000}
                    delay={800}
                    prefix="$"
                    suffix="B+"
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-400 mb-1 sm:mb-2 group-hover:text-blue-300 transition-colors"
                  />
                  <div className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">Volume Tracked</div>
                </motion.div>
                <motion.div 
                  className="text-center group"
                  variants={itemVariants}
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <CountUp 
                    end={99.9}
                    duration={1800}
                    delay={1100}
                    suffix="%"
                    decimals={1}
                  className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-400 mb-1 sm:mb-2 group-hover:text-blue-300 transition-colors"
                  />
                  <div className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">Uptime</div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>

          {/* Content Section with Enhanced Padding */}
          <div className="relative z-10 p-4 sm:p-6 lg:p-10 pt-8 sm:pt-6 lg:pt-8">
            
            {/* Discover Section */}
            <motion.div className="mb-16" {...fadeInUp(0.1)}>
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10 px-4">
                
                {/* Left Panel - Token Discovery */}
                <div className="lg:col-span-1 flex flex-col items-center lg:items-start justify-start lg:justify-center lg:pr-8 px-4 text-center lg:text-left">
                  <div className="relative">

                    
                    {/* Section number */}
                    <div className="text-blue-400 text-sm mb-4 font-medium">[ 01. ]</div>
                    
                    {/* Heading */}
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Token Discovery</h2>
                    
                    {/* Subtitle */}
                    <p className="text-gray-400 mb-6 text-sm sm:text-base">Discover new tokens and filter by your preferences.</p>
                    
                    {/* CTA Button */}
                    {/* Removed Start Trading button */}
          </div>
        </div>
                
                                {/* Right Panel - Token Table */}
                <div className="lg:col-span-2 lg:pr-12 px-2 sm:px-4 lg:px-6">
                  {/* Token Table */}
                  <div className="bg-gray-950 border border-gray-800 overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-gray-900 px-2 sm:px-4 py-3 border-b border-gray-800">
                      <div className="grid text-xs text-gray-400 font-medium min-w-[760px] items-center" style={{ gridTemplateColumns: 'minmax(140px, 1.5fr) minmax(80px, 1fr) minmax(70px, 1fr) minmax(90px, 1.2fr) minmax(70px, 1fr) minmax(80px, 1.2fr) minmax(80px, 1fr)', gap: '0.5rem 1rem' }}>
                        <div className="truncate">PAIR</div>
                        <div className="truncate">CREATED</div>
                        <div className="truncate">LIQUIDITY</div>
                        <div className="truncate">PRICE</div>
                        <div className="truncate">FDV</div>
                        <div className="truncate">TXNS</div>
                        <div className="truncate">VOLUME</div>
                      </div>
                    </div>
                    
                    {/* Table Body */}
                    <div className="max-h-96 overflow-y-auto">
                      {/* Scrollable container for mobile */}
                      <div className="overflow-x-auto scrollbar-hide">
                        <div className="min-w-[760px]">
                          {/* Token Row 1 */}
                          <div className="px-2 sm:px-4 py-3 border-b border-gray-800">
                            <div className="grid text-xs sm:text-sm items-center" style={{ gridTemplateColumns: 'minmax(140px, 1.5fr) minmax(80px, 1fr) minmax(70px, 1fr) minmax(90px, 1.2fr) minmax(70px, 1fr) minmax(80px, 1.2fr) minmax(80px, 1fr)', gap: '0.5rem 1rem' }}>
                              <div className="min-w-0">
                                <div className="text-white font-medium truncate">
                                  <span className="sm:hidden">$CYPHX</span>
                                  <span className="hidden sm:inline">$CYPHX/WETH</span>
                                </div>
                                <div className="text-gray-500 text-xs truncate">0x8f2a...4b3c</div>
                              </div>
                              <div className="text-gray-300 truncate">12h 45m</div>
                              <div className="text-gray-300 truncate">$42K</div>
                              <div className="min-w-0">
                                <div className="text-gray-300 truncate">$0.0024</div>
                                <div className="text-green-400 text-xs truncate">+ 468.64%</div>
                              </div>
                              <div className="text-gray-300 truncate">$89K</div>
                              <div className="min-w-0">
                                <div className="text-gray-300 truncate">5.2K</div>
                                <div className="text-gray-500 text-xs truncate">3120 / 2080</div>
                              </div>
                              <div className="text-gray-300 truncate">$2.1M</div>
                            </div>
                          </div>
        
                          {/* Token Row 2 */}
                          <div className="px-2 sm:px-4 py-3 border-b border-gray-800">
                            <div className="grid text-xs sm:text-sm items-center" style={{ gridTemplateColumns: 'minmax(140px, 1.5fr) minmax(80px, 1fr) minmax(70px, 1fr) minmax(90px, 1.2fr) minmax(70px, 1fr) minmax(80px, 1.2fr) minmax(80px, 1fr)', gap: '0.5rem 1rem' }}>
                              <div className="min-w-0">
                                <div className="text-white font-medium truncate">
                                  <span className="sm:hidden">$ALPHA</span>
                                  <span className="hidden sm:inline">$ALPHA/WETH</span>
                                </div>
                                <div className="text-gray-500 text-xs truncate">0x7d9e...5f2a</div>
                              </div>
                              <div className="text-gray-300 truncate">8h 22m</div>
                              <div className="text-gray-300 truncate">$24K</div>
                              <div className="min-w-0">
                                <div className="text-gray-300 truncate">$0.0018</div>
                                <div className="text-green-400 text-xs truncate">+ 433.30%</div>
                              </div>
                              <div className="text-gray-300 truncate">$67K</div>
                              <div className="min-w-0">
                                <div className="text-gray-300 truncate">4.1K</div>
                                <div className="text-gray-500 text-xs truncate">2456 / 1644</div>
                              </div>
                              <div className="text-gray-300 truncate">$1.8M</div>
                            </div>
                          </div>
                      
                      {/* Token Row 3 */}
                      <div className="px-2 sm:px-4 py-3 border-b border-gray-800">
                        <div className="grid text-xs sm:text-sm items-center" style={{ gridTemplateColumns: 'minmax(140px, 1.5fr) minmax(80px, 1fr) minmax(70px, 1fr) minmax(90px, 1.2fr) minmax(70px, 1fr) minmax(80px, 1.2fr) minmax(80px, 1fr)', gap: '0.5rem 1rem' }}>
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">
                              <span className="sm:hidden">$QUANT</span>
                              <span className="hidden sm:inline">$QUANT/WETH</span>
                            </div>
                            <div className="text-gray-500 text-xs truncate">0x3b4c...9e1f</div>
                          </div>
                          <div className="text-gray-300 truncate">15h 8m</div>
                          <div className="text-gray-300 truncate">$11K</div>
                          <div className="min-w-0">
                            <div className="text-gray-300 truncate">$0.0009</div>
                            <div className="text-green-400 text-xs truncate">+ 378.97%</div>
                          </div>
                          <div className="text-gray-300 truncate">$28K</div>
                          <div className="min-w-0">
                            <div className="text-gray-300 truncate">3.7K</div>
                            <div className="text-gray-500 text-xs truncate">1987 / 1713</div>
                          </div>
                          <div className="text-gray-300 truncate">$890K</div>
                        </div>
                      </div>

                      {/* Token Row 4 */}
                      <div className="px-2 sm:px-4 py-3 border-b border-gray-800">
                        <div className="grid text-xs sm:text-sm items-center" style={{ gridTemplateColumns: 'minmax(140px, 1.5fr) minmax(80px, 1fr) minmax(70px, 1fr) minmax(90px, 1.2fr) minmax(70px, 1fr) minmax(80px, 1.2fr) minmax(80px, 1fr)', gap: '0.5rem 1rem' }}>
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">
                              <span className="sm:hidden">$SWIFT</span>
                              <span className="hidden sm:inline">$SWIFT/WETH</span>
                            </div>
                            <div className="text-gray-500 text-xs truncate">0x9a2b...7c4d</div>
                          </div>
                          <div className="text-gray-300 truncate">6h 15m</div>
                          <div className="text-gray-300 truncate">$18K</div>
                          <div className="min-w-0">
                            <div className="text-gray-300 truncate">$0.0032</div>
                            <div className="text-green-400 text-xs truncate">+ 245.67%</div>
                          </div>
                          <div className="text-gray-300 truncate">$45K</div>
                          <div className="min-w-0">
                            <div className="text-gray-300 truncate">2.8K</div>
                            <div className="text-gray-500 text-xs truncate">1689 / 1111</div>
                          </div>
                          <div className="text-gray-300 truncate">$720K</div>
                        </div>
                      </div>
                      
                      {/* Token Row 5 */}
                      <div className="px-2 sm:px-4 py-3 border-b border-gray-800">
                        <div className="grid text-xs sm:text-sm items-center" style={{ gridTemplateColumns: 'minmax(140px, 1.5fr) minmax(80px, 1fr) minmax(70px, 1fr) minmax(90px, 1.2fr) minmax(70px, 1fr) minmax(80px, 1.2fr) minmax(80px, 1fr)', gap: '0.5rem 1rem' }}>
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">
                              <span className="sm:hidden">$NEXUS</span>
                              <span className="hidden sm:inline">$NEXUS/WETH</span>
                            </div>
                            <div className="text-gray-500 text-xs truncate">0x5e8f...9a1b</div>
                          </div>
                          <div className="text-gray-300 truncate">19h 42m</div>
                          <div className="text-gray-300 truncate">$8.5K</div>
                          <div className="min-w-0">
                            <div className="text-gray-300 truncate">$0.0006</div>
                            <div className="text-green-400 text-xs truncate">+ 156.23%</div>
                          </div>
                          <div className="text-gray-300 truncate">$22K</div>
                          <div className="min-w-0">
                            <div className="text-gray-300 truncate">1.9K</div>
                            <div className="text-gray-500 text-xs truncate">1123 / 777</div>
                          </div>
                          <div className="text-gray-300 truncate">$340K</div>
                        </div>
                      </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Table Footer */}
                    <div className="bg-gray-900 px-2 sm:px-4 py-3 border-t border-gray-800">
                      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs text-gray-400">
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                          <span>Audited Contract</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                          <span>Contract Renounced</span>
                  </div>
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>Liquidity Locked</span>
              </div>
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>Not Honey Pot</span>
            </div>
                      </div>
                    </div>
                  </div>
                </div>
      </div>
    </motion.div>
            
            {/* Separator line between Discover and Features */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent mb-16"></div>

            {/* Chart Section */}
            <motion.div className="mb-16" {...fadeInUp(0.1)}>
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10 px-4">
                {/* Left Panel - Chart Info */}
                <div className="lg:col-span-1 flex flex-col items-center lg:items-start justify-start lg:justify-center lg:pr-8 px-4 text-center lg:text-left">
                  <div className="relative">
                    <div className="text-blue-400 text-sm mb-4 font-medium">[ 02. ]</div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-3">Advanced Charts</h2>
                    <p className="text-gray-400 mb-6 text-sm sm:text-base">Professional TradingView charts with advanced indicators and real-time data.</p>
                    {/* Removed View Charts button */}
                  </div>
                </div>

                {/* Right Panel - Mini Chart */}
                <div className="lg:col-span-2 lg:pr-12 px-2 sm:px-4 lg:px-6">
                  <div className="bg-gray-950/80 border border-gray-800 p-6 sm:p-8 flex items-center justify-center min-h-[320px]">
                    <div className="w-full max-w-3xl aspect-[16/9] border-2 border-dashed border-blue-500/30 bg-gradient-to-br from-gray-900/60 via-gray-900/30 to-gray-900/10 flex flex-col items-center justify-center text-gray-500">
                      <svg className="w-10 h-10 text-blue-400/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 19V7l6-3 6 3 4 2v10H4z" />
                      </svg>
                      <p className="text-sm sm:text-base text-gray-400/80">Chart showcase placeholder</p>
                      <p className="text-xs text-gray-500 mt-1">Drop in a hero chart image here later</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Powered By Section */}
            <motion.div className="mb-16" {...fadeInUp(0.2)}>
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10 px-4 items-stretch">
                <div className="lg:col-span-1 flex flex-col items-center lg:items-start justify-start lg:justify-center lg:pr-8 px-4 text-center lg:text-left">
                  <div className="relative">
                    <div className="text-blue-400 text-sm mb-4 font-medium">[ 03. ]</div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Powered By</h2>
                    <p className="text-gray-400 mb-6 text-sm sm:text-base">
                      We partner with category leaders to deliver deep liquidity, resilient infrastructure, and always-on market intelligence.
                    </p>
                  </div>
                </div>
                <div className="lg:col-span-2 lg:pr-12 px-2 sm:px-4 lg:px-6">
                  <div className="p-4 sm:p-6">
                    <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1 md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-6 md:overflow-visible">
                      <div className="group relative flex min-w-[220px] items-center gap-4 bg-gray-900/40 p-4 transition-all duration-300 hover:bg-blue-500/5 md:min-w-0">
                        <div className="w-16 h-16 bg-gray-950/70 border border-gray-800 flex items-center justify-center">
                          <img src="https://i.imgur.com/9Y7BIHa.png" alt="0x Protocol" className="h-10 object-contain" />
                        </div>
                        <div>
                          <p className="text-white text-sm sm:text-base font-semibold">0x Protocol</p>
                          <p className="text-xs text-gray-400">Aggregation & smart order routing</p>
                        </div>
                      </div>
                      <div className="group relative flex min-w-[220px] items-center gap-4 bg-gray-900/40 p-4 transition-all duration-300 hover:bg-blue-500/5 md:min-w-0">
                        <div className="w-16 h-16 bg-gray-950/70 border border-gray-800 flex items-center justify-center">
                          <img src="https://i.imgur.com/RWgPgY1.png" alt="Coinbase" className="h-10 object-contain" />
                        </div>
                        <div>
                          <p className="text-white text-sm sm:text-base font-semibold">Coinbase</p>
                          <p className="text-xs text-gray-400">Base chain infrastructure & custody</p>
                        </div>
                      </div>
                      <div className="group relative flex min-w-[220px] items-center gap-4 bg-gray-900/40 p-4 transition-all duration-300 hover:bg-blue-500/5 md:min-w-0">
                        <div className="w-16 h-16 bg-gray-950/70 border border-gray-800 flex items-center justify-center">
                          <img src="https://i.imgur.com/LweKEMF.png" alt="Dexscreener" className="h-10 object-contain" />
                        </div>
                        <div>
                          <p className="text-white text-sm sm:text-base font-semibold">Dexscreener</p>
                          <p className="text-xs text-gray-400">Live market discovery</p>
                        </div>
                      </div>
                      <div className="group relative flex min-w-[220px] items-center gap-4 bg-gray-900/40 p-4 transition-all duration-300 hover:bg-blue-500/5 md:min-w-0">
                        <div className="w-16 h-16 bg-gray-950/70 border border-gray-800 flex items-center justify-center">
                          <img src="https://i.imgur.com/coHc8sq.png" alt="Alchemy" className="h-10 object-contain" />
                        </div>
                        <div>
                          <p className="text-white text-sm sm:text-base font-semibold">Alchemy</p>
                          <p className="text-xs text-gray-400">Scalable data + node services</p>
                        </div>
                      </div>
                      <div className="group relative flex min-w-[220px] items-center gap-4 bg-gray-900/40 p-4 transition-all duration-300 hover:bg-blue-500/5 md:min-w-0">
                        <div className="w-16 h-16 bg-gray-950/70 border border-gray-800 flex items-center justify-center">
                          <img src="https://i.imgur.com/UgezDbe.png" alt="CoinGecko" className="h-10 object-contain" />
                        </div>
                        <div>
                          <p className="text-white text-sm sm:text-base font-semibold">CoinGecko</p>
                          <p className="text-xs text-gray-400">Global pricing & token intelligence</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Separator line between Chart and Features */}
            <div className="border-b border-gray-800/30 mb-16"></div>

            {/* Features Section */}
            <motion.div className="mb-12 sm:mb-16" {...fadeInUp(0)}>
              <div className="max-w-6xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 lg:px-0">
            <div className="grid gap-3 sm:gap-4 lg:gap-5 lg:grid-cols-5">
                  <div className="lg:col-span-3 relative overflow-hidden border border-blue-500/10 bg-gradient-to-br from-blue-900/15 via-gray-950 to-gray-950 p-3 sm:p-4 lg:p-6 xl:p-8">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/15 via-transparent to-blue-400/10 pointer-events-none"></div>
                    <div className="hidden sm:block absolute -top-20 -right-24 w-56 h-56 bg-blue-500/20 blur-3xl"></div>
                    <div className="hidden sm:block absolute -bottom-24 -left-10 w-48 h-48 bg-blue-500/10 blur-3xl"></div>
                    <div className="relative space-y-4 sm:space-y-5 lg:space-y-6">
                      <div className="space-y-1.5 sm:space-y-2">
                        <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-blue-200/80">Execution Engine</span>
                        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mt-1 sm:mt-2">Built for decisive traders</h3>
                        <p className="text-gray-400 text-xs sm:text-sm lg:text-base">
                          From the first price check to the executed trade, CypherX keeps you locked into the market with deep liquidity routing, precision controls, and contextual insights.
                        </p>
                      </div>
                      <div className="grid gap-2.5 sm:gap-3 sm:grid-cols-2">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="mt-0.5 sm:mt-1 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center bg-blue-600/20 text-blue-300 shrink-0">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-semibold text-xs sm:text-sm lg:text-base">Instant Swap Executions</p>
                            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 leading-tight">Optimized routing with sub-second confirmations across Base liquidity venues.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="mt-0.5 sm:mt-1 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center bg-blue-600/20 text-blue-300 shrink-0">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7h18M3 12h18M3 17h10" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-semibold text-xs sm:text-sm lg:text-base">Quick Buys & Automation</p>
                            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 leading-tight">Preset slippage, gas, and sizing ready for one-click execution when the setup appears.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="mt-0.5 sm:mt-1 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center bg-blue-600/20 text-blue-300 shrink-0">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5h16M4 9.5h10M4 14h7M4 18.5h4" />
                              <circle cx="17" cy="9.5" r="1.8" strokeWidth={1.8} />
                              <circle cx="14" cy="14" r="1.8" strokeWidth={1.8} />
                              <circle cx="11" cy="18.5" r="1.8" strokeWidth={1.8} />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-semibold text-xs sm:text-sm lg:text-base">In-context Analytics</p>
                            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 leading-tight">TradingView-grade visuals, live orderflow, and on-chain activity where you trade.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="mt-0.5 sm:mt-1 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center bg-blue-600/20 text-blue-300 shrink-0">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5h14v14H5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 9h6v6H9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 5v4M11 19v-4" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-semibold text-xs sm:text-sm lg:text-base">Portfolio Intelligence</p>
                            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 leading-tight">Monitor PnL, holdings, and reward multipliers without leaving the terminal.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2 flex flex-col gap-2.5 sm:gap-3.5 lg:gap-4">
                    <div className="border border-gray-800/80 bg-gray-950/80 p-3 sm:p-4 lg:p-5 shadow-lg shadow-blue-900/10">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 sm:mb-3">
                        <div>
                          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-blue-300/80">Swap Timeline</p>
                          <h3 className="text-white text-base sm:text-lg lg:text-xl font-semibold mt-0.5 sm:mt-1">Execution flow in seconds</h3>
                        </div>
                        <div className="hidden sm:flex h-10 w-10 items-center justify-center bg-blue-600/20 text-blue-300">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 1" />
                          </svg>
                        </div>
                      </div>
                      <div className="space-y-2 sm:space-y-2.5 lg:space-y-3">
                        {[
                          { title: "Scan", description: "Detect price dislocations with market scanners and custom alerts." },
                          { title: "Size", description: "Auto-calc position sizing, slippage ceilings, and gas strategy." },
                          { title: "Execute", description: "Route through 0x with instant confirmations and slippage protection." }
                        ].map((step, idx) => (
                          <div key={step.title} className="flex gap-2 sm:gap-3">
                            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center border border-blue-500/40 bg-blue-600/10 text-blue-200 text-[10px] sm:text-xs font-semibold shrink-0">
                              0{idx + 1}
                            </div>
                            <div>
                              <p className="text-white text-xs sm:text-sm font-semibold">{step.title}</p>
                              <p className="text-[11px] sm:text-xs text-gray-400 leading-tight">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border border-gray-800/80 bg-gradient-to-r from-blue-600/20 via-blue-500/10 to-transparent p-3 sm:p-4 lg:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                        <div>
                          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-blue-200/80">Quick Buys</p>
                          <h3 className="text-white text-base sm:text-lg lg:text-xl font-semibold mt-0.5 sm:mt-1">Preset macros for every setup</h3>
                          <p className="text-[11px] sm:text-xs text-gray-300 mt-1.5 sm:mt-2 leading-tight">
                            Save your favorite routes, gas profiles, and trade sizes. Fire instantly when liquidity spikes.
                          </p>
                        </div>
                        <button className="self-start sm:self-auto inline-flex items-center gap-2 border border-blue-400/40 bg-blue-500/10 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-blue-200 hover:bg-blue-500/20 transition">
                          <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Launch Macro
                        </button>
                      </div>
                      <div className="mt-3 sm:mt-4 grid gap-2 sm:gap-2.5 sm:grid-cols-3">
                        <div className="border border-blue-500/20 bg-gray-950/80 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-gray-300">
                          <p className="text-blue-200 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] mb-0.5 sm:mb-1">Slippage</p>
                          <p className="text-white font-semibold">0.5%</p>
                        </div>
                        <div className="border border-blue-500/20 bg-gray-950/80 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-gray-300">
                          <p className="text-blue-200 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] mb-0.5 sm:mb-1">Size</p>
                          <p className="text-white font-semibold">0.01 ETH</p>
                        </div>
                        <div className="border border-blue-500/20 bg-gray-950/80 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-gray-300">
                          <p className="text-blue-200 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] mb-0.5 sm:mb-1">Preset</p>
                          <p className="text-white font-semibold">Breakout</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 sm:mt-12 lg:mt-16 flex flex-col gap-8 sm:gap-10 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-10 lg:gap-x-8 lg:gap-y-12 xl:grid-cols-4">
                  {[
                    {
                      title: "TradingView Charts",
                      description: "Advanced overlays, multi-timeframe layouts, and drawing suites—embedded directly in the terminal."
                    },
                    {
                      title: "Self-Custodial Wallet",
                      description: "Multi-layer security with 2FA, session approvals, and hardware support—your keys, always."
                    },
                    {
                      title: "Portfolio Tracking",
                      description: "Real-time PnL, realized vs unrealized returns, and multi-wallet aggregation with one dashboard."
                    },
                    {
                      title: "Rewards Program",
                      description: "Earn CYPHX on trading fees, multiplier boosts for loyalty, and referral yields for growing the network."
                    }
                  ].map((card) => (
                    <div key={card.title} className="border border-gray-800/80 bg-gray-950/80 p-4 transition-all duration-300 hover:border-blue-500/40 hover:bg-blue-500/5">
                      <div className="mb-3 h-0.5 w-12 rounded-full bg-blue-500/40"></div>
                      <h3 className="text-white text-base font-semibold mb-1.5">{card.title}</h3>
                      <p className="text-sm text-gray-400">{card.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Separator line between Features and 3D Coins */}
            <div className="border-b border-gray-800/30 mb-16"></div>

          {/* Hold Trade Earn Section */}
          <motion.div
            className="mb-16"
            {...fadeInUp(0.3)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="relative max-w-6xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 lg:px-0">
              <div className="relative overflow-hidden border border-gray-800/70 bg-gradient-to-br from-gray-900 via-gray-950 to-blue-950 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
                <div className="hidden sm:block absolute -top-32 right-0 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl"></div>
                <div className="hidden sm:block absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"></div>
                <div className="relative grid gap-6 sm:gap-8 lg:grid-cols-2 items-start">
                  <div className="space-y-5 sm:space-y-6">
                    <div>
                      <span className="inline-flex items-center gap-2 border border-blue-500/40 bg-blue-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-200">
                        Rewards Ecosystem
                      </span>
                      <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Hold. Trade. Earn.
                      </h2>
                      <p className="mt-3 text-gray-300 text-sm sm:text-base max-w-xl">
                        CYPHX rewards align incentives between active traders and long term holders. Grow your stack with dynamic revenue sharing, loyalty multipliers, and community-driven referrals.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:gap-2.5 sm:grid-cols-2">
                      {[
                        {
                          title: "Revenue Share",
                          description: "Distribute trading fees back to top liquidity providers and power users.",
                          icon: (
                            <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c1.657 0 3-1.343 3-3S13.657 2 12 2 9 3.343 9 5s1.343 3 3 3zM19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" />
                            </svg>
                          )
                        },
                        {
                          title: "Streak Multipliers",
                          description: "Boost your share with weekly trading streaks and liquidity commitments.",
                          icon: (
                            <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
                            </svg>
                          )
                        },
                        {
                          title: "Referral Yield",
                          description: "Earn a percentage of friend activity by sharing your CypherX access link.",
                          icon: (
                            <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="6" r="2.5" strokeWidth={1.8} />
                              <circle cx="6.5" cy="18" r="2.5" strokeWidth={1.8} />
                              <circle cx="17.5" cy="18" r="2.5" strokeWidth={1.8} />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 8.8l-2.6 4.6" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 8.8l2.6 4.6" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7.8 16.7l2.4-2.4" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.2 16.7l-2.4-2.4" />
                            </svg>
                          )
                        },
                        {
                          title: "Vault Security",
                          description: "Pooled rewards are protected with multi-sig safeguards and 24/7 monitoring.",
                          icon: (
                            <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21v-2a4 4 0 00-4-4h-6a4 4 0 00-4 4v2" />
                            </svg>
                          )
                        }
                      ].map((card) => (
                        <div key={card.title} className="border border-blue-500/20 bg-gray-950/80 p-4 hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors">
                          <div className="mb-2.5 inline-flex h-9 w-9 items-center justify-center bg-blue-600/15 border border-blue-500/30">
                            {card.icon}
                          </div>
                          <p className="text-white font-semibold text-sm">{card.title}</p>
                          <p className="text-xs text-gray-400 mt-1">{card.description}</p>
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/rewards"
                      className="inline-flex items-center gap-2 border border-blue-400/60 bg-blue-500/10 px-4 py-1.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 transition"
                    >
                      Explore Rewards
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>

                  <div className="hidden sm:block space-y-3.5 sm:space-y-4">
                    <div className="border border-blue-500/20 bg-gray-950/80 p-4 sm:p-6 shadow-xl shadow-blue-900/10">
                      <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">Growth Loop</p>
                      <h3 className="mt-2 text-white text-xl font-semibold">Compounding your edge</h3>
                      <div className="mt-4 space-y-3.5">
                        {[
                          {
                            title: "Trade & Provide",
                            description: "Execute swaps or supply liquidity to qualify for weekly snapshots.",
                            accent: "01"
                          },
                          {
                            title: "Earn & Amplify",
                            description: "Claim CYPHX, activate loyalty multipliers, and stake for boosted APR.",
                            accent: "02"
                          },
                          {
                            title: "Refer & Compound",
                            description: "Invite your circle to unlock referral tiers and double down on rewards.",
                            accent: "03"
                          }
                        ].map((item) => (
                          <div key={item.title} className="flex gap-3">
                            <div className="flex h-10 w-10 items-center justify-center border border-blue-500/40 bg-blue-600/15 text-blue-200 text-sm font-semibold">
                              {item.accent}
                            </div>
                            <div>
                              <p className="text-white text-sm font-semibold">{item.title}</p>
                              <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Scroll to Top Button */}
      <motion.button
        className="fixed right-6 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-lg z-50 flex items-center justify-center transition-colors"
        style={{ 
          bottom: 'calc(var(--app-footer-height, 0px) + 56px)',
          pointerEvents: showScrollToTop ? 'auto' : 'none' 
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ 
          opacity: showScrollToTop ? 1 : 0,
          scale: showScrollToTop ? 1 : 0
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </motion.button>
    </div>
  );
}