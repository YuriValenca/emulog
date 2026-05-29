import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AbaEmpresas({ companies, licenses, onAddPress, onEditPress, onToggleActive, formatDate }) {
  return (
    <View>
      <View style={styles.secaoHeader}>
        <Text style={styles.secaoTitulo}>Empresas</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onAddPress} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnTexto}>Nova</Text>
        </TouchableOpacity>
      </View>

      {companies.map(c => (
        <TouchableOpacity key={c.id} style={styles.card} onPress={() => onEditPress(c)} activeOpacity={0.9}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardNome}>{c.name}</Text>
            <Text style={styles.cardSub}>{c.cnpj || '—'}</Text>
            {c.founding && <Text style={styles.foundingTag}>✦ Founding — sem limite de licenças</Text>}
            <Text style={styles.cardMeta}>
              {licenses.filter(l => l.companyId === c.id).length} licença(s) · criada em {formatDate(c.createdAt)}
            </Text>
          </View>
          {!c.founding && (
            <Switch
              value={!!c.active}
              onValueChange={() => onToggleActive(c)}
              trackColor={{ false: '#e0e0e0', true: '#a5d6a7' }}
              thumbColor={c.active ? '#4CAF50' : '#bbb'}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 12, marginTop: 4 },
  secaoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E75F07', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#efefef', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardNome: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#777' },
  cardMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  foundingTag: { fontSize: 11, color: '#E75F07', fontWeight: '700', marginTop: 2 },
});
