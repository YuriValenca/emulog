import { memo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet, Dimensions, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProjetoForm } from '../context/form';
import useKeyboardHeight from '../hooks/useKeyboardHeight';
import {
  criarFuro, furoTemDados, somarCargasReais, aplicarProfundidadePrevista,
} from '../helpers/furos';
import { limparKgDigitado as limparNumeroDigitado, formatarKg, kgPreenchido as valorPreenchido } from '../helpers/numeros';
import { pendenciasDosFuros } from '../helpers/pendencias';

const ATRASO_PARA_FOCAR_MS = 150;

// Furo só com a profundidade herdada da prevista não tem nada que o operador perderia ao apagar
const furoDigitado = (furo, profundidadePrevista) =>
  furoTemDados(furo) && (!!furo.cargaReal || furo.profundidadeReal !== profundidadePrevista);

// Altura fixa: se o aviso aparecesse e sumisse a cada furo digitado, o fim da lista mudaria de tamanho
// e a rolagem pularia junto com o teclado
function StatusDosFuros({ pendencias }) {
  const pendente = pendencias.length > 0;
  return (
    <View style={[styles.status, pendente ? styles.statusPendente : styles.statusOk]}>
      <Ionicons
        name={pendente ? 'alert-circle-outline' : 'checkmark-circle-outline'}
        size={22}
        color={pendente ? '#FF9621' : '#1F6452'}
      />
      <Text style={styles.statusTexto} numberOfLines={2}>
        {pendente ? pendencias.join(' ') : 'Tudo preenchido.'}
      </Text>
    </View>
  );
}

const LinhaFuro = memo(function LinhaFuro({
  furo, indice, aoAlterar, aoAvancar, aoFocarCarga, aoRemover, registrarInput,
}) {
  return (
    <View style={styles.linha}>
      <Text style={styles.rotuloFuro}>Furo {indice + 1}</Text>
      <View style={styles.campo}>
        <TextInput
          ref={input => registrarInput(furo.id, 'profundidade', input)}
          style={styles.input}
          placeholder="Prof."
          placeholderTextColor="#888888"
          keyboardType="numeric"
          value={furo.profundidadeReal}
          onChangeText={texto => aoAlterar(furo.id, 'profundidadeReal', texto)}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => aoAvancar(indice, 'profundidade')}
        />
        <Text style={styles.unidade}>m</Text>
      </View>
      <View style={styles.campo}>
        <TextInput
          ref={input => registrarInput(furo.id, 'carga', input)}
          style={styles.input}
          placeholder="Carga"
          placeholderTextColor="#888888"
          keyboardType="numeric"
          value={furo.cargaReal}
          onChangeText={texto => aoAlterar(furo.id, 'cargaReal', texto)}
          onFocus={() => aoFocarCarga(furo.id)}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={evento => aoAvancar(indice, 'carga', evento.nativeEvent.text)}
        />
        <Text style={styles.unidade}>kg</Text>
      </View>
      <TouchableOpacity style={styles.apagarBtn} onPress={() => aoRemover(furo, indice + 1)} hitSlop={8}>
        <Ionicons name="trash-outline" size={24} color="#D32F2F" />
      </TouchableOpacity>
    </View>
  );
});

function CampoPrevisto({ rotulo, unidade, valor, aoAlterar }) {
  return (
    <View style={styles.previsto}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <View style={styles.campo}>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#888888"
          keyboardType="numeric"
          value={valor}
          onChangeText={texto => aoAlterar(limparNumeroDigitado(texto))}
        />
        <Text style={styles.unidade}>{unidade}</Text>
      </View>
    </View>
  );
}

