import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Cache for user count (5 minute TTL)
let cachedUserCount: { count: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Return cached value if still valid
    if (cachedUserCount && Date.now() - cachedUserCount.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        activeUsers: cachedUserCount.count,
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
          activeUsers: 0
        },
        { status: 500 }
      );
    }

    // Fetch count - using size property which is efficient
    // The cache will make subsequent requests instant
    const usersSnapshot = await db.collection('users').get();
    const activeUsers = usersSnapshot.size;

    // Update cache
    cachedUserCount = {
      count: activeUsers,
      timestamp: Date.now()
    };

    return NextResponse.json({
      success: true,
      activeUsers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching active user count:', error);
    // Return cached value if available, even if expired
    if (cachedUserCount) {
      return NextResponse.json({
        success: true,
        activeUsers: cachedUserCount.count,
        timestamp: new Date().toISOString(),
        cached: true,
        error: 'Using cached value due to error'
      });
    }
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch active user count',
        activeUsers: 0
      },
      { status: 500 }
    );
  }
}

