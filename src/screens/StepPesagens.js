import { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, Dimensions, Modal, ActivityIndicator, FlatList,
} from 'react-native';
import useKeyboardHeight from '../hooks/useKeyboardHeight';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useProjetoForm } from '../context/form';
import { useBle } from '../context/context';
import { useReferenceData } from '../context/referenceData';
import { formatCNPJ, unmaskCNPJ } from '../helpers/formatCNPJ';

export default function StepPesagens({
  ultimaCalibragem,
  calibragemCarregada,
  modalAvisoVisivel, setModalAvisoVisivel,
  mensagemAviso, setMensagemAviso,
  modalVisivel, setModalVisivel,
  modalMensagem,
  modalDensidade,
  modalAdicionarAmostra, setModalAdicionarAmostra,
  onConfirmarPesagem,
  onAdicionarAmostra,
  onAvancar,
  todasPesagensConcluidas,
  temporizador,
  amostraPesquisa, setAmostraPesquisa,
  historicoFiltrado,
}) {
  const navigation = useNavigation();
  const { bleStatus, connectedDevice, readingStatus } = useBle();
  const { clientes } = useReferenceData();
  const {
    nomeProjeto, setNomeProjeto,
    quantidadeAmostras, setQuantidadeAmostras,
    amostras, setAmostras,
    amostraAtual, setAmostraAtual,
    setPesagemAtual,
    peso, setPeso,
    clienteSelecionado, setClienteSelecionado,
    salvarEstadoDoProjeto,
  } = useProjetoForm();

  const keyboardHeight = useKeyboardHeight();

  const [modalConfirmarVisivel, setModalConfirmarVisivel] = useState(false);
  const [modalClienteVisivel, setModalClienteVisivel] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');

  const amostraArray = amostras[amostraAtual] || [];
  const pesagensFeitas = amostraArray.filter(p => p.peso !== '').length;
  const proximaPesagem = pesagensFeitas + 1;

  const confirmarDesabilitado = temporizador || todasPesagensConcluidas || !calibragemCarregada;

  const clientesAtivos = clientes.filter(c => c.ativo !== false);

  const clientesFiltrados = clientesAtivos.filter(c => {
    if (!buscaCliente.trim()) return true;
    const termo = buscaCliente.toLowerCase();
    const nomeMatch = c.nome?.toLowerCase().includes(termo);
    const cnpjMatch = c.cnpj && unmaskCNPJ(c.cnpj).includes(unmaskCNPJ(buscaCliente));
    return nomeMatch || cnpjMatch;
  });

  const selecionarCliente = (cliente) => {
    setClienteSelecionado({ id: cliente.id, nome: cliente.nome });
    salvarEstadoDoProjeto();
    setModalClienteVisivel(false);
    setBuscaCliente('');
  };

  const iniciarConfirmacao = () => {
    if (!peso || !peso.trim()) {
      onConfirmarPesagem();
      return;
    }
    setModalConfirmarVisivel(true);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.bleStatus, bleStatus === 'connected' ? styles.bleConnected : styles.bleDisconnected]}
        onPress={() => navigation.navigate('ScaleConnect')}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons
          name={bleStatus === 'connected' ? 'bluetooth-connect' : 'bluetooth-off'}
          size={18}
          color={bleStatus === 'connected' ? '#fff' : '#aaa'}
        />
        <Text style={[styles.bleStatusText, bleStatus !== 'connected' && { color: '#aaa' }]}>
          {bleStatus === 'connected'
            ? `Balança: ${connectedDevice?.name ?? 'Conectada'}`
            : bleStatus === 'reconnecting'
              ? 'Reconectando à balança...'
              : 'Balança não conectada — toque para conectar'}
        </Text>
        {readingStatus === 'listening' && bleStatus === 'connected' && (
          <View style={styles.blePulse} />
        )}
      </TouchableOpacity>

      {!calibragemCarregada ? (
        <View style={styles.calibragemCarregandoContainer}>
          <ActivityIndicator size="small" color="#FF9621" />
          <Text style={styles.calibragemCarregandoTexto}>
            Carregando calibragem... aguarde antes de pesar.
          </Text>
        </View>
      ) : ultimaCalibragem ? (
        <View style={styles.calibragemView}>
          <Text style={styles.infoText}>
            Última Calibragem: {ultimaCalibragem.timestamp.toLocaleDateString()}
          </Text>
          <Text style={[styles.alertText, { color: ultimaCalibragem.necessitaCalibragem ? '#D32F2F' : '#4CAF50' }]}>
            {ultimaCalibragem.necessitaCalibragem ? 'Necessita nova calibragem' : 'Calibragem OK'}
          </Text>
        </View>
      ) : null}

      <Text style={styles.label}>Cliente</Text>
      {clientesAtivos.length === 0 ? (
        <View style={styles.avisoContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#aaa" />
          <Text style={styles.avisoTexto}>Nenhum cliente cadastrado.</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.selectBtn} onPress={() => setModalClienteVisivel(true)} activeOpacity={0.8}>
          <Text style={clienteSelecionado ? styles.selectBtnTexto : styles.selectBtnPlaceholder}>
            {clienteSelecionado ? clienteSelecionado.nome : 'Selecionar cliente'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#aaa" />
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.input}
        placeholder="Nome do Projeto"
        placeholderTextColor="#888888"
        value={nomeProjeto}
        onChangeText={setNomeProjeto}
        onBlur={salvarEstadoDoProjeto}
      />

      <TouchableOpacity style={styles.adicionarAmostraBtn} onPress={() => setModalAdicionarAmostra(true)}>
        <Ionicons name="add-circle" size={24} color="#1F6452" />
        <Text style={styles.adicionarAmostraBtnTexto}>Adicionar Amostra</Text>
      </TouchableOpacity>

      <View style={styles.selectContainer}>
        <Text style={styles.label}>Selecionar Amostra:</Text>
        <View style={styles.amostrasContainer}>
          {Array.from({ length: quantidadeAmostras }, (_, i) => {
            const amostra = amostras[i] || [];
            const feitas = amostra.filter(p => p.peso !== '').length;
            const pesagensFaltantes = 4 - feitas;
            const amostraConcluida = feitas >= 4;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.amostraBtn,
                  amostraAtual === i && styles.amostraBtnSelecionado,
                  amostraConcluida && styles.amostraBtnConcluida,
                  Platform.OS !== 'web' && styles.amostraBtnMobile,
                ]}
                onPress={() => {
                  if (amostraConcluida && feitas === 5) {
                    setMensagemAviso('Pesagens concluídas para esta amostra.');
                    setModalAvisoVisivel(true);
                  } else {
                    setAmostraAtual(i);
                    const f = (amostras[i] || []).filter(p => p.peso !== '').length;
                    setPesagemAtual(f + 1);
                    salvarEstadoDoProjeto();
                  }
                }}
              >
                <Text style={styles.amostraBtnTexto}>Amostra {i + 1}</Text>
                <Text style={styles.amostraBtnTextoMenor}>
                  {feitas >= 4
                    ? feitas === 5 ? 'Concluída' : `${feitas}/4 + opcional`
                    : `${pesagensFaltantes} pesage${pesagensFaltantes !== 1 ? 'ns' : 'm'} faltando`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.selectContainer}>
        <Text style={styles.label}>Pesagem: {proximaPesagem}/5{proximaPesagem === 5 ? ' (opcional)' : ''}</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Peso"
        placeholderTextColor="#888888"
        keyboardType="numeric"
        value={peso}
        onChangeText={setPeso}
        editable={!temporizador && !todasPesagensConcluidas}
        onBlur={salvarEstadoDoProjeto}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: confirmarDesabilitado ? '#ccc' : '#1F6452' }]}
        onPress={iniciarConfirmacao}
        disabled={confirmarDesabilitado}
      >
        {!calibragemCarregada ? (
          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
        ) : (
          <Ionicons name="checkmark-circle" size={24} color="#FFF" />
        )}
        <Text style={styles.buttonText}>
          {!calibragemCarregada ? 'Aguardando calibragem...' : 'Confirmar Pesagem'}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Buscar Amostra"
        placeholderTextColor="#888888"
        value={amostraPesquisa}
        onChangeText={setAmostraPesquisa}
      />
      <View style={styles.historicoContainer}>{historicoFiltrado}</View>

      <TouchableOpacity
        style={[styles.avancarBtn, (!nomeProjeto.trim() || !clienteSelecionado) && styles.avancarBtnDisabled]}
        onPress={onAvancar}
        activeOpacity={0.8}
      >
        <Text style={styles.avancarBtnTexto}>Continuar</Text>
        <Ionicons name="arrow-forward-circle" size={24} color="#FFF" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent
        visible={modalClienteVisivel}
        onRequestClose={() => { setModalClienteVisivel(false); setBuscaCliente(''); }}
      >
        <View style={[styles.modalOverlay, keyboardHeight > 0 && { marginBottom: 48 + keyboardHeight }]}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Selecionar Cliente</Text>
              <TouchableOpacity onPress={() => { setModalClienteVisivel(false); setBuscaCliente(''); }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Buscar por nome ou CNPJ"
              placeholderTextColor="#888888"
              value={buscaCliente}
              onChangeText={setBuscaCliente}
              autoFocus
            />

            <FlatList
              data={clientesFiltrados}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.opcaoItem, clienteSelecionado?.id === item.id && styles.opcaoItemSelecionado]}
                  onPress={() => selecionarCliente(item)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.opcaoItemTexto, clienteSelecionado?.id === item.id && styles.opcaoItemTextoSelecionado]}>
                      {item.nome}
                    </Text>
                    {item.cnpj ? <Text style={styles.opcaoItemSub}>{formatCNPJ(item.cnpj)}</Text> : null}
                  </View>
                  {clienteSelecionado?.id === item.id && <Ionicons name="checkmark" size={20} color="#1F6452" />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separador} />}
              ListEmptyComponent={
                <Text style={styles.vazioBuscaTexto}>Nenhum cliente encontrado</Text>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={modalVisivel}
        onRequestClose={() => setModalVisivel(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>{modalMensagem}</Text>
            <Text style={styles.modalDensidade}>Dens.: {modalDensidade} g/cm³</Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonClose]}
              onPress={() => setModalVisivel(false)}
            >
              <Text style={styles.textStyle}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={modalAvisoVisivel}
        onRequestClose={() => setModalAvisoVisivel(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>{mensagemAviso}</Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonClose]}
              onPress={() => setModalAvisoVisivel(false)}
            >
              <Text style={styles.textStyle}>Continuar Pesando</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={modalAdicionarAmostra}
        onRequestClose={() => setModalAdicionarAmostra(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Deseja adicionar uma nova amostra?</Text>
            <TouchableOpacity style={[styles.modalButton, styles.salvarButton]} onPress={onAdicionarAmostra}>
              <Ionicons name="add-circle" size={24} color="#FFF" />
              <Text style={styles.textStyle}>Adicionar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelarButton]}
              onPress={() => setModalAdicionarAmostra(false)}
            >
              <Ionicons name="close" size={24} color="#FFF" />
              <Text style={styles.textStyle}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={modalConfirmarVisivel} onRequestClose={() => setModalConfirmarVisivel(false)}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.confirmModalLabel}>Enviando para</Text>
            <Text style={styles.confirmModalAmostra}>Amostra {amostraAtual + 1}</Text>
            <Text style={styles.confirmModalLabel}>Peso</Text>
            <Text style={styles.confirmModalPeso}>{peso} g</Text>
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={[styles.confirmModalBtn, styles.cancelarButton]}
                onPress={() => setModalConfirmarVisivel(false)}
              >
                <Text style={styles.textStyle}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalBtn, styles.salvarButton]}
                onPress={() => { setModalConfirmarVisivel(false); onConfirmarPesagem(); }}
              >
                <Text style={styles.textStyle}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bleStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, marginBottom: 16,
  },
  bleConnected: { backgroundColor: '#4CAF50' },
  bleDisconnected: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0' },
  bleStatusText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },
  blePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.7)' },
  calibragemCarregandoContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#FF9621',
    borderRadius: 10, padding: 12, marginBottom: 16,
  },
  calibragemCarregandoTexto: {
    flex: 1, fontSize: 13, fontWeight: '600', color: '#FF9621',
  },
  calibragemView: { marginBottom: 20 },
  infoText: { color: '#000000', fontSize: 16 },
  alertText: { fontSize: 16, fontWeight: 'bold' },
  input: {
    backgroundColor: '#FFF', borderColor: '#CCC', borderWidth: 1,
    borderRadius: 5, padding: 10, marginBottom: 15, fontSize: 18, color: '#000000',
  },
  button: {
    backgroundColor: '#1F6452', padding: 10, borderRadius: 5,
    justifyContent: 'center', alignItems: 'center', marginBottom: 15, flexDirection: 'row',
  },
  buttonText: { color: '#FFF', fontSize: 18, marginLeft: 5 },
  buttonClose: { backgroundColor: '#787878', marginTop: 15 },
  adicionarAmostraBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1F6452',
    padding: 10, borderRadius: 5,
    justifyContent: 'center', alignItems: 'center', marginBottom: 15, flexDirection: 'row',
  },
  adicionarAmostraBtnTexto: { color: '#1F6452', fontSize: 18, marginLeft: 5 },
  selectContainer: { marginBottom: 15 },
  label: { color: '#000000', fontWeight: 'bold', marginBottom: 5 },
  avisoContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15,
    backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#eee',
  },
  avisoTexto: { fontSize: 13, color: '#aaa', flex: 1 },
  selectBtn: {
    backgroundColor: '#FFF', borderColor: '#CCC', borderWidth: 1,
    borderRadius: 5, padding: 12, marginBottom: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48,
  },
  selectBtnTexto: { fontSize: 16, color: '#222', flex: 1 },
  selectBtnPlaceholder: { fontSize: 16, color: '#aaa', flex: 1 },
  amostrasContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  amostraBtn: { backgroundColor: '#ddd', padding: 15, borderRadius: 5, marginVertical: 5, alignItems: 'center' },
  amostraBtnMobile: { width: Dimensions.get('window').width - 40 },
  amostraBtnSelecionado: { backgroundColor: '#494949' },
  amostraBtnConcluida: { backgroundColor: '#A5A5A5' },
  amostraBtnTexto: { color: '#FFF', fontWeight: 'bold', textAlign: 'center' },
  amostraBtnTextoMenor: { color: '#FFF', fontSize: 12, textAlign: 'center' },
  historicoContainer: { marginTop: 20 },
  avancarBtn: {
    backgroundColor: '#1F6452', padding: 14, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 24, marginBottom: 12, gap: 8,
  },
  avancarBtnDisabled: { backgroundColor: '#ccc' },
  avancarBtnTexto: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 22 },
  modalView: {
    width: '90%', margin: 20, backgroundColor: 'white', borderRadius: 20,
    padding: 35, alignItems: 'center', shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', marginBottom: 48 },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, maxHeight: '75%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitulo: { fontSize: 17, fontWeight: '700', color: '#222' },
  opcaoItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  opcaoItemSelecionado: { backgroundColor: '#E3F0EC', borderRadius: 8, paddingHorizontal: 8 },
  opcaoItemTexto: { fontSize: 15, color: '#333' },
  opcaoItemTextoSelecionado: { color: '#1F6452', fontWeight: '600' },
  opcaoItemSub: { fontSize: 12, color: '#888', marginTop: 2 },
  separador: { height: 1, backgroundColor: '#f0f0f0' },
  vazioBuscaTexto: { textAlign: 'center', color: '#aaa', fontStyle: 'italic', paddingVertical: 24 },
  textStyle: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  modalText: { marginBottom: 15, textAlign: 'center', color: '#000000' },
  modalDensidade: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  modalButton: {
    width: '90%', padding: 10, borderRadius: 5,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 15,
  },
  salvarButton: { backgroundColor: '#1F6452' },
  cancelarButton: { backgroundColor: '#787878' },
  confirmModalLabel: { fontSize: 14, color: '#888', fontWeight: '600', marginBottom: 2, marginTop: 12 },
  confirmModalAmostra: { fontSize: 44, fontWeight: '800', color: '#222' },
  confirmModalPeso: { fontSize: 44, fontWeight: '800', color: '#1F6452' },
  confirmModalActions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 20 },
  confirmModalBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
});
