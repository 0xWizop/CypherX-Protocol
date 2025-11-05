import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = adminDb();
    if (!db) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection failed',
          totalTokens: 0
        },
        { status: 500 }
      );
    }

    const tokensSnapshot = await db.collection('tokens').get();
    const totalTokens = tokensSnapshot.size;

    return NextResponse.json({
      success: true,
      totalTokens,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching token count:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch token count',
        totalTokens: 0
      },
      { status: 500 }
    );
  }
}

