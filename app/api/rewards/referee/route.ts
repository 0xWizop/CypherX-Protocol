import { NextResponse } from 'next/server';
import { adminDb, auth } from '@/lib/firebase-admin';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const refereeId = searchParams.get('refereeId');

    if (!refereeId) {
      return NextResponse.json({ error: 'Referee ID is required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Verify this user is the referrer
    const referralCheck = await db.collection('referrals')
      .where('referrerId', '==', userId)
      .where('refereeId', '==', refereeId)
      .limit(1)
      .get();

    if (referralCheck.empty) {
      return NextResponse.json({ error: 'Unauthorized: Not your referral' }, { status: 403 });
    }

    // Get referee's user data
    const userDoc = await db.collection('users').doc(refereeId).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    // Get referee's rewards data
    const rewardsDoc = await db.collection('rewards').doc(refereeId).get();
    const rewardsData = rewardsDoc.exists ? rewardsDoc.data() : null;

    // Get all referrals for this referee (to calculate total volume and fees)
    const referralsSnapshot = await db.collection('referrals')
      .where('refereeId', '==', refereeId)
      .get();

    const totalVolume = referralsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.swapValueUSD || 0);
    }, 0);

    const totalPlatformFees = referralsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.platformFee || 0);
    }, 0);

    const totalReferralRewards = referralsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.referralReward || 0);
    }, 0);

    const totalTransactions = referralsSnapshot.docs.length;

    // Get wallet address if linked
    let walletAddress: string | null = null;
    try {
      const walletLinkSnapshot = await db.collection('user_wallet_data')
        .where('userId', '==', refereeId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      walletAddress = walletLinkSnapshot.empty 
        ? (userData?.walletAddress || null)
        : (walletLinkSnapshot.docs[0]?.data()?.walletAddress || null);
    } catch (walletError) {
      console.error('Error fetching wallet address:', walletError);
      walletAddress = userData?.walletAddress || null;
    }

    // Get recent trades (from wallet_orders if available)
    let recentTrades: any[] = [];
    if (walletAddress) {
      try {
        // Try with orderBy first (requires index)
        const recentOrdersSnapshot = await db.collection('wallet_orders')
          .where('walletAddress', '==', walletAddress.toLowerCase())
          .orderBy('timestamp', 'desc')
          .limit(10)
          .get();
        
        recentTrades = recentOrdersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            timestamp: data.timestamp,
            inputValue: data.inputValue || 0,
            outputValue: data.outputValue || 0,
            type: data.type || 'unknown'
          };
        });
      } catch (orderByError: any) {
        // If orderBy fails (missing index), try without it and sort in memory
        if (orderByError.code === 'failed-precondition' || orderByError.message?.includes('index')) {
          try {
            const recentOrdersSnapshot = await db.collection('wallet_orders')
              .where('walletAddress', '==', walletAddress.toLowerCase())
              .limit(50) // Get more to sort in memory
              .get();
            
            recentTrades = recentOrdersSnapshot.docs
              .map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  timestamp: data.timestamp,
                  inputValue: data.inputValue || 0,
                  outputValue: data.outputValue || 0,
                  type: data.type || 'unknown'
                };
              })
              .sort((a, b) => {
                const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
                const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
                return bTime - aTime;
              })
              .slice(0, 10);
          } catch (fallbackError) {
            console.error('Error fetching recent trades (fallback):', fallbackError);
            recentTrades = [];
          }
        } else {
          console.error('Error fetching recent trades:', orderByError);
          recentTrades = [];
        }
      }
    }

    return NextResponse.json({
      refereeId,
      walletAddress,
      userData: {
        points: userData?.points || 0,
        tier: userData?.tier || 'normie',
        email: userData?.email || null,
      },
      stats: {
        totalVolume,
        totalPlatformFees,
        totalReferralRewards,
        totalTransactions,
        volumeTraded: rewardsData?.volumeTraded || 0,
        transactions: rewardsData?.transactions || 0,
      },
      recentTrades,
      joinedAt: userData?.createdAt || userData?.createdAt || null,
    });

  } catch (error: any) {
    console.error('Error fetching referee stats:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 });
  }
}

