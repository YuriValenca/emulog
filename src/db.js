import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from "@react-native-community/netinfo";
import { db } from './firebaseConfig';
import { collection, doc, Timestamp, writeBatch } from 'firebase/firestore';
import { Alert } from 'react-native';
import { sincronizarRascunhosDaUltimaSessao } from './rascunhos';

export const saveProjectOffline = async (project) => {
  try {
    const offlineProjects = await getOfflineProjects();
    const projectWithId = { ...project, _localId: Date.now().toString() };
    offlineProjects.push(projectWithId);
    await AsyncStorage.setItem('offlineProjects', JSON.stringify(offlineProjects));
    console.log('Projeto salvo offline:', projectWithId);
  } catch (error) {
    console.error('Erro ao salvar projeto offline:', error);
  }
};

export const getOfflineProjects = async () => {
  try {
    const projects = await AsyncStorage.getItem('offlineProjects');
    return projects ? JSON.parse(projects) : [];
  } catch (error) {
    console.error('Erro ao obter projetos offline:', error);
    return [];
  }
};

export const clearOfflineProjects = async () => {
  try {
    await AsyncStorage.removeItem('offlineProjects');
    console.log('Projetos offline limpos após sincronização.');
  } catch (error) {
    console.error('Erro ao limpar projetos offline:', error);
  }
};

const removeOfflineProject = async (localId) => {
  try {
    const offlineProjects = await getOfflineProjects();
    const updated = offlineProjects.filter(p => p._localId !== localId);
    await AsyncStorage.setItem('offlineProjects', JSON.stringify(updated));
  } catch (error) {
    console.error('Erro ao remover projeto offline:', error);
  }
};

const paraTimestamp = (valor) => (valor ? Timestamp.fromDate(new Date(valor)) : valor);

async function salvarProjetoSincronizado({ id, ...projeto }, meta) {
  // Projetos salvos offline antes dos rascunhos não têm id
  const idDoProjeto = id || doc(collection(db, 'projetos')).id;
  const batch = writeBatch(db);
  batch.set(doc(db, 'projetos', idDoProjeto), projeto);
  batch.set(doc(db, 'projetos_meta', idDoProjeto), meta);
  await batch.commit();
}

let isSyncing = false;

export const syncProjects = async () => {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const offlineProjects = await getOfflineProjects();
    if (!offlineProjects.length) {
      console.log('Nenhum projeto offline para sincronizar.');
      return;
    }

    for (const project of offlineProjects) {
      console.log('[sync] companyId on project being synced:', project.companyId);

      const { _localId, ...projectSemLocalId } = project;

      const dataCriacaoTimestamp = paraTimestamp(projectSemLocalId.dataCriacao);
      const projectParaSalvar = {
        ...projectSemLocalId,
        dataCriacao: dataCriacaoTimestamp,
        ...(projectSemLocalId.dataConclusao && { dataConclusao: paraTimestamp(projectSemLocalId.dataConclusao) }),
        calibragem: projectSemLocalId.calibragem
          ? { ...projectSemLocalId.calibragem, timestamp: paraTimestamp(projectSemLocalId.calibragem.timestamp) }
          : projectSemLocalId.calibragem,
      };
      const meta = {
        nomeProjeto: projectSemLocalId.nomeProjeto,
        dataCriacao: dataCriacaoTimestamp,
        uidUsuario: projectSemLocalId.uidUsuario,
        companyId: projectSemLocalId.companyId,
      };

      await salvarProjetoSincronizado(projectParaSalvar, meta);
      await removeOfflineProject(_localId);
      console.log('Projeto sincronizado com Firestore:', projectSemLocalId);
    }

    Alert.alert("Sincronização", "Projetos salvos na nuvem com sucesso!");
  } catch (error) {
    console.error('Erro ao sincronizar projetos:', error);
  } finally {
    isSyncing = false;
  }
};

let isListenerSet = false;
let estavaOnline = null;

// Mesmo critério do estaOnline: Wi-Fi sem internet não conta como reconexão
const estadoOnline = (state) => !!state.isConnected && state.isInternetReachable !== false;

export const checkConnectionAndSync = () => {
  if (isListenerSet) return;
  isListenerSet = true;

  NetInfo.addEventListener(async state => {
    const estaOnlineAgora = estadoOnline(state);
    if (estaOnlineAgora && estavaOnline === false) {
      console.log('Dispositivo reconectou, sincronizando...');
      await syncProjects();
      await sincronizarRascunhosDaUltimaSessao();
    }
    estavaOnline = estaOnlineAgora;
  });
};