export default function EtapaFuros({ cabecalho, estiloConteudo, onVoltar, onContinuar }) {
  const { furos, setFuros } = useProjetoForm();
  const alturaDoTeclado = useKeyboardHeight();
  const alturaDoTecladoRef = useRef(0);
  const deslocamentoDaLista = useRef(0);
  const listaRef = useRef(null);
  const inputs = useRef(new Map());
  const furosRef = useRef(furos);
  const idParaFocar = useRef(null);
  const ultimoEnter = useRef(null);
  furosRef.current = furos;
  alturaDoTecladoRef.current = alturaDoTeclado;

  const itens = furos?.itens || [];
  const pendencias = pendenciasDosFuros(furos);
  const quantidadeTexto = `${itens.length} furo${itens.length !== 1 ? 's' : ''}`;

  const registrarInput = useCallback((id, campo, input) => {
    const chave = `${id}:${campo}`;
    if (input) inputs.current.set(chave, input);
    else inputs.current.delete(chave);
  }, []);

  // O manifest usa adjustPan: se o campo focado estiver atrás do teclado, o Android empurra a janela inteira e
  // ela sobe e desce a cada furo. Rolando a lista antes de focar, o campo já está visível e não há o que empurrar.
  // Sem respiro de propósito: ao digitar, o Android sempre recoloca o campo colado no teclado, e qualquer folga
  // aqui viraria um pulo na primeira tecla
  const focarAcimaDoTeclado = useCallback((input) => {
    const teclado = alturaDoTecladoRef.current;
    if (!teclado) return input.focus();
    input.measureInWindow((x, y, largura, altura) => {
      const limiteVisivel = Keyboard.metrics()?.screenY ?? Dimensions.get('window').height - teclado;
      const excesso = y + altura - limiteVisivel;
      if (excesso > 0) {
        listaRef.current?.scrollToOffset({ offset: deslocamentoDaLista.current + excesso, animated: false });
      }
      requestAnimationFrame(() => input.focus());
    });
  }, []);

  // Fora da janela renderizada da lista o input ainda não existe: rola até o furo e foca depois
  const focar = useCallback((id, indice, campo) => {
    const input = inputs.current.get(`${id}:${campo}`);
    if (input) return focarAcimaDoTeclado(input);
    listaRef.current?.scrollToIndex({ index: indice, viewPosition: 0.5 });
    setTimeout(() => inputs.current.get(`${id}:${campo}`)?.focus(), ATRASO_PARA_FOCAR_MS);
  }, []);

  useEffect(() => {
    if (!idParaFocar.current) return;
    const id = idParaFocar.current;
    idParaFocar.current = null;
    focar(id, itens.findIndex(furo => furo.id === id), 'carga');
  }, [itens.length]);

  const adicionarFuro = useCallback(({ focar: focarNovo = false } = {}) => {
    const novo = criarFuro(furosRef.current.profundidadePrevista);
    if (focarNovo) idParaFocar.current = novo.id;
    setFuros(atuais => ({ ...atuais, itens: [...atuais.itens, novo] }));
    return novo;
  }, []);

  // Depois do Enter o foco leva alguns quadros pra chegar no próximo furo; digitando rápido, as teclas ainda caem
  // no furo do Enter. O texto confirmado no Enter é o valor dele, então o que vier além disso é do próximo
  const aoAlterar = useCallback((id, campo, texto) => {
    const limpo = limparNumeroDigitado(texto);
    const enter = ultimoEnter.current;
    const excedente = enter?.id === id && campo === 'cargaReal' && limpo.startsWith(enter.texto)
      ? limpo.slice(enter.texto.length)
      : '';
    setFuros(atuais => ({
      ...atuais,
      itens: atuais.itens.map(furo => {
        if (excedente && furo.id === id) return { ...furo, cargaReal: enter.texto };
        if (excedente && furo.id === enter.proximoId) return { ...furo, cargaReal: furo.cargaReal + excedente };
        return furo.id === id ? { ...furo, [campo]: limpo } : furo;
      }),
    }));
  }, []);

  // O excedente entrou por código, com o cursor no começo; a próxima tecla iria pra frente dele
  const aoFocarCarga = useCallback((id) => {
    if (ultimoEnter.current?.proximoId !== id) return;
    ultimoEnter.current = null;
    const tamanho = furosRef.current.itens.find(furo => furo.id === id)?.cargaReal.length;
    if (tamanho) inputs.current.get(`${id}:carga`)?.setSelection(tamanho, tamanho);
  }, []);

  // O texto vem do próprio evento: com o app lento, o Enter chega antes do estado ter a última tecla digitada
  const aoAvancar = useCallback((indice, campo, textoDigitado) => {
    const lista = furosRef.current.itens;
    const furo = lista[indice];
    if (campo === 'profundidade') return focar(furo.id, indice, 'carga');

    const proximo = lista[indice + 1];
    if (proximo) {
      ultimoEnter.current = { id: furo.id, texto: limparNumeroDigitado(textoDigitado), proximoId: proximo.id };
      return focar(proximo.id, indice + 1, 'carga');
    }
    if (valorPreenchido(textoDigitado ?? furo.cargaReal)) {
      const novo = adicionarFuro({ focar: true });
      ultimoEnter.current = { id: furo.id, texto: limparNumeroDigitado(textoDigitado), proximoId: novo.id };
      return;
    }
    inputs.current.get(`${furo.id}:carga`)?.blur();
  }, []);

  const aoRemover = useCallback((furo, numero) => {
    const remover = () => setFuros(atuais => ({ ...atuais, itens: atuais.itens.filter(f => f.id !== furo.id) }));
    if (!furoDigitado(furo, furosRef.current.profundidadePrevista)) return remover();
    Alert.alert(`Apagar o Furo ${numero}?`, 'Os dados digitados serão perdidos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: remover },
    ]);
  }, []);

  const alterarProfundidadePrevista = (texto) => setFuros(atuais => aplicarProfundidadePrevista(atuais, texto));
  const alterarCargaPrevista = (texto) => setFuros(atuais => ({ ...atuais, cargaPrevista: texto }));

  const rolarQuandoFalharIndice = ({ index, averageItemLength }) => {
    listaRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true });
  };

  const topo = (
    <>
      {cabecalho}
      <View style={styles.resumo}>
        <Text style={styles.resumoNumero} numberOfLines={1}>{quantidadeTexto}</Text>
        <Text style={styles.resumoTexto} numberOfLines={1} adjustsFontSizeToFit>Total aplicado: {formatarKg(somarCargasReais(itens))} kg</Text>
      </View>
      <View style={styles.previstos}>
        <CampoPrevisto
          rotulo="Profundidade prevista"
          unidade="m"
          valor={furos?.profundidadePrevista ?? ''}
          aoAlterar={alterarProfundidadePrevista}
        />
        <CampoPrevisto
          rotulo="Carga prevista"
          unidade="kg"
          valor={furos?.cargaPrevista ?? ''}
          aoAlterar={alterarCargaPrevista}
        />
      </View>
      <Text style={styles.subtitulo}>Furos</Text>
    </>
  );

  const rodape = (
    <>
      <TouchableOpacity style={styles.adicionarBtn} onPress={() => adicionarFuro()}>
        <Ionicons name="add-circle" size={24} color="#1F6452" />
        <Text style={styles.adicionarBtnTexto}>Adicionar Furo</Text>
      </TouchableOpacity>

      <View style={styles.nota}>
        <Ionicons name="information-circle-outline" size={20} color="#1F6452" />
        <Text style={styles.notaTexto}>
          Você pode ir na próxima etapa anotar alguma observação do furo e retornar aqui para continuar a operação!
        </Text>
      </View>

      <StatusDosFuros pendencias={pendencias} />

      <View style={styles.botoes}>
        <TouchableOpacity style={[styles.botao, styles.voltarBtn]} onPress={onVoltar} activeOpacity={0.8}>
          <Ionicons name="arrow-back-circle" size={24} color="#FFF" />
          <Text style={styles.botaoTexto}>Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botao, styles.continuarBtn, pendencias.length > 0 && styles.botaoPendente]}
          onPress={onContinuar}
          activeOpacity={0.8}
        >
          <Text style={styles.botaoTexto}>Continuar</Text>
          <Ionicons name="arrow-forward-circle" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <FlatList
      ref={listaRef}
      data={itens}
      keyExtractor={furo => furo.id}
      renderItem={({ item, index }) => (
        <LinhaFuro
          furo={item}
          indice={index}
          aoAlterar={aoAlterar}
          aoAvancar={aoAvancar}
          aoFocarCarga={aoFocarCarga}
          aoRemover={aoRemover}
          registrarInput={registrarInput}
        />
      )}
      ListHeaderComponent={topo}
      ListFooterComponent={rodape}
      contentContainerStyle={[estiloConteudo, alturaDoTeclado > 0 && { paddingBottom: alturaDoTeclado }]}
      onScroll={evento => { deslocamentoDaLista.current = evento.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      // Recortar linhas fora da tela tira o foco do input e fecha o teclado no meio da digitação
      removeClippedSubviews={false}
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      onScrollToIndexFailed={rolarQuandoFalharIndice}
    />
  );
}

