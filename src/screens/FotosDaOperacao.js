import { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, Modal, Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppAuth } from '../context/auth';
import { LIMITE_MIDIAS_POR_PROJETO, adicionarMidia, excluirMidia, listarMidias } from '../midias';

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
  const [midiaAberta, setMidiaAberta] = useState(null);

  const vagas = LIMITE_MIDIAS_POR_PROJETO - midias.length;
  const botoesDesabilitados = carregando || adicionando || vagas <= 0;

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

  const adicionar = async (obterFotos) => {
    setAdicionando(true);
    try {
      const fotos = await obterFotos();
      for (const foto of fotos) {
        const midia = await adicionarMidia(foto, projeto, sessao);
        setMidias(atuais => [...atuais, midia]);
      }
    } catch (error) {
      console.error('Erro ao adicionar foto:', error);
      avisarErro('Não foi possível adicionar a foto. Tente novamente.');
    } finally {
      setAdicionando(false);
    }
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
          onPress={() => adicionar(tirarFoto)}
          disabled={botoesDesabilitados}
          activeOpacity={0.8}
        >
          <Ionicons name="camera" size={24} color="#FFF" />
          <Text style={styles.botaoTexto}>Tirar foto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botao, botoesDesabilitados && styles.botaoDesabilitado]}
          onPress={() => adicionar(() => escolherDaGaleria(vagas))}
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
          <TouchableOpacity key={midia.id} style={styles.miniatura} onPress={() => setMidiaAberta(midia)} activeOpacity={0.8}>
            <Image source={{ uri: midia.uri }} style={styles.imagem} />
            <TouchableOpacity style={styles.apagarBtn} onPress={() => confirmarExclusao(midia)} hitSlop={8}>
              <Ionicons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        {(carregando || adicionando) && (
          <View style={[styles.miniatura, styles.carregando]}>
            <ActivityIndicator color="#1F6452" />
          </View>
        )}
      </View>

      <Modal visible={!!midiaAberta} transparent animationType="fade" onRequestClose={() => setMidiaAberta(null)}>
        <View style={styles.telaCheia}>
          {midiaAberta && <Image source={{ uri: midiaAberta.uri }} style={styles.imagemTelaCheia} resizeMode="contain" />}
          <View style={styles.acoesTelaCheia}>
            <TouchableOpacity style={[styles.botao, styles.botaoApagar]} onPress={() => confirmarExclusao(midiaAberta)}>
              <Ionicons name="trash-outline" size={22} color="#FFF" />
              <Text style={styles.botaoTexto}>Apagar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botao} onPress={() => setMidiaAberta(null)}>
              <Ionicons name="close" size={22} color="#FFF" />
              <Text style={styles.botaoTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  botaoApagar: { backgroundColor: '#D32F2F' },
  botaoTexto: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  aviso: { marginTop: 8, fontSize: 14, color: '#888' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  miniatura: { width: '31%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#eee' },
  imagem: { width: '100%', height: '100%' },
  carregando: { alignItems: 'center', justifyContent: 'center' },
  apagarBtn: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  telaCheia: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 16 },
  imagemTelaCheia: { flex: 1, width: '100%' },
  acoesTelaCheia: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 32 },
});
