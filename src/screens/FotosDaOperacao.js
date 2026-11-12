import { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppAuth } from '../context/auth';
import { LIMITE_MIDIAS_POR_PROJETO, adicionarMidia, alterarLegenda, excluirMidia, listarMidias } from '../midias';
import TelaCheiaDaFoto from './TelaCheiaDaFoto';

const avisarErro = (mensagem) => Alert.alert('Erro', mensagem);

async function tirarFoto() {
  const permissao = await ImagePicker.requestCameraPermissionsAsync();
  if (!permissao.granted) {
    Alert.alert('Câmera bloqueada', 'Permita o uso da câmera nas configurações do celular para tirar fotos.');
    return [];
  }
  const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  return resultado.canceled ? [] : resultado.assets;
}

async function escolherDaGaleria(quantidadeMaxima) {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: quantidadeMaxima,
  });
  return resultado.canceled ? [] : resultado.assets.slice(0, quantidadeMaxima);
}

export default function FotosDaOperacao({ projetoId, companyIdDoProjeto, aoAlterar }) {
  const { companyId, uid } = useAppAuth();
  const sessao = { companyId, uid };
  const projeto = { projetoId, companyIdDoProjeto: companyIdDoProjeto || companyId };

  const [midias, setMidias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [remotasCarregadas, setRemotasCarregadas] = useState(true);
  const [adicionando, setAdicionando] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [legendaDaPrevia, setLegendaDaPrevia] = useState('');
  const [midiaAberta, setMidiaAberta] = useState(null);
  const [legendaEditada, setLegendaEditada] = useState('');

  const vagas = LIMITE_MIDIAS_POR_PROJETO - midias.length;
  const botoesDesabilitados = carregando || adicionando || vagas <= 0;
  const fotoDaPrevia = previa?.fotos[previa.indice];
  const legendaMudou = !!midiaAberta && legendaEditada.trim() !== (midiaAberta.legenda ?? '');

  useEffect(() => {
    if (!carregando) aoAlterar?.(midias);
  }, [midias, carregando]);

  useEffect(() => {
    if (!projetoId) return;
    let ativo = true;
    setCarregando(true);
    listarMidias(projeto, sessao)
      .then(resultado => {
        if (!ativo) return;
        setRemotasCarregadas(resultado.remotasCarregadas);
        setMidias(resultado.midias);
      })
      .catch(error => console.error('Erro ao carregar fotos:', error))
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [projetoId]);

  const escolherFotos = async (obterFotos) => {
    try {
      const fotos = await obterFotos();
      if (fotos.length === 0) return;
      setLegendaDaPrevia('');
      setPrevia({ fotos, indice: 0 });
    } catch (error) {
      console.error('Erro ao escolher foto:', error);
      avisarErro('Não foi possível abrir a foto. Tente novamente.');
    }
  };

  const avancarPrevia = () => {
    setLegendaDaPrevia('');
    setPrevia(atual => (atual.indice + 1 < atual.fotos.length ? { ...atual, indice: atual.indice + 1 } : null));
  };

  const salvarFotoDaPrevia = async () => {
    setAdicionando(true);
    try {
      const midia = await adicionarMidia(fotoDaPrevia, legendaDaPrevia, projeto, sessao);
      setMidias(atuais => [...atuais, midia]);
      avancarPrevia();
    } catch (error) {
      console.error('Erro ao adicionar foto:', error);
      avisarErro('Não foi possível adicionar a foto. Tente novamente.');
    } finally {
      setAdicionando(false);
    }
  };

  const abrirMidia = (midia) => {
    setLegendaEditada(midia.legenda ?? '');
    setMidiaAberta(midia);
  };

  const salvarLegenda = async () => {
    try {
      await alterarLegenda(midiaAberta, legendaEditada, projeto, sessao);
      const legenda = legendaEditada.trim();
      setMidias(atuais => atuais.map(midia => (midia.id === midiaAberta.id ? { ...midia, legenda } : midia)));
      return true;
    } catch (error) {
      console.error('Erro ao salvar legenda:', error);
      avisarErro('Não foi possível salvar a legenda. Tente novamente.');
      return false;
    }
  };

  // Voltar pelo Android também salva: legenda digitada não pode se perder
  const fecharMidia = async () => {
    if (legendaMudou && !(await salvarLegenda())) return;
    setMidiaAberta(null);
  };

  const confirmarExclusao = (midia) =>
    Alert.alert('Apagar esta foto?', 'Ela será removida do projeto.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await excluirMidia(midia, projeto, sessao);
            setMidias(atuais => atuais.filter(m => m.id !== midia.id));
            setMidiaAberta(null);
          } catch (error) {
            console.error('Erro ao apagar foto:', error);
            avisarErro('Não foi possível apagar a foto. Tente novamente.');
          }
        },
      },
    ]);

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Fotos ({midias.length}/{LIMITE_MIDIAS_POR_PROJETO})</Text>

      <View style={styles.botoes}>
        <TouchableOpacity
          style={[styles.botao, botoesDesabilitados && styles.botaoDesabilitado]}
          onPress={() => escolherFotos(tirarFoto)}
          disabled={botoesDesabilitados}
          activeOpacity={0.8}
        >
          <Ionicons name="camera" size={24} color="#FFF" />
          <Text style={styles.botaoTexto}>Tirar foto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botao, botoesDesabilitados && styles.botaoDesabilitado]}
          onPress={() => escolherFotos(() => escolherDaGaleria(vagas))}
          disabled={botoesDesabilitados}
          activeOpacity={0.8}
        >
          <Ionicons name="images" size={24} color="#FFF" />
          <Text style={styles.botaoTexto}>Galeria</Text>
        </TouchableOpacity>
      </View>

      {vagas <= 0 && <Text style={styles.aviso}>Limite de {LIMITE_MIDIAS_POR_PROJETO} fotos atingido.</Text>}
      {!remotasCarregadas && (
        <Text style={styles.aviso}>Sem internet: fotos já enviadas aparecem quando a conexão voltar.</Text>
      )}

      <View style={styles.grade}>
        {midias.map(midia => (
          <View key={midia.id} style={styles.celula}>
            <TouchableOpacity style={styles.miniatura} onPress={() => abrirMidia(midia)} activeOpacity={0.8}>
              <Image source={{ uri: midia.uri }} style={styles.imagem} />
              <TouchableOpacity style={styles.apagarBtn} onPress={() => confirmarExclusao(midia)} hitSlop={8}>
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </TouchableOpacity>
            {midia.legenda ? <Text style={styles.legenda} numberOfLines={2}>{midia.legenda}</Text> : null}
          </View>
        ))}
        {carregando && (
          <View style={styles.celula}>
            <View style={[styles.miniatura, styles.carregando]}>
              <ActivityIndicator color="#1F6452" />
            </View>
          </View>
        )}
      </View>

      {fotoDaPrevia && (
        <TelaCheiaDaFoto
          uri={fotoDaPrevia.uri}
          titulo={previa.fotos.length > 1 ? `Foto ${previa.indice + 1} de ${previa.fotos.length}` : null}
          legenda={legendaDaPrevia}
          aoAlterarLegenda={setLegendaDaPrevia}
          acaoSecundaria={{ rotulo: 'Descartar', icone: 'trash-outline', cor: '#787878', aoTocar: avancarPrevia }}
          acaoPrincipal={{
            rotulo: 'Salvar', icone: 'checkmark', cor: '#1F6452', aoTocar: salvarFotoDaPrevia, ocupado: adicionando,
          }}
          aoVoltar={adicionando ? () => {} : avancarPrevia}
        />
      )}

      {midiaAberta && (
        <TelaCheiaDaFoto
          uri={midiaAberta.uri}
          legenda={legendaEditada}
          aoAlterarLegenda={setLegendaEditada}
          acaoSecundaria={{
            rotulo: 'Apagar', icone: 'trash-outline', cor: '#D32F2F', aoTocar: () => confirmarExclusao(midiaAberta),
          }}
          acaoPrincipal={legendaMudou
            ? { rotulo: 'Salvar', icone: 'checkmark', cor: '#1F6452', aoTocar: fecharMidia }
            : { rotulo: 'Fechar', icone: 'close', cor: '#1F6452', aoTocar: fecharMidia }}
          aoVoltar={fecharMidia}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 15 },
  titulo: { color: '#000000', fontWeight: 'bold', marginBottom: 8, fontSize: 15 },
  botoes: { flexDirection: 'row', gap: 10 },
  botao: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1F6452', padding: 14, borderRadius: 8,
  },
  botaoDesabilitado: { backgroundColor: '#ccc' },
  botaoTexto: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  aviso: { marginTop: 8, fontSize: 14, color: '#888' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  celula: { width: '31%' },
  miniatura: { width: '100%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#eee' },
  imagem: { width: '100%', height: '100%' },
  legenda: { marginTop: 4, fontSize: 13, color: '#555' },
  carregando: { alignItems: 'center', justifyContent: 'center' },
  apagarBtn: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
});
