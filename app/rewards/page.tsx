"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ReferralModal from "../components/ReferralModal";
import RefereeStatsModal from "../components/RefereeStatsModal";
import { useAuth } from "../providers";
import { useRewards } from "../hooks/useRewards";
import { 
  FaUserFriends,
  FaShare,
  FaEdit,
  FaCheckCircle,
  FaExclamationCircle
} from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { SiEthereum } from "react-icons/si";

// Proper tier definitions matching app/api/tiers/route.ts
const TIERS = {
  normie: { 
    name: "Normie", 
    cashback: 0.05,  // 5% of remaining fee
    color: "text-gray-400", 
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
    minPoints: 0 
  },
  degen: { 
    name: "Degen", 
    cashback: 0.10,  // 10% of remaining fee
    color: "text-orange-500", 
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    minPoints: 2000 
  },
  alpha: { 
    name: "Alpha", 
    cashback: 0.15,  // 15% of remaining fee
    color: "text-green-500", 
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    minPoints: 8000 
  },
  mogul: { 
    name: "Mogul", 
    cashback: 0.20,  // 20% of remaining fee
    color: "text-yellow-500", 
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    minPoints: 20000 
  },
  titan: { 
    name: "Titan", 
    cashback: 0.25,  // 25% of remaining fee
    color: "text-purple-500", 
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    minPoints: 50000 
  }
};

// Mock data - will be replaced with real data
const mockUserData = {
  points: 0,
  earned: 0,
  ethRewards: 0,
  tier: "normie",
  referralCode: "CYPHERX123",
  referrals: 0,
  referralRate: 30,
  volumeTraded: 0,
  transactions: 0,
  referredBy: null, // Will be set when user uses a referral code
  referralBonusEligible: false, // Will be set to true when user uses a referral code
  referralBonusClaimed: false, // Will be set to true after first trade
  referralCodeEdited: false, // Will be set to true after user edits their referral code
  quests: []
};

function fadeInUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5, delay, ease: "easeOut" },
  };
}

