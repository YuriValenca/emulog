import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import NovaAmostraScreen from './src/screens/NovaAmostraScreen';
import HistoricoScreen from './src/screens/HistoricoScreen';
import CalibragemScreen from './src/screens/CalibragemScreen';
import DetalheProjetoScreen from './src/screens/DetalheProjetoScreen';
import GerenciarUsuarios from './src/screens/GerenciarUsuarios';
import ScaleConnect from './src/screens/ScaleConnect';
import SuperadminPanel from './src/screens/superadmin/SuperadminPanel';
import { BleProvider, useBle } from './src/context/context';
import { AuthProvider, useAppAuth } from './src/context/auth';
import { checkConnectionAndSync } from './src/db';
import { signOut } from 'firebase/auth';
import { auth } from './src/firebaseConfig';

const Stack = createNativeStackNavigator();

function BleStatusBar({ navigation }) {
  const { bleStatus, connectedDevice, weight } = useBle();

  const isVisible = ['connected', 'reconnecting', 'sleeping'].includes(bleStatus);
  if (!isVisible) return null;

  const isReconnecting = bleStatus === 'reconnecting';
  const isSleeping     = bleStatus === 'sleeping';
  const isConnected    = bleStatus === 'connected';

  const config = {
    connected: {
      bg:          '#4CAF50',
      border:      null,
      statusBar:   'light-content',
      iconColor:   '#fff',
      labelColor:  '#fff',
      weightColor: 'rgba(255,255,255,0.85)',
      chevronColor:'#fff',
      icon:        'scale',
      label:       connectedDevice?.name ?? 'Balança conectada',
    },
    sleeping: {
      bg:          '#1A3A5C',
      border:      null,
      statusBar:   'light-content',
      iconColor:   'rgba(255,255,255,0.55)',
      labelColor:  'rgba(255,255,255,0.85)',
      weightColor: null,
      chevronColor:'rgba(255,255,255,0.55)',
      icon:        'sleep',
      label:       'Balança em espera',
    },
    reconnecting: {
      bg:          '#fff8e1',
      border:      '#FF9621',
      statusBar:   'dark-content',
      iconColor:   '#FF9621',
      labelColor:  '#FF9621',
      weightColor: null,
      chevronColor:'#FF9621',
      icon:        'bluetooth-off',
      label:       'Balança desconectada — aguardando...',
    },
  }[bleStatus];

  return (
    <>
      <StatusBar backgroundColor={config.bg} barStyle={config.statusBar} translucent />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ScaleConnect')}
        style={[
          bannerStyles.bar,
          { backgroundColor: config.bg },
          config.border && { borderBottomWidth: 1, borderBottomColor: config.border },
        ]}
      >
        <MaterialCommunityIcons name={config.icon} size={16} color={config.iconColor} />
        <View style={{ flex: 1 }}>
          <Text style={[bannerStyles.label, { color: config.labelColor }]}>{config.label}</Text>
          {isConnected && weight !== null && (
            <Text style={[bannerStyles.weight, { color: config.weightColor }]}>
              {weight.toFixed(1)} g
            </Text>
          )}
          {(isSleeping || isReconnecting) && (
            <Text style={bannerStyles.sleepSub}>Ligue-a novamente para ativar</Text>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={config.chevronColor} />
      </TouchableOpacity>
    </>
  );
}

function LicenseBlockScreen() {
  const handleLogout = () => signOut(auth).catch(() => {});

  return (
    <View style={gateStyles.container}>
      <MaterialCommunityIcons name="shield-lock-outline" size={64} color="#FF5C00" />
      <Text style={gateStyles.title}>Dispositivo sem licença ativa</Text>
      <Text style={gateStyles.body}>
        A licença deste aparelho expirou ou não foi encontrada.{'\n'}
        Contate a administração para renovar e poder acessar o app.
      </Text>
      <TouchableOpacity style={gateStyles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <MaterialCommunityIcons name="logout" size={18} color="#fff" />
        <Text style={gateStyles.logoutBtnText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

function ConfigErrorScreen({ message }) {
  return (
    <View style={gateStyles.container}>
      <MaterialCommunityIcons name="account-alert-outline" size={64} color="#FF9621" />
      <Text style={gateStyles.title}>Problema na conta</Text>
      <Text style={gateStyles.body}>
        Seu usuário não está associado a uma empresa.{'\n'}
        Contate o administrador para corrigir o cadastro.
      </Text>
      {__DEV__ && <Text style={gateStyles.debug}>{message}</Text>}
    </View>
  );
}

function GenericErrorScreen({ message }) {
  return (
    <View style={gateStyles.container}>
      <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#f44336" />
      <Text style={gateStyles.title}>Erro ao carregar</Text>
      <Text style={gateStyles.body}>
        Ocorreu um erro inesperado ao iniciar o app.{'\n'}
        Verifique sua conexão e tente novamente.
      </Text>
      {__DEV__ && <Text style={gateStyles.debug}>{message}</Text>}
    </View>
  );
}

function AppNavigator() {
  const { authUser, authStatus, debugError } = useAppAuth();
  const [navReady, setNavReady] = useState(false);
  const navigationRef = useRef(null);

  useEffect(() => {
    checkConnectionAndSync();
  }, []);

  if (authStatus === 'loading') return null;
  if (authStatus === 'no-license') return <LicenseBlockScreen />;
  if (authStatus === 'config-error') return <ConfigErrorScreen message={debugError} />;
  if (authStatus === 'error') return <GenericErrorScreen message={debugError} />;

  return (
    <NavigationContainer ref={navigationRef} onReady={() => setNavReady(true)}>
      <View style={styles.root}>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: styles.screenContent }}>
          {authUser ? (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="NovaAmostra" component={NovaAmostraScreen} />
              <Stack.Screen name="Historico" component={HistoricoScreen} />
              <Stack.Screen name="Calibragem" component={CalibragemScreen} />
              <Stack.Screen name="DetalheProjeto" component={DetalheProjetoScreen} />
              <Stack.Screen name="GerenciarUsuarios" component={GerenciarUsuarios} />
              <Stack.Screen name="ScaleConnect" component={ScaleConnect} />
              <Stack.Screen name="SuperadminPanel" component={SuperadminPanel} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>

        {authUser && navReady && <BleStatusBar navigation={navigationRef.current} />}
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BleProvider>
        <AppNavigator />
      </BleProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  screenContent: {},
});

const bannerStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: (StatusBar.currentHeight ?? 24) + 4,
    gap: 10,
  },
  label:    { fontSize: 13, fontWeight: '600' },
  weight:   { fontSize: 11, marginTop: 1 },
  sleepSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
});

const gateStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#fff',
    gap: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#222', textAlign: 'center' },
  body:  { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 24 },
  debug: { fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  logoutBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  backgroundColor: '#787878',
  paddingVertical: 12,
  paddingHorizontal: 24,
  borderRadius: 8,
  marginTop: 8,
},
logoutBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
