"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { FiZap, FiBarChart2, FiTrendingUp, FiEye, FiSearch } from "react-icons/fi";
import { FaWallet } from "react-icons/fa";

import Header from "./components/Header";
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


export default function Page() {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [totalTokens, setTotalTokens] = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState(true);

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
      <div className="min-h-screen flex flex-col bg-[#070c14] overflow-x-hidden">
        <Header />

        {/* Separator line between header and content */}
        <div className="border-b border-gray-800/30"></div>

        <main className="flex-1 text-gray-200 relative overflow-x-hidden" style={{ overflowY: 'visible' }}>
          {/* Hexagon Background */}
          <div className="fixed inset-0 bg-[#070c14] -z-10">
            {/* Hexagon grid pattern */}
            <div 
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(0deg, transparent, transparent 69px, rgba(59, 130, 246, 0.15) 69px, rgba(59, 130, 246, 0.15) 70px),
                  repeating-linear-gradient(60deg, transparent, transparent 69px, rgba(59, 130, 246, 0.15) 69px, rgba(59, 130, 246, 0.15) 70px),
                  repeating-linear-gradient(120deg, transparent, transparent 69px, rgba(59, 130, 246, 0.15) 69px, rgba(59, 130, 246, 0.15) 70px)
                `,
                backgroundSize: '120px 104px',
              }}
            />
            
            {/* Individual hexagons with subtle fade animation */}
            {Array.from({ length: 40 }).map((_, i) => {
              const row = Math.floor(i / 8);
              const col = i % 8;
              const left = 8 + col * 12.5;
              const top = 8 + row * 10;
              const delay = i * 0.2;
              const duration = 6 + (i % 4) * 2;
              
              return (
                <div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: '60px',
                    height: '60px',
                    clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
                    background: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.1)',
                    animation: `hexFade ${duration}s ease-in-out infinite`,
                    animationDelay: `${delay}s`,
                  }}
                />
              );
            })}
          </div>

          {/* Background lines that flow through the entire page */}
          <div className="fixed inset-0 pointer-events-none overflow-visible z-0">
            {/* 2 Vertical lines spread out more, running down the entire page */}
            <div className="fixed top-0 left-[25%] w-[1px] h-[500vh] bg-gradient-to-b from-gray-400/5 via-gray-400/15 to-gray-400/20"></div>
            <div className="fixed top-0 left-[75%] w-[1px] h-[500vh] bg-gradient-to-b from-gray-400/5 via-gray-400/15 to-gray-400/20"></div>
            {/* 4 Horizontal lines - first one below hero section, others distributed */}
            <div className="absolute top-[70vh] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gray-400/12 to-transparent"></div>
            <div className="absolute top-[85vh] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gray-400/10 to-transparent"></div>
            <div className="absolute top-[100vh] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gray-400/10 to-transparent"></div>
            <div className="absolute top-[115vh] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gray-400/8 to-transparent"></div>
          </div>

          {/* Hero Section */}
          <motion.div 
            className="relative w-full min-h-[60vh] sm:min-h-[65vh] flex items-center justify-center overflow-visible pt-8 sm:pt-12"
            variants={heroVariants}
            initial="hidden"
            animate="visible"
          >

            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#070c14] via-[#070c14]/70 to-transparent pointer-events-none"></div>

            <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              {/* Enhanced Main Heading */}
              <motion.div
                variants={itemVariants}
                className="mb-12 sm:mb-10 relative"
              >
                {/* Subtle background layer for badge section */}
                <div className="hidden lg:block absolute -top-4 left-1/2 -translate-x-1/2 w-full max-w-md h-20 bg-gradient-to-b from-blue-500/5 via-blue-400/3 to-transparent rounded-full blur-2xl pointer-events-none"></div>
                {/* 1 CLICK SWAPS Badge */}
                <motion.div
                  variants={itemVariants}
                  className="flex justify-center mb-6"
                >
                  <span className="chrome-reflection inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/40 relative overflow-hidden">
                    <FiZap className="w-3.5 h-3.5 text-blue-400 relative z-10" />
                    <span className="relative z-10">1 CLICK SWAPS</span>
                  </span>
                </motion.div>
                
                {/* Main Headline - 2 lines */}
                <motion.h1 
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-bold text-white max-w-5xl mx-auto mb-5 sm:mb-7 leading-tight px-2"
                  variants={itemVariants}
                >
                  <div>See Everything.</div>
                  <div><span className="text-blue-400">Miss Nothing.</span></div>
                </motion.h1>
                
                {/* Subtext */}
                <motion.p 
                  className="text-sm sm:text-base md:text-lg text-gray-400 max-w-3xl mx-auto mb-5 sm:mb-7 leading-relaxed font-normal px-2"
                  variants={itemVariants}
                >
                  The all-in-one trading terminal for Base. Real-time analytics, instant swaps, and deep market intelligence—built for traders who move fast.
                </motion.p>

                {/* Status Indicators */}
                <motion.p
                  variants={itemVariants}
                  className="text-sm sm:text-base text-gray-400 mb-6 sm:mb-8 px-2"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-400 rounded-full"></span>
                    {statsLoading ? '...' : totalTokens.toLocaleString()} tokens indexed
                  </span>
                  <span className="mx-1.5 sm:mx-2">•</span>
                  <span>Real-time data</span>
                </motion.p>
              </motion.div>

              {/* Stats Section - Grid Layout */}
              <motion.div
                variants={itemVariants}
                className="flex items-center justify-center gap-0 max-w-4xl mx-auto mb-8 sm:mb-0 relative"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
              >
                <motion.div 
                  className="text-center group px-2 sm:px-4 lg:px-6"
                  variants={itemVariants}
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <CountUp 
                    key={activeUsers} // Force remount when value changes from 0 to real value
                    end={activeUsers || 0}
                    duration={2500}
                    delay={500}
                    className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-semibold text-white mb-1.5 group-hover:text-blue-300 transition-colors"
                  />
                  <div className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider font-light">ACTIVE USERS</div>
                </motion.div>
                <div className="w-px h-10 sm:h-14 bg-gray-800/30"></div>
                <motion.div 
                  className="text-center group px-2 sm:px-4 lg:px-6"
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
                    className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-semibold text-white mb-1.5 group-hover:text-blue-300 transition-colors"
                  />
                  <div className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider font-light">VOLUME TRACKED</div>
                </motion.div>
                <div className="w-px h-10 sm:h-14 bg-gray-800/30"></div>
                <motion.div 
                  className="text-center group px-2 sm:px-4 lg:px-6"
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
                    className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-semibold text-white mb-1.5 group-hover:text-blue-300 transition-colors"
                  />
                  <div className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider font-light">UPTIME</div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>

          {/* Powered By Industry Leaders Section - Moved under hero */}
          <motion.div className="py-8 sm:py-12" {...fadeInUp(0.1)}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6 sm:mb-8 text-center">
                <span className="text-gray-400 uppercase tracking-wider text-[10px] sm:text-xs block mb-3 sm:mb-4">POWERED BY INDUSTRY LEADERS</span>
              </div>
              {/* Infinite Scroll Carousel */}
              <div className="overflow-hidden relative">
                <div className="flex gap-3 sm:gap-4 animate-infinite-scroll">
                  {/* First set */}
                  {[
                    { name: "0x Protocol", description: "DEX Aggregation", image: "https://i.imgur.com/9Y7BIHa.png" },
                    { name: "Coinbase", description: "Base Infrastructure", image: "https://i.imgur.com/RWgPgY1.png" },
                    { name: "Alchemy", description: "Node Services", image: "https://i.imgur.com/coHc8sq.png" },
                    { name: "CoinGecko", description: "Price Intelligence", image: "https://i.imgur.com/UgezDbe.png" },
                    { name: "Dexscreener", description: "Market Data", image: "https://i.imgur.com/LweKEMF.png" },
                  ].map((partner, index) => (
                    <div key={`first-${index}`} className="flex items-center gap-3 sm:gap-4 bg-gray-900/40 p-3 sm:p-4 border border-gray-800 hover:bg-blue-500/5 transition-all duration-300 shrink-0 min-w-[200px] sm:min-w-[240px]">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-950/70 border border-gray-800 flex items-center justify-center shrink-0">
                        <img src={partner.image} alt={partner.name} className="h-8 sm:h-10 object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-xs sm:text-sm font-semibold">{partner.name}</p>
                        <p className="text-[10px] sm:text-xs text-gray-400">{partner.description}</p>
                      </div>
                    </div>
                  ))}
                  {/* Duplicate set for seamless loop */}
                  {[
                    { name: "0x Protocol", description: "DEX Aggregation", image: "https://i.imgur.com/9Y7BIHa.png" },
                    { name: "Coinbase", description: "Base Infrastructure", image: "https://i.imgur.com/RWgPgY1.png" },
                    { name: "Alchemy", description: "Node Services", image: "https://i.imgur.com/coHc8sq.png" },
                    { name: "CoinGecko", description: "Price Intelligence", image: "https://i.imgur.com/UgezDbe.png" },
                    { name: "Dexscreener", description: "Market Data", image: "https://i.imgur.com/LweKEMF.png" },
                  ].map((partner, index) => (
                    <div key={`second-${index}`} className="flex items-center gap-3 sm:gap-4 bg-gray-900/40 p-3 sm:p-4 border border-gray-800 hover:bg-blue-500/5 transition-all duration-300 shrink-0 min-w-[200px] sm:min-w-[240px]">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-950/70 border border-gray-800 flex items-center justify-center shrink-0">
                        <img src={partner.image} alt={partner.name} className="h-8 sm:h-10 object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-xs sm:text-sm font-semibold">{partner.name}</p>
                        <p className="text-[10px] sm:text-xs text-gray-400">{partner.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Content Section with Enhanced Padding */}
          <div className="relative z-10 pt-12 sm:pt-16 lg:pt-20 bg-[#070c14]">
            
            {/* Discover Section */}
            <motion.div className="mb-12 sm:mb-16" {...fadeInUp(0.1)}>
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 px-4 sm:px-6 lg:px-8">
                
                {/* Left Panel - Token Discovery */}
                <div className="lg:col-span-1 flex flex-col items-center lg:items-start justify-start lg:justify-center lg:pr-8 text-center lg:text-left mb-6 lg:mb-0">
                  <div className="relative">
                    {/* Heading */}
                    <div className="mb-3 sm:mb-4">
                      <span className="text-blue-400 uppercase tracking-[0.3em] sm:tracking-[0.4em] text-[10px] sm:text-xs block mb-2 font-normal">TOKEN DISCOVERY</span>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-white mb-2 sm:mb-3">
                        Find opportunities in real-time
                      </h2>
                    </div>
                    
                    {/* Subtitle */}
                    <p className="text-gray-300 mb-4 sm:mb-6 text-xs sm:text-sm md:text-base leading-relaxed max-w-lg mx-auto lg:mx-0">
                      Scan thousands of tokens instantly. Filter by liquidity, volume, age, and security metrics. Never miss a trade again.
                    </p>
                    
                    {/* CTA Button */}
                    <Link
                      href="/discover"
                      className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition-colors rounded-none"
                    >
                      Open Discover
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
                
                                {/* Right Panel - Token Table */}
                <div className="lg:col-span-2 lg:pr-12">
                  {/* Token Table - Simplified to match image */}
                  <div className="bg-[#0d1117] border border-gray-800/30 overflow-hidden backdrop-blur-sm">
                      {/* Table Header */}
                      <div className="bg-[#0d1117] px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-800/30">
                        <div className="grid grid-cols-4 gap-2 sm:gap-4 text-[10px] sm:text-xs text-white font-semibold">
                          <div>TOKEN</div>
                          <div className="text-right">PRICE</div>
                          <div className="text-right">24H</div>
                          <div className="text-right">VOLUME</div>
                        </div>
                      </div>
                    
                      {/* Table Body */}
                      <div className="divide-y divide-gray-800/50">
                        {/* Token Row 1 - $CYPHX */}
                        <div className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-900/30 transition-colors">
                          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 md:gap-4 items-center">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center shrink-0 overflow-hidden">
                                <img 
                                  src="https://i.imgur.com/TrMzYAi.png" 
                                  alt="CypherX" 
                                  className="w-[110%] h-[110%] object-contain"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-white font-medium text-[11px] sm:text-xs md:text-sm truncate">$CYPHX</div>
                                <div className="text-gray-400 text-[9px] sm:text-[10px] md:text-xs truncate">CypherX</div>
                              </div>
                            </div>
                            <div className="text-white text-right text-[11px] sm:text-xs md:text-sm">$0.0024</div>
                            <div className="text-green-400 text-right text-[11px] sm:text-xs md:text-sm font-semibold">+468.64%</div>
                            <div className="text-white text-right text-[11px] sm:text-xs md:text-sm">$2.1M</div>
                          </div>
                        </div>

                        {/* Token Row 2 - $ALPHA */}
                        <div className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-900/30 transition-colors">
                          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 md:gap-4 items-center">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center text-blue-500 font-semibold text-[11px] sm:text-sm shrink-0">A</div>
                              <div className="min-w-0 flex-1">
                                <div className="text-white font-medium text-[11px] sm:text-xs md:text-sm truncate">$ALPHA</div>
                                <div className="text-gray-400 text-[9px] sm:text-[10px] md:text-xs truncate">AlphaFi</div>
                              </div>
                            </div>
                            <div className="text-white text-right text-[11px] sm:text-xs md:text-sm">$0.0018</div>
                            <div className="text-green-400 text-right text-[11px] sm:text-xs md:text-sm font-semibold">+433.30%</div>
                            <div className="text-white text-right text-[11px] sm:text-xs md:text-sm">$1.8M</div>
                          </div>
                        </div>

                        {/* Token Row 3 - $NEXUS */}
                        <div className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-900/30 transition-colors">
                          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 md:gap-4 items-center">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center text-blue-500 font-semibold text-[11px] sm:text-sm shrink-0">N</div>
                              <div className="min-w-0 flex-1">
                                <div className="text-white font-medium text-[11px] sm:text-xs md:text-sm truncate">$NEXUS</div>
                                <div className="text-gray-400 text-[9px] sm:text-[10px] md:text-xs truncate">NexusAI</div>
                              </div>
                            </div>
                            <div className="text-white text-right text-[11px] sm:text-xs md:text-sm">$0.0009</div>
                            <div className="text-green-400 text-right text-[11px] sm:text-xs md:text-sm font-semibold">+156.23%</div>
                            <div className="text-white text-right text-[11px] sm:text-xs md:text-sm">$890K</div>
                          </div>
                        </div>

                        {/* Token Row 4 - $SWIFT */}
                        <div className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-900/30 transition-colors">
                          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 md:gap-4 items-center">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center text-blue-500 font-semibold text-[11px] sm:text-sm shrink-0">S</div>
                              <div className="min-w-0 flex-1">
                                <div className="text-white font-medium text-[11px] sm:text-xs md:text-sm truncate">$SWIFT</div>
                                <div className="text-gray-400 text-[9px] sm:text-[10px] md:text-xs truncate">SwiftPay</div>
                              </div>
                            </div>
                            <div className="text-white text-right text-[11px] sm:text-xs md:text-sm">$0.0032</div>
                            <div className="text-red-400 text-right text-[11px] sm:text-xs md:text-sm font-semibold">-12.45%</div>
                            <div className="text-white text-right text-[11px] sm:text-xs md:text-sm">$720K</div>
                          </div>
                        </div>

                        {/* Token Row 5 - $QUANT */}
                        <div className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-900/30 transition-colors">
                          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 md:gap-4 items-center">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center text-blue-500 font-semibold text-[11px] sm:text-sm shrink-0">Q</div>
                              <div className="min-w-0 flex-1">
                                <div className="text-white font-medium text-[11px] sm:text-xs md:text-sm truncate">$QUANT</div>
                                <div className="text-gray-400 text-[9px] sm:text-[10px] md:text-xs truncate">QuantumX</div>
                              </div>
                            </div>
                            <div className="text-white text-right text-[11px] sm:text-xs md:text-sm">$0.0006</div>
                            <div className="text-green-400 text-right text-[11px] sm:text-xs md:text-sm font-semibold">+89.12%</div>
                            <div className="text-white text-right text-[11px] sm:text-xs md:text-sm">$340K</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Table Footer */}
                      <div className="bg-[#0d1117] px-3 sm:px-4 py-2 sm:py-3 border-t border-gray-800/30">
                        <div className="flex flex-wrap gap-2 sm:gap-2 md:gap-3">
                          <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-[10px] sm:text-xs text-green-300 whitespace-nowrap">Contract Verified</span>
                          </div>
                          <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-[10px] sm:text-xs text-green-300 whitespace-nowrap">Liquidity Locked</span>
                          </div>
                          <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-[10px] sm:text-xs text-green-300 whitespace-nowrap">Not Honeypot</span>
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
      </div>
    </motion.div>
            
            {/* Separator line between Discover and Platform */}
            <div className="border-b border-gray-800/30 mb-12 sm:mb-16"></div>

            {/* Platform Features Section */}
            <motion.div className="mb-12 sm:mb-16" {...fadeInUp(0)}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-6 sm:mb-8 text-center">
                  <span className="text-blue-400 uppercase tracking-wider text-[10px] sm:text-xs block mb-2">PLATFORM</span>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                    Built for serious traders
                  </h2>
                </div>
                
                <div className="grid gap-3 sm:gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {/* Card 1: Instant Swap Execution */}
                  <div className="border border-gray-800/30 bg-[#0d1117] p-3 sm:p-4 md:p-5 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all duration-300">
                    <div>
                      <span className="text-blue-400 uppercase tracking-wider text-[10px] sm:text-xs block mb-1.5 sm:mb-2">EXECUTION ENGINE</span>
                      <h3 className="text-white font-semibold text-base sm:text-lg mb-1.5 sm:mb-2">Instant Swap Execution</h3>
                      <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">Route through 0x aggregation for optimal pricing. Sub-second confirmations with MEV protection and slippage controls.</p>
                    </div>
                  </div>

                  {/* Card 2: TradingView Charts */}
                  <div className="border border-gray-800/30 bg-[#0d1117] p-3 sm:p-4 md:p-5 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all duration-300">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center bg-blue-600/20 text-blue-300 shrink-0 rounded-lg">
                        <FiBarChart2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">TradingView Charts</h3>
                        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-1.5 sm:mb-2">Professional charting with 100+ indicators, drawing tools, and multi-timeframe analysis.</p>
                        <Link href="/discover" className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm inline-flex items-center gap-1">
                          Learn more <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Portfolio Tracking */}
                  <div className="border border-gray-800/30 bg-[#0d1117] p-3 sm:p-4 md:p-5 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all duration-300">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center bg-blue-600/20 text-blue-300 shrink-0 rounded-lg">
                        <FiTrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">Portfolio Tracking</h3>
                        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-1.5 sm:mb-2">Real-time P&L, multi-wallet aggregation, and detailed position analytics.</p>
                        <Link href="/discover" className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm inline-flex items-center gap-1">
                          Learn more <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Self-Custody Wallet */}
                  <div className="border border-gray-800/30 bg-[#0d1117] p-3 sm:p-4 md:p-5 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all duration-300">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center bg-blue-600/20 text-blue-300 shrink-0 rounded-lg">
                        <FaWallet className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">Self-Custody Wallet</h3>
                        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-0">Non-custodial security with session approvals, 2FA, and hardware wallet support.</p>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Smart Radar */}
                  <div className="border border-gray-800/30 bg-[#0d1117] p-3 sm:p-4 md:p-5 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all duration-300">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center bg-blue-600/20 text-blue-300 shrink-0 rounded-lg">
                        <FiEye className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">Smart Radar</h3>
                        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-1.5 sm:mb-2">AI-powered token scanner with customizable alerts and security scoring.</p>
                        <Link href="/discover" className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm inline-flex items-center gap-1">
                          Learn more <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Card 6: Chain Explorer */}
                  <div className="border border-gray-800/30 bg-[#0d1117] p-3 sm:p-4 md:p-5 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all duration-300">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center bg-blue-600/20 text-blue-300 shrink-0 rounded-lg">
                        <FiSearch className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">Chain Explorer</h3>
                        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-1.5 sm:mb-2">Deep dive into transactions, blocks, and wallet activity with forensic tools.</p>
                        <Link href="/discover" className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm inline-flex items-center gap-1">
                          Learn more <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Separator line between Platform and Rewards */}
            <div className="border-b border-gray-800/30 mb-12 sm:mb-16"></div>

          {/* Rewards Program Section */}
          <motion.div
            className="mb-12 sm:mb-16"
            {...fadeInUp(0.3)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="relative grid gap-4 sm:gap-6 md:gap-8 lg:grid-cols-2 items-start">
                  <div className="space-y-4 sm:space-y-5 md:space-y-6">
                    <div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-white mb-2">
                        <span className="text-blue-400 uppercase tracking-wider text-[10px] sm:text-xs md:text-sm block mb-1.5 sm:mb-2">REWARDS PROGRAM</span>
                        Trade. Earn. Compound.
                      </h2>
                      <p className="mt-2 sm:mt-3 text-gray-300 text-xs sm:text-sm md:text-base max-w-xl">
                        Earn CYPHX rewards on every trade. Stack multipliers with daily streaks and unlock higher tiers for increased earnings.
                      </p>
                    </div>
                    <div className="space-y-2.5 sm:space-y-3">
                      {[
                        {
                          number: "1",
                          title: "Trading Rewards",
                          description: "Earn CYPHX on every swap and trade you execute."
                        },
                        {
                          number: "2",
                          title: "Streak Multipliers",
                          description: "Boost your earnings with daily trading streaks."
                        },
                        {
                          number: "3",
                          title: "Referral Yields",
                          description: "Earn a percentage of your referrals' trading activity."
                        }
                      ].map((item) => (
                        <div key={item.number} className="flex gap-2 sm:gap-3 items-start">
                          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center border border-blue-500/40 bg-blue-600/15 text-blue-200 text-xs sm:text-sm font-semibold shrink-0">
                            {item.number}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-xs sm:text-sm font-semibold">{item.title}</p>
                            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">{item.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/rewards"
                      className="inline-flex items-center gap-1.5 sm:gap-2 border border-blue-400/60 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold text-blue-200 hover:border-blue-400 transition"
                    >
                      View Rewards
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>

                  <div className="hidden sm:block">
                    <div className="border border-gray-800/30 bg-[#0d1117] p-4 sm:p-6">
                      <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80 mb-4">YOUR REWARDS</p>
                      <div className="space-y-4">
                        <div>
                          <p className="text-2xl font-bold text-white">12,450</p>
                          <p className="text-xs text-gray-400 mt-1">CYPHX Points</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-lg font-semibold text-white">2.5x</p>
                            <p className="text-xs text-gray-400">Multiplier</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-white">14</p>
                            <p className="text-xs text-gray-400">Day Streak</p>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-400">+520 Today</span>
                            <span className="text-xs text-blue-400">Level 4</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '62%' }}></div>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">7,550 to Level 5</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          </motion.div>

        </div>
      </main>

    </div>
  );
}