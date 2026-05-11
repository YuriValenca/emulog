import { db } from './firebaseConfig';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import NetInfo from "@react-native-community/netinfo";
import { getData, storeData } from './storage';
import { v4 as uuidv4 } from 'uuid';

// Função para salvar projeto localmente quando offline
export const saveProjectOffline = async (project) => {
  try {
    const offlineProjects = await getData('offlineProjects') || [];
    project.id = uuidv4(); // Adiciona um ID único ao projeto
    offlineProjects.push(project);
    await storeData('offlineProjects', offlineProjects);
  } catch (error) {
    console.error("Erro ao salvar projeto offline", error);
  }
};

// Função para sincronizar dados com Firestore
export const syncProjects = async () => {
  try {
    const offlineProjects = await getData('offlineProjects');
    if (offlineProjects && offlineProjects.length > 0) {
      for (const project of offlineProjects) {
        await addDoc(collection(db, 'projetos'), project);
      }
      await storeData('offlineProjects', []); // Limpa projetos offline após sincronização
      console.log("Dados sincronizados com sucesso.");
    }
  } catch (error) {
    console.error("Erro ao sincronizar projetos", error);
  }
};

// Função para verificar conexão e sincronizar dados
export const checkConnectionAndSync = () => {
  NetInfo.fetch().then(state => {
    if (state.isConnected) {
      syncProjects();
    } else {
      console.log("Sem conexão com a internet");
    }
  });

  // Listener para mudanças na conectividade
  NetInfo.addEventListener(state => {
    if (state.isConnected) {
      syncProjects();
    }
  });
};

// Função para buscar projetos online
export const fetchOnlineProjects = async (uidUsuario, ordem, busca) => {
  try {
    const projectsRef = collection(db, 'projetos');
    const q = query(projectsRef, orderBy('dataCriacao', ordem === 'recente' ? 'desc' : 'asc'));

    const querySnapshot = await getDocs(q);
    const projects = querySnapshot.docs
      .filter(doc => doc.data().uidUsuario === uidUsuario)
      .map(doc => {
        const data = doc.data();
        return {
          ...data,
          dataCriacao: data.dataCriacao?.toDate?.() || data.dataCriacao, // Verifica se toDate é uma função
          id: doc.id, // Adiciona o ID do documento
        };
      });

    return projects.filter(project => project.nomeProjeto.toLowerCase().includes(busca.toLowerCase()));
  } catch (error) {
    throw new Error('Erro ao buscar projetos online: ' + error.message);
  }
};


