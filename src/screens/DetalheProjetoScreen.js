import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { printToFileAsync } from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Ionicons } from '@expo/vector-icons';
import BackButton from './BackButton';
import InformacoesOperacao from './InformacoesOperacao';

const db = getFirestore();

export default function DetalheProjetoScreen() {
  const [projeto, setProjeto] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [amostraPesquisa, setAmostraPesquisa] = useState('');
  const [modalInfoVisivel, setModalInfoVisivel] = useState(false);

  const route = useRoute();
  const navigation = useNavigation();
  const { projetoId } = route.params;

  const buscarProjeto = async () => {
    try {
      const docRef = doc(db, 'projetos', projetoId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
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

  const hasAdditionalInfo = (info) => {
    if (!info) return false;
    return !!(
      info.numeroNF?.trim() ||
      info.kgPrevisto?.trim() ||
      info.kgAplicado?.trim() ||
      info.caminhao ||
      (info.equipe && info.equipe.length > 0) ||
      info.informacoesGerais?.trim()
    );
  };

  const gerarNomeArquivoPDF = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${projeto.nomeProjeto} - ${d}-${m}-${y}`;
  };

  const gerarPDF = async () => {
    if (!projeto) return;

      const asset = Asset.fromModule(require('../../assets/pdfIcon.png'));
      await asset.downloadAsync();
      const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const logoBase64 = `data:image/png;base64,${base64}`;

    const info = projeto.informacoesOperacao;
    const observacao = projeto.observacao || 'Sem observações';

    const htmlContent = `
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 10px; margin: 30px; }
        h1 { color: #333; }
        .header-container { display: flex; align-items: flex-start; }
        .logo { width: 150px; margin-bottom: 20px; }
        .project-details { margin-left: 20px; flex: 1; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
        th { background-color: #f2f2f2; }
        .amostra-container { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .amostra-box { width: 48%; border: 1px solid #ccc; padding: 10px; }
        .amostra-header { background-color: #f2f2f2; padding: 5px; font-weight: bold; margin-bottom: 10px; }
        .pesagem-row { margin-bottom: 5px; }
        .content-box { border: 2px solid orange; padding: 10px; border-radius: 5px; color: black; margin-top: 20px; }
        .observacao-box { border: 1px solid #ccc; padding: 10px; margin-top: 20px; }
        .observacao-header { background-color: #f2f2f2; padding: 5px; font-weight: bold; }
        .info-box { border: 1px solid #ccc; padding: 10px; margin-top: 20px; }
        .info-header { background-color: #FF5C00; color: #fff; padding: 6px 10px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header-container">
        <img src="${logoBase64}" class="logo" alt="Logo" />
        <div class="project-details">
          <h1>Projeto: ${projeto.nomeProjeto}</h1>
          <p><strong>Data de Criação:</strong> ${projeto.dataCriacao}</p>
          <p><strong>Calibragem:</strong></p>
          <ul>
            <li>Tara: ${projeto.calibragem?.tara || 'Não informado'}</li>
            <li>Peso Cheio: ${projeto.calibragem?.pesoCheio || 'Não informado'}</li>
            <li>Necessita Calibragem: ${projeto.calibragem?.necessitaCalibragem ? 'Sim' : 'Não'}</li>
          </ul>
        </div>
      </div>

      ${hasAdditionalInfo(info) ? `
      <div class="info-box">
        <div class="info-header">Informações da Operação</div>
        <table>
          <tbody>
            ${info.numeroNF ? `<tr><td><strong>Nota Fiscal</strong></td><td>${info.numeroNF}</td></tr>` : ''}
            ${info.kgPrevisto ? `<tr><td><strong>Kg Previsto</strong></td><td>${info.kgPrevisto} kg</td></tr>` : ''}
            ${info.kgAplicado ? `<tr><td><strong>Kg Aplicado</strong></td><td>${info.kgAplicado} kg</td></tr>` : ''}
            ${info.caminhao ? `<tr><td><strong>Unidade de Bombeamento</strong></td><td>${info.caminhao.placa || ''}</td></tr>` : ''}
            ${info.equipe && info.equipe.length > 0 ? `<tr><td><strong>Equipe</strong></td><td>${info.equipe.map(m => m.nome).join(', ')}</td></tr>` : ''}
          </tbody>
        </table>
      </div>` : ''}

      <div class="content-box">
        <h2 style="color: orange;">Observação Técnica:</h2>
        <p>A 4ª pesagem de cada amostra deve estar com densidade na faixa de trabalho que vai de 1.00 a 1.10 g/cm³. Amostras fora da faixa devem ser informadas ao setor técnico da Explog.</p>
      </div>
      <div class="observacao-box">
        <div class="observacao-header">Observação sobre o projeto</div>
        <p>${observacao}</p>
      </div>
      <h2>Quantidade de Amostras: ${projeto.quantidadeAmostras}</h2>
      ${projeto.amostras && Array.isArray(projeto.amostras) ? gerarConteudoAmostrasPDF(projeto.amostras) : '<p>Nenhuma amostra disponível</p>'}
    </body>
    </html>`;

    const { uri } = await printToFileAsync({ html: htmlContent, base64: false });
    const destUri = `${FileSystem.documentDirectory}${gerarNomeArquivoPDF()}.pdf`;
    await FileSystem.moveAsync({ from: uri, to: destUri });
    await Sharing.shareAsync(destUri);
  };

  const gerarConteudoAmostrasPDF = (amostras) => {
    return amostras.map((amostra, index) => {
      if (amostra.pesagens && Array.isArray(amostra.pesagens)) {
        return `
          ${index % 2 === 0 ? '<div class="amostra-container">' : ''}
          <div class="amostra-box">
            <div class="amostra-header">Amostra ${amostra.amostraId + 1}</div>
            ${amostra.pesagens.map((p, i) => `
              <div class="pesagem-row">
                <strong>Pesagem ${i + 1}</strong>: ${p.peso} g, ${p.densidade} g/cm³, ${p.timestamp}
              </div>`).join('')}
          </div>
          ${index % 2 === 1 || index === amostras.length - 1 ? '</div>' : ''}`;
      }
      return `
        ${index % 2 === 0 ? '<div class="amostra-container">' : ''}
        <div class="amostra-box">
          <div class="amostra-header">Amostra ${(amostra.grupoId ?? 0) + 1}</div>
          <div class="pesagem-row"><strong>Pesagem ${(amostra.amostraId ?? 0) + 1}</strong>: ${amostra.peso} g, ${amostra.densidade} g/cm³</div>
        </div>
        ${index % 2 === 1 || index === amostras.length - 1 ? '</div>' : ''}`;
    }).join('');
  };

  const agruparPesagensPorAmostra = (amostras) => {
    const grupos = {};
    amostras.forEach(p => {
      if (!grupos[p.grupoId]) grupos[p.grupoId] = [];
      grupos[p.grupoId].push(p);
    });
    return grupos;
  };

  const renderizarAmostras = (amostras) => {
    if (!amostras || amostras.length === 0) return <Text style={styles.vazioTexto}>Nenhuma amostra encontrada</Text>;

    if (amostras[0]?.pesagens) {
      return amostras.map((amostra, index) => (
        <View key={index} style={styles.amostraContainer}>
          <Text style={styles.amostraTitulo}>Amostra {amostra.amostraId + 1}</Text>
          {amostra.pesagens.map((pesagem, i) => (
            <View key={i} style={styles.pesagemContainer}>
              <View style={styles.pesagemRowHeader}>
                <Text style={styles.pesagemHeader}>Pesagem {i + 1}</Text>
                <Text style={styles.pesagemHeader}>Densidade</Text>
                <Text style={styles.pesagemHeader}>Hora</Text>
              </View>
              <View style={styles.pesagemRow}>
                <Text style={styles.pesagemText}>{pesagem.peso} g</Text>
                <Text style={styles.pesagemText}>{pesagem.densidade} g/cm³</Text>
                <Text style={styles.pesagemText}>{pesagem.timestamp}</Text>
              </View>
            </View>
          ))}
        </View>
      ));
    }

    const grupos = agruparPesagensPorAmostra(amostras);
    return Object.entries(grupos).map(([grupoId, pesagens]) => (
      <View key={grupoId} style={styles.amostraContainer}>
        <Text style={styles.amostraTitulo}>Amostra {parseInt(grupoId) + 1}</Text>
        {pesagens.map((p, i) => (
          <View key={i} style={styles.pesagemContainer}>
            <View style={styles.pesagemRowHeader}>
              <Text style={styles.pesagemHeader}>Pesagem {p.amostraId + 1}</Text>
              <Text style={styles.pesagemHeader}>Densidade</Text>
              <Text style={styles.pesagemHeader}>Hora</Text>
            </View>
            <View style={styles.pesagemRow}>
              <Text style={styles.pesagemText}>{p.peso} g</Text>
              <Text style={styles.pesagemText}>{p.densidade} g/cm³</Text>
              <Text style={styles.pesagemText}>{p.timestamp}</Text>
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
        {info.kgPrevisto ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kg Previsto</Text>
            <Text style={styles.infoValor}>{info.kgPrevisto} kg</Text>
          </View>
        ) : null}
        {info.kgAplicado ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kg Aplicado</Text>
            <Text style={styles.infoValor}>{info.kgAplicado} kg</Text>
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
          <Ionicons name="pencil-outline" size={16} color="#E75F07" />
          <Text style={styles.editarInfoBtnTexto}>Editar informações</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E75F07" />
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
  const historicoFiltrado = projeto.amostras?.filter((amostra) => {
    if (!amostraPesquisa) return true;
    return amostra.amostraId?.toString() === amostraPesquisa || amostra.grupoId?.toString() === amostraPesquisa;
  }) || [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.backButtonWrapper}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <Text style={styles.titulo}>{projeto.nomeProjeto}</Text>

      <Text style={styles.label}>Data de Criação</Text>
      <Text style={styles.valor}>{projeto.dataCriacao}</Text>

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
          <Text style={[styles.calibragemValor, { color: projeto.calibragem?.necessitaCalibragem ? '#e53e3e' : '#38a169' }]}>
            {projeto.calibragem?.necessitaCalibragem ? 'Sim' : 'Não'}
          </Text>
        </View>
      </View>

      {hasAdditionalInfo(infoAtual)
        ? renderizarInformacoesAdicionais(infoAtual)
        : (
          <TouchableOpacity
            style={styles.adicionarInfoBtn}
            onPress={() => setModalInfoVisivel(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color="#E75F07" />
            <Text style={styles.adicionarInfoBtnTexto}>Adicionar informações da operação</Text>
          </TouchableOpacity>
        )
      }

      <Text style={styles.label}>Observação sobre o projeto</Text>
      <View style={styles.observacaoBox}>
        <Text style={styles.valor}>{projeto.observacao || 'Sem observações'}</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Buscar Amostra"
        value={amostraPesquisa}
        onChangeText={setAmostraPesquisa}
      />

      <Text style={styles.label}>Amostras</Text>
      {renderizarAmostras(historicoFiltrado)}

      <TouchableOpacity style={styles.pdfButton} onPress={gerarPDF} activeOpacity={0.8}>
        <Ionicons name="document-text-outline" size={20} color="#FFF" />
        <Text style={styles.pdfButtonText}>Gerar PDF</Text>
      </TouchableOpacity>

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
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, marginTop: 8, color: '#E75F07' },
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
    borderWidth: 1.5, borderColor: '#E75F07', borderStyle: 'dashed',
    borderRadius: 10,
  },
  adicionarInfoBtnTexto: { fontSize: 14, color: '#E75F07', fontWeight: '600' },

  infoAdicionalBox: { marginTop: 16, borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 8, overflow: 'hidden' },
  infoAdicionalTitulo: { fontSize: 14, fontWeight: '700', color: '#fff', backgroundColor: '#E75F07', paddingHorizontal: 12, paddingVertical: 8 },
  infoRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  infoValor: { fontSize: 14, color: '#333', fontWeight: '500' },
  equipeBaloes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  equipeBalao: { backgroundColor: '#fff0e8', borderWidth: 1, borderColor: '#E75F07', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  equipeBalaoTexto: { fontSize: 12, color: '#E75F07', fontWeight: '600' },
  editarInfoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  editarInfoBtnTexto: { fontSize: 13, color: '#E75F07', fontWeight: '600' },

  observacaoBox: { backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e2e2e2' },
  input: { backgroundColor: '#FFF', borderColor: '#CCC', borderWidth: 1, borderRadius: 5, padding: 10, marginTop: 20, marginBottom: 10, fontSize: 16 },

  amostraContainer: { marginTop: 10, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e2e2' },
  amostraTitulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  pesagemContainer: { marginTop: 8 },
  pesagemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, padding: 10, backgroundColor: '#efefef', borderRadius: 5 },
  pesagemRowHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#ddd', borderRadius: 5 },
  pesagemText: { fontSize: 13, color: '#333' },
  pesagemHeader: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  vazioTexto: { color: '#aaa', fontStyle: 'italic' },

  pdfButton: {
    backgroundColor: '#E75F07', padding: 14, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, marginTop: 24, marginBottom: 24,
  },
  pdfButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
