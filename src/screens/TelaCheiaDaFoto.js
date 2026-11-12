import { Modal, View, Image, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useKeyboardHeight from '../hooks/useKeyboardHeight';
import { LIMITE_LEGENDA } from '../midias';

const RESPIRO = 16;

function Botao({ rotulo, icone, cor, aoTocar, ocupado = false }) {
  return (
    <TouchableOpacity
      style={[styles.botao, { backgroundColor: ocupado ? '#555' : cor }]}
      onPress={aoTocar}
      disabled={ocupado}
      activeOpacity={0.8}
    >
      {ocupado ? <ActivityIndicator color="#FFF" /> : <Ionicons name={icone} size={22} color="#FFF" />}
      <Text style={styles.botaoTexto}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

export default function TelaCheiaDaFoto({
  uri, titulo, legenda, aoAlterarLegenda, acaoSecundaria, acaoPrincipal, aoVoltar,
}) {
  const alturaDoTeclado = useKeyboardHeight();
  const margensDoSistema = useSafeAreaInsets();
  // Com edge-to-edge o modal ocupa a tela toda, por baixo da barra de status e dos botões de navegação
  const recuo = {
    paddingTop: margensDoSistema.top + RESPIRO,
    paddingBottom: margensDoSistema.bottom + RESPIRO + alturaDoTeclado,
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={aoVoltar}>
      <View style={[styles.tela, recuo]}>
        {titulo ? <Text style={styles.titulo}>{titulo}</Text> : null}
        <Image source={{ uri }} style={styles.imagem} resizeMode="contain" />
        <TextInput
          style={styles.legenda}
          placeholder="Adicionar legenda..."
          placeholderTextColor="#999"
          value={legenda}
          onChangeText={aoAlterarLegenda}
          maxLength={LIMITE_LEGENDA}
          multiline
        />
        <View style={styles.acoes}>
          <Botao {...acaoSecundaria} />
          <Botao {...acaoPrincipal} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#000', justifyContent: 'center', paddingHorizontal: RESPIRO },
  titulo: { color: '#FFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  imagem: { flex: 1, width: '100%' },
  legenda: {
    marginTop: 16, backgroundColor: '#222', borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 17, color: '#FFF', maxHeight: 120,
  },
  acoes: { flexDirection: 'row', gap: 10, marginTop: 12 },
  botao: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: 8,
  },
  botaoTexto: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
