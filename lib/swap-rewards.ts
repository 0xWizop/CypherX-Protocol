import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserByWalletAddress, calculateTier } from './rewards-utils';

/**
 * Fee Configuration Constants
 */
const PLATFORM_FEE_PERCENT = 0.75; // 0.75% platform fee
const PROTOCOL_FEE_PERCENT = 0.15; // 0.15% for 0x protocol
// Remaining fee (0.60%) is available for rewards distribution

// Cashback rates by tier
const CASHBACK_RATES: Record<string, number> = {
  normie: 0.05,   // 5% of remaining fee
  degen: 0.10,    // 10% of remaining fee
  alpha: 0.15,    // 15% of remaining fee
  mogul: 0.20,    // 20% of remaining fee
  titan: 0.25     // 25% of remaining fee
};

// Referral volume tiers for bonus cashback
const REFERRAL_VOLUME_TIERS = [
  { minVolume: 0, extraCashback: 0 },
  { minVolume: 1000, extraCashback: 5 },
  { minVolume: 5000, extraCashback: 10 },
  { minVolume: 25000, extraCashback: 15 },
  { minVolume: 100000, extraCashback: 20 },
];

const REFERRAL_REWARD_RATE = 0.30; // 30% of remaining fee goes to referrer
const POINTS_PER_DOLLAR = 0.1; // 0.1 points per $1 traded

/**
 * Calculate 0x affiliate fee from swap value
 * This is the fee that 0x protocol pays us as an affiliate
 */
function calculate0xAffiliateFee(swapValueUSD: number, feeBps?: number): number {
  // Default 0x affiliate fee is typically 0.15-0.30% (15-30 bps)
  // Check environment variable or use default
  const defaultFeeBps = feeBps || parseFloat(process.env.ZEROX_FEE_BPS || '0');
  if (defaultFeeBps > 0) {
    return swapValueUSD * (defaultFeeBps / 10000); // Convert bps to percentage
  }
  // Fallback: assume 0.15% if not configured
  return swapValueUSD * 0.0015;
}

/**
 * Calculate treasury fee (platform fee minus protocol fee)
 */
function calculateTreasuryFee(swapValueUSD: number): number {
  const platformFee = swapValueUSD * (PLATFORM_FEE_PERCENT / 100);
  const protocolFee = swapValueUSD * (PROTOCOL_FEE_PERCENT / 100);
  return platformFee - protocolFee; // Remaining fee goes to treasury/rewards
}

/**
 * Get referral volume cashback bonus
 */
function getReferralVolumeCashback(referralVolume: number): number {
  let extraCashback = 0;
  for (const tier of REFERRAL_VOLUME_TIERS) {
    if (referralVolume >= tier.minVolume) {
      extraCashback = tier.extraCashback;
    }
  }
  return extraCashback;
}

/**
 * Calculate cashback amount based on tier and referral volume
 */
function calculateCashbackAmount(
  swapValueUSD: number,
  tier: string,
  referralVolume: number = 0
): number {
  const treasuryFee = calculateTreasuryFee(swapValueUSD);
  const baseCashbackRate = CASHBACK_RATES[tier] || CASHBACK_RATES.normie;
  const extraCashback = getReferralVolumeCashback(referralVolume);
  const totalCashbackPercent = baseCashbackRate + (extraCashback / 100);
  
  return treasuryFee * totalCashbackPercent;
}

/**
 * Calculate points earned from swap
 */
function calculatePoints(swapValueUSD: number): number {
  return Math.floor(swapValueUSD * POINTS_PER_DOLLAR);
}

/**
 * Process referral reward for referrer
 */
