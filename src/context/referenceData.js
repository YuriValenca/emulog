import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { normalizarCalibragem } from '../helpers/calibragem';
import { lerCalibragemDoAparelho, guardarCalibragemNoAparelho } from '../calibragemLocal';

const ReferenceDataContext = createContext(null);

const keyCaminhoes = (companyId) => `cachedCaminhoes:${companyId}`;
const keyOperadores = (companyId) => `cachedOperadores:${companyId}`;
const keyClientes = (companyId) => `cachedClientes:${companyId}`;

export function ReferenceDataProvider({ children }) {
  const [caminhoes, setCaminhoes] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [ultimaCalibragem, setUltimaCalibragem] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const hydratedCompanyId = useRef(null);

  const hydrateFromStorage = useCallback(async (companyId) => {
    if (!companyId) return;
    try {
      const [cStr, oStr, clStr, calibragem] = await Promise.all([
        AsyncStorage.getItem(keyCaminhoes(companyId)),
        AsyncStorage.getItem(keyOperadores(companyId)),
        AsyncStorage.getItem(keyClientes(companyId)),
        lerCalibragemDoAparelho(companyId),
      ]);
      setCaminhoes(cStr ? JSON.parse(cStr) : []);
      setOperadores(oStr ? JSON.parse(oStr) : []);
      setClientes(clStr ? JSON.parse(clStr) : []);
      setUltimaCalibragem(calibragem);
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
      const qClientes = query(collection(db, 'clientes'), where('companyId', '==', companyId));
      const qCalibragem = query(
        collection(db, 'calibragens'),
        where('companyId', '==', companyId),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const [snapC, snapO, snapCl, snapCal] = await Promise.all([
        getDocs(qCaminhoes),
        getDocs(qOperadores),
        getDocs(qClientes),
        getDocs(qCalibragem),
      ]);

      const listaCaminhoes = snapC.docs.map(d => ({ id: d.id, ...d.data() }));
      const listaOperadores = snapO.docs.map(d => ({ id: d.id, ...d.data() }));
      const listaClientes = snapCl.docs.map(d => ({ id: d.id, ...d.data() }));

      setCaminhoes(listaCaminhoes);
      setOperadores(listaOperadores);
      setClientes(listaClientes);

      const storagePromises = [
        AsyncStorage.setItem(keyCaminhoes(companyId), JSON.stringify(listaCaminhoes)),
        AsyncStorage.setItem(keyOperadores(companyId), JSON.stringify(listaOperadores)),
        AsyncStorage.setItem(keyClientes(companyId), JSON.stringify(listaClientes)),
      ];

      if (!snapCal.empty) {
        const calibragemNormalizada = normalizarCalibragem(snapCal.docs[0].data());
        setUltimaCalibragem(calibragemNormalizada);
        storagePromises.push(guardarCalibragemNoAparelho(companyId, calibragemNormalizada));
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
      value={{
        caminhoes, operadores, clientes,
        ultimaCalibragem, setUltimaCalibragem,
        isSyncing, lastSyncedAt, syncReferenceData,
      }}
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
