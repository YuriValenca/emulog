import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

const ReferenceDataContext = createContext(null);

const keyCaminhoes = (companyId) => `cachedCaminhoes:${companyId}`;
const keyOperadores = (companyId) => `cachedOperadores:${companyId}`;
const KEY_ULTIMA_CALIBRAGEM = 'ultimaCalibragem'; // mesma chave já usada no app, não prefixada

export function ReferenceDataProvider({ children }) {
  const [caminhoes, setCaminhoes] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [ultimaCalibragem, setUltimaCalibragem] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const hydratedCompanyId = useRef(null);

  const hydrateFromStorage = useCallback(async (companyId) => {
    if (!companyId) return;
    try {
      const [cStr, oStr, calStr] = await Promise.all([
        AsyncStorage.getItem(keyCaminhoes(companyId)),
        AsyncStorage.getItem(keyOperadores(companyId)),
        AsyncStorage.getItem(KEY_ULTIMA_CALIBRAGEM),
      ]);
      setCaminhoes(cStr ? JSON.parse(cStr) : []);
      setOperadores(oStr ? JSON.parse(oStr) : []);
      if (calStr) {
        const cal = JSON.parse(calStr);
        setUltimaCalibragem({ ...cal, timestamp: new Date(cal.timestamp) });
      } else {
        setUltimaCalibragem(null);
      }
    } catch (e) {
      console.warn('Erro ao hidratar dados de referência do storage:', e);
    } finally {
      hydratedCompanyId.current = companyId;
    }
  }, []);

  const syncReferenceData = useCallback(async (companyId) => {
    if (!companyId) return;

    if (hydratedCompanyId.current !== companyId) {
      await hydrateFromStorage(companyId);
    }

    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) return;

      setIsSyncing(true);
      const db = getFirestore();

      const qCaminhoes = query(collection(db, 'caminhoes'), where('companyId', '==', companyId));
      const qOperadores = query(collection(db, 'operadores'), where('companyId', '==', companyId));
      const qCalibragem = query(
        collection(db, 'calibragens'),
        where('companyId', '==', companyId),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const [snapC, snapO, snapCal] = await Promise.all([
        getDocs(qCaminhoes),
        getDocs(qOperadores),
        getDocs(qCalibragem),
      ]);

      const listaCaminhoes = snapC.docs.map(d => ({ id: d.id, ...d.data() }));
      const listaOperadores = snapO.docs.map(d => ({ id: d.id, ...d.data() }));

      setCaminhoes(listaCaminhoes);
      setOperadores(listaOperadores);

      const storagePromises = [
        AsyncStorage.setItem(keyCaminhoes(companyId), JSON.stringify(listaCaminhoes)),
        AsyncStorage.setItem(keyOperadores(companyId), JSON.stringify(listaOperadores)),
      ];

      if (!snapCal.empty) {
        const calDoc = snapCal.docs[0].data();
        const ts = calDoc.timestamp?.seconds
          ? new Date(calDoc.timestamp.seconds * 1000 + calDoc.timestamp.nanoseconds / 1000000)
          : new Date(calDoc.timestamp);
        const calData = {
          tara: calDoc.tara,
          pesoCheio: calDoc.pesoCheio,
          pesoVazio: calDoc.pesoVazio,
          timestamp: ts,
        };
        setUltimaCalibragem(calData);
        storagePromises.push(
          AsyncStorage.setItem(KEY_ULTIMA_CALIBRAGEM, JSON.stringify({
            ...calData,
            timestamp: ts.toISOString(),
          }))
        );
      }

      setLastSyncedAt(new Date());
      await Promise.all(storagePromises);
    } catch (e) {
      console.warn('Erro ao sincronizar dados de referência:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [hydrateFromStorage]);

  return (
    <ReferenceDataContext.Provider
      value={{ caminhoes, operadores, ultimaCalibragem, setUltimaCalibragem, isSyncing, lastSyncedAt, syncReferenceData }}
    >
      {children}
    </ReferenceDataContext.Provider>
  );
}

export function useReferenceData() {
  const ctx = useContext(ReferenceDataContext);
  if (!ctx) throw new Error('useReferenceData deve ser usado dentro de ReferenceDataProvider');
  return ctx;
}
