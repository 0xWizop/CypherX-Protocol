# Firebase Admin SDK Permissions Fix

## Problem
The live app is experiencing 401 Unauthorized and 500 Internal Server Errors for API routes that use Firebase Admin SDK:
- `/api/rewards`
- `/api/rewards/referral`
- `/api/rewards/claim`
- `/api/tiers`
- `/api/author/status`
- `/api/stats/tokens`
- `/api/stats/active-users`

## Root Cause
Firebase Admin SDK bypasses Firestore security rules but still requires **IAM permissions** in Google Cloud Console. The service account needs proper roles to access Firestore.

## Solution

### Step 1: Find Your Service Account Email

**Option A: From firebaseServiceAccount.json**
```bash
# Check the client_email field
cat firebaseServiceAccount.json | grep client_email
```

**Option B: From Firebase Console**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Find the service account email (usually ends with `@<project-id>.iam.gserviceaccount.com`)

### Step 2: Grant IAM Permissions in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **IAM & Admin** → **IAM**
4. Find your service account email (from Step 1)
5. Click **Edit** (pencil icon)
6. Click **ADD ANOTHER ROLE**
7. Add one of these roles:
   - **Cloud Datastore User** (Recommended - read/write access to Firestore)
   - **Firestore Admin** (Full access - use if you need more control)
8. Click **SAVE**
9. Wait 2-5 minutes for changes to propagate

### Step 3: Verify Environment Variables (Production)

Ensure these are set in your production environment:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Or ensure `firebaseServiceAccount.json` is available in your production environment.

### Step 4: Test the Fix

Run the verification script:
```bash
npx tsx scripts/verify-firebase-admin.ts
```

Or test an API endpoint:
```bash
curl https://your-domain.com/api/stats/tokens
```

## What Was Fixed in Code

I've added comprehensive error handling to all critical API routes:
- ✅ `/api/rewards/route.ts`
- ✅ `/api/rewards/referral/route.ts`
- ✅ `/api/rewards/claim/route.ts`
- ✅ `/api/tiers/route.ts`
- ✅ `/api/tokens/route.ts`
- ✅ `/api/author/status/route.ts` (already had good error handling)

All routes now:
- Catch Firebase Admin initialization errors
- Return clear error messages
- Log detailed error information for debugging

## Verification Script

A verification script has been created at `scripts/verify-firebase-admin.ts` that will:
- Check environment variables
- Check service account file
- Test Firebase Admin initialization
- Test database read operations
- Detect permission errors and provide guidance

## Still Having Issues?

If you're still getting errors after granting IAM permissions:

1. **Wait 5-10 minutes** - IAM changes can take time to propagate
2. **Check service account email** - Make sure you're granting permissions to the correct account
3. **Check project ID** - Ensure the service account belongs to the correct Firebase project
4. **Check logs** - Look at your production logs for detailed error messages
5. **Run verification script** - Use `scripts/verify-firebase-admin.ts` to diagnose

## Additional Resources

- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)
- [Google Cloud IAM Roles](https://cloud.google.com/iam/docs/understanding-roles)
- [Firestore IAM Permissions](https://cloud.google.com/firestore/docs/security/iam)





