import { NextResponse } from 'next/server';
import { adminDb, auth } from '@/lib/firebase-admin';

// Get user rewards data
export async function GET(request: any) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token
    let userId: string;
    try {
      const decodedToken = await auth().verifyIdToken(token);
      userId = decodedToken.uid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user data from Firestore
    const db = adminDb();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userData = userDoc.data();
    
    // Get or create rewards document (for referral-specific data)
    const rewardsDoc = await db.collection('rewards').doc(userId).get();
    let rewardsData: any;
    
    if (rewardsDoc.exists) {
      rewardsData = rewardsDoc.data();
    } else {
      // Create new rewards document for user
      rewardsData = {
        ethRewards: 0,
        referralCode: generateReferralCode(),
        referrals: 0,
        referralRate: 30,
        volumeTraded: 0,
        transactions: 0,
        lastUpdated: new Date().toISOString()
      };
      
      // Save the new rewards document
      await db.collection('rewards').doc(userId).set(rewardsData);
    }

    // Use existing points from users collection
    const existingPoints = userData?.points || 0;
    const tier = calculateTier(existingPoints);

    // Get referral data
    const referralsSnapshot = await db.collection('referrals')
      .where('referrerId', '==', userId)
      .get();
    
    const referrals = referralsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get quest progress
    const quests = await getQuestProgress(rewardsData);

    // Ensure the referral code is stored in a separate collection for easy lookup
    if (rewardsData?.referralCode) {
      await db.collection('referralCodes').doc(rewardsData.referralCode).set({
        userId: userId,
        referralCode: rewardsData.referralCode,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      }, { merge: true });
    }

    const response = {
      ...rewardsData,
      points: existingPoints,
      earned: existingPoints,
      tier,
      referrals: referrals.length,
      quests,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update user rewards (called after successful swaps)
export async function POST(request: any) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token
    let userId: string;
    try {
      const decodedToken = await auth().verifyIdToken(token);
      userId = decodedToken.uid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { swapAmount, swapValue, tokenAddress, referralCode, action, newReferralCode } = body;



    // Handle swap rewards (existing logic)
    if (action !== 'editReferralCode' && (!swapAmount || !swapValue)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate platform fee (0.75%)
    // Note: 0.15% goes to 0x protocol, remaining 0.60% available for cashback/referrals
    const platformFee = swapValue * 0.0075;
    
    // Get user's current tier
    const db = adminDb();
    
    // Handle referral code editing
    if (action === 'editReferralCode') {
      if (!newReferralCode) {
        return NextResponse.json({ error: 'New referral code is required' }, { status: 400 });
      }

      // Validate new referral code format
      if (!/^[A-Z0-9]{4,12}$/.test(newReferralCode)) {
        return NextResponse.json({ 
          error: 'Referral code must be 4-12 characters, letters and numbers only' 
        }, { status: 400 });
      }

      // Check if user has already edited their referral code
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const userData = userDoc.data();
      if (userData?.referralCodeEdited) {
        return NextResponse.json({ 
          error: 'Referral code can only be edited once' 
        }, { status: 400 });
      }

      // Check if new referral code is already taken
      const existingCodeDoc = await db.collection('referralCodes').doc(newReferralCode).get();
      if (existingCodeDoc.exists) {
        return NextResponse.json({ 
          error: 'Referral code already taken' 
        }, { status: 400 });
      }

      // Get or create rewards document for referral code editing
      const rewardsRef = db.collection('rewards').doc(userId);
      const rewardsDoc = await rewardsRef.get();
      
      let currentRewards: any;
      if (rewardsDoc.exists) {
        currentRewards = rewardsDoc.data();
      } else {
        // Create new rewards document for user
        currentRewards = {
          ethRewards: 0,
          referralCode: generateReferralCode(),
          referrals: 0,
          referralRate: 30,
          volumeTraded: 0,
          transactions: 0,
          lastUpdated: new Date().toISOString()
        };
        
        // Save the new rewards document
        await rewardsRef.set(currentRewards);
      }

      // Update referral code
      const oldReferralCode = currentRewards?.referralCode;
      
      // Remove old referral code from referralCodes collection
      if (oldReferralCode) {
        await db.collection('referralCodes').doc(oldReferralCode).delete();
      }

      // Add new referral code to referralCodes collection
      await db.collection('referralCodes').doc(newReferralCode).set({
        userId: userId,
        referralCode: newReferralCode,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      });

      // Update rewards document
      await rewardsRef.update({
        referralCode: newReferralCode,
        lastUpdated: new Date().toISOString()
      });

      // Mark referral code as edited
      await db.collection('users').doc(userId).update({
        referralCodeEdited: true,
        referralCodeEditedAt: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: 'Referral code updated successfully',
        newReferralCode
      });
    }
    
    // Get or create rewards document
    const rewardsRef = db.collection('rewards').doc(userId);
    const rewardsDoc = await rewardsRef.get();
    
    let currentRewards: any;
    if (rewardsDoc.exists) {
      currentRewards = rewardsDoc.data();
    } else {
      // Create new rewards document for user
      currentRewards = {
        ethRewards: 0,
        referralCode: generateReferralCode(),
        referrals: 0,
        referralRate: 30,
        volumeTraded: 0,
        transactions: 0,
        lastUpdated: new Date().toISOString()
      };
      
      // Save the new rewards document
      await rewardsRef.set(currentRewards);
    }

    // Get existing points from users collection
    const userDoc = await db.collection('users').doc(userId).get();
    const existingPoints = userDoc.exists ? (userDoc.data()?.points || 0) : 0;

    // Calculate cashback based on tier
    const tier = calculateTier(existingPoints);
    const cashbackRate = getCashbackRate(tier);
    // Platform fee: 0.75%, 0x protocol fee: 0.15%, remaining: 0.60%
    const protocolFee = swapValue * 0.0015; // 0.15% for 0x protocol
    const remainingFee = platformFee - protocolFee; // Fee available for cashback
    const cashbackAmount = remainingFee * cashbackRate;

    // Calculate new points (integrate with existing point system)
    const newPoints = Math.floor(swapValue * 0.1); // 0.1 points per $1 traded
    const totalPoints = existingPoints + newPoints;

    // Update rewards
    const updatedRewards = {
      ...currentRewards,
      ethRewards: currentRewards.ethRewards + cashbackAmount,
      volumeTraded: currentRewards.volumeTraded + swapValue,
      transactions: currentRewards.transactions + 1,
      tier: calculateTier(totalPoints),
      lastUpdated: new Date().toISOString()
    };

    // Update points in users collection (your existing point system)
    await db.collection('users').doc(userId).update({
      points: totalPoints
    });

    // Save updated rewards
    await rewardsRef.set(updatedRewards);

    // Ensure the referral code is stored in a separate collection for easy lookup
    if (updatedRewards?.referralCode) {
      await db.collection('referralCodes').doc(updatedRewards.referralCode).set({
        userId: userId,
        referralCode: updatedRewards.referralCode,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      }, { merge: true });
    }

    // Handle referral if provided
    if (referralCode) {
      await processReferral(referralCode, userId, platformFee);
    }

    // Check if this is the user's first trade and they're eligible for referral bonus
    const userData = userDoc.data();
    if (userData?.referralBonusEligible && !userData?.referralBonusClaimed && currentRewards.transactions === 0) {
      // This is their first trade, give them the $10 referral bonus
      const referralBonus = 10; // $10 bonus
      
      // Update user's rewards with the bonus
      await rewardsRef.update({
        ethRewards: updatedRewards.ethRewards + referralBonus,
        lastUpdated: new Date().toISOString()
      });

      // Mark bonus as claimed
      await db.collection('users').doc(userId).update({
        referralBonusClaimed: true
      });

      // Update the referral record
      const referralSnapshot = await db.collection('referrals')
        .where('refereeId', '==', userId)
        .limit(1)
        .get();
      
      if (!referralSnapshot.empty) {
        const referralDoc = referralSnapshot.docs[0];
        await referralDoc.ref.update({
          bonusClaimed: true,
          bonusAmount: referralBonus,
          bonusClaimedAt: new Date().toISOString()
        });
      }

      console.log(`User ${userId} received $${referralBonus} referral bonus for first trade`);
    }

    // Save swap transaction for tracking
    await db.collection('swapTransactions').add({
      userId,
      swapAmount,
      swapValue,
      tokenAddress,
      platformFee,
      cashbackAmount,
      timestamp: new Date().toISOString(),
      referralCode: referralCode || null
    });

    // Distribute remaining fees
    await distributeFees(platformFee, cashbackAmount);

    return NextResponse.json({
      success: true,
      rewards: updatedRewards,
      cashbackEarned: cashbackAmount
    });
  } catch (error) {
    console.error('Error updating rewards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'CYPHERX';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function calculateTier(points: number): string {
  if (points >= 50000) return 'titan';
  if (points >= 20000) return 'mogul';
  if (points >= 8000) return 'alpha';
  if (points >= 2000) return 'degen';
  return 'normie';
}

function getCashbackRate(tier: string): number {
  // Platform fee: 0.75%, 0x protocol fee: 0.15%, remaining: 0.60%
  // Cashback is a percentage of the remaining fee (0.60%)
  const rates = {
    normie: 0.05,   // 5% of remaining fee
    degen: 0.10,    // 10% of remaining fee
    alpha: 0.15,    // 15% of remaining fee
    mogul: 0.20,    // 20% of remaining fee
    titan: 0.25     // 25% of remaining fee
  };
  return rates[tier as keyof typeof rates] || 0.05;
}

async function processReferral(referralCode: string, refereeId: string, platformFee: number) {
  try {
    const db = adminDb();
    // Find referrer by referral code
    const referrerSnapshot = await db.collection('rewards')
      .where('referralCode', '==', referralCode)
      .limit(1)
      .get();

    if (referrerSnapshot.empty) return;

    const referrerDoc = referrerSnapshot.docs[0];
    const referrerId = referrerDoc.id;
    const referrerData = referrerDoc.data();

    // Platform fee: 0.75%, 0x protocol fee: 0.15% (20% of platform fee), remaining: 0.60% (80% of platform fee)
    const protocolFee = platformFee * 0.2; // 0.15% / 0.75% = 20%
    const remainingFee = platformFee - protocolFee; // Fee available for referrals
    // Calculate referral reward (30% of remaining fee after 0x protocol fee)
    const referralReward = remainingFee * 0.3;

    // Update referrer's rewards
    await referrerDoc.ref.update({
      ethRewards: (referrerData.ethRewards || 0) + referralReward,
      lastUpdated: new Date().toISOString()
    });

    // Save referral record
    await db.collection('referrals').add({
      referrerId,
      refereeId,
      referralCode,
      platformFee,
      referralReward,
      timestamp: new Date().toISOString()
    });

    // Update referrer's referral count
    await referrerDoc.ref.update({
      referrals: (referrerData.referrals || 0) + 1
    });
  } catch (error) {
    console.error('Error processing referral:', error);
  }
}

async function distributeFees(platformFee: number, cashbackAmount: number) {
  try {
    const db = adminDb();
    // Calculate remaining fees
    const remainingFees = platformFee - cashbackAmount;
    
    // 0.02% for token buybacks (this would go to a buyback contract)
    const buybackAmount = platformFee * 0.0002;
    
    // Rest goes to treasury
    const treasuryAmount = remainingFees - buybackAmount;

    // Save fee distribution record
    await db.collection('feeDistributions').add({
      platformFee,
      cashbackAmount,
      buybackAmount,
      treasuryAmount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error distributing fees:', error);
  }
}

async function getQuestProgress(userData: any) {
  const quests = [
    {
      id: 1,
      title: "Refer 3 more people",
      points: 1500,
      progress: userData.referrals || 0,
      target: 3,
      icon: "FaUserFriends"
    },
    {
      id: 2,
      title: "Trade 5 more ETH in Volume",
      points: 1000,
      progress: Math.min((userData.volumeTraded || 0) / 5, 5),
      target: 5,
      icon: "FiTrendingUp"
    }
  ];

  return quests;
}
