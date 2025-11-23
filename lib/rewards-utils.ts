import { adminDb } from '@/lib/firebase-admin';

/**
 * Helper function to get or create user by wallet address
 */
export async function getUserByWalletAddress(walletAddress: string): Promise<{ userId: string | null; userData: any }> {
  const db = adminDb();
  if (!db) {
    throw new Error('Database connection failed');
  }

  const normalizedWallet = walletAddress.toLowerCase();

  // First, check if wallet is linked to a user account via user_wallet_data
  const walletLinkSnapshot = await db.collection('user_wallet_data')
    .where('walletAddress', '==', normalizedWallet)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!walletLinkSnapshot.empty) {
    const linkData = walletLinkSnapshot.docs[0].data();
    const userId = linkData.userId;

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return {
        userId,
        userData: userDoc.data()
      };
    }
  }

  // Fallback: check if user document has this wallet address directly
  const userSnapshot = await db.collection('users')
    .where('walletAddress', '==', normalizedWallet)
    .limit(1)
    .get();

  if (!userSnapshot.empty) {
    const userDoc = userSnapshot.docs[0];
    return {
      userId: userDoc.id,
      userData: userDoc.data()
    };
  }

  // No user found
  return {
    userId: null,
    userData: null
  };
}

/**
 * Calculate cashback based on user tier
 * Platform fee: 0.75% of swap value
 * 0x protocol fee: 0.15% of swap value (deducted from platform fee)
 * Cashback is calculated as a percentage of the remaining platform fee (after 0x fee)
 */
export function calculateCashback(swapValueUSD: number, tier: string): number {
  const platformFee = swapValueUSD * 0.0075; // 0.75% platform fee
  const protocolFee = swapValueUSD * 0.0015; // 0.15% for 0x protocol
  const remainingFee = platformFee - protocolFee; // Fee available for cashback/referrals
  
  const cashbackRates: Record<string, number> = {
    normie: 0.05,   // 5% of remaining fee
    degen: 0.10,    // 10% of remaining fee
    alpha: 0.15,    // 15% of remaining fee
    mogul: 0.20,    // 20% of remaining fee
    titan: 0.25     // 25% of remaining fee
  };

  const cashbackRate = cashbackRates[tier] || cashbackRates.normie;
  return remainingFee * cashbackRate;
}

/**
 * Calculate tier based on points
 * Matches the tier system in app/api/tiers/route.ts
 */
export function calculateTier(points: number): string {
  if (points >= 50000) return 'titan';
  if (points >= 20000) return 'mogul';
  if (points >= 8000) return 'alpha';
  if (points >= 2000) return 'degen';
  return 'normie';
}

/**
 * Process referral rewards when a swap happens
 */
