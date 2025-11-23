"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCheck, FiLock, FiStar, FiTrendingUp, FiAward, FiZap, FiUsers, FiGift, FiShield, FiDollarSign } from "react-icons/fi";
import { FaDiscord, FaCrown } from "react-icons/fa";

interface TierProgressionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: string;
  currentPoints: number;
}

const TierProgressionModal: React.FC<TierProgressionModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  currentPoints
}) => {
  const tiers = [
    {
      id: 'normie',
      name: 'Normie',
      icon: FiUsers,
      color: '#6B7280',
      minPoints: 0,
      maxPoints: 1999,
      description: 'Just getting started in crypto',
      discordRole: 'Normie',
      swapFee: '0.06%',
      benefits: [
        'Basic access to all features',
        'Standard support',
        'Community access',
        'Basic trading tools',
        'Profile customization',
        'Basic notifications',
        'Discord: Normie role'
      ]
    },
    {
      id: 'degen',
      name: 'Degen',
      icon: FiTrendingUp,
      color: '#CD7F32', // Bronze
      minPoints: 2000,
      maxPoints: 7999,
      description: 'Degenerate trader, living on the edge',
      discordRole: 'Degen',
      swapFee: '0.05%',
      airdropAllocation: '1x',
      benefits: [
        'All Normie benefits',
        'Priority support',
        'Early access to new features',
        'Custom profile badge',
        'Discord: Degen role',
        'Reduced swap fees (0.05%)',
        'Airdrop eligibility (1x allocation)',
        'Exclusive Discord channels',
        'Advanced trading tools'
      ]
    },
    {
      id: 'alpha',
      name: 'Alpha',
      icon: FiShield,
      color: '#10B981', // Green
      minPoints: 8000,
      maxPoints: 19999,
      description: 'Got the alpha, making moves',
      discordRole: 'Alpha',
      swapFee: '0.04%',
      airdropAllocation: '2x',
      benefits: [
        'All Degen benefits',
        'Premium support',
        'Exclusive alpha calls',
        'Custom Discord role',
        'Discord: Alpha role',
        'Premium swap fees (0.04%)',
        'Airdrop eligibility (2x allocation)',
        'Private alpha channels',
        'Advanced analytics',
        'Early feature access',
        'Custom integrations',
        'Revenue sharing',
        'Immortal status in community'
      ]
    },
    {
      id: 'mogul',
      name: 'Mogul',
      icon: FaCrown,
      color: '#FFD700', // Gold
      minPoints: 20000,
      maxPoints: 49999,
      description: 'Crypto mogul, building empire',
      discordRole: 'Mogul',
      swapFee: '0.03%',
      airdropAllocation: '3x',
      benefits: [
        'All Alpha benefits',
        'Exclusive events access',
        'Custom NFT rewards',
        'Direct team access',
        'Discord: Mogul role + exclusive channels',
        'Elite swap fees (0.03%)',
        'Airdrop eligibility (3x allocation)',
        'Early access to new tools',
        'Revenue sharing opportunities',
        'Platform partnership opportunities',
        'VIP customer service',
        'Custom platform features',
        'Immortal status in community'
      ]
    },
    {
      id: 'titan',
      name: 'Titan',
      icon: FiStar,
      color: '#8B5CF6', // Purple
      minPoints: 50000,
      maxPoints: Infinity,
      description: 'Crypto titan, legendary status',
      discordRole: 'Titan',
      swapFee: '0.02%',
      airdropAllocation: '5x',
      benefits: [
        'ALL PREVIOUS BENEFITS',
        'Legendary status',
        'Discord: Titan role + all channels',
        'Legendary swap fees (0.02%)',
        'Airdrop eligibility (5x allocation)',
        'Platform partnership opportunities',
        'Immortal status in community',
        'Custom platform features',
        'Exclusive Titan-only events',
        'Direct CEO access',
        'Revenue sharing at highest tier',
        'Platform governance rights',
        'Custom integrations',
        'Priority tool access'
      ]
    }
  ];

  const getCurrentTierIndex = () => {
    return tiers.findIndex(tier => tier.id === currentTier);
  };

  const getProgressToNextTier = () => {
    const currentTierData = tiers.find(tier => tier.id === currentTier);
    if (!currentTierData || currentTierData.id === 'titan') return 100;
    
    const nextTier = tiers[tiers.indexOf(currentTierData) + 1];
    if (!nextTier) return 100;
    
    const pointsInCurrentTier = currentPoints - currentTierData.minPoints;
    const pointsNeededForNextTier = nextTier.minPoints - currentTierData.minPoints;
    return Math.min(100, (pointsInCurrentTier / pointsNeededForNextTier) * 100);
  };

  const isTierUnlocked = (tierIndex: number) => {
    return currentPoints >= tiers[tierIndex].minPoints;
  };

  const isCurrentTier = (tierId: string) => {
    return tierId === currentTier;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999999] sm:flex sm:items-center sm:justify-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-gray-900 sm:border sm:border-gray-700 sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-w-5xl sm:max-h-[90vh] overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between px-4 sm:px-6 py-3 sm:py-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
                  <FiAward className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Level Progression</h2>
                  <p className="text-gray-400 text-sm">Your journey to legendary status</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="absolute top-3 sm:top-6 right-4 sm:right-6 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-gray-900/50 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200"
                aria-label="Close"
              >
                <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] scrollbar-hide">
              {/* Current Status */}
              <div className="mb-6 p-4 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-xl border border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className={`relative w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700`}
                    >
                      {tiers.find(t => t.id === currentTier)?.icon && React.createElement(tiers.find(t => t.id === currentTier)!.icon, { className: "w-5 h-5 text-white" })}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white capitalize">
                        {currentTier} Status
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {currentPoints.toLocaleString()} / {tiers.find(t => t.id === currentTier)?.maxPoints.toLocaleString()} points
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{currentPoints.toLocaleString()}</div>
                    <div className="text-gray-400 text-sm">Total Points</div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Progress to next tier</span>
                    <span>{getProgressToNextTier().toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getProgressToNextTier()}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Tier Journey */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Your Journey</h3>
                
                {tiers.map((tier, index) => {
                  const isUnlocked = isTierUnlocked(index);
                  const isCurrent = isCurrentTier(tier.id);
                  const isCompleted = index < getCurrentTierIndex();
                  const IconComponent = tier.icon;
                  
                  return (
                    <motion.div
                      key={tier.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative p-4 rounded-xl border transition-all duration-300 ${
                        isCurrent
                          ? 'bg-gray-800/50 border-yellow-500/50'
                          : isUnlocked
                          ? 'bg-gray-800/50 border-green-500/30'
                          : 'bg-gray-800/50 border-gray-600'
                      }`}
                    >
                      {/* Connection Line */}
                      {index < tiers.length - 1 && (
                        <div className="absolute left-6 top-16 w-0.5 h-6 bg-gray-600"></div>
                      )}
                      
                      <div className="flex items-start gap-3">
                        {/* Tier Icon */}
                        <div className="relative">
                          <div 
                            className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 bg-gradient-to-br from-blue-900 to-blue-700`}
                            style={{ 
                              opacity: isUnlocked ? 1 : 0.6
                            }}
                          >
                            <IconComponent className="w-6 h-6 text-white" />
                          </div>
                          
                          {/* Status Indicator */}
                          <div className="absolute -top-1 -right-1">
                            {isCompleted ? (
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <FiCheck className="w-3 h-3 text-white" />
                              </div>
                            ) : isCurrent ? (
                              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <FiTrendingUp className="w-3 h-3 text-white" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 bg-gray-600 rounded-full flex items-center justify-center">
                                <FiLock className="w-3 h-3 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tier Content */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className={`text-lg font-bold capitalize ${
                                isCurrent ? 'text-blue-400' : isUnlocked ? 'text-green-400' : 'text-gray-400'
                              }`}>
                                {tier.name}
                              </h4>
                              <p className="text-sm text-gray-500">{tier.description}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-300">
                                {tier.minPoints.toLocaleString()} - {tier.maxPoints === Infinity ? '∞' : tier.maxPoints.toLocaleString()} pts
                              </div>
                              {isCurrent && (
                                <div className="text-xs text-blue-400">Current</div>
                              )}
                              {isCompleted && (
                                <div className="text-xs text-green-400">Completed</div>
                              )}
                            </div>
                          </div>

                          {/* Key Benefits */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                            {/* Discord Role */}
                            <div className="flex flex-col items-center gap-1 p-2 bg-gray-800/50 rounded-lg">
                              <div className="text-xs text-gray-400">Discord Role</div>
                              <div className="flex items-center gap-1">
                                <FaDiscord className="w-3 h-3 text-[#5865F2]" />
                                <span className="text-xs font-medium text-white">{tier.discordRole}</span>
                              </div>
                            </div>

                            {/* Swap Fee */}
                            <div className="flex flex-col items-center gap-1 p-2 bg-gray-800/50 rounded-lg">
                              <div className="text-xs text-gray-400">Swap Fee</div>
                              <div className="flex items-center gap-1">
                                <FiDollarSign className="w-3 h-3 text-green-400" />
                                <span className="text-xs font-medium text-white">{tier.swapFee}</span>
                              </div>
                            </div>

                            {/* Airdrop Allocation */}
                            {tier.airdropAllocation && (
                              <div className="flex flex-col items-center gap-1 p-2 bg-gray-800/50 rounded-lg">
                                <div className="text-xs text-gray-400">Airdrop</div>
                                <div className="flex items-center gap-1">
                                  <FiGift className="w-3 h-3 text-cyan-400" />
                                  <span className="text-xs font-medium text-white">{tier.airdropAllocation}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* All Benefits */}
                          <div className="mt-3">
                            <h5 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                              <FiAward className="w-4 h-4" />
                              Benefits
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                              {tier.benefits.map((benefit, benefitIndex) => (
                                <div key={benefitIndex} className="flex items-center gap-2 text-sm">
                                  <div className={`w-2 h-2 rounded-full ${
                                    isUnlocked ? 'bg-green-400' : 'bg-gray-600'
                                  }`} />
                                  <span className={isUnlocked ? 'text-gray-300' : 'text-gray-500'}>
                                    {benefit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Progress to this tier */}
                          {!isUnlocked && index > getCurrentTierIndex() && (
                            <div className="mt-3 p-2 bg-gray-800/50 rounded-lg">
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Progress to {tier.name}</span>
                                <span>{Math.max(0, ((currentPoints - tiers[index - 1]?.minPoints || 0) / (tier.minPoints - (tiers[index - 1]?.minPoints || 0))) * 100).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${Math.max(0, ((currentPoints - (tiers[index - 1]?.minPoints || 0)) / (tier.minPoints - (tiers[index - 1]?.minPoints || 0))) * 100)}%` 
                                  }}
                                />
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {tier.minPoints - currentPoints} points needed
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Quick Stats */}
              <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <FiZap className="w-4 h-4 text-yellow-400" />
                  Journey Stats
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-400">
                      {tiers.filter((_, index) => isTierUnlocked(index)).length}
                    </div>
                    <div className="text-gray-400 text-sm">Tiers Unlocked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-400">
                      {tiers.length - getCurrentTierIndex() - 1}
                    </div>
                    <div className="text-gray-400 text-sm">Tiers Remaining</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-cyan-400">
                      {tiers.length}
                    </div>
                    <div className="text-gray-400 text-sm">Total Tiers</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TierProgressionModal;
