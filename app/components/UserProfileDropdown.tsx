"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, type Auth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth as firebaseAuth, db, storage } from "@/lib/firebase";
import { useAuth, useWalletSystem, useVotingModal } from "@/app/providers";
import { useUserSettings } from "@/app/hooks/useUserSettings";
import { motion, AnimatePresence } from "framer-motion";
import { FiUser, FiInfo, FiX, FiCheck, FiAlertCircle } from "react-icons/fi";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import TierProgressionModal from "./TierProgressionModal";
import PointsHistoryModal from "./PointsHistoryModal";

const auth: Auth = firebaseAuth as Auth;

const UserProfileDropdown: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
  const { setShowVotingModal, setSelectedIndexForVoting } = useVotingModal();
  const { 
    updateAlias, 
    loading: settingsLoading 
  } = useUserSettings();
  const walletAddress = selfCustodialWallet?.address;
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('normie');
  const [progress, setProgress] = useState<number>(0);
  const [nextTier, setNextTier] = useState<string | null>(null);
  const [pointsToNextTier, setPointsToNextTier] = useState<number>(0);

  const [showTierModal, setShowTierModal] = useState(false);
  const [showPointsHistory, setShowPointsHistory] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const [showAuthorDashboardModal, setShowAuthorDashboardModal] = useState(false);
  const [alias, setAlias] = useState<string>("");

  const [profilePicture, setProfilePicture] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    trading: true,
    news: false
  });
  const [privacy, setPrivacy] = useState({
    showProfile: true,
    showTrades: true,
    showBalance: false
  });
  

  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Debug logging for Points History
  useEffect(() => {
    if (showPointsHistory) {
      console.log('Points History opened with walletAddress:', walletAddress);
    }
  }, [showPointsHistory, walletAddress]);

  // Fetch user stats from API
  useEffect(() => {
    const fetchUserStats = async () => {
              if (!user || !walletAddress) {
          setPoints(null);
          setTier('normie');
          return;
        }

      try {
        // Fetch user stats from our new API
        const statsResponse = await fetch(`/api/tiers?walletAddress=${walletAddress}`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setPoints(statsData.points || 0);
          setTier(statsData.tier || 'normie');
          setProgress(statsData.progress || 0);
          setNextTier(statsData.nextTier);
          setPointsToNextTier(statsData.pointsToNextTier || 0);
        } else {
          // Fallback to old method
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setPoints(userData.points ?? 0);
            setTier(userData.tier ?? 'normie');
          } else {
            setPoints(0);
            setTier('normie');
          }
        }

        // Check author status
        const authorResponse = await fetch(`/api/author/status?walletAddress=${walletAddress}`);
        if (authorResponse.ok) {
          const authorData = await authorResponse.json();
          setIsAuthor(authorData.isAuthor);
          setAlias(authorData.authorData?.alias || "");
        }

        // Fetch user profile data
        if (user || walletAddress) {
          const documentId = walletAddress || user.uid;
          const userDocRef = doc(db, "users", documentId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setProfilePicture(userData.profilePicture || userData.photoURL || "");
          }
        }
      } catch (error) {
        console.error("Error fetching user stats:", error);
        setPoints(0);
        setTier('normie');
      }
    };

    fetchUserStats();
  }, [user, walletAddress]);

  // Handle click outside to close modal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showAccountModal && modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowAccountModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAccountModal]);

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
    setShowAccountModal(false);
  }



  const handleSaveSettings = async () => {
    if (!user) return;
    
    setSavingSettings(true);
    setSettingsStatus('idle');
    setSettingsMessage('');
    
    try {
      // Use user.uid as document ID for consistency
      const documentId = user.uid;
      if (!documentId) {
        setSettingsStatus('error');
        setSettingsMessage('No user ID found');
        return;
      }
      // Start with just displayName to test if basic save works
      const settingsData = {
        displayName: displayName.trim(),
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, "users", documentId), settingsData);
      
      setSettingsStatus('success');
      setSettingsMessage('Settings saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSettingsStatus('idle');
        setSettingsMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('Error saving settings:', error);
      console.error('Error details:', {
        code: error instanceof Error ? error.message : String(error),
        documentId: user?.uid || '',
        user: !!user
      });
      
      let errorMessage = 'Failed to save settings. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('permission-denied')) {
          errorMessage = 'Permission denied. Please check your authentication.';
        } else if (error.message.includes('not-found')) {
          errorMessage = 'User document not found.';
        } else {
          errorMessage = `Save failed: ${error.message}`;
        }
      }
      
      setSettingsStatus('error');
      setSettingsMessage(errorMessage);
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setSettingsStatus('idle');
        setSettingsMessage('');
      }, 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  const getTierColor = (tier: string) => {
    const colors = {
      normie: '#6B7280',
      degen: '#EF4444',
      alpha: '#10B981',
      mogul: '#F59E0B',
      titan: '#8B5CF6'
    };
    return colors[tier as keyof typeof colors] || '#6B7280';
  };

  const getTierGradient = (tier: string) => {
    const gradients = {
      normie: 'from-gray-500 to-gray-600',
      degen: 'from-red-500 to-red-600',
      alpha: 'from-green-500 to-green-600',
      mogul: 'from-yellow-500 to-yellow-600',
      titan: 'from-purple-500 to-purple-600'
    };
    return gradients[tier as keyof typeof gradients] || 'from-gray-500 to-gray-600';
  };



  const handleVoteAndEarn = () => {
    setShowAccountModal(false); // Close the profile dropdown
    setSelectedIndexForVoting('CDEX'); // Default to CDEX index
    setShowVotingModal(true);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      console.log("No file or user found:", { file: !!file, user: !!user });
      setUploadStatus('error');
      setUploadMessage('No file selected or user not authenticated');
      return;
    }

    console.log("Starting image upload:", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId: user.uid
    });

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setUploadStatus('error');
      setUploadMessage('Please select a valid image file (JPG, PNG, GIF, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setUploadStatus('error');
      setUploadMessage('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    setUploadStatus('idle');
    setUploadMessage('Uploading image...');

    try {
      console.log("Creating storage reference...");
      // Try the profile path first, fallback to public path if needed
      const storageRef = ref(storage, `users/${user.uid}/profile/${Date.now()}-${file.name}`);
      console.log("Storage reference created:", storageRef.fullPath);
      console.log("User ID:", user.uid);
      console.log("User authenticated:", !!user);
      
      console.log("Uploading bytes...");
      let snapshot;
      try {
        snapshot = await uploadBytes(storageRef, file);
        console.log("Upload completed:", snapshot);
      } catch {
        console.log("Profile path upload failed, trying public path...");
        // Fallback to public path if profile path fails
        const publicRef = ref(storage, `public/profile-pictures/${user.uid}/${Date.now()}-${file.name}`);
        console.log("Trying public path:", publicRef.fullPath);
        snapshot = await uploadBytes(publicRef, file);
        console.log("Public path upload completed:", snapshot);
      }
      
      console.log("Getting download URL...");
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log("Download URL obtained:", downloadURL);
      
      setProfilePicture(downloadURL);
      
      // Save to Firestore
      try {
        // Use user.uid as document ID for consistency
        const documentId = user.uid;
        console.log("Saving profile picture to Firestore for user:", documentId);
        console.log("Download URL:", downloadURL);
        
        await updateDoc(doc(db, "users", documentId), {
          profilePicture: downloadURL,
          photoURL: downloadURL, // Also save to photoURL for compatibility
          updatedAt: new Date(),
        });
        console.log("Profile picture saved to Firestore successfully");
      } catch (firestoreError) {
        console.error("Error saving to Firestore:", firestoreError);
        console.error("Firestore error details:", {
          code: firestoreError instanceof Error ? firestoreError.message : 'Unknown error',
          userId: walletAddress || user.uid,
          downloadURL: downloadURL
        });
        // Don't fail the upload if Firestore save fails
      }
      
      setUploadStatus('success');
      setUploadMessage('Profile picture updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadMessage('');
      }, 3000);
      
    } catch (error) {
      console.error("Error uploading image:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        storage: !!storage,
        user: !!user,
        storageBucket: storage?.app?.options?.storageBucket
      });
      
      let errorMessage = 'Failed to upload image';
      if (error instanceof Error) {
        if (error.message.includes('storage/unauthorized')) {
          errorMessage = 'Upload failed: Permission denied. Please try again.';
        } else if (error.message.includes('storage/quota-exceeded')) {
          errorMessage = 'Upload failed: Storage quota exceeded.';
        } else if (error.message.includes('storage/network-request-failed')) {
          errorMessage = 'Upload failed: Network error. Please check your connection.';
        } else if (error.message.includes('storage/bucket-not-found')) {
          errorMessage = 'Upload failed: Storage bucket not found.';
        } else if (error.message.includes('storage/object-not-found')) {
          errorMessage = 'Upload failed: Storage object not found.';
        } else {
          errorMessage = `Upload failed: ${error.message}`;
        }
      }
      
      setUploadStatus('error');
      setUploadMessage(errorMessage);
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadMessage('');
      }, 5000);
      
    } finally {
      setUploadingImage(false);
    }
  };

  const [buttonRef, setButtonRef] = useState<HTMLButtonElement | null>(null);

  return (
    <div className="relative">
      <motion.button
        ref={setButtonRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAccountModal((prev) => !prev)}
        className="flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-full hover:scale-105 transform transition-all duration-200"
        aria-label={user ? "Account" : "Sign In"}
      >
        <div className="relative w-8 h-8 rounded-full bg-gray-950/50 backdrop-blur-sm flex items-center justify-center transition-all duration-300 hover:bg-gray-900/50 shadow-lg border border-gray-600 hover:border-gray-500 overflow-hidden">
          {profilePicture ? (
            <Image
              src={profilePicture}
              alt="Profile"
              width={36}
              height={36}
              className="w-full h-full object-cover"
            />
          ) : (
            <FiUser className="w-3.5 h-3.5 text-white" />
          )}
          {user && (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900"></div>
          )}
        </div>
      </motion.button>

      {showAccountModal && buttonRef && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            ref={modalRef}
            className="fixed w-80 bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-700/60 shadow-2xl overflow-hidden z-[9999]"
            style={{
              top: buttonRef.getBoundingClientRect().bottom + 16,
              right: window.innerWidth - buttonRef.getBoundingClientRect().right,
            }}
          >
            {/* Header with gradient background */}
            <div className={`bg-gradient-to-r ${getTierGradient(tier)} p-4 relative overflow-hidden`}>
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 rounded-full bg-blue-400/20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                      {profilePicture ? (
                        <Image
                          src={profilePicture}
                          alt="Profile"
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FiUser className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-base">
                        {user ? 'My Profile' : 'Welcome'}
                      </h3>
                      <p className="text-white/80 text-xs capitalize">
                        {tier} • {points !== null ? `${points.toLocaleString()} pts` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full shadow-lg"
                      style={{ backgroundColor: getTierColor(tier) }}
                    ></div>
                  </div>
                </div>

                {/* Progress to next tier */}
                {nextTier && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white/90 text-xs font-medium">Progress to {nextTier}</span>
                      <span className="text-white/90 text-xs font-semibold">{progress}%</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="bg-white h-1.5 rounded-full shadow-sm"
                      ></motion.div>
                    </div>
                    <p className="text-white/70 text-xs mt-1.5">
                      {pointsToNextTier} points to next tier
                    </p>
                  </div>
                )}
              </div>
            </div>

                        {/* Content */}
            <div className="p-4 space-y-4">
              {/* Quick Stats */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Points</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-medium">{points !== null ? points.toLocaleString() : "—"}</span>
                  <button
                    onClick={() => setShowTierModal(true)}
                    className="p-0.5 hover:bg-blue-500/20 rounded transition-colors"
                    title="View Tier Progression"
                  >
                    <FiInfo className="w-3 h-3 text-blue-400" />
                  </button>
                </div>
              </div>
              


              {/* Navigation Links */}
              <div className="space-y-1 pt-2">
                <button
                  onClick={() => {
                    setShowPointsHistory(true);
                    setShowAccountModal(false);
                  }}
                  className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-md transition-all duration-200"
                >
                  <span className="font-medium text-sm">Points History</span>
                </button>

                {isAuthor && (
                  <button
                    onClick={() => {
                      setShowAuthorDashboardModal(true);
                      setShowAccountModal(false);
                    }}
                    className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-md transition-all duration-200"
                  >
                    <span className="font-medium text-sm">Author Dashboard</span>
                  </button>
                )}

                <button
                  onClick={handleVoteAndEarn}
                  className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-md transition-all duration-200"
                >
                  <span className="font-medium text-sm">Vote & Earn</span>
                </button>

                <button
                  onClick={() => setShowAliasModal(true)}
                  className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-md transition-all duration-200"
                >
                  <span className="font-medium text-sm">Set Alias</span>
                </button>

                <Link
                  href="/rewards"
                  className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-md transition-all duration-200"
                  onClick={() => setShowAccountModal(false)}
                >
                  <span className="font-medium text-sm">Rewards & Referrals</span>
                </Link>
              </div>

              {/* Logout Section */}
              <div className="pt-3 border-t border-gray-700/50">
                {user ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSignOut}
                    className="flex items-center w-full p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-all duration-200"
                  >
                    <span className="font-medium text-sm">Sign Out</span>
                  </motion.button>
                ) : (
                  <Link
                    href="/login"
                    className="flex items-center w-full p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-md transition-all duration-200"
                    onClick={() => setShowAccountModal(false)}
                  >
                    <span className="font-medium text-sm">Sign In</span>
                  </Link>
                )}
              </div>
            </div>
           </motion.div>
         </AnimatePresence>
               , document.body
        )}
      
      {/* Tier Progression Modal */}
      {showTierModal && createPortal(
        <TierProgressionModal 
          isOpen={showTierModal}
          onClose={() => setShowTierModal(false)}
          currentTier={tier}
          currentPoints={points || 0}
        />
      , document.body
      )}

      {/* Points History Modal */}
      {showPointsHistory && walletAddress && createPortal(
        <PointsHistoryModal
          isOpen={showPointsHistory}
          onClose={() => setShowPointsHistory(false)}
          walletAddress={walletAddress}
        />
      , document.body
      )}

      {/* Alias Modal */}
      {showAliasModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gray-900 rounded-xl p-6 w-96 border border-gray-700"
          >
            <h3 className="text-white text-lg font-semibold mb-4">Set Your Alias</h3>
            <p className="text-gray-400 text-sm mb-4">
              Choose a display name that will appear on leaderboards and in the community.
            </p>
            
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Display Name (Alias)
              </label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Enter your preferred display name"
                maxLength={20}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAliasModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (alias.trim()) {
                    await updateAlias(alias.trim());
                    setShowAliasModal(false);
                    setAlias('');
                  }
                }}
                disabled={!alias.trim() || settingsLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {settingsLoading ? 'Updating...' : 'Update Alias'}
              </button>
            </div>
          </motion.div>
        </div>
      , document.body
      )}

      {/* Account Settings Modal */}
      {showAccountSettingsModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gray-900 rounded-xl w-full max-w-[500px] flex flex-col border border-gray-700 max-h-[85vh]"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-white text-xl font-semibold">Account Settings</h3>
              <button
                onClick={() => setShowAccountSettingsModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Profile Section */}
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h4 className="text-white font-medium mb-2">Profile Information</h4>
                <div className="space-y-2">
                  {/* Profile Picture */}
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-700 border-2 border-gray-600">
                        {profilePicture ? (
                          <Image
                            src={profilePicture}
                            alt="Profile"
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FiUser className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full flex items-center justify-center transition-colors"
                      >
                        {uploadingImage ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                        ) : (
                          <FiUser className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="flex-1">
                      <h5 className="text-white font-medium text-sm">Profile Picture</h5>
                      <p className="text-gray-400 text-xs mb-2">
                        Upload a profile picture to personalize your account
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs transition-colors"
                      >
                        {uploadingImage ? 'Uploading...' : 'Upload Image'}
                      </button>
                      
                      {/* Status Messages */}
                      {uploadStatus !== 'idle' && uploadMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`mt-2 p-2 rounded-lg text-xs flex items-center space-x-2 ${
                            uploadStatus === 'success' 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {uploadStatus === 'success' ? (
                            <FiCheck className="w-3 h-3" />
                          ) : (
                            <FiAlertCircle className="w-3 h-3" />
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

                  <div>
                    <label className="block text-gray-300 text-sm mb-1">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Enter your display name"
                    />
                  </div>

                </div>
              </div>

              {/* Notifications Section */}
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h4 className="text-white font-medium mb-2">Notifications</h4>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <span className="text-gray-300 text-sm font-medium">Email Notifications</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={notifications.email}
                        onChange={(e) => setNotifications(prev => ({ ...prev, email: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${
                        notifications.email ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          notifications.email ? 'translate-x-5' : 'translate-x-1'
                        }`}></div>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <span className="text-gray-300 text-sm font-medium">Push Notifications</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={notifications.push}
                        onChange={(e) => setNotifications(prev => ({ ...prev, push: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${
                        notifications.push ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          notifications.push ? 'translate-x-5' : 'translate-x-1'
                        }`}></div>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <span className="text-gray-300 text-sm font-medium">Trading Notifications</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={notifications.trading}
                        onChange={(e) => setNotifications(prev => ({ ...prev, trading: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${
                        notifications.trading ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          notifications.trading ? 'translate-x-5' : 'translate-x-1'
                        }`}></div>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <span className="text-gray-300 text-sm font-medium">News Notifications</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={notifications.news}
                        onChange={(e) => setNotifications(prev => ({ ...prev, news: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${
                        notifications.news ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          notifications.news ? 'translate-x-5' : 'translate-x-1'
                        }`}></div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Privacy Section */}
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h4 className="text-white font-medium mb-2">Privacy</h4>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <span className="text-gray-300 text-sm font-medium">Show Profile</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={privacy.showProfile}
                        onChange={(e) => setPrivacy(prev => ({ ...prev, showProfile: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${
                        privacy.showProfile ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          privacy.showProfile ? 'translate-x-5' : 'translate-x-1'
                        }`}></div>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <span className="text-gray-300 text-sm font-medium">Show Trades</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={privacy.showTrades}
                        onChange={(e) => setPrivacy(prev => ({ ...prev, showTrades: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${
                        privacy.showTrades ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          privacy.showTrades ? 'translate-x-5' : 'translate-x-1'
                        }`}></div>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <span className="text-gray-300 text-sm font-medium">Show Balance</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={privacy.showBalance}
                        onChange={(e) => setPrivacy(prev => ({ ...prev, showBalance: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${
                        privacy.showBalance ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          privacy.showBalance ? 'translate-x-5' : 'translate-x-1'
                        }`}></div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Settings Status Messages */}
              {settingsStatus !== 'idle' && settingsMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg text-sm flex items-center space-x-2 ${
                    settingsStatus === 'success' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
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
              <div className="flex gap-3 p-4 border-t border-gray-700">
                <button
                  onClick={() => setShowAccountSettingsModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
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
        </div>
      , document.body
      )}

      {/* Author Dashboard Modal */}
      {showAuthorDashboardModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gray-900 rounded-xl p-6 w-[700px] max-h-[80vh] overflow-y-auto border border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white text-xl font-semibold">Author Dashboard</h3>
              <button
                onClick={() => setShowAuthorDashboardModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">0</div>
                  <div className="text-gray-400 text-sm">Total Posts</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">0</div>
                  <div className="text-gray-400 text-sm">Total Views</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">0</div>
                  <div className="text-gray-400 text-sm">Total Earnings</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Create New Post
                  </button>
                  <button className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors">
                    View Analytics
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Recent Activity</h4>
                <div className="text-gray-400 text-sm text-center py-8">
                  No recent activity
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setShowAuthorDashboardModal(false)}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      , document.body
      )}



      
    </div>
  );
};

export default UserProfileDropdown;