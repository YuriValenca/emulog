import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AbaUsuarios({ users, companies, onAddPress, onSaveEdit, onDeletePress }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isDropOpen, setIsDropOpen] = useState(false);
  const [busca, setBusca] = useState('');
  
  const [editingUserId, setEditingUserId] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('user');

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const filteredUsers = users.filter(u => {
    const matchesCompany = selectedCompanyId ? u.companyId === selectedCompanyId : true;
    const matchesSearch = u.nome?.toLowerCase().includes(busca.toLowerCase()) || 
                          u.email?.toLowerCase().includes(busca.toLowerCase());
    return matchesCompany && matchesSearch;
  });

  const sortedUsers = filteredUsers
    .filter((user) => user.role !== "superadmin")
    .slice()
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

  const handleSelectCompany = (id) => {
    setSelectedCompanyId(id);
    setIsDropOpen(false);
  };

  const startEditing = (user) => {
    setEditingUserId(user.id);
    setEditNome(user.nome || '');
    setEditEmail(user.email || '');
    setEditRole(user.role || 'user');
  };

  const cancelEditing = () => {
    setEditingUserId(null);
  };

  const handleSave = (userId) => {
    if (onSaveEdit) {
      onSaveEdit({
        id: userId,
        nome: editNome,
        email: editEmail,
        role: editRole,
      });
    }
    setEditingUserId(null);
  };

  const roleLabel = (role) => {
    if (role === 'company_admin') return 'Company Admin';
    if (role === 'superadmin') return 'Superadmin';
    return 'User';
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
          placeholderTextColor="#888888"
          value={busca}
          onChangeText={setBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Ionicons name="close-circle" size={18} color="#bbb" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.resumo}>{sortedUsers.length} usuário(s) localizado(s)</Text>

      {sortedUsers.map(u => {
        const isEditing = editingUserId === u.id;

        return (
          <View key={u.id} style={styles.card}>
            {isEditing ? (
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.editInput}
                  value={editNome}
                  onChangeText={setEditNome}
                  placeholder="Nome"
                  placeholderTextColor="#888888"
                />
                <TextInput
                  style={styles.editInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Email"
                  placeholderTextColor="#888888"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                
                <View style={styles.roleContainer}>
                  <Text style={styles.roleLabel}>Regra:</Text>
                  <TouchableOpacity 
                    style={[styles.roleOption, editRole === 'user' && styles.roleOptionActive]} 
                    onPress={() => setEditRole('user')}
                  >
                    <Text style={[styles.roleOptionText, editRole === 'user' && styles.roleOptionTextActive]}>User</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.roleOption, editRole === 'company_admin' && styles.roleOptionActive]} 
                    onPress={() => setEditRole('company_admin')}
                  >
                    <Text style={[styles.roleOptionText, editRole === 'company_admin' && styles.roleOptionTextActive]}>Company Admin</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={cancelEditing}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave(u.id)}>
                    <Text style={styles.saveBtnText}>Salvar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardNome}>{u.nome || '—'}</Text>
                  <Text style={styles.cardSub}>{u.email}</Text>
                  <Text style={styles.cardMeta}>
                    Regra: <Text style={{ fontWeight: '600' }}>{roleLabel(u.role)}</Text> · {companies.find(c => c.id === u.companyId)?.name || 'Organização não identificada'}
                  </Text>
                </View>
                
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => startEditing(u)} activeOpacity={0.8}>
                    <Ionicons name="create-outline" size={18} color="#E75F07" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => onDeletePress(u)} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={18} color="#f44336" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        );
      })}

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
  searchInput: { flex: 1, fontSize: 14, color: '#000000', },
  resumo: { fontSize: 13, color: '#777', marginBottom: 12, fontWeight: '500' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  cardNome: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 2 },
  cardSub: { fontSize: 13, color: '#666', marginBottom: 6 },
  cardMeta: { fontSize: 12, color: '#999' },
  actionButtonsContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
  vazio: { textAlign: 'center', color: '#999', fontSize: 14, marginTop: 24 },
  editInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: '#000000', marginBottom: 8, backgroundColor: '#fafafa' },
  roleContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 12 },
  roleLabel: { fontSize: 13, color: '#666', marginRight: 10 },
  roleOption: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', marginRight: 8 },
  roleOptionActive: { backgroundColor: '#E75F07', borderColor: '#E75F07' },
  roleOptionText: { fontSize: 12, color: '#555' },
  roleOptionTextActive: { color: '#fff', fontWeight: '600' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  cancelBtnText: { color: '#666', fontSize: 13, fontWeight: '500' },
  saveBtn: { backgroundColor: '#E75F07', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' }
});
