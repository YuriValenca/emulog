import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, query, where,
  getDocs, doc, getDoc, updateDoc, runTransaction,
} from 'firebase/firestore';
import { getOrCreateDeviceId } from '../deviceId';

const SUPERADMIN_UID = process.env.EXPO_PUBLIC_ADMIN_UUID;

const AuthContext = createContext(null);

export function useAppAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAppAuth must be used inside AuthProvider');
  return ctx;
}

async function fetchUserData(db, uid) {
  const q = query(collection(db, 'users'), where('uid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('user-not-found');
  return snap.docs[0].data();
}

async function fetchCompanyData(db, companyId) {
  const snap = await getDoc(doc(db, 'companies', companyId));
  if (!snap.exists()) throw new Error('company-not-found');
  return snap.data();
}

async function claimLicense(db, companyId, deviceId) {
  const licensesRef = collection(db, 'companies', companyId, 'licenses');

  const claimedQ = query(licensesRef, where('deviceId', '==', deviceId), where('status', '==', 'active'));
  const claimedSnap = await getDocs(claimedQ);
  if (!claimedSnap.empty) return;

  const availableQ = query(licensesRef, where('status', '==', 'available'));
  const availableSnap = await getDocs(availableQ);
  if (availableSnap.empty) throw new Error('no-license');

  const licenseRef = availableSnap.docs[0].ref;

  await runTransaction(db, async (tx) => {
    const freshSnap = await tx.get(licenseRef);
    if (!freshSnap.exists() || freshSnap.data()?.status !== 'available') {
      throw new Error('no-license');
    }
    tx.update(licenseRef, {
      deviceId,
      status: 'active',
      claimedAt: new Date().toISOString(),
    });
  });
}

export function AuthProvider({ children }) {
  const [authUser, setAuthUser]         = useState(null);
  const [companyId, setCompanyId]       = useState(null);
  const [uid, setUid]                   = useState(null);
  const [role, setRole]                 = useState(null);
  const [name, setName]                 = useState(null);
  const [deviceId, setDeviceId]         = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [licenseError, setLicenseError] = useState(null);

  const db = getFirestore();

  useEffect(() => {
    const auth = getAuth();

    getOrCreateDeviceId().then((id) => {
      setDeviceId(id);
      console.log('[DeviceID]', id);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setAuthUser(null);
          setCompanyId(null);
          setUid(null);
          setRole(null);
          setLicenseError(null);
          return;
        }

        if (user.uid === SUPERADMIN_UID) {
          setAuthUser(user);
          setCompanyId(null);
          setUid(null);
          setName('Yuri - admin')
          setRole('superadmin');
          setLicenseError(null);
          return;
        }

        const userData = await fetchUserData(db, user.uid);

        if (!userData.companyId) {
          throw new Error('company-not-assigned');
        }

        const companyData = await fetchCompanyData(db, userData.companyId);

        if (!companyData.founding) {
          const did = await getOrCreateDeviceId();
          await claimLicense(db, userData.companyId, did);
        }
        setAuthUser(user);
        setCompanyId(userData.companyId);
        setUid(userData.uid);
        setRole(userData.role ?? 'user');
        setName(userData.nome ?? null)
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
      uid,
      role,
      name,
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
