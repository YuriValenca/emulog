import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AvisoPendencias({ pendencias }) {
  if (!pendencias.length) return null;

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#FF9621" />
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Para continuar:</Text>
        {pendencias.map(pendencia => (
          <Text key={pendencia} style={styles.item}>• {pendencia}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#FF9621',
    borderRadius: 10, padding: 12, marginTop: 24,
  },
  conteudo: { flex: 1, gap: 4 },
  titulo: { fontSize: 16, fontWeight: 'bold', color: '#000000' },
  item: { fontSize: 16, color: '#333333' },
});
