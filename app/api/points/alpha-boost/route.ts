import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface AlphaBoostRequest {
  userId: string;
  walletAddress: string;
  articleId: string;
  articleSlug: string;
}

export async function POST(request: Request) {
  try {
    const { userId, walletAddress, articleId, articleSlug }: AlphaBoostRequest = await request.json();

    if (!userId || !walletAddress || !articleId || !articleSlug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get user data
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const currentPoints = userData?.points || 0;
    const userTier = userData?.tier || 'normie';
    const alphaBoostCost = 25;

    // Check if user has enough points
    if (currentPoints < alphaBoostCost) {
      return NextResponse.json({ 
        error: 'Insufficient points for alpha boost',
        required: alphaBoostCost,
        current: currentPoints,
        shortfall: alphaBoostCost - currentPoints
      }, { status: 400 });
    }

    // Check if article exists
    const articleRef = db.collection('articles').doc(articleId);
    const articleDoc = await articleRef.get();

    if (!articleDoc.exists) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Check if user already boosted this article today
    const today = new Date().toISOString().split('T')[0];
    const dailyActions = userData?.dailyActions || {};
    const todayActions = dailyActions[today] || {};
    const alphaBoostCount = todayActions[`alpha_boost_${articleId}`] || 0;

    if (alphaBoostCount >= 1) {
      return NextResponse.json({ 
        error: 'You can only alpha boost an article once per day',
        articleId,
        nextBoostAvailable: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, { status: 429 });
    }

    // Check total daily alpha boost limit
    const totalAlphaBoosts = todayActions['alpha_boost'] || 0;
    const maxDailyAlphaBoosts = 5;

    if (totalAlphaBoosts >= maxDailyAlphaBoosts) {
      return NextResponse.json({ 
        error: 'Daily alpha boost limit reached',
        dailyLimit: maxDailyAlphaBoosts,
        currentCount: totalAlphaBoosts
      }, { status: 429 });
    }

    // Get alpha boost multiplier based on user tier
    const multiplier = getAlphaBoostMultiplier(userTier);

    // Update user points and daily actions
    const batch = db.batch();
    
    // Deduct points
    batch.update(userRef, {
      points: FieldValue.increment(-alphaBoostCost),
      totalSpent: FieldValue.increment(alphaBoostCost),
      lastUpdated: new Date(),
      [`dailyActions.${today}.alpha_boost`]: totalAlphaBoosts + 1,
      [`dailyActions.${today}.alpha_boost_${articleId}`]: 1
    });

    // Create alpha boost record
    const alphaBoostRef = db.collection('alphaBoosts').doc();
    batch.set(alphaBoostRef, {
      userId,
      walletAddress,
      articleId,
      articleSlug,
      cost: alphaBoostCost,
      multiplier,
      tier: userTier,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
      isActive: true
    });

    // Update article with alpha boost
    batch.update(articleRef, {
      alphaBoost: {
        isActive: true,
        multiplier,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        boostedBy: userId,
        boostedAt: new Date()
      },
      trendingScore: FieldValue.increment(calculateTrendingBoost(multiplier))
    });

    // Create transaction record
    const transactionRef = db.collection('pointTransactions').doc();
    batch.set(transactionRef, {
      userId,
      walletAddress,
      action: 'alpha_boost',
      points: -alphaBoostCost,
      description: `Alpha boost applied to article (${multiplier}x multiplier)`,
      timestamp: new Date(),
      metadata: {
        articleId,
        articleSlug,
        multiplier,
        tier: userTier
      }
    });

    await batch.commit();

    // Get updated user data
    const updatedUserDoc = await userRef.get();
    const updatedUserData = updatedUserDoc.data();

    return NextResponse.json({
      success: true,
      pointsSpent: alphaBoostCost,
      newBalance: updatedUserData?.points || 0,
      multiplier,
      tier: userTier,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      dailyAlphaBoostsUsed: totalAlphaBoosts + 1,
      maxDailyAlphaBoosts
    });

  } catch (error) {
    console.error('Error applying alpha boost:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');
    const userId = searchParams.get('userId');

    if (!articleId) {
      return NextResponse.json({ error: 'Article ID required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get active alpha boost for this article
    const alphaBoostsRef = db.collection('alphaBoosts');
    const query = alphaBoostsRef
      .where('articleId', '==', articleId)
      .where('isActive', '==', true)
      .where('expiresAt', '>', new Date());

    const snapshot = await query.get();
    const alphaBoosts = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // If userId provided, check if user can boost this article
    let canBoost = false;
    let userBoostInfo = null;

    if (userId) {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const today = new Date().toISOString().split('T')[0];
        const dailyActions = userData?.dailyActions || {};
        const todayActions = dailyActions[today] || {};
        
        const hasBoostedToday = todayActions[`alpha_boost_${articleId}`] || 0;
        const totalAlphaBoosts = todayActions['alpha_boost'] || 0;
        const hasEnoughPoints = (userData?.points || 0) >= 25;

        canBoost = !hasBoostedToday && totalAlphaBoosts < 5 && hasEnoughPoints;
        
        userBoostInfo = {
          hasBoostedToday: hasBoostedToday > 0,
          totalAlphaBoosts,
          maxDailyAlphaBoosts: 5,
          hasEnoughPoints,
          currentPoints: userData?.points || 0,
          tier: userData?.tier || 'normie',
          multiplier: getAlphaBoostMultiplier(userData?.tier || 'normie')
        };
      }
    }

    return NextResponse.json({
      activeAlphaBoosts: alphaBoosts,
      canBoost,
      userBoostInfo
    });

  } catch (error) {
    console.error('Error getting alpha boost info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getAlphaBoostMultiplier(tier: string): number {
  switch (tier) {
    case 'normie': return 1.5;
    case 'degen': return 2.0;
    case 'alpha': return 2.5;
    case 'mogul': return 3.0;
    case 'titan': return 3.5;
    default: return 1.5;
  }
}

function calculateTrendingBoost(multiplier: number): number {
  // Base trending boost calculation
  return Math.floor(100 * (multiplier - 1));
}
