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
import { LOGO_EMULOG } from '../assets/logoEmulog';
import { useAppAuth } from '../context/auth';
import { pesagemConcluida, formatarHoraPesagem } from '../helpers/pesagem';
import { paraData, mesmoDia, formatarDataHora } from '../helpers/datas';
import { calibragemVencidaNoProjeto } from '../helpers/calibragem';
import { kgPreenchido, formatarKg } from '../helpers/numeros';
import { somarFuros } from '../helpers/furos';
import { listarMidias, lerMidiaComoDataUri } from '../midias';

const FUROS_POR_LINHA_NO_PDF = 4;

const resumoDosFuros = (furos) =>
  `${furos.length} furo${furos.length !== 1 ? 's' : ''} · total ${formatarKg(somarFuros(furos))} kg`;

const dividirEmLinhas = (itens, tamanho) =>
  Array.from({ length: Math.ceil(itens.length / tamanho) }, (_, i) => itens.slice(i * tamanho, (i + 1) * tamanho));

const db = getFirestore();

export default function DetalheProjetoScreen() {
  const [projeto, setProjeto] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [amostraPesquisa, setAmostraPesquisa] = useState('');
  const [modalInfoVisivel, setModalInfoVisivel] = useState(false);
  const [companyData, setCompanyData] = useState(null);
  const [midias, setMidias] = useState(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

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

  const hasAdditionalInfo = (info) => {
    if (!info) return false;
    return !!(
      info.numeroNF?.trim() ||
      kgPreenchido(info.kgPrevisto) ||
      kgPreenchido(info.kgAplicado) ||
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
    const nomeSafe = projeto.nomeProjeto.replace(/[\/\\:*?"<>|]/g, '-');
    return `${nomeSafe} - ${d}-${m}-${y}`;
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

  const gerarPDF = async () => {
    if (!projeto || gerandoPdf) return;
    setGerandoPdf(true);
    try {
      await montarECompartilharPDF();
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      Alert.alert('Erro', 'Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const montarECompartilharPDF = async () => {
    const info = projeto.informacoesOperacao;
    const informacoesGerais = info?.informacoesGerais;
    const isFoundingCompany = companyData?.founding === true;
    const primaryColor = companyData?.primaryColor || '#1F6452';

    let companyLogoSrc = LOGO_BASE_64;
    if (companyData?.logo) {
      const b64 = await fetchImageAsBase64(companyData.logo);
      if (b64) companyLogoSrc = b64;
    }

    const fotos = await buscarFotosParaPDF();

    const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { margin: 13mm; }
          body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; }
          table.pagina { width: 100%; border-collapse: collapse; margin: 0; }
          table.pagina > tbody > tr > td, table.pagina > tfoot > tr > td { border: none; padding: 0; }
          .espaco-rodape { height: 28px; }
          .rodape {
            position: fixed; bottom: 0; left: 0; right: 0;
            border-top: 3px solid ${primaryColor}; padding-top: 4px; background: #fff;
            display: flex; justify-content: space-between; align-items: center;
            font-size: 8px; color: #888;
          }
          .rodape-marca { display: flex; align-items: center; gap: 4px; font-weight: bold; color: #555; }
          .rodape-marca img { height: 12px; }
          h1 { color: #333; }
          .header-container {
            display: flex;
            align-items: flex-start;
            border-bottom: 3px solid ${primaryColor};
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .logo { height: 48px; width: auto; max-width: 180px; object-fit: contain; margin-bottom: 0; }
          .project-details { margin-left: 20px; flex: 1; }
          .project-details h1 { font-size: 16px; margin: 0 0 6px 0; color: #222; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
          th { background-color: #f2f2f2; }
          .amostra-container { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .amostra-box { width: 48%; border: 1px solid #ccc; padding: 10px; }
          .amostra-header { background-color: #f2f2f2; padding: 5px; font-weight: bold; margin-bottom: 10px; }
          .pesagem-row { margin-bottom: 5px; }
          .content-box {
            border: 2px solid ${primaryColor};
            padding: 10px;
            border-radius: 5px;
            color: black;
            margin-top: 20px;
          }
          .content-box h2 { color: ${primaryColor}; margin: 0 0 6px 0; font-size: 12px; }
          .informacoesGerais-box { border: 1px solid #ccc; padding: 10px; margin-top: 20px; }
          .informacoesGerais-header { background-color: #f2f2f2; padding: 5px; font-weight: bold; }
          .info-box { border: 1px solid #ccc; padding: 10px; margin-top: 20px; }
          .info-header { background-color: ${primaryColor}; color: #fff; padding: 6px 10px; font-weight: bold; }
          .furos-tabela td { width: 12.5%; }
          .furos-tabela .furo-numero { background-color: #f2f2f2; font-weight: bold; }
          .fotos-grade { display: flex; flex-wrap: wrap; justify-content: space-between; }
          .foto { width: 48%; margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid; }
          .foto img { box-sizing: border-box; width: 100%; max-height: 320px; object-fit: contain; border: 1px solid #ddd; }
          .foto p { margin: 4px 0 0 0; text-align: center; color: #555; }
          .section-title {
            font-size: 13px;
            font-weight: bold;
            color: ${primaryColor};
            margin: 20px 0 8px 0;
            border-left: 4px solid ${primaryColor};
            padding-left: 8px;
            page-break-after: avoid;
            break-after: avoid;
          }
        </style>
      </head>
      <body>
        <div class="rodape">
          <span class="rodape-marca"><img src="${LOGO_EMULOG}" /> Emulog</span>
          <span>Gerado em ${formatarDataHora(new Date())}</span>
        </div>
        <!-- O rodapé é fixo e se repete em toda página; o tfoot da tabela também se repete e reserva o espaço dele -->
        <table class="pagina"><tbody><tr><td>
        <div class="header-container">
          <img src="${companyLogoSrc}" class="logo" alt="Logo" />
          <div class="project-details">
            <h1>Projeto: ${projeto.nomeProjeto}</h1>
            ${projeto.cliente ? `<p style="margin: 0; color: #555;"><strong>Cliente:</strong> ${projeto.cliente.nome}</p>` : ''}
            <p style="margin: 4px 0 0 0; color: #555;"><strong>Data de Criação:</strong> ${projeto.dataCriacao}</p>
            ${projeto.dataConclusao ? `<p style="margin: 4px 0 0 0; color: #555;"><strong>Data de Conclusão:</strong> ${projeto.dataConclusao}</p>` : ''}
            <p style="margin: 4px 0 0 0; color: #555;">
              <strong>Calibragem:</strong>
              Tara ${projeto.calibragem?.tara || '—'} ·
              Peso Cheio ${projeto.calibragem?.pesoCheio || '—'} ·
              ${projeto.calibragemVencida ? '<span style="color:#D32F2F">Necessita recalibrar</span>' : '<span style="color:#4CAF50">OK</span>'}
            </p>
          </div>
        </div>

        ${hasAdditionalInfo(info) ? `
        <div class="info-box">
          <div class="info-header">Informações da Operação</div>
          <table>
            <tbody>
              ${info.numeroNF ? `<tr><td><strong>Nota Fiscal</strong></td><td>${info.numeroNF}</td></tr>` : ''}
              ${kgPreenchido(info.kgPrevisto) ? `<tr><td><strong>Kg Previsto</strong></td><td>${formatarKg(info.kgPrevisto)} kg</td></tr>` : ''}
              ${kgPreenchido(info.kgAplicado) ? `<tr><td><strong>Kg Aplicado</strong></td><td>${formatarKg(info.kgAplicado)} kg</td></tr>` : ''}
              ${info.caminhao ? `<tr><td><strong>Unidade de Bombeamento</strong></td><td>${info.caminhao.placa || ''}</td></tr>` : ''}
              ${info.equipe && info.equipe.length > 0 ? `<tr><td><strong>Equipe</strong></td><td>${info.equipe.map(m => m.nome).join(', ')}</td></tr>` : ''}
            </tbody>
          </table>
        </div>` : ''}

        ${companyId === 'explog-founding' ? 
          `<div class="content-box">
            <h2>Observação Técnica:</h2>
            <p>A 4ª pesagem de cada amostra deve estar com densidade na faixa de trabalho que vai de 1.00 a 1.10 g/cm³. Amostras fora da faixa devem ser informadas ao setor técnico da empresa.</p>
          </div>` : ''
        }

        ${informacoesGerais ? `<div class="informacoesGerais-box">
          <div class="informacoesGerais-header">Observação sobre o projeto</div>
          <p>${informacoesGerais}</p>
        </div>` : ''}

        <p class="section-title">Amostras — quantidade: ${projeto.quantidadeAmostras}</p>
        ${projeto.amostras && Array.isArray(projeto.amostras) ? gerarConteudoAmostrasPDF(projeto.amostras) : '<p>Nenhuma amostra disponível</p>'}

        ${projeto.furos?.length ? gerarConteudoFurosPDF(projeto.furos) : ''}

        ${fotos.length ? gerarConteudoFotosPDF(fotos) : ''}
        </td></tr></tbody>
        <tfoot><tr><td><div class="espaco-rodape"></div></td></tr></tfoot></table>
      </body>
    </html>`;

    const { uri } = await printToFileAsync({ html: htmlContent, base64: false });
    const destUri = `${FileSystem.documentDirectory}${gerarNomeArquivoPDF()}.pdf`;
    await FileSystem.moveAsync({ from: uri, to: destUri });
    await Sharing.shareAsync(destUri);
  };

  const gerarConteudoAmostrasPDF = (amostras) => {
    return amostras.map((amostra, index) => {
      const pesagensValidas = (amostra.pesagens || []).filter(pesagemConcluida);
      return `
        ${index % 2 === 0 ? '<div class="amostra-container">' : ''}
        <div class="amostra-box">
          <div class="amostra-header">Amostra ${amostra.amostraId + 1}</div>
          ${pesagensValidas.map((p, i) => `
            <div class="pesagem-row">
              <strong>Pesagem ${i + 1}</strong>: ${p.peso} g, ${p.densidade} g/cm³, ${formatarHoraPesagem(p.timestamp)}
            </div>`).join('')}
        </div>
        ${index % 2 === 1 || index === amostras.length - 1 ? '</div>' : ''}`;
    }).join('');
  };

  const gerarConteudoFurosPDF = (furos) => {
    const linhas = dividirEmLinhas(furos.map((furo, i) => ({ numero: i + 1, kg: furo.kg })), FUROS_POR_LINHA_NO_PDF);
    return `
      <p class="section-title">Pesos por furo — ${resumoDosFuros(furos)}</p>
      <table class="furos-tabela">
        <tbody>
          ${linhas.map(linha => `
            <tr>
              ${linha.map(({ numero, kg }) => `<td class="furo-numero">Furo ${numero}</td><td>${formatarKg(kg)} kg</td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>`;
  };

  const gerarConteudoFotosPDF = (fotos) => `
    <p class="section-title">Registro fotográfico — ${fotos.length} foto${fotos.length !== 1 ? 's' : ''}</p>
    <div class="fotos-grade">
      ${fotos.map((foto, i) => `<div class="foto"><img src="${foto}" /><p>Foto ${i + 1}</p></div>`).join('')}
    </div>`;

  const renderizarFuros = (furos) => (
    <View style={styles.furosBox}>
      <Text style={styles.infoAdicionalTitulo}>Pesos por furo</Text>
      {furos.map((furo, i) => (
        <View key={i} style={styles.furoRow}>
          <Text style={styles.furoLabel}>Furo {i + 1}</Text>
          <Text style={styles.furoValor}>{formatarKg(furo.kg)} kg</Text>
        </View>
      ))}
      <View style={[styles.furoRow, styles.furoTotalRow]}>
        <Text style={styles.furoTotal}>{resumoDosFuros(furos)}</Text>
      </View>
    </View>
  );

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

      {hasAdditionalInfo(infoAtual)
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

      {projeto.furos?.length ? renderizarFuros(projeto.furos) : null}

      <TouchableOpacity
        style={[styles.pdfButton, gerandoPdf && styles.pdfButtonDesabilitado]}
        onPress={gerarPDF}
        disabled={gerandoPdf}
        activeOpacity={0.8}
      >
        {gerandoPdf
          ? <ActivityIndicator size="small" color="#FFF" />
          : <Ionicons name="document-text-outline" size={20} color="#FFF" />}
        <Text style={styles.pdfButtonText}>{gerandoPdf ? 'Preparando PDF...' : 'Gerar PDF'}</Text>
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
    gap: 8, marginTop: 24, marginBottom: 24,
  },
  pdfButtonDesabilitado: { backgroundColor: '#8BC3B3' },
  fotosWrapper: { marginTop: 16 },
  pdfButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
