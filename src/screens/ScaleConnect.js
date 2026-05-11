import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Animated, ScrollView,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BackButton from './BackButton';
import { useBle } from '../context/context';

export default function ScaleConnect({ navigation }) {
  const {
    bleStatus,
    devices,
    knownDevices,
    connectedDevice,
    weight,
    readingStatus,
    lastUpdate,
    errorMsg,
    startSmartScan,
    stopScan,
    connectToDevice,
    disconnect,
    cancelReconnect,
    retryReconnectScan,
    resumeMonitor,
  } = useBle();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (bleStatus === 'scanning') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [bleStatus]);

  React.useEffect(() => {
    if (readingStatus === 'listening' && weight !== null) {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.6, duration: 80, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1.0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [weight]);

  const rssiToBars = (rssi) => {
    if (!rssi) return 1;
    if (rssi >= -60) return 4;
    if (rssi >= -70) return 3;
    if (rssi >= -80) return 2;
    return 1;
  };

  const rssiColor = (rssi) => {
    if (!rssi) return '#ccc';
    if (rssi >= -60) return '#4CAF50';
    if (rssi >= -70) return '#FF9621';
    if (rssi >= -80) return '#FF5C00';
    return '#f44336';
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity style={styles.deviceItem} onPress={() => connectToDevice(item)} activeOpacity={0.7}>
      <View style={styles.deviceIcon}>
        <MaterialCommunityIcons name="bluetooth" size={22} color="#1A73E8" />
      </View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceId}>{item.id}</Text>
      </View>
      <View style={styles.deviceSignal}>
        {[1, 2, 3, 4].map(bar => (
          <View
            key={bar}
            style={[
              styles.signalBar,
              { height: bar * 4 + 4 },
              bar <= rssiToBars(item.rssi)
                ? { backgroundColor: rssiColor(item.rssi) }
                : { backgroundColor: '#e0e0e0' },
            ]}
          />
        ))}
      </View>
    </TouchableOpacity>
  );

  const isSleeping     = bleStatus === 'sleeping';
  const isConnected    = bleStatus === 'connected';
  const isReconnecting = bleStatus === 'reconnecting';
  const isConnecting   = bleStatus === 'connecting';
  const isScanning     = bleStatus === 'scanning';

  // Mostra lista de escolha apenas quando há 2+ balanças conhecidas simultaneamente.
  // No dia-a-dia isso nunca deve ocorrer.
  const showKnownList = knownDevices.length >= 2 && !isConnected && !isConnecting && !isReconnecting && !isSleeping;
  // Fallback: mostra todos os dispositivos se o scan completo foi ativado
  const showFullList  = devices.length > 0 && knownDevices.length === 0 && !isConnected && !isConnecting && !isReconnecting && !isSleeping;

  const bleBarHeight = (isConnected || isReconnecting || isSleeping)
    ? (StatusBar.currentHeight ?? 24) + 56
    : 48;

  return (
    <View style={styles.container}>

      {/* Respiro para a BleStatusBar + BackButton */}
      <View style={[styles.topArea, { paddingTop: bleBarHeight }]}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      {/* Card de reconexão automática */}
      {isReconnecting && (
        <View style={styles.reconnectingCard}>
          <ActivityIndicator size="small" color="#FF9621" />
          <View style={{ flex: 1 }}>
            <Text style={styles.reconnectingLabel}>Aguardando balança...</Text>
            <Text style={styles.reconnectingHint}>Ligue a balança — o app reconecta sozinho</Text>
            <TouchableOpacity onPress={retryReconnectScan} style={styles.retryBtn}>
              <MaterialCommunityIcons name="magnify" size={14} color="#1A73E8" />
              <Text style={styles.retryBtnText}>Buscar manualmente</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={cancelReconnect} style={styles.cancelReconnectBtn}>
            <MaterialCommunityIcons name="close" size={18} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {/* Card de sleep */}
      {isSleeping && connectedDevice && (
        <View style={styles.sleepCard}>
          <View style={styles.sleepIcon}>
            <MaterialCommunityIcons name="sleep" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sleepLabel}>Em espera</Text>
            <Text style={styles.sleepName}>{connectedDevice.name}</Text>
            <Text style={styles.sleepHint}>Ligue-a novamente para ativar</Text>
          </View>
          <TouchableOpacity onPress={disconnect} style={styles.disconnectBtn}>
            <MaterialCommunityIcons name="link-off" size={20} color="#f44336" />
          </TouchableOpacity>
        </View>
      )}

      {/* Card de conectado */}
      {isConnected && connectedDevice && (
        <View style={styles.connectedCard}>
          <View style={styles.connectedIcon}>
            <MaterialCommunityIcons name="scale" size={32} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.connectedLabel}>Conectado</Text>
            <Text style={styles.connectedName}>{connectedDevice.name}</Text>
            <Text style={styles.connectedId}>{connectedDevice.id}</Text>
          </View>
          <TouchableOpacity onPress={disconnect} style={styles.disconnectBtn}>
            <MaterialCommunityIcons name="link-off" size={20} color="#f44336" />
          </TouchableOpacity>
        </View>
      )}

      {/* Card de erro */}
      {bleStatus === 'error' && errorMsg ? (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#f44336" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* ── Área de scan — visível fora dos estados de conexão ── */}
      {!isConnected && !isReconnecting && !isSleeping && (
        <>
          <View style={styles.scanArea}>
            <Animated.View style={[styles.scanRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.scanCircle}>
                <MaterialCommunityIcons
                  name={isScanning || isConnecting ? 'bluetooth-audio' : 'bluetooth'}
                  size={40}
                  color={isScanning || isConnecting ? '#1A73E8' : '#aaa'}
                />
              </View>
            </Animated.View>

            <Text style={styles.scanHint}>
              {bleStatus === 'idle' || bleStatus === 'error'
                ? 'Toque em "Conectar" para encontrar sua balança'
                : isScanning
                  ? 'Procurando sua balança...'
                  : isConnecting
                    ? 'Conectando...'
                    : ''}
            </Text>
          </View>

          <View style={styles.actionRow}>
            {isScanning ? (
              <TouchableOpacity style={[styles.mainBtn, styles.stopBtn]} onPress={stopScan}>
                <MaterialCommunityIcons name="stop" size={22} color="#fff" />
                <Text style={styles.mainBtnText}>Parar</Text>
              </TouchableOpacity>
            ) : isConnecting ? (
              <View style={[styles.mainBtn, { backgroundColor: '#FF9621' }]}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.mainBtnText}>Conectando...</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.mainBtn} onPress={startSmartScan}>
                <MaterialCommunityIcons name="scale-balance" size={22} color="#fff" />
                <Text style={styles.mainBtnText}>Conectar Balança</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Lista de escolha: apenas quando há 2+ balanças conhecidas */}
          {showKnownList && (
            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>Escolha a balança</Text>
              <FlatList
                data={knownDevices}
                keyExtractor={item => item.id}
                renderItem={renderDevice}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
              />
            </View>
          )}

          {/* Fallback: scan completo não encontrou balanças conhecidas */}
          {showFullList && (
            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>Dispositivos próximos — toque para conectar</Text>
              <FlatList
                data={devices}
                keyExtractor={item => item.id}
                renderItem={renderDevice}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
              />
            </View>
          )}
        </>
      )}

      {/* Display de peso — visível quando conectado, em sleep ou reconectando */}
      {(isConnected || isReconnecting || isSleeping) && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.connectedActions}>

          <Animated.View
            style={[
              styles.weightCard,
              isSleeping && styles.weightCardSleep,
              { opacity: flashAnim },
            ]}
          >
            <Text style={styles.weightCardLabel}>
              {isSleeping ? 'Balança em espera' : 'Peso atual'}
            </Text>

            {isSleeping ? (
              <View style={styles.sleepWeightArea}>
                <MaterialCommunityIcons name="sleep" size={48} color="#1A3A5C" style={{ opacity: 0.25 }} />
                <Text style={styles.sleepWeightHint}>Aguardando ativação...</Text>
              </View>
            ) : weight !== null ? (
              <>
                <Text style={styles.weightValue}>
                  {weight.toFixed(1)}
                  <Text style={styles.weightUnit}> g</Text>
                </Text>
                <Text style={styles.weightKg}>{(weight / 1000).toFixed(4)} kg</Text>
              </>
            ) : (
              <View style={styles.waitingRow}>
                <ActivityIndicator size="small" color="#FF5C00" />
                <Text style={styles.waitingText}>Aguardando leitura...</Text>
              </View>
            )}

            {lastUpdate && !isSleeping && (
              <Text style={styles.lastUpdate}>Última leitura: {lastUpdate}</Text>
            )}
          </Animated.View>

          {!isSleeping && (
            <View style={[styles.readingBadge, {
              backgroundColor: readingStatus === 'stable' ? '#e8f5e9' : readingStatus === 'waitingClear' ? '#f3e5f5' : '#fff8e1',
              borderColor: readingStatus === 'stable' ? '#4CAF50' : readingStatus === 'waitingClear' ? '#9C27B0' : '#FF9621',
            }]}>
              <View style={[styles.readingDot, {
                backgroundColor: readingStatus === 'stable' ? '#4CAF50' : readingStatus === 'waitingClear' ? '#9C27B0' : '#FF9621',
              }]} />
              <Text style={[styles.readingBadgeText, {
                color: readingStatus === 'stable' ? '#4CAF50' : readingStatus === 'waitingClear' ? '#9C27B0' : '#FF9621',
              }]}>
                {readingStatus === 'listening'
                  ? 'Lendo em tempo real...'
                  : readingStatus === 'stable'
                    ? '✓ Peso estabilizado'
                    : readingStatus === 'waitingClear'
                      ? 'Retire o copo para próxima pesagem'
                      : 'Aguardando reconexão...'}
              </Text>
            </View>
          )}

          {(readingStatus === 'stable' || readingStatus === 'waitingClear') && isConnected && (
            <TouchableOpacity style={styles.resumeBtn} onPress={resumeMonitor}>
              <MaterialCommunityIcons name="refresh" size={18} color="#1A73E8" />
              <Text style={styles.resumeBtnText}>Nova leitura</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.disconnectTextBtn} onPress={disconnect}>
            <MaterialCommunityIcons name="bluetooth-off" size={16} color="#f44336" />
            <Text style={styles.disconnectTextBtnLabel}>Desconectar</Text>
          </TouchableOpacity>

        </ScrollView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  topArea: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    backgroundColor: '#FAFAFA',
  },
  reconnectingCard: {
    flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#FF9621', gap: 12,
  },
  reconnectingLabel: { fontSize: 14, fontWeight: '700', color: '#FF9621' },
  reconnectingHint: { fontSize: 12, color: '#aaa', marginTop: 2 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  retryBtnText: { fontSize: 12, color: '#1A73E8', fontWeight: '600' },
  cancelReconnectBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
  },
  sleepCard: {
    flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#1A3A5C', gap: 12,
  },
  sleepIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#1A3A5C', alignItems: 'center', justifyContent: 'center',
    opacity: 0.75,
  },
  sleepLabel: {
    fontSize: 12, color: '#1A3A5C', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7,
  },
  sleepName: { fontSize: 16, fontWeight: '700', color: '#222', marginTop: 2 },
  sleepHint: { fontSize: 12, color: '#aaa', marginTop: 2 },
  connectedCard: {
    flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#4CAF50', gap: 12,
  },
  connectedIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center',
  },
  connectedLabel: { fontSize: 12, color: '#4CAF50', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  connectedName: { fontSize: 16, fontWeight: '700', color: '#222', marginTop: 2 },
  connectedId: { fontSize: 11, color: '#aaa', marginTop: 2 },
  disconnectBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center',
  },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, padding: 14,
    backgroundColor: '#fff5f5', borderRadius: 10, borderWidth: 1, borderColor: '#ffcdd2',
  },
  errorText: { flex: 1, fontSize: 13, color: '#f44336' },
  scanArea: { alignItems: 'center', paddingTop: 24, paddingBottom: 24, paddingHorizontal: 32 },
  scanRing: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  scanCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  scanHint: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  actionRow: { paddingHorizontal: 24, marginBottom: 24 },
  mainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A73E8', borderRadius: 12, paddingVertical: 16, gap: 10,
  },
  stopBtn: { backgroundColor: '#999' },
  mainBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listContainer: { flex: 1, paddingHorizontal: 16 },
  listTitle: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  deviceItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, gap: 12,
  },
  deviceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 15, fontWeight: '600', color: '#222' },
  deviceId: { fontSize: 11, color: '#aaa', marginTop: 2 },
  deviceSignal: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 20 },
  signalBar: { width: 5, borderRadius: 2 },
  connectedActions: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, alignItems: 'center' },
  weightCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  weightCardSleep: {
    backgroundColor: '#F4F6F8',
    shadowOpacity: 0.03,
  },
  weightCardLabel: { fontSize: 13, color: '#aaa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  weightValue: { fontSize: 64, fontWeight: '800', color: '#FF5C00', lineHeight: 72 },
  weightUnit: { fontSize: 28, color: '#ccc', fontWeight: '400' },
  weightKg: { fontSize: 16, color: '#aaa', marginTop: 6 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  waitingText: { fontSize: 15, color: '#aaa' },
  lastUpdate: { fontSize: 11, color: '#ccc', marginTop: 10 },
  sleepWeightArea: { alignItems: 'center', paddingVertical: 20, gap: 12 },
  sleepWeightHint: { fontSize: 14, color: '#aaa' },
  readingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginBottom: 24,
  },
  readingDot: { width: 8, height: 8, borderRadius: 4 },
  readingBadgeText: { fontSize: 13, fontWeight: '600' },
  resumeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#1A73E8', marginBottom: 16,
  },
  resumeBtnText: { fontSize: 14, color: '#1A73E8', fontWeight: '600' },
  disconnectTextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 },
  disconnectTextBtnLabel: { fontSize: 14, color: '#f44336', fontWeight: '600' },
});
