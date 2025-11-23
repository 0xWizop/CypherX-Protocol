import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokens, source } = body;

    if (!tokens || !Array.isArray(tokens)) {
      return NextResponse.json(
        { success: false, error: 'Tokens array is required' },
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

    console.log(`💾 Saving ${tokens.length} tokens from ${source || 'unknown'} source...`);

    const savedTokens: string[] = [];
    const skippedTokens: string[] = [];
    const errors: string[] = [];

    for (const token of tokens) {
      try {
        // Validate required fields
        if (!token.address || !token.name || !token.symbol) {
          console.warn(`⚠️ Skipping token with missing required fields:`, token);
          skippedTokens.push(token.address || 'unknown');
          continue;
        }

        // Normalize address
        const normalizedAddress = token.address.toLowerCase();

        // Check if token already exists
        const existingTokenQuery = db
          .collection('tokens')
          .where('address', '==', normalizedAddress)
          .limit(1);

        const existingSnapshot = await existingTokenQuery.get();

        const tokenData: any = {
          address: normalizedAddress,
          name: token.name,
          symbol: token.symbol,
          source: token.source || source || 'unknown',
          dexName: token.dexName || 'unknown',
          dexId: token.dexId || token.dexName?.toLowerCase() || 'unknown',
          chainId: token.chainId || 8453, // Default to Base
          creatorAddress: token.creatorAddress || '',
          createdAt: token.createdAt
            ? Timestamp.fromDate(new Date(token.createdAt))
            : Timestamp.now(),
          description: token.description || '',
          website: token.website || '',
          telegram: token.telegram || '',
          twitter: token.twitter || '',
          discord: token.discord || '',
          tokenUri: token.tokenUri || token.mediaContent || '',
          mediaContent: token.mediaContent || token.tokenUri || '',
          marketCap: token.marketCap || 0,
          volume24h: token.volume24h || 0,
          uniqueHolders: token.uniqueHolders || 0,
          totalSupply: token.totalSupply || 0,
          priceUsd: token.priceUsd || '0',
          liquidity: token.liquidity || { usd: 0 },
          pool: token.pairAddress || token.poolAddress || '',
          pair: token.pairAddress || token.poolAddress || '',
          tags: token.tags || [],
          lastUpdated: Timestamp.now(),
        };

        // Add optional fields
        if (token.priceChange) {
          tokenData.priceChange = token.priceChange;
        }

        if (token.volume) {
          tokenData.volume = token.volume;
        }

        if (token.txns) {
          tokenData.txns = token.txns;
        }

        if (token.info) {
          tokenData.info = token.info;
        }

        if (existingSnapshot.empty) {
          // Create new token
          await db.collection('tokens').add(tokenData);
          savedTokens.push(normalizedAddress);
          console.log(`✅ Created new token: ${token.name} (${normalizedAddress})`);
        } else {
          // Update existing token (merge with existing data)
          const existingDoc = existingSnapshot.docs[0];
          const existingData = existingDoc.data();

          // Merge data, keeping existing values if new ones are missing
          const mergedData = {
            ...existingData,
            ...tokenData,
            // Preserve original createdAt
            createdAt: existingData.createdAt || tokenData.createdAt,
            // Update lastUpdated
            lastUpdated: Timestamp.now(),
            // Merge tags
            tags: [
              ...new Set([
                ...(existingData.tags || []),
                ...(tokenData.tags || []),
              ]),
            ],
          };

          await existingDoc.ref.update(mergedData);
          savedTokens.push(normalizedAddress);
          console.log(`✅ Updated existing token: ${token.name} (${normalizedAddress})`);
        }
      } catch (error) {
        const errorMsg = `Error processing token ${token.address}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return NextResponse.json({
      success: true,
      saved: savedTokens.length,
      skipped: skippedTokens.length,
      errorCount: errors.length,
      savedTokens,
      skippedTokens,
      errors,
    });
  } catch (error) {
    console.error('❌ Error saving tokens:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save tokens',
      },
      { status: 500 }
    );
  }
}