const styles = StyleSheet.create({
  resumo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#E3F0EC', borderRadius: 10, padding: 14, marginBottom: 16,
  },
  resumoNumero: { fontSize: 18, fontWeight: 'bold', color: '#1F6452' },
  resumoTexto: { fontSize: 16, fontWeight: '600', color: '#1F6452' },
  previstos: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  previsto: { flex: 1 },
  rotulo: { color: '#000000', fontWeight: 'bold', marginBottom: 5 },
  subtitulo: { fontSize: 18, fontWeight: 'bold', color: '#000000', marginTop: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  rotuloFuro: { width: 62, fontSize: 15, fontWeight: 'bold', color: '#333' },
  campo: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderColor: '#CCC', borderWidth: 1, borderRadius: 5,
  },
  input: { flex: 1, padding: 10, fontSize: 18, color: '#000000' },
  unidade: { paddingRight: 8, fontSize: 15, color: '#888' },
  apagarBtn: { padding: 2 },
  adicionarBtn: {
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#1F6452',
    padding: 10, borderRadius: 5, marginTop: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  adicionarBtnTexto: { color: '#1F6452', fontSize: 18, marginLeft: 5 },
  nota: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12, marginTop: 16,
  },
  notaTexto: { flex: 1, fontSize: 15, color: '#555' },
  status: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 64, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, marginTop: 24,
  },
  statusPendente: { backgroundColor: '#fff8e1', borderColor: '#FF9621' },
  statusOk: { backgroundColor: '#E3F0EC', borderColor: '#1F6452' },
  statusTexto: { flex: 1, fontSize: 15, color: '#333' },
  botoes: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 12 },
  botao: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, padding: 14, borderRadius: 8,
  },
  voltarBtn: { backgroundColor: '#787878' },
  continuarBtn: { backgroundColor: '#1F6452' },
  botaoPendente: { backgroundColor: '#ccc' },
  botaoTexto: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
