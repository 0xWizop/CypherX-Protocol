import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Cache for token count (5 minute TTL)
let cachedTokenCount: { count: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Return cached value if still valid
    if (cachedTokenCount && Date.now() - cachedTokenCount.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        totalTokens: cachedTokenCount.count,
        timestamp: new Date().toISOString(),
        cached: true
      });
    }

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

    // Fetch count - using size property which is efficient
    // The cache will make subsequent requests instant
    const tokensSnapshot = await db.collection('tokens').get();
    const totalTokens = tokensSnapshot.size;

    // Update cache
    cachedTokenCount = {
      count: totalTokens,
      timestamp: Date.now()
    };

    return NextResponse.json({
      success: true,
      totalTokens,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching token count:', error);
    // Return cached value if available, even if expired
    if (cachedTokenCount) {
      return NextResponse.json({
        success: true,
        totalTokens: cachedTokenCount.count,
        timestamp: new Date().toISOString(),
        cached: true,
        error: 'Using cached value due to error'
      });
    }
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

