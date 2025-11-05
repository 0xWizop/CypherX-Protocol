import { NextResponse } from 'next/server';
import { adminDb, auth } from '@/lib/firebase-admin';

// Validate referral code
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
    const { referralCode } = body;

    if (!referralCode) {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
    }

    const db = adminDb();

    // Check if user is trying to refer themselves
    const userRewardsDoc = await db.collection('rewards').doc(userId).get();
    if (userRewardsDoc.exists) {
      const userRewards = userRewardsDoc.data();
      if (userRewards?.referralCode === referralCode) {
        return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 });
      }
    }

    // Find referrer by referral code - first try the referralCodes collection
    let referrerId: string;
    let referrerData: any;
    let referrerDocRef: any;

    // For development/testing, allow some test referral codes
    const testReferralCodes = ['TESTING', 'CYPHERX123', 'ADMIN123'];
    if (testReferralCodes.includes(referralCode)) {
      // Create a test referrer ID
      referrerId = `test-${referralCode.toLowerCase()}`;
      referrerData = { referrals: 0, ethRewards: 0 };
      referrerDocRef = db.collection('rewards').doc(referrerId);
      
      // Ensure the test referrer exists
      await referrerDocRef.set({
        referrals: 0,
        ethRewards: 0,
        referralCode: referralCode,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } else {
      const referralCodeDoc = await db.collection('referralCodes').doc(referralCode).get();

      if (referralCodeDoc.exists) {
        // Found in referralCodes collection
        const referralCodeData = referralCodeDoc.data();
        referrerId = referralCodeData!.userId;
        
        // Get the actual rewards data
        const referrerRewardsDoc = await db.collection('rewards').doc(referrerId).get();
        if (!referrerRewardsDoc.exists) {
          return NextResponse.json({ error: 'Referrer not found' }, { status: 404 });
        }
        referrerData = referrerRewardsDoc.data();
        referrerDocRef = referrerRewardsDoc.ref;
      } else {
        // Fallback: search in rewards collection (for backward compatibility)
        const fallbackSnapshot = await db.collection('rewards')
          .where('referralCode', '==', referralCode)
          .limit(1)
          .get();

        if (fallbackSnapshot.empty) {
          return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
        }

        const fallbackDoc = fallbackSnapshot.docs[0];
        referrerId = fallbackDoc.id;
        referrerData = fallbackDoc.data();
        referrerDocRef = fallbackDoc.ref;
      }
    }

    // Check if user has already been referred
    const existingReferral = await db.collection('referrals')
      .where('refereeId', '==', userId)
      .limit(1)
      .get();

    if (!existingReferral.empty) {
      return NextResponse.json({ error: 'User has already been referred' }, { status: 400 });
    }

    // Create referral relationship
    await db.collection('referrals').add({
      referrerId,
      refereeId: userId,
      referralCode,
      timestamp: new Date().toISOString(),
      status: 'active',
      bonusEligible: true, // Mark as eligible for $10 bonus after first trade
      bonusClaimed: false
    });

    // Update referrer's referral count
    await referrerDocRef.update({
      referrals: (referrerData.referrals || 0) + 1,
      lastUpdated: new Date().toISOString()
    });

    // Update user's referral info
    await db.collection('users').doc(userId).update({
      referredBy: referralCode,
      referralTimestamp: new Date().toISOString(),
      referralBonusEligible: true, // Mark as eligible for $10 bonus
      referralBonusClaimed: false
    });

    return NextResponse.json({
      success: true,
      referrerId,
      referralCode
    });
  } catch (error) {
    console.error('Error processing referral:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get referral statistics
export async function GET(request: any) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let userId: string;
    try {
      const decodedToken = await auth().verifyIdToken(token);
      userId = decodedToken.uid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = adminDb();

    // Get user's referral data
    const referralsSnapshot = await db.collection('referrals')
      .where('referrerId', '==', userId)
      .orderBy('timestamp', 'desc')
      .get();

    const referrals: any[] = referralsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get referral earnings
    const referralEarnings = referrals.reduce((total, referral) => {
      return total + (referral.referralReward || 0);
    }, 0);

    // Get recent referrals (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentReferrals = referrals.filter(referral => 
      new Date(referral.timestamp) > thirtyDaysAgo
    );

    return NextResponse.json({
      totalReferrals: referrals.length,
      referralEarnings,
      recentReferrals: recentReferrals.length,
      referrals: referrals.slice(0, 10) // Return last 10 referrals
    });
  } catch (error) {
    console.error('Error fetching referral data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
