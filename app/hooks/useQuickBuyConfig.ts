import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/providers';
import toast from 'react-hot-toast';

export interface QuickBuyConfig {
  amounts: number[];
  defaultSlippage: number;
  autoApprove: boolean;
  preferredDex: string | null;
  updatedAt?: Date;
}

const DEFAULT_CONFIG: QuickBuyConfig = {
  amounts: [0.01, 0.025, 0.05, 0.1],
  defaultSlippage: 1,
  autoApprove: false,
  preferredDex: null,
};

/**
 * Hook for managing Quick Buy configurations
 * Saves and loads user-specific quick buy preferences
 */
export function useQuickBuyConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<QuickBuyConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  // Load config from user account
  useEffect(() => {
    if (!user) {
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
      return;
    }

    const loadConfig = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.quickBuyConfig) {
            setConfig({
              ...DEFAULT_CONFIG,
              ...userData.quickBuyConfig,
              updatedAt: userData.quickBuyConfig.updatedAt?.toDate(),
            });
          }
        }
      } catch (error) {
        console.error('Error loading quick buy config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [user]);

  // Save config to user account
  const saveConfig = useCallback(async (newConfig: Partial<QuickBuyConfig>) => {
    if (!user) {
      toast.error('Please sign in to save quick buy preferences');
      return false;
    }

    try {
      const updatedConfig = {
        ...config,
        ...newConfig,
        updatedAt: new Date(),
      };

      await setDoc(
        doc(db, 'users', user.uid),
        {
          quickBuyConfig: {
            ...updatedConfig,
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );

      setConfig(updatedConfig);
      toast.success('Quick buy preferences saved');
      return true;
    } catch (error) {
      console.error('Error saving quick buy config:', error);
      toast.error('Failed to save preferences');
      return false;
    }
  }, [user, config]);

  return {
    config,
    loading,
    saveConfig,
  };
}



