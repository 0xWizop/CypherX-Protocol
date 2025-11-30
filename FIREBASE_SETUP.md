# Firebase Setup Guide

## Environment Variables Required

To fix the Firebase authentication errors, you need to set the following environment variables in your deployment platform (Vercel, Firebase Hosting, etc.):

### Client-Side Variables (NEXT_PUBLIC_*)

These are exposed to the browser and must be set:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### How to Get These Values

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Click the gear icon ⚙️ next to "Project Overview"
4. Select "Project settings"
5. Scroll down to "Your apps" section
6. If you don't have a web app, click "Add app" and select the web icon (</>)
7. Copy the config values from the `firebaseConfig` object

### Example Firebase Config

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

### Setting Environment Variables

#### For Vercel:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add each variable with the `NEXT_PUBLIC_` prefix
4. Redeploy your application

#### For Firebase Hosting:
1. Use Firebase CLI: `firebase functions:config:set`
2. Or set in Firebase Console under Functions > Configuration

#### For Local Development:
Create a `.env.local` file in your project root:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Important**: Never commit `.env.local` to git! It should be in `.gitignore`.

### Server-Side Variables (Private)

For server-side operations, you also need:

```bash
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY=your_service_account_private_key
```

These are obtained from:
1. Firebase Console > Project Settings > Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract the values from the JSON

### Content Security Policy

The CSP has been updated to allow Google Sign-In. If you still see CSP errors, make sure your deployment platform isn't adding additional CSP headers.

### Testing

After setting environment variables:
1. Restart your development server
2. Clear browser cache
3. Try Google Sign-In again
4. Check browser console for any remaining errors

### Troubleshooting

**Error: "Missing required Firebase environment variables"**
- Make sure all `NEXT_PUBLIC_*` variables are set
- Restart your dev server after adding variables
- Check that variable names are exactly correct (case-sensitive)

**Error: "Content Security Policy blocked"**
- The CSP has been updated in `next.config.ts`
- Make sure you're not overriding CSP in your deployment platform
- Check browser console for specific CSP violations

**Error: "auth/internal-error"**
- Usually caused by CSP blocking Google scripts
- Check that `apis.google.com` is allowed in CSP
- Verify Firebase config values are correct

**Error: "auth/unauthorized-domain"**
- Go to Firebase Console > Authentication > Settings > Authorized domains
- Add your domain (localhost for dev, your production domain for prod)







