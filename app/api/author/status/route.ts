import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    let db;
    try {
      db = adminDb();
    } catch (error) {
      console.error('Database connection failed:', error);
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Check if user is an approved author
    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress.toLowerCase());
    const userSnapshot = await userQuery.get();

    if (userSnapshot.empty) {
      return NextResponse.json({ isAuthor: false });
    }

    const userData = userSnapshot.docs[0].data();
    const isAuthor = userData?.isAuthor === true;

    return NextResponse.json({
      isAuthor,
      authorData: isAuthor ? {
        twitterHandle: userData.twitterHandle,
        alias: userData.alias,
        bio: userData.bio,
        topics: userData.topics,
        approvedAt: userData.approvedAt
      } : null
    });

  } catch (error) {
    console.error('Error checking author status:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: 'An error occurred while checking author status'
    }, { status: 500 });
  }
}
