import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function AbaEmpresas({
  companies,
  licenses,
  onAddPress,
  onEditPress,
  onToggleActive,
  onToggleBluetoothScale,
  onDeletePress,
  formatDate,
}) {
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
        <View key={c.id} style={styles.card}>
          <TouchableOpacity style={styles.cardTopRow} onPress={() => onEditPress(c)} activeOpacity={0.9}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardNome}>{c.name}</Text>
              <Text style={styles.cardSub}>{c.cnpj || '—'}</Text>
              {c.founding && <Text style={styles.foundingTag}>✦ Founding — sem limite de licenças</Text>}
              <Text style={styles.cardMeta}>
                {licenses.filter(l => l.companyId === c.id).length} licença(s) · criada em {formatDate(c.createdAt)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDeletePress(c)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color="#D32F2F" />
            </TouchableOpacity>
          </TouchableOpacity>

          <View style={styles.togglesRow}>
            {!c.founding && (
              <View style={styles.toggleItem}>
                <Text style={styles.toggleLabel}>Ativa</Text>
                <Switch
                  value={!!c.active}
                  onValueChange={() => onToggleActive(c)}
                  trackColor={{ false: '#e0e0e0', true: '#a5d6a7' }}
                  thumbColor={c.active ? '#4CAF50' : '#bbb'}
                />
              </View>
            )}

            <View style={styles.toggleItem}>
              <MaterialCommunityIcons name="bluetooth" size={14} color="#1A73E8" style={{ marginRight: 4 }} />
              <Text style={styles.toggleLabel}>Balança BT</Text>
              <Switch
                value={!!c.bluetoothScaleEnabled}
                onValueChange={() => onToggleBluetoothScale(c)}
                trackColor={{ false: '#e0e0e0', true: '#90CAF9' }}
                thumbColor={c.bluetoothScaleEnabled ? '#1A73E8' : '#bbb'}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 12, marginTop: 4 },
  secaoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1F6452', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#efefef', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardNome: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#777' },
  cardMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  foundingTag: { fontSize: 11, color: '#E75F07', fontWeight: '700', marginTop: 2 },
  deleteBtn: { padding: 6 },
  togglesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 20, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: 12, color: '#555', fontWeight: '600' },
});
