import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUserFriends, FaCopy, FaCheck } from 'react-icons/fa';
import { FiX } from 'react-icons/fi';
import { SiEthereum } from 'react-icons/si';
import { useRewards } from '../hooks/useRewards';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReferralModal({ isOpen, onClose }: ReferralModalProps) {
  const { rewards, referralData, processReferral } = useRewards();
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCopyCode = async () => {
    if (rewards?.referralCode) {
      await navigator.clipboard.writeText(rewards.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleProcessReferral = async () => {
    if (!referralCode.trim()) return;
    
    setProcessing(true);
    setError('');
    setSuccess('');
    
    const result = await processReferral(referralCode.trim());
    if (result.success) {
      setSuccess('Referral code applied successfully!');
      setReferralCode('');
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1500);
    } else {
      setError(result.error || 'Failed to apply referral code');
    }
    setProcessing(false);
  };

  // Calculate referral volume
  const referralVolume = referralData?.referrals?.reduce((sum: number, ref: any) => sum + (ref.swapValueUSD || 0), 0) || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-base font-semibold text-white">Referral Program</h2>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Apply Referral Code */}
              {!rewards?.referredBy && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                  <h3 className="text-sm font-medium text-white mb-3">Apply a Referral Code</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="Enter code..."
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleProcessReferral}
                      disabled={!referralCode.trim() || processing}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      {processing ? '...' : 'Apply'}
                    </button>
                  </div>
                  {error && (
                    <p className="text-red-400 text-xs mt-2">{error}</p>
                  )}
                  {success && (
                    <p className="text-green-400 text-xs mt-2">{success}</p>
                  )}
                </div>
              )}

              {rewards?.referredBy && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                  <p className="text-xs text-gray-400">Using Referral Code</p>
                  <p className="text-sm font-mono text-blue-400 mt-1">'{rewards.referredBy}'</p>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-gray-700/50">
                  <p className="text-lg font-semibold text-white">{referralData?.totalReferrals || 0}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Referrals</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-gray-700/50">
                  <p className="text-lg font-semibold text-white">${referralVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Volume</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-gray-700/50">
                  <p className="text-lg font-semibold text-white flex items-center justify-center gap-1">
                    <SiEthereum className="w-3 h-3 text-gray-400" />
                    {(referralData?.referralEarnings || 0).toFixed(4)}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Earned</p>
                </div>
              </div>

              {/* Your Code */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-white">Your Referral Code</h3>
                  <span className="text-[10px] text-gray-500">Earn 30% of referee fees</span>
                </div>
                <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                  <code className="font-mono text-blue-400 text-lg font-semibold">
                    {rewards?.referralCode || '...'}
                  </code>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <FaCheck className="w-4 h-4 text-green-400" />
                    ) : (
                      <FaCopy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Recent Referrals */}
              {referralData && referralData.referrals.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Recent Referrals</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                    {referralData.referrals.slice(0, 10).map((referral: any, index: number) => (
                      <div key={index} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gray-700 rounded-md flex items-center justify-center">
                              <FaUserFriends className="w-3 h-3 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-xs text-white font-medium">
                                {referral.refereeId?.slice(0, 8)}...{referral.refereeId?.slice(-4)}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {new Date(referral.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {referral.swapValueUSD > 0 && (
                            <div className="text-right">
                              <p className="text-xs text-gray-400">
                                ${referral.swapValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!referralData || referralData.referrals.length === 0) && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FaUserFriends className="w-5 h-5 text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-400">No referrals yet</p>
                  <p className="text-xs text-gray-500 mt-1">Share your code to start earning</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800">
              <button
                onClick={onClose}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
