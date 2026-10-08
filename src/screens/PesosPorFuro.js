import { useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProjetoForm } from '../context/form';
import { criarFuro, furoPreenchido, furosTemDados, somarFuros } from '../helpers/furos';
import { limparKgDigitado } from '../helpers/numeros';

const confirmarApagar = (titulo, aoConfirmar) =>
  Alert.alert(titulo, 'O peso digitado será perdido.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Apagar', style: 'destructive', onPress: aoConfirmar },
  ]);

export default function PesosPorFuro() {
  const { furos, setFuros } = useProjetoForm();
  const inputs = useRef(new Map());
  const idParaFocar = useRef(null);
  const ligado = furos.length > 0;

  useEffect(() => {
    if (!idParaFocar.current) return;
    inputs.current.get(idParaFocar.current)?.focus();
    idParaFocar.current = null;
  }, [furos]);

  const adicionarFuro = ({ focar = false } = {}) => {
    const novo = criarFuro();
    if (focar) idParaFocar.current = novo.id;
    setFuros(atuais => [...atuais, novo]);
  };

  const registrarInput = (id) => (input) => {
    if (input) inputs.current.set(id, input);
    else inputs.current.delete(id);
  };

  // Enter no último furo preenchido cria o próximo; no último vazio, fecha o teclado
  const avancarDoFuro = (indice) => {
    const furo = furos[indice];
    const proximo = furos[indice + 1];
    if (proximo) return inputs.current.get(proximo.id)?.focus();
    if (furoPreenchido(furo)) return adicionarFuro({ focar: true });
    inputs.current.get(furo.id)?.blur();
  };

  const alternar = (ligar) => {
    if (ligar) return adicionarFuro();
    if (!furosTemDados(furos)) return setFuros([]);
    confirmarApagar('Desligar pesagem por furo?', () => setFuros([]));
  };

  const alterarKg = (id, texto) =>
    setFuros(atuais => atuais.map(furo => (furo.id === id ? { ...furo, kg: limparKgDigitado(texto) } : furo)));

  const removerFuro = (furo, numero) => {
    const remover = () => setFuros(atuais => atuais.filter(f => f.id !== furo.id));
    if (!furoPreenchido(furo)) return remover();
    confirmarApagar(`Apagar o Furo ${numero}?`, remover);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.cabecalho} onPress={() => alternar(!ligado)} activeOpacity={0.8}>
        <Text style={styles.titulo}>Pesar por furo</Text>
        <Switch
          value={ligado}
          onValueChange={alternar}
          trackColor={{ false: '#ccc', true: '#8BC3B3' }}
          thumbColor={ligado ? '#1F6452' : '#f4f4f4'}
        />
      </TouchableOpacity>

      {ligado && (
        <>
          {furos.map((furo, indice) => (
            <View key={furo.id} style={styles.linha}>
              <Text style={styles.rotulo}>Furo {indice + 1}</Text>
              <View style={styles.campo}>
                <TextInput
                  ref={registrarInput(furo.id)}
                  style={styles.input}
                  placeholder="Peso"
                  placeholderTextColor="#888888"
                  keyboardType="numeric"
                  value={furo.kg}
                  onChangeText={texto => alterarKg(furo.id, texto)}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => avancarDoFuro(indice)}
                />
                <Text style={styles.unidade}>kg</Text>
              </View>
              <TouchableOpacity
                style={styles.apagarBtn}
                onPress={() => removerFuro(furo, indice + 1)}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={26} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.adicionarBtn} onPress={() => adicionarFuro()}>
            <Ionicons name="add-circle" size={24} color="#1F6452" />
            <Text style={styles.adicionarBtnTexto}>Adicionar Furo</Text>
          </TouchableOpacity>

          <Text style={styles.total}>
            Total: {somarFuros(furos).toLocaleString('pt-BR')} kg em {furos.length} furo{furos.length !== 1 ? 's' : ''}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e2e2' },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 18, fontWeight: 'bold', color: '#000000' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  rotulo: { width: 70, fontSize: 16, fontWeight: 'bold', color: '#333' },
  campo: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderColor: '#CCC', borderWidth: 1, borderRadius: 5,
  },
  input: { flex: 1, padding: 10, fontSize: 18, color: '#000000' },
  unidade: { paddingRight: 10, fontSize: 16, color: '#888' },
  apagarBtn: { padding: 4 },
  adicionarBtn: {
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#1F6452',
    padding: 10, borderRadius: 5, marginTop: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  adicionarBtnTexto: { color: '#1F6452', fontSize: 18, marginLeft: 5 },
  total: { marginTop: 12, fontSize: 16, fontWeight: 'bold', color: '#1F6452', textAlign: 'center' },
});
