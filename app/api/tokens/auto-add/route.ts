import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Auto-Add New Coins to Pairs
 * 
 * Monitors new coins from Zora, Clanker, and other sources.
 * Once a coin reaches ≥ $50k market cap AND ≥ $10k volume,
 * automatically adds it to the tokens collection.
 * 
 * This endpoint should be called periodically (e.g., every 5 minutes via cron)
 */

const MARKET_CAP_THRESHOLD = 50000; // $50k minimum
const VOLUME_THRESHOLD = 10000; // $10k minimum

interface TokenData {
  address: string;
  name: string;
  symbol: string;
  marketCap?: number;
  volume24h?: number;
  pairAddress?: string;
  source?: string;
  [key: string]: any;
}

async function fetchTokensFromSources(): Promise<TokenData[]> {
  const tokens: TokenData[] = [];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    // Fetch from Zora
    try {
      const zoraModule = await import('../zora/route');
      const getZoraTokens = zoraModule.GET;
      const zoraRequest = new Request(
        new URL('/api/tokens/zora?limit=100', baseUrl)
      );
      const zoraResponse = await getZoraTokens(zoraRequest);
      if (zoraResponse.ok) {
        const zoraData = await zoraResponse.json();
        if (zoraData.success && zoraData.tokens && Array.isArray(zoraData.tokens)) {
          tokens.push(...zoraData.tokens.map((t: any) => ({ ...t, source: 'zora' })));
          console.log(`✅ Fetched ${zoraData.tokens.length} tokens from Zora`);
        }
      }
    } catch (zoraError) {
      console.error('❌ Zora fetch failed:', zoraError);
    }

    // Fetch from Clanker
    try {
      const clankerModule = await import('../clanker/route');
      const getClankerTokens = clankerModule.GET;
      const clankerRequest = new Request(
        new URL('/api/tokens/clanker?limit=100', baseUrl)
      );
      const clankerResponse = await getClankerTokens(clankerRequest);
      if (clankerResponse.ok) {
        const clankerData = await clankerResponse.json();
        if (clankerData.success && clankerData.tokens && Array.isArray(clankerData.tokens)) {
          tokens.push(...clankerData.tokens.map((t: any) => ({ ...t, source: 'clanker' })));
          console.log(`✅ Fetched ${clankerData.tokens.length} tokens from Clanker`);
        }
      }
    } catch (clankerError) {
      console.error('❌ Clanker fetch failed:', clankerError);
    }

    // Fetch from Cypherscope (for newly discovered tokens)
    try {
      const cypherscopeResponse = await fetch(`${baseUrl}/api/cypherscope-tokens?t=${Date.now()}`);
      if (cypherscopeResponse.ok) {
        const cypherscopeData = await cypherscopeResponse.json();
        if (cypherscopeData.tokens && Array.isArray(cypherscopeData.tokens)) {
          // Only include tokens from Zora/Clanker that aren't already in our list
          const existingAddresses = new Set(tokens.map(t => t.address?.toLowerCase()).filter(Boolean));
          const newTokens = cypherscopeData.tokens.filter((t: any) => 
            t.address && 
            !existingAddresses.has(t.address.toLowerCase()) &&
            (t.source === 'zora' || t.source === 'clanker')
          );
          tokens.push(...newTokens.map((t: any) => ({ ...t, source: t.source || 'cypherscope' })));
          console.log(`✅ Added ${newTokens.length} additional tokens from Cypherscope`);
        }
      }
    } catch (cypherscopeError) {
      console.error('❌ Cypherscope fetch failed:', cypherscopeError);
    }

  } catch (error) {
    console.error('❌ Error fetching tokens from sources:', error);
  }

  return tokens;
}

function meetsThresholds(token: TokenData): boolean {
  const marketCap = typeof token.marketCap === 'string' 
    ? parseFloat(token.marketCap) 
    : (token.marketCap || 0);
  const volume24h = typeof token.volume24h === 'string'
    ? parseFloat(token.volume24h)
    : (token.volume24h || 0);

  // Check if volume exists in nested structure
  const volumeFromNested = token.volume?.h24 
    ? (typeof token.volume.h24 === 'string' ? parseFloat(token.volume.h24) : token.volume.h24)
    : 0;
  const finalVolume = volume24h || volumeFromNested;

  return marketCap >= MARKET_CAP_THRESHOLD && finalVolume >= VOLUME_THRESHOLD;
}

