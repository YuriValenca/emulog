import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';  // Importa a configuração do Firebase
import AsyncStorage from '@react-native-async-storage/async-storage'; // Importa o AsyncStorage

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      // Armazenar o uid do usuário no AsyncStorage para usar offline
      await AsyncStorage.setItem('uidUsuario', user.uid);

      // Consulta a coleção 'users' para obter o documento correspondente ao email do usuário
      const usersCollectionRef = collection(db, 'users');
      const usersQuery = query(usersCollectionRef, where("email", "==", email));
      const querySnapshot = await getDocs(usersQuery);

      if (!querySnapshot.empty) {
        // Atualiza o documento do usuário com a data e hora do último login
        const userDocRef = doc(db, 'users', querySnapshot.docs[0].id);
        await updateDoc(userDocRef, {
          ultimoLogin: serverTimestamp() // Utiliza serverTimestamp para garantir precisão
        });

        console.log('Último login atualizado com sucesso:', new Date().toISOString());
      } else {
        console.log('Usuário não encontrado na coleção "users"');
      }
      
      navigation.replace('Home');
    } catch (error) {
      const errorMessage = error.message;
      Alert.alert("Erro de Login", errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.png')}
        resizeMode="contain"
        style={styles.logo}
      />
      <Text style={styles.title}>Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
      >
        <Text style={styles.buttonText}>Entrar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FCFCFC',
  },
  logo: {
    width: 250,
    height: 250,
    marginBottom: 0,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    color: '#000000',
  },
  input: {
    width: '100%',
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    borderWidth: 1, 
    borderColor: '#D3D3D3', 
  },
  button: {
    width: '100%',
    backgroundColor: '#525659', 
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
  },
});
