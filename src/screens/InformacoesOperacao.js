import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, FlatList, ActivityIndicator,
  Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useProjetoForm } from '../context/form';

export default function InformacoesOperacao({
  // Modo inline (StepInformacoes)
  modoModal = false,
  onVoltar,
  onSalvar,
  // Modo modal (StepInformacoesModal)
  visivel,
  onFechar,
  onSalvo,
  projetoId,
  infoInicial,
}) {
  // Estado local — usado apenas no modoModal (edição de projeto existente)
  const [nfLocal, setNfLocal] = useState('');
  const [kgPrevistoLocal, setKgPrevistoLocal] = useState('');
  const [kgAplicadoLocal, setKgAplicadoLocal] = useState('');
  const [caminhaoLocal, setCaminhaoLocal] = useState(null);
  const [equipeLocal, setEquipeLocal] = useState([]);
  const [infoGeraisLocal, setInfoGeraisLocal] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Contexto — usado apenas no modo inline (novo projeto)
  const form = !modoModal ? useProjetoForm() : null;

  const numeroNF        = modoModal ? nfLocal          : form.numeroNF;
  const setNumeroNF     = modoModal ? setNfLocal        : form.setNumeroNF;
  const kgPrevisto      = modoModal ? kgPrevistoLocal   : form.kgPrevisto;
  const setKgPrevisto   = modoModal ? setKgPrevistoLocal: form.setKgPrevisto;
  const kgAplicado      = modoModal ? kgAplicadoLocal   : form.kgAplicado;
  const setKgAplicado   = modoModal ? setKgAplicadoLocal: form.setKgAplicado;
  const caminhaoSelecionado  = modoModal ? caminhaoLocal  : form.caminhaoSelecionado;
  const setCaminhaoSelecionado = modoModal ? setCaminhaoLocal : form.setCaminhaoSelecionado;
  const equipeSelecionada    = modoModal ? equipeLocal    : form.equipeSelecionada;
  const setEquipeSelecionada = modoModal ? setEquipeLocal  : form.setEquipeSelecionada;
  const salvarEstado    = modoModal ? () => {}           : form.salvarEstadoDoProjeto;
  const informacoesGerais = modoModal ? infoGeraisLocal : form.informacoesGerais;
  const setInformacoesGerais = modoModal ? setInfoGeraisLocal : form.setInformacoesGerais;

  const [caminhoes, setCaminhoes] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalCaminhaoVisivel, setModalCaminhaoVisivel] = useState(false);
  const [modalEquipeVisivel, setModalEquipeVisivel] = useState(false);

  const db = getFirestore();

  // Carregamento de dados
  // - modoModal: recarrega sempre que o modal abre
  // - modo inline: carrega uma vez ao montar
  useEffect(() => {
    if (modoModal && !visivel) return;

    if (modoModal && infoInicial) {
      setNfLocal(infoInicial.numeroNF || '');
      setKgPrevistoLocal(infoInicial.kgPrevisto || '');
      setKgAplicadoLocal(infoInicial.kgAplicado || '');
      setCaminhaoLocal(infoInicial.caminhao || null);
      setEquipeLocal(infoInicial.equipe || []);
      setInfoGeraisLocal(infoInicial.informacoesGerais || '');
    }

    const carregar = async () => {
      setCarregando(true);
      try {
        const [snapC, snapO] = await Promise.all([
          getDocs(collection(db, 'caminhoes')),
          getDocs(collection(db, 'operadores')),
        ]);
        setCaminhoes(snapC.docs.map(d => ({ id: d.id, ...d.data() })));
        setOperadores(snapO.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Erro ao carregar dados:', e);
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, [modoModal ? visivel : true]);

  const toggleMembro = (membro) => {
    const jaEsta = equipeSelecionada.some(m => m.id === membro.id);
    const nova = jaEsta
      ? equipeSelecionada.filter(m => m.id !== membro.id)
      : [...equipeSelecionada, membro];
    setEquipeSelecionada(nova);
    salvarEstado();
  };

  const removerMembro = (id) => {
    setEquipeSelecionada(equipeSelecionada.filter(m => m.id !== id));
    salvarEstado();
  };

  const membrosDisponiveis = operadores
    .filter(o => !equipeSelecionada.some(s => s.id === o.id))
    .sort((a, b) => a.nome?.localeCompare(b.nome, 'pt-BR'));

  const gruposDisponiveis = membrosDisponiveis.reduce((acc, op) => {
    const cat = op.cargo?.trim() || 'Sem categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(op);
    return acc;
  }, {});

  const salvarModal = async () => {
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'projetos', projetoId), {
        informacoesOperacao: {
          numeroNF, kgPrevisto, kgAplicado,
          caminhao: caminhaoSelecionado,
          equipe: equipeSelecionada,
          informacoesGerais,
        },
      });
      onSalvo({ numeroNF, kgPrevisto, kgAplicado, caminhao: caminhaoSelecionado, equipe: equipeSelecionada, informacoesGerais });
      onFechar();
    } catch (e) {
      console.error('Erro ao salvar:', e);
      Alert.alert('Erro', 'Não foi possível salvar as informações. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  // ─── Conteúdo do formulário ────────────────────────────────────────────────
  const conteudo = carregando ? (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#E75F07" />
      <Text style={styles.loadingTexto}>Carregando dados...</Text>
    </View>
  ) : (
    <ScrollView contentContainerStyle={styles.form}>
      <Text style={styles.label}>Número da Nota Fiscal</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 123456"
        keyboardType="numeric"
        value={numeroNF}
        onChangeText={setNumeroNF}
        onBlur={salvarEstado}
      />

      <Text style={styles.label}>Kg Previsto</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 1500"
        keyboardType="numeric"
        value={kgPrevisto}
        onChangeText={setKgPrevisto}
        onBlur={salvarEstado}
      />

      <Text style={styles.label}>Kg Aplicado</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 1480"
        keyboardType="numeric"
        value={kgAplicado}
        onChangeText={setKgAplicado}
        onBlur={salvarEstado}
      />

      <Text style={styles.label}>Unidade de Bombeamento</Text>
      {caminhoes.length === 0 ? (
        <View style={styles.avisoContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#aaa" />
          <Text style={styles.avisoTexto}>Nenhum caminhão cadastrado. Acesse Gerenciar Cadastros.</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.selectBtn} onPress={() => setModalCaminhaoVisivel(true)} activeOpacity={0.8}>
          <Text style={caminhaoSelecionado ? styles.selectBtnTexto : styles.selectBtnPlaceholder}>
            {caminhaoSelecionado ? caminhaoSelecionado.placa : 'Selecionar caminhão'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#aaa" />
        </TouchableOpacity>
      )}

      <Text style={styles.label}>Equipe</Text>
      {operadores.length === 0 ? (
        <View style={styles.avisoContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#aaa" />
          <Text style={styles.avisoTexto}>Nenhum operador cadastrado. Acesse Gerenciar Cadastros.</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.selectBtn, equipeSelecionada.length > 0 && styles.selectBtnMulti]}
          onPress={() => setModalEquipeVisivel(true)}
          activeOpacity={0.8}
        >
          {equipeSelecionada.length === 0 ? (
            <>
              <Text style={styles.selectBtnPlaceholder}>Selecionar membros da equipe</Text>
              <Ionicons name="chevron-down" size={20} color="#aaa" />
            </>
          ) : (
            <View style={styles.baloesContainer}>
              {equipeSelecionada.map(m => (
                <TouchableOpacity key={m.id} style={styles.balao} onPress={() => removerMembro(m.id)} activeOpacity={0.7}>
                  <Text style={styles.balaoTexto}>{m.nome}</Text>
                  <Ionicons name="close" size={14} color="#fff" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.balaoAdicionar} onPress={() => setModalEquipeVisivel(true)} activeOpacity={0.7}>
                <Ionicons name="add" size={16} color="#E75F07" />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      )}
      
      <Text style={styles.label}>Informações gerais</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Observações relevantes sobre a operação..."
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        value={informacoesGerais}
        onChangeText={setInformacoesGerais}
        onBlur={salvarEstado}
      />

      <TouchableOpacity
        style={[styles.salvarBtn, salvando && styles.salvarBtnDisabled]}
        onPress={modoModal ? salvarModal : onSalvar}
        disabled={salvando}
        activeOpacity={0.8}
      >
        {salvando
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name="save" size={22} color="#FFF" />}
        <Text style={styles.salvarBtnTexto}>
          {salvando ? 'Salvando...' : 'Salvar Projeto'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── Modais internos de seleção ────────────────────────────────────────────
  const modaisSelecao = (
    <>
      <Modal animationType="slide" transparent visible={modalCaminhaoVisivel} onRequestClose={() => setModalCaminhaoVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Selecionar Caminhão</Text>
              <TouchableOpacity onPress={() => setModalCaminhaoVisivel(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={caminhoes}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.opcaoItem, caminhaoSelecionado?.id === item.id && styles.opcaoItemSelecionado]}
                  onPress={() => { setCaminhaoSelecionado(item); salvarEstado(); setModalCaminhaoVisivel(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.opcaoItemTexto, caminhaoSelecionado?.id === item.id && styles.opcaoItemTextoSelecionado]}>
                    {item.placa}
                  </Text>
                  {caminhaoSelecionado?.id === item.id && <Ionicons name="checkmark" size={20} color="#E75F07" />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separador} />}
            />
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={modalEquipeVisivel} onRequestClose={() => setModalEquipeVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Selecionar Equipe</Text>
              <TouchableOpacity onPress={() => setModalEquipeVisivel(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {equipeSelecionada.length > 0 && (
              <View style={styles.equipeResumo}>
                {equipeSelecionada.map(m => (
                  <TouchableOpacity key={m.id} style={styles.balao} onPress={() => toggleMembro(m)} activeOpacity={0.7}>
                    <Text style={styles.balaoTexto}>{m.nome}</Text>
                    <Ionicons name="close" size={14} color="#fff" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {membrosDisponiveis.length > 0 ? (
              <ScrollView>
                {Object.entries(gruposDisponiveis)
                  .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
                  .map(([categoria, membros]) => (
                    <View key={categoria}>
                      <Text style={styles.grupoTitulo}>{categoria}</Text>
                      <View style={styles.separador} />
                      {membros.map(item => (
                        <TouchableOpacity key={item.id} style={styles.opcaoItem} onPress={() => toggleMembro(item)} activeOpacity={0.8}>
                          <Text style={styles.opcaoItemTexto}>{item.nome}</Text>
                          <Ionicons name="add-circle-outline" size={22} color="#E75F07" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
              </ScrollView>
            ) : (
              <View style={styles.todosAdicionados}>
                <Ionicons name="checkmark-done-circle" size={40} color="#4CAF50" />
                <Text style={styles.todosAdicionadosTexto}>Todos os operadores adicionados</Text>
              </View>
            )}

            <TouchableOpacity style={styles.confirmarBtn} onPress={() => setModalEquipeVisivel(false)} activeOpacity={0.8}>
              <Text style={styles.confirmarBtnTexto}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );

  // ─── Renderização: inline vs modal ────────────────────────────────────────
  if (modoModal) {
    return (
      <Modal animationType="slide" transparent={false} visible={visivel} onRequestClose={onFechar} presentationStyle="pageSheet">
        <View style={styles.wrapper}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onFechar} style={styles.fecharBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
            <Text style={styles.headerTitulo}>Informações da Operação</Text>
            <View style={{ width: 40 }} />
          </View>
          {conteudo}
          {modaisSelecao}
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.inlineContainer}>
      <TouchableOpacity style={styles.voltarBtn} onPress={onVoltar} activeOpacity={0.8}>
        <Ionicons name="arrow-back-circle" size={24} color="#E75F07" />
        <Text style={styles.voltarBtnTexto}>Voltar às pesagens</Text>
      </TouchableOpacity>
      <Text style={styles.secaoTitulo}>Informações da Operação</Text>
      {conteudo}
      {modaisSelecao}
    </View>
  );
}

const styles = StyleSheet.create({
  // Modo modal
  wrapper: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  fecharBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { fontSize: 17, fontWeight: '700', color: '#222' },

  // Modo inline
  inlineContainer: { flex: 1 },
  voltarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24, alignSelf: 'flex-start' },
  voltarBtnTexto: { color: '#E75F07', fontSize: 15, fontWeight: '600' },
  secaoTitulo: {
    fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: '#E75F07', paddingLeft: 10,
  },

  // Compartilhados
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTexto: { color: '#aaa', fontSize: 14 },
  form: { padding: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    backgroundColor: '#FFF', borderColor: '#CCC', borderWidth: 1,
    borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 16,
  },
  avisoContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18,
    backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#eee',
  },
  avisoTexto: { fontSize: 13, color: '#aaa', flex: 1 },
  selectBtn: {
    backgroundColor: '#FFF', borderColor: '#CCC', borderWidth: 1,
    borderRadius: 8, padding: 12, marginBottom: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48,
  },
  selectBtnMulti: { flexWrap: 'wrap', alignItems: 'flex-start' },
  selectBtnTexto: { fontSize: 16, color: '#222', flex: 1 },
  selectBtnPlaceholder: { fontSize: 16, color: '#aaa', flex: 1 },
  baloesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  balao: {
    backgroundColor: '#E75F07', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  balaoTexto: { color: '#fff', fontSize: 13, fontWeight: '600' },
  balaoAdicionar: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E75F07', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  salvarBtn: {
    backgroundColor: '#E75F07', padding: 14, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 8,
  },
  salvarBtnDisabled: { backgroundColor: '#f0a07a' },
  salvarBtnTexto: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, maxHeight: '75%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitulo: { fontSize: 17, fontWeight: '700', color: '#222' },
  opcaoItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  opcaoItemSelecionado: { backgroundColor: '#fff5f0', borderRadius: 8, paddingHorizontal: 8 },
  opcaoItemTexto: { fontSize: 15, color: '#333' },
  opcaoItemTextoSelecionado: { color: '#E75F07', fontWeight: '600' },
  separador: { height: 1, backgroundColor: '#f0f0f0' },
  equipeResumo: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  textArea: {
    height: 120,
    paddingTop: 6,
  },
  grupoTitulo: {
    fontSize: 13, fontWeight: '700', color: '#aaa',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 16, marginBottom: 6,
  },
  todosAdicionados: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  todosAdicionadosTexto: { fontSize: 15, color: '#aaa', fontWeight: '500' },
  confirmarBtn: { backgroundColor: '#E75F07', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  confirmarBtnTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
