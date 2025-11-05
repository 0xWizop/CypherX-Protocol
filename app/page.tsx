"use client";

import { useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";

import Header from "./components/Header";
import Footer from "./components/Footer";
import GlobalSearch from "./components/GlobalSearch";
import CountUp from "./components/CountUp";

// Custom hook for mobile detection
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return isMobile;
}


// Enhanced animation variants with scroll triggers
const heroVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 1.2,
      staggerChildren: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
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
      ease: [0.25, 0.46, 0.45, 0.94],
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
      ease: [0.25, 0.46, 0.45, 0.94] 
    },
  };
}

// Staggered card animations
const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      delay: i * 0.1,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

export default function Page() {
  const isMobile = useIsMobile();
  const { scrollYProgress } = useScroll();
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [totalTokens, setTotalTokens] = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Parallax effects for background elements
  const backgroundY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const gridOpacity = useTransform(scrollYProgress, [0, 0.5], [0.1, 0.05]);
  
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
          {/* Enhanced Background with Multiple Layers */}
          <div className="fixed inset-0 bg-gray-950 -z-10"></div>
          
          {/* Parallax Background */}
          <motion.div 
            className="fixed inset-0 -z-10 overflow-hidden"
            style={{ y: backgroundY }}
          >
            {/* Primary Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-gray-900/10 to-cyan-900/10"></div>
            
            {/* Animated Grid Pattern */}
            <motion.div 
              className="absolute inset-0"
              style={{ 
                opacity: gridOpacity,
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}
            ></motion.div>
          </motion.div>
          
          {/* Enhanced Hero Section */}
          <motion.div 
            className="relative w-full min-h-[60vh] sm:min-h-[60vh] flex items-center justify-center overflow-visible pt-8 sm:pt-0"
            variants={heroVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
              {/* Animated Grid Pattern */}
              <div className="absolute inset-0 opacity-[0.02]">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.3) 1px, transparent 0)`,
                  backgroundSize: '40px 40px'
                }}></div>
              </div>
              
              {/* Floating Orbs - Desktop Only */}
              {!isMobile && (
                <>
                  <motion.div
                    className="absolute top-1/4 left-1/4 w-40 h-40 bg-blue-500/25 rounded-full blur-2xl"
                    animate={{
                      x: [0, 80, -60, 0],
                      y: [0, -60, 40, 0],
                      scale: [1, 1.2, 0.8, 1],
                    }}
                    transition={{
                      duration: 15,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  <motion.div
                    className="absolute top-1/3 right-1/4 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl"
                    animate={{
                      x: [0, -70, 50, 0],
                      y: [0, 50, -30, 0],
                    }}
                    transition={{
                      duration: 10,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 2
                    }}
                  />
                  <motion.div
                    className="absolute bottom-1/4 left-1/3 w-28 h-28 bg-cyan-500/20 rounded-full blur-2xl"
                    animate={{
                      x: [0, 90, -40, 0],
                      y: [0, -40, 60, 0],
                    }}
                    transition={{
                      duration: 14,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 4
                    }}
                  />
                </>
              )}
              
              {/* Subtle Gradient Overlays */}
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-cyan-500/5 via-transparent to-blue-500/5"></div>
            </div>
            
            {/* Gradient Fade to Content */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent z-10"></div>
            
            <div className="relative z-20 text-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
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
                  className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl text-gray-300 max-w-4xl mx-auto leading-relaxed font-light mb-8 sm:mb-6"
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
          <div className="relative z-10 p-4 sm:p-6 lg:p-8 pt-8 sm:pt-6 lg:pt-8">
            
            {/* Discover Section */}
            <motion.div className="mb-16" {...fadeInUp(0.1)}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 px-4 lg:px-0">
                
                {/* Left Panel - Token Discovery */}
                <div className="lg:col-span-1 flex items-center justify-center lg:pr-8 px-4 lg:px-0 text-center lg:text-left">
                  <div className="relative">

                    
                    {/* Section number */}
                    <div className="text-blue-400 text-sm mb-4 font-medium">[ 01. ]</div>
                    
                    {/* Heading */}
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Token Discovery</h2>
                    
                    {/* Subtitle */}
                    <p className="text-gray-400 mb-6 text-sm sm:text-base">Discover new tokens and filter by your preferences.</p>
                    
                    {/* CTA Button */}
                    <Link href="/explore" className="inline-block bg-transparent backdrop-blur-sm border-[0.5px] border-blue-500/30 text-white font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-white/5 shadow-lg hover:shadow-xl relative text-sm sm:text-base">
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-600/10 to-blue-500/10"></div>
                      <span className="relative z-10">Start Trading</span>
                    </Link>
          </div>
        </div>
                
                                {/* Right Panel - Token Table */}
                <div className="lg:col-span-2 lg:pr-20 px-2 sm:px-4 lg:px-0">
                  {/* Token Table */}
                  <div className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-gray-900 px-2 sm:px-4 py-3 border-b border-gray-800">
                      <div className="grid grid-cols-9 gap-1 sm:gap-2 lg:gap-4 text-xs text-gray-400 font-medium min-w-[800px]">
                        <div>PAIR</div>
                        <div className="min-w-[80px]">CREATED</div>
                        <div>LIQUIDITY</div>
                        <div>PRICE</div>
                        <div>FDV</div>
                        <div>TXNS</div>
                        <div>VOLUME</div>
                        <div>ALERTS</div>
                        <div>ACTION</div>
      </div>
        </div>
                    
                    {/* Table Body */}
                    <div className="max-h-96 overflow-y-auto">
                      {/* Scrollable container for mobile */}
                      <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                          {/* Token Row 1 */}
                          <div className="px-2 sm:px-4 py-3 border-b border-gray-800">
                            <div className="grid grid-cols-9 gap-1 sm:gap-2 lg:gap-4 text-xs sm:text-sm">
                              <div>
                                <div className="text-white font-medium">
                                  <span className="sm:hidden">$CYPHX</span>
                                  <span className="hidden sm:inline">$CYPHX/WETH</span>
          </div>
                                <div className="text-gray-500 text-xs">0x8f2a...4b3c</div>
        </div>
                              <div className="text-gray-300 min-w-[80px]">12h 45m</div>
                              <div className="text-gray-300">$42K</div>
                              <div>
                                <div className="text-gray-300">$0.0024</div>
                                <div className="text-green-400 text-xs">+ 468.64%</div>
      </div>
                              <div className="text-gray-300">$89K</div>
                              <div>
                                <div className="text-gray-300">5.2K</div>
                                <div className="text-gray-500 text-xs">3120 / 2080</div>
      </div>
                              <div className="text-gray-300">$2.1M</div>
                              <div className="text-gray-300">
                                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
                                <button className="bg-gray-800 text-white px-3 py-1 rounded text-xs flex items-center space-x-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  <span>Quick Buy</span>
                                </button>
                              </div>
          </div>
        </div>
        
                          {/* Token Row 2 */}
                          <div className="px-2 sm:px-4 py-3 border-b border-gray-800">
                            <div className="grid grid-cols-9 gap-1 sm:gap-2 lg:gap-4 text-xs sm:text-sm">
                              <div>
                                <div className="text-white font-medium">
                                  <span className="sm:hidden">$ALPHA</span>
                                  <span className="hidden sm:inline">$ALPHA/WETH</span>
                                </div>
                                <div className="text-gray-500 text-xs">0x7d9e...5f2a</div>
                              </div>
                              <div className="text-gray-300 min-w-[80px]">8h 22m</div>
                              <div className="text-gray-300">$24K</div>
                              <div>
                                <div className="text-gray-300">$0.0018</div>
                                <div className="text-green-400 text-xs">+ 433.30%</div>
                              </div>
                              <div className="text-gray-300">$67K</div>
                              <div>
                                <div className="text-gray-300">4.1K</div>
                                <div className="text-gray-500 text-xs">2456 / 1644</div>
                              </div>
                              <div className="text-gray-300">$1.8M</div>
                              <div className="text-gray-300">
                                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
      </div>
                          <div>
                            <button className="bg-gray-800 text-white px-3 py-1 rounded text-xs flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                              <span>Quick Buy</span>
                            </button>
                  </div>
                        </div>
                      </div>
                      
                      {/* Token Row 3 */}
                      <div className="px-2 sm:px-4 py-3 border-b border-gray-800">
                        <div className="grid grid-cols-9 gap-1 sm:gap-2 lg:gap-4 text-xs sm:text-sm">
                          <div>
                            <div className="text-white font-medium">
                              <span className="sm:hidden">$QUANT</span>
                              <span className="hidden sm:inline">$QUANT/WETH</span>
                            </div>
                            <div className="text-gray-500 text-xs">0x3b4c...9e1f</div>
                          </div>
                          <div className="text-gray-300 min-w-[80px]">15h 8m</div>
                          <div className="text-gray-300">$11K</div>
                          <div>
                            <div className="text-gray-300">$0.0009</div>
                            <div className="text-green-400 text-xs">+ 378.97%</div>
                          </div>
                          <div className="text-gray-300">$28K</div>
                          <div>
                            <div className="text-gray-300">3.7K</div>
                            <div className="text-gray-500 text-xs">1987 / 1713</div>
                          </div>
                          <div className="text-gray-300">$890K</div>
                          <div className="text-gray-300">
                            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                          <div>
                            <button className="bg-gray-800 text-white px-3 py-1 rounded text-xs flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                              <span>Quick Buy</span>
                            </button>
                  </div>
                </div>
              </div>

                      {/* Token Row 4 */}
                      <div className="px-2 sm:px-4 py-3 border-b border-gray-800">
                        <div className="grid grid-cols-9 gap-1 sm:gap-2 lg:gap-4 text-xs sm:text-sm">
                          <div>
                            <div className="text-white font-medium">
                              <span className="sm:hidden">$SWIFT</span>
                              <span className="hidden sm:inline">$SWIFT/WETH</span>
                            </div>
                            <div className="text-gray-500 text-xs">0x9a2b...7c4d</div>
                          </div>
                          <div className="text-gray-300 min-w-[80px]">6h 15m</div>
                          <div className="text-gray-300">$18K</div>
                          <div>
                            <div className="text-gray-300">$0.0032</div>
                            <div className="text-green-400 text-xs">+ 245.67%</div>
                          </div>
                          <div className="text-gray-300">$45K</div>
                          <div>
                            <div className="text-gray-300">2.8K</div>
                            <div className="text-gray-500 text-xs">1689 / 1111</div>
                          </div>
                          <div className="text-gray-300">$720K</div>
                          <div className="text-gray-300">
                            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                          </div>
                          <div>
                            <button className="bg-gray-800 text-white px-3 py-1 rounded text-xs flex items-center space-x-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                              <span>Quick Buy</span>
                    </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Token Row 5 */}
                      <div className="px-2 sm:px-4 py-3 border-b border-gray-800">
                        <div className="grid grid-cols-9 gap-1 sm:gap-2 lg:gap-4 text-xs sm:text-sm">
                          <div>
                            <div className="text-white font-medium">
                              <span className="sm:hidden">$NEXUS</span>
                              <span className="hidden sm:inline">$NEXUS/WETH</span>
                            </div>
                            <div className="text-gray-500 text-xs">0x5e8f...9a1b</div>
                          </div>
                          <div className="text-gray-300 min-w-[80px]">19h 42m</div>
                          <div className="text-gray-300">$8.5K</div>
                          <div>
                            <div className="text-gray-300">$0.0006</div>
                            <div className="text-green-400 text-xs">+ 156.23%</div>
                          </div>
                          <div className="text-gray-300">$22K</div>
                          <div>
                            <div className="text-gray-300">1.9K</div>
                            <div className="text-gray-500 text-xs">1123 / 777</div>
                          </div>
                          <div className="text-gray-300">$340K</div>
                          <div className="text-gray-300">
                            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                      </svg>
                          </div>
                          <div>
                            <button className="bg-gray-800 text-white px-3 py-1 rounded text-xs flex items-center space-x-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                              <span>Quick Buy</span>
                    </button>
                          </div>
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 px-4 lg:px-0">
                {/* Left Panel - Chart Info */}
                <div className="lg:col-span-1 flex items-center justify-center lg:pr-8 px-4 lg:px-0 text-center lg:text-left">
                  <div className="relative">
                    <div className="text-blue-400 text-sm mb-4 font-medium">[ 02. ]</div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-3">Advanced Charts</h2>
                    <p className="text-gray-400 mb-6 text-sm sm:text-base">Professional TradingView charts with advanced indicators and real-time data.</p>
                    <Link href="/explore" className="inline-block bg-transparent backdrop-blur-sm border-[0.5px] border-blue-500/30 text-white font-semibold px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-lg transition-all duration-200 hover:scale-105 hover:bg-white/5 shadow-lg hover:shadow-xl relative text-sm sm:text-base">
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-600/10 to-blue-500/10"></div>
                      <span className="relative z-10">View Charts</span>
                    </Link>
                  </div>
                </div>

                {/* Right Panel - Mini Chart */}
                <div className="lg:col-span-2 lg:pr-20 px-2 sm:px-4 lg:px-0">
                  {/* Single Connected Container */}
                  <div className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
                    {/* Top Header Bar */}
                    <div className="bg-gray-900 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-800">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs sm:text-sm font-bold">C</span>
                          </div>
                          <div>
                            <div className="text-white text-sm sm:text-base font-medium">$CYPHX/WETH</div>
                            <div className="text-gray-400 text-xs flex items-center">
                              <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                              Aerodrome
                            </div>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-white text-base sm:text-lg font-bold">$0.0024</div>
                          <div className="text-green-400 text-xs sm:text-sm">+468.64%</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Performance Metrics Bar */}
                    <div className="bg-gray-900 px-3 sm:px-4 py-2 border-b border-gray-800 overflow-x-auto">
                      <div className="flex items-center justify-between text-xs min-w-max">
                        <div className="flex space-x-2 sm:space-x-4">
                          <span className="text-red-400">5m -0.56%</span>
                          <span className="text-red-400">1h -3.43%</span>
                          <span className="text-red-400">4h -6.51%</span>
                          <span className="text-red-400">24h -15.01%</span>
                        </div>
                        <span className="text-gray-400 ml-4">UTC 20:46:33</span>
                      </div>
                    </div>
                    
                    {/* Chart Controls */}
                    <div className="bg-gray-900 px-3 sm:px-4 py-2 border-b border-gray-800 overflow-x-auto">
                      <div className="flex items-center space-x-2 sm:space-x-3 min-w-max">
                        <select className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700">
                          <option>1d</option>
                          <option>1h</option>
                          <option>4h</option>
                          <option>1w</option>
                        </select>
                        <select className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700">
                          <option>Candle</option>
                          <option>Line</option>
                          <option>Area</option>
                        </select>
                        <button className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700">+</button>
                        <button className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700">-</button>
                        <button className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700">Reset</button>
                      </div>
                    </div>
                    
                    {/* Main Content Area - Chart/Transactions Left, Swap Right */}
                    <div className="flex flex-col lg:flex-row">
                      {/* Left Side - Chart and Transactions */}
                      <div className="flex-1">
                        {/* Chart Area */}
                        <div className="border-b border-gray-700">
                          <div className="bg-gray-950 p-3 sm:p-4 h-[300px] sm:h-[400px] lg:h-[500px]">
                            {/* Chart Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 text-xs text-gray-400 space-y-2 sm:space-y-0">
                              <div className="flex flex-wrap space-x-1 sm:space-x-2">
                                <button className="px-1.5 sm:px-2 py-1 bg-blue-600 text-white text-xs">1s</button>
                                <button className="px-1.5 sm:px-2 py-1 bg-gray-800 text-gray-300 text-xs">1m</button>
                                <button className="px-1.5 sm:px-2 py-1 bg-gray-800 text-gray-300 text-xs">5m</button>
                                <button className="px-1.5 sm:px-2 py-1 bg-gray-800 text-gray-300 text-xs">15m</button>
                                <button className="px-1.5 sm:px-2 py-1 bg-gray-800 text-gray-300 text-xs">1h</button>
                                <button className="px-1.5 sm:px-2 py-1 bg-gray-800 text-gray-300 text-xs">4h</button>
                                <button className="px-1.5 sm:px-2 py-1 bg-gray-800 text-gray-300 text-xs">D</button>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span>Price / MCap</span>
                                <span>USD / WETH</span>
                              </div>
                            </div>
                            
                            {/* Chart Info */}
                            <div className="mb-3 text-xs">
                              <div className="text-white mb-1">$CYPHX/WETH (Market Cap) on Aerodrome - 1D</div>
                              <div className="text-green-400 text-xs">O360.080M H350.34M L307.51M C316.20M -43.88M (-12.19%)</div>
                              <div className="text-gray-400 text-xs">Volume 3.743M</div>
                            </div>
                            
                            {/* Chart Visualization */}
                            <div className="bg-gray-800 h-48 sm:h-64 lg:h-80 flex items-center justify-center relative border border-gray-700">
                              {/* Chart Placeholder */}
                              <div className="text-center">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center mx-auto mb-3">
                                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                </div>
                                <div className="text-gray-400 text-xs sm:text-sm">Chart Area</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Transactions Table */}
                        <div className="bg-gray-950 flex-1">
                          {/* Table Tabs */}
                          <div className="flex space-x-2 sm:space-x-4 p-3 sm:p-4 pb-2 border-b border-gray-700 overflow-x-auto">
                            <button className="text-white text-xs sm:text-sm border-b-2 border-blue-500 pb-1 whitespace-nowrap">Transactions</button>
                            <button className="text-gray-400 text-xs sm:text-sm whitespace-nowrap">Holders</button>
                            <button className="text-gray-400 text-xs sm:text-sm whitespace-nowrap">Orders</button>
                            <button className="text-gray-400 text-xs sm:text-sm whitespace-nowrap">Positions</button>
                          </div>
                          
                          {/* Transactions Table */}
                          <div className="border-t border-gray-700 overflow-x-auto">
                            <table className="w-full text-xs min-w-max">
                              <thead>
                                <tr className="text-gray-400 border-b border-gray-700 bg-gray-900">
                                  <th className="text-left p-2 sm:p-3">TIME</th>
                                  <th className="text-left p-2 sm:p-3">TYPE</th>
                                  <th className="text-left p-2 sm:p-3">USD</th>
                                  <th className="text-left p-2 sm:p-3">PRICE</th>
                                  <th className="text-left p-2 sm:p-3">MAKER</th>
                                </tr>
                              </thead>
                              <tbody className="text-white bg-gray-950">
                                <tr className="border-b border-gray-700">
                                  <td className="p-2 sm:p-3">1m ago</td>
                                  <td className="p-2 sm:p-3 text-green-400">BUY</td>
                                  <td className="p-2 sm:p-3 text-green-400">$294.27</td>
                                  <td className="p-2 sm:p-3">$0.0024</td>
                                  <td className="p-2 sm:p-3 text-gray-400">0x5e2f...9801</td>
                                </tr>
                                <tr className="border-b border-gray-700">
                                  <td className="p-2 sm:p-3">5m ago</td>
                                  <td className="p-2 sm:p-3 text-red-400">SELL</td>
                                  <td className="p-2 sm:p-3 text-red-400">$11.90k</td>
                                  <td className="p-2 sm:p-3">$0.0024</td>
                                  <td className="p-2 sm:p-3 text-gray-400">0x6ea7...0ec6</td>
                                </tr>
                                <tr className="border-b border-gray-700">
                                  <td className="p-2 sm:p-3">21m ago</td>
                                  <td className="p-2 sm:p-3 text-red-400">SELL</td>
                                  <td className="p-2 sm:p-3 text-red-400">$652.65</td>
                                  <td className="p-2 sm:p-3">$0.0024</td>
                                  <td className="p-2 sm:p-3 text-gray-400">0x6ea7...62a8</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right Side - Full Swap Component */}
                      <div className="w-full lg:w-80 bg-gray-950 p-3 sm:p-4 border-t lg:border-t-0 lg:border-l border-gray-700">
                        {/* Token Information */}
                        <div className="mb-4 p-3 border border-gray-700 bg-gray-950">
                          <div className="flex items-center space-x-2 mb-2">
                                                          <div className="w-6 h-6 bg-blue-600 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">C</span>
                              </div>
                            <span className="text-white text-sm font-medium">CypherX (CYPHX)</span>
                            <span className="text-green-400 text-xs">0.5%</span>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <button className="p-1 bg-gray-700 text-gray-400 border border-gray-600">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </button>
                            <button className="p-1 bg-gray-700 text-gray-400 border border-gray-600">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                              </svg>
                            </button>
                            <span className="text-gray-400 text-xs">0xc063...973</span>
                            <button className="text-blue-400 text-xs">Copy</button>
            </div>
          </div>
                        
                                                {/* Buy/Sell Tabs */}
                        <div className="flex space-x-1 mb-4 p-1 bg-gray-950 border border-gray-700">
                          <button className="flex-1 px-2 sm:px-3 py-2 bg-green-500/20 text-green-400 border border-green-500/30 text-xs sm:text-sm font-medium">Buy Token</button>
                          <button className="flex-1 px-2 sm:px-3 py-2 bg-gray-950 text-gray-300 text-xs sm:text-sm">Sell Token</button>
                        </div>
                        
                        {/* Swap Interface */}
                        <div className="bg-gray-950 p-3 sm:p-4 mb-4 border border-gray-700">
                          <div className="mb-4">
                            <div className="text-gray-400 text-xs mb-2">YOU PAY</div>
                            <div className="flex items-center justify-between mb-2">
                              <input type="text" placeholder="0.0" className="bg-transparent text-white text-sm w-16 sm:w-20 border border-gray-600 px-2 py-1" />
                              <span className="text-white text-sm">ETH</span>
                            </div>
                            <div className="flex flex-wrap space-x-1">
                              <button className="px-1.5 sm:px-2 py-1 bg-gray-950 text-white text-xs border border-gray-600">25%</button>
                              <button className="px-1.5 sm:px-2 py-1 bg-gray-950 text-white text-xs border border-gray-600">50%</button>
                              <button className="px-1.5 sm:px-2 py-1 bg-gray-950 text-white text-xs border border-gray-600">75%</button>
                              <button className="px-1.5 sm:px-2 py-1 bg-gray-950 text-white text-xs border border-gray-600">Max</button>
                            </div>
                          </div>
                          
                          <div className="flex justify-center mb-4">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          </div>
                          
                          <div className="mb-4">
                            <div className="text-gray-400 text-xs mb-2">YOU RECEIVE</div>
                            <div className="flex items-center justify-between">
                              <input type="text" placeholder="Enter amount above" className="bg-transparent text-gray-400 text-sm w-24 sm:w-32 border border-gray-600 px-2 py-1" />
                              <span className="text-white text-sm">CYPHX</span>
                            </div>
                          </div>
                          
                          <button className="w-full bg-green-500/20 text-green-400 border border-green-500/30 py-2 sm:py-3 text-sm font-medium">
                            Buy CYPHX
                          </button>
                        </div>
                        
                        {/* Wallet Information */}
                        <div className="mb-4 p-3 border border-gray-700 bg-gray-950">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white text-xs sm:text-sm">• Wallet 0x3185...e274</span>
                            <button className="text-blue-400 text-xs">Copy</button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="bg-gray-950 p-2 text-center border border-gray-600">
                              <div className="text-white text-xs sm:text-sm">ETH</div>
                              <div className="text-gray-400 text-xs">0.0003</div>
                            </div>
                            <div className="bg-gray-950 p-2 text-center border border-gray-600">
                              <div className="text-white text-xs sm:text-sm">CYPHX</div>
                              <div className="text-gray-400 text-xs">0.0000</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 h-full">
                            {/* Bought */}
                            <div className="flex flex-col items-center justify-center relative px-2 py-2">
                              <span className="text-xs text-gray-400 mb-1 font-medium">Bought</span>
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-bold text-green-400">$0</span>
                              </div>
                              <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700/50"></div>
                            </div>
                            
                            {/* Sold */}
                            <div className="flex flex-col items-center justify-center relative px-2 py-2">
                              <span className="text-xs text-gray-400 mb-1 font-medium">Sold</span>
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-bold text-red-400">$0</span>
                              </div>
                              <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700/50"></div>
                            </div>
                            
                            {/* Holding */}
                            <div className="flex flex-col items-center justify-center relative px-2 py-2">
                              <span className="text-xs text-gray-400 mb-1 font-medium">Holding</span>
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-bold text-white">$0</span>
                              </div>
                              <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700/50"></div>
                            </div>
                            
                            {/* PnL */}
                            <div className="flex flex-col items-center justify-center relative px-2 py-2">
                              <span className="text-xs text-gray-400 mb-1 font-medium">PnL</span>
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-bold text-green-400">0.00%</span>
                              </div>
                            </div>
                          </div>
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
            <motion.div className="mb-16" {...fadeInUp(0)}>
              <div className="text-center mb-8 sm:mb-12 px-4 lg:px-0">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-200 mb-4">
                  STAY AHEAD OF THE <span className="font-cypherx-gradient">CURVE</span><span className="font-cypherx-gradient">.</span>
                </h2>
                <p className="text-base sm:text-lg text-gray-400 max-w-3xl mx-auto">
                  Advanced tools for professional DeFi trading on Base Chain
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 max-w-7xl mx-auto px-4 lg:px-0">
                {/* Feature Card 1 - LIGHTNING FAST SWAP EXECUTIONS */}
                <motion.div
                  className="bg-gray-900 rounded-xl p-4 lg:p-6 border border-gray-800 w-full"
                  variants={cardVariants}
                  custom={0}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-3">INSTANT SWAP EXECUTIONS</h3>
                  <p className="text-gray-400 text-xs sm:text-sm mb-4">
                    Execute swaps with sub-second confirmation times using our advanced DEX aggregator and smart routing across Base Chain.
                  </p>
                  
                  {/* 1-Click Transaction Flow Visual */}
                  <div className="mb-4">
                    <div className="flex items-center justify-center space-x-1 sm:space-x-1.5 lg:space-x-2 mb-3">
                      {/* Step 1 - Accept */}
                      <div className="text-center">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mx-auto mb-2">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
            </div>
                        <div className="text-xs text-gray-400">Accept</div>
              </div>
                      
                      {/* Arrow 1 */}
                      <div className="flex items-center -mt-2">
                        <svg className="w-2 h-2 sm:w-3 sm:h-3 lg:w-4 lg:h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
          </div>
                      
                      {/* Step 2 - Confirm */}
                      <div className="text-center">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mx-auto mb-2">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
                        </div>
                        <div className="text-xs text-gray-400">Confirm</div>
        </div>
        
                      {/* Arrow 2 */}
                      <div className="flex items-center -mt-2">
                        <svg className="w-2 h-2 sm:w-3 sm:h-3 lg:w-4 lg:h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
          </div>
                      
                      {/* Step 3 - Complete */}
                      <div className="text-center">
                        <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mx-auto mb-2">
                                                      <svg className="w-4 h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
          </div>
                          <div className="text-xs text-gray-400">Complete</div>
          </div>
          </div>
                                         <div className="text-center">
                       <div className="text-xs text-gray-500">1-Click Transaction</div>
                       <div className="text-xs text-blue-400 font-medium">Flow</div>
        </div>
                   </div>
                 </motion.div>

                  {/* Feature Card 2 - QUICK BUYS */}
                  <motion.div 
                    className="bg-gray-900 rounded-xl p-4 lg:p-6 border border-gray-800 w-full"
                    variants={cardVariants}
                    custom={1}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-xl font-bold text-white mb-3">QUICK BUYS</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      One-click token purchases with optimized slippage and gas settings. Be first to the action with our Quick Buy interface.
                    </p>
                    <div className="flex justify-center">
                      <div className="text-center">
                        {/* Quick Buy Button Visual */}
                        <div className="bg-gray-800 rounded-lg p-3 mb-3 border border-gray-700">
                          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold flex items-center space-x-2 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Quick Buy</span>
                          </button>
          </div>
                        <div className="text-xs text-gray-500">One-click</div>
                        <div className="text-xs text-blue-400 font-medium">Trading</div>
                      </div>
                    </div>
      </motion.div>

                  {/* Feature Card 3 - TRADINGVIEW ADVANCED CHARTS */}
                  <motion.div
                    className="bg-gray-900 rounded-xl p-4 lg:p-6 border border-gray-800 w-full"
                    variants={cardVariants}
                    custom={2}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-xl font-bold text-white mb-3">TRADINGVIEW CHARTS</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Professional-grade charts with multiple timeframes, indicators, and drawing tools. Real-time market data and comprehensive token analytics.
                    </p>
                    <div className="flex justify-center">
                      <div className="text-center">
                        {/* TradingView Logo */}
                        <div className="w-16 h-16 flex items-center justify-center mb-3">
                          <img 
                            src="https://i.imgur.com/Kwi1VTE.png" 
                            alt="TradingView" 
                            className="w-12 h-12 object-contain border border-white/30 rounded"
                          />
                        </div>
                        <div className="text-xs text-gray-500">Professional</div>
                        <div className="text-xs text-blue-400 font-medium">Charts</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Feature Card 4 - SELF-CUSTODIAL WALLET */}
                  <motion.div 
                    className="bg-gray-900 rounded-xl p-4 lg:p-6 border border-gray-800 w-full"
                    variants={cardVariants}
                    custom={3}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-xl font-bold text-white mb-3">SELF-CUSTODIAL WALLET</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Secure wallet with backup and recovery features. Full control of your private keys with 2FA protection and encrypted storage.
                    </p>
                    <div className="flex justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-transparent backdrop-blur-sm border border-blue-500/30 rounded-xl flex items-center justify-center mb-3">
                          <svg className="w-8 h-8 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
                        </div>
                        <div className="text-xs text-gray-500">Secure</div>
                        <div className="text-xs text-blue-400 font-medium">2FA</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Feature Card 5 - PORTFOLIO TRACKING */}
                  <motion.div 
                    className="bg-gray-900 rounded-xl p-4 lg:p-6 border border-gray-800 w-full"
                    variants={cardVariants}
                    custom={4}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-xl font-bold text-white mb-3">PORTFOLIO TRACKING</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Real-time portfolio monitoring with historical PnL charts, performance analytics, and multi-token balance tracking.
                    </p>
                    <div className="flex justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-transparent backdrop-blur-sm border border-blue-500/30 rounded-xl flex items-center justify-center mb-3">
                          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
                        </div>
                        <div className="text-xs text-gray-500">Real-time</div>
                        <div className="text-xs text-blue-400 font-medium">Analytics</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Feature Card 6 - REWARDS PROGRAM */}
                  <motion.div 
                    className="bg-gray-900 rounded-xl p-4 lg:p-6 border border-gray-800 w-full"
                    variants={cardVariants}
                    custom={5}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-xl font-bold text-white mb-3">REWARDS PROGRAM</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Earn CYPHX tokens back on trading fees and participate in our comprehensive rewards ecosystem with daily bonuses.
                    </p>
                    <div className="flex justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-transparent backdrop-blur-sm border border-blue-500/30 rounded-xl flex items-center justify-center mb-3">
                          <img 
                            src="https://i.imgur.com/LgM4ZGy.png" 
                            alt="CypherX Logo" 
                            className="w-10 h-10 object-contain"
                          />
                </div>
                        <div className="text-xs text-gray-500">Earn</div>
                        <div className="text-xs text-blue-400 font-medium">CYPHX</div>
              </div>
            </div>
                  </motion.div>
          </div>
              </motion.div>

            {/* Separator line between Features and 3D Coins */}
            <div className="border-b border-gray-800/30 mb-16"></div>

          {/* 3D Coins Section */}
          <motion.div 
            className="mb-16" 
            {...fadeInUp(0.3)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-4 lg:p-8 border border-gray-800 max-w-7xl mx-auto mx-4 lg:mx-auto">
              <div className="text-left mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mb-3 sm:mb-4 tracking-tight font-cypherx-gradient">
                  HOLD, TRADE, EARN
                </h2>
                <p className="text-base sm:text-lg lg:text-xl text-white max-w-3xl tracking-wide">
                  Empowering traders with innovative tools and rewards
                </p>
          </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-16 items-center">
                {/* Text Content - LEFT SIDE */}
                <div className="space-y-6 sm:space-y-8 order-2 lg:order-1">
                  <p className="text-gray-200 leading-relaxed text-sm sm:text-base text-left">
                    <span className="font-cypherx-gradient font-bold">CYPHX Revenue Sharing</span> rewards active traders and long-term holders. The more you trade and hold, the more you earn through our comprehensive rewards ecosystem.
                  </p>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-400 rounded-full"></div>
                      <span className="text-gray-200 text-sm sm:text-base">Revenue sharing from trading fees</span>
        </div>
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-400 rounded-full"></div>
                      <span className="text-gray-200 text-sm sm:text-base">Loyalty rewards for long-term holders</span>
              </div>
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-400 rounded-full"></div>
                      <span className="text-gray-200 text-sm sm:text-base">User referral system</span>
            </div>
          </div>
        
        <Link 
                    href="/rewards"
                    className="inline-flex bg-transparent border border-blue-400/60 hover:bg-blue-500/10 hover:border-blue-400 text-blue-400 font-bold px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 text-sm items-center space-x-2"
        >
                    <span>Learn More</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
        </Link>
      </div>
        
                {/* 3D Coins Layout - RIGHT SIDE */}
                <div className="relative h-48 sm:h-60 lg:h-80 flex items-center justify-center order-1 lg:order-2">
                  {/* Coin 1 - Large Center */}
                  <motion.div 
                    className="absolute transform rotate-6 scale-100 sm:scale-125 z-20"
                    initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: 6 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                  >
                    <div className="relative w-32 h-32 sm:w-40 sm:h-40">
                      {/* 3D Depth Layer */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 to-blue-800 rounded-full transform translate-x-1 translate-y-1 scale-98 opacity-60"></div>
                      
                      {/* Main Coin Body */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 rounded-full border-4 border-blue-600/40 transform rotate-3 shadow-lg">
                        {/* Highlight Layer */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full transform -translate-x-1 -translate-y-1"></div>
                        
                        {/* CypherX Logo */}
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <img 
                            src="https://i.imgur.com/LgM4ZGy.png" 
                            alt="CypherX Logo" 
                            className="w-18 h-18 sm:w-24 sm:h-24 object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
        
                  {/* Coin 2 - Top Left */}
                  <div className="absolute transform -rotate-12 -translate-x-28 sm:-translate-x-36 -translate-y-16 sm:-translate-y-20 scale-75 sm:scale-90 z-15">
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                      {/* 3D Depth Layer */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 to-blue-800 rounded-full transform translate-x-1 translate-y-1 scale-95 opacity-60"></div>
                      
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 rounded-full border-4 border-blue-600/40 transform -rotate-2 shadow-lg">
                        {/* Highlight Layer */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full transform -translate-x-1 -translate-y-1"></div>
                        
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <img 
                            src="https://i.imgur.com/LgM4ZGy.png" 
                            alt="CypherX Logo" 
                            className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Coin 3 - Top Right */}
                  <div className="absolute transform rotate-12 translate-x-28 sm:translate-x-36 -translate-y-16 sm:-translate-y-20 scale-75 sm:scale-90 z-15">
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                      {/* 3D Depth Layer */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 to-blue-800 rounded-full transform translate-x-1 translate-y-1 scale-95 opacity-60"></div>
                      
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 rounded-full border-4 border-blue-600/40 transform rotate-3 shadow-lg">
                        {/* Highlight Layer */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full transform -translate-x-1 -translate-y-1"></div>
                        
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <img 
                            src="https://i.imgur.com/LgM4ZGy.png" 
                            alt="CypherX Logo" 
                            className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />

      {/* Scroll to Top Button */}
      <motion.button
        className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg z-40 flex items-center justify-center transition-colors"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ 
          opacity: showScrollToTop ? 1 : 0,
          scale: showScrollToTop ? 1 : 0
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        style={{ pointerEvents: showScrollToTop ? 'auto' : 'none' }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </motion.button>
    </div>
  );
}