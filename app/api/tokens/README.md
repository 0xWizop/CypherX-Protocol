# Token Launchpad Integration

This directory contains API routes for fetching tokens from various launchpads and saving them to Firebase.

## Routes

### `/api/tokens/zora`
Fetches tokens from Zora Coins platform.

**Query Parameters:**
- `limit` (optional): Number of tokens to fetch (default: 50)
- `sortBy` (optional): Sort field (default: 'createdAt')
- `order` (optional): Sort order 'asc' or 'desc' (default: 'desc')

**Environment Variables:**
- `ZORA_API_KEY`: Your Zora API key (optional but recommended to avoid rate limiting)

### `/api/tokens/clanker`
Fetches tokens from Clanker launchpad.

**Query Parameters:**
- `limit` (optional): Number of tokens to fetch (default: 50)
- `sortBy` (optional): Sort field (default: 'createdAt')

### `/api/tokens/save`
Saves tokens to Firebase tokens collection.

**Request Body:**
```json
{
  "tokens": [
    {
      "address": "0x...",
      "name": "Token Name",
      "symbol": "SYMBOL",
      "source": "zora",
      // ... other token fields
    }
  ],
  "source": "sync"
}
```

### `/api/tokens/sync`
Syncs tokens from all launchpad sources and saves them to Firebase.

**Query Parameters:**
- `sources` (optional): Comma-separated list of sources to sync (default: 'zora,clanker')
- `limit` (optional): Number of tokens per source (default: 50)

**Usage:**
```bash
# Sync all sources
GET /api/tokens/sync

# Sync specific sources
GET /api/tokens/sync?sources=zora,clanker&limit=100
```

## Setup

1. **Environment Variables:**
   Add to your `.env.local`:
   ```
   ZORA_API_KEY=your_zora_api_key_here
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

2. **Firebase Service Account:**
   Ensure your Firebase service account is configured (see `lib/firebase-admin.ts`)

3. **Initial Sync:**
   Call the sync endpoint to populate tokens:
   ```bash
   curl http://localhost:3000/api/tokens/sync
   ```

## Integration with Radar Page

The radar page (`/radar`) automatically fetches tokens from all sources via `/api/cypherscope-tokens`, which now includes:
- Zora tokens
- Clanker tokens
- Existing screener tokens
- Cypherscope collection tokens

## Integration with Explore Page

The explore page (`/explore`) reads directly from the Firebase `tokens` collection, so all tokens saved via the `/api/tokens/save` endpoint will automatically appear.

## Scheduled Sync

You can set up a cron job or scheduled task to periodically sync tokens:

```javascript
// Example: Sync every hour
setInterval(async () => {
  await fetch('/api/tokens/sync');
}, 60 * 60 * 1000);
```

Or use a service like Vercel Cron or GitHub Actions to call the sync endpoint periodically.