export async function processReferralReward(
  refereeUserId: string,
  swapValueUSD: number,
  platformFee: number
): Promise<{ referralReward: number; referrerId: string | null }> {
  const db = adminDb();
  if (!db) {
    throw new Error('Database connection failed');
  }

  // Get user's referral info
  const userDoc = await db.collection('users').doc(refereeUserId).get();
  if (!userDoc.exists) {
    return { referralReward: 0, referrerId: null };
  }

  const userData = userDoc.data();
  const referredBy = userData?.referredBy;

  if (!referredBy) {
    return { referralReward: 0, referrerId: null };
  }

  // Find referrer by referral code
  const referralCodeDoc = await db.collection('referralCodes').doc(referredBy).get();
  if (!referralCodeDoc.exists) {
    // Fallback: search in rewards collection
    const rewardsSnapshot = await db.collection('rewards')
      .where('referralCode', '==', referredBy)
      .limit(1)
      .get();

    if (rewardsSnapshot.empty) {
      return { referralReward: 0, referrerId: null };
    }

    const referrerId = rewardsSnapshot.docs[0].id;
    // Platform fee: 0.75%, 0x protocol fee: 0.15%, remaining: 0.60%
  const protocolFee = swapValueUSD * 0.0015; // 0.15% for 0x protocol
  const remainingFee = platformFee - protocolFee; // Fee available for referrals
  const referralReward = remainingFee * 0.3; // 30% of remaining fee

    // Update referrer's rewards
    const referrerRewardsRef = db.collection('rewards').doc(referrerId);
    const referrerRewardsDoc = await referrerRewardsRef.get();

    if (referrerRewardsDoc.exists) {
      const currentRewards = referrerRewardsDoc.data();
      await referrerRewardsRef.update({
        ethRewards: (currentRewards?.ethRewards || 0) + referralReward,
        lastUpdated: new Date().toISOString()
      });
    } else {
      // Create rewards document if it doesn't exist
      await referrerRewardsRef.set({
        ethRewards: referralReward,
        referralCode: referredBy,
        referrals: 0,
        referralRate: 30,
        volumeTraded: 0,
        transactions: 0,
        lastUpdated: new Date().toISOString()
      });
    }

    // Save referral transaction record
    await db.collection('referrals').add({
      referrerId,
      refereeId: refereeUserId,
      referralCode: referredBy,
      platformFee,
      referralReward,
      swapValueUSD,
      timestamp: new Date().toISOString(),
      status: 'active'
    });

    return { referralReward, referrerId };
  }

  const referralCodeData = referralCodeDoc.data();
  const referrerId = referralCodeData!.userId;

  // Platform fee: 0.75%, 0x protocol fee: 0.15%, remaining: 0.60%
  const protocolFee = swapValueUSD * 0.0015; // 0.15% for 0x protocol
  const remainingFee = platformFee - protocolFee; // Fee available for referrals
  const referralReward = remainingFee * 0.3; // 30% of remaining fee

  // Update referrer's rewards
  const referrerRewardsRef = db.collection('rewards').doc(referrerId);
  const referrerRewardsDoc = await referrerRewardsRef.get();

  if (referrerRewardsDoc.exists) {
    const currentRewards = referrerRewardsDoc.data();
    await referrerRewardsRef.update({
      ethRewards: (currentRewards?.ethRewards || 0) + referralReward,
      lastUpdated: new Date().toISOString()
    });
  } else {
    // Create rewards document if it doesn't exist
    await referrerRewardsRef.set({
      ethRewards: referralReward,
      referralCode: referredBy,
      referrals: 0,
      referralRate: 30,
      volumeTraded: 0,
      transactions: 0,
      lastUpdated: new Date().toISOString()
    });
  }

  // Save referral transaction record
  await db.collection('referrals').add({
    referrerId,
    refereeId: refereeUserId,
    referralCode: referredBy,
    platformFee,
    referralReward,
    swapValueUSD,
    timestamp: new Date().toISOString(),
    status: 'active'
  });

  return { referralReward, referrerId };
}

/**
 * Update user rewards with cashback and points
 */
export async function updateUserRewards(
  userId: string,
  swapValueUSD: number,
  cashbackAmount: number,
  _platformFee: number
): Promise<void> {
  const db = adminDb();
  if (!db) {
    throw new Error('Database connection failed');
  }

  // Get user data for points
  const userDoc = await db.collection('users').doc(userId).get();
  const existingPoints = userDoc.exists ? (userDoc.data()?.points || 0) : 0;

  // Calculate new points (0.1 points per $1 traded)
  const newPoints = Math.floor(swapValueUSD * 0.1);
  const totalPoints = existingPoints + newPoints;

  // Get or create rewards document
  const rewardsRef = db.collection('rewards').doc(userId);
  const rewardsDoc = await rewardsRef.get();

  let currentRewards: any;
  if (rewardsDoc.exists) {
    currentRewards = rewardsDoc.data();
  } else {
    // Generate referral code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let referralCode = 'CYPHERX';
    for (let i = 0; i < 6; i++) {
      referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    currentRewards = {
      ethRewards: 0,
      referralCode,
      referrals: 0,
      referralRate: 30,
      volumeTraded: 0,
      transactions: 0,
      lastUpdated: new Date().toISOString()
    };
    await rewardsRef.set(currentRewards);

    // Store referral code in referralCodes collection
    await db.collection('referralCodes').doc(referralCode).set({
      userId,
      referralCode,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    });
  }

  // Calculate tier
  const tier = calculateTier(totalPoints);

  // Update rewards
  await rewardsRef.update({
    ethRewards: (currentRewards.ethRewards || 0) + cashbackAmount,
    volumeTraded: (currentRewards.volumeTraded || 0) + swapValueUSD,
    transactions: (currentRewards.transactions || 0) + 1,
    tier,
    lastUpdated: new Date().toISOString()
  });

  // Update points in users collection
  await db.collection('users').doc(userId).update({
    points: totalPoints
  });
}

