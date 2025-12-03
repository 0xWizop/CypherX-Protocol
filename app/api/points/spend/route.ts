import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface SpendPointsRequest {
  userId: string;
  walletAddress: string;
  action: string;
  metadata?: any;
}

// Point spending rules
const SPEND_RULES = {
  // Content Creation
  post_article: { points: 50, description: 'Post Article' },
  post_comment: { points: 5, description: 'Post Comment' },
  submit_token: { points: 25, description: 'Submit Token' },
  create_index: { points: 100, description: 'Create Index' },
  submit_news: { points: 15, description: 'Submit News' },
  
  // Premium Features
  alpha_boost: { points: 25, description: 'Alpha Boost' },
  featured_article: { points: 75, description: 'Featured Article' },
  priority_listing: { points: 30, description: 'Priority Listing' },
  custom_badge: { points: 100, description: 'Custom Badge' },
  profile_customization: { points: 50, description: 'Profile Customization' },
  
  // Trading Features
  advanced_charts: { points: 10, description: 'Advanced Charts (Daily)' },
  realtime_alerts: { points: 20, description: 'Real-time Alerts (Daily)' },
  portfolio_analytics: { points: 15, description: 'Portfolio Analytics (Daily)' },
};

export async function POST(request: Request) {
  try {
    const { userId, walletAddress, action, metadata }: SpendPointsRequest = await request.json();

    if (!userId || !walletAddress || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if action is valid
    if (!SPEND_RULES[action as keyof typeof SPEND_RULES]) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const rule = SPEND_RULES[action as keyof typeof SPEND_RULES];

    // Get user data
    const db = adminDb();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const currentPoints = userData?.points || 0;

    // Check if user has enough points
    if (currentPoints < rule.points) {
      return NextResponse.json({ 
        error: 'Insufficient points',
        required: rule.points,
        current: currentPoints,
        shortfall: rule.points - currentPoints
      }, { status: 400 });
    }

    // Check for daily limits on certain actions
    const today = new Date().toISOString().split('T')[0];
    const dailyActions = userData?.dailyActions || {};
    const todayActions = dailyActions[today] || {};
    const actionCount = todayActions[action] || 0;

    // Daily limits for certain actions
    const dailyLimits: { [key: string]: number } = {
      alpha_boost: 5, // Max 5 alpha boosts per day
      advanced_charts: 1, // Once per day
      realtime_alerts: 1, // Once per day
      portfolio_analytics: 1, // Once per day
    };

    if (dailyLimits[action] && actionCount >= dailyLimits[action]) {
      return NextResponse.json({ 
        error: 'Daily limit reached for this action',
        dailyLimit: dailyLimits[action],
        currentCount: actionCount
      }, { status: 429 });
    }

    // Update user points and daily actions
    const batch = db.batch();
    
    // Deduct points
    batch.update(userRef, {
      points: FieldValue.increment(-rule.points),
      totalSpent: FieldValue.increment(rule.points),
      lastUpdated: new Date(),
      [`dailyActions.${today}.${action}`]: actionCount + 1
    });

    // Create transaction record
    const transactionRef = db.collection('pointTransactions').doc();
    batch.set(transactionRef, {
      userId,
      walletAddress,
      action,
      points: -rule.points, // Negative for spending
      description: `Spent ${rule.points} points for ${rule.description}`,
      timestamp: new Date(),
      metadata: metadata || {}
    });

    // Also record in user_activities for Points History modal
    const activityRef = db.collection('user_activities').doc();
    batch.set(activityRef, {
      userId,
      walletAddress,
      action,
      points: -rule.points, // Negative for spending
      articleSlug: metadata?.articleSlug,
      commentId: metadata?.commentId,
      metadata: metadata || {},
      createdAt: FieldValue.serverTimestamp()
    });

    // Handle special actions
    if (action === 'alpha_boost' && metadata?.articleId) {
      // Create alpha boost record
      const alphaBoostRef = db.collection('alphaBoosts').doc();
      batch.set(alphaBoostRef, {
        userId,
        articleId: metadata.articleId,
        cost: rule.points,
        multiplier: getAlphaBoostMultiplier(userData?.tier || 'normie'),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        createdAt: new Date()
      });
    }

    await batch.commit();

    // Get updated user data
    const updatedUserDoc = await userRef.get();
    const updatedUserData = updatedUserDoc.data();

    return NextResponse.json({
      success: true,
      pointsSpent: rule.points,
      newBalance: updatedUserData?.points || 0,
      description: rule.description,
      dailyLimit: dailyLimits[action] || null,
      currentCount: actionCount + 1
    });

  } catch (error) {
    console.error('Error spending points:', error);
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
