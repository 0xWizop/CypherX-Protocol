# Firebase Migration Scripts

This directory contains scripts for managing Firebase Firestore collections and indexes for orders, positions, and wallet tracking.

## ⚠️ IMPORTANT SECURITY NOTES

1. **DO NOT commit `firebaseServiceAccount.json` to git!**
2. Add `firebaseServiceAccount.json` to `.gitignore` if not already present
3. Use environment variables for production deployments
4. Keep your service account key secure

## Prerequisites

1. Firebase Admin SDK credentials (service account key)
2. Node.js installed
3. Firebase CLI installed (optional, for deploying indexes)

## Setup

### Step 1: Save Service Account Key

You have two options:

#### Option A: Save to JSON file (Development)
```bash
# Save the service account JSON to firebaseServiceAccount.json manually
# OR use the setup script:
FIREBASE_SERVICE_ACCOUNT='{...}' npm run firebase:setup-service
```

#### Option B: Use Environment Variables (Production)
Add to your `.env` file:
```env
FIREBASE_PROJECT_ID=homebase-dapp
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@homebase-dapp.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### Step 2: Remove Old Collections (Optional)

**⚠️ WARNING: This will DELETE data!**

```bash
npm run firebase:remove-old
```

This script will remove:
- `test` collection (test data)

**Edit `scripts/remove-old-collections.js` to customize which collections to remove.**

### Step 3: Create New Collections and Indexes

```bash
npm run firebase:create-collections
```

This script will:
- Create sample documents to establish collection structure
- Print the indexes that need to be created

### Step 4: Deploy Indexes

#### Option A: Using Firebase Console (Recommended for first time)
1. Go to: https://console.firebase.google.com/project/homebase-dapp/firestore/indexes
2. Click "Add index"
3. Follow the prompts from the script output

#### Option B: Using Firebase CLI
```bash
npm run firebase:deploy-indexes
```

This will deploy indexes defined in `firestore.indexes.json`.

## Scripts Overview

### `setup-service-account.js`
Creates `firebaseServiceAccount.json` from environment variables.

**Usage:**
```bash
FIREBASE_SERVICE_ACCOUNT='{...}' npm run firebase:setup-service
```

### `remove-old-collections.js`
Removes old/unused collections from Firestore.

**⚠️ WARNING: This deletes data!**

**Usage:**
```bash
npm run firebase:remove-old
```

### `create-collections-and-indexes.js`
Creates new collections and prepares index definitions.

**Usage:**
```bash
npm run firebase:create-collections
```

## Collections Created

### `wallet_orders`
Stores trading orders (buy, sell, swap).

**Indexes:**
- `walletAddress` + `status` + `createdAt`
- `walletAddress` + `type` + `timestamp`
- `tokenAddress` + `timestamp`

### `wallet_positions`
Stores open trading positions.

**Indexes:**
- `walletAddress` + `tokenAddress` + `updatedAt`
- `walletAddress` + `isOpen` + `openedAt`

### `wallet_transactions`
Stores transaction history.

**Indexes:**
- `walletAddress` + `timestamp`
- `walletAddress` + `type` + `timestamp`
- `outputToken` + `type` + `walletAddress` + `timestamp`
- `walletAddress` (desc) + `timestamp`

### `user_wallet_data`
Stores user-wallet linkage and tracking.

**Indexes:**
- `userId` + `linkedAt`
- `walletAddress` + `isVerified`
- `userId` + `isPrimary`

## Type Definitions

Type definitions are available in `types/firestore.ts`:

- `WalletOrder`
- `WalletPosition`
- `WalletTransaction`
- `UserWalletData`

## Troubleshooting

### "Firebase Admin initialization failed"
- Ensure `firebaseServiceAccount.json` exists in project root
- OR set environment variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Check that the service account has proper permissions

### "Collection not found"
- Collections are created lazily when first document is written
- The scripts create sample documents to establish collections

### Index creation fails
- Some indexes may already exist
- Check Firebase Console for existing indexes
- Index creation can take several minutes

## Next Steps

After running these scripts:

1. ✅ Collections are established
2. ✅ Indexes are defined (need to be created)
3. ✅ Type definitions are ready
4. 📝 Build API endpoints for orders, positions, wallet tracking
5. 📝 Implement wallet verification
6. 📝 Add real-time listeners for orders/positions











