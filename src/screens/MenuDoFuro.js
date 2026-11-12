import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useKeyboardHeight from '../hooks/useKeyboardHeight';

const LIMITE_OBSERVACAO = 200;

function Opcao({ icone, rotulo, cor = '#222', aoTocar }) {
  return (
    <TouchableOpacity style={styles.opcao} onPress={aoTocar} activeOpacity={0.7}>
      <Ionicons name={icone} size={26} color={cor} />
      <Text style={[styles.opcaoTexto, { color: cor }]}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

export default function MenuDoFuro({ furo, numero, editandoDeInicio, aoSalvarObservacao, aoExcluir, aoFechar }) {
  const alturaDoTeclado = useKeyboardHeight();
  const [editando, setEditando] = useState(!!editandoDeInicio);
  const [texto, setTexto] = useState(furo.observacao ?? '');

  const temObservacao = !!furo.observacao?.trim();

  const salvar = () => {
    aoSalvarObservacao(furo.id, texto.trim());
    aoFechar();
  };

  // Fechar pelo fundo ou pelo voltar do Android não pode perder o que foi digitado
  const fechar = () => (editando && texto.trim() !== (furo.observacao ?? '').trim() ? salvar() : aoFechar());

  return (
    <Modal visible transparent animationType="fade" onRequestClose={fechar}>
      <View style={[styles.fundo, { paddingBottom: alturaDoTeclado }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={fechar} />
        <View style={styles.cartao}>
          {editando ? (
            <>
              <Text style={styles.titulo}>Observação do Furo {numero}</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite a observação"
                placeholderTextColor="#888888"
                value={texto}
                onChangeText={setTexto}
                maxLength={LIMITE_OBSERVACAO}
                multiline
                autoFocus
              />
              <View style={styles.botoes}>
                <TouchableOpacity style={[styles.botao, styles.botaoCancelar]} onPress={aoFechar} activeOpacity={0.8}>
                  <Text style={styles.botaoTexto}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.botao, styles.botaoSalvar]} onPress={salvar} activeOpacity={0.8}>
                  <Text style={styles.botaoTexto}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.titulo}>Furo {numero}</Text>
              <Opcao
                icone="chatbox-ellipses-outline"
                rotulo={temObservacao ? 'Editar observação' : 'Adicionar observação'}
                cor="#1F6452"
                aoTocar={() => setEditando(true)}
              />
              <Opcao icone="trash-outline" rotulo={`Excluir furo ${numero}`} cor="#D32F2F" aoTocar={() => aoExcluir(furo.id)} />
              <Opcao icone="close" rotulo="Cancelar" cor="#787878" aoTocar={aoFechar} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  cartao: {
    width: '90%', backgroundColor: '#FFF', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  titulo: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 12 },
  opcao: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  opcaoTexto: { fontSize: 18, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: '#CCC', borderRadius: 5, padding: 10,
    fontSize: 18, color: '#000000', minHeight: 100, textAlignVertical: 'top',
  },
  botoes: { flexDirection: 'row', gap: 12, marginTop: 16 },
  botao: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  botaoCancelar: { backgroundColor: '#787878' },
  botaoSalvar: { backgroundColor: '#1F6452' },
  botaoTexto: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
