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
          activeUsers: 0
        },
        { status: 500 }
      );
    }

    const usersSnapshot = await db.collection('users').get();
    const activeUsers = usersSnapshot.size;

    return NextResponse.json({
      success: true,
      activeUsers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching active user count:', error);
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

