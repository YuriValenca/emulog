import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Modal, Alert, StatusBar,
} from 'react-native';
import { db } from '../firebaseConfig';
import { collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BackButton from './BackButton';
import ScrollToTopButton from './ScrollToTopButton';
import NetInfo from "@react-native-community/netinfo";
import { saveProjectOffline, checkConnectionAndSync } from '../db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBle } from '../context/context';
import { ProjetoFormProvider, useProjetoForm } from '../context/form';
import StepPesagens from './StepPesagens';
import InformacoesOperacao from './InformacoesOperacao';

function NovaAmostraScreenInner() {
  const [currentStep, setCurrentStep] = useState(1);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [modalMensagem, setModalMensagem] = useState('');
  const [modalDensidade, setModalDensidade] = useState('');
  const [temporizador] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [modalAvisoVisivel, setModalAvisoVisivel] = useState(false);
  const [mensagemAviso, setMensagemAviso] = useState('');
  const [amostraPesquisa, setAmostraPesquisa] = useState('');
  const [modalAdicionarAmostra, setModalAdicionarAmostra] = useState(false);
  const [modalConfirmacaoVisivel, setModalConfirmacaoVisivel] = useState(false);
  const [modalProjetoExistenteVisivel, setModalProjetoExistenteVisivel] = useState(false);
  const [modalInformacoesAdicionaisVisivel, setModalInformacoesAdicionaisVisivel] = useState(false);

  const [modalBleVisivel, setModalBleVisivel] = useState(false);
  const [pesoBleConfirmacao, setPesoBleConfirmacao] = useState(null);
  const lastBleWeightShown = useRef(null);

  const scrollViewRef = useRef(null);
  const navigation = useNavigation();

  const { bleStatus, weight, readingStatus, resumeMonitor } = useBle();

  const {
    nomeProjeto,
    quantidadeAmostras, setQuantidadeAmostras,
    amostras, setAmostras,
    amostraAtual, setAmostraAtual,
    pesagemAtual, setPesagemAtual,
    peso, setPeso,
    observacao,
    ultimaCalibragem, setUltimaCalibragem,
    uidUsuario, setUidUsuario,
    numeroNF, kgPrevisto, kgAplicado,
    caminhaoSelecionado, equipeSelecionada,
    salvarEstadoDoProjeto,
    limparEstadoDoProjeto,
    resetarFormulario,
    restaurarDoStorage,
  } = useProjetoForm();

  const todasPesagensConcluidas = amostras.every(
    a => a && a.filter(p => p.peso !== '').length === 5
  );

  const podeAvancar = amostras.every(
    a => a && a.filter(p => p.peso !== '').length >= 4
  );

  useEffect(() => {
    if (
      readingStatus === 'stable' &&
      weight !== null &&
      weight !== lastBleWeightShown.current &&
      !modalBleVisivel
    ) {
      lastBleWeightShown.current = weight;
      setPesoBleConfirmacao(weight);
      setModalBleVisivel(true);
    }
  }, [readingStatus, weight]);

  const confirmarPesagemBle = () => {
    setModalBleVisivel(false);
    if (pesoBleConfirmacao === null) return;
    confirmarPesagemComValor(String(pesoBleConfirmacao.toFixed(1)));
    resumeMonitor();
  };

  const cancelarPesagemBle = () => {
    setModalBleVisivel(false);
    lastBleWeightShown.current = null;
    resumeMonitor();
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUidUsuario(user.uid);
        await AsyncStorage.setItem('uidUsuario', user.uid);
      } else {
        const storedUid = await AsyncStorage.getItem('uidUsuario');
        if (storedUid) setUidUsuario(storedUid);
      }
    });
    checkConnectionAndSync();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const buscarUltimaCalibragem = async () => {
      try {
        const connectionState = await NetInfo.fetch();
        if (connectionState.isConnected) {
          const q = query(collection(db, "calibragens"), orderBy("timestamp", "desc"), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const calibragemDoc = querySnapshot.docs[0].data();
            const calibragemData = new Date(
              calibragemDoc.timestamp.seconds * 1000 + calibragemDoc.timestamp.nanoseconds / 1000000
            );
            const horasDesdeCalibragem = Math.abs(new Date() - calibragemData) / 36e5;
            const necessitaCalibragem = horasDesdeCalibragem > 14;
            const dados = {
              tara: calibragemDoc.tara,
              pesoCheio: calibragemDoc.pesoCheio,
              pesoVazio: calibragemDoc.pesoVazio,
              timestamp: calibragemData,
              necessitaCalibragem,
            };
            setUltimaCalibragem(dados);
            await AsyncStorage.setItem('ultimaCalibragem', JSON.stringify({
              ...dados, timestamp: calibragemData.toISOString(),
            }));
          }
        } else {
          const calibragemOffline = await AsyncStorage.getItem('ultimaCalibragem');
          if (calibragemOffline) {
            const calibragem = JSON.parse(calibragemOffline);
            const calibragemData = new Date(calibragem.timestamp);
            const horasDesdeCalibragem = Math.abs(new Date() - calibragemData) / 36e5;
            setUltimaCalibragem({
              ...calibragem,
              timestamp: calibragemData,
              necessitaCalibragem: horasDesdeCalibragem > 14,
            });
          }
        }
      } catch (error) {
        console.error("Erro ao buscar calibragem:", error);
      }
    };
    buscarUltimaCalibragem();
  }, []);

  useEffect(() => {
    const init = async () => {
      const tinha = await restaurarDoStorage();
      if (tinha) setModalProjetoExistenteVisivel(true);
    };
    init();
  }, []);

  const calcularDensidade = (pesoVal) => {
    if (!ultimaCalibragem) {
      setMensagemAviso("Calibragem não disponível.");
      setModalAvisoVisivel(true);
      return 0;
    }
    const tara = parseFloat(ultimaCalibragem.tara);
    const pesoVazio = parseFloat(ultimaCalibragem.pesoVazio);
    const pesoMedido = parseFloat(pesoVal);
    if (isNaN(tara) || isNaN(pesoVazio) || isNaN(pesoMedido)) {
      setMensagemAviso("Erro na calibragem ou na entrada de peso. Valores devem ser numéricos.");
      setModalAvisoVisivel(true);
      return 0;
    }
    return ((pesoMedido - pesoVazio) / tara).toFixed(3);
  };

  const confirmarPesagemComValor = (pesoStr) => {
    if (!pesoStr) {
      setMensagemAviso("Peso não pode ser vazio.");
      setModalAvisoVisivel(true);
      return;
    }
    const pesoFloat = parseFloat(pesoStr);
    if (isNaN(pesoFloat)) {
      setMensagemAviso("Peso deve ser um valor numérico.");
      setModalAvisoVisivel(true);
      return;
    }

    const amostraArray = amostras[amostraAtual] || [];
    const pesagensFeitas = amostraArray.filter(p => p.peso !== '').length;
    const pesagemCorreta = pesagensFeitas + 1;

    if (pesagemCorreta > 5) {
      setMensagemAviso("Todas as pesagens desta amostra já foram concluídas.");
      setModalAvisoVisivel(true);
      return;
    }

    if (pesagemCorreta !== pesagemAtual) setPesagemAtual(pesagemCorreta);

    if (pesagemCorreta > 1 && pesagemCorreta < 5) {
      const pesagemAnterior = amostraArray[pesagemCorreta - 2];
      if (pesagemAnterior?.peso && pesoFloat > parseFloat(pesagemAnterior.peso)) {
        setMensagemAviso(
          `Peso inválido!\n\nPesagem ${pesagemCorreta} (${pesoFloat}g) é maior que a Pesagem ${pesagemCorreta - 1} (${pesagemAnterior.peso}g).\n\nAs pesagens subsequentes devem ser iguais ou menores que a anterior.`
        );
        setModalAvisoVisivel(true);
        return;
      }
    }

    const densidadeCalculada = calcularDensidade(pesoFloat);
    const timestamp = new Date().toLocaleTimeString();
    const pesagem = { peso: String(pesoFloat), densidade: densidadeCalculada, timestamp };

    const novasAmostras = amostras.map((a, i) => {
      if (i !== amostraAtual) return a;
      return a.map((p, j) => (j === pesagemCorreta - 1 ? pesagem : p));
    });

    setAmostras(novasAmostras);
    setPeso('');

    const todasConcluidas = novasAmostras.every(a => a && a.filter(p => p.peso !== '').length >= 4);

    if (pesagemCorreta < 5) {
      setPesagemAtual(pesagemCorreta + 1);
      if (pesagemCorreta === 4) {
        setModalMensagem(`Amostra ${amostraAtual + 1} - Pesagem ${pesagemCorreta} concluída. A 5ª pesagem é opcional.`);
      } else {
        setModalMensagem(`Amostra ${amostraAtual + 1} - Pesagem ${pesagemCorreta} concluída.`);
      }
    } else if (amostraAtual < quantidadeAmostras - 1) {
      setAmostraAtual(amostraAtual + 1);
      setPesagemAtual(1);
      setModalMensagem(`Amostra ${amostraAtual + 1} concluída.`);
    } else {
      setModalMensagem(
        todasConcluidas
          ? "Todas as pesagens foram concluídas. Avance para o próximo passo!"
          : "Pesagens concluídas para esta amostra."
      );
    }

    setModalDensidade(densidadeCalculada);
    setModalVisivel(true);
    salvarEstadoDoProjeto();
  };

  const confirmarPesagem = () => confirmarPesagemComValor(peso);

  const verificarPesagensIncompletas = () => {
    const msgs = amostras
      .map((amostra, index) => {
        if (amostra) {
          const feitas = amostra.filter(p => p.peso !== '').length;
          if (feitas < 4) {
            const faltam = 4 - feitas;
            return `Amostra ${index + 1}: faltam ${faltam} pesagem${faltam !== 1 ? 'ns' : ''} obrigatória${faltam !== 1 ? 's' : ''}.`;
          }
        } else {
          return `Amostra ${index + 1} está vazia ou corrompida.`;
        }
        return null;
      })
      .filter(Boolean);
    return msgs.length > 0 ? msgs.join('\n') : null;
  };

  const prepararDadosDoProjetoParaSalvar = () => {
    const amostrasPlanificadas = amostras.map((amostra, i) => ({ amostraId: i, pesagens: amostra }));
    return {
      nomeProjeto: nomeProjeto.trim(),
      dataCriacao: new Date(),
      uidUsuario,
      calibragem: {
        tara: ultimaCalibragem?.tara || 0,
        pesoCheio: ultimaCalibragem?.pesoCheio || 0,
        densidade: ultimaCalibragem?.densidade || 0,
        timestamp: ultimaCalibragem?.timestamp || new Date(),
        necessitaCalibragem: ultimaCalibragem?.necessitaCalibragem || false,
      },
      quantidadeAmostras,
      amostras: amostrasPlanificadas,
      observacao,
      informacoesOperacao: {
        numeroNF,
        kgPrevisto,
        kgAplicado,
        caminhao: caminhaoSelecionado,
        equipe: equipeSelecionada,
      },
    };
  };

  const salvarProjeto = async () => {
    const dadosDoProjeto = prepararDadosDoProjetoParaSalvar();
    if (!uidUsuario) {
      Alert.alert("Erro", "Usuário não autenticado. Por favor, faça login novamente.");
      return;
    }
    try {
      const connectionState = await NetInfo.fetch();
      if (connectionState.isConnected) {
        try {
          await addDoc(collection(db, 'projetos'), dadosDoProjeto);
          Alert.alert("Sucesso", "Projeto salvo com sucesso!");
          resetarFormulario();
          limparEstadoDoProjeto();
          navigation.replace('Home');
        } catch {
          Alert.alert("Erro", "Não foi possível salvar o projeto. Tente novamente.");
        }
      } else {
        try {
          await saveProjectOffline(dadosDoProjeto);
          Alert.alert("App Offline", "Os dados foram salvos no dispositivo!\n\nConecte o App no Wi-Fi ou dados para salvar as informações no banco de dados.");
          resetarFormulario();
          limparEstadoDoProjeto();
          navigation.replace('Home');
        } catch {
          Alert.alert("Erro", "Não foi possível salvar o projeto offline. Tente novamente.");
        }
      }
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o projeto. Tente novamente.");
    }
  };

  const finalizarOuSalvar = async () => {
    if (!nomeProjeto.trim()) {
      setMensagemAviso("O nome do projeto não pode estar vazio.");
      setModalAvisoVisivel(true);
      return;
    }
    const algumaAmostraCompleta = amostras.some(a => a && a.filter(p => p.peso !== '').length >= 4);
    if (!algumaAmostraCompleta) {
      setMensagemAviso("Pelo menos uma amostra com 4 pesagens é necessária.");
      setModalAvisoVisivel(true);
      return;
    }
    const pesagensIncompletas = verificarPesagensIncompletas();
    if (pesagensIncompletas) {
      setMensagemAviso(`Pesagens Incompletas:\n${pesagensIncompletas}\n\nDeseja salvar mesmo assim?`);
      setModalAvisoVisivel(true);
    } else {
      setModalConfirmacaoVisivel(true);
    }
  };

  const adicionarAmostra = () => {
    setQuantidadeAmostras(quantidadeAmostras + 1);
    setAmostras([...amostras, Array.from({ length: 5 }, () => ({ peso: '', densidade: '', timestamp: '' }))]);
    setModalAdicionarAmostra(false);
    salvarEstadoDoProjeto();
  };

  const handleScroll = (event) => {
    setShowScrollButton(event.nativeEvent.contentOffset.y > 200);
  };

  const scrollToTop = () => {
    if (scrollViewRef.current) scrollViewRef.current.scrollTo({ y: 0, animated: true });
  };

  const handleAvancarStep = () => {
    if (!nomeProjeto) {
      setMensagemAviso("O nome do projeto não pode estar vazio.");
      setModalAvisoVisivel(true);
      return;
    }
    const algumaAmostraCompleta = amostras.some(a => a && a.filter(p => p.peso !== '').length >= 4);
    if (!algumaAmostraCompleta) {
      setMensagemAviso("Pelo menos uma amostra com 4 pesagens é necessária para avançar.");
      setModalAvisoVisivel(true);
      return;
    }
    setModalInformacoesAdicionaisVisivel(true);
  };

  const confirmarIrParaStep2 = () => {
    setModalInformacoesAdicionaisVisivel(false);
    scrollToTop();
    setCurrentStep(2);
  };

  const recusarStep2EFinalizar = () => {
    setModalInformacoesAdicionaisVisivel(false);
    finalizarOuSalvar();
  };

  const amostraArray = amostras[amostraAtual] || [];
  const pesagensFeitas = amostraArray.filter(p => p.peso !== '').length;
  const proximaPesagem = pesagensFeitas + 1;

  const historicoPesagens = amostras.map((grupoAmostras, indexGrupo) => {
    const amostra = grupoAmostras || [];
    return (
      <View key={indexGrupo} style={styles.historicoGrupo}>
        <Text style={styles.historicoTitulo}>Amostra {indexGrupo + 1}</Text>
        {amostra.map((pesagem, indexPesagem) => (
          <View key={indexPesagem} style={styles.tableRow}>
            <Text style={styles.historicoPesagemBold}>Pesagem {indexPesagem + 1}:</Text>
            <Text> {pesagem.peso ? `${pesagem.peso} g` : '—'}</Text>
            <Text> {pesagem.densidade ? `${pesagem.densidade} g/cm³` : ''}</Text>
            <Text> {pesagem.timestamp}</Text>
          </View>
        ))}
      </View>
    );
  });

  const historicoFiltrado = historicoPesagens.filter((_, index) => {
    if (!amostraPesquisa) return true;
    return `Amostra ${index + 1}`.toLowerCase().includes(amostraPesquisa.toLowerCase());
  });

  const bleBarHeight = (bleStatus === 'connected' || bleStatus === 'reconnecting')
    ? (StatusBar.currentHeight ?? 24) + 42
    : 30;

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      <View style={styles.stepIndicatorRow}>
        <View style={[styles.stepCircle, currentStep >= 1 && styles.stepCircleActive]}>
          <Text style={[styles.stepCircleText, currentStep >= 1 && styles.stepCircleTextActive]}>1</Text>
        </View>
        <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
        <View style={[styles.stepCircle, currentStep >= 2 && styles.stepCircleActive]}>
          <Text style={[styles.stepCircleText, currentStep >= 2 && styles.stepCircleTextActive]}>2</Text>
        </View>
      </View>
      <View style={styles.stepLabelsRow}>
        <Text style={[styles.stepLabel, currentStep === 1 && styles.stepLabelActive]}>Pesagens</Text>
        <Text style={[styles.stepLabel, currentStep === 2 && styles.stepLabelActive]}>Informações</Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: bleBarHeight + 24 }]}
      ref={scrollViewRef}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={styles.titulo}>Iniciar Novo Projeto</Text>

      {renderStepIndicator()}

      {currentStep === 1 ? (
        <StepPesagens
          ultimaCalibragem={ultimaCalibragem}
          modalAvisoVisivel={modalAvisoVisivel}
          setModalAvisoVisivel={setModalAvisoVisivel}
          mensagemAviso={mensagemAviso}
          setMensagemAviso={setMensagemAviso}
          modalVisivel={modalVisivel}
          setModalVisivel={setModalVisivel}
          modalMensagem={modalMensagem}
          modalDensidade={modalDensidade}
          modalAdicionarAmostra={modalAdicionarAmostra}
          setModalAdicionarAmostra={setModalAdicionarAmostra}
          onConfirmarPesagem={confirmarPesagem}
          onAdicionarAmostra={adicionarAmostra}
          onAvancar={handleAvancarStep}
          todasPesagensConcluidas={todasPesagensConcluidas}
          podeAvancar={podeAvancar}
          temporizador={temporizador}
          amostraPesquisa={amostraPesquisa}
          setAmostraPesquisa={setAmostraPesquisa}
          historicoFiltrado={historicoFiltrado}
        />
      ) : (
        <InformacoesOperacao
          onVoltar={() => { scrollToTop(); setCurrentStep(1); }}
          onSalvar={finalizarOuSalvar}
        />
      )}

      {showScrollButton && <ScrollToTopButton onPress={scrollToTop} />}

      <Modal
        animationType="fade"
        transparent
        visible={modalBleVisivel}
        onRequestClose={cancelarPesagemBle}
        statusBarTranslucent
      >
        <View style={styles.bleModalOverlay}>
          <View style={styles.bleModalCard}>
            <View style={styles.bleModalHeader}>
              <View style={styles.bleModalIconCircle}>
                <MaterialCommunityIcons name="scale" size={28} color="#fff" />
              </View>
              <Text style={styles.bleModalTitle}>Peso estabilizado</Text>
              <Text style={styles.bleModalSubtitle}>
                Amostra {amostraAtual + 1} — Pesagem {proximaPesagem}/5{proximaPesagem === 5 ? ' (opcional)' : ''}
              </Text>
            </View>
            <View style={styles.bleModalWeightRow}>
              <Text style={styles.bleModalWeightValue}>{pesoBleConfirmacao?.toFixed(1)}</Text>
              <Text style={styles.bleModalWeightUnit}>g</Text>
            </View>
            {ultimaCalibragem && pesoBleConfirmacao !== null && (
              <Text style={styles.bleModalDensidadePreview}>
                ≈ {calcularDensidade(pesoBleConfirmacao)} g/cm³
              </Text>
            )}
            <View style={styles.bleModalActions}>
              <TouchableOpacity
                style={[styles.bleModalBtn, styles.bleModalBtnCancel]}
                onPress={cancelarPesagemBle}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="close" size={20} color="#666" />
                <Text style={styles.bleModalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bleModalBtn, styles.bleModalBtnConfirm]}
                onPress={confirmarPesagemBle}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                <Text style={styles.bleModalBtnConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={modalInformacoesAdicionaisVisivel}
        onRequestClose={() => setModalInformacoesAdicionaisVisivel(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <View style={styles.modalIconeContainer}>
              <Ionicons name="clipboard-outline" size={40} color="#E75F07" />
            </View>
            <Text style={styles.modalTituloDestaque}>Informações complementares</Text>
            <Text style={styles.modalTextoDescricao}>
              Deseja inserir as informações complementares da operação agora?
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.salvarButton]}
              onPress={confirmarIrParaStep2}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward-circle" size={22} color="#FFF" />
              <Text style={styles.textStyle}>Sim, inserir agora</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelarButton]}
              onPress={recusarStep2EFinalizar}
              activeOpacity={0.8}
            >
              <Ionicons name="save-outline" size={22} color="#FFF" />
              <Text style={styles.textStyle}>Não, salvar assim</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={modalConfirmacaoVisivel}
        onRequestClose={() => setModalConfirmacaoVisivel(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Deseja salvar o projeto?</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.salvarButton]}
              onPress={() => { setModalConfirmacaoVisivel(false); salvarProjeto(); }}
            >
              <Ionicons name="save" size={24} color="#FFF" />
              <Text style={styles.textStyle}>Salvar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelarButton]}
              onPress={() => setModalConfirmacaoVisivel(false)}
            >
              <Ionicons name="close" size={24} color="#FFF" />
              <Text style={styles.textStyle}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={modalProjetoExistenteVisivel}
        onRequestClose={() => setModalProjetoExistenteVisivel(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>
              Você tem um projeto em andamento. Deseja continuar ou iniciar um novo?
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.salvarButton]}
              onPress={() => setModalProjetoExistenteVisivel(false)}
            >
              <Ionicons name="play-circle" size={24} color="#FFF" />
              <Text style={styles.textStyle}>Continuar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelarButton]}
              onPress={() => {
                resetarFormulario();
                setModalProjetoExistenteVisivel(false);
                setCurrentStep(1);
              }}
            >
              <Ionicons name="refresh-circle" size={24} color="#FFF" />
              <Text style={styles.textStyle}>Iniciar Novo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default function NovaAmostraScreen() {
  return (
    <ProjetoFormProvider>
      <NovaAmostraScreenInner />
    </ProjetoFormProvider>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#FFFFFF' },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#E75F07', marginBottom: 10 },

  stepIndicatorContainer: { marginBottom: 24, marginTop: 8 },
  stepIndicatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#ddd',
  },
  stepCircleActive: { backgroundColor: '#E75F07', borderColor: '#E75F07' },
  stepCircleText: { fontSize: 15, fontWeight: '700', color: '#aaa' },
  stepCircleTextActive: { color: '#fff' },
  stepLine: { flex: 1, height: 3, backgroundColor: '#eee', marginHorizontal: 8 },
  stepLineActive: { backgroundColor: '#E75F07' },
  stepLabelsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 6, paddingHorizontal: 4,
  },
  stepLabel: { fontSize: 12, color: '#aaa', fontWeight: '600' },
  stepLabelActive: { color: '#E75F07' },

  historicoGrupo: { marginBottom: 15 },
  historicoTitulo: { fontWeight: 'bold', fontSize: 18, color: '#333', marginBottom: 5 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  historicoPesagemBold: { fontSize: 16, color: '#333', fontWeight: 'bold' },

  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 22 },
  modalView: {
    width: '90%', margin: 20, backgroundColor: 'white', borderRadius: 20,
    padding: 35, alignItems: 'center', shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  modalIconeContainer: { marginBottom: 12 },
  modalTituloDestaque: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 8, textAlign: 'center' },
  modalTextoDescricao: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 8, lineHeight: 20 },
  textStyle: { color: 'white', fontWeight: 'bold', textAlign: 'center', marginLeft: 6 },
  modalText: { marginBottom: 15, textAlign: 'center' },
  modalButton: {
    width: '100%', padding: 12, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12,
  },
  salvarButton: { backgroundColor: '#E75F07' },
  cancelarButton: { backgroundColor: '#787878' },

  bleModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  bleModalCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 24,
    paddingVertical: 32, paddingHorizontal: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
  },
  bleModalHeader: { alignItems: 'center', marginBottom: 20 },
  bleModalIconCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#4CAF50',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  bleModalTitle: { fontSize: 20, fontWeight: '800', color: '#222' },
  bleModalSubtitle: { fontSize: 13, color: '#aaa', marginTop: 4 },
  bleModalWeightRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  bleModalWeightValue: { fontSize: 72, fontWeight: '800', color: '#FF5C00', lineHeight: 80 },
  bleModalWeightUnit: { fontSize: 30, fontWeight: '400', color: '#ccc', marginBottom: 10, marginLeft: 6 },
  bleModalDensidadePreview: { fontSize: 15, color: '#888', marginBottom: 28 },
  bleModalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  bleModalBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 6,
  },
  bleModalBtnCancel: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0' },
  bleModalBtnCancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  bleModalBtnConfirm: { backgroundColor: '#4CAF50' },
  bleModalBtnConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
