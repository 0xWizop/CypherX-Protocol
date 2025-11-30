"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, type Auth } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth as firebaseAuth, db, storage } from "@/lib/firebase";
import { useAuth, useWalletSystem } from "@/app/providers";
import { useUserSettings } from "@/app/hooks/useUserSettings";
import { motion, AnimatePresence } from "framer-motion";
import { FiUser, FiInfo, FiX, FiCheck, FiAlertCircle } from "react-icons/fi";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import TierProgressionModal from "./TierProgressionModal";
import PointsHistoryModal from "./PointsHistoryModal";
import PnLCalendarModal from "./PnLCalendarModal";

type UserProfileDropdownProps = {
  variant?: "circle" | "rounded";
};

const auth: Auth = firebaseAuth as Auth;

const DEFAULT_NOTIFICATIONS = {
  email: true,
  push: true,
  trading: true,
  news: false,
};

const DEFAULT_PRIVACY = {
  showProfile: true,
  showTrades: true,
  showBalance: false,
};

const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({ variant = "circle" }) => {
  const router = useRouter();
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
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
  const [showPnLCalendar, setShowPnLCalendar] = useState(false);
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
  const [notifications, setNotifications] = useState(() => ({ ...DEFAULT_NOTIFICATIONS }));
  const [privacy, setPrivacy] = useState(() => ({ ...DEFAULT_PRIVACY }));
  

  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Disable body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = 
      showAccountModal || 
      showTierModal || 
      showPointsHistory || 
      showPnLCalendar || 
      showAliasModal || 
      showAccountSettingsModal || 
      showAuthorDashboardModal;

    if (isAnyModalOpen) {
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
  }, [
    showAccountModal,
    showTierModal,
    showPointsHistory,
    showPnLCalendar,
    showAliasModal,
    showAccountSettingsModal,
    showAuthorDashboardModal
  ]);

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
            setDisplayName(userData.displayName || "");
            setNotifications(userData.notifications ? { ...DEFAULT_NOTIFICATIONS, ...userData.notifications } : { ...DEFAULT_NOTIFICATIONS });
            setPrivacy(userData.privacy ? { ...DEFAULT_PRIVACY, ...userData.privacy } : { ...DEFAULT_PRIVACY });
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
        notifications,
        privacy,
        updatedAt: new Date(),
      };

      await setDoc(doc(db, "users", documentId), settingsData, { merge: true });
      
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
  const isInlineDropdown = variant !== "rounded";

  const renderProfileContent = () => (
    <>
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 p-4 relative overflow-hidden">
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
            <div className="bg-white/10 backdrop-blur-sm p-3">
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
      <div className="p-4 pt-8 space-y-4">
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
            className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-900 transition-all duration-200"
          >
            <span className="font-medium text-sm">Points History</span>
          </button>

          {walletAddress && (
            <button
              onClick={() => {
                setShowPnLCalendar(true);
                setShowAccountModal(false);
              }}
              className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-900 transition-all duration-200"
            >
              <span className="font-medium text-sm">P&L Calendar</span>
            </button>
          )}

          {isAuthor && (
            <button
              onClick={() => {
                setShowAuthorDashboardModal(true);
                setShowAccountModal(false);
              }}
              className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-900 transition-all duration-200"
            >
              <span className="font-medium text-sm">Author Dashboard</span>
            </button>
          )}

          <button
            onClick={() => setShowAliasModal(true)}
            className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-900 transition-all duration-200"
          >
            <span className="font-medium text-sm">Set Alias</span>
          </button>

          <button
            onClick={() => {
              setShowAccountSettingsModal(true);
              setShowAccountModal(false);
            }}
            className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-900 transition-all duration-200"
          >
            <span className="font-medium text-sm">Account Settings</span>
          </button>

          <Link
            href="/rewards"
            className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-900 transition-all duration-200"
            onClick={() => setShowAccountModal(false)}
          >
            <span className="font-medium text-sm">Rewards & Referrals</span>
          </Link>
        </div>

        {/* Logout Section */}
        <div className="pt-3 border-t border-gray-800">
          {user ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignOut}
              className="flex items-center w-full p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200"
            >
              <span className="font-medium text-sm">Sign Out</span>
            </motion.button>
          ) : (
            <Link
              href="/login"
              className="flex items-center w-full p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all duration-200"
              onClick={() => setShowAccountModal(false)}
            >
              <span className="font-medium text-sm">Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="relative">
      <motion.button
        ref={setButtonRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAccountModal((prev) => !prev)}
        className={`flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${variant === "circle" ? "rounded-full" : "rounded-lg"} hover:scale-105 transform transition-all duration-200`}
        aria-label={user ? "Account" : "Sign In"}
      >
        <div
          className={`relative w-8 h-8 ${variant === "circle" ? "rounded-full bg-[#111827] border border-gray-600 hover:bg-[#1f2937]" : "rounded-lg bg-[#111827] border border-gray-700/60 hover:bg-[#1f2937]"} flex items-center justify-center transition-all duration-300 shadow-lg hover:border-gray-500 overflow-hidden`}
        >
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

      {showAccountModal && createPortal(
        <AnimatePresence>
          {showAccountModal && (
            isInlineDropdown ? (
              buttonRef && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  ref={modalRef}
                  className="fixed w-80 bg-gray-950 backdrop-blur-sm border border-gray-800 shadow-2xl overflow-hidden z-[9999]"
                  style={{
                    top: buttonRef.getBoundingClientRect().bottom + 32,
                    right: window.innerWidth - buttonRef.getBoundingClientRect().right,
                  }}
                >
                  {renderProfileContent()}
                </motion.div>
              )
            ) : (
              <>
                <motion.div
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAccountModal(false)}
                />
                <motion.div
                  className="fixed inset-0 z-[9999] sm:flex sm:items-center sm:justify-center sm:p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    ref={modalRef}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="w-full h-full sm:h-auto sm:max-w-sm sm:border sm:border-gray-800 bg-gray-950 shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderProfileContent()}
                  </motion.div>
                </motion.div>
              </>
            )
          )}
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

      {/* P&L Calendar Modal */}
      {showPnLCalendar && walletAddress && createPortal(
        <PnLCalendarModal
          isOpen={showPnLCalendar}
          onClose={() => setShowPnLCalendar(false)}
          walletAddress={walletAddress}
        />
      , document.body
      )}

      {/* Alias Modal */}
      {showAliasModal && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gray-950 p-6 w-96 border border-gray-800"
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
                className="flex-1 px-4 py-2 bg-gray-900 text-gray-300 hover:bg-gray-800 transition-colors"
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm sm:flex sm:items-center sm:justify-center z-[9999] sm:p-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-gray-950 w-full h-full sm:h-auto sm:max-w-[520px] sm:mx-0 sm:border sm:border-gray-800 shadow-2xl flex flex-col sm:max-h-[82vh] sm:my-auto"
          >
            <div className="relative flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800 bg-gray-950">
              <div className="text-left">
                <span className="text-[10px] uppercase tracking-[0.3em] text-blue-400/70 font-medium">Profile</span>
                <h3 className="text-white text-base sm:text-2xl font-semibold mt-1">Account Settings</h3>
              </div>
              <button
                onClick={() => setShowAccountSettingsModal(false)}
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
                  {/* Profile Picture */}
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
                          <FiUser className="w-3 h-3 text-white" />
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
                        className="inline-flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-900/80 text-xs sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingImage ? 'Uploading...' : 'Upload Image'}
                      </button>
                      
                      {/* Status Messages */}
                      {uploadStatus !== 'idle' && uploadMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`mt-3 px-3 py-2 text-sm flex items-center gap-2 ${
                            uploadStatus === 'success' 
                              ? 'bg-green-500/15 text-green-300 border border-green-500/30'
                              : 'bg-red-500/15 text-red-300 border border-red-500/30'
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
                  <label className="group flex items-center justify-between gap-3 p-3 border border-gray-800/70 bg-gray-900/60 hover:border-gray-700 transition-colors cursor-pointer">
                    <div>
                      <span className="text-gray-200 text-sm font-medium">Email Notifications</span>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-1">Cycle insights and important updates.</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={notifications.email}
                        onChange={(e) => setNotifications(prev => ({ ...prev, email: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                        notifications.email ? 'bg-blue-500' : 'bg-gray-700'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          notifications.email ? 'translate-x-5' : 'translate-x-0'
                        }`}></div>
                      </div>
                    </div>
                  </label>

                  <label className="group flex items-center justify-between gap-3 p-3 border border-gray-800/70 bg-gray-900/60 hover:border-gray-700 transition-colors cursor-pointer">
                    <div>
                      <span className="text-gray-200 text-sm font-medium">Push Notifications</span>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-1">Instant signals delivered to your device.</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={notifications.push}
                        onChange={(e) => setNotifications(prev => ({ ...prev, push: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                        notifications.push ? 'bg-blue-500' : 'bg-gray-700'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          notifications.push ? 'translate-x-5' : 'translate-x-0'
                        }`}></div>
                      </div>
                    </div>
                  </label>

                  <label className="group flex items-center justify-between gap-3 p-3 border border-gray-800/70 bg-gray-900/60 hover:border-gray-700 transition-colors cursor-pointer">
                    <div>
                      <span className="text-gray-200 text-sm font-medium">Trading Notifications</span>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-1">Get notified about positions and P&L shifts.</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={notifications.trading}
                        onChange={(e) => setNotifications(prev => ({ ...prev, trading: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                        notifications.trading ? 'bg-blue-500' : 'bg-gray-700'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          notifications.trading ? 'translate-x-5' : 'translate-x-0'
                        }`}></div>
                      </div>
                    </div>
                  </label>

                  <label className="group flex items-center justify-between gap-3 p-3 border border-gray-800/70 bg-gray-900/60 hover:border-gray-700 transition-colors cursor-pointer">
                    <div>
                      <span className="text-gray-200 text-sm font-medium">News Notifications</span>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-1">Macro stories and curated market commentary.</p>
                    </div>
                    <div className="relative">
                    <input
                        type="checkbox"
                        checked={notifications.news}
                        onChange={(e) => setNotifications(prev => ({ ...prev, news: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                        notifications.news ? 'bg-blue-500' : 'bg-gray-700'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          notifications.news ? 'translate-x-5' : 'translate-x-0'
                        }`}></div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Privacy Section */}
              <div className="bg-gray-900/40 border border-gray-800 p-3 sm:p-5 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <h4 className="text-white font-semibold text-base sm:text-lg">Privacy</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <label className="group flex items-center justify-between gap-3 p-3 border border-gray-800/70 bg-gray-900/60 hover:border-gray-700 transition-colors cursor-pointer">
                    <div>
                      <span className="text-gray-200 text-sm font-medium">Show Profile</span>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-1">Allow others to discover and follow you.</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={privacy.showProfile}
                        onChange={(e) => setPrivacy(prev => ({ ...prev, showProfile: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                        privacy.showProfile ? 'bg-blue-500' : 'bg-gray-700'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          privacy.showProfile ? 'translate-x-5' : 'translate-x-0'
                        }`}></div>
                      </div>
                    </div>
                  </label>

                  <label className="group flex items-center justify-between gap-3 p-3 border border-gray-800/70 bg-gray-900/60 hover:border-gray-700 transition-colors cursor-pointer">
                    <div>
                      <span className="text-gray-200 text-sm font-medium">Show Trades</span>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-1">Share recent trades with your followers.</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={privacy.showTrades}
                        onChange={(e) => setPrivacy(prev => ({ ...prev, showTrades: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                        privacy.showTrades ? 'bg-blue-500' : 'bg-gray-700'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          privacy.showTrades ? 'translate-x-5' : 'translate-x-0'
                        }`}></div>
                      </div>
                    </div>
                  </label>

                  <label className="group flex items-center justify-between gap-3 p-3 border border-gray-800/70 bg-gray-900/60 hover:border-gray-700 transition-colors cursor-pointer">
                    <div>
                      <span className="text-gray-200 text-sm font-medium">Show Balance</span>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-1">Reveal your wallet balance on your profile.</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={privacy.showBalance}
                        onChange={(e) => setPrivacy(prev => ({ ...prev, showBalance: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                        privacy.showBalance ? 'bg-blue-500' : 'bg-gray-700'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                          privacy.showBalance ? 'translate-x-5' : 'translate-x-0'
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
                  onClick={() => setShowAccountSettingsModal(false)}
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
            className="bg-gray-950 p-6 w-[700px] max-h-[80vh] overflow-y-auto border border-gray-800"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white text-xl font-semibold">Author Dashboard</h3>
              <button
                onClick={() => setShowAuthorDashboardModal(false)}
                  className="p-2 hover:bg-gray-900 transition-colors"
              >
                <FiX className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800/50 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">0</div>
                  <div className="text-gray-400 text-sm">Total Posts</div>
                </div>
                <div className="bg-gray-800/50 p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">0</div>
                  <div className="text-gray-400 text-sm">Total Views</div>
                </div>
                <div className="bg-gray-800/50 p-4 text-center">
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
                  className="px-4 py-2 bg-gray-900 text-gray-300 hover:bg-gray-800 transition-colors"
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