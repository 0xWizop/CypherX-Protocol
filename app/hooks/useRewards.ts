import { useState, useEffect, useCallback } from 'react';
import { useAuth, useWalletSystem } from '../providers';

interface Quest {
  id: number;
  title: string;
  points: number;
  progress: number;
  target: number;
  icon: string;
  color: string;
}

interface UserRewards {
  points: number;
  earned: number;
  ethRewards: number;
  tier: string;
  referralCode: string;
  referrals: number;
  referralRate: number;
  volumeTraded: number;
  transactions: number;
  referredBy?: string | null;
  referralBonusEligible?: boolean;
  referralBonusClaimed?: boolean;
  referralCodeEdited?: boolean;
  quests: Quest[];
  lastUpdated: string;
}

interface ReferralData {
  totalReferrals: number;
  referralEarnings: number;
  recentReferrals: number;
  referrals: any[];
}

interface ClaimHistory {
  claimHistory: any[];
  pendingClaims: any[];
  totalClaims: number;
}

export const useRewards = () => {
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
  const walletAddress = selfCustodialWallet?.address;
  const [rewards, setRewards] = useState<UserRewards | null>(null);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [claimHistory, setClaimHistory] = useState<ClaimHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user rewards data
  const fetchRewards = useCallback(async () => {
    if (!user && !walletAddress) return;

    try {
      setLoading(true);
      setError(null);

      let headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Try to get Firebase token, but don't fail if it doesn't work
      try {
        if (user) {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('Could not get Firebase token, using wallet address fallback');
      }

      // Add wallet address as query parameter for fallback
      const url = walletAddress 
        ? `/api/rewards?walletAddress=${encodeURIComponent(walletAddress)}`
        : '/api/rewards';

      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          // User not found or no rewards - return empty data instead of error
          setRewards({
            points: 0,
            earned: 0,
            ethRewards: 0,
            tier: 'normie',
            referralCode: 'CYPHERX123',
            referrals: 0,
            referralRate: 30,
            volumeTraded: 0,
            transactions: 0,
            referredBy: null,
            referralBonusEligible: false,
            referralBonusClaimed: false,
            referralCodeEdited: false,
            quests: [
              {
                id: 1,
                title: "Refer 3 people",
                points: 1500,
                progress: 0,
                target: 3,
                icon: "FaUserFriends",
                color: "text-green-500"
              },
              {
                id: 2,
                title: "Trade 5 ETH volume",
                points: 1000,
                progress: 0,
                target: 5,
                icon: "FiTrendingUp",
                color: "text-blue-500"
              }
            ],
            lastUpdated: new Date().toISOString()
          });
          return;
        }
        throw new Error('Failed to fetch rewards');
      }

      const data = await response.json();
      setRewards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rewards');
      console.error('Error fetching rewards:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch referral data
  const fetchReferralData = useCallback(async () => {
    if (!user && !walletAddress) return;

    try {
      setLoading(true);
      setError(null);

      let headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Try to get Firebase token, but don't fail if it doesn't work
      try {
        if (user) {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('Could not get Firebase token, using wallet address fallback');
      }

      // Add wallet address as query parameter for fallback
      const url = walletAddress 
        ? `/api/rewards/referral?walletAddress=${encodeURIComponent(walletAddress)}`
        : '/api/rewards/referral';

      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          // No referral data - return empty data instead of error
          setReferralData({
            totalReferrals: 0,
            referralEarnings: 0,
            recentReferrals: 0,
            referrals: []
          });
          return;
        }
        throw new Error('Failed to fetch referral data');
      }

      const data = await response.json();
      setReferralData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch referral data');
      console.error('Error fetching referral data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch claim history
  const fetchClaimHistory = useCallback(async () => {
    if (!user && !walletAddress) return;

    try {
      setLoading(true);
      setError(null);

      let headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Try to get Firebase token, but don't fail if it doesn't work
      try {
        if (user) {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('Could not get Firebase token, using wallet address fallback');
      }

      // Add wallet address as query parameter for fallback
      const url = walletAddress 
        ? `/api/rewards/claim?walletAddress=${encodeURIComponent(walletAddress)}`
        : '/api/rewards/claim';

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch claim history');
      }

      const data = await response.json();
      setClaimHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch claim history');
      console.error('Error fetching claim history:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Process referral code
  const processReferral = useCallback(async (referralCode: string) => {
    if (!user && !walletAddress) return { success: false, error: 'User not authenticated' };

    try {
      setLoading(true);
      setError(null);

      let headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Try to get Firebase token, but don't fail if it doesn't work
      try {
        if (user) {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('Could not get Firebase token, using wallet address fallback');
      }

      const response = await fetch('/api/rewards/referral', {
        method: 'POST',
        headers,
        body: JSON.stringify({ referralCode, walletAddress }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process referral');
      }

      // Refresh rewards data after successful referral
      await fetchRewards();
      await fetchReferralData();

      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process referral';
      setError(errorMessage);
      console.error('Error processing referral:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user, fetchRewards, fetchReferralData]);

  // Claim rewards
  const claimRewards = useCallback(async () => {
    if (!user && !walletAddress) return { success: false, error: 'User not authenticated' };

    try {
      setLoading(true);
      setError(null);

      let headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Try to get Firebase token, but don't fail if it doesn't work
      try {
        if (user) {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('Could not get Firebase token, using wallet address fallback');
      }

      const response = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({ walletAddress }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to claim rewards');
      }

      // Refresh rewards data after successful claim
      await fetchRewards();
      await fetchClaimHistory();

      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to claim rewards';
      setError(errorMessage);
      console.error('Error claiming rewards:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user, fetchRewards, fetchClaimHistory]);

  // Update rewards after swap (called from swap interface)
  const updateRewardsAfterSwap = useCallback(async (swapData: {
    swapAmount: number;
    swapValue: number;
    tokenAddress: string;
    referralCode?: string;
  }) => {
    if (!user && !walletAddress) return { success: false, error: 'User not authenticated' };

    try {
      setLoading(true);
      setError(null);

      let headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Try to get Firebase token, but don't fail if it doesn't work
      try {
        if (user) {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('Could not get Firebase token, using wallet address fallback');
      }

      const response = await fetch('/api/rewards', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...swapData, walletAddress }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update rewards');
      }

      // Refresh rewards data after successful swap
      await fetchRewards();

      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update rewards';
      setError(errorMessage);
      console.error('Error updating rewards:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user, fetchRewards]);

  // Edit referral code (one-time only)
  const editReferralCode = useCallback(async (newReferralCode: string) => {
    if (!user && !walletAddress) return { success: false, error: 'User not authenticated' };

    try {
      setLoading(true);
      setError(null);

      let headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Try to get Firebase token, but don't fail if it doesn't work
      try {
        if (user) {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('Could not get Firebase token, using wallet address fallback');
      }

      const response = await fetch('/api/rewards', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'editReferralCode',
          newReferralCode,
          walletAddress
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to edit referral code');
      }

      // Refresh rewards data after successful edit
      await fetchRewards();

      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to edit referral code';
      setError(errorMessage);
      console.error('Error editing referral code:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user, fetchRewards]);

  // Initialize data on mount
  useEffect(() => {
    if (user || walletAddress) {
      fetchRewards();
      fetchReferralData();
      fetchClaimHistory();
    }
  }, [user, walletAddress, fetchRewards, fetchReferralData, fetchClaimHistory]);

  return {
    rewards,
    referralData,
    claimHistory,
    loading,
    error,
    fetchRewards,
    fetchReferralData,
    fetchClaimHistory,
    processReferral,
    claimRewards,
    updateRewardsAfterSwap,
    editReferralCode,
    refreshAll: () => {
      fetchRewards();
      fetchReferralData();
      fetchClaimHistory();
    }
  };
};
