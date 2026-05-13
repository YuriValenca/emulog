import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Importa o pacote de ícones
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore'; // Importa as funções do Firestore

export default function HomeScreen({ navigation }) {
  const [isAdmin, setIsAdmin] = useState(false); // Estado para controlar se o usuário é admin
  const [userName, setUserName] = useState(''); // Estado para armazenar o nome do usuário

  useEffect(() => {
    const auth = getAuth();
    // Observa mudanças no estado de autenticação
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Verifica se o usuário é o admin master
        if (user.uid === process.env.EXPO_PUBLIC_ADMIN_UUID) {
          setIsAdmin(true);
          setUserName('Admin Master');
        } else {
          setIsAdmin(false);
          // Se não for admin master, busca o nome do usuário no Firestore
          const db = getFirestore();
          const usersCollectionRef = collection(db, 'users');
          const q = query(usersCollectionRef, where('uid', '==', user.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            querySnapshot.forEach((doc) => {
              setUserName(doc.data().nome);
            });
          } else {
            console.log('Nenhum documento correspondente encontrado.');
          }
        }
      } else {
        // Se não estiver logado, não é admin
        setIsAdmin(false);
      }
    });

    // Limpeza ao desmontar o componente
    return () => unsubscribe();
  }, []);

  // Função de logout
  const handleLogout = () => {
    const auth = getAuth();
    signOut(auth).then(() => {
      // Redireciona para a tela de login após o logout
      navigation.replace('Login');
    }).catch((error) => {
      // Trata erros aqui
      console.log('Erro ao fazer logout', error);
    });
  };

  return (
    <View style={styles.container}>
      {isAdmin && (
        <TouchableOpacity
          style={[styles.buttonContainer, styles.adminButton]} // Estilos para o botão
          onPress={() => navigation.navigate('GerenciarUsuarios')}>
          <MaterialCommunityIcons name="account-group" size={24} color="#FFFFFF" />
          <Text style={styles.adminButtonText}>Gerenciar Usuários</Text>
        </TouchableOpacity>
      )}

      {userName ? (
        <>
          <Text style={styles.text}>Bem-vindo,</Text>
          <Text style={styles.userName}>{userName}</Text>
        </>
      ) : (
        <Text style={styles.text}>Carregando...</Text>
      )}

      <TouchableOpacity
        style={[styles.buttonContainer, { backgroundColor: "#FF9621" }]}
        onPress={() => navigation.navigate('Calibragem')}>
        <Text style={styles.buttonText}>Calibragem</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.buttonContainer, { backgroundColor: "#FF5C00" }]}
        onPress={() => navigation.navigate('NovaAmostra')}>
        <Text style={styles.buttonText}>Novo Projeto</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.buttonContainer, { backgroundColor: "#505050" }]}
        onPress={() => navigation.navigate('Historico')}>
        <Text style={styles.buttonText}>Histórico</Text>
      </TouchableOpacity>

      {/* Botão que navega para a tela de conexão com a balança */}
      <TouchableOpacity
        style={[styles.buttonContainer, { backgroundColor: "#1A73E8", flexDirection: 'row' }]}
        onPress={() => navigation.navigate('ScaleConnect')}>
        <MaterialCommunityIcons name="bluetooth" size={24} color="#FFFFFF" />
        <Text style={[styles.buttonText, { marginLeft: 10 }]}>Conectar Balança</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonContainer, styles.logoutButton, { width: '70%' }]} // Ajuste para a largura ser 70%
        onPress={handleLogout}
      >
        <MaterialCommunityIcons name="logout" size={24} color="#FFFFFF" />
        <Text style={[styles.buttonText, { marginLeft: 10 }]}>Desconectar</Text>
      </TouchableOpacity>
      <Text style={styles.versionText}>Versão: 1.1.2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
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
  adminButton: {
    flexDirection: 'row',
    backgroundColor: '#505050',
    marginTop: 20,
    width: '70%',
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
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
  }
});
