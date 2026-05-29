import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AbaUsuarios({ users, companies, onAddPress, onDeletePress }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isDropOpen, setIsDropOpen] = useState(false);
  const [busca, setBusca] = useState('');

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const filteredUsers = users.filter(u => {
    const matchesCompany = selectedCompanyId ? u.companyId === selectedCompanyId : true;
    const matchesSearch = u.nome?.toLowerCase().includes(busca.toLowerCase()) || 
                          u.email?.toLowerCase().includes(busca.toLowerCase());
    return matchesCompany && matchesSearch;
  });

  const sortedUsers = filteredUsers
    .slice()
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

  const handleSelectCompany = (id) => {
    setSelectedCompanyId(id);
    setIsDropOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.secaoHeader}>
        <Text style={styles.secaoTitulo}>Filtro de Usuários</Text>
        <TouchableOpacity 
          style={styles.addBtn} 
          onPress={() => onAddPress(selectedCompanyId)} 
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={16} color="#fff" />
          <Text style={styles.addBtnTexto}>Novo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dropdownWrapper}>
        <TouchableOpacity 
          style={styles.dropdownHeader} 
          onPress={() => setIsDropOpen(!isDropOpen)}
          activeOpacity={0.9}
        >
          <Text style={styles.dropdownHeaderText}>
            {selectedCompany ? selectedCompany.name : 'Exibindo: Todos os Usuários'}
          </Text>
          <Ionicons name={isDropOpen ? "chevron-up" : "chevron-down"} size={20} color="#555" />
        </TouchableOpacity>

        {isDropOpen && (
          <View style={styles.dropdownMenu}>
            <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
              <TouchableOpacity
                style={[styles.dropdownItem, selectedCompanyId === null && styles.dropdownItemAtivo]}
                onPress={() => handleSelectCompany(null)}
              >
                <Text style={[styles.dropdownItemTexto, selectedCompanyId === null && styles.dropdownItemTextoAtivo]}>
                  Todos os Usuários ({users.length})
                </Text>
                {selectedCompanyId === null && <Ionicons name="checkmark" size={18} color="#E75F07" />}
              </TouchableOpacity>
              
              {companies.map(c => {
                const count = users.filter(u => u.companyId === c.id).length;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.dropdownItem, selectedCompanyId === c.id && styles.dropdownItemAtivo]}
                    onPress={() => handleSelectCompany(c.id)}
                  >
                    <Text style={[styles.dropdownItemTexto, selectedCompanyId === c.id && styles.dropdownItemTextoAtivo]}>
                      {c.name} ({count})
                    </Text>
                    {selectedCompanyId === c.id && <Ionicons name="checkmark" size={18} color="#E75F07" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou email..."
          value={busca}
          onChangeText={setBusca}
          placeholderTextColor="#999"
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Ionicons name="close-circle" size={18} color="#bbb" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.resumo}>{sortedUsers.length} usuário(s) localizado(s)</Text>

      {sortedUsers.map(u => (
        <View key={u.id} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardNome}>{u.nome || '—'}</Text>
            <Text style={styles.cardSub}>{u.email}</Text>
            <Text style={styles.cardMeta}>
              Regra: <Text style={{ fontWeight: '600' }}>{u.role || 'user'}</Text> · {companies.find(c => c.id === u.companyId)?.name || 'Organização não identificada'}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDeletePress(u)} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color="#f44336" />
          </TouchableOpacity>
        </View>
      ))}

      {sortedUsers.length === 0 && (
        <Text style={styles.vazio}>Nenhum usuário correspondente aos filtros foi localizado.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  secaoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: '#333' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E75F07', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, gap: 6 },
  addBtnTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  dropdownWrapper: { zIndex: 10, position: 'relative', marginBottom: 16 },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },
  dropdownHeaderText: { fontSize: 14, color: '#333', fontWeight: '500' },
  dropdownMenu: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, zIndex: 100, elevation: 4, marginTop: 4 },
  dropdownScroll: { maxHeight: 200 },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  dropdownItemAtivo: { backgroundColor: '#FFF5EE' },
  dropdownItemTexto: { fontSize: 14, color: '#555' },
  dropdownItemTextoAtivo: { color: '#E75F07', fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, height: 46, backgroundColor: '#fff', marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  resumo: { fontSize: 13, color: '#777', marginBottom: 12, fontWeight: '500' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  cardNome: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 2 },
  cardSub: { fontSize: 13, color: '#666', marginBottom: 6 },
  cardMeta: { fontSize: 12, color: '#999' },
  deleteBtn: { padding: 8, marginLeft: 8 },
  vazio: { textAlign: 'center', color: '#999', fontSize: 14, marginTop: 24 }
});
