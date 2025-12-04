import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/providers';
import { toast } from 'react-toastify';

export type PriceAlert = {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  threshold: number;
  direction: 'above' | 'below';
  interval: number; // minutes
  createdAt: Date;
  triggered?: boolean;
  triggeredAt?: Date;
};

export const usePriceAlerts = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);

  // Listen to price alerts changes
  useEffect(() => {
    if (!user) {
      setAlerts([]);
      return;
    }

    const alertsRef = collection(db, `users/${user.uid}/priceAlerts`);
    const unsubscribe = onSnapshot(alertsRef, (snapshot) => {
      const alertsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        triggeredAt: doc.data().triggeredAt?.toDate(),
      })) as PriceAlert[];
      setAlerts(alertsList);
    }, (error) => {
      console.error('Error listening to price alerts:', error);
    });

    return unsubscribe;
  }, [user]);

  const createAlert = useCallback(async (
    tokenAddress: string,
    tokenSymbol: string,
    threshold: number,
    direction: 'above' | 'below',
    interval: number = 5
  ) => {
    if (!user) {
      toast.error('Please sign in to create price alerts', { position: 'bottom-left' });
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastPath', window.location.pathname);
      }
      window.location.href = '/login';
      return null;
    }

    setLoading(true);
    try {
      // Check if alert already exists for this token and direction
      const existingAlerts = alerts.filter(
        a => a.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() &&
             a.direction === direction &&
             !a.triggered
      );

      if (existingAlerts.length > 0) {
        toast.info('You already have an active alert for this token', { position: 'bottom-left' });
        return null;
      }

      const docRef = await addDoc(collection(db, `users/${user.uid}/priceAlerts`), {
        tokenAddress: tokenAddress.toLowerCase(),
        tokenSymbol,
        threshold,
        direction,
        interval,
        triggered: false,
        createdAt: serverTimestamp(),
      });
      
      toast.success(`Price alert created for ${tokenSymbol}`, { position: 'bottom-left' });
      return docRef.id;
    } catch (err) {
      console.error('Error creating price alert:', err);
      toast.error('Error creating price alert', { position: 'bottom-left' });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, alerts]);

  const deleteAlert = useCallback(async (alertId: string) => {
    if (!user) {
      toast.error('Please sign in to manage alerts', { position: 'bottom-left' });
      return;
    }

    setLoading(true);
    try {
      const alertDocRef = doc(db, `users/${user.uid}/priceAlerts`, alertId);
      await deleteDoc(alertDocRef);
      
      toast.success('Alert deleted', { position: 'bottom-left' });
    } catch (err) {
      console.error('Error deleting alert:', err);
      toast.error('Error deleting alert', { position: 'bottom-left' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const hasActiveAlert = useCallback((tokenAddress: string, direction?: 'above' | 'below') => {
    return alerts.some(
      a => a.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() &&
           !a.triggered &&
           (direction ? a.direction === direction : true)
    );
  }, [alerts]);

  const getAlertsForToken = useCallback((tokenAddress: string) => {
    return alerts.filter(
      a => a.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && !a.triggered
    );
  }, [alerts]);

  return {
    alerts,
    loading,
    createAlert,
    deleteAlert,
    hasActiveAlert,
    getAlertsForToken,
  };
};