// Toast notification component
const Toast = ({ message, type, isVisible, onClose }: { 
  message: string; 
  type: 'success' | 'error'; 
  isVisible: boolean; 
  onClose: () => void; 
}) => {
  React.useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`fixed top-4 right-4 z-[60] max-w-sm w-full ${
            type === 'success' 
              ? 'bg-green-500/20 border-green-500/40 text-green-400' 
              : 'bg-red-500/20 border-red-500/40 text-red-400'
          } border backdrop-blur-xl rounded-lg p-4 shadow-2xl`}
        >
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 ${
              type === 'success' ? 'text-green-400' : 'text-red-400'
            }`}>
              {type === 'success' ? (
                <FaCheckCircle className="w-5 h-5" />
              ) : (
                <FaExclamationCircle className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{message}</p>
            </div>
            <button
              onClick={onClose}
              className={`flex-shrink-0 ${
                type === 'success' ? 'text-green-400' : 'text-red-400'
              } hover:opacity-70 transition-opacity`}
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function RewardsPage() {
  const { user } = useAuth();
  const { 
    rewards, 
    referralData,
    loading, 
    error, 
    claimRewards,
    editReferralCode,
    refreshAll 
  } = useRewards();
  
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showEditReferralModal, setShowEditReferralModal] = useState(false);
  const [showRefereeStatsModal, setShowRefereeStatsModal] = useState(false);
  const [selectedRefereeId, setSelectedRefereeId] = useState<string | null>(null);
  const [newReferralCode, setNewReferralCode] = useState('');
  const [editError, setEditError] = useState('');
  
  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    isVisible: boolean;
  }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true });
  };

  // Hide toast notification
  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  // Use real data or fallback to mock data
  const userData = rewards || mockUserData;
  
  // Calculate next tier info
  const currentTier = TIERS[userData.tier as keyof typeof TIERS] || TIERS.normie;
  const nextTier = Object.values(TIERS).find(tier => tier.minPoints > userData.points);
  const progressToNextTier = nextTier 
    ? Math.min(100, (userData.points / nextTier.minPoints) * 100)
    : 100;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-200">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-400">Please sign in to access your rewards.</p>
        </div>
      </div>
    );
  }

  // Show loading skeleton within the UI instead of full-screen loading
  const isLoading = loading && !rewards;

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 overflow-x-hidden">
      <Header />

      {/* Separator line between header and content */}
      <div className="border-b border-gray-800/50"></div>

      <main className="flex-1 text-gray-200 relative overflow-x-hidden">
        {/* Background */}
        <div className="fixed inset-0 bg-gray-950 -z-10"></div>
        
        {/* Simple Background */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          {/* Primary Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 via-gray-800/10 to-gray-900/20"></div>
          
          {/* Grid Pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>

                 {/* Content Section */}
                   <div className="relative z-10 p-3 sm:p-4 lg:p-4 pt-4 sm:pt-4 lg:pt-4">
          {/* Error Banner */}
          {error && (
            <motion.div {...fadeInUp(0.05)} className="mb-6 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <span className="text-red-400 font-medium text-sm">Error Loading Rewards</span>
                </div>
                <button 
                  onClick={refreshAll}
                  className="text-red-400 hover:text-red-300 text-xs underline"
                >
                  Try Again
                </button>
              </div>
              <p className="text-red-300 text-xs mt-1">{error}</p>
            </motion.div>
          )}

                                           {/* Loading Indicator */}
            {isLoading && (
              <motion.div {...fadeInUp(0.1)} className="mb-6 flex justify-end">
                <div className="flex items-center space-x-2 text-blue-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  <span className="text-sm">Loading...</span>
                </div>
              </motion.div>
            )}



                                            {/* Main Stats Row */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
              {/* Points */}
              <motion.div {...fadeInUp(0.2)} className="bg-gray-900/80 border border-gray-800/50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-gray-700/60">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Total Points</p>
                  <p className="text-lg font-bold text-gray-200">
                    {isLoading ? "..." : userData.points.toLocaleString()}
                  </p>
                </div>
              </motion.div>

                          {/* Tier */}
              <motion.div {...fadeInUp(0.3)} className="bg-gray-900/80 border border-gray-800/50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-gray-700/60">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Current Tier</p>
                  <p className="text-lg font-bold text-gray-200">{currentTier.name}</p>
                </div>
              </motion.div>

                          {/* ETH Rewards */}
              <motion.div {...fadeInUp(0.4)} className="bg-gray-900/80 border border-gray-800/50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-gray-700/60">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-500/20 rounded-lg flex items-center justify-center">
                    <SiEthereum className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">ETH Earned</p>
                    <p className="text-lg font-bold text-green-400 flex items-center space-x-2">
                      <SiEthereum className="w-4 h-4 text-gray-400" />
                      <span>{userData.ethRewards.toFixed(4)}</span>
                    </p>
                  </div>
                </div>
              </motion.div>

                                                    {/* Referrals */}
                               <motion.div {...fadeInUp(0.5)} className="bg-gray-900/80 border border-gray-800/50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-gray-700/60">
                 <div>
                   <p className="text-gray-400 text-xs mb-1">Referrals</p>
                   <p className="text-lg font-bold text-gray-200">{userData.referrals}</p>
                 </div>
               </motion.div>

                           {/* Cashback Rate */}
               <motion.div {...fadeInUp(0.6)} className="bg-gray-900/80 border border-gray-800/50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-gray-700/60">
                 <div>
                   <p className="text-gray-400 text-xs mb-1">Cashback Rate</p>
                   <p className="text-lg font-bold text-green-400">{(currentTier.cashback * 100).toFixed(0)}%</p>
                 </div>
               </motion.div>
             </div>

                     {/* Progress and Actions */}
                       <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-3">
            {/* Tier Progress */}
            <motion.div {...fadeInUp(0.6)} className="bg-gray-900/80 border border-gray-800/50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-gray-700/60">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Tier Progress</h3>
              {nextTier && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Progress to {nextTier.name}</span>
                                       <span className="text-blue-400 font-medium">{Math.round(progressToNextTier)}%</span>
                 </div>
                 <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden shadow-inner">
                   <div 
                     className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all duration-500 ease-out shadow-sm"
                     style={{ width: `${progressToNextTier}%` }}
                   ></div>
                 </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{userData.points} pts</span>
                    <span>{nextTier.minPoints} pts</span>
                  </div>
                </div>
              )}
            </motion.div>

                         {/* Trading Stats */}
             <motion.div {...fadeInUp(0.7)} className="bg-gray-900/80 border border-gray-800/50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-gray-700/60">
               <h3 className="text-sm font-semibold text-gray-200 mb-3">Trading Stats</h3>
               <div className="space-y-3">
                 <div className="p-3 bg-gray-800/50 rounded-md border border-gray-700/30">
                   <div className="flex justify-between items-center mb-2">
                     <p className="text-xs text-gray-400">Total Volume</p>
                     <p className="text-sm font-bold text-gray-200">
                       ${isLoading ? "..." : userData.volumeTraded?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                     </p>
                   </div>
                 </div>
                 <div className="p-3 bg-gray-800/50 rounded-md border border-gray-700/30">
                   <div className="flex justify-between items-center mb-2">
                     <p className="text-xs text-gray-400">Total Transactions</p>
                     <p className="text-sm font-bold text-gray-200">
                       {isLoading ? "..." : userData.transactions || 0}
                     </p>
                   </div>
                 </div>
                 <div className="p-3 bg-gray-800/50 rounded-md border border-gray-700/30">
                   <div className="flex justify-between items-center mb-2">
                     <p className="text-xs text-gray-400">Avg. Trade Size</p>
                     <p className="text-sm font-bold text-gray-200">
                       ${isLoading ? "..." : userData.transactions > 0 
                         ? (userData.volumeTraded / userData.transactions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                         : "0.00"}
                     </p>
                   </div>
                 </div>
               </div>
             </motion.div>

            {/* Claim Section */}
            <motion.div {...fadeInUp(0.8)} className="bg-gray-900/80 border border-gray-800/50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-gray-700/60">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Claim Rewards</h3>
              <div className="space-y-3">
                                                   <div className="text-center p-2 bg-gray-800 rounded-md">
                    <p className="text-xs text-gray-400">Available to Claim</p>
                    <p className="text-lg font-bold text-green-400 flex items-center justify-center space-x-2">
                      <SiEthereum className="w-4 h-4 text-gray-400" />
                      <span>+{userData.ethRewards.toFixed(4)}</span>
                    </p>
                  </div>
                 <button 
                                       onClick={async () => {
                      if (userData.ethRewards > 0) {
                        const result = await claimRewards();
                        if (result.success) {
                          showToast(`Successfully claimed ${userData.ethRewards.toFixed(4)} ETH!`, 'success');
                        } else {
                          showToast(`Error: ${result.error}`, 'error');
                        }
                      }
                    }}
                   className={`w-full py-2 transition-all duration-300 rounded-md text-xs font-medium ${
                     userData.ethRewards > 0
                       ? 'bg-green-500 hover:bg-green-600 text-white'
                       : 'bg-gray-800 border border-gray-700 text-gray-400 cursor-not-allowed'
                   }`}
                   disabled={userData.ethRewards <= 0}
                 >
                   {userData.ethRewards > 0 ? 'Claim ETH' : 'Nothing to Claim'}
                 </button>
              </div>
            </motion.div>
          </div>

          

                     {/* My Referral Code */}
                                               <motion.div {...fadeInUp(1.0)} className="bg-gray-900/80 border border-gray-800/50 rounded-lg p-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-gray-700/60">
                           <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">My Referral Code: <span className="text-lg font-mono font-bold text-blue-400">'{userData.referralCode}'</span></h3>
                  {userData.referredBy && (
                    <p className="text-xs text-gray-400 mt-1">Using Referral Code: <span className="text-sm font-medium text-blue-400">'{userData.referredBy}'</span></p>
                  )}
                </div>
               <div className="flex space-x-2">
                                   <button
                    onClick={() => setShowReferralModal(true)}
                    className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-400 text-xs font-medium rounded-md transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <FaUserFriends className="w-3 h-3" />
                    <span>View Referrals</span>
                  </button>
                                   <button
                    onClick={() => {
                      navigator.clipboard.writeText(userData.referralCode);
                      showToast('Referral code copied to clipboard!', 'success');
                    }}
                    className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-400 text-xs font-medium rounded-md transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <FaShare className="w-3 h-3" />
                    <span>Copy Code</span>
                  </button>
                 {!userData.referralCodeEdited && (
                   <button
                     onClick={() => setShowEditReferralModal(true)}
                     className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-400 text-xs font-medium rounded-md transition-all duration-200 flex items-center justify-center space-x-2"
                   >
                     <FaEdit className="w-3 h-3" />
                     <span>Edit Code</span>
                   </button>
                 )}
               </div>
             </div>
             
                                                       
             
                           {/* Referral Stats */}
                             <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-gray-800/30 rounded-lg p-3 text-center hover:bg-gray-800/50 transition-all duration-200 border border-gray-700/20 hover:border-gray-600/40">
                  <p className="text-xs text-gray-400 mb-1">Total Referrals</p>
                  <p className="text-lg font-bold text-gray-200">{userData.referrals}</p>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3 text-center hover:bg-gray-800/50 transition-all duration-200 border border-gray-700/20 hover:border-gray-600/40">
                  <p className="text-xs text-gray-400 mb-1">Earnings from Referrals</p>
                  <p className="text-lg font-bold text-green-400 flex items-center justify-center space-x-2">
                    <SiEthereum className="w-4 h-4 text-gray-400" />
                    <span>{(userData.ethRewards * 0.3).toFixed(4)}</span>
                  </p>
                </div>
              </div>
             
                           {/* Referral List */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-300 mb-3">Recent Referrals</h4>
                <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                  {referralData && referralData.referrals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
                      {referralData.referrals.map((referral: any, i: number) => (
                        <div 
                          key={referral.id || i} 
                          onClick={() => {
                            setSelectedRefereeId(referral.refereeId);
                            setShowRefereeStatsModal(true);
                          }}
                          className="p-3 bg-gray-800 rounded-md border border-gray-700/30 hover:border-blue-500/50 hover:bg-gray-800/70 cursor-pointer transition-all duration-200"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1">
                              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <FaUserFriends className="w-4 h-4 text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-200 truncate">
                                  {referral.refereeId ? `${referral.refereeId.slice(0, 8)}...${referral.refereeId.slice(-4)}` : `Referral #${i + 1}`}
                                </p>
                                <p className="text-xs text-blue-400">
                                  {referral.timestamp ? new Date(referral.timestamp).toLocaleDateString() : 'Active'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400 mb-1">Earned</p>
                              <p className="text-xs font-bold text-green-400 flex items-center space-x-1">
                                <SiEthereum className="w-3 h-3 text-gray-400" />
                                <span>{(referral.referralReward || 0).toFixed(4)}</span>
                              </p>
                            </div>
                          </div>
                          {referral.swapValueUSD && (
                            <div className="mt-2 pt-2 border-t border-gray-700/30">
                              <p className="text-xs text-gray-400">
                                Volume: ${referral.swapValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : userData.referrals > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
                      {Array.from({ length: Math.min(userData.referrals, 6) }, (_, i) => (
                        <div 
                          key={i} 
                          className="p-3 bg-gray-800 rounded-md border border-gray-700/30 hover:border-blue-500/50 hover:bg-gray-800/70 cursor-pointer transition-all duration-200"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                              <FaUserFriends className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-200">Referral #{i + 1}</p>
                              <p className="text-xs text-blue-400">Active</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                        <FaUserFriends className="w-6 h-6 text-gray-500" />
                      </div>
                      <p className="text-gray-400 text-xs mb-2">No referrals yet</p>
                      <p className="text-gray-500 text-xs">Share your referral code to start earning rewards</p>
                    </div>
                  )}
                </div>
              </div>
              
                             {/* Additional Referral Info */}
               <div className="mt-3">
                 <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30 hover:bg-gray-800/50 transition-all duration-200 hover:border-gray-600/50 shadow-md">
                   <h4 className="text-xs font-medium text-gray-300 mb-3">How Referrals Work</h4>
                   <div className="space-y-2 text-xs text-gray-400">

                     <div className="flex items-center space-x-2">
                       <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                       <span>Earn up to 0.1% - 0.3% back on trading fees</span>
                     </div>
                     <div className="flex items-center space-x-2">
                       <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                       <span>Referrers earn 30% of their referee's platform fee</span>
                     </div>
                     <div className="flex items-center space-x-2">
                       <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                       <span>All rewards are paid in ETH on Base chain</span>
                     </div>
                   </div>
                 </div>
               </div>
           </motion.div>
        </div>
      </main>

      <Footer />
      
      {/* Referral Modal */}
      <ReferralModal 
        isOpen={showReferralModal} 
        onClose={() => setShowReferralModal(false)} 
      />

      {/* Referee Stats Modal */}
      {selectedRefereeId && (
        <RefereeStatsModal
          isOpen={showRefereeStatsModal}
          onClose={() => {
            setShowRefereeStatsModal(false);
            setSelectedRefereeId(null);
          }}
          refereeId={selectedRefereeId}
        />
      )}

      {/* Edit Referral Code Modal */}
      {showEditReferralModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Edit Referral Code</h3>
              <button
                onClick={() => {
                  setShowEditReferralModal(false);
                  setNewReferralCode('');
                  setEditError('');
                }}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Code
                </label>
                <div className="p-3 bg-gray-800 rounded-md border border-gray-700/30">
                  <p className="text-lg font-mono font-bold text-blue-400">{userData.referralCode}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Referral Code
                </label>
                <input
                  type="text"
                  value={newReferralCode}
                  onChange={(e) => setNewReferralCode(e.target.value.toUpperCase())}
                  placeholder="Enter new code (4-12 characters)"
                  className="w-full p-3 bg-gray-800 border border-gray-700/30 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={12}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Letters and numbers only. You can only edit once!
                </p>
              </div>

              {editError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-md">
                  <p className="text-red-400 text-sm">{editError}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={async () => {
                    if (!newReferralCode.trim()) {
                      setEditError('Please enter a new referral code');
                      return;
                    }
                    
                    if (newReferralCode === userData.referralCode) {
                      setEditError('New code must be different from current code');
                      return;
                    }

                                         const result = await editReferralCode(newReferralCode);
                     if (result.success) {
                       setShowEditReferralModal(false);
                       setNewReferralCode('');
                       setEditError('');
                       showToast('Referral code updated successfully!', 'success');
                     } else {
                       setEditError(result.error || 'Failed to update referral code');
                     }
                  }}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md transition-all duration-200"
                >
                  Update Code
                </button>
                <button
                  onClick={() => {
                    setShowEditReferralModal(false);
                    setNewReferralCode('');
                    setEditError('');
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-gray-200 font-medium rounded-md transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}
