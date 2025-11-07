'use client';

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { config } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { LoadingProvider } from "./components/LoadingProvider";
import { Toaster } from "react-hot-toast";
import LoginModal from "./components/LoginModal";
import CookieBanner from "./components/CookieBanner";
import Footer from "./components/Footer";

// Create a new query client
const queryClient = new QueryClient();

// Auth context
interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

// Wallet system context
interface WalletSystemContextType {
  walletSystem: "wagmi" | "self-custodial";
  setWalletSystem: (system: "wagmi" | "self-custodial") => void;
  selfCustodialWallet: {
    address: string;
    isConnected: boolean;
    ethBalance: string;
    tokenBalance: string;
  } | null;
  setSelfCustodialWallet: (wallet: { address: string; isConnected: boolean; ethBalance: string; tokenBalance: string } | null) => void;
  walletLoading: boolean;
  setWalletLoading: (loading: boolean) => void;
}

const WalletSystemContext = createContext<WalletSystemContextType>({
  walletSystem: "self-custodial",
  setWalletSystem: () => {},
  selfCustodialWallet: null,
  setSelfCustodialWallet: () => {},
  walletLoading: true,
  setWalletLoading: () => {},
});

// Voting modal context
interface VotingModalContextType {
  showVotingModal: boolean;
  setShowVotingModal: (show: boolean) => void;
  selectedIndexForVoting: string;
  setSelectedIndexForVoting: (index: string) => void;
}

const VotingModalContext = createContext<VotingModalContextType>({
  showVotingModal: false,
  setShowVotingModal: () => {},
  selectedIndexForVoting: '',
  setSelectedIndexForVoting: () => {},
});

// Login modal context
interface LoginModalContextType {
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  redirectTo: string;
  setRedirectTo: (path: string) => void;
}

const LoginModalContext = createContext<LoginModalContextType>({
  showLoginModal: false,
  setShowLoginModal: () => {},
  redirectTo: '/',
  setRedirectTo: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useWalletSystem = () => {
  const context = useContext(WalletSystemContext);
  if (!context) {
    throw new Error("useWalletSystem must be used within a WalletSystemProvider");
  }
  return context;
};

export const useVotingModal = () => {
  const context = useContext(VotingModalContext);
  if (!context) {
    throw new Error("useVotingModal must be used within a VotingModalProvider");
  }
  return context;
};

export const useLoginModal = () => {
  const context = useContext(LoginModalContext);
  if (!context) {
    throw new Error("useLoginModal must be used within a LoginModalProvider");
  }
  return context;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletSystem, setWalletSystem] = useState<"wagmi" | "self-custodial">("self-custodial");
  const [selfCustodialWallet, setSelfCustodialWallet] = useState<{ address: string; isConnected: boolean; ethBalance: string; tokenBalance: string } | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [selectedIndexForVoting, setSelectedIndexForVoting] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [redirectTo, setRedirectTo] = useState('/');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Create or update user document in Firestore
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            // Create new user document
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
              createdAt: new Date(),
              updatedAt: new Date(),
              theme: 'dark',
              notifications: {
                email: true,
                push: true,
                trading: true,
                news: false,
              },
              privacy: {
                showProfile: true,
                showTrades: true,
                showBalance: false,
              },
              security: {
                twoFactorEnabled: false,
                sessionTimeout: 30,
              },
              // Events-specific fields
              interests: [],
              followedProjects: [],
              followedKOLs: [],
              reputation: {
                totalScore: 0,
                votingPower: 1,
                canVoteOnEvents: true,
              },
              votingHistory: {},
              projectEngagement: {},
              rsvpedEvents: [],
              attendedEvents: [],
              badges: [],
            });
            console.log('✅ User document created successfully');
          } else {
            // Update existing user document with latest auth data and ensure Events fields exist
            const existingData = userDoc.data();
            await setDoc(userDocRef, {
              email: user.email,
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
              updatedAt: new Date(),
              // Ensure Events fields exist for existing users
              interests: existingData.interests || [],
              followedProjects: existingData.followedProjects || [],
              followedKOLs: existingData.followedKOLs || [],
              reputation: existingData.reputation || {
                totalScore: 0,
                votingPower: 1,
                canVoteOnEvents: true,
              },
              votingHistory: existingData.votingHistory || {},
              projectEngagement: existingData.projectEngagement || {},
              rsvpedEvents: existingData.rsvpedEvents || [],
              attendedEvents: existingData.attendedEvents || [],
              badges: existingData.badges || [],
            }, { merge: true });
            console.log('✅ User document updated successfully');
          }
        } catch (error) {
          console.error('❌ Error creating/updating user document:', error);
        }
      }
      
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);



  // Handle wallet loading state
  useEffect(() => {
    // Check if wallet exists in localStorage
    if (typeof window !== "undefined") {
      const storedWallet = localStorage.getItem("cypherx_wallet");
      if (!storedWallet) {
        // No wallet exists, set loading to false
        setWalletLoading(false);
      }
    }
  }, []);

  return (
    <LoadingProvider>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <RainbowKitProvider>
            <AuthContext.Provider value={{ user, loading }}>
              <WalletSystemContext.Provider 
                value={{ 
                  walletSystem, 
                  setWalletSystem, 
                  selfCustodialWallet, 
                  setSelfCustodialWallet,
                  walletLoading,
                  setWalletLoading
                }}
              >
                <VotingModalContext.Provider
                  value={{
                    showVotingModal,
                    setShowVotingModal,
                    selectedIndexForVoting,
                    setSelectedIndexForVoting
                  }}
                >
                  <LoginModalContext.Provider
                    value={{
                      showLoginModal,
                      setShowLoginModal,
                      redirectTo,
                      setRedirectTo
                    }}
                  >
                    <div className="flex min-h-screen flex-col">
                      <main className="flex-1 pb-24 sm:pb-20">
                        {children}
                      </main>
                      <Footer />
                    </div>
                    <LoginModal
                      isOpen={showLoginModal}
                      onClose={() => setShowLoginModal(false)}
                      redirectTo={redirectTo}
                    />
                    <Toaster 
                      position="bottom-left" 
                      toastOptions={{
                        style: {
                          zIndex: 99999999,
                        },
                      }}
                    />
                    <CookieBanner />
                  </LoginModalContext.Provider>
                </VotingModalContext.Provider>
              </WalletSystemContext.Provider>
            </AuthContext.Provider>
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </LoadingProvider>
  );
}