import { NextResponse } from 'next/server';

/**
 * Sync tokens from all launchpad sources (Zora, Clanker, etc.)
 * This endpoint fetches tokens from all sources and saves them to Firebase
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sources = searchParams.get('sources')?.split(',') || ['zora', 'clanker'];
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log(`🔄 Syncing tokens from sources: ${sources.join(', ')}`);

    const results: any = {
      zora: { success: false, tokens: [], error: null },
      clanker: { success: false, tokens: [], error: null },
    };

    // Import the route handlers directly to avoid HTTP calls
    const zoraModule = await import('../zora/route');
    const clankerModule = await import('../clanker/route');
    const getZoraTokens = zoraModule.GET;
    const getClankerTokens = clankerModule.GET;

    // Fetch from Zora
    if (sources.includes('zora')) {
      try {
        const zoraRequest = new Request(
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tokens/zora?limit=${limit}`
        );
        const zoraResponse = await getZoraTokens(zoraRequest);
        const zoraData = await zoraResponse.json();
        results.zora = {
          success: zoraData.success,
          tokens: zoraData.tokens || [],
          error: zoraData.error || null,
        };
        console.log(`✅ Fetched ${results.zora.tokens.length} tokens from Zora`);
      } catch (error) {
        results.zora.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Error fetching Zora tokens:', error);
      }
    }

    // Fetch from Clanker
    if (sources.includes('clanker')) {
      try {
        const clankerRequest = new Request(
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tokens/clanker?limit=${limit}`
        );
        const clankerResponse = await getClankerTokens(clankerRequest);
        const clankerData = await clankerResponse.json();
        results.clanker = {
          success: clankerData.success,
          tokens: clankerData.tokens || [],
          error: clankerData.error || null,
        };
        console.log(`✅ Fetched ${results.clanker.tokens.length} tokens from Clanker`);
      } catch (error) {
        results.clanker.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Error fetching Clanker tokens:', error);
      }
    }

    // Save all tokens to Firebase
    const allTokens: any[] = [];
    if (results.zora.tokens.length > 0) {
      allTokens.push(...results.zora.tokens);
    }
    if (results.clanker.tokens.length > 0) {
      allTokens.push(...results.clanker.tokens);
    }

    let saveResult: any = { success: false, saved: 0, error: null };

    if (allTokens.length > 0) {
      try {
        const saveModule = await import('../save/route');
        const saveTokens = saveModule.POST;
        const saveRequest = new Request(
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tokens/save`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tokens: allTokens,
              source: 'sync',
            }),
          }
        );

        const saveResponse = await saveTokens(saveRequest);
        saveResult = await saveResponse.json();
        console.log(`✅ Saved ${saveResult.saved || 0} tokens to Firebase`);
      } catch (error) {
        saveResult.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Error saving tokens:', error);
      }
    }

    return NextResponse.json({
      success: true,
      sources: results,
      save: saveResult,
      totalFetched: allTokens.length,
      totalSaved: saveResult.saved || 0,
    });
  } catch (error) {
    console.error('❌ Error syncing tokens:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync tokens',
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: Request) {
  return POST(request);
}

