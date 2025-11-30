# CypherX Protocol - Deployment Checklist

## Pre-Deployment

### 1. Environment Variables
Ensure these environment variables are set in your deployment platform (Vercel, etc.):

#### Firebase Client (Public)
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`

#### Firebase Admin (Server-side - Secret)
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_PRIVATE_KEY` (include full key with newlines escaped as `\n`)

#### Blockchain Configuration
- [ ] `NEXT_PUBLIC_RPC_URL` (Base mainnet RPC - e.g., Alchemy)
- [ ] `NEXT_PUBLIC_BASE_RPC_URL` (fallback: `https://mainnet.base.org`)

#### Treasury Wallet (Server-side - Secret)
- [ ] `TREASURY_PRIVATE_KEY` (for reward claims and fee collection)

#### App URLs
- [ ] `NEXT_PUBLIC_BASE_URL` (your production domain)
- [ ] `NEXT_PUBLIC_APP_URL` (your production domain)

### 2. Firebase Setup
- [ ] Firestore database created with proper rules
- [ ] Firebase Authentication enabled
- [ ] Firebase Storage configured
- [ ] Service account key generated for admin SDK

### 3. Treasury Wallet Setup
- [ ] New treasury wallet created (never use personal wallet)
- [ ] Wallet funded with ETH for gas fees
- [ ] Private key securely stored in environment variables

## Build Verification

```bash
# Run production build locally
npm run build

# If build succeeds with exit code 0, proceed to deployment
```

## Deployment

### Vercel (Recommended)
1. Connect GitHub repository to Vercel
2. Add all environment variables in Vercel dashboard
3. Deploy

### Manual Deployment
```bash
# Build
npm run build

# Start production server
npm start
```

## Post-Deployment Verification

- [ ] Homepage loads correctly
- [ ] Firebase authentication works
- [ ] Wallet creation/import works
- [ ] Swap functionality works
- [ ] Dashboard loads with data
- [ ] Rewards page displays correctly

## Security Notes

⚠️ **NEVER** commit these to version control:
- `.env.local`
- `.env`
- `FIREBASE_PRIVATE_KEY`
- `TREASURY_PRIVATE_KEY`
- Any service account JSON files

## Troubleshooting

### Firebase Admin Errors
If you see "Missing server-side Firebase Admin environment variables":
- Verify `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are set
- Ensure private key newlines are properly escaped

### Treasury Transaction Failures
- Ensure treasury wallet has sufficient ETH for gas
- Verify `TREASURY_PRIVATE_KEY` is correct
- Check RPC endpoint is responsive
