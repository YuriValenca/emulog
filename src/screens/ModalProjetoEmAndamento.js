import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { contarPesagensDoProjeto } from '../context/form';

const textoPesagens = (quantidade) => (quantidade === 1 ? '1 pesagem' : `${quantidade} pesagens`);
const textoAmostras = (quantidade) => (quantidade === 1 ? '1 amostra' : `${quantidade} amostras`);

function BotaoModal({ icone, texto, cor, onPress }) {
  return (
    <TouchableOpacity style={[styles.botao, { backgroundColor: cor }]} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icone} size={26} color="#FFF" />
      <Text style={styles.botaoTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

export default function ModalProjetoEmAndamento({ visivel, projeto, onContinuar, onIniciarNovo, onFechar }) {
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const nome = projeto?.nomeProjeto?.trim() || 'Sem nome';
  const amostras = projeto?.amostras?.length || 0;
  const pesagens = contarPesagensDoProjeto(projeto);

  const fechar = () => {
    setConfirmandoExclusao(false);
    onFechar();
  };

  const executarESair = (acao) => () => {
    setConfirmandoExclusao(false);
    acao();
  };

  return (
    <Modal animationType="fade" transparent visible={visivel} onRequestClose={fechar} statusBarTranslucent>
      <View style={styles.fundo}>
        <View style={styles.card}>
          {confirmandoExclusao ? (
            <>
              <Ionicons name="warning-outline" size={44} color="#D32F2F" />
              <Text style={styles.titulo}>Apagar o projeto atual?</Text>
              <Text style={styles.texto}>
                "{nome}" tem {textoAmostras(amostras)} e {textoPesagens(pesagens)}. Esses dados serão perdidos.
              </Text>
              <BotaoModal icone="trash" texto="Apagar e iniciar novo" cor="#D32F2F" onPress={executarESair(onIniciarNovo)} />
              <BotaoModal icone="close" texto="Cancelar" cor="#787878" onPress={fechar} />
            </>
          ) : (
            <>
              <Text style={styles.titulo}>Projeto em andamento</Text>
              <Text style={styles.nome}>"{nome}"</Text>
              <Text style={styles.detalhe}>{textoAmostras(amostras)} - {textoPesagens(pesagens)}</Text>
              <BotaoModal icone="play-circle" texto="Continuar" cor="#1F6452" onPress={executarESair(onContinuar)} />
              <BotaoModal icone="refresh-circle" texto="Iniciar novo" cor="#787878" onPress={() => setConfirmandoExclusao(true)} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  card: {
    width: '100%', backgroundColor: '#FFF', borderRadius: 20,
    padding: 28, alignItems: 'center', elevation: 5,
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#000', textAlign: 'center', marginTop: 8 },
  texto: { fontSize: 18, color: '#333', textAlign: 'center', marginTop: 10, marginBottom: 12 },
  nome: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', marginTop: 12 },
  detalhe: { fontSize: 18, color: '#555', textAlign: 'center', marginTop: 4, marginBottom: 12 },
  botao: {
    width: '100%', minHeight: 60, borderRadius: 8, marginTop: 12,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  botaoTexto: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
});
