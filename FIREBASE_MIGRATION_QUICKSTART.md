# Firebase Migration Quick Start Guide

## 🚀 Quick Setup

### 1. Service Account (Already Done ✅)
The service account key has been saved to `firebaseServiceAccount.json`.

**⚠️ SECURITY WARNING:**
- This file contains sensitive credentials
- It's already added to `.gitignore`
- **DO NOT commit this file to git!**

### 2. Remove Old Collections (Optional)

```bash
npm run firebase:remove-old
```

**⚠️ This will DELETE the `test` collection!**

### 3. Create New Collections and Indexes

```bash
npm run firebase:create-collections
```

This will:
- Create sample documents in new collections
- Print index definitions you need to create

### 4. Deploy Indexes

You have two options:

#### Option A: Firebase Console (Recommended)
1. Open: https://console.firebase.google.com/project/homebase-dapp/firestore/indexes
2. Follow the prompts from the script output
3. Click "Add index" for each index listed

#### Option B: Firebase CLI
```bash
npm run firebase:deploy-indexes
```

This deploys indexes from `firestore.indexes.json`.

## 📋 Collections Created

### `wallet_orders`
Trading orders (buy/sell/swap)
- Orders by wallet, status, type
- Supports limit orders, market orders

### `wallet_positions`
Open trading positions
- Track entry price, current price
- Calculate unrealized PnL

### `wallet_transactions`
Transaction history
- All wallet transactions
- Track buys, sells, swaps, transfers

### `user_wallet_data`
User-wallet linkage
- Link multiple wallets to users
- Verify wallet ownership
- Track primary wallet

## 🔧 Next Steps

1. ✅ Collections created
2. ✅ Indexes defined
3. 📝 Create API endpoints:
   - `/api/orders` - Create/get orders
   - `/api/positions` - Get positions
   - `/api/wallet/verify` - Verify wallet ownership
   - `/api/wallet/link` - Link wallet to user
4. 📝 Add real-time listeners for orders/positions
5. 📝 Build UI components for orders/positions display

## 📚 Type Definitions

See `types/firestore.ts` for TypeScript interfaces:
- `WalletOrder`
- `WalletPosition`
- `WalletTransaction`
- `UserWalletData`

## 🆘 Troubleshooting

### "Firebase Admin initialization failed"
✅ Service account file exists - this should work!

### "Collection not found"
- Collections are created lazily
- Scripts create sample documents to establish them

### Index creation is slow
- Index creation can take 5-10 minutes
- Check status in Firebase Console

## 📖 Full Documentation

See `scripts/README.md` for detailed documentation.






