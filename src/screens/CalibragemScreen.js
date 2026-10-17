import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import BackButton from './BackButton';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBle } from '../context/context';
import { useAppAuth } from '../context/auth';
import { useReferenceData } from '../context/referenceData';
import { paraDecimal } from '../helpers/numeros';
import { calcularTara, normalizarCalibragem } from '../helpers/calibragem';
import { guardarCalibragemNoAparelho } from '../calibragemLocal';
import { registrarCalibragemNoBanco } from '../calibragensPendentes';
import { useLeituraDaBalanca } from '../hooks/useLeituraDaBalanca';

const ORDEM_DOS_CAMPOS = ['vazio', 'cheio'];

export default function CalibragemScreen() {
  const [pesoVazio, setPesoVazio] = useState('');
  const [pesoCheio, setPesoCheio] = useState('');
  const [tara, setTara] = useState('');
  const [salvando, setSalvando] = useState(false);
  const navigation = useNavigation();

  const { companyId, uid } = useAppAuth();
  const { bleStatus, connectedDevice, weight } = useBle();
  const { ultimaCalibragem, setUltimaCalibragem } = useReferenceData();

  const balancaConectada = bleStatus === 'connected';
  const { campoAtivo, pesoParaConfirmar, confirmarPeso, recusarPeso, alternarCampo, digitarNoCampo } = useLeituraDaBalanca({
    conectada: balancaConectada,
    peso: weight,
    ordemDosCampos: ORDEM_DOS_CAMPOS,
    valores: { vazio: pesoVazio, cheio: pesoCheio },
    preencherCampo: (campo, texto) => (campo === 'vazio' ? setPesoVazio : setPesoCheio)(texto),
  });

  const ultimaCalibragemInfo = ultimaCalibragem ? {
    data: ultimaCalibragem.timestamp,
    tara: ultimaCalibragem.tara,
    horasAtras: Math.floor(Math.abs(new Date() - ultimaCalibragem.timestamp) / 36e5),
  } : null;

  useEffect(() => {
    if (!pesoVazio || !pesoCheio) {
      setTara('');
      return;
    }
    const pesoVazioNumero = paraDecimal(pesoVazio);
    const pesoCheioNumero = paraDecimal(pesoCheio);
    if (isNaN(pesoVazioNumero) || isNaN(pesoCheioNumero)) {
      setTara('');
      Alert.alert('Erro', 'Por favor, insira valores numéricos válidos.');
      return;
    }
    setTara(String(calcularTara(pesoVazioNumero, pesoCheioNumero)));
  }, [pesoVazio, pesoCheio]);

  const registrarCalibragem = async () => {
    if (salvando) return;
    if (!pesoVazio || !pesoCheio || !tara) {
      Alert.alert("Erro", "Por favor, preencha todos os campos corretamente.");
      return;
    }
    if (!uid || !companyId) {
      Alert.alert("Erro", "Usuário não identificado. Feche e abra o app novamente.");
      return;
    }
    setSalvando(true);
    try {
      const calibragem = {
        pesoVazio: paraDecimal(pesoVazio),
        pesoCheio: paraDecimal(pesoCheio),
        tara: paraDecimal(tara),
        timestamp: new Date(),
      };

      const calibragemNormalizada = normalizarCalibragem(calibragem);
      await guardarCalibragemNoAparelho(companyId, calibragemNormalizada);
      setUltimaCalibragem(calibragemNormalizada);

      await registrarCalibragemNoBanco({ ...calibragem, userId: uid, companyId });
      Alert.alert("Sucesso", "Calibragem registrada com sucesso.");
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível salvar a calibragem.");
    } finally {
      setSalvando(false);
    }
  };

  const formatarDataCalibragem = (ts) => {
    const d = String(ts.getDate()).padStart(2, '0');
    const m = String(ts.getMonth() + 1).padStart(2, '0');
    const y = ts.getFullYear();
    const h = String(ts.getHours()).padStart(2, '0');
    const min = String(ts.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} às ${h}:${min}`;
  };

  return (
    <View style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={styles.titulo}>Calibrar Projeto</Text>
      <View style={styles.linha} />
      <Text style={styles.instrucao}>Insira os dados abaixo</Text>

      {ultimaCalibragemInfo ? (
        <View style={[
          styles.ultimaCalibragemCard,
          ultimaCalibragemInfo.horasAtras > 14 ? styles.ultimaCalibragemVencida : styles.ultimaCalibragemOk,
        ]}>
          <MaterialCommunityIcons
            name={ultimaCalibragemInfo.horasAtras > 14 ? 'alert-circle-outline' : 'check-circle-outline'}
            size={18}
            color={ultimaCalibragemInfo.horasAtras > 14 ? '#D32F2F' : '#4CAF50'}
          />
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.ultimaCalibragemTexto,
              { color: ultimaCalibragemInfo.horasAtras > 14 ? '#D32F2F' : '#4CAF50' },
            ]}>
              {ultimaCalibragemInfo.horasAtras > 14 ? 'Necessita nova calibragem' : 'Calibragem OK'}
            </Text>
            <Text style={styles.ultimaCalibragemSub}>
              Última: {formatarDataCalibragem(ultimaCalibragemInfo.data)}
              {' '}({ultimaCalibragemInfo.horasAtras}h atrás · tara {ultimaCalibragemInfo.tara} g)
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.ultimaCalibragemCard, styles.ultimaCalibragemVencida]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#D32F2F" />
          <Text style={[styles.ultimaCalibragemTexto, { color: '#D32F2F' }]}>
            Nenhuma calibragem encontrada para esta empresa
          </Text>
        </View>
      )}

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
            ? `Balança: ${connectedDevice?.name ?? 'Conectada'}`
            : bleStatus === 'reconnecting'
              ? 'Reconectando à balança...'
              : 'Balança não conectada — toque para conectar'}
        </Text>
      </TouchableOpacity>

      <CampoDePeso
        rotulo="Peso do copo vazio"
        placeholder="Ex: 150 g"
        valor={pesoVazio}
        aoDigitar={setPesoVazio}
        aoFocar={() => digitarNoCampo('vazio')}
        balancaConectada={balancaConectada}
        lendoBalanca={campoAtivo === 'vazio'}
        aoAlternarBalanca={() => alternarCampo('vazio')}
      />

      <CampoDePeso
        rotulo="Peso do copo cheio (com água)"
        placeholder="Ex: 350 g"
        valor={pesoCheio}
        aoDigitar={setPesoCheio}
        aoFocar={() => digitarNoCampo('cheio')}
        balancaConectada={balancaConectada}
        lendoBalanca={campoAtivo === 'cheio'}
        aoAlternarBalanca={() => alternarCampo('cheio')}
      />

      <TouchableOpacity
        style={[styles.button, salvando && styles.buttonDesabilitado]}
        onPress={registrarCalibragem}
        disabled={salvando}
      >
        <Ionicons name="checkmark-circle" size={24} color="white" style={styles.icon} />
        <Text style={styles.buttonText}>{salvando ? 'Salvando...' : 'Registrar Calibragem'}</Text>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent
        visible={pesoParaConfirmar !== null}
        onRequestClose={recusarPeso}
        statusBarTranslucent
      >
        <View style={styles.bleModalOverlay}>
          <View style={styles.bleModalCard}>
            <View style={styles.bleModalHeader}>
              <View style={styles.bleModalIconCircle}>
                <MaterialCommunityIcons name="scale" size={28} color="#fff" />
              </View>
              <Text style={styles.bleModalTitle}>Peso estabilizado</Text>
              <Text style={styles.bleModalSubtitle}>{campoAtivo === 'vazio' ? 'Copo vazio' : 'Copo cheio (com água)'}</Text>
            </View>
            <View style={styles.bleModalWeightRow}>
              <Text style={styles.bleModalWeightValue}>{pesoParaConfirmar !== null && Math.round(pesoParaConfirmar)}</Text>
              <Text style={styles.bleModalWeightUnit}>g</Text>
            </View>
            <View style={styles.bleModalActions}>
              <TouchableOpacity
                style={[styles.bleModalBtn, styles.bleModalBtnCancel]}
                onPress={recusarPeso}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="close" size={20} color="#666" />
                <Text style={styles.bleModalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bleModalBtn, styles.bleModalBtnConfirm]}
                onPress={confirmarPeso}
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

function CampoDePeso({ rotulo, placeholder, valor, aoDigitar, aoFocar, balancaConectada, lendoBalanca, aoAlternarBalanca }) {
  return (
    <>
      <Text style={styles.inputLabel}>{rotulo}</Text>
      <TextInput
        style={[styles.input, lendoBalanca && styles.inputAtivo]}
        placeholder={lendoBalanca ? 'Coloque o copo na balança' : placeholder}
        placeholderTextColor="#888888"
        keyboardType="numeric"
        value={valor}
        onChangeText={aoDigitar}
        onFocus={aoFocar}
      />
      {balancaConectada && (
        <TouchableOpacity
          style={[styles.bleFieldBtn, lendoBalanca && styles.bleFieldBtnAtivo]}
          onPress={aoAlternarBalanca}
        >
          <MaterialCommunityIcons
            name="scale"
            size={14}
            color={lendoBalanca ? '#fff' : '#4CAF50'}
          />
          <Text style={[styles.bleFieldBtnText, lendoBalanca && { color: '#fff' }]}>
            {lendoBalanca ? 'Lendo balança...' : 'Usar balança para este campo'}
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#FFF',
    marginTop: 36,
  },
  titulo: {
    fontSize: 24,
    color: '#1F6452',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
  },
  linha: {
    borderBottomColor: '#1F6452',
    borderBottomWidth: 2,
    marginVertical: 3,
    alignSelf: 'center',
    width: '90%',
  },
  instrucao: {
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 18,
  },
  ultimaCalibragemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  ultimaCalibragemOk: {
    backgroundColor: '#f0faf0',
    borderColor: '#4CAF50',
  },
  ultimaCalibragemVencida: {
    backgroundColor: '#fff5f0',
    borderColor: '#D32F2F',
  },
  ultimaCalibragemTexto: {
    fontSize: 13,
    fontWeight: '700',
  },
  ultimaCalibragemSub: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  bleStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10, marginBottom: 20,
  },
  bleConnected: { backgroundColor: '#4CAF50' },
  bleDisconnected: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0' },
  bleStatusText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#fff' },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  input: {
    color: '#000000',
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F6452',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  buttonDesabilitado: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 20,
    marginLeft: 5,
  },
  icon: {
    marginRight: 5,
  },
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
  bleModalWeightValue: { fontSize: 72, fontWeight: '800', color: '#1F6452', lineHeight: 80 },
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
