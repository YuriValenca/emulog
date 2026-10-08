import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { contarPesagensDoProjeto } from '../context/form';
import { textoAmostras, textoPesagens } from '../helpers/pesagem';
import { textoFuros } from '../helpers/furos';

const juntarComE = (partes) => `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;

function BotaoModal({ icone, texto, subtexto, cor, onPress, centralizado = false }) {
  return (
    <TouchableOpacity
      style={[styles.botao, centralizado && styles.botaoCentralizado, { backgroundColor: cor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icone} size={26} color="#FFF" />
      <View style={styles.botaoTextos}>
        <Text style={styles.botaoTexto}>{texto}</Text>
        {subtexto ? <Text style={styles.botaoSubtexto}>{subtexto}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function ModalProjetoEmAndamento({
  visivel, projeto, onContinuar, onSalvarRascunho, onApagarEIniciarNovo, onIniciarNovo, onFechar,
}) {
  const [etapa, setEtapa] = useState('escolha');

  const nome = projeto?.nomeProjeto?.trim() || 'Sem nome';
  const amostras = projeto?.amostras?.length || 0;
  const pesagens = contarPesagensDoProjeto(projeto);
  const furos = projeto?.furos?.itens?.length ?? null;
  const conteudoDoProjeto = [
    textoAmostras(amostras), textoPesagens(pesagens), furos !== null && textoFuros(furos),
  ].filter(Boolean);

  const fechar = () => {
    setEtapa('escolha');
    onFechar();
  };

  const executarESair = (acao) => () => {
    setEtapa('escolha');
    acao();
  };

  const salvarRascunho = async () => {
    const salvou = await onSalvarRascunho();
    if (salvou) setEtapa('salvo');
  };

  const conteudoPorEtapa = {
    escolha: (
      <>
        <Text style={styles.titulo}>Projeto em andamento</Text>
        <Text style={styles.nome}>"{nome}"</Text>
        <View style={styles.detalhes}>
          <Text style={styles.detalhe}>{textoAmostras(amostras)} - {textoPesagens(pesagens)}</Text>
          {furos !== null && <Text style={styles.detalhe}>{textoFuros(furos)}</Text>}
        </View>
        <BotaoModal icone="play-circle" texto="Continuar" cor="#1F6452" onPress={executarESair(onContinuar)} />
        <BotaoModal icone="refresh-circle" texto="Iniciar novo" cor="#787878" onPress={() => setEtapa('perguntarRascunho')} />
      </>
    ),
    perguntarRascunho: (
      <>
        <Ionicons name="document-text-outline" size={44} color="#1F6452" />
        <Text style={styles.titulo}>Salvar o projeto atual como rascunho?</Text>
        <BotaoModal
          icone="checkmark-circle" texto="Sim" subtexto="Os dados atuais ficarão disponíveis no Histórico"
          cor="#1F6452" onPress={salvarRascunho}
        />
        <BotaoModal
          icone="close-circle" texto="Não" subtexto="Apagar dados do projeto e começar do zero"
          cor="#D32F2F" onPress={() => setEtapa('confirmarApagar')}
        />
        <BotaoModal icone="arrow-back-circle" texto="Voltar" subtexto="Cancelar salvamento em rascunho" cor="#787878" onPress={() => setEtapa('escolha')} />
      </>
    ),
    confirmarApagar: (
      <>
        <Ionicons name="warning-outline" size={44} color="#D32F2F" />
        <Text style={styles.titulo}>Apagar o projeto atual?</Text>
        <Text style={styles.texto}>
          "{nome}" tem {juntarComE(conteudoDoProjeto)}. Esses dados serão perdidos.
        </Text>
        <BotaoModal
          icone="trash" texto="Apagar" cor="#D32F2F" centralizado
          onPress={executarESair(onApagarEIniciarNovo)}
        />
        <BotaoModal
          icone="arrow-back-circle" texto="Voltar" cor="#787878" centralizado
          onPress={() => setEtapa('perguntarRascunho')}
        />
      </>
    ),
    salvo: (
      <>
        <Ionicons name="checkmark-circle" size={44} color="#4CAF50" />
        <Text style={styles.titulo}>Salvo como rascunho</Text>
        <Text style={styles.texto}>Você encontra ele no Histórico.</Text>
        <BotaoModal icone="add-circle" texto="Iniciar novo projeto" cor="#1F6452" onPress={executarESair(onIniciarNovo)} />
      </>
    ),
  };

  return (
    <Modal animationType="fade" transparent visible={visivel} onRequestClose={fechar} statusBarTranslucent>
      <View style={styles.fundo}>
        <View style={styles.card}>{conteudoPorEtapa[etapa]}</View>
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
  detalhes: { marginTop: 4, marginBottom: 12, gap: 2 },
  detalhe: { fontSize: 18, color: '#555', textAlign: 'center' },
  botao: {
    width: '100%', minHeight: 60, borderRadius: 8, marginTop: 12, paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10,
  },
  botaoCentralizado: { justifyContent: 'center' },
  botaoTextos: { flexShrink: 1, alignItems: 'flex-start' },
  botaoTexto: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  botaoSubtexto: { color: '#FFF', fontSize: 16, opacity: 0.9 },
});
