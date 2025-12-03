import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const TIER_SYSTEM = {
  normie: { minPoints: 0, maxPoints: 1999, name: 'Normie', color: '#6B7280', description: 'Just getting started in crypto' },
  degen: { minPoints: 2000, maxPoints: 7999, name: 'Degen', color: '#EF4444', description: 'Degenerate trader, living on the edge' },
  alpha: { minPoints: 8000, maxPoints: 19999, name: 'Alpha', color: '#10B981', description: 'Got the alpha, making moves' },
  mogul: { minPoints: 20000, maxPoints: 49999, name: 'Mogul', color: '#F59E0B', description: 'Crypto mogul, building empire' },
  titan: { minPoints: 50000, maxPoints: Infinity, name: 'Titan', color: '#8B5CF6', description: 'Crypto titan, legendary status' },
};

interface TierRequest {
  walletAddress: string;
  userId: string;
  action: 'get_tier' | 'calculate_tier' | 'update_tier';
  points?: number;
}

export async function POST(request: Request) {
  try {
    const body: TierRequest = await request.json();
    const { walletAddress, userId, action, points } = body;

    if (!walletAddress || !userId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let db;
    try {
      db = adminDb();
    } catch (error) {
      console.error('Firebase Admin initialization failed:', error);
      return NextResponse.json({ 
        error: 'Database connection failed. Please check Firebase Admin configuration and IAM permissions.' 
      }, { status: 500 });
    }
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    switch (action) {
      case 'get_tier':
        const userQuery = db.collection('users').where('walletAddress', '==', walletAddress.toLowerCase());
        const userSnapshot = await userQuery.get();
        
        if (userSnapshot.empty) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userSnapshot.docs[0].data();
        const currentPoints = userData.points || 0;
        
        // Calculate current tier
        let currentTier = 'normie';
        for (const [tier, data] of Object.entries(TIER_SYSTEM)) {
          if (currentPoints >= data.minPoints && currentPoints <= data.maxPoints) {
            currentTier = tier;
            break;
          }
        }

        // Calculate next tier
        const nextTier = Object.entries(TIER_SYSTEM).find(([, data]) => data.minPoints > currentPoints);
        const nextTierData = nextTier ? TIER_SYSTEM[nextTier[0] as keyof typeof TIER_SYSTEM] : null;

        return NextResponse.json({
          success: true,
          currentTier,
          currentTierData: TIER_SYSTEM[currentTier as keyof typeof TIER_SYSTEM],
          currentPoints,
          nextTier: nextTier ? nextTier[0] : null,
          nextTierData,
          pointsToNextTier: nextTierData ? nextTierData.minPoints - currentPoints : 0,
        });

      case 'calculate_tier':
        if (points === undefined) {
          return NextResponse.json({ error: 'Points required for tier calculation' }, { status: 400 });
        }

        let calculatedTier = 'normie';
        for (const [tier, data] of Object.entries(TIER_SYSTEM)) {
          if (points >= data.minPoints && points <= data.maxPoints) {
            calculatedTier = tier;
            break;
          }
        }

        return NextResponse.json({
          success: true,
          tier: calculatedTier,
          tierData: TIER_SYSTEM[calculatedTier as keyof typeof TIER_SYSTEM],
          points,
        });

      case 'update_tier':
        const userQuery2 = db.collection('users').where('walletAddress', '==', walletAddress.toLowerCase());
        const userSnapshot2 = await userQuery2.get();
        
        if (userSnapshot2.empty) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData2 = userSnapshot2.docs[0].data();
        const userPoints = userData2.points || 0;
        
        // Calculate new tier
        let newTier = 'normie';
        for (const [tier, data] of Object.entries(TIER_SYSTEM)) {
          if (userPoints >= data.minPoints && userPoints <= data.maxPoints) {
            newTier = tier;
            break;
          }
        }

        // Update user tier
        await db.collection('users').doc(userSnapshot2.docs[0].id).update({
          tier: newTier,
          lastTierUpdate: FieldValue.serverTimestamp(),
        });

        // Record tier update activity
        await db.collection('user_activities').add({
          userId,
          walletAddress,
          action: 'tier_update',
          points: 0,
          metadata: {
            oldTier: userData2.tier || 'normie',
            newTier,
            points: userPoints,
          },
          createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({
          success: true,
          newTier,
          tierData: TIER_SYSTEM[newTier as keyof typeof TIER_SYSTEM],
          points: userPoints,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error processing tier request:', error);
    return NextResponse.json({ error: 'Failed to process tier request' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    let db;
    try {
      db = adminDb();
    } catch (error) {
      console.error('Database connection failed:', error);
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress.toLowerCase());
    const userSnapshot = await userQuery.get();
    
    if (userSnapshot.empty) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userSnapshot.docs[0].data();
    const points = userData.points || 0;
    
    // Calculate current tier
    let currentTier = 'normie';
    for (const [tier, data] of Object.entries(TIER_SYSTEM)) {
      if (points >= data.minPoints && points <= data.maxPoints) {
        currentTier = tier;
        break;
      }
    }

    // Calculate next tier
    const nextTier = Object.entries(TIER_SYSTEM).find(([, data]) => data.minPoints > points);
    const nextTierData = nextTier ? TIER_SYSTEM[nextTier[0] as keyof typeof TIER_SYSTEM] : null;

    return NextResponse.json({
      success: true,
      currentTier,
      currentTierData: TIER_SYSTEM[currentTier as keyof typeof TIER_SYSTEM],
      points,
      nextTier: nextTier ? nextTier[0] : null,
      nextTierData,
      pointsToNextTier: nextTierData ? nextTierData.minPoints - points : 0,
      tierSystem: TIER_SYSTEM,
    });

  } catch (error) {
    console.error('Error fetching tier data:', error);
    return NextResponse.json({ error: 'Failed to fetch tier data' }, { status: 500 });
  }
} 