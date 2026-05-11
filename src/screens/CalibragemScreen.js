import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { getAuth } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import BackButton from './BackButton';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBle } from '../context/context';

export default function CalibragemScreen() {
  const [pesoVazio, setPesoVazio] = useState('');
  const [pesoCheio, setPesoCheio] = useState('');
  const [tara, setTara] = useState('');
  const auth = getAuth();
  const navigation = useNavigation();

  // ─── INTEGRAÇÃO BLE ───────────────────────────────────────────────────────
  const { bleStatus, connectedDevice, weight, readingStatus, resumeMonitor } = useBle();

  // Qual campo receberá o peso da balança: 'vazio' | 'cheio' | null
  const [campoBleAtivo, setCampoBleAtivo] = useState(null);

  // Modal de confirmação BLE
  const [modalBleVisivel, setModalBleVisivel] = useState(false);
  const [pesoBleConfirmacao, setPesoBleConfirmacao] = useState(null);
  const lastBleWeightShown = useRef(null);

  // Quando o peso estabiliza, abre a modal (só se houver um campo ativo)
  useEffect(() => {
    if (
      readingStatus === 'stable' &&
      weight !== null &&
      weight !== lastBleWeightShown.current &&
      campoBleAtivo !== null &&
      !modalBleVisivel
    ) {
      lastBleWeightShown.current = weight;
      setPesoBleConfirmacao(weight);
      setModalBleVisivel(true);
    }
  }, [readingStatus, weight]);

  // Confirmar: preenche o campo ativo e prepara próxima leitura
  const confirmarPesoBle = () => {
    if (pesoBleConfirmacao === null) return;
    const valorStr = pesoBleConfirmacao.toFixed(1);
    if (campoBleAtivo === 'vazio') setPesoVazio(valorStr);
    if (campoBleAtivo === 'cheio') setPesoCheio(valorStr);
    setModalBleVisivel(false);
    setCampoBleAtivo(null);
    resumeMonitor();
  };

  // Cancelar: fecha modal e aguarda próximo 'stable'
  const cancelarPesoBle = () => {
    setModalBleVisivel(false);
    lastBleWeightShown.current = null;
    resumeMonitor();
  };
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!auth.currentUser) {
      console.log('Nenhum usuário autenticado encontrado');
    }
  }, []);

  const parseInput = (input) => {
    const sanitizedInput = input.replace(/[^0-9.]/g, '');
    return parseFloat(sanitizedInput);
  };

  useEffect(() => {
    const atualizarCalculos = () => {
      if (pesoVazio && pesoCheio) {
        const pesoVazioFloat = parseInput(pesoVazio);
        const pesoCheioFloat = parseInput(pesoCheio);
        if (isNaN(pesoVazioFloat) || isNaN(pesoCheioFloat)) {
          Alert.alert('Erro', 'Por favor, insira valores numéricos válidos.');
          return;
        }
        const taraCalculada = pesoCheioFloat - pesoVazioFloat;
        setTara(taraCalculada % 1 === 0 ? taraCalculada.toString() : taraCalculada.toFixed(3));
      } else {
        setTara('');
      }
    };
    atualizarCalculos();
  }, [pesoVazio, pesoCheio]);

  const registrarCalibragem = async () => {
    if (!pesoVazio || !pesoCheio || !tara) {
      Alert.alert("Erro", "Por favor, preencha todos os campos corretamente.");
      return;
    }
    try {
      if (!auth.currentUser) return;
      const calibragem = {
        pesoVazio, pesoCheio, tara,
        timestamp: new Date(),
        userId: auth.currentUser.uid,
      };
      await addDoc(collection(db, 'calibragens'), calibragem);
      await AsyncStorage.setItem('ultimaCalibragem', JSON.stringify(calibragem));
      Alert.alert("Sucesso", "Calibragem registrada com sucesso.");
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível salvar a calibragem.");
    }
  };

  // Label descritivo para a modal
  const labelCampo = campoBleAtivo === 'vazio' ? 'Copo vazio' : 'Copo cheio (com água)';

  return (
    <View style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={styles.titulo}>Calibrar Projeto</Text>
      <View style={styles.linha} />
      <Text style={styles.instrucao}>Insira os dados abaixo</Text>

      {/* Status da balança BLE */}
      <TouchableOpacity
        style={[styles.bleStatus, bleStatus === 'connected' ? styles.bleConnected : styles.bleDisconnected]}
        onPress={() => navigation.navigate('ScaleConnect')}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons
          name={bleStatus === 'connected' ? 'bluetooth-connect' : 'bluetooth-off'}
          size={16}
          color={bleStatus === 'connected' ? '#fff' : '#aaa'}
        />
        <Text style={[styles.bleStatusText, bleStatus !== 'connected' && { color: '#aaa' }]}>
          {bleStatus === 'connected'
            ? `Balança: ${connectedDevice?.name ?? 'Conectada'} — toque no campo desejado`
            : bleStatus === 'reconnecting'
              ? 'Reconectando à balança...'
              : 'Balança não conectada — toque para conectar'}
        </Text>
      </TouchableOpacity>

      {/* Input: peso vazio */}
      <Text style={styles.inputLabel}>Peso do copo vazio</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => bleStatus === 'connected' && setCampoBleAtivo('vazio')}
      >
        <TextInput
          style={[
            styles.input,
            campoBleAtivo === 'vazio' && styles.inputAtivo,
          ]}
          placeholder="Ex: 150.0 g"
          keyboardType="numeric"
          value={pesoVazio}
          onChangeText={setPesoVazio}
          onFocus={() => bleStatus === 'connected' && setCampoBleAtivo('vazio')}
        />
      </TouchableOpacity>
      {bleStatus === 'connected' && (
        <TouchableOpacity
          style={[styles.bleFieldBtn, campoBleAtivo === 'vazio' && styles.bleFieldBtnAtivo]}
          onPress={() => setCampoBleAtivo(campoBleAtivo === 'vazio' ? null : 'vazio')}
        >
          <MaterialCommunityIcons
            name="scale"
            size={14}
            color={campoBleAtivo === 'vazio' ? '#fff' : '#4CAF50'}
          />
          <Text style={[styles.bleFieldBtnText, campoBleAtivo === 'vazio' && { color: '#fff' }]}>
            {campoBleAtivo === 'vazio' ? 'Aguardando balança...' : 'Usar balança para este campo'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Input: peso cheio */}
      <Text style={styles.inputLabel}>Peso do copo cheio (com água)</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => bleStatus === 'connected' && setCampoBleAtivo('cheio')}
      >
        <TextInput
          style={[
            styles.input,
            campoBleAtivo === 'cheio' && styles.inputAtivo,
          ]}
          placeholder="Ex: 350.0 g"
          keyboardType="numeric"
          value={pesoCheio}
          onChangeText={setPesoCheio}
          onFocus={() => bleStatus === 'connected' && setCampoBleAtivo('cheio')}
        />
      </TouchableOpacity>
      {bleStatus === 'connected' && (
        <TouchableOpacity
          style={[styles.bleFieldBtn, campoBleAtivo === 'cheio' && styles.bleFieldBtnAtivo]}
          onPress={() => setCampoBleAtivo(campoBleAtivo === 'cheio' ? null : 'cheio')}
        >
          <MaterialCommunityIcons
            name="scale"
            size={14}
            color={campoBleAtivo === 'cheio' ? '#fff' : '#4CAF50'}
          />
          <Text style={[styles.bleFieldBtnText, campoBleAtivo === 'cheio' && { color: '#fff' }]}>
            {campoBleAtivo === 'cheio' ? 'Aguardando balança...' : 'Usar balança para este campo'}
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.label}>Tara Calculada: {tara ? `${tara} g` : '---'}</Text>

      <TouchableOpacity style={styles.button} onPress={registrarCalibragem}>
        <Ionicons name="checkmark-circle" size={24} color="white" style={styles.icon} />
        <Text style={styles.buttonText}>Registrar Calibragem</Text>
      </TouchableOpacity>

      {/* ── Modal: confirmação de peso via BLE ────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={modalBleVisivel}
        onRequestClose={cancelarPesoBle}
        statusBarTranslucent
      >
        <View style={styles.bleModalOverlay}>
          <View style={styles.bleModalCard}>

            <View style={styles.bleModalHeader}>
              <View style={styles.bleModalIconCircle}>
                <MaterialCommunityIcons name="scale" size={28} color="#fff" />
              </View>
              <Text style={styles.bleModalTitle}>Peso estabilizado</Text>
              <Text style={styles.bleModalSubtitle}>{labelCampo}</Text>
            </View>

            <View style={styles.bleModalWeightRow}>
              <Text style={styles.bleModalWeightValue}>{pesoBleConfirmacao?.toFixed(1)}</Text>
              <Text style={styles.bleModalWeightUnit}>g</Text>
            </View>

            <View style={styles.bleModalActions}>
              <TouchableOpacity
                style={[styles.bleModalBtn, styles.bleModalBtnCancel]}
                onPress={cancelarPesoBle}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="close" size={20} color="#666" />
                <Text style={styles.bleModalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bleModalBtn, styles.bleModalBtnConfirm]}
                onPress={confirmarPesoBle}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                <Text style={styles.bleModalBtnConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  titulo: {
    fontSize: 24,
    color: '#F67D22',
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  linha: {
    borderBottomColor: '#F67D22',
    borderBottomWidth: 2,
    marginVertical: 5,
    alignSelf: 'center',
    width: '90%',
  },
  instrucao: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 18,
  },

  // Status BLE
  bleStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10, marginBottom: 20,
  },
  bleConnected: { backgroundColor: '#4CAF50' },
  bleDisconnected: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0' },
  bleStatusText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#fff' },

  // Inputs
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFF',
    borderColor: '#CCC',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 6,
    fontSize: 18,
  },
  inputAtivo: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },

  // Botão de campo BLE
  bleFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    marginBottom: 16,
  },
  bleFieldBtnAtivo: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  bleFieldBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },

  label: {
    fontSize: 18,
    marginBottom: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F67D22',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 20,
    marginLeft: 5,
  },
  icon: {
    marginRight: 5,
  },

  // ── Modal BLE ──────────────────────────────────────────────────────────────
  bleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  bleModalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  bleModalHeader: { alignItems: 'center', marginBottom: 20 },
  bleModalIconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#4CAF50',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  bleModalTitle: { fontSize: 20, fontWeight: '800', color: '#222' },
  bleModalSubtitle: { fontSize: 13, color: '#aaa', marginTop: 4 },
  bleModalWeightRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 28,
  },
  bleModalWeightValue: { fontSize: 72, fontWeight: '800', color: '#FF5C00', lineHeight: 80 },
  bleModalWeightUnit: { fontSize: 30, fontWeight: '400', color: '#ccc', marginBottom: 10, marginLeft: 6 },
  bleModalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  bleModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  bleModalBtnCancel: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0' },
  bleModalBtnCancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  bleModalBtnConfirm: { backgroundColor: '#4CAF50' },
  bleModalBtnConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});