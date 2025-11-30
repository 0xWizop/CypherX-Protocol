import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/providers';
import { toast } from 'react-toastify';

export interface UserSettings {
  displayName: string;
  email: string;
  bio: string;
  profilePicture: string;
  alias: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    trading: boolean;
    news: boolean;
  };
  privacy: {
    showProfile: boolean;
    showTrades: boolean;
    showBalance: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
  };
  referralCode: string;
  referredBy: string;
  swapFeeDiscount: number;
  totalReferrals: number;
  totalReferralEarnings: number;
  quickBuyConfig?: {
    amounts: number[];
    defaultSlippage: number;
    autoApprove: boolean;
    preferredDex: string | null;
    updatedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Referral {
  id: string;
  referredUserId: string;
  referrerUserId: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  earnings?: number;
}

export interface SwapTransaction {
  id: string;
  poolAddress: string;
  amount: number;
  fee: number;
  feeDiscount: number;
  createdAt: Date;
}

export const useUserSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [swapTransactions, setSwapTransactions] = useState<SwapTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Listen to user settings changes
  useEffect(() => {
    if (!user) {
      setSettings(null);
      setReferrals([]);
      setSwapTransactions([]);
      return;
    }

    const userDocRef = doc(db, `users/${user.uid}`);
    const referralsRef = collection(db, `users/${user.uid}/referrals`);
    const swapTransactionsRef = collection(db, `users/${user.uid}/swapTransactions`);

    const unsubscribeUser = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings({
          displayName: data.displayName || '',
          email: data.email || user.email || '',
          bio: data.bio || '',
          profilePicture: data.profilePicture || '',
          alias: data.alias || '',
          theme: data.theme || 'dark',
          notifications: data.notifications || {
            email: true,
            push: true,
            trading: true,
            news: false,
          },
          privacy: data.privacy || {
            showProfile: true,
            showTrades: true,
            showBalance: false,
          },
          security: data.security || {
            twoFactorEnabled: false,
            sessionTimeout: 30,
          },
          referralCode: data.referralCode || '',
          referredBy: data.referredBy || '',
          swapFeeDiscount: data.swapFeeDiscount || 0,
          totalReferrals: data.totalReferrals || 0,
          totalReferralEarnings: data.totalReferralEarnings || 0,
          createdAt: (data.createdAt?.toDate && typeof data.createdAt.toDate === 'function') 
            ? data.createdAt.toDate() 
            : (data.createdAt instanceof Date ? data.createdAt : new Date()),
          updatedAt: (data.updatedAt?.toDate && typeof data.updatedAt.toDate === 'function')
            ? data.updatedAt.toDate()
            : (data.updatedAt instanceof Date ? data.updatedAt : new Date()),
        });
      }
    });

    const unsubscribeReferrals = onSnapshot(referralsRef, (snapshot) => {
      const refs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        completedAt: doc.data().completedAt?.toDate(),
      })) as Referral[];
      setReferrals(refs);
    });

    const unsubscribeSwapTransactions = onSnapshot(swapTransactionsRef, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as SwapTransaction[];
      setSwapTransactions(transactions);
    });

    return () => {
      unsubscribeUser();
      unsubscribeReferrals();
      unsubscribeSwapTransactions();
    };
  }, [user]);

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user) {
      toast.error('Please sign in to update settings', { position: 'bottom-left' });
      return;
    }

    setLoading(true);
    try {
      const userDocRef = doc(db, `users/${user.uid}`);
      
      // Check if user document exists, create if it doesn't
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        // Create initial user document
        await setDoc(userDocRef, {
          email: user.email || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      
      // Filter out undefined values and only include valid fields
      const validUpdates: any = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          validUpdates[key] = value;
        }
      });
      
      // Always add updatedAt
      validUpdates.updatedAt = serverTimestamp();
      
      await updateDoc(userDocRef, validUpdates);
      toast.success('Settings updated successfully', { position: 'bottom-left' });
    } catch (err) {
      console.error('Error updating settings:', err);
      toast.error('Error updating settings', { position: 'bottom-left' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateAlias = useCallback(async (alias: string) => {
    if (!user) {
      toast.error('Please sign in to update alias', { position: 'bottom-left' });
      return;
    }

    // Validate alias format
    if (!/^[a-z0-9\-_]{3,20}$/.test(alias)) {
      toast.error('Alias must be 3-20 characters, lowercase letters, numbers, hyphens, and underscores only', { position: 'bottom-left' });
      return;
    }

    setLoading(true);
    try {
      // Check if alias is already taken
      const aliasQuery = query(collection(db, 'users'), where('alias', '==', alias));
      const aliasSnapshot = await getDocs(aliasQuery);
      
      if (!aliasSnapshot.empty && aliasSnapshot.docs[0].id !== user.uid) {
        toast.error('Alias is already taken', { position: 'bottom-left' });
        return;
      }

      const userDocRef = doc(db, `users/${user.uid}`);
      await updateDoc(userDocRef, {
        alias,
        updatedAt: serverTimestamp(),
      });
      toast.success('Alias updated successfully', { position: 'bottom-left' });
    } catch (err) {
      console.error('Error updating alias:', err);
      toast.error('Error updating alias', { position: 'bottom-left' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const generateReferralCode = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to generate referral code', { position: 'bottom-left' });
      return;
    }

    setLoading(true);
    try {
      // Generate a unique referral code with retry logic
      let referralCode = '';
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Check if code already exists
        const codeQuery = query(collection(db, 'users'), where('referralCode', '==', referralCode));
        const codeSnapshot = await getDocs(codeQuery);
        
        if (codeSnapshot.empty) {
          break; // Found a unique code
        }
        
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique referral code after multiple attempts');
      }

      const userDocRef = doc(db, `users/${user.uid}`);
      await updateDoc(userDocRef, {
        referralCode,
        updatedAt: serverTimestamp(),
      });
      toast.success('Referral code generated successfully', { position: 'bottom-left' });
    } catch (err) {
      console.error('Error generating referral code:', err);
      toast.error('Error generating referral code', { position: 'bottom-left' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const applyReferralCode = useCallback(async (referralCode: string) => {
    if (!user) {
      toast.error('Please sign in to apply referral code', { position: 'bottom-left' });
      return;
    }

    if (settings?.referredBy) {
      toast.error('You have already used a referral code', { position: 'bottom-left' });
      return;
    }

    setLoading(true);
    try {
      // Find user with this referral code
      const codeQuery = query(collection(db, 'users'), where('referralCode', '==', referralCode));
      const codeSnapshot = await getDocs(codeQuery);
      
      if (codeSnapshot.empty) {
        toast.error('Invalid referral code', { position: 'bottom-left' });
        return;
      }

      const referrerDoc = codeSnapshot.docs[0];
      if (referrerDoc.id === user.uid) {
        toast.error('You cannot refer yourself', { position: 'bottom-left' });
        return;
      }

      // Create referral record
      await addDoc(collection(db, `users/${referrerDoc.id}/referrals`), {
        referredUserId: user.uid,
        referrerUserId: referrerDoc.id,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Update current user
      const userDocRef = doc(db, `users/${user.uid}`);
      await updateDoc(userDocRef, {
        referredBy: referralCode,
        swapFeeDiscount: 5, // 5% discount for using referral code
        updatedAt: serverTimestamp(),
      });

      // Update referrer's stats
      const referrerDocRef = doc(db, `users/${referrerDoc.id}`);
      await updateDoc(referrerDocRef, {
        totalReferrals: (referrerDoc.data().totalReferrals || 0) + 1,
        updatedAt: serverTimestamp(),
      });

      toast.success('Referral code applied successfully! You now have a 5% swap fee discount.', { position: 'bottom-left' });
    } catch (err) {
      console.error('Error applying referral code:', err);
      toast.error('Error applying referral code', { position: 'bottom-left' });
    } finally {
      setLoading(false);
    }
  }, [user, settings]);

  const recordSwapTransaction = useCallback(async (transaction: Omit<SwapTransaction, 'id' | 'createdAt'>) => {
    if (!user) return;

    try {
      await addDoc(collection(db, `users/${user.uid}/swapTransactions`), {
        ...transaction,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error recording swap transaction:', err);
    }
  }, [user]);

  const getReferralStats = useCallback(() => {
    if (!referrals.length) return { pending: 0, completed: 0, totalEarnings: 0 };
    
    const completed = referrals.filter(r => r.status === 'completed');
    const totalEarnings = completed.reduce((sum, r) => sum + (r.earnings || 0), 0);
    
    return {
      pending: referrals.filter(r => r.status === 'pending').length,
      completed: completed.length,
      totalEarnings,
    };
  }, [referrals]);

  const getSwapStats = useCallback(() => {
    if (!swapTransactions.length) return { totalVolume: 0, totalFees: 0, totalDiscount: 0 };
    
    const totalVolume = swapTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalFees = swapTransactions.reduce((sum, t) => sum + t.fee, 0);
    const totalDiscount = swapTransactions.reduce((sum, t) => sum + (t.fee * t.feeDiscount / 100), 0);
    
    return { totalVolume, totalFees, totalDiscount };
  }, [swapTransactions]);

  return {
    settings,
    referrals,
    swapTransactions,
    loading,
    updateSettings,
    updateAlias,
    generateReferralCode,
    applyReferralCode,
    recordSwapTransaction,
    getReferralStats,
    getSwapStats,
  };
};
