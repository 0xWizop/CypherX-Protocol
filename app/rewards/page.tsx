"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import ReferralModal from "../components/ReferralModal";
import RefereeStatsModal from "../components/RefereeStatsModal";
import { useAuth, useWalletSystem } from "../providers";
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

// Referral Volume Tiers - more referral volume = lower fees
const REFERRAL_VOLUME_TIERS = [
  { name: "Starter", minVolume: 0, feeDiscount: 0, color: "text-gray-400" },
  { name: "Bronze", minVolume: 1000, feeDiscount: 5, color: "text-amber-600" },
  { name: "Silver", minVolume: 5000, feeDiscount: 10, color: "text-gray-300" },
  { name: "Gold", minVolume: 25000, feeDiscount: 15, color: "text-yellow-400" },
  { name: "Diamond", minVolume: 100000, feeDiscount: 20, color: "text-cyan-400" },
];

// Mock data - will be replaced with real data
const mockUserData = {
  ethRewards: 0,
  referralCode: "CYPHERX123",
  referrals: 0,
  referralRate: 30,
  volumeTraded: 0,
  transactions: 0,
  referredBy: null,
  referralCodeEdited: false,
  referralVolume: 0, // Total volume from all referrals
};

function fadeInUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5, delay },
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

// Get current referral volume tier
function getReferralVolumeTier(volume: number) {
  let current = REFERRAL_VOLUME_TIERS[0];
  for (const tier of REFERRAL_VOLUME_TIERS) {
    if (volume >= tier.minVolume) {
      current = tier;
    }
  }
  return current;
}

// Get next referral volume tier
function getNextReferralVolumeTier(volume: number) {
  for (const tier of REFERRAL_VOLUME_TIERS) {
    if (volume < tier.minVolume) {
      return tier;
    }
  }
  return null;
}

