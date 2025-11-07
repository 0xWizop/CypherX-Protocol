import { NextResponse } from 'next/server';

/**
 * Cron job endpoint to continuously sync tokens from all launchpads
 * This should be called periodically (e.g., every 5-10 minutes) to keep tokens updated
 * 
 * Usage with Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/tokens/sync-cron",
 *     "schedule": "every 10 minutes"
 *   }]
 * }
 */
export async function GET(request: Request) {
  try {
    // Verify this is a cron request (optional security check)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting scheduled token sync...');

    // Import sync route handler
    const syncModule = await import('../sync/route');
    const syncTokens = syncModule.GET;
    const syncRequest = new Request(
      new URL('/api/tokens/sync?sources=zora,clanker&limit=50', 
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    );
    
    const syncResponse = await syncTokens(syncRequest);
    const syncResult = await syncResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Token sync completed',
      result: syncResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Cron sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}

