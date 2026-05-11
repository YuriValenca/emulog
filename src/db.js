// src/db.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from "@react-native-community/netinfo";
import { db } from './firebaseConfig'; // Importa a instância do Firestore
import { collection, addDoc } from 'firebase/firestore';
import { Alert } from 'react-native';

export const saveProjectOffline = async (project) => {
  try {
    const offlineProjects = await getOfflineProjects() || [];
    offlineProjects.push(project);
    await AsyncStorage.setItem('offlineProjects', JSON.stringify(offlineProjects));
    console.log('Projeto salvo offline:', project);
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

// Função para sincronizar projetos offline com o Firestore
export const syncProjects = async () => {
  try {
    const offlineProjects = await getOfflineProjects();
    console.log('Projetos para sincronizar:', offlineProjects);
    if (offlineProjects && offlineProjects.length > 0) {
      for (const project of offlineProjects) {
        await addDoc(collection(db, 'projetos'), project);
        console.log('Projeto sincronizado com Firestore:', project);
      }
      await clearOfflineProjects(); // Limpa projetos offline após sincronização
      Alert.alert("Sincronização", "Projetos salvos na nuvem com sucesso!");
    } else {
      console.log('Nenhum projeto offline para sincronizar.');
    }
  } catch (error) {
    console.error('Erro ao sincronizar projetos:', error);
  }
};

// Variável para evitar múltiplos listeners
let isListenerSet = false;

// Função para verificar a conexão e sincronizar dados
export const checkConnectionAndSync = () => {
  if (isListenerSet) return; // Evita adicionar múltiplos listeners
  isListenerSet = true;

  NetInfo.addEventListener(async state => {
    if (state.isConnected) {
      console.log('Dispositivo conectado à internet, sincronizando projetos offline...');
      await syncProjects();
    } else {
      console.log('Sem conexão com a internet');
    }
  });
};



