'use client';

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoadingProvider } from "./components/LoadingProvider";
import { Toaster } from "react-hot-toast";
import LoginModal from "./components/LoginModal";
import CookieBanner from "./components/CookieBanner";
import Footer from "./components/Footer";
import SiteBanner from "./components/SiteBanner";
import { usePathname } from "next/navigation";

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
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [redirectTo, setRedirectTo] = useState('/');
  const pathname = usePathname();
  const isFullScreenLayout = pathname?.includes('/explore/') && pathname?.includes('/chart');
  const isExplorerPage = pathname?.startsWith('/explorer');
  const isHomepage = pathname === "/";
  const [footerHeight, setFooterHeight] = useState(0);

  useEffect(() => {
    const updateFooterHeight = () => {
      if (typeof window === "undefined") return;
      const footerEl = document.getElementById("app-footer");
      const height = footerEl?.offsetHeight ?? 0;
      setFooterHeight(height);
      if (typeof document !== "undefined") {
        document.documentElement.style.setProperty("--app-footer-height", `${height}px`);
      }
    };

    updateFooterHeight();
    window.addEventListener("resize", updateFooterHeight);
    let observer: MutationObserver | null = null;
    const footerEl = typeof window !== "undefined" ? document.getElementById("app-footer") : null;
    if (footerEl && typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(updateFooterHeight);
      observer.observe(footerEl, { attributes: true, childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener("resize", updateFooterHeight);
      observer?.disconnect();
    };
  }, [isFullScreenLayout]);

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
            <LoginModalContext.Provider
              value={{
                showLoginModal,
                setShowLoginModal,
                redirectTo,
                setRedirectTo
              }}
            >
              <div className={`flex min-h-screen flex-col ${isExplorerPage ? 'bg-gray-950' : ''}`}>
                <SiteBanner />
                <main
                  className={`flex-1 ${isExplorerPage ? 'bg-gray-950' : ''}`}
                  style={{ 
                    paddingBottom: `${isFullScreenLayout || isExplorerPage ? 0 : footerHeight ? footerHeight + 16 : 72}px` 
                  }}
                >
                  {children}
                </main>
                <Footer isSticky={!isHomepage} />
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
          </WalletSystemContext.Provider>
            </AuthContext.Provider>
      </QueryClientProvider>
    </LoadingProvider>
  );
}