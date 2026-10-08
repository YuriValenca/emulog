import { View, Text, TouchableOpacity, Switch, Alert, StyleSheet } from 'react-native';
import { useProjetoForm } from '../context/form';
import { criarFurosVazios, furosTemDados } from '../helpers/furos';

export default function AlternarFuros() {
  const { furos, setFuros, setKgAplicado } = useProjetoForm();
  const ligado = !!furos;

  // O kg aplicado era a soma dos furos; sem eles, não sobra de onde ele veio
  const desligar = () => {
    setFuros(null);
    setKgAplicado('');
  };

  const alternar = (ligar) => {
    if (ligar) return setFuros(criarFurosVazios());
    if (!furosTemDados(furos)) return desligar();
    Alert.alert('Desligar registro de furos?', 'Os dados dos furos serão perdidos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desligar', style: 'destructive', onPress: desligar },
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.cabecalho} onPress={() => alternar(!ligado)} activeOpacity={0.8}>
        <View style={styles.textos}>
          <Text style={styles.titulo}>Registrar furos</Text>
          <Text style={styles.descricao}>Adiciona a etapa de furos depois das pesagens.</Text>
        </View>
        <Switch
          value={ligado}
          onValueChange={alternar}
          trackColor={{ false: '#ccc', true: '#8BC3B3' }}
          thumbColor={ligado ? '#1F6452' : '#f4f4f4'}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e2e2' },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  textos: { flex: 1 },
  titulo: { fontSize: 18, fontWeight: 'bold', color: '#000000' },
  descricao: { fontSize: 14, color: '#888', marginTop: 2 },
});
