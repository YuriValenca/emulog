import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const atualizarUltimoLoginEmBackground = (uid) => {
  getDocs(query(collection(db, 'users'), where('uid', '==', uid)))
    .then((snap) => {
      if (!snap.empty) {
        updateDoc(doc(db, 'users', snap.docs[0].id), { ultimoLogin: serverTimestamp() })
          .catch((e) => console.warn('Falha ao atualizar ultimoLogin:', e.message));
      }
    })
    .catch((e) => console.warn('Falha ao buscar usuário para ultimoLogin:', e.message));
};

const ERROS_LOGIN = {
  'auth/invalid-email':          'Insira um e-mail válido.',
  'auth/invalid-credential':     'E-mail ou senha incorretos.',
  'auth/user-not-found':         'Usuário não encontrado.',
  'auth/wrong-password':         'Senha incorreta.',
  'auth/network-request-failed': 'Sem conexão com a internet. Verifique sua rede e tente novamente.',
  'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos.',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [cachedLogo, setCachedLogo] = useState(null);
  const [tecladoAberto, setTecladoAberto] = useState(false);

  const podeTentar = email.trim().length > 0 && senha.trim().length > 0;

  useEffect(() => {
    AsyncStorage.getItem('cachedCompanyLogo').then(logo => {
      if (logo) setCachedLogo(logo);
    });
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setTecladoAberto(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setTecladoAberto(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleLogin = async () => {
    setCarregando(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), senha);
      const user = userCredential.user;
      await AsyncStorage.setItem('uidUsuario', user.uid);
      atualizarUltimoLoginEmBackground(user.uid);
    } catch (error) {
      setCarregando(false);
      Alert.alert('Erro de Login', ERROS_LOGIN[error.code] ?? error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.conteudo}>
        {cachedLogo && (
          <Image
            source={{ uri: cachedLogo }}
            resizeMode="contain"
            style={styles.logo}
          />
        )}
        <Text style={styles.title}>Login</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!carregando}
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          editable={!carregando}
        />
        <TouchableOpacity
          style={[styles.button, (!podeTentar || carregando) && styles.buttonDesabilitado]}
          onPress={handleLogin}
          disabled={!podeTentar || carregando}
          activeOpacity={0.8}
        >
          {carregando
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Entrar</Text>}
        </TouchableOpacity>
      </View>

      {!tecladoAberto && (
        <View style={styles.footer}>
          <Text style={styles.footerTexto}>Desenvolvido por</Text>
          <Image source={require('../assets/logo.png')} style={styles.footerLogo} resizeMode="contain" />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCFCFC',
  },
  conteudo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  buttonDesabilitado: {
    backgroundColor: '#b0b0b0',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 12,
  },
  footerTexto: {
    fontSize: 12,
    color: '#888',
  },
  footerLogo: {
    height: 36,
    width: 36,
  },
});
