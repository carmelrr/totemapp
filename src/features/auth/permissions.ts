import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase-config';
import { doc, getDoc } from 'firebase/firestore';

export const checkIsAdmin = async () => {
  try {
    const user = auth.currentUser;
    console.log('checkIsAdmin - Current user:', user?.uid, user?.email);
    
    if (!user) {
      console.log('checkIsAdmin - No user logged in');
      return false;
    }
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    console.log('checkIsAdmin - User doc exists:', userDoc.exists());
    
    if (!userDoc.exists()) {
      console.log('checkIsAdmin - User document does not exist');
      return false;
    }
    
    const userData = userDoc.data();
    console.log('checkIsAdmin - User data:', userData);
    console.log('checkIsAdmin - isAdmin field:', userData?.isAdmin);
    
    const isAdmin = userData?.isAdmin === true;
    console.log('checkIsAdmin - Is admin:', isAdmin);
    
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

export const useAdminCheck = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkAdmin = async () => {
      const adminStatus = await checkIsAdmin();
      setIsAdmin(adminStatus);
      setLoading(false);
    };
    
    checkAdmin();
  }, []);
  
  return { isAdmin, loading };
};
