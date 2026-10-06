import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAuth, signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAppAuth } from '../context/auth';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { buscarProjetoEmAndamento, projetoTemDados, descartarProjetoEmAndamento } from '../context/form';
import ModalProjetoEmAndamento from './ModalProjetoEmAndamento';
import { salvarComoRascunho, excluirRascunho, sincronizarRascunhos } from '../rascunhos';
import { lerCalibragemDoAparelho } from '../calibragemLocal';

export default function HomeScreen({ navigation }) {
  const { name, role, companyId, uid, isSuperadmin, isCompanyAdmin } = useAppAuth();
  const [calibragemValida, setCalibragemValida] = useState(false);
  const [balancaBtHabilitada, setBalancaBtHabilitada] = useState(false);
  const [projetoEmAndamento, setProjetoEmAndamento] = useState(null);
  const [modalProjetoVisivel, setModalProjetoVisivel] = useState(false);
  const sessao = { companyId, uid };

  useFocusEffect(
    useCallback(() => {
      sincronizarRascunhos({ companyId, uid });
    }, [companyId, uid])
  );

  useFocusEffect(
    useCallback(() => {
      const verificarProjetoEmAndamento = async () => {
        try {
          const projeto = await buscarProjetoEmAndamento(companyId, uid);
          setProjetoEmAndamento(projetoTemDados(projeto) ? projeto : null);
        } catch (e) {
          console.error('Erro ao verificar projeto em andamento:', e);
        }
      };
      verificarProjetoEmAndamento();
    }, [companyId, uid])
  );

  useEffect(() => {
    const verificarModuloBalanca = async () => {
      if (isSuperadmin) {
        setBalancaBtHabilitada(true);
        return;
      }
      if (!companyId) return;
      try {
        const companySnap = await getDoc(doc(db, 'companies', companyId));
        if (companySnap.exists()) {
          setBalancaBtHabilitada(!!companySnap.data().bluetoothScaleEnabled);
        }
      } catch (e) {
        console.error('Erro ao verificar módulo de balança Bluetooth:', e);
      }
    };
    verificarModuloBalanca();
  }, [companyId, isSuperadmin]);

  useEffect(() => {
    const verificarCalibragem = async () => {
      if (isSuperadmin) {
        setCalibragemValida(true);
        return;
      }
      try {
        const state = await NetInfo.fetch();
        if (state.isConnected && companyId) {
          const q = query(collection(db, 'calibragens'), where('companyId', '==', companyId), orderBy('timestamp', 'desc'), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setCalibragemValida(true);
            return;
          }
        }
        if (await lerCalibragemDoAparelho(companyId)) setCalibragemValida(true);
      } catch (e) {
        console.error('Erro ao verificar calibragem:', e);
      }
    };

    if (isSuperadmin || companyId) verificarCalibragem();
  }, [companyId]);

  const handleNovaAmostra = () => {
    if (!calibragemValida) {
      Alert.alert(
        'Calibragem necessária',
        'Nenhuma calibragem encontrada para esta empresa. Realize uma calibragem antes de iniciar um novo projeto.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Calibrar agora', onPress: () => navigation.navigate('Calibragem') },
        ]
      );
      return;
    }
    if (projetoEmAndamento) {
      setModalProjetoVisivel(true);
      return;
    }
    navigation.navigate('NovaAmostra');
  };

  const abrirTelaDoProjeto = () => {
    setModalProjetoVisivel(false);
    navigation.navigate('NovaAmostra');
  };

  const salvarProjetoComoRascunho = async () => {
    try {
      await salvarComoRascunho(projetoEmAndamento, sessao);
      await descartarProjetoEmAndamento(companyId, uid);
    } catch (e) {
      console.error('Erro ao salvar rascunho:', e);
      Alert.alert('Erro', 'Não foi possível salvar o rascunho. Tente novamente.');
      return false;
    }
    setProjetoEmAndamento(null);
    return true;
  };

  const apagarEIniciarNovoProjeto = async () => {
    setModalProjetoVisivel(false);
    try {
      await descartarProjetoEmAndamento(companyId, uid);
      if (projetoEmAndamento.id) await excluirRascunho(projetoEmAndamento.id, sessao);
    } catch (e) {
      console.error('Erro ao descartar projeto em andamento:', e);
      Alert.alert('Erro', 'Não foi possível apagar o projeto. Tente novamente.');
      return;
    }
    setProjetoEmAndamento(null);
    navigation.navigate('NovaAmostra');
  };

  const handleLogout = () => {
    const auth = getAuth();
    signOut(auth).catch((error) => {
      console.log('Erro ao fazer logout', error);
    });
  };

  return (
    <View style={styles.container}>
      {isSuperadmin && (
        <TouchableOpacity
          style={[styles.buttonContainer, styles.superadminButton]}
          onPress={() => navigation.navigate('SuperadminPanel')}
        >
          <MaterialCommunityIcons name="shield-crown" size={24} color="#FFFFFF" />
          <Text style={styles.adminButtonText}>Painel Administrativo</Text>
        </TouchableOpacity>
      )}

      {isCompanyAdmin && !isSuperadmin && (
        <TouchableOpacity
          style={[styles.buttonContainer, styles.adminButton]}
          onPress={() => navigation.navigate('GerenciarUsuarios')}
        >
          <MaterialCommunityIcons name="account-group" size={24} color="#FFFFFF" />
          <Text style={styles.adminButtonText}>Gerenciar Usuários</Text>
        </TouchableOpacity>
      )}

      {name ? (
        <>
          <Text style={styles.text}>Bem-vindo,</Text>
          <Text style={styles.userName}>{name}</Text>
        </>
      ) : (
        <Text style={styles.text}>Carregando...</Text>
      )}

      <TouchableOpacity
        style={[styles.buttonContainer, { backgroundColor: '#2E8C71' }]}
        onPress={() => navigation.navigate('Calibragem')}
      >
        <Text style={styles.buttonText}>Calibragem</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonContainer, { backgroundColor: '#1F6452' }]}
        onPress={handleNovaAmostra}
      >
        <Text style={styles.buttonText}>{projetoEmAndamento ? 'Continuar' : 'Novo Projeto'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonContainer, { backgroundColor: '#505050' }]}
        onPress={() => navigation.navigate('Historico')}
      >
        <Text style={styles.buttonText}>Histórico</Text>
      </TouchableOpacity>

      {((companyId === 'explog-founding' || isSuperadmin) || balancaBtHabilitada) && <TouchableOpacity
        style={[styles.buttonContainer, { backgroundColor: '#1A73E8', flexDirection: 'row' }]}
        onPress={() => navigation.navigate('ScaleConnect')}
      >
        <MaterialCommunityIcons name="bluetooth" size={24} color="#FFFFFF" />
        <Text style={[styles.buttonText, { marginLeft: 10 }]}>Conectar Balança</Text>
      </TouchableOpacity>}

      <TouchableOpacity
        style={[styles.buttonContainer, styles.logoutButton, { width: '70%' }]}
        onPress={handleLogout}
      >
        <MaterialCommunityIcons name="logout" size={24} color="#FFFFFF" />
        <Text style={[styles.buttonText, { marginLeft: 10 }]}>Desconectar</Text>
      </TouchableOpacity>
      <ModalProjetoEmAndamento
        visivel={modalProjetoVisivel}
        projeto={projetoEmAndamento}
        onContinuar={abrirTelaDoProjeto}
        onSalvarRascunho={salvarProjetoComoRascunho}
        onApagarEIniciarNovo={apagarEIniciarNovoProjeto}
        onIniciarNovo={abrirTelaDoProjeto}
        onFechar={() => setModalProjetoVisivel(false)}
      />

      <Text style={styles.versionText}>Versão: 2.2.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: -48,
  },
  text: {
    color: '#000000',
    marginBottom: 5,
    fontSize: 18,
    textAlign: 'center',
  },
  userName: {
    color: '#000000',
    marginBottom: 20,
    fontSize: 22,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  buttonContainer: {
    marginTop: 15,
    width: '82%',
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#787878',
    marginTop: 20,
  },
  superadminButton: {
    flexDirection: 'row',
    backgroundColor: '#494949',
    marginTop: 20,
    width: '70%',
    marginBottom: 20,
  },
  adminButton: {
    flexDirection: 'row',
    backgroundColor: '#494949',
    marginTop: 20,
    width: '70%',
    marginBottom: 20,
  },
  adminButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    marginLeft: 10,
  },
  versionText: {
    color: '#505050',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 16,
  },
});
