# Firebase Setup Instructions

## Quick Setup Steps

### 1. Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project: `totemapp-464009`
3. Enable these services:
   - **Authentication** → Email/Password
   - **Firestore Database** → Create database
   - **Storage** → Create bucket
   - **Analytics** (optional)

### 2. Security Rules Setup

#### Firestore Rules:

```bash
# Copy content from firestore-security-rules.rules
# Paste in Firebase Console → Firestore → Rules → Publish
```

#### Storage Rules:

```bash
# Copy content from storage-security-rules.rules
# Paste in Firebase Console → Storage → Rules → Publish
```

### 3. Admin Setup (Optional)

Create document in Firestore:

- Path: `admin/admins`
- Field: `userIds` (array) → Add your UID after first login

### 4. App Configuration

The `firebase-config.js` is already updated with your project details:

- Project ID: `totemapp-464009`
- All services configured (Auth, Firestore, Storage, Analytics)

### 5. Run the App

```bash
npm install
npx expo start
```

## Important Notes

- **Storage location**: Your project uses the free `firebasestorage.app` domain
- **Security**: Rules are configured to allow public reads but authenticated writes
- **Analytics**: Enabled for usage tracking (optional)
- **Admin features**: Require manual setup in Firestore admin collection

## Troubleshooting

If you get permission errors:

1. Check that security rules are published
2. Verify authentication is working
3. For admin features, ensure your UID is in `admin/admins` document
