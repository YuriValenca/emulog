import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where,
  getDocs, doc, getDoc, runTransaction,
  updateDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig'
import { getOrCreateDeviceId } from '../deviceId';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function useAppAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAppAuth must be used inside AuthProvider');
  return ctx;
}

async function fetchUserData(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) throw new Error('user-not-found');
  return snap.data();
}

async function fetchCompanyData(companyId) {
  const snap = await getDoc(doc(db, 'companies', companyId));
  if (!snap.exists()) throw new Error('company-not-found');
  return snap.data();
}

function computeExpiryDate(validityMonths) {
  if (validityMonths === 'vitalicia') return null;
  const expDate = new Date();
  if (validityMonths === '1min') {
    expDate.setMinutes(expDate.getMinutes() + 1);
  } else {
    expDate.setMonth(expDate.getMonth() + Number(validityMonths));
  }
  return expDate;
}

async function claimLicense(companyId, deviceId) {
  const licensesRef = collection(db, 'companies', companyId, 'licenses');

  const claimedQ = query(licensesRef, where('deviceId', '==', deviceId), where('status', '==', 'active'));
  const claimedSnap = await getDocs(claimedQ);

  if (!claimedSnap.empty) {
    const licenca = claimedSnap.docs[0];
    const expiresAt = licenca.data()?.expiresAt;
    const agora = new Date();
    const expirou = expiresAt && new Date(expiresAt.seconds * 1000) < agora;

    if (expirou) {
      await updateDoc(licenca.ref, { status: 'expired' });
    } else {
      return;
    }
  }

  const availableQ = query(licensesRef, where('status', '==', 'available'));
  const availableSnap = await getDocs(availableQ);
  if (availableSnap.empty) throw new Error('no-license');

  const licenseRef = availableSnap.docs[0].ref;
  const licenseData = availableSnap.docs[0].data();

  const validityMonths = licenseData.validityMonths ?? 12;
  const expiryDate = computeExpiryDate(validityMonths);
  const expiresAt = expiryDate ? Timestamp.fromDate(expiryDate) : null;

  await runTransaction(db, async (tx) => {
    const freshSnap = await tx.get(licenseRef);
    if (!freshSnap.exists() || freshSnap.data()?.status !== 'available') {
      throw new Error('no-license');
    }
    tx.update(licenseRef, {
      deviceId,
      status: 'active',
      claimedAt: new Date().toISOString(),
      expiresAt,
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
  const [companyLogo, setCompanyLogo] = useState(null);

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

        const userData = await fetchUserData(user.uid);
        const isSuperadmin = userData.role === 'superadmin';

        if (!isSuperadmin && !userData.companyId) throw new Error('company-not-assigned');

        let companyData = null;
        if (userData.companyId) {
          companyData = await fetchCompanyData(userData.companyId);

          if (!companyData.founding) {
            const did = await getOrCreateDeviceId();
            await claimLicense(userData.companyId, did);
          }

          if (companyData.logo) {
            await AsyncStorage.setItem('cachedCompanyLogo', companyData.logo);
          } else {
            await AsyncStorage.removeItem('cachedCompanyLogo');
          }
        }

        setAuthUser(user);
        setCompanyId(userData.companyId ?? null);
        setUid(userData.uid);
        setRole(userData.role ?? 'user');
        setName(userData.nome ?? null);
        setDebugError(null);
        setAuthStatus('authenticated');
        setCompanyLogo(companyData?.logo ?? null);
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
      companyLogo,
      isSuperadmin: role === 'superadmin',
      isCompanyAdmin: role === 'company_admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}
