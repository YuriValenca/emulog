import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from "@react-native-community/netinfo";
import { db, auth } from './firebaseConfig';
import { collection, doc, getDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { Alert } from 'react-native';
import { estaOnline, comTempoLimite } from './helpers/rede';
import { sincronizarRascunhosDaUltimaSessao } from './rascunhos';
import { sincronizarMidiasDaUltimaSessao } from './midias';
import { sincronizarCalibragensPendentes } from './calibragensPendentes';
import { sincronizarInformacoesPendentes } from './informacoesPendentes';

const TEMPO_LIMITE_FIRESTORE_MS = 15000;

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

async function salvarProjetoSincronizado(id, projeto, meta) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'projetos', id), projeto);
  batch.set(doc(db, 'projetos_meta', id), meta);
  await comTempoLimite(batch.commit(), TEMPO_LIMITE_FIRESTORE_MS);
}

// O projetos_meta não pode ser regravado: se o SDK já entregou a escrita que estourou o tempo, o reenvio volta negado
async function jaEstaNoBanco(id) {
  const snap = await comTempoLimite(getDoc(doc(db, 'projetos', id)), TEMPO_LIMITE_FIRESTORE_MS);
  return snap.exists();
}

function paraSincronizar({ _localId, id, ...projeto }) {
  const dataCriacao = paraTimestamp(projeto.dataCriacao);
  return {
    // Projetos salvos offline antes dos rascunhos não têm id
    id: id || doc(collection(db, 'projetos')).id,
    projeto: {
      ...projeto,
      dataCriacao,
      ...(projeto.dataConclusao && { dataConclusao: paraTimestamp(projeto.dataConclusao) }),
      calibragem: projeto.calibragem
        ? { ...projeto.calibragem, timestamp: paraTimestamp(projeto.calibragem.timestamp) }
        : projeto.calibragem,
    },
    meta: {
      nomeProjeto: projeto.nomeProjeto,
      dataCriacao,
      uidUsuario: projeto.uidUsuario,
      companyId: projeto.companyId,
    },
  };
}

async function sincronizarProjeto(projetoOffline) {
  const { id, projeto, meta } = paraSincronizar(projetoOffline);
  try {
    await salvarProjetoSincronizado(id, projeto, meta);
  } catch (erro) {
    if (erro?.code !== 'permission-denied' || !(await jaEstaNoBanco(id))) throw erro;
  }
  await removeOfflineProject(projetoOffline._localId);
}

let isSyncing = false;

export const syncProjects = async () => {
  if (isSyncing || !auth.currentUser || !(await estaOnline())) return;
  isSyncing = true;

  try {
    const offlineProjects = await getOfflineProjects();
    let sincronizados = 0;

    for (const project of offlineProjects) {
      try {
        await sincronizarProjeto(project);
        sincronizados += 1;
      } catch (error) {
        // Fica na fila (sem rede, projeto de outro usuário etc.) e tenta de novo depois, sem travar os outros
        console.warn(`Projeto offline ${project.nomeProjeto} pendente:`, error.message);
      }
    }

    if (sincronizados > 0) Alert.alert("Sincronização", "Projetos salvos na nuvem com sucesso!");
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
      await sincronizarCalibragensPendentes();
      await syncProjects();
      await sincronizarInformacoesPendentes();
      await sincronizarRascunhosDaUltimaSessao();
      await sincronizarMidiasDaUltimaSessao();
    }
    estavaOnline = estaOnlineAgora;
  });
};
