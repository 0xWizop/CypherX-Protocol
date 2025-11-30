import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    console.log('🔍 Fetching Zora coins...');

    let coins: any[] = [];

    // Use REST API directly (Zora SDK is primarily for creating coins, not fetching)
    try {
      const apiUrl = new URL('https://api.zora.co/coins/v1/explore');
      apiUrl.searchParams.set('limit', limit.toString());
      apiUrl.searchParams.set('sortBy', sortBy);
      apiUrl.searchParams.set('order', order);
      
      if (process.env.ZORA_API_KEY) {
        apiUrl.searchParams.set('apiKey', process.env.ZORA_API_KEY);
      }

      const response = await fetch(apiUrl.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(process.env.ZORA_API_KEY && { 'X-API-Key': process.env.ZORA_API_KEY }),
        },
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Zora API response structure:', Object.keys(data));
        // Handle different possible response formats
        if (Array.isArray(data)) {
          coins = data;
        } else if (data.coins && Array.isArray(data.coins)) {
          coins = data.coins;
        } else if (data.data && Array.isArray(data.data)) {
          coins = data.data;
        } else if (data.results && Array.isArray(data.results)) {
          coins = data.results;
        } else if (data.items && Array.isArray(data.items)) {
          coins = data.items;
        }
        console.log(`✅ Fetched ${coins.length} coins from Zora REST API`);
        if (coins.length > 0) {
          console.log('🔍 Sample Zora coin:', {
            address: coins[0].address || coins[0].tokenAddress,
            name: coins[0].name,
            symbol: coins[0].symbol,
          });
        }
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ Zora API returned status ${response.status}: ${response.statusText}`, errorText);
      }
    } catch (apiError) {
      console.error('❌ Zora REST API failed:', apiError);
    }

    console.log(`✅ Fetched ${coins.length} Zora coins`);

    // Helper function to fetch comprehensive stats from DexScreener
    async function fetchDexScreenerStats(tokenAddress: string, pairAddress?: string) {
      try {
        // Try fetching by token address first (more comprehensive)
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
            // Find the best pair (prefer Base chain, highest liquidity)
            const basePairs = dexData.pairs.filter((p: any) => 
              p.chainId === 'base' || p.chainId === '8453'
            );
            const pair = basePairs.length > 0 
              ? basePairs.sort((a: any, b: any) => 
                  (parseFloat(b.liquidity?.usd || '0')) - (parseFloat(a.liquidity?.usd || '0'))
                )[0]
              : dexData.pairs[0];

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
        // Silently fail - DexScreener enhancement is optional
        console.warn(`⚠️ DexScreener fetch failed for ${tokenAddress}:`, error);
      }
      return null;
    }

    // Enhance Zora coins with DexScreener stats
    const enhancedCoins = await Promise.all(
      coins.slice(0, limit).map(async (coin: any) => {
        const tokenAddress = coin.address || coin.tokenAddress;
        const pairAddress = coin.pairAddress || coin.poolAddress;
        
        if (tokenAddress) {
          const dexStats = await fetchDexScreenerStats(tokenAddress, pairAddress);
          if (dexStats) {
            coin.dexScreenerStats = dexStats;
          }
        }
        return coin;
      })
    );

    // Transform Zora coins to our token format
    const tokens = enhancedCoins.map((coin: any) => {
      try {
          // Use DexScreener stats if available, otherwise fall back to Zora API stats
          const dexStats = coin.dexScreenerStats;
          
          const token: any = {
            address: coin.address || coin.tokenAddress || '',
            name: coin.name || coin.metadata?.name || 'Unknown',
            symbol: coin.symbol || coin.tokenSymbol || 'UNKNOWN',
            source: 'zora',
            dexName: 'Zora',
            dexId: dexStats?.dexId || 'zora',
            chainId: coin.chainId || 8453, // Base chain
            creatorAddress: coin.creator?.address || coin.creatorAddress || '',
            createdAt: coin.createdAt || coin.timestamp || new Date().toISOString(),
            description: coin.metadata?.description || coin.description || '',
            website: coin.socialLinks?.website || coin.website || '',
            twitter: coin.socialLinks?.twitter || coin.twitter || '',
            telegram: coin.socialLinks?.telegram || coin.telegram || '',
            discord: coin.socialLinks?.discord || coin.discord || '',
            tokenUri: coin.metadata?.image || coin.image || coin.logo || '',
            mediaContent: coin.metadata?.image || coin.image || coin.logo || '',
            // Stats - prioritize DexScreener, fallback to Zora API
            marketCap: dexStats?.marketCap || coin.stats?.marketCap || coin.marketCap || 0,
            fdv: dexStats?.fdv || 0,
            volume24h: dexStats?.volume?.h24 || coin.stats?.volume24h || coin.volume24h || coin.volume || 0,
            volume: dexStats?.volume || {
              h1: coin.stats?.volume1h || 0,
              h6: coin.stats?.volume6h || 0,
              h24: coin.stats?.volume24h || coin.volume24h || coin.volume || 0,
            },
            uniqueHolders: dexStats?.uniqueHolders || coin.stats?.holders || coin.holders || coin.uniqueHolders || 0,
            totalSupply: coin.stats?.totalSupply || coin.totalSupply || 0,
            priceUsd: dexStats?.priceUsd || coin.stats?.price?.toString() || coin.price?.toString() || '0',
            priceChange: dexStats?.priceChange || {
              m5: coin.stats?.priceChange5m || 0,
              h1: coin.stats?.priceChange1h || 0,
              h6: coin.stats?.priceChange6h || 0,
              h24: coin.stats?.priceChange24h || 0,
            },
            liquidity: dexStats?.liquidity || {
              usd: coin.stats?.liquidity || 0,
            },
            txns: dexStats?.txns || {
              m5: { buys: 0, sells: 0 },
              h1: { buys: 0, sells: 0 },
              h6: { buys: 0, sells: 0 },
              h24: { buys: 0, sells: 0 },
            },
            pairAddress: dexStats?.pairAddress || coin.pairAddress || coin.poolAddress || '',
            poolAddress: dexStats?.pairAddress || coin.pairAddress || coin.poolAddress || '',
            quoteToken: dexStats?.quoteToken,
            lastUpdated: new Date().toISOString(),
            tags: [],
          };

          // Add tags based on coin data
          if (token.createdAt) {
            const created = new Date(token.createdAt);
            const now = new Date();
            const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 10) {
              token.tags.push('NEW');
            }
          }

          if (token.volume24h > 100000) {
            token.tags.push('SPIKE');
          }

          if (token.volume24h > 50000) {
            token.tags.push('VOLUME');
          }

          if (token.uniqueHolders > 500) {
            token.tags.push('TRENDING');
          }

          return token;
        } catch (error) {
          console.error(`❌ Error processing Zora coin ${coin.id || coin.address}:`, error);
          return null;
        }
      })
      .filter((token: any) => token !== null && token.address);

    // Filter out null values
    const validTokens = tokens;

    return NextResponse.json({
      success: true,
      tokens: validTokens,
      count: validTokens.length,
      source: 'zora',
    });
  } catch (error) {
    console.error('❌ Error fetching Zora coins:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Zora coins',
        tokens: [],
      },
      { status: 500 }
    );
  }
}

