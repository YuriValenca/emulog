import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BotaoModal({ icone, texto, subtexto, cor, onPress, centralizado = false }) {
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

const styles = StyleSheet.create({
  botao: {
    width: '100%', minHeight: 60, borderRadius: 8, marginTop: 12, paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10,
  },
  botaoCentralizado: { justifyContent: 'center' },
  botaoTextos: { flexShrink: 1, alignItems: 'flex-start' },
  botaoTexto: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  botaoSubtexto: { color: '#FFF', fontSize: 16, opacity: 0.9 },
});
