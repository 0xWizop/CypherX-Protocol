# Referral & Cashback System Setup

## Overview
This document describes the referral and cashback system integration with wallet addresses and user accounts.

## Architecture

### Collections Used
1. **users** - User accounts with points, tier, referral info
2. **rewards** - User rewards data (cashback, referral earnings)
3. **referrals** - Referral relationships (referrer → referee)
4. **referralCodes** - Quick lookup for referral codes → userId
5. **user_wallet_data** - Links wallet addresses to user accounts
6. **wallet_orders** - Trading orders (already exists)
7. **wallet_transactions** - Transaction history (already exists)
8. **wallet_positions** - Open positions (already exists)

### Flow

#### 1. Wallet Linking
- **API**: `POST /api/wallet/link` - Link wallet to user account
- **API**: `GET /api/wallet/link?walletAddress=0x...` - Get user for wallet
- **Collection**: `user_wallet_data`
  - Stores: `userId`, `walletAddress`, `isPrimary`, `isVerified`, `isActive`

#### 2. Swap Processing (with Rewards)
When a swap is saved via `/api/orders/save`:
1. Order/Position saved to Firebase (existing flow)
2. **NEW**: Lookup user by wallet address
3. **NEW**: Calculate cashback based on tier:
   - Normie: 5% of remaining platform fee (after 0x protocol fee)
   - Degen: 10% of remaining platform fee
   - Alpha: 15% of remaining platform fee
   - Mogul: 20% of remaining platform fee
   - Titan: 25% of remaining platform fee
4. **NEW**: Process referral rewards (30% of remaining platform fee to referrer)
5. **NEW**: Update user points (0.1 points per $1 traded)
6. **NEW**: Update tier if points threshold crossed

#### 3. Referral System
- Users get a unique `referralCode` in `rewards` collection
- Referral code also stored in `referralCodes` collection for fast lookup
- When user signs up with referral code → creates record in `referrals` collection
- When referred user swaps → referrer gets 30% of platform fee

## Cashback Rates by Tier

| Tier | Points Required | Cashback Rate |
|------|----------------|---------------|
| Normie | 0-1,999 | 5% of remaining fee |
| Degen | 2,000-7,999 | 10% of remaining fee |
| Alpha | 8,000-19,999 | 15% of remaining fee |
| Mogul | 20,000-49,999 | 20% of remaining fee |
| Titan | 50,000+ | 25% of remaining fee |

### Fee Structure
- **Platform Fee**: `swapValueUSD × 0.0075` (0.75%)
- **0x Protocol Fee**: `swapValueUSD × 0.0015` (0.15% - deducted from platform fee)
- **Remaining Fee**: `platformFee - protocolFee` (0.60% available for cashback/referrals)

*Cashback is calculated as: `remainingFee × cashbackRate`*

## Referral Rewards

- **Referrer gets**: 30% of referee's remaining platform fee (after 0x protocol fee)
- **Referee gets**: $10 bonus on first trade (if eligible)

## Required Firebase Indexes

The following indexes need to be created in Firebase Console:

1. **user_wallet_data**:
   - `walletAddress` (ASC) + `isActive` (ASC) + `__name__` (DESC)

2. **users**:
   - `walletAddress` (ASC) + `__name__` (DESC)

3. **referrals** (if not already exists):
   - `referrerId` (ASC) + `timestamp` (DESC) + `__name__` (DESC)
   - `refereeId` (ASC) + `timestamp` (DESC) + `__name__` (DESC)

## Files Created/Modified

### New Files:
- `app/api/wallet/link/route.ts` - Wallet linking API
- `lib/rewards-utils.ts` - Helper functions for rewards

### Modified Files:
- `app/api/orders/save/route.ts` - Integrated cashback/referral processing
- `firestore.indexes.json` - Added required indexes

## Testing Checklist

1. ✅ Link wallet to user account
2. ✅ Make swap with linked wallet → verify cashback calculated
3. ✅ Make swap with referred user → verify referrer gets reward
4. ✅ Verify points increase after swap
5. ✅ Verify tier upgrades when points threshold reached
6. ✅ Test with unlinked wallet (should skip rewards gracefully)

## Next Steps

1. Deploy Firebase indexes: `firebase deploy --only firestore:indexes`
2. Test wallet linking flow
3. Test swap with rewards
4. Monitor logs for reward processing