async function saveTokenToDatabase(token: TokenData): Promise<boolean> {
  const db = adminDb();
  if (!db) {
    console.error('❌ Database connection failed');
    return false;
  }

  try {
    const normalizedAddress = token.address.toLowerCase();
    
    // Check if token already exists
    const existingQuery = db
      .collection('tokens')
      .where('address', '==', normalizedAddress)
      .limit(1);
    
    const existingSnapshot = await existingQuery.get();

    const tokenData: any = {
      address: normalizedAddress,
      name: token.name,
      symbol: token.symbol,
      source: token.source || 'auto-added',
      dexName: token.dexName || 'unknown',
      dexId: token.dexId || token.dexName?.toLowerCase() || 'unknown',
      chainId: token.chainId || 8453, // Base chain
      creatorAddress: token.creatorAddress || '',
      createdAt: token.createdAt
        ? Timestamp.fromDate(new Date(token.createdAt))
        : Timestamp.now(),
      description: token.description || '',
      website: token.website || '',
      telegram: token.telegram || '',
      twitter: token.twitter || '',
      tokenUri: token.tokenUri || token.mediaContent || '',
      mediaContent: token.mediaContent || token.tokenUri || '',
      marketCap: token.marketCap || 0,
      volume24h: token.volume24h || token.volume?.h24 || 0,
      uniqueHolders: token.uniqueHolders || 0,
      totalSupply: token.totalSupply || 0,
      priceUsd: token.priceUsd || '0',
      liquidity: token.liquidity || { usd: 0 },
      pool: token.pairAddress || token.poolAddress || '',
      pair: token.pairAddress || token.poolAddress || '',
      tags: token.tags || [],
      lastUpdated: Timestamp.now(),
      autoAdded: true, // Flag to indicate this was auto-added
      autoAddedAt: Timestamp.now(),
    };

    // Add optional fields
    if (token.priceChange) tokenData.priceChange = token.priceChange;
    if (token.volume) tokenData.volume = token.volume;
    if (token.txns) tokenData.txns = token.txns;
    if (token.info) tokenData.info = token.info;

    if (existingSnapshot.empty) {
      // Create new token
      await db.collection('tokens').add(tokenData);
      console.log(`✅ Auto-added new token: ${token.name} (${token.symbol}) - ${normalizedAddress}`);
      return true;
    } else {
      // Update existing token if thresholds are now met
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      
      // Only update if thresholds were not previously met or if it's an improvement
      const existingMarketCap = existingData.marketCap || 0;
      const existingVolume = existingData.volume24h || 0;
      
      if (existingMarketCap < MARKET_CAP_THRESHOLD || existingVolume < VOLUME_THRESHOLD) {
        const mergedData = {
          ...existingData,
          ...tokenData,
          createdAt: existingData.createdAt || tokenData.createdAt,
          lastUpdated: Timestamp.now(),
          tags: [
            ...new Set([
              ...(existingData.tags || []),
              ...(tokenData.tags || []),
            ]),
          ],
        };
        
        await existingDoc.ref.update(mergedData);
        console.log(`✅ Updated token that now meets thresholds: ${token.name} (${token.symbol})`);
        return true;
      }
      
      return false; // Token already exists and meets thresholds
    }
  } catch (error) {
    console.error(`❌ Error saving token ${token.address}:`, error);
    return false;
  }
}

export async function GET(_request: Request) {
  try {
    console.log('🚀 Starting auto-add process for new coins...');
    
    // Fetch tokens from all sources
    const allTokens = await fetchTokensFromSources();
    console.log(`📊 Total tokens fetched: ${allTokens.length}`);

    // Filter tokens that meet thresholds
    const qualifyingTokens = allTokens.filter(meetsThresholds);
    console.log(`✅ Tokens meeting thresholds (≥$${MARKET_CAP_THRESHOLD.toLocaleString()} market cap, ≥$${VOLUME_THRESHOLD.toLocaleString()} volume): ${qualifyingTokens.length}`);

    // Remove duplicates based on address
    const uniqueTokens = qualifyingTokens.filter((token, index, self) => 
      index === self.findIndex(t => t.address?.toLowerCase() === token.address?.toLowerCase())
    );
    console.log(`📊 Unique qualifying tokens: ${uniqueTokens.length}`);

    // Save tokens to database
    const results = {
      checked: allTokens.length,
      qualified: uniqueTokens.length,
      added: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const token of uniqueTokens) {
      if (!token.address || !token.name || !token.symbol) {
        results.skipped++;
        continue;
      }

      try {
        const wasAdded = await saveTokenToDatabase(token);
        if (wasAdded) {
          results.added++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        const errorMsg = `Error processing ${token.address}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log(`✅ Auto-add process completed:`, results);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.checked} tokens, added/updated ${results.added} tokens`,
      ...results,
    });

  } catch (error) {
    console.error('❌ Auto-add process failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to auto-add tokens',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}



