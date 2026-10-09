import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const atualizarUltimoLoginEmBackground = (uid) => {
  updateDoc(doc(db, 'users', uid), { ultimoLogin: serverTimestamp() })
    .catch((e) => console.warn('Falha ao atualizar ultimoLogin:', e.message));
};

const ERROS_LOGIN = {
  'auth/invalid-email':          'Insira um e-mail válido.',
  'auth/invalid-credential':     'E-mail ou senha incorretos.',
  'auth/user-not-found':         'Usuário não encontrado.',
  'auth/wrong-password':         'Senha incorreta.',
  'auth/network-request-failed': 'Sem conexão com a internet. Verifique sua rede e tente novamente.',
  'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos.',
};

const LARGURA_MAXIMA_LOGO = 300;
const ALTURA_MAXIMA_LOGO = 225;

const tamanhoDaLogo = (proporcao) => {
  const largura = Math.min(LARGURA_MAXIMA_LOGO, ALTURA_MAXIMA_LOGO * proporcao);
  return { width: largura, height: largura / proporcao };
};

const useProporcaoDaImagem = (uri) => {
  const [proporcao, setProporcao] = useState(1);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(uri, (largura, altura) => setProporcao(largura / altura), () => setProporcao(1));
  }, [uri]);

  return proporcao;
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [cachedLogo, setCachedLogo] = useState(null);
  const proporcaoDaLogo = useProporcaoDaImagem(cachedLogo);

  const podeTentar = email.trim().length > 0 && senha.trim().length > 0;

  useEffect(() => {
    AsyncStorage.getItem('cachedCompanyLogo').then(logo => {
      if (logo) setCachedLogo(logo);
    });
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.conteudo}>
        {cachedLogo ? (
          <Image source={{ uri: cachedLogo }} resizeMode="contain" style={[tamanhoDaLogo(proporcaoDaLogo), styles.logoEmpresa]} />
        ) : (
          <Image source={require('../assets/adaptive-icon-foreground.png')} resizeMode="contain" style={styles.logoPadrao} />
        )}
        <Text style={[styles.title, !cachedLogo && styles.titleColadoNaLogoPadrao]}>Login</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888888"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!carregando}
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#888888"
          secureTextEntry
          autoCapitalize="none"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFCFC', marginTop: -64 },
  conteudo: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  logoPadrao: { width: ALTURA_MAXIMA_LOGO, height: ALTURA_MAXIMA_LOGO },
  logoEmpresa: { marginBottom: 20 },
  title: { fontSize: 24, marginBottom: 20, color: '#000000' },
  titleColadoNaLogoPadrao: { marginTop: -20 },
  input: {
    width: '100%',
    color: '#000000',
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#D3D3D3',
  },
  button: { width: '100%', backgroundColor: '#1F6452', padding: 15, borderRadius: 5, alignItems: 'center' },
  buttonDesabilitado: { backgroundColor: '#b0b0b0' },
  buttonText: { color: '#FFFFFF', fontSize: 20 },
});