export default function RewardsPage() {
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
  const walletAddress = selfCustodialWallet?.address;
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
  
  // Calculate referral volume from referral data
  const referralVolume = referralData?.referrals?.reduce((sum: number, ref: any) => sum + (ref.swapValueUSD || 0), 0) || 0;
  const currentVolumeTier = getReferralVolumeTier(referralVolume);
  const nextVolumeTier = getNextReferralVolumeTier(referralVolume);
  const volumeProgress = nextVolumeTier 
    ? Math.min(100, (referralVolume / nextVolumeTier.minVolume) * 100)
    : 100;

  // Base cashback rate (5%) + referral volume discount
  const baseCashback = 5;
  const totalCashback = baseCashback + currentVolumeTier.feeDiscount;

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-gray-200">
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
    <div className="min-h-full bg-gray-950 text-gray-200 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-3 pb-6 flex flex-col min-h-0">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-white">Rewards & Referrals</h1>
            {walletAddress && (
              <p className="text-xs text-gray-400 mt-0.5">
                Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <motion.div {...fadeInUp(0.05)} className="mb-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex-shrink-0">
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

        {/* Main Content */}
        <div className="flex-1 min-h-0 space-y-3">
          {/* Main Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {/* ETH Earned */}
            <motion.div {...fadeInUp(0.1)} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5 sm:p-3">
              <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">ETH Earned</p>
              <p className="text-base sm:text-lg font-semibold text-green-400 flex items-center gap-1.5">
                <SiEthereum className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{isLoading ? "..." : userData.ethRewards?.toFixed(4) || "0.0000"}</span>
              </p>
            </motion.div>

            {/* Referrals */}
            <motion.div {...fadeInUp(0.15)} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5 sm:p-3">
              <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Referrals</p>
              <p className="text-base sm:text-lg font-semibold text-white">{isLoading ? "..." : userData.referrals || 0}</p>
            </motion.div>

            {/* Referral Volume */}
            <motion.div {...fadeInUp(0.2)} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5 sm:p-3">
              <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Referral Volume</p>
              <p className="text-base sm:text-lg font-semibold text-white">
                ${isLoading ? "..." : referralVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </motion.div>

            {/* Your Fee Discount */}
            <motion.div {...fadeInUp(0.25)} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-2.5 sm:p-3">
              <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Your Cashback</p>
              <p className={`text-base sm:text-lg font-semibold ${currentVolumeTier.feeDiscount > 0 ? 'text-green-400' : 'text-white'}`}>
                {totalCashback}%
                {currentVolumeTier.feeDiscount > 0 && (
                  <span className="text-[10px] text-green-400/70 ml-1">(+{currentVolumeTier.feeDiscount}%)</span>
                )}
              </p>
            </motion.div>
          </div>

          {/* Fee Discount & Claim Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
            {/* Referral Volume Perks */}
            <motion.div {...fadeInUp(0.3)} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">
                  Referral Volume Perks
                </h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${currentVolumeTier.color} bg-gray-800`}>
                  {currentVolumeTier.name}
                </span>
              </div>
              
              {nextVolumeTier && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">Progress to {nextVolumeTier.name}</span>
                    <span className="text-blue-400 font-medium">
                      ${referralVolume.toLocaleString()} / ${nextVolumeTier.minVolume.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-400 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${volumeProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    +{nextVolumeTier.feeDiscount - currentVolumeTier.feeDiscount}% more cashback at next tier
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 sm:grid sm:grid-cols-5">
                {REFERRAL_VOLUME_TIERS.map((tier) => (
                  <div
                    key={tier.name}
                    className={`flex-1 min-w-[60px] p-1.5 sm:p-2 rounded-md text-center ${
                      referralVolume >= tier.minVolume 
                        ? 'bg-blue-500/20 border border-blue-500/30' 
                        : 'bg-gray-800/50 border border-gray-700/30'
                    }`}
                  >
                    <p className={`text-[10px] font-medium ${tier.color}`}>{tier.name}</p>
                    <p className="text-[9px] text-gray-400">+{tier.feeDiscount}%</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Claim Section */}
            <motion.div {...fadeInUp(0.35)} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 sm:p-4">
              <h3 className="text-sm font-medium text-white mb-3">Claim Rewards</h3>
              <div className="space-y-3">
                <div className="text-center p-3 bg-gray-800 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Available to Claim</p>
                  <p className="text-xl font-semibold text-green-400 flex items-center justify-center gap-2">
                    <SiEthereum className="w-5 h-5" />
                    <span>+{(userData.ethRewards || 0).toFixed(4)}</span>
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
                  className={`w-full py-2.5 transition-all duration-300 rounded-lg text-sm font-medium ${
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
          <motion.div {...fadeInUp(0.4)} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-white">My Referral Code</h3>
                  <p className="text-lg font-mono font-semibold text-blue-400">'{userData.referralCode}'</p>
                </div>
                {userData.referredBy && (
                  <p className="text-xs text-gray-400 mt-1">
                    Using Referral Code: <span className="text-blue-400">'{userData.referredBy}'</span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowReferralModal(true)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-all duration-200 flex items-center space-x-2"
                >
                  <FaUserFriends className="w-3 h-3" />
                  <span>View Referrals</span>
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(userData.referralCode);
                    showToast('Referral code copied to clipboard!', 'success');
                  }}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-md transition-all duration-200 flex items-center space-x-2"
                >
                  <FaShare className="w-3 h-3" />
                  <span>Copy Code</span>
                </button>
                {!userData.referralCodeEdited && (
                  <button
                    onClick={() => setShowEditReferralModal(true)}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-md transition-all duration-200 flex items-center space-x-2"
                  >
                    <FaEdit className="w-3 h-3" />
                    <span>Edit Code</span>
                  </button>
                )}
              </div>
            </div>
            
            {/* Referral Stats */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gray-700/30 rounded-lg p-3 text-center border border-gray-600/30">
                <p className="text-xs text-gray-400 mb-0.5">Total Referrals</p>
                <p className="text-base font-semibold text-white">{userData.referrals || 0}</p>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-3 text-center border border-gray-600/30">
                <p className="text-xs text-gray-400 mb-0.5">Earnings from Referrals</p>
                <p className="text-base font-semibold text-green-400 flex items-center justify-center gap-1.5">
                  <SiEthereum className="w-4 h-4" />
                  <span>{((userData.ethRewards || 0) * 0.3).toFixed(4)}</span>
                </p>
              </div>
            </div>
            
            {/* Referral List */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-white mb-2">Recent Referrals</h4>
              <div className="max-h-40 overflow-y-auto scrollbar-hide">
                {referralData && referralData.referrals.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {referralData.referrals.slice(0, 6).map((referral: any, i: number) => (
                      <div 
                        key={referral.id || i} 
                        onClick={() => {
                          setSelectedRefereeId(referral.refereeId);
                          setShowRefereeStatsModal(true);
                        }}
                        className="p-2.5 bg-gray-800 rounded-lg border border-gray-700/50 hover:border-gray-600 cursor-pointer transition-all duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 flex-1">
                            <div className="w-7 h-7 bg-gray-700 rounded-md flex items-center justify-center">
                              <FaUserFriends className="w-3 h-3 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-200 truncate">
                                {referral.refereeId ? `${referral.refereeId.slice(0, 8)}...${referral.refereeId.slice(-4)}` : `Referral #${i + 1}`}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {referral.timestamp ? new Date(referral.timestamp).toLocaleDateString() : 'Active'}
                              </p>
                            </div>
                          </div>
                          {referral.swapValueUSD > 0 && (
                            <div className="text-right">
                              <p className="text-[10px] text-gray-500">Volume</p>
                              <p className="text-xs font-medium text-gray-300">
                                ${referral.swapValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : userData.referrals > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Array.from({ length: Math.min(userData.referrals, 6) }, (_, i) => (
                      <div 
                        key={i} 
                        className="p-2.5 bg-gray-800 rounded-lg border border-gray-700/50"
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 bg-gray-700 rounded-md flex items-center justify-center">
                            <FaUserFriends className="w-3 h-3 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-200">Referral #{i + 1}</p>
                            <p className="text-[10px] text-gray-500">Active</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                      <FaUserFriends className="w-6 h-6 text-gray-500" />
                    </div>
                    <p className="text-gray-400 text-xs mb-1">No referrals yet</p>
                    <p className="text-gray-500 text-[10px]">Share your code to start earning rewards</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* How It Works */}
            <div className="mt-3 pt-3 border-t border-gray-700/30">
              <h4 className="text-xs font-medium text-white mb-2">How Referrals Work</h4>
              <div className="space-y-1.5 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-2 text-xs text-gray-400">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0"></div>
                  <span>Earn {baseCashback}% cashback on fees</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0"></div>
                  <span>Get 30% of referee's fee</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></div>
                  <span>More volume = higher cashback</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-base font-semibold text-white">Edit Referral Code</h3>
              <button
                onClick={() => {
                  setShowEditReferralModal(false);
                  setNewReferralCode('');
                  setEditError('');
                }}
                className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Code</p>
                <p className="text-xl font-mono font-semibold text-blue-400">{userData.referralCode}</p>
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
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                  maxLength={12}
                />
                <p className="text-[10px] text-gray-500 mt-2">
                  Letters and numbers only. You can only edit once!
                </p>
              </div>

              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">{editError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => {
                  setShowEditReferralModal(false);
                  setNewReferralCode('');
                  setEditError('');
                }}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
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
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Update Code
              </button>
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
