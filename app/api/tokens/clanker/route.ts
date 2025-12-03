import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'createdAt';

    console.log('🔍 Fetching Clanker tokens from API...');

    let tokens: any[] = [];

    // Use Clanker's official API (from documentation: https://clanker.gitbook.io/clanker-documentation/public/get-tokens)
    try {
      const apiUrl = new URL('https://www.clanker.world/api/tokens');
      
      // Set query parameters according to API documentation
      apiUrl.searchParams.set('limit', Math.min(limit, 20).toString()); // Max 20 per API docs
      apiUrl.searchParams.set('sort', sortBy === 'createdAt' ? 'desc' : 'asc');
      apiUrl.searchParams.set('includeMarket', 'true'); // Include market data
      apiUrl.searchParams.set('includeUser', 'true'); // Include creator profile data

      console.log(`📡 Fetching from Clanker API: ${apiUrl.toString()}`);

      const response = await fetch(apiUrl.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        
        // API returns { data: [...], total: number, cursor: string }
        if (data.data && Array.isArray(data.data)) {
          tokens = data.data;
          console.log(`✅ Successfully fetched ${tokens.length} tokens from Clanker API (total: ${data.total || 'unknown'})`);
          // Log sample token to debug market cap issue
          if (tokens.length > 0) {
            console.log('🔍 Sample Clanker token:', {
              symbol: tokens[0].symbol,
              contract_address: tokens[0].contract_address,
              pool_address: tokens[0].pool_address,
              starting_market_cap: tokens[0].starting_market_cap,
              related_market: tokens[0].related?.market,
            });
          }
        } else {
          console.warn('⚠️ Clanker API returned unexpected format:', data);
        }
      } else {
        console.warn(`⚠️ Clanker API returned status ${response.status}: ${response.statusText}`);
      }
    } catch (apiError) {
      console.error('❌ Clanker API fetch failed:', apiError);
    }

    console.log(`✅ Fetched ${tokens.length} Clanker tokens`);

    // If no tokens from API, return empty array gracefully
    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        tokens: [],
        count: 0,
        source: 'clanker',
        message: 'No tokens found from Clanker API',
      });
    }

    // Helper function to fetch comprehensive stats from DexScreener
    async function fetchDexScreenerStats(tokenAddress: string, pairAddress?: string) {
      try {
        // Try fetching by token address first (more comprehensive, gets all pairs)
        let dexResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
          }
        );

        if (dexResponse.ok) {
          const dexData = await dexResponse.json();
          if (dexData.pairs && dexData.pairs.length > 0) {
            // Find the best pair (prefer Base chain, highest liquidity, or match pairAddress)
            const basePairs = dexData.pairs.filter((p: any) => 
              p.chainId === 'base' || p.chainId === '8453'
            );
            
            let pair;
            if (pairAddress && basePairs.length > 0) {
              // Try to find exact pair match
              pair = basePairs.find((p: any) => 
                p.pairAddress?.toLowerCase() === pairAddress.toLowerCase()
              ) || basePairs[0];
            } else {
              // Sort by liquidity
              pair = basePairs.length > 0
                ? basePairs.sort((a: any, b: any) => 
                    (parseFloat(b.liquidity?.usd || '0')) - (parseFloat(a.liquidity?.usd || '0'))
                  )[0]
                : dexData.pairs[0];
            }

            return {
              priceUsd: pair.priceUsd || '0',
              priceChange: {
                m5: pair.priceChange?.m5 || 0,
                h1: pair.priceChange?.h1 || 0,
                h6: pair.priceChange?.h6 || 0,
                h24: pair.priceChange?.h24 || 0,
              },
              volume: {
                h1: pair.volume?.h1 || 0,
                h6: pair.volume?.h6 || 0,
                h24: pair.volume?.h24 || 0,
              },
              liquidity: {
                usd: parseFloat(pair.liquidity?.usd || '0'),
                base: parseFloat(pair.liquidity?.base || '0'),
                quote: parseFloat(pair.liquidity?.quote || '0'),
              },
              marketCap: parseFloat(pair.marketCap || '0'),
              fdv: parseFloat(pair.fdv || '0'),
              uniqueHolders: pair.holders || 0,
              txns: {
                m5: pair.txns?.m5 || { buys: 0, sells: 0 },
                h1: pair.txns?.h1 || { buys: 0, sells: 0 },
                h6: pair.txns?.h6 || { buys: 0, sells: 0 },
                h24: pair.txns?.h24 || { buys: 0, sells: 0 },
              },
              pairAddress: pair.pairAddress || pairAddress || '',
              dexId: pair.dexId || 'unknown',
              quoteToken: pair.quoteToken ? {
                address: pair.quoteToken.address,
                symbol: pair.quoteToken.symbol,
                name: pair.quoteToken.name,
              } : undefined,
            };
          }
        }

        // Fallback: try by pair address if provided
        if (pairAddress) {
          dexResponse = await fetch(
            `https://api.dexscreener.com/latest/dex/pairs/base/${pairAddress}`,
            {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(5000),
            }
          );

          if (dexResponse.ok) {
            const dexData = await dexResponse.json();
            if (dexData.pairs && dexData.pairs.length > 0) {
              const pair = dexData.pairs[0];
              return {
                priceUsd: pair.priceUsd || '0',
                priceChange: {
                  m5: pair.priceChange?.m5 || 0,
                  h1: pair.priceChange?.h1 || 0,
                  h6: pair.priceChange?.h6 || 0,
                  h24: pair.priceChange?.h24 || 0,
                },
                volume: {
                  h1: pair.volume?.h1 || 0,
                  h6: pair.volume?.h6 || 0,
                  h24: pair.volume?.h24 || 0,
                },
                liquidity: {
                  usd: parseFloat(pair.liquidity?.usd || '0'),
                  base: parseFloat(pair.liquidity?.base || '0'),
                  quote: parseFloat(pair.liquidity?.quote || '0'),
                },
                marketCap: parseFloat(pair.marketCap || '0'),
                fdv: parseFloat(pair.fdv || '0'),
                uniqueHolders: pair.holders || 0,
                txns: {
                  m5: pair.txns?.m5 || { buys: 0, sells: 0 },
                  h1: pair.txns?.h1 || { buys: 0, sells: 0 },
                  h6: pair.txns?.h6 || { buys: 0, sells: 0 },
                  h24: pair.txns?.h24 || { buys: 0, sells: 0 },
                },
                pairAddress: pair.pairAddress || pairAddress,
                dexId: pair.dexId || 'unknown',
                quoteToken: pair.quoteToken ? {
                  address: pair.quoteToken.address,
                  symbol: pair.quoteToken.symbol,
                  name: pair.quoteToken.name,
                } : undefined,
              };
            }
          }
        }
      } catch (error) {
        // Log error for debugging
        console.warn(`⚠️ DexScreener fetch failed for ${tokenAddress}:`, error);
      }
      return null;
    }

    // Enhance Clanker tokens with comprehensive DexScreener market data
    const enhancedTokens = await Promise.all(
      tokens.map(async (token: any) => {
        const tokenAddress = token.contract_address;
        const pairAddress = token.pool_address;
        
        if (tokenAddress) {
          try {
            const dexStats = await fetchDexScreenerStats(tokenAddress, pairAddress);
            if (dexStats && dexStats.marketCap > 0) {
              token.dexScreenerStats = dexStats;
              // Also update related.market for backward compatibility
              token.related = token.related || {};
              token.related.market = {
                marketCap: dexStats.marketCap,
                volume24h: dexStats.volume.h24,
                volume: dexStats.volume,
                holders: dexStats.uniqueHolders,
                price: dexStats.priceUsd,
                priceChange: dexStats.priceChange,
                liquidity: dexStats.liquidity.usd,
                fdv: dexStats.fdv,
                txns: dexStats.txns,
              };
              console.log(`✅ Enhanced Clanker token ${token.symbol} with DexScreener: MC=${dexStats.marketCap}, Vol=${dexStats.volume.h24}`);
            } else {
              console.warn(`⚠️ No DexScreener stats for ${token.symbol} (${tokenAddress})`);
            }
          } catch (error) {
            console.warn(`⚠️ DexScreener enhancement failed for ${token.symbol}:`, error);
          }
        }
        return token;
      })
    );

    // Transform Clanker API tokens to our token format
    const transformedTokens = enhancedTokens.map((token: any) => {
      // Extract social media URLs from metadata or socialLinks
      const socialUrls = token.metadata?.socialMediaUrls || token.socialLinks || [];
      const twitterUrl = socialUrls.find((url: any) => 
        url.platform === 'twitter' || url.platform === 'x' || url.name === 'x'
      )?.url || socialUrls.find((url: any) => url.name === 'x')?.link || '';
      const telegramUrl = socialUrls.find((url: any) => 
        url.platform === 'telegram' || url.name === 'telegram'
      )?.url || socialUrls.find((url: any) => url.name === 'telegram')?.link || '';
      const websiteUrl = socialUrls.find((url: any) => 
        url.platform === 'website' || url.name === 'website'
      )?.url || socialUrls.find((url: any) => url.name === 'website')?.link || '';
      
      // Extract market data - prioritize DexScreener, then Clanker API, then defaults
      const dexStats = token.dexScreenerStats;
      const marketData = token.related?.market || {};

      const transformed: any = {
        address: token.contract_address?.toLowerCase() || '',
        name: token.name || 'Unknown',
        symbol: token.symbol || 'UNKNOWN',
        source: 'clanker',
        dexName: 'Clanker',
        dexId: dexStats?.dexId || 'clanker',
        chainId: token.chain_id || 8453, // Base chain
        creatorAddress: token.msg_sender?.toLowerCase() || token.admin?.toLowerCase() || '',
        createdAt: token.created_at || token.deployed_at || new Date().toISOString(),
        description: token.description || token.metadata?.description || '',
        website: websiteUrl,
        twitter: twitterUrl,
        telegram: telegramUrl,
        discord: '', // Not in API response
        tokenUri: token.img_url || '',
        mediaContent: token.img_url || '',
        // Stats - prioritize DexScreener, then Clanker API market data, then defaults
        // Only use DexScreener or Clanker API market data - don't use starting_market_cap as it's not accurate
        marketCap: dexStats?.marketCap || marketData.marketCap || 0,
        fdv: dexStats?.fdv || 0,
        volume24h: dexStats?.volume?.h24 || marketData.volume24h || marketData.volume || 0,
        volume: dexStats?.volume || {
          h1: marketData.volume?.h1 || 0,
          h6: marketData.volume?.h6 || 0,
          h24: marketData.volume24h || marketData.volume || 0,
        },
        uniqueHolders: dexStats?.uniqueHolders || marketData.holders || marketData.uniqueHolders || 0,
        totalSupply: token.supply || '0',
        priceUsd: dexStats?.priceUsd || marketData.price?.toString() || '0',
        priceChange: dexStats?.priceChange || (marketData.priceChange ? {
          m5: marketData.priceChange.m5 || 0,
          h1: marketData.priceChange.h1 || 0,
          h6: marketData.priceChange.h6 || 0,
          h24: marketData.priceChange.h24 || 0,
        } : {
          m5: 0,
          h1: 0,
          h6: 0,
          h24: 0,
        }),
        liquidity: dexStats?.liquidity || (marketData.liquidity ? { usd: marketData.liquidity } : { usd: 0 }),
        txns: dexStats?.txns || marketData.txns || {
          m5: { buys: 0, sells: 0 },
          h1: { buys: 0, sells: 0 },
          h6: { buys: 0, sells: 0 },
          h24: { buys: 0, sells: 0 },
        },
        pairAddress: dexStats?.pairAddress || token.pool_address?.toLowerCase() || '',
        poolAddress: dexStats?.pairAddress || token.pool_address?.toLowerCase() || '',
        quoteToken: dexStats?.quoteToken,
        lastUpdated: token.last_indexed || new Date().toISOString(),
        tags: [],
        // Additional Clanker-specific fields
        txHash: token.tx_hash || '',
        factoryAddress: token.factory_address || '',
        lockerAddress: token.locker_address || '',
        pair: token.pair || 'WETH',
        type: token.type || 'clanker_v4',
        verified: token.tags?.verified || false,
      };

      // Add tags based on token data
      if (transformed.createdAt) {
        const created = new Date(transformed.createdAt);
        const now = new Date();
        const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 10) {
          transformed.tags.push('NEW');
        }
      }

      if (transformed.volume24h > 100000) {
        transformed.tags.push('SPIKE');
      }

      if (transformed.volume24h > 50000) {
        transformed.tags.push('VOLUME');
      }

      if (transformed.uniqueHolders > 500) {
        transformed.tags.push('TRENDING');
      }

      if (transformed.marketCap < 500000 && transformed.volume24h > 10000) {
        transformed.tags.push('RUNNER');
      }

      if (transformed.liquidity?.usd > 50000) {
        transformed.tags.push('LIQUIDITY');
      }

      return transformed;
    });

    return NextResponse.json({
      success: true,
      tokens: transformedTokens,
      count: transformedTokens.length,
      source: 'clanker',
    });
  } catch (error) {
    console.error('❌ Error fetching Clanker tokens:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to fetch token data. Please try again later.',
        tokens: [],
      },
      { status: 500 }
    );
  }
}
