"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, type Auth } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth as firebaseAuth, db, storage } from "@/lib/firebase";
import { useAuth, useWalletSystem, useLoginModal } from "@/app/providers";
import { useUserSettings } from "@/app/hooks/useUserSettings";
import { motion, AnimatePresence } from "framer-motion";
import { FiUser, FiX, FiCheck, FiAlertCircle, FiChevronRight, FiLogOut, FiLogIn, FiCalendar, FiEdit3, FiSettings, FiGift, FiFileText } from "react-icons/fi";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import TierProgressionModal from "./TierProgressionModal";
import PointsHistoryModal from "./PointsHistoryModal";
import PnLCalendarModal from "./PnLCalendarModal";
import { motionPresets } from "@/app/styles/design-tokens";

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
  const { setShowLoginModal, setRedirectTo } = useLoginModal();
  const { 
    updateAlias, 
    loading: settingsLoading 
  } = useUserSettings();
  const walletAddress = selfCustodialWallet?.address;
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('normie');

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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden">
              {profilePicture ? (
                <Image
                  src={profilePicture}
                  alt="Profile"
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FiUser className="w-4 h-4 text-gray-500" />
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-white">
              {user ? (displayName || 'My Profile') : 'Welcome'}
            </div>
            <div className="text-xs text-gray-500 capitalize">{tier}</div>
          </div>
        </div>
        {/* Close button for mobile */}
        <button
          onClick={() => setShowAccountModal(false)}
          className="sm:hidden p-2 text-gray-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-3 sm:px-4 py-2 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
        {/* Navigation Links */}
        <div>
          {walletAddress && (
            <button
              onClick={() => {
                setShowPnLCalendar(true);
                setShowAccountModal(false);
              }}
              className="flex items-center justify-between w-full py-3 text-gray-400 hover:text-white transition-colors border-b border-gray-800/40"
            >
              <div className="flex items-center gap-3">
                <FiCalendar className="w-4 h-4" />
                <span className="text-sm">P&L Calendar</span>
              </div>
              <FiChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}

          {isAuthor && (
            <button
              onClick={() => {
                setShowAuthorDashboardModal(true);
                setShowAccountModal(false);
              }}
              className="flex items-center justify-between w-full py-3 text-gray-400 hover:text-white transition-colors border-b border-gray-800/40"
            >
              <div className="flex items-center gap-3">
                <FiFileText className="w-4 h-4" />
                <span className="text-sm">Author Dashboard</span>
              </div>
              <FiChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}

          <button
            onClick={() => setShowAliasModal(true)}
            className="flex items-center justify-between w-full py-3 text-gray-400 hover:text-white transition-colors border-b border-gray-800/40"
          >
            <div className="flex items-center gap-3">
              <FiEdit3 className="w-4 h-4" />
              <span className="text-sm">Set Alias</span>
            </div>
            <FiChevronRight className="w-4 h-4 text-gray-600" />
          </button>

          <button
            onClick={() => {
              setShowAccountSettingsModal(true);
              setShowAccountModal(false);
            }}
            className="flex items-center justify-between w-full py-3 text-gray-400 hover:text-white transition-colors border-b border-gray-800/40"
          >
            <div className="flex items-center gap-3">
              <FiSettings className="w-4 h-4" />
              <span className="text-sm">Account Settings</span>
            </div>
            <FiChevronRight className="w-4 h-4 text-gray-600" />
          </button>

          <Link
            href="/rewards"
            className="flex items-center justify-between w-full py-3 text-gray-400 hover:text-white transition-colors border-b border-gray-800/40"
            onClick={() => setShowAccountModal(false)}
          >
            <div className="flex items-center gap-3">
              <FiGift className="w-4 h-4" />
              <span className="text-sm">Rewards & Referrals</span>
            </div>
            <FiChevronRight className="w-4 h-4 text-gray-600" />
          </Link>

          {/* Sign Out / Sign In */}
          {user ? (
            <button
              onClick={handleSignOut}
              className="flex items-center justify-between w-full py-3 text-gray-400 hover:text-red-400 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FiLogOut className="w-4 h-4" />
                <span className="text-sm">Sign Out</span>
              </div>
            </button>
          ) : (
            <button
              onClick={() => {
                setRedirectTo(window.location.pathname);
                setShowLoginModal(true);
                setShowAccountModal(false);
              }}
              className="flex items-center justify-between w-full py-3 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FiLogIn className="w-4 h-4" />
                <span className="text-sm">Sign In</span>
              </div>
            </button>
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
                  {...motionPresets.dropdownDesktop}
                  ref={modalRef}
                  className="fixed w-72 bg-gray-950/95 backdrop-blur-xl border border-gray-800/60 shadow-2xl shadow-black/40 overflow-hidden z-[9999] rounded-2xl"
                  style={{
                    top: '85px',
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
                  className="fixed inset-0 z-[9999] flex items-end sm:items-center sm:justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    ref={modalRef}
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    className="w-full sm:max-w-sm h-[85vh] sm:h-auto sm:max-h-[75vh] bg-gray-950 sm:border sm:border-gray-800/60 shadow-2xl overflow-hidden rounded-t-3xl sm:rounded-2xl flex flex-col sm:mx-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Mobile drag handle */}
                    <div className="sm:hidden flex justify-center pt-3 pb-1">
                      <div className="w-10 h-1 rounded-full bg-gray-600" />
                    </div>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center sm:justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-gray-950 w-full sm:w-96 sm:border sm:border-gray-800/60 sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            
            <div className="px-5 py-4 border-b border-gray-800/60">
              <h3 className="text-white text-lg font-semibold">Set Your Alias</h3>
              <p className="text-gray-400 text-sm mt-1">
                Choose a display name for leaderboards and community.
              </p>
            </div>
            
            <div className="px-5 py-4">
              <label className="block text-gray-300 text-xs font-medium uppercase tracking-wide mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-900/80 border border-gray-800/60 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 text-sm transition-all duration-200"
                placeholder="Enter your preferred display name"
                maxLength={20}
              />
              <p className="text-gray-500 text-xs mt-2">{alias.length}/20 characters</p>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-gray-800/60">
              <button
                onClick={() => setShowAliasModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-900/60 border border-gray-800/60 text-gray-300 hover:bg-gray-800/60 hover:border-gray-700 rounded-xl transition-all duration-200 font-medium text-sm"
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
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-200 font-medium text-sm"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm sm:flex sm:items-center sm:justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="bg-gray-950 w-full h-full sm:h-auto sm:max-w-[520px] sm:mx-4 sm:border sm:border-gray-800/60 shadow-2xl flex flex-col sm:max-h-[85vh] sm:rounded-2xl"
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-800/60 bg-gray-950 flex-shrink-0">
              <div className="text-left">
                <span className="text-[10px] uppercase tracking-[0.2em] text-blue-400/70 font-medium">Profile</span>
                <h3 className="text-white text-base sm:text-lg font-semibold mt-0.5">Account Settings</h3>
              </div>
              <button
                onClick={() => setShowAccountSettingsModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/60 hover:border-gray-700 text-gray-400 hover:text-white transition-all duration-200"
                aria-label="Close"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent px-4 sm:px-5 py-4 space-y-4">
              {/* Profile Section */}
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
                <h4 className="text-white font-semibold text-sm mb-4">Profile Information</h4>
                <div className="space-y-4">
                  {/* Profile Picture */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-900/80 border border-gray-800/60">
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
                            <FiUser className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center transition-colors rounded-lg shadow-lg"
                      >
                        <FiEdit3 className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <h5 className="text-white font-medium text-sm">Profile Picture</h5>
                      <p className="text-gray-400 text-xs mt-0.5">256x256 minimum</p>
                      {uploadStatus !== 'idle' && uploadMessage && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`mt-2 px-2.5 py-1.5 text-xs flex items-center gap-1.5 rounded-lg ${
                            uploadStatus === 'success' 
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {uploadStatus === 'success' ? <FiCheck className="w-3.5 h-3.5" /> : <FiAlertCircle className="w-3.5 h-3.5" />}
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

                  {/* Display Name */}
                  <div>
                    <label className="block text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-900/80 border border-gray-800/60 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 text-sm transition-all duration-200"
                      placeholder="Enter your display name"
                    />
                  </div>
                </div>
              </div>

              {/* Notifications Section */}
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
                <h4 className="text-white font-semibold text-sm mb-3">Notifications</h4>
                <div className="space-y-2">
                  {[
                    { key: 'email', label: 'Email', desc: 'Cycle insights and updates' },
                    { key: 'push', label: 'Push', desc: 'Instant signals to your device' },
                    { key: 'trading', label: 'Trading', desc: 'Positions and P&L alerts' },
                    { key: 'news', label: 'News', desc: 'Market commentary' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-center justify-between gap-3 p-3 bg-gray-900/60 hover:bg-gray-800/40 rounded-xl transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-800/60">
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-200 text-sm font-medium">{label}</span>
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">{desc}</p>
                      </div>
                      <div className="relative flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={notifications[key as keyof typeof notifications]}
                          onChange={(e) => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5.5 rounded-full transition-colors duration-200 flex items-center px-0.5 ${
                          notifications[key as keyof typeof notifications] ? 'bg-blue-500' : 'bg-gray-700'
                        }`}>
                          <div className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                            notifications[key as keyof typeof notifications] ? 'translate-x-[18px]' : 'translate-x-0'
                          }`} />
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Privacy Section */}
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
                <h4 className="text-white font-semibold text-sm mb-3">Privacy</h4>
                <div className="space-y-2">
                  {[
                    { key: 'showProfile', label: 'Show Profile', desc: 'Allow others to discover you' },
                    { key: 'showTrades', label: 'Show Trades', desc: 'Share trades with followers' },
                    { key: 'showBalance', label: 'Show Balance', desc: 'Display wallet balance' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-center justify-between gap-3 p-3 bg-gray-900/60 hover:bg-gray-800/40 rounded-xl transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-800/60">
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-200 text-sm font-medium">{label}</span>
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">{desc}</p>
                      </div>
                      <div className="relative flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={privacy[key as keyof typeof privacy]}
                          onChange={(e) => setPrivacy(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5.5 rounded-full transition-colors duration-200 flex items-center px-0.5 ${
                          privacy[key as keyof typeof privacy] ? 'bg-blue-500' : 'bg-gray-700'
                        }`}>
                          <div className={`w-4.5 h-4.5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                            privacy[key as keyof typeof privacy] ? 'translate-x-[18px]' : 'translate-x-0'
                          }`} />
                        </div>
                      </div>
                    </label>
                  ))}
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
                onClick={() => setShowAccountSettingsModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-900/60 border border-gray-800/60 text-gray-300 hover:bg-gray-800/60 hover:border-gray-700 rounded-xl transition-all duration-200 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2"
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
        </div>
      , document.body
      )}

      {/* Author Dashboard Modal */}
      {showAuthorDashboardModal && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center sm:justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="bg-gray-950 w-full h-[90vh] sm:h-auto sm:max-w-2xl sm:mx-4 sm:max-h-[85vh] sm:border sm:border-gray-800/60 sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-800/60 flex-shrink-0">
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-green-400/70 font-medium">Author</span>
                <h3 className="text-white text-base sm:text-lg font-semibold mt-0.5">Dashboard</h3>
              </div>
              <button
                onClick={() => setShowAuthorDashboardModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/60 hover:border-gray-700 text-gray-400 hover:text-white transition-all duration-200"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent px-4 sm:px-5 py-4 space-y-4">
              {/* Stats Overview */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: '0', label: 'Posts', color: 'blue' },
                  { value: '0', label: 'Views', color: 'green' },
                  { value: '0', label: 'Earnings', color: 'purple' },
                ].map(({ value, label, color }) => (
                  <div key={label} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-3 text-center">
                    <div className={`text-xl sm:text-2xl font-bold text-${color}-400`}>{value}</div>
                    <div className="text-gray-400 text-xs mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
                <h4 className="text-white font-semibold text-sm mb-3">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all duration-200 text-sm font-medium">
                    Create Post
                  </button>
                  <button className="px-4 py-2.5 bg-gray-900/60 border border-gray-800/60 text-gray-300 hover:bg-gray-800/60 hover:border-gray-700 rounded-xl transition-all duration-200 text-sm font-medium">
                    Analytics
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4">
                <h4 className="text-white font-semibold text-sm mb-3">Recent Activity</h4>
                <div className="text-gray-500 text-sm text-center py-8">
                  No recent activity
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end px-4 sm:px-5 py-4 border-t border-gray-800/60 flex-shrink-0">
              <button
                onClick={() => setShowAuthorDashboardModal(false)}
                className="px-4 py-2.5 bg-gray-900/60 border border-gray-800/60 text-gray-300 hover:bg-gray-800/60 hover:border-gray-700 rounded-xl transition-all duration-200 font-medium text-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      , document.body
      )}



      
    </div>
  );
};

export default UserProfileDropdown;