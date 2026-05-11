import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

// ─── PERFIS DE BALANÇAS CONHECIDAS ───────────────────────────────────────────
const SCALE_PROFILES = [
  {
    name: 'Balança Original (ffb0/ffb2)',
    serviceUUID: '0000ffb0-0000-1000-8000-00805f9b34fb',
    charUUID:    '0000ffb2-0000-1000-8000-00805f9b34fb',
    decode: (bytes) => {
      const raw = (bytes[4] << 8) | bytes[5];
      return raw / 3.9046;
    },
  },
  {
    name:            'FlexInter FF-BDN4821W',
    serviceUUID:     '0000ffb0-0000-1000-8000-00805f9b34fb',
    charUUID:        '0000ffb2-0000-1000-8000-00805f9b34fb',
    activationChar:  '0000ffb1-0000-1000-8000-00805f9b34fb',
    activationCmd:   [0x01],
    headerByte:      0xAC,
    minPacketLength: 5,
    maxWeight:       5000,
    pingIntervalMs:  8000,
    pingChar:        '0000ffb1-0000-1000-8000-00805f9b34fb',
    pingCmd:         [0x01],
    decode: (bytes) => {
      return (bytes[3] << 8) | bytes[4];
    },
  },
];

// ─── NOMES DE BALANÇAS CONHECIDAS ─────────────────────────────────────────────
// Balanças cujos nomes BLE são conhecidos e devem ser conectadas automaticamente.
// A comparação é case-insensitive e por substring.
const KNOWN_SCALE_NAMES = ['my_scale', 'my scale', 'swan'];

const DISCOVERY_MODE = false;
const WEIGHT_CLEAR_THRESHOLD = 10; // gramas

// ─── FÓRMULAS CANDIDATAS (modo descoberta) ────────────────────────────────────
const CANDIDATE_DECODERS = [
  { name: 'BE [1:2] /100', fn: b => ((b[1] << 8) | b[2]) / 100 },
  { name: 'BE [2:3] /100', fn: b => ((b[2] << 8) | b[3]) / 100 },
  { name: 'BE [3:4] /100', fn: b => ((b[3] << 8) | b[4]) / 100 },
  { name: 'BE [4:5] /100', fn: b => ((b[4] << 8) | b[5]) / 100 },
  { name: 'BE [1:2] /10',  fn: b => ((b[1] << 8) | b[2]) / 10  },
  { name: 'BE [3:4] /10',  fn: b => ((b[3] << 8) | b[4]) / 10  },
  { name: 'BE [4:5] /10',  fn: b => ((b[4] << 8) | b[5]) / 10  },
  { name: 'LE [1:2] /100', fn: b => ((b[2] << 8) | b[1]) / 100 },
  { name: 'LE [3:4] /100', fn: b => ((b[4] << 8) | b[3]) / 100 },
  { name: 'LE [4:5] /100', fn: b => ((b[5] << 8) | b[4]) / 100 },
  { name: 'LE [1:2] /10',  fn: b => ((b[2] << 8) | b[1]) / 10  },
  { name: 'LE [3:4] /10',  fn: b => ((b[4] << 8) | b[3]) / 10  },
  { name: 'BE [1:2] /3.9', fn: b => ((b[1] << 8) | b[2]) / 3.9046 },
  { name: 'BE [4:5] /3.9', fn: b => ((b[4] << 8) | b[5]) / 3.9046 },
];

const bleManager = new BleManager();

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
const BleContext = createContext(null);

export function useBle() {
  const ctx = useContext(BleContext);
  if (!ctx) throw new Error('useBle deve ser usado dentro de BleProvider');
  return ctx;
}

// ─── HELPER: verifica se um nome BLE corresponde a uma balança conhecida ──────
const isKnownScale = (name) => {
  if (!name) return false;
  const lower = name.toLowerCase();
  return KNOWN_SCALE_NAMES.some(k => lower.includes(k));
};

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
export function BleProvider({ children }) {
  const [bleStatus, setBleStatus]             = useState('idle');
  const [devices, setDevices]                 = useState([]);
  const [knownDevices, setKnownDevices]       = useState([]); // balanças conhecidas encontradas no scan
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [weight, setWeight]                   = useState(null);
  const [rawBytes, setRawBytes]               = useState(null);
  const [readingStatus, setReadingStatus]     = useState('idle');
  const [lastUpdate, setLastUpdate]           = useState(null);
  const [errorMsg, setErrorMsg]               = useState('');
  const [activeProfile, setActiveProfile]     = useState(null);

  const deviceRef         = useRef(null);
  const foundIds          = useRef({});
  const subscriptionRef   = useRef(null);
  const discoverySubsRef  = useRef([]);
  const stabilizeTimerRef = useRef(null);
  const pingIntervalRef   = useRef(null);
  const lastWeightRef     = useRef(null);
  const lastDeviceIdRef   = useRef(null);
  const isReconnectingRef = useRef(false);
  const waitingClearRef   = useRef(false);
  const isSleepingRef     = useRef(false);
  // Evita auto-connect duplicado quando múltiplos pacotes do mesmo device chegam
  const autoConnectingRef = useRef(false);

  useEffect(() => {
    return () => {
      _cleanupSubscriptions();
      isReconnectingRef.current = false;
      bleManager.stopDeviceScan();
      if (deviceRef.current) deviceRef.current.cancelConnection().catch(() => {});
    };
  }, []);

  const _cleanupSubscriptions = () => {
    if (subscriptionRef.current) { subscriptionRef.current.remove(); subscriptionRef.current = null; }
    discoverySubsRef.current.forEach(s => { try { s.remove(); } catch (_) {} });
    discoverySubsRef.current = [];
    if (stabilizeTimerRef.current) { clearTimeout(stabilizeTimerRef.current); stabilizeTimerRef.current = null; }
    _stopPing();
  };

  // ── Ping ────────────────────────────────────────────────────────────────────
  const _startPing = (device, profile) => {
    if (!profile.pingChar || !profile.pingCmd || !profile.pingIntervalMs) return;
    _stopPing();
    pingIntervalRef.current = setInterval(async () => {
      if (!deviceRef.current) { _stopPing(); return; }
      try {
        const cmdBase64 = Buffer.from(profile.pingCmd).toString('base64');
        await device.writeCharacteristicWithoutResponseForService(
          profile.serviceUUID,
          profile.pingChar,
          cmdBase64
        );
        console.log(`🏓 [BLE] Ping OK → ${profile.pingChar.slice(4, 8).toUpperCase()}`);
      } catch (pingErr) {
        console.warn('⚠️ [BLE] Ping falhou — link BLE perdido:', pingErr.message);
        _stopPing();
        if (deviceRef.current && !isReconnectingRef.current) {
          try { await deviceRef.current.cancelConnection(); } catch (_) {}
          setTimeout(() => {
            if (!isReconnectingRef.current) _handleDisconnect();
          }, 1000);
        }
      }
    }, profile.pingIntervalMs);
  };

  const _stopPing = () => {
    if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
  };

  // ── Sleep / WakeUp ──────────────────────────────────────────────────────────
  const _handleSleep = () => {
    if (isSleepingRef.current) return;
    isSleepingRef.current = true;
    console.log('😴 [BLE] Balança entrou em sleep — mantendo conexão BLE.');
    if (stabilizeTimerRef.current) { clearTimeout(stabilizeTimerRef.current); stabilizeTimerRef.current = null; }
    setBleStatus('sleeping');
    setWeight(null);
    setReadingStatus('idle');
    lastWeightRef.current  = null;
    waitingClearRef.current = false;
  };

  const _handleWakeUp = () => {
    if (!isSleepingRef.current) return;
    isSleepingRef.current = false;
    console.log('⏰ [BLE] Balança acordou — retomando leituras.');
    setBleStatus('connected');
    setReadingStatus('listening');
  };

  // ── Desconexão real ─────────────────────────────────────────────────────────
  const _handleDisconnect = () => {
    if (isReconnectingRef.current) return;
    _cleanupSubscriptions();
    isSleepingRef.current  = false;
    setBleStatus('reconnecting');
    setReadingStatus('idle');
    setActiveProfile(null);
    deviceRef.current = null;
    isReconnectingRef.current = false;
    if (lastDeviceIdRef.current) startAutoReconnectScan();
  };

  // ── Permissões ──────────────────────────────────────────────────────────────
  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
    } else {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  };

  // ── Scan padrão (manual, sem auto-connect) ───────────────────────────────────
  // Usado como fallback quando o scan inteligente não acha nenhuma balança.
  const startScan = async () => {
    setErrorMsg('');
    setDevices([]);
    setKnownDevices([]);
    foundIds.current = {};
    autoConnectingRef.current = false;

    const granted = await requestPermissions();
    if (!granted) {
      setErrorMsg('Permissão de Bluetooth negada.');
      setBleStatus('error');
      return;
    }

    setBleStatus('scanning');

    bleManager.startDeviceScan(null, { allowDuplicates: false }, (scanErr, device) => {
      if (scanErr) {
        setErrorMsg('Erro ao escanear. Verifique se o Bluetooth está ativado.');
        setBleStatus('error');
        return;
      }
      if (device && !foundIds.current[device.id]) {
        foundIds.current[device.id] = true;
        setDevices(prev => [
          ...prev,
          { id: device.id, name: device.name || '(sem nome)', rssi: device.rssi, raw: device },
        ].sort((a, b) => (b.rssi || -999) - (a.rssi || -999)));
      }
    });

    setTimeout(() => {
      bleManager.stopDeviceScan();
      setBleStatus(prev => prev === 'scanning' ? 'idle' : prev);
    }, 15000);
  };

  const stopScan = () => {
    bleManager.stopDeviceScan();
    setBleStatus('idle');
  };

  // ── Scan inteligente (tenta auto-connect em balanças conhecidas) ─────────────
  // Fluxo:
  //   1. Escaneia silenciosamente por até 15s
  //   2. Se achar exatamente 1 balança conhecida → conecta automaticamente
  //   3. Se achar 2+ balanças conhecidas → exibe apenas elas para o usuário escolher
  //   4. Se o tempo esgotar sem achar nenhuma → cai no modo scan completo (lista tudo)
  const startSmartScan = async () => {
    setErrorMsg('');
    setDevices([]);
    setKnownDevices([]);
    foundIds.current = {};
    autoConnectingRef.current = false;

    const granted = await requestPermissions();
    if (!granted) {
      setErrorMsg('Permissão de Bluetooth negada.');
      setBleStatus('error');
      return;
    }

    setBleStatus('scanning');
    const foundKnown = []; // acumula localmente para checar duplicatas sem depender de state

    bleManager.startDeviceScan(null, { allowDuplicates: false }, (scanErr, device) => {
      if (scanErr) {
        setErrorMsg('Erro ao escanear. Verifique se o Bluetooth está ativado.');
        setBleStatus('error');
        return;
      }
      if (!device || foundIds.current[device.id]) return;
      foundIds.current[device.id] = true;

      const entry = { id: device.id, name: device.name || '(sem nome)', rssi: device.rssi, raw: device };

      if (isKnownScale(device.name)) {
        foundKnown.push(entry);
        setKnownDevices([...foundKnown]);

        // Uma balança conhecida encontrada → conecta imediatamente
        if (foundKnown.length === 1 && !autoConnectingRef.current) {
          autoConnectingRef.current = true;
          bleManager.stopDeviceScan();
          console.log(`🎯 [BLE] Balança conhecida encontrada: ${device.name} — conectando automaticamente`);
          connectToDevice(entry);
        }
        // Duas ou mais → para o scan e deixa o usuário escolher
        else if (foundKnown.length >= 2 && !autoConnectingRef.current) {
          bleManager.stopDeviceScan();
          setBleStatus('idle'); // mostra lista (knownDevices > 1 é o gatilho na UI)
          console.log(`⚠️ [BLE] ${foundKnown.length} balanças conhecidas encontradas — exibindo lista`);
        }
      }
    });

    // Timeout: se não achou nenhuma balança conhecida, faz scan completo
    setTimeout(() => {
      if (autoConnectingRef.current) return; // já conectando, ignora
      bleManager.stopDeviceScan();
      const currentKnown = foundKnown.length;
      if (currentKnown === 0) {
        console.log('[BLE] Nenhuma balança conhecida encontrada — iniciando scan completo');
        startScan();
      }
      // Se achou 1+, já foi tratado acima
    }, 15000);
  };

  // ── Reconexão automática ────────────────────────────────────────────────────
  const startAutoReconnectScan = () => {
    if (!lastDeviceIdRef.current) return;
    bleManager.startDeviceScan(null, { allowDuplicates: false }, (scanErr, device) => {
      if (scanErr) return;
      if (device?.id === lastDeviceIdRef.current && !isReconnectingRef.current) {
        handleAutoReconnect(device);
      }
    });
    setTimeout(() => {
      if (!isReconnectingRef.current) bleManager.stopDeviceScan();
    }, 60000);
  };

  const handleAutoReconnect = async (device) => {
    bleManager.stopDeviceScan();
    isReconnectingRef.current = true;
    console.log('🔄 [BLE] Balança encontrada, reconectando automaticamente...');
    try {
      const connected = await device.connect();
      deviceRef.current = connected;
      await connected.discoverAllServicesAndCharacteristics();
      const name = connected.name || connected.id;
      setConnectedDevice({ id: connected.id, name });
      setBleStatus('connected');
      isReconnectingRef.current = false;
      console.log('✅ [BLE] Balança reconectada:', name);
      await startWeightMonitor(connected);
      setupDisconnectListener(connected);
    } catch (reconnectErr) {
      console.warn('⚠️ [BLE] Reconexão automática falhou:', reconnectErr.message);
      isReconnectingRef.current = false;
      startAutoReconnectScan();
    }
  };

  // ── Listener de desconexão ──────────────────────────────────────────────────
  const setupDisconnectListener = (device) => {
    device.onDisconnected((disconnectErr) => {
      console.warn('⚠️ [BLE] onDisconnected:', disconnectErr?.message);
      _handleDisconnect();
    });
  };

  // ── Conectar manualmente ────────────────────────────────────────────────────
  const connectToDevice = async (device) => {
    bleManager.stopDeviceScan();
    setBleStatus('connecting');
    setErrorMsg('');
    try {
      const connected = await device.raw.connect();
      deviceRef.current = connected;
      lastDeviceIdRef.current = connected.id;
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice({ id: connected.id, name: connected.name || connected.id });
      setBleStatus('connected');
      console.log('✅ [BLE] Balança conectada:', connected.name || connected.id);
      await startWeightMonitor(connected);
      setupDisconnectListener(connected);
    } catch (connectErr) {
      console.error('Erro ao conectar:', connectErr);
      setErrorMsg(`Falha ao conectar: ${connectErr.message}`);
      setBleStatus('error');
      autoConnectingRef.current = false;
    }
  };

  // ── Descoberta de serviços ──────────────────────────────────────────────────
  const _discoverServices = async (device) => {
    console.log('\n══════════════════════════════════════════');
    console.log('[BLE DISCOVERY] Mapeando serviços da balança...');
    console.log('══════════════════════════════════════════');
    const services = await device.services();
    let matchedProfile = null;
    for (const service of services) {
      const chars = await service.characteristics();
      for (const char of chars) {
        console.log(
          `[BLE DISCOVERY] SERVICE: ${service.uuid}` +
          ` | CHAR: ${char.uuid}` +
          ` | notify=${char.isNotifiable}` +
          ` | indicate=${char.isIndicatable}` +
          ` | read=${char.isReadable}`
        );
      }
      if (!matchedProfile) {
        for (const profile of SCALE_PROFILES) {
          if (service.uuid.toLowerCase() !== profile.serviceUUID.toLowerCase()) continue;
          try {
            const chars2 = await device.characteristicsForService(profile.serviceUUID);
            const found = chars2.find(c =>
              c.uuid.toLowerCase() === profile.charUUID.toLowerCase() &&
              (c.isNotifiable || c.isIndicatable)
            );
            if (found) {
              matchedProfile = profile;
              console.log(`✅ [BLE] Perfil detectado: ${profile.name}`);
            }
          } catch (_) {}
        }
      }
    }
    if (!matchedProfile) console.warn('[BLE] Nenhum perfil conhecido encontrado.');
    console.log('══════════════════════════════════════════\n');
    return matchedProfile;
  };

  // ── Modo descoberta ─────────────────────────────────────────────────────────
  const _runDiscoveryMode = async (device) => {
    console.log('\n🔬 [DISCOVERY MODE ATIVO]');
    setErrorMsg('Modo descoberta ativo — veja o console para mapear os UUIDs.');
    try {
      const services = await device.services();
      for (const service of services) {
        const chars = await service.characteristics();
        for (const char of chars) {
          if (!char.isNotifiable && !char.isIndicatable) continue;
          console.log(`[DISCOVERY] Assinando → SERVICE: ${service.uuid} | CHAR: ${char.uuid}`);
          const sub = device.monitorCharacteristicForService(
            service.uuid,
            char.uuid,
            (err, c) => {
              if (err || !c?.value) return;
              const bytes = Buffer.from(c.value, 'base64');
              const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
              console.log(`[CALIBRATION] ← ANOTE O PESO NO VISOR AGORA`);
              console.log(`[CALIBRATION] UUID : ${char.uuid.slice(4, 8).toUpperCase()}`);
              console.log(`[CALIBRATION] bytes: ${hex}`);
              console.log(`[CALIBRATION] raw  : [${Array.from(bytes).join(', ')}]`);
              console.log(`[CALIBRATION] ─────────────────────────────────`);
              setRawBytes(`[${char.uuid.slice(4, 8).toUpperCase()}] ${hex}`);
              const plausible = CANDIDATE_DECODERS.filter(d => {
                try { const v = d.fn(bytes); return v >= 0 && v <= 5000 && isFinite(v); }
                catch (_) { return false; }
              });
              if (plausible.length > 0) {
                console.log(`[CALIBRATION] 💡 Fórmulas candidatas:`);
                plausible.forEach(d => {
                  console.log(`[CALIBRATION]   ${d.name.padEnd(20)} → ${d.fn(bytes).toFixed(2)} g`);
                });
                setWeight(parseFloat(plausible[0].fn(bytes).toFixed(1)));
                setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
              }
            }
          );
          discoverySubsRef.current.push(sub);
        }
      }
    } catch (err) {
      console.error('[DISCOVERY] Erro:', err.message);
    }
  };

  // ── Monitor de peso principal ───────────────────────────────────────────────
  const startWeightMonitor = async (device) => {
    _cleanupSubscriptions();
    setReadingStatus('listening');
    lastWeightRef.current  = null;
    waitingClearRef.current = false;
    isSleepingRef.current  = false;
    setActiveProfile(null);
    let profile = null;
    try {
      profile = await _discoverServices(device);
    } catch (err) {
      console.error('[BLE] Erro ao descobrir serviços:', err.message);
    }
    if (DISCOVERY_MODE) {
      await _runDiscoveryMode(device);
      if (profile) {
        setActiveProfile(profile);
        await _subscribeToProfile(device, profile);
      }
      return;
    }
    if (!profile) {
      console.warn('[BLE] Nenhum perfil detectado e DISCOVERY_MODE está desativado.');
      setErrorMsg('Balança não reconhecida. Ative DISCOVERY_MODE = true no context.js e rode novamente.');
      setBleStatus('error');
      return;
    }
    setActiveProfile(profile);
    await _subscribeToProfile(device, profile);
  };

  // ── Assina a característica de um perfil ───────────────────────────────────
  const _subscribeToProfile = async (device, profile) => {
    if (profile.activationChar && profile.activationCmd) {
      try {
        const cmdBase64 = Buffer.from(profile.activationCmd).toString('base64');
        await device.writeCharacteristicWithoutResponseForService(
          profile.serviceUUID,
          profile.activationChar,
          cmdBase64
        );
        console.log(
          `✅ [BLE] Ativação enviada → ${profile.activationChar.slice(4, 8).toUpperCase()}: ` +
          `[${profile.activationCmd.map(b => '0x' + b.toString(16).toUpperCase()).join(', ')}]`
        );
      } catch (err) {
        console.warn('⚠️ [BLE] Falha ao enviar ativação:', err.message);
      }
    }

    _startPing(device, profile);

    const _handleUnexpectedDisconnect = () => {
      if (stabilizeTimerRef.current) { clearTimeout(stabilizeTimerRef.current); stabilizeTimerRef.current = null; }
      subscriptionRef.current    = null;
      deviceRef.current          = null;
      isReconnectingRef.current  = false;
      isSleepingRef.current      = false;
      setBleStatus('reconnecting');
      setReadingStatus('idle');
      setActiveProfile(null);
      setWeight(null);
      if (lastDeviceIdRef.current) startAutoReconnectScan();
    };

    const subscription = device.monitorCharacteristicForService(
      profile.serviceUUID,
      profile.charUUID,
      (monitorErr, characteristic) => {
        if (monitorErr) {
          console.warn('⚠️ [BLE] Monitor encerrado:', monitorErr.message);
          if (!isReconnectingRef.current) _handleUnexpectedDisconnect();
          return;
        }
        if (!characteristic?.value) return;
        const bytes = Buffer.from(characteristic.value, 'base64');
        if (bytes.length < (profile.minPacketLength ?? 5)) {
          console.warn(`[BLE] Pacote curto ignorado: ${bytes.length} bytes`);
          return;
        }
        if (profile.headerByte !== undefined && bytes[0] !== profile.headerByte) {
          console.warn(`[BLE] Header inválido: 0x${bytes[0].toString(16).toUpperCase()}`);
          return;
        }
        const hexStr = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('-');
        setRawBytes(hexStr);
        let pesoGramas;
        try {
          pesoGramas = profile.decode(bytes);
        } catch (decodeErr) {
          console.warn('[BLE] Erro ao decodificar peso:', decodeErr.message);
          return;
        }
        if (!isFinite(pesoGramas) || pesoGramas < 0 || pesoGramas > 10000) {
          console.warn(`[BLE] Peso fora do range global: ${pesoGramas}g`);
          return;
        }
        if (profile.maxWeight !== undefined && pesoGramas > profile.maxWeight) {
          console.log(`😴 [BLE] Pacote de sleep detectado (${pesoGramas}g > ${profile.maxWeight}g)`);
          _handleSleep();
          return;
        }
        if (isSleepingRef.current) _handleWakeUp();
        const pesoArredondado = parseFloat(pesoGramas.toFixed(1));
        setWeight(pesoArredondado);
        setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
        if (waitingClearRef.current) {
          if (pesoArredondado < WEIGHT_CLEAR_THRESHOLD) {
            waitingClearRef.current = false;
            lastWeightRef.current   = pesoArredondado;
            setReadingStatus('listening');
          }
          return;
        }
        if (pesoArredondado !== lastWeightRef.current) {
          lastWeightRef.current = pesoArredondado;
          setReadingStatus('listening');
          if (stabilizeTimerRef.current) clearTimeout(stabilizeTimerRef.current);
          stabilizeTimerRef.current = setTimeout(() => {
            stabilizeTimerRef.current = null;
            if (pesoArredondado >= WEIGHT_CLEAR_THRESHOLD) {
              setReadingStatus('stable');
              waitingClearRef.current = true;
            }
          }, 2000);
        }
      }
    );
    subscriptionRef.current = subscription;
  };

  // ── Nova leitura ────────────────────────────────────────────────────────────
  const resumeMonitor = () => {
    if (!deviceRef.current) return;
    if (!subscriptionRef.current && discoverySubsRef.current.length === 0) {
      startWeightMonitor(deviceRef.current);
      return;
    }
    lastWeightRef.current   = null;
    waitingClearRef.current = true;
    if (stabilizeTimerRef.current) { clearTimeout(stabilizeTimerRef.current); stabilizeTimerRef.current = null; }
    setReadingStatus('waitingClear');
  };

  // ── Cancelar reconexão ──────────────────────────────────────────────────────
  const cancelReconnect = () => {
    isReconnectingRef.current = false;
    lastDeviceIdRef.current   = null;
    bleManager.stopDeviceScan();
    setBleStatus('idle');
    setConnectedDevice(null);
    setWeight(null);
    setRawBytes(null);
    setReadingStatus('idle');
    setActiveProfile(null);
  };

  const retryReconnectScan = () => {
    bleManager.stopDeviceScan();
    startAutoReconnectScan();
  };

  // ── Desconectar manualmente ─────────────────────────────────────────────────
  const disconnect = async () => {
    isReconnectingRef.current = false;
    lastDeviceIdRef.current   = null;
    waitingClearRef.current   = false;
    isSleepingRef.current     = false;
    autoConnectingRef.current = false;
    _cleanupSubscriptions();
    bleManager.stopDeviceScan();
    if (deviceRef.current) {
      try { await deviceRef.current.cancelConnection(); } catch (_) {}
      deviceRef.current = null;
    }
    setConnectedDevice(null);
    setBleStatus('idle');
    setDevices([]);
    setKnownDevices([]);
    setWeight(null);
    setRawBytes(null);
    setReadingStatus('idle');
    setActiveProfile(null);
    setErrorMsg('');
  };

  return (
    <BleContext.Provider value={{
      bleStatus,
      devices,
      knownDevices,
      connectedDevice,
      weight,
      rawBytes,
      readingStatus,
      lastUpdate,
      errorMsg,
      activeProfile,
      discoveryMode: DISCOVERY_MODE,
      startScan,
      startSmartScan,
      stopScan,
      connectToDevice,
      disconnect,
      cancelReconnect,
      retryReconnectScan,
      resumeMonitor,
    }}>
      {children}
    </BleContext.Provider>
  );
}
