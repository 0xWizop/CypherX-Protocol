import { NextResponse } from 'next/server';
import { adminDb, auth } from '@/lib/firebase-admin';

/**
 * Link wallet address to user account
 * POST /api/wallet/link
 * Body: { walletAddress: string, userId?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, userId } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const normalizedWallet = walletAddress.toLowerCase();

    // If userId is provided (from authenticated user), link to that user
    if (userId) {
      // Verify user exists
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Check if wallet is already linked to another user
      const existingLink = await db.collection('user_wallet_data')
        .where('walletAddress', '==', normalizedWallet)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!existingLink.empty) {
        const existing = existingLink.docs[0].data();
        if (existing.userId !== userId) {
          return NextResponse.json(
            { error: 'Wallet is already linked to another user' },
            { status: 400 }
          );
        }
        // Already linked to this user, return success
        return NextResponse.json({
          success: true,
          walletAddress: normalizedWallet,
          userId,
          message: 'Wallet already linked'
        });
      }

      // Create or update wallet link
      const walletDataRef = db.collection('user_wallet_data')
        .where('walletAddress', '==', normalizedWallet)
        .where('userId', '==', userId)
        .limit(1);

      const walletDataSnapshot = await walletDataRef.get();

      if (walletDataSnapshot.empty) {
        // Create new link
        await db.collection('user_wallet_data').add({
          userId,
          walletAddress: normalizedWallet,
          isPrimary: true,
          isVerified: false,
          isActive: true,
          linkedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        // Update existing link
        await walletDataSnapshot.docs[0].ref.update({
          isActive: true,
          updatedAt: new Date(),
        });
      }

      // Update user document with wallet address
      await db.collection('users').doc(userId).update({
        walletAddress: normalizedWallet,
        lastUpdated: new Date(),
      });

      return NextResponse.json({
        success: true,
        walletAddress: normalizedWallet,
        userId,
        message: 'Wallet linked successfully'
      });
    }

    // If no userId, check if wallet is already linked
    const existingLink = await db.collection('user_wallet_data')
      .where('walletAddress', '==', normalizedWallet)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!existingLink.empty) {
      const linkData = existingLink.docs[0].data();
      return NextResponse.json({
        success: true,
        walletAddress: normalizedWallet,
        userId: linkData.userId,
        message: 'Wallet already linked',
        isLinked: true
      });
    }

    // Wallet not linked to any user
    return NextResponse.json({
      success: true,
      walletAddress: normalizedWallet,
      userId: null,
      message: 'Wallet not linked to any user account',
      isLinked: false
    });

  } catch (error: any) {
    console.error('Error linking wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to link wallet' },
      { status: 500 }
    );
  }
}

/**
 * Get user ID for wallet address
 * GET /api/wallet/link?walletAddress=0x...
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const normalizedWallet = walletAddress.toLowerCase();

    // Find active wallet link
    const walletLinkSnapshot = await db.collection('user_wallet_data')
      .where('walletAddress', '==', normalizedWallet)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (walletLinkSnapshot.empty) {
      return NextResponse.json({
        success: true,
        walletAddress: normalizedWallet,
        userId: null,
        isLinked: false
      });
    }

    const linkData = walletLinkSnapshot.docs[0].data();

    return NextResponse.json({
      success: true,
      walletAddress: normalizedWallet,
      userId: linkData.userId,
      isLinked: true,
      isPrimary: linkData.isPrimary || false,
      isVerified: linkData.isVerified || false
    });

  } catch (error: any) {
    console.error('Error fetching wallet link:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch wallet link' },
      { status: 500 }
    );
  }
}










