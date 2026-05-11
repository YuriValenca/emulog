import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, StyleSheet,
  TouchableOpacity, Modal, ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from './BackButton';
import ScrollToTopButton from './ScrollToTopButton';
import NetInfo from '@react-native-community/netinfo';

const PROJETOS_POR_PAGINA = 20;
const ADMIN_UID = 'vuEvlau2E0by5HmJ5Im88bIVXg23';

export default function HistoricoScreen() {
  // Lista completa de metadados para busca/filtro (id + nomeProjeto + dataCriacao)
  const [todosMetadados, setTodosMetadados] = useState([]);
  // Projetos da página atual (completos, vindos do Firestore ou offline)
  const [projetosDaPagina, setProjetosDaPagina] = useState([]);

  const [ordem, setOrdem] = useState('recente');
  const [busca, setBusca] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalFiltrado, setTotalFiltrado] = useState(0);

  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isLoadingPagina, setIsLoadingPagina] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [modalErroVisivel, setModalErroVisivel] = useState(false);
  const [erroLogs, setErroLogs] = useState('');

  // Cursores do Firestore por página (página 1 não precisa de cursor)
  // cursores[N] = snapshot do último doc da página N → usado para buscar página N+1
  const cursoresRef = useRef({});
  // Projetos offline em cache local
  const offlineRef = useRef([]);

  const navigation = useNavigation();
  const auth = getAuth();
  const usuarioLogadoUID = auth.currentUser?.uid;
  const flatListRef = useRef(null);
  const db = getFirestore();

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getTimestamp = (dataCriacao) => {
    if (dataCriacao?.seconds) return dataCriacao.seconds * 1000;
    if (typeof dataCriacao === 'string') return new Date(dataCriacao).getTime();
    return 0;
  };

  const convertTimestampToDateTime = (dataCriacao) => {
    let date;
    if (dataCriacao?.seconds) {
      date = new Date(dataCriacao.seconds * 1000);
    } else if (typeof dataCriacao === 'string') {
      date = new Date(dataCriacao);
    } else {
      return 'Data inválida';
    }
    if (isNaN(date.getTime())) return 'Data inválida';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear()).slice(-2);
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} (${h}:${min}h)`;
  };

  const logErro = (msg) => {
    setErroLogs(prev => `${prev}\n${msg}`);
    setModalErroVisivel(true);
  };

  // ─── 1. Carga inicial: busca só metadados (id, nomeProjeto, dataCriacao) ────
  //
  // Firestore não suporta busca por substring, então trazemos apenas os campos
  // leves de todos os documentos para poder filtrar/ordenar localmente e montar
  // a paginação. Os dados completos são buscados apenas para a página exibida.

  const buscarMetadados = useCallback(async () => {
    setIsLoadingMeta(true);
    cursoresRef.current = {}; // reseta cursores ao recarregar metadados

    let metaOffline = [];
    let metaOnline = [];

    // Offline
    try {
      const stored = await AsyncStorage.getItem('offlineProjects');
      const offline = stored ? JSON.parse(stored) : [];
      offlineRef.current = offline;
      metaOffline = offline.map(p => ({
        id: p.id,
        nomeProjeto: p.nomeProjeto,
        dataCriacao: p.dataCriacao,
        origem: 'offline',
      }));
    } catch (e) {
      logErro(`Erro ao ler offline: ${e.message}`);
    }

    // Online
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      try {
        // Busca só os campos necessários para metadados
        const baseQuery = usuarioLogadoUID === ADMIN_UID
          ? query(collection(db, 'projetos'))
          : query(collection(db, 'projetos'), where('uidUsuario', '==', usuarioLogadoUID));

        const snap = await getDocs(baseQuery);
        const idsOffline = new Set(metaOffline.map(p => p.id));

        metaOnline = snap.docs
          .filter(d => !idsOffline.has(d.id))
          .map(d => ({
            id: d.id,
            nomeProjeto: d.data().nomeProjeto,
            dataCriacao: d.data().dataCriacao,
            origem: 'online',
          }));
      } catch (e) {
        logErro(`Erro ao buscar online: ${e.message}`);
      }
    }

    setTodosMetadados([...metaOffline, ...metaOnline]);
    setIsLoadingMeta(false);
  }, [usuarioLogadoUID]);

  useEffect(() => {
    buscarMetadados();
  }, [buscarMetadados]);

  // ─── 2. Metadados filtrados e ordenados (apenas IDs + timestamps) ───────────

  const metadataFiltrada = React.useMemo(() => {
    let resultado = [...todosMetadados];

    if (busca.trim()) {
      const lower = busca.toLowerCase();
      resultado = resultado.filter(p =>
        p.nomeProjeto?.toLowerCase().includes(lower)
      );
    }

    resultado.sort((a, b) =>
      ordem === 'recente'
        ? getTimestamp(b.dataCriacao) - getTimestamp(a.dataCriacao)
        : getTimestamp(a.dataCriacao) - getTimestamp(b.dataCriacao)
    );

    return resultado;
  }, [todosMetadados, busca, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(metadataFiltrada.length / PROJETOS_POR_PAGINA));

  useEffect(() => {
    setTotalFiltrado(metadataFiltrada.length);
  }, [metadataFiltrada]);

  // ─── 3. Ao mudar filtro/ordem, reseta para página 1 ─────────────────────────

  useEffect(() => {
    cursoresRef.current = {}; // cursores invalidados com nova ordenação/filtro
    setPaginaAtual(1);
  }, [busca, ordem]);

  // ─── 4. Busca os 20 projetos completos da página atual ───────────────────────

  const buscarPagina = useCallback(async (pagina) => {
    setIsLoadingPagina(true);

    const inicio = (pagina - 1) * PROJETOS_POR_PAGINA;
    const fim = inicio + PROJETOS_POR_PAGINA;
    const metaPagina = metadataFiltrada.slice(inicio, fim);

    const idsOnline = metaPagina
      .filter(m => m.origem === 'online')
      .map(m => m.id);

    const idsOfflinePagina = metaPagina
      .filter(m => m.origem === 'offline')
      .map(m => m.id);

    // Projetos offline já estão em memória
    const projetosOffline = offlineRef.current
      .filter(p => idsOfflinePagina.includes(p.id));

    // Projetos online: busca só os IDs necessários
    let projetosOnline = [];
    const state = await NetInfo.fetch();

    if (state.isConnected && idsOnline.length > 0) {
      try {
        // Firestore suporta 'in' com até 30 itens; a paginação garante <= 20
        const q = query(
          collection(db, 'projetos'),
          where('__name__', 'in', idsOnline)
        );
        const snap = await getDocs(q);
        projetosOnline = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        logErro(`Erro ao buscar página ${pagina}: ${e.message}`);
      }
    }

    // Une e reordena conforme a ordem dos metadados filtrados
    const todosCompletos = [...projetosOffline, ...projetosOnline];
    const mapa = Object.fromEntries(todosCompletos.map(p => [p.id, p]));
    const ordenados = metaPagina
      .map(m => mapa[m.id])
      .filter(Boolean)
      .map(p => ({
        ...p,
        dataCriacaoFormatada: convertTimestampToDateTime(p.dataCriacao),
      }));

    setProjetosDaPagina(ordenados);
    setIsLoadingPagina(false);
    flatListRef.current?.scrollToOffset({ animated: true, offset: 0 });
  }, [metadataFiltrada, db]);

  useEffect(() => {
    if (!isLoadingMeta) {
      buscarPagina(paginaAtual);
    }
  }, [paginaAtual, metadataFiltrada, isLoadingMeta]);

  // ─── Paginação ───────────────────────────────────────────────────────────────

  const irParaPagina = (pagina) => {
    if (pagina < 1 || pagina > totalPaginas) return;
    setPaginaAtual(pagina);
  };

  const gerarNumerosPaginas = () => {
    if (totalPaginas <= 7) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    if (paginaAtual <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPaginas];
    }
    if (paginaAtual >= totalPaginas - 3) {
      return [1, '...', totalPaginas - 4, totalPaginas - 3, totalPaginas - 2, totalPaginas - 1, totalPaginas];
    }
    return [1, '...', paginaAtual - 1, paginaAtual, paginaAtual + 1, '...', totalPaginas];
  };

  const handleScroll = (e) => setShowScrollButton(e.nativeEvent.contentOffset.y > 200);
  const scrollToTop = () => flatListRef.current?.scrollToOffset({ animated: true, offset: 0 });

  // ─── Renders ─────────────────────────────────────────────────────────────────

  if (isLoadingMeta) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E75F07" />
        <Text style={styles.loadingTexto}>Carregando projetos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={styles.titulo}>Histórico de Projetos</Text>

      {/* Filtros em coluna */}
      <View style={styles.filtroContainer}>
        <TextInput
          style={styles.filtroInput}
          placeholder="Buscar por nome"
          value={busca}
          onChangeText={setBusca}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={ordem}
            style={styles.picker}
            onValueChange={(val) => setOrdem(val)}
            mode="dropdown"
          >
            <Picker.Item label="Mais recente" value="recente" />
            <Picker.Item label="Mais antigo" value="antigo" />
          </Picker>
        </View>
      </View>

      <Text style={styles.resumo}>
        {totalFiltrado} projeto{totalFiltrado !== 1 ? 's' : ''} encontrado{totalFiltrado !== 1 ? 's' : ''} · Página {paginaAtual} de {totalPaginas}
      </Text>

      {isLoadingPagina ? (
        <View style={styles.loadingPaginaContainer}>
          <ActivityIndicator size="small" color="#E75F07" />
          <Text style={styles.loadingTexto}>Buscando projetos...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={projetosDaPagina}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.projetoCard}>
              <View style={styles.projetoInfo}>
                <Text style={styles.projetoNome}>{item.nomeProjeto}</Text>
                <Text style={styles.projetoData}>{item.dataCriacaoFormatada}</Text>
                {item.informacoesOperacao?.numeroNF ? (
                  <Text style={styles.projetoMeta}>NF: {item.informacoesOperacao.numeroNF}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.verMaisBtn}
                onPress={() => navigation.navigate('DetalheProjeto', { projetoId: item.id })}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.vazioContainer}>
              <Ionicons name="folder-open-outline" size={48} color="#ddd" />
              <Text style={styles.vazioTexto}>Nenhum projeto encontrado</Text>
            </View>
          }
          ListFooterComponent={
            totalPaginas > 1 ? (
              <View style={styles.paginacaoContainer}>
                <TouchableOpacity
                  style={[styles.paginaBtnSeta, paginaAtual === 1 && styles.paginaBtnDesabilitado]}
                  onPress={() => irParaPagina(paginaAtual - 1)}
                  disabled={paginaAtual === 1}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={18} color={paginaAtual === 1 ? '#ccc' : '#E75F07'} />
                </TouchableOpacity>

                {gerarNumerosPaginas().map((item, index) =>
                  item === '...' ? (
                    <Text key={`ellipsis-${index}`} style={styles.paginaEllipsis}>…</Text>
                  ) : (
                    <TouchableOpacity
                      key={item}
                      style={[styles.paginaBtn, paginaAtual === item && styles.paginaBtnAtivo]}
                      onPress={() => irParaPagina(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.paginaBtnTexto, paginaAtual === item && styles.paginaBtnTextoAtivo]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )
                )}

                <TouchableOpacity
                  style={[styles.paginaBtnSeta, paginaAtual === totalPaginas && styles.paginaBtnDesabilitado]}
                  onPress={() => irParaPagina(paginaAtual + 1)}
                  disabled={paginaAtual === totalPaginas}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={18} color={paginaAtual === totalPaginas ? '#ccc' : '#E75F07'} />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {showScrollButton && <ScrollToTopButton onPress={scrollToTop} />}

      <Modal
        animationType="slide"
        transparent
        visible={modalErroVisivel}
        onRequestClose={() => setModalErroVisivel(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Ionicons name="warning-outline" size={36} color="#FF5C00" style={{ marginBottom: 12 }} />
            <Text style={styles.modalTitulo}>Erro ao carregar</Text>
            <Text style={styles.errorText}>{erroLogs}</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setModalErroVisivel(false)}
            >
              <Text style={styles.modalBtnTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FFF', paddingTop: 72 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingPaginaContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  loadingTexto: { color: '#aaa', fontSize: 14 },

  titulo: { fontSize: 22, fontWeight: 'bold', color: '#E75F07', marginBottom: 14, marginTop: 4 },

  // Filtros em coluna
  filtroContainer: {
    flexDirection: 'column',
    marginBottom: 8,
    gap: 8,
  },
  filtroInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  // Wrapper necessário para o Picker respeitar bordas no RN
  pickerWrapper: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: 48,
  },

  resumo: { fontSize: 12, color: '#aaa', marginBottom: 12 },

  projetoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 14,
    marginBottom: 10,
  },
  projetoInfo: { flex: 1 },
  projetoNome: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 2 },
  projetoData: { fontSize: 12, color: '#888' },
  projetoMeta: { fontSize: 12, color: '#aaa', marginTop: 2 },
  verMaisBtn: {
    backgroundColor: '#E75F07',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  vazioContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  vazioTexto: { color: '#ccc', fontSize: 15 },

  paginacaoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 20,
  },
  paginaBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  paginaBtnAtivo: { backgroundColor: '#E75F07', borderColor: '#E75F07' },
  paginaBtnTexto: { fontSize: 13, color: '#555', fontWeight: '600' },
  paginaBtnTextoAtivo: { color: '#fff' },
  paginaBtnSeta: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  paginaBtnDesabilitado: { borderColor: '#f0f0f0', backgroundColor: '#fafafa' },
  paginaEllipsis: { fontSize: 15, color: '#aaa', paddingHorizontal: 2, lineHeight: 36 },

  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalView: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitulo: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 10 },
  errorText: { fontSize: 13, color: '#e53e3e', textAlign: 'center', marginBottom: 16 },
  modalBtn: {
    backgroundColor: '#787878',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 4,
  },
  modalBtnTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
