import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface EarnPointsRequest {
  userId: string;
  walletAddress: string;
  action: string;
  metadata?: any;
}

// Point earning rules - all actions contribute to daily cumulative limit
const POINT_RULES = {
  // Content Engagement
  read_article: { points: 1 },
  like_article: { points: 2 },
  comment_article: { points: 5 },
  share_article: { points: 3 },
  bookmark_article: { points: 1 },
  
  // Content Creation Rewards
  article_10_likes: { points: 10 },
  article_50_views: { points: 15 },
  article_featured: { points: 50 },
  comment_5_likes: { points: 5 },
  comment_pinned: { points: 20 },
  
  // Community Engagement
  daily_login: { points: 5 },
  complete_profile: { points: 25 },
  refer_user: { points: 50 },
  weekly_streak: { points: 100 },
  monthly_streak: { points: 500 },
  
  // Alpha & Insights
  submit_alpha: { points: 10 },
  alpha_verified: { points: 25 },
  alpha_10_upvotes: { points: 15 },
  report_scam: { points: 5 },
  market_analysis: { points: 20 },
  
  // Trading & Analysis
  connect_wallet: { points: 25 },
  first_trade: { points: 50 },
  complete_tutorial: { points: 30 },
  token_review: { points: 15 },
  create_watchlist: { points: 10 },
  
  // Events
  event_proposal_approved: { points: 50 },
  
  // Author rewards for engagement
  receive_comment: { points: 3 },
  receive_like: { points: 1 },
  receive_share: { points: 2 },
  receive_bookmark: { points: 1 }
};

// Daily cumulative points limit
const DAILY_POINTS_LIMIT = 1000;

// Import the utility function
import { getLimitMessage, getSuccessMessage } from '@/app/utils/pointNotifications';

export async function POST(request: Request) {
  try {
    const { userId, walletAddress, action, metadata }: EarnPointsRequest = await request.json();

    if (!userId || !walletAddress || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if action is valid
    if (!POINT_RULES[action as keyof typeof POINT_RULES]) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const rule = POINT_RULES[action as keyof typeof POINT_RULES];
    const today = new Date().toISOString().split('T')[0];

    // Check daily limit
    const db = adminDb();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const dailyActions = userData?.dailyActions || {};
    const todayActions = dailyActions[today] || {};
    
    // Calculate total points earned today
    let totalPointsToday = 0;
    Object.keys(todayActions).forEach(actionKey => {
      const actionData = todayActions[actionKey];
      if (typeof actionData === 'number') {
        // If it's just a count, calculate points
        const actionRule = POINT_RULES[actionKey as keyof typeof POINT_RULES];
        if (actionRule) {
          totalPointsToday += actionData * actionRule.points;
        }
      } else if (actionData && typeof actionData === 'object' && 'points' in actionData) {
        // If it's an object with points, add directly
        totalPointsToday += (actionData as any).points;
      }
    });

    // Check if adding these points would exceed daily limit
    const wouldExceedLimit = totalPointsToday + rule.points > DAILY_POINTS_LIMIT;
    
    // If limit would be exceeded, still allow the action but don't give points
    if (wouldExceedLimit) {
      return NextResponse.json({
        success: true,
        pointsEarned: 0,
        limitReached: true,
        message: getLimitMessage(),
        dailyLimit: DAILY_POINTS_LIMIT,
        currentCount: totalPointsToday
      });
    }

    // Update user points and daily actions
    const batch = db.batch();
    
    // Get current action count for today
    const actionCount = todayActions[action] || 0;
    
    // Update points
    batch.update(userRef, {
      points: FieldValue.increment(rule.points),
      totalEarned: FieldValue.increment(rule.points),
      lastUpdated: new Date(),
      [`dailyActions.${today}.${action}`]: actionCount + 1
    });

    // Create transaction record
    const transactionRef = db.collection('pointTransactions').doc();
    batch.set(transactionRef, {
      userId,
      walletAddress,
      action,
      points: rule.points,
      description: `Earned ${rule.points} points for ${action}`,
      timestamp: new Date(),
      metadata: metadata || {}
    });

    // Also record in user_activities for Points History modal
    const activityRef = db.collection('user_activities').doc();
    batch.set(activityRef, {
      userId,
      walletAddress,
      action,
      points: rule.points,
      articleSlug: metadata?.articleSlug,
      commentId: metadata?.commentId,
      metadata: metadata || {},
      createdAt: FieldValue.serverTimestamp()
    });

    await batch.commit();

    // Get updated user data
    const updatedUserDoc = await userRef.get();
    const updatedUserData = updatedUserDoc.data();

    return NextResponse.json({
      success: true,
      pointsEarned: rule.points,
      newBalance: updatedUserData?.points || 0,
      limitReached: false,
      message: getSuccessMessage(action, rule.points),
      dailyLimit: DAILY_POINTS_LIMIT,
      currentCount: totalPointsToday + rule.points
    });

  } catch (error) {
    console.error('Error earning points:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
