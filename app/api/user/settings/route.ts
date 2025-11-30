import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Save user settings and quick buy configurations
 * Supports saving settings, quick buy amounts, slippage preferences, etc.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, settings, quickBuyConfig } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const userDocRef = db.collection('users').doc(userId);
    
    // Prepare update data
    const updateData: any = {
      updatedAt: Timestamp.now(),
    };

    // Add settings if provided
    if (settings) {
      if (settings.displayName !== undefined) updateData.displayName = settings.displayName;
      if (settings.bio !== undefined) updateData.bio = settings.bio;
      if (settings.theme !== undefined) updateData.theme = settings.theme;
      if (settings.notifications !== undefined) updateData.notifications = settings.notifications;
      if (settings.privacy !== undefined) updateData.privacy = settings.privacy;
      if (settings.security !== undefined) updateData.security = settings.security;
    }

    // Add quick buy configuration if provided
    if (quickBuyConfig) {
      updateData.quickBuyConfig = {
        amounts: quickBuyConfig.amounts || [0.01, 0.025, 0.05, 0.1],
        defaultSlippage: quickBuyConfig.defaultSlippage || 1,
        autoApprove: quickBuyConfig.autoApprove || false,
        preferredDex: quickBuyConfig.preferredDex || null,
        updatedAt: Timestamp.now(),
      };
    }

    // Update or create user document
    await userDocRef.set(updateData, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
    });

  } catch (error) {
    console.error('Error saving user settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save settings',
      },
      { status: 500 }
    );
  }
}

/**
 * Get user settings and quick buy configurations
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({
        success: true,
        settings: null,
        quickBuyConfig: null,
      });
    }

    const userData = userDoc.data();

    return NextResponse.json({
      success: true,
      settings: {
        displayName: userData?.displayName || '',
        bio: userData?.bio || '',
        theme: userData?.theme || 'dark',
        notifications: userData?.notifications || {
          email: true,
          push: true,
          trading: true,
          news: false,
        },
        privacy: userData?.privacy || {
          showProfile: true,
          showTrades: true,
          showBalance: false,
        },
        security: userData?.security || {
          twoFactorEnabled: false,
          sessionTimeout: 30,
        },
      },
      quickBuyConfig: userData?.quickBuyConfig || {
        amounts: [0.01, 0.025, 0.05, 0.1],
        defaultSlippage: 1,
        autoApprove: false,
        preferredDex: null,
      },
    });

  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch settings',
      },
      { status: 500 }
    );
  }
}