async function processReferralReward(
  referrerId: string,
  treasuryFee: number
): Promise<number> {
  const db = adminDb();
  if (!db) {
    return 0;
  }

  const referralReward = treasuryFee * REFERRAL_REWARD_RATE;

  // Update referrer's rewards
  const referrerRewardsRef = db.collection('rewards').doc(referrerId);
  const referrerRewardsDoc = await referrerRewardsRef.get();

  if (referrerRewardsDoc.exists) {
    await referrerRewardsRef.update({
      ethRewards: FieldValue.increment(referralReward),
      lastUpdated: new Date().toISOString()
    });
  } else {
    // Create rewards document if it doesn't exist
    const referralCode = 'CYPHERX' + Math.random().toString(36).substring(2, 8).toUpperCase();
    await referrerRewardsRef.set({
      ethRewards: referralReward,
      referralCode,
      referrals: 0,
      referralRate: 30,
      volumeTraded: 0,
      transactions: 0,
      lastUpdated: new Date().toISOString()
    });
  }

  return referralReward;
}

/**
 * Check if reward already processed for this transaction (prevent duplicates)
 */
async function isRewardProcessed(transactionHash: string): Promise<boolean> {
  const db = adminDb();
  if (!db) {
    return false;
  }

  const rewardQuery = await db.collection('swap_rewards')
    .where('transactionHash', '==', transactionHash)
    .limit(1)
    .get();

  return !rewardQuery.empty;
}

/**
 * Main function to process swap rewards
 * This is the unified entry point for all swap reward processing
 */
