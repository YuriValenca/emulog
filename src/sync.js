// src/sync.js
import { db } from './firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { getOfflineProjects, clearOfflineProjects } from './db';
import NetInfo from "@react-native-community/netinfo";
import { Alert } from 'react-native';

export const syncProjects = async () => {
  try {
    const offlineProjects = await getOfflineProjects();
    if (offlineProjects && offlineProjects.length > 0) {
      for (const project of offlineProjects) {
        await addDoc(collection(db, 'projetos'), project);
        console.log('Projeto sincronizado com Firestore:', project);
      }
      await clearOfflineProjects(); // Limpa projetos offline após sincronização
      console.log('Dados sincronizados com sucesso.');
      Alert.alert("Sincronização", "Projetos salvos na nuvem com sucesso!");
    }
  } catch (error) {
    console.error('Erro ao sincronizar projetos:', error);
  }
};

export const checkConnectionAndSync = () => {
  NetInfo.addEventListener(async state => {
    if (state.isConnected) {
      await syncProjects();
    } else {
      console.log('Sem conexão com a internet');
    }
  });
};
