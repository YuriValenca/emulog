import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from "@react-native-community/netinfo";
import { db } from './firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { Alert } from 'react-native';

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
      await addDoc(collection(db, 'projetos'), project);
      await removeOfflineProject(project._localId);
      console.log('Projeto sincronizado com Firestore:', project);
    }

    Alert.alert("Sincronização", "Projetos salvos na nuvem com sucesso!");
  } catch (error) {
    console.error('Erro ao sincronizar projetos:', error);
  } finally {
    isSyncing = false;
  }
};

let isListenerSet = false;
let wasConnected = null;

export const checkConnectionAndSync = () => {
  if (isListenerSet) return;
  isListenerSet = true;

  NetInfo.addEventListener(async state => {
    const isNowConnected = !!state.isConnected;
    if (isNowConnected && wasConnected === false) {
      console.log('Dispositivo reconectou, sincronizando...');
      await syncProjects();
    }
    wasConnected = isNowConnected;
  });
};