export async function processSwapRewards(params: {
  walletAddress: string;
  swapValueUSD: number;
  swapValueETH: number;
  transactionHash: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  feeBps?: number; // Optional 0x affiliate fee in basis points
}): Promise<{
  success: boolean;
  rewards: {
    cashbackAmount: number;
    points: number;
    referralReward: number;
    treasuryFee: number;
    affiliateFee: number;
    totalRewards: number;
    cashbackPercent: number;
  };
  error?: string;
}> {
  try {
    const db = adminDb();
    if (!db) {
      return {
        success: false,
        rewards: {
          cashbackAmount: 0,
          points: 0,
          referralReward: 0,
          treasuryFee: 0,
          affiliateFee: 0,
          totalRewards: 0,
          cashbackPercent: 0
        },
        error: 'Database connection failed'
      };
    }

    const {
      walletAddress,
      swapValueUSD,
      swapValueETH,
      transactionHash,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      feeBps
    } = params;

    // Prevent duplicate processing
    const alreadyProcessed = await isRewardProcessed(transactionHash);
    if (alreadyProcessed) {
      console.log(`⚠️  Rewards already processed for transaction ${transactionHash}`);
      return {
        success: false,
        rewards: {
          cashbackAmount: 0,
          points: 0,
          referralReward: 0,
          treasuryFee: 0,
          affiliateFee: 0,
          totalRewards: 0,
          cashbackPercent: 0
        },
        error: 'Rewards already processed for this transaction'
      };
    }

    // Get user by wallet address
    const { userId, userData } = await getUserByWalletAddress(walletAddress);

    if (!userId || !userData) {
      return {
        success: false,
        rewards: {
          cashbackAmount: 0,
          points: 0,
          referralReward: 0,
          treasuryFee: 0,
          affiliateFee: 0,
          totalRewards: 0,
          cashbackPercent: 0
        },
        error: 'User not found'
      };
    }

    // Calculate fees
    const platformFee = swapValueUSD * (PLATFORM_FEE_PERCENT / 100);
    const protocolFee = swapValueUSD * (PROTOCOL_FEE_PERCENT / 100);
    const treasuryFee = platformFee - protocolFee;
    const affiliateFee = calculate0xAffiliateFee(swapValueUSD, feeBps);

    console.log(`💰 Fee breakdown for swap:`, {
      swapValueUSD: swapValueUSD.toFixed(2),
      platformFee: platformFee.toFixed(6),
      protocolFee: protocolFee.toFixed(6),
      treasuryFee: treasuryFee.toFixed(6),
      affiliateFee: affiliateFee.toFixed(6)
    });

    // Get user's tier and referral volume
    const userPoints = userData.points || 0;
    const tier = calculateTier(userPoints);

    // Get referral volume for bonus cashback
    let referralVolume = 0;
    const referralsQuery = await db.collection('referrals')
      .where('referrerId', '==', userId)
      .get();
    
    for (const ref of referralsQuery.docs) {
      referralVolume += ref.data().swapValueUSD || 0;
    }

    // Calculate rewards
    const cashbackAmount = calculateCashbackAmount(swapValueUSD, tier, referralVolume);
    const points = calculatePoints(swapValueUSD);
    const totalPoints = userPoints + points;

    // Calculate cashback percentage for display
    const cashbackPercent = swapValueUSD > 0 
      ? (cashbackAmount / swapValueUSD) * 100 
      : 0;

    // Process referral reward if user was referred
    let referralReward = 0;
    const referrerId = userData.referredBy || null;
    
    if (referrerId) {
      // Find referrer by referral code
      const referralCodeDoc = await db.collection('referralCodes').doc(referrerId).get();
      if (referralCodeDoc.exists) {
        const referralCodeData = referralCodeDoc.data();
        const actualReferrerId = referralCodeData?.userId;
        
        if (actualReferrerId) {
          referralReward = await processReferralReward(
            actualReferrerId,
            treasuryFee
          );

          // Record referral transaction
          await db.collection('referrals').add({
            referrerId: actualReferrerId,
            refereeId: userId,
            refereeWallet: walletAddress,
            referralCode: referrerId,
            swapValueUSD,
            swapValueETH,
            platformFee,
            treasuryFee,
            referralReward,
            transactionHash,
            timestamp: new Date().toISOString(),
            status: 'active'
          });
        }
      }
    }

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

      // Store referral code
      await db.collection('referralCodes').doc(referralCode).set({
        userId,
        referralCode,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      });
    }

    // Update rewards
    const newTier = calculateTier(totalPoints);
    await rewardsRef.update({
      ethRewards: FieldValue.increment(cashbackAmount),
      volumeTraded: FieldValue.increment(swapValueUSD),
      transactions: FieldValue.increment(1),
      tier: newTier,
      lastUpdated: new Date().toISOString()
    });

    // Update points in users collection
    await db.collection('users').doc(userId).update({
      points: totalPoints,
      lastActivity: FieldValue.serverTimestamp()
    });

    // Record swap reward transaction (for duplicate prevention and tracking)
    await db.collection('swap_rewards').add({
      userId,
      walletAddress,
      transactionHash,
      swapValueUSD,
      swapValueETH,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      platformFee,
      protocolFee,
      treasuryFee,
      affiliateFee,
      cashbackAmount,
      points,
      referralReward,
      referrerId,
      tier,
      newTier,
      cashbackPercent,
      timestamp: FieldValue.serverTimestamp(),
      processedAt: new Date().toISOString()
    });

    // Record fee transaction for treasury tracking
    await db.collection('fee_transactions').add({
      walletAddress,
      userId,
      swapValueUSD,
      swapValueETH,
      platformFee,
      protocolFee,
      treasuryFee,
      affiliateFee,
      cashbackAmount,
      referralReward,
      referrerId,
      transactionHash,
      timestamp: FieldValue.serverTimestamp()
    });

    console.log(`✅ Rewards processed:`, {
      cashback: cashbackAmount.toFixed(6),
      points,
      referralReward,
      treasuryFee: treasuryFee.toFixed(6),
      affiliateFee: affiliateFee.toFixed(6),
      cashbackPercent: cashbackPercent.toFixed(2) + '%'
    });

    return {
      success: true,
      rewards: {
        cashbackAmount,
        points,
        referralReward,
        treasuryFee,
        affiliateFee,
        totalRewards: cashbackAmount,
        cashbackPercent
      }
    };

  } catch (error) {
    console.error('❌ Error processing swap rewards:', error);
    return {
      success: false,
      rewards: {
        cashbackAmount: 0,
        points: 0,
        referralReward: 0,
        treasuryFee: 0,
        affiliateFee: 0,
        totalRewards: 0,
        cashbackPercent: 0
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


