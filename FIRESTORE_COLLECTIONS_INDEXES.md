# Firestore Collections and Indexes for Events Calendar

## Required Collections

### 1. `events` Collection
**Purpose**: Store event proposals and approved events

**Document Structure**:
```typescript
{
  id: string (auto-generated)
  title: string
  description: string
  date: string (format: "yyyy-MM-dd")
  time: string (format: "HH:mm")
  createdBy: string (user UID)
  createdByName?: string
  status: "pending" | "approved" | "rejected"
  createdAt: Timestamp
  reviewedBy?: string (moderator UID)
  reviewedAt?: Timestamp
  rejectionReason?: string
}
```

**Indexes Required**:
- Collection: `events`
  - Fields: `status` (Ascending), `date` (Ascending), `__name__` (Descending)
  - Query scope: Collection
  - Purpose: Query approved events by date

### 2. `eventComments` Collection
**Purpose**: Store comments for events in event rooms

**Document Structure**:
```typescript
{
  id: string (auto-generated)
  eventId: string (reference to events collection)
  userId: string (user UID)
  username: string
  content: string
  createdAt: Timestamp
  likes: string[] (array of user UIDs)
  dislikes: string[] (array of user UIDs)
}
```

**Indexes Required**:
- Collection: `eventComments`
  - Fields: `eventId` (Ascending), `createdAt` (Descending), `__name__` (Descending)
  - Query scope: Collection
  - Purpose: Query comments for a specific event, ordered by creation time

### 3. Existing Collections (No Changes Needed)

#### `users` Collection
- Already exists
- Contains: `points`, `isModerator`, `walletAddress`, `uid`
- Used for: User roles, points tracking, wallet addresses

#### `pointTransactions` Collection
- Already exists
- Used for: Tracking all point transactions (via unified points API)

#### `user_activities` Collection
- Already exists
- Used for: Activity logging (via unified points API)

## Collections to Review/Delete

### Consider Removing:
- `eventProposals` - **DELETE** (replaced by `events` collection with status field)
- `projectEvents` - **REVIEW** (may be legacy, check if still in use)

## Required Indexes Summary

### Composite Indexes Needed:

1. **events collection**:
   ```
   Collection: events
   Fields: status (Ascending), date (Ascending), __name__ (Descending)
   Query scope: Collection
   ```

2. **eventComments collection**:
   ```
   Collection: eventComments
   Fields: eventId (Ascending), createdAt (Descending), __name__ (Descending)
   Query scope: Collection
   ```

## Firestore Security Rules

Add these rules to `firestore.rules`:

```javascript
// Events collection
match /events/{eventId} {
  allow read: if true; // Anyone can read events
  allow create: if request.auth != null && 
                   request.resource.data.createdBy == request.auth.uid;
  allow update: if request.auth != null && (
                   // Creator can update pending events
                   (resource.data.createdBy == request.auth.uid && 
                    resource.data.status == 'pending') ||
                   // Moderators can approve/reject
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isModerator == true
                 );
  allow delete: if request.auth != null && 
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isModerator == true;
}

// Event comments collection
match /eventComments/{commentId} {
  allow read: if true; // Anyone can read comments
  allow create: if request.auth != null && 
                   request.resource.data.userId == request.auth.uid;
  allow update: if request.auth != null && (
                   // User can update their own comments
                   resource.data.userId == request.auth.uid ||
                   // Moderators can update any comment
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isModerator == true
                 );
  allow delete: if request.auth != null && (
                   resource.data.userId == request.auth.uid ||
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isModerator == true
                 );
}
```

## Migration Steps

1. **Create new collections**:
   - `events` (if doesn't exist)
   - `eventComments` (new)

2. **Create indexes**:
   - Use Firebase Console → Firestore → Indexes tab
   - Add the two composite indexes listed above

3. **Update security rules**:
   - Add rules for `events` and `eventComments` collections

4. **Clean up old collections** (if needed):
   - Archive or delete `eventProposals` if it exists and is no longer used
   - Review `projectEvents` collection usage

5. **Test queries**:
   - Verify queries work with new indexes
   - Test moderation functionality
   - Test comment posting

## Unified Points System Integration

The events calendar uses the existing unified points system:
- **API Endpoint**: `/api/points/earn`
- **Action for approved event**: `event_proposal_approved` (50 points)
- **Action for commenting**: `comment_article` (5 points) - reusing existing action
- **Point tracking**: Automatically logged in `pointTransactions` and `user_activities` collections











