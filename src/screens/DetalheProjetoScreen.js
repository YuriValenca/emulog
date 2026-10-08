import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { printToFileAsync } from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import BackButton from './BackButton';
import InformacoesOperacao from './InformacoesOperacao';
import FotosDaOperacao from './FotosDaOperacao';
import { LOGO_BASE_64 } from '../assets/base64Logo';
import { useAppAuth } from '../context/auth';
import { pesagemConcluida, formatarHoraPesagem } from '../helpers/pesagem';
import { paraData, mesmoDia } from '../helpers/datas';
import { calibragemVencidaNoProjeto } from '../helpers/calibragem';
import { kgPreenchido, formatarKg } from '../helpers/numeros';
import { somarCargasReais } from '../helpers/furos';
import { montarRelatorioDoFogo, montarRelatorioDeFuros, temInformacoesDaOperacao } from '../relatorios';
import { listarMidias, lerMidiaComoDataUri } from '../midias';

const RELATORIO = { FOGO: 'fogo', FUROS: 'furos' };

const db = getFirestore();

export default function DetalheProjetoScreen() {
  const [projeto, setProjeto] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [amostraPesquisa, setAmostraPesquisa] = useState('');
  const [modalInfoVisivel, setModalInfoVisivel] = useState(false);
  const [companyData, setCompanyData] = useState(null);
  const [midias, setMidias] = useState(null);
  const [relatorioEmPreparo, setRelatorioEmPreparo] = useState(null);

  const route = useRoute();
  const navigation = useNavigation();
  const { projetoId } = route.params;
  const { companyId, uid, role } = useAppAuth();

  const buscarProjeto = async () => {
    try {
      const docRef = doc(db, 'projetos', projetoId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        data.calibragemVencida = calibragemVencidaNoProjeto(data);
        data.dataConclusao = data.dataConclusao && !mesmoDia(data.dataCriacao, data.dataConclusao)
          ? paraData(data.dataConclusao).toLocaleDateString()
          : null;
        if (data.dataCriacao && typeof data.dataCriacao.toDate === 'function') {
          data.dataCriacao = data.dataCriacao.toDate().toLocaleDateString();
        } else if (typeof data.dataCriacao === 'string') {
          data.dataCriacao = new Date(data.dataCriacao).toLocaleDateString();
        }
        if (data.calibragem?.timestamp && typeof data.calibragem.timestamp.toDate === 'function') {
          data.calibragem.timestamp = data.calibragem.timestamp.toDate().toLocaleDateString();
        } else if (typeof data.calibragem?.timestamp === 'string') {
          data.calibragem.timestamp = new Date(data.calibragem.timestamp).toLocaleDateString();
        }
        setProjeto(data);

        const projetoCompanyId = data.companyId || companyId;
        if (projetoCompanyId) {
          try {
            const companySnap = await getDoc(doc(db, 'companies', projetoCompanyId));
            if (companySnap.exists()) {
              setCompanyData({ id: companySnap.id, ...companySnap.data() });
            }
          } catch (e) {
            console.warn('Erro ao buscar dados da empresa:', e);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao buscar o projeto:', e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    buscarProjeto();
  }, [projetoId]);

  const handleInfoSalva = (novaInfo) => {
    setProjeto(prev => ({ ...prev, informacoesOperacao: novaInfo }));
  };

  const gerarNomeArquivoPDF = (sufixo) => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const nomeSafe = projeto.nomeProjeto.replace(/[\/\\:*?"<>|]/g, '-');
    return `${nomeSafe}${sufixo ? ` - ${sufixo}` : ''} - ${d}-${m}-${y}`;
  };

  const fetchImageAsBase64 = async (url) => {
    try {
      if (url.startsWith('data:')) return url;

      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Erro ao converter imagem para base64:', e);
      return null;
    }
  };

  const buscarFotosParaPDF = async () => {
    const lista = midias ?? (await listarMidias(
      { projetoId, companyIdDoProjeto: projeto.companyId || companyId },
      { companyId, uid }
    )).midias;
    const fotos = await Promise.all(lista.map(midia => lerMidiaComoDataUri(midia).catch(() => null)));
    return fotos.filter(Boolean);
  };

  const buscarLogoDaEmpresa = async () => {
    if (!companyData?.logo) return LOGO_BASE_64;
    return (await fetchImageAsBase64(companyData.logo)) || LOGO_BASE_64;
  };

  const montarHtml = async (tipo) => {
    const base = {
      projeto,
      logoEmpresa: await buscarLogoDaEmpresa(),
      cor: companyData?.primaryColor || '#1F6452',
    };
    if (tipo === RELATORIO.FUROS) return montarRelatorioDeFuros(base);
    return montarRelatorioDoFogo({
      ...base,
      fotos: await buscarFotosParaPDF(),
      mostrarObservacaoTecnica: companyId === 'explog-founding',
    });
  };

  const compartilharPDF = async (html, nomeDoArquivo) => {
    const { uri } = await printToFileAsync({ html, base64: false });
    const destUri = `${FileSystem.documentDirectory}${nomeDoArquivo}.pdf`;
    await FileSystem.moveAsync({ from: uri, to: destUri });
    await Sharing.shareAsync(destUri);
  };

  const gerarRelatorio = async (tipo) => {
    if (!projeto || relatorioEmPreparo) return;
    setRelatorioEmPreparo(tipo);
    try {
      const sufixo = tipo === RELATORIO.FUROS ? 'Furos' : '';
      await compartilharPDF(await montarHtml(tipo), gerarNomeArquivoPDF(sufixo));
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      Alert.alert('Erro', 'Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setRelatorioEmPreparo(null);
    }
  };

  const renderizarResumoDosFuros = (furos) => (
    <View style={styles.furosBox}>
      <Text style={styles.infoAdicionalTitulo}>Furos</Text>
      <View style={styles.furoRow}>
        <Text style={styles.furoLabel}>Quantidade de furos</Text>
        <Text style={styles.furoValor}>{furos.itens.length}</Text>
      </View>
      <View style={styles.furoRow}>
        <Text style={styles.furoLabel}>Profundidade prevista</Text>
        <Text style={styles.furoValor}>{formatarKg(furos.profundidadePrevista)} m</Text>
      </View>
      <View style={styles.furoRow}>
        <Text style={styles.furoLabel}>Carga prevista por furo</Text>
        <Text style={styles.furoValor}>{formatarKg(furos.cargaPrevista)} kg</Text>
      </View>
      <View style={[styles.furoRow, styles.furoTotalRow]}>
        <Text style={styles.furoTotal}>Total aplicado: {formatarKg(somarCargasReais(furos.itens))} kg</Text>
      </View>
    </View>
  );

  const renderizarBotaoDeRelatorio = (tipo, rotulo) => {
    const preparando = relatorioEmPreparo === tipo;
    return (
      <TouchableOpacity
        key={tipo}
        style={[styles.pdfButton, relatorioEmPreparo && styles.pdfButtonDesabilitado]}
        onPress={() => gerarRelatorio(tipo)}
        disabled={!!relatorioEmPreparo}
        activeOpacity={0.8}
      >
        {preparando
          ? <ActivityIndicator size="small" color="#FFF" />
          : <Ionicons name="document-text-outline" size={20} color="#FFF" />}
        <Text style={styles.pdfButtonText}>{preparando ? 'Preparando PDF...' : rotulo}</Text>
      </TouchableOpacity>
    );
  };

  const renderizarAmostras = (amostras) => {
    if (!amostras || amostras.length === 0) return <Text style={styles.vazioTexto}>Nenhuma amostra encontrada</Text>;

    return amostras.map((amostra, index) => (
      <View key={index} style={styles.amostraContainer}>
        <Text style={styles.amostraTitulo}>Amostra {amostra.amostraId + 1}</Text>
        {(amostra.pesagens || [])
          .filter(pesagemConcluida)
          .map((pesagem, i) => (
            <View key={i} style={styles.pesagemContainer}>
              <View style={styles.pesagemRowHeader}>
                <Text style={styles.pesagemHeader}>Pesagem {i + 1}</Text>
                <Text style={styles.pesagemHeader}>Densidade</Text>
                <Text style={styles.pesagemHeader}>Hora</Text>
              </View>
              <View style={styles.pesagemRow}>
                <Text style={styles.pesagemText}>{pesagem.peso} g</Text>
                <Text style={styles.pesagemText}>{pesagem.densidade} g/cm³</Text>
                <Text style={styles.pesagemText}>{formatarHoraPesagem(pesagem.timestamp)}</Text>
              </View>
            </View>
          ))}
      </View>
    ));
  };

  const renderizarInformacoesAdicionais = (info) => {
    return (
      <View style={styles.infoAdicionalBox}>
        <Text style={styles.infoAdicionalTitulo}>Informações da Operação</Text>
        {info.numeroNF ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nota Fiscal</Text>
            <Text style={styles.infoValor}>{info.numeroNF}</Text>
          </View>
        ) : null}
        {kgPreenchido(info.kgPrevisto) ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kg Previsto</Text>
            <Text style={styles.infoValor}>{formatarKg(info.kgPrevisto)} kg</Text>
          </View>
        ) : null}
        {kgPreenchido(info.kgAplicado) ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kg Aplicado</Text>
            <Text style={styles.infoValor}>{formatarKg(info.kgAplicado)} kg</Text>
          </View>
        ) : null}
        {info.caminhao ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Unidade de Bombeamento</Text>
            <Text style={styles.infoValor}>{info.caminhao.placa || '—'}</Text>
          </View>
        ) : null}
        {info.equipe && info.equipe.length > 0 ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Equipe</Text>
            <View style={styles.equipeBaloes}>
              {info.equipe.map((m, i) => (
                <View key={i} style={styles.equipeBalao}>
                  <Text style={styles.equipeBalaoTexto}>{m.nome}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.editarInfoBtn}
          onPress={() => setModalInfoVisivel(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={16} color="#1F6452" />
          <Text style={styles.editarInfoBtnTexto}>Editar informações</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1F6452" />
        <Text style={styles.loadingTexto}>Carregando...</Text>
      </View>
    );
  }

  if (!projeto) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Projeto não encontrado</Text>
      </View>
    );
  }

  const infoAtual = projeto.informacoesOperacao;
  const temFuros = projeto.furos?.itens?.length > 0;
  const historicoFiltrado = projeto.amostras?.filter((amostra) => {
    if (!amostraPesquisa) return true;
    return amostra.amostraId?.toString() === amostraPesquisa;
  }) || [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.backButtonWrapper}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <Text style={styles.titulo}>{projeto.nomeProjeto}</Text>

      {projeto.cliente ? (
        <Text style={styles.clienteTexto}>{projeto.cliente.nome}</Text>
      ) : null}

      <Text style={styles.label}>Data de Criação</Text>
      <Text style={styles.valor}>{projeto.dataCriacao}</Text>

      {projeto.dataConclusao ? (
        <>
          <Text style={styles.label}>Data de Conclusão</Text>
          <Text style={styles.valor}>{projeto.dataConclusao}</Text>
        </>
      ) : null}

      <Text style={styles.label}>Calibragem</Text>
      <View style={styles.calibragemBox}>
        <View style={styles.calibragemRow}>
          <Text style={styles.calibragemLabel}>Tara</Text>
          <Text style={styles.calibragemValor}>{projeto.calibragem?.tara || 'Não informado'}</Text>
        </View>
        <View style={styles.calibragemRow}>
          <Text style={styles.calibragemLabel}>Peso Cheio</Text>
          <Text style={styles.calibragemValor}>{projeto.calibragem?.pesoCheio || 'Não informado'}</Text>
        </View>
        <View style={styles.calibragemRow}>
          <Text style={styles.calibragemLabel}>Necessita Calibragem</Text>
          <Text style={[styles.calibragemValor, { color: projeto.calibragemVencida ? '#D32F2F' : '#4CAF50' }]}>
            {projeto.calibragemVencida ? 'Sim' : 'Não'}
          </Text>
        </View>
      </View>

      {temInformacoesDaOperacao(infoAtual)
        ? renderizarInformacoesAdicionais(infoAtual)
        : (
          <TouchableOpacity
            style={styles.adicionarInfoBtn}
            onPress={() => setModalInfoVisivel(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color="#1F6452" />
            <Text style={styles.adicionarInfoBtnTexto}>Adicionar informações da operação</Text>
          </TouchableOpacity>
        )
      }

      <Text style={styles.label}>Observação sobre o projeto</Text>
      <View style={styles.observacaoBox}>
        <Text style={styles.valor}>{projeto.informacoesOperacao?.informacoesGerais || 'Sem observações'}</Text>
      </View>

      <View style={styles.fotosWrapper}>
        <FotosDaOperacao
          projetoId={projetoId}
          companyIdDoProjeto={projeto.companyId}
          aoAlterar={setMidias}
        />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Buscar Amostra"
        placeholderTextColor="#888888"
        value={amostraPesquisa}
        onChangeText={setAmostraPesquisa}
      />

      <Text style={styles.label}>Amostras</Text>
      {renderizarAmostras(historicoFiltrado)}

      {temFuros ? renderizarResumoDosFuros(projeto.furos) : null}

      <View style={styles.relatorios}>
        {temFuros
          ? [
            renderizarBotaoDeRelatorio(RELATORIO.FOGO, 'Relatório do fogo'),
            renderizarBotaoDeRelatorio(RELATORIO.FUROS, 'Relatório de furos'),
          ]
          : renderizarBotaoDeRelatorio(RELATORIO.FOGO, 'Gerar PDF')}
      </View>

      <InformacoesOperacao
        modoModal
        visivel={modalInfoVisivel}
        onFechar={() => setModalInfoVisivel(false)}
        onSalvo={handleInfoSalva}
        projetoId={projetoId}
        infoInicial={infoAtual}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#fff', paddingTop: 42 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTexto: { color: '#aaa', fontSize: 14 },
  backButtonWrapper: { marginTop: 32, marginBottom: 8 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 2, marginTop: 8, color: '#1F6452' },
  clienteTexto: { fontSize: 18, color: '#555', fontWeight: '600' },
  label: { fontSize: 15, fontWeight: '700', color: '#444', marginTop: 16, marginBottom: 6 },
  valor: { fontSize: 15, color: '#333' },
  calibragemBox: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 8, overflow: 'hidden' },
  calibragemRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  calibragemLabel: { fontSize: 14, color: '#555' },
  calibragemValor: { fontSize: 14, fontWeight: '600', color: '#333' },
  adicionarInfoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#1F6452', borderStyle: 'dashed',
    borderRadius: 10,
  },
  adicionarInfoBtnTexto: { fontSize: 14, color: '#1F6452', fontWeight: '600' },
  infoAdicionalBox: { marginTop: 16, borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 8, overflow: 'hidden' },
  infoAdicionalTitulo: { fontSize: 14, fontWeight: '700', color: '#fff', backgroundColor: '#1F6452', paddingHorizontal: 12, paddingVertical: 8 },
  infoRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  infoValor: { fontSize: 14, color: '#333', fontWeight: '500' },
  equipeBaloes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  equipeBalao: { backgroundColor: '#E3F0EC', borderWidth: 1, borderColor: '#1F6452', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  equipeBalaoTexto: { fontSize: 12, color: '#1F6452', fontWeight: '600' },
  editarInfoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  editarInfoBtnTexto: { fontSize: 13, color: '#1F6452', fontWeight: '600' },
  observacaoBox: { backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e2e2e2' },
  input: { color: '#000000', backgroundColor: '#FFF', borderColor: '#CCC', borderWidth: 1, borderRadius: 5, padding: 10, marginTop: 20, marginBottom: 10, fontSize: 16 },
  amostraContainer: { marginTop: 10, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e2e2' },
  amostraTitulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  pesagemContainer: { marginTop: 8 },
  pesagemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, padding: 10, backgroundColor: '#efefef', borderRadius: 5 },
  pesagemRowHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#ddd', borderRadius: 5 },
  pesagemText: { fontSize: 13, color: '#333' },
  pesagemHeader: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  vazioTexto: { color: '#aaa', fontStyle: 'italic' },
  furosBox: { marginTop: 16, borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 8, overflow: 'hidden' },
  furoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  furoLabel: { fontSize: 14, color: '#555' },
  furoValor: { fontSize: 14, fontWeight: '600', color: '#333' },
  furoTotalRow: { justifyContent: 'flex-end', backgroundColor: '#E3F0EC', borderBottomWidth: 0 },
  furoTotal: { fontSize: 14, fontWeight: '700', color: '#1F6452' },
  pdfButton: {
    backgroundColor: '#1F6452', padding: 14, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8,
  },
  pdfButtonDesabilitado: { backgroundColor: '#8BC3B3' },
  relatorios: { marginTop: 24, marginBottom: 24, gap: 12 },
  fotosWrapper: { marginTop: 16 },
  pdfButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
