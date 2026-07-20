import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAuth, signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAppAuth } from '../context/auth';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen({ navigation }) {
  const { name, role, companyId, isSuperadmin, isCompanyAdmin } = useAppAuth();
  const [calibragemValida, setCalibragemValida] = useState(false);

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
        const stored = await AsyncStorage.getItem('ultimaCalibragem');
        if (stored) setCalibragemValida(true);
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
        <Text style={styles.buttonText}>Novo Projeto</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonContainer, { backgroundColor: '#505050' }]}
        onPress={() => navigation.navigate('Historico')}
      >
        <Text style={styles.buttonText}>Histórico</Text>
      </TouchableOpacity>

      {(companyId === 'explog-founding' || isSuperadmin) && <TouchableOpacity
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
      <Text style={styles.versionText}>Versão: 2.1.2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
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
