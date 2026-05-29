import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, query, where,
  getDocs, doc, getDoc, runTransaction,
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
  const [authUser, setAuthUser]       = useState(null);
  const [authStatus, setAuthStatus]   = useState('loading');
  const [debugError, setDebugError]   = useState(null);
  const [companyId, setCompanyId]     = useState(null);
  const [uid, setUid]                 = useState(null);
  const [role, setRole]               = useState(null);
  const [name, setName]               = useState(null);
  const [deviceId, setDeviceId]       = useState(null);

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
          setName(null);
          setDebugError(null);
          setAuthStatus('unauthenticated');
          return;
        }

        if (user.uid === SUPERADMIN_UID) {
          setAuthUser(user);
          setCompanyId(null);
          setUid(user.uid);
          setName('Yuri - admin');
          setRole('superadmin');
          setDebugError(null);
          setAuthStatus('authenticated');
          return;
        }

        const userData = await fetchUserData(db, user.uid);

        if (!userData.companyId) throw new Error('company-not-assigned');

        const companyData = await fetchCompanyData(db, userData.companyId);

        if (!companyData.founding) {
          const did = await getOrCreateDeviceId();
          await claimLicense(db, userData.companyId, did);
        }

        setAuthUser(user);
        setCompanyId(userData.companyId);
        setUid(userData.uid);
        setRole(userData.role ?? 'user');
        setName(userData.nome ?? null);
        setDebugError(null);
        setAuthStatus('authenticated');
      } catch (e) {
        console.error('[Auth] Bootstrap error:', e.message);
        setDebugError(e.message);

        if (e.message === 'no-license') {
          setAuthStatus('no-license');
        } else if (
          e.message === 'user-not-found' ||
          e.message === 'company-not-found' ||
          e.message === 'company-not-assigned'
        ) {
          setAuthStatus('config-error');
        } else {
          setAuthStatus('error');
        }
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{
      authUser,
      authStatus,
      debugError,
      companyId,
      uid,
      role,
      name,
      deviceId,
      isSuperadmin: role === 'superadmin',
      isCompanyAdmin: role === 'companyAdmin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}
