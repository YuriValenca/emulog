import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, query, where,
  getDocs, doc, getDoc, updateDoc,
} from 'firebase/firestore';
import { getOrCreateDeviceId } from '../deviceId';

const SUPERADMIN_UID = process.env.EXPO_PUBLIC_ADMIN_UUID;

const AuthContext = createContext(null);

export function useAppAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAppAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [authUser, setAuthUser]         = useState(null);
  const [companyId, setCompanyId]       = useState(null);
  const [role, setRole]                 = useState(null);
  const [deviceId, setDeviceId]         = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [licenseError, setLicenseError] = useState(null);

  const db = getFirestore();

  useEffect(() => {
    const auth = getAuth();

    const boot = async () => {
      const id = await getOrCreateDeviceId();
      setDeviceId(id);
      console.log('[DeviceID]', id); // remove after testing
    };
    boot();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setCompanyId(null);
        setRole(null);
        setLicenseError(null);
        setInitializing(false);
        return;
      }

      if (user.uid === SUPERADMIN_UID) {
        setAuthUser(user);
        setCompanyId(null);
        setRole('superadmin');
        setLicenseError(null);
        setInitializing(false);
        return;
      }

      try {
        const usersQ = query(collection(db, 'users'), where('uid', '==', user.uid));
        const usersSnap = await getDocs(usersQ);
        if (usersSnap.empty) throw new Error('user-not-found');

        const userData = usersSnap.docs[0].data();
        const cId = userData.companyId;
        const userRole = userData.role ?? 'user';

        const companySnap = await getDoc(doc(db, 'companies', cId));
        if (!companySnap.exists()) throw new Error('company-not-found');

        const companyData = companySnap.data();

        if (!companyData.founding) {
          const did = await getOrCreateDeviceId();
          const licensesRef = collection(db, 'companies', cId, 'licenses');

          const claimedQ = query(licensesRef, where('deviceId', '==', did), where('status', '==', 'active'));
          const claimedSnap = await getDocs(claimedQ);

          if (claimedSnap.empty) {
            const availableQ = query(licensesRef, where('status', '==', 'available'));
            const availableSnap = await getDocs(availableQ);

            if (availableSnap.empty) {
              setLicenseError('no-license');
              setInitializing(false);
              return;
            }

            const licenseDoc = availableSnap.docs[0];
            await updateDoc(licenseDoc.ref, {
              deviceId: did,
              status: 'active',
              claimedAt: new Date().toISOString(),
            });
          }
        }

        setAuthUser(user);
        setCompanyId(cId);
        setRole(userRole);
        setLicenseError(null);
      } catch (e) {
        console.error('[Auth] Bootstrap error:', e.message);
        setLicenseError(e.message);
      } finally {
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{
      authUser,
      companyId,
      role,
      deviceId,
      initializing,
      licenseError,
      isSuperadmin: role === 'superadmin',
      isCompanyAdmin: role === 'companyAdmin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}
