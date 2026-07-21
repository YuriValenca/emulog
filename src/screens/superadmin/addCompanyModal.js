import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  TextInput, Switch, ActivityIndicator, StyleSheet, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ColorPicker from 'react-native-wheel-color-picker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  getFirestore, collection, query, where,
  getDocs, addDoc, deleteDoc, doc,
} from 'firebase/firestore';

const db = getFirestore();

function SectionHeader({ title, count, expanded, onToggle }) {
  return (
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.8}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionHeaderRight}>
        {count > 0 && <Text style={styles.sectionCount}>{count}</Text>}
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
      </View>
    </TouchableOpacity>
  );
}

export default function ModalEmpresa({ visible, onClose, onSave, saving, companyToEdit }) {
  const isEditing = !!companyToEdit;

  const [form, setForm] = useState({
    name: '', cnpj: '', logo: '', primaryColor: '#9E9E9E', active: false,
  });

  const [caminhoes, setCaminhoes] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [novaCaminhaoPlaca, setNovaCaminhaoPlaca] = useState('');
  const [novoOperadorNome, setNovoOperadorNome] = useState('');
  const [novoOperadorCargo, setNovoOperadorCargo] = useState('');

  const [addingCaminhao, setAddingCaminhao] = useState(false);
  const [addingOperador, setAddingOperador] = useState(false);

  const [expandedCaminhoes, setExpandedCaminhoes] = useState(false);
  const [expandedOperadores, setExpandedOperadores] = useState(false);
  const [expandedUsuarios, setExpandedUsuarios] = useState(false);

  useEffect(() => {
    if (companyToEdit) {
      setForm({
        name: companyToEdit.name || '',
        cnpj: companyToEdit.cnpj || '',
        logo: companyToEdit.logo || '',
        primaryColor: companyToEdit.primaryColor || '#9E9E9E',
        active: !!companyToEdit.active,
      });
      carregarDados(companyToEdit.id);
    } else {
      setForm({ name: '', cnpj: '', logo: '', primaryColor: '#9E9E9E', active: false });
      setCaminhoes([]);
      setOperadores([]);
      setUsuarios([]);
    }
    setExpandedCaminhoes(false);
    setExpandedOperadores(false);
    setExpandedUsuarios(false);
    setNovaCaminhaoPlaca('');
    setNovoOperadorNome('');
    setNovoOperadorCargo('');
  }, [companyToEdit, visible]);

  const carregarDados = async (companyId) => {
    setLoadingRelated(true);
    try {
      const [snapC, snapO, snapU] = await Promise.all([
        getDocs(query(collection(db, 'caminhoes'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'operadores'), where('companyId', '==', companyId))),
        getDocs(query(collection(db, 'users'), where('companyId', '==', companyId))),
      ]);
      setCaminhoes(snapC.docs.map(d => ({ id: d.id, ...d.data() })));
      setOperadores(snapO.docs.map(d => ({ id: d.id, ...d.data() })));
      setUsuarios(snapU.docs.map(d => ({ id: d.id, ...d.data() })).filter((user) => user.role !== 'superadmin'));
    } catch (e) {
      console.error('Erro ao carregar dados da empresa:', e);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleCnpjChange = (text) => {
    const raw = text.replace(/\D/g, '');
    let masked = '';
    if (raw.length <= 2) masked = raw;
    else if (raw.length <= 5) masked = `${raw.slice(0, 2)}.${raw.slice(2)}`;
    else if (raw.length <= 8) masked = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
    else if (raw.length <= 12) masked = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
    else masked = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`;
    setForm(p => ({ ...p, cnpj: masked }));
  };

  const pickAndUploadLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [ImagePicker.MediaType.Images],
      quality: 1,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setUploadingLogo(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const base64 = `data:image/jpeg;base64,${manipulated.base64}`;
      setForm(p => ({ ...p, logo: base64 }));
    } catch (e) {
      console.error('Erro ao processar imagem:', e);
      Alert.alert('Erro', 'Não foi possível processar a imagem. Tente novamente.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const adicionarCaminhao = async () => {
    if (!novaCaminhaoPlaca.trim()) return;
    setAddingCaminhao(true);
    try {
      const novo = {
        placa: novaCaminhaoPlaca.trim().toUpperCase(),
        companyId: companyToEdit.id,
        criadoEm: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, 'caminhoes'), novo);
      setCaminhoes(prev => [...prev, { id: docRef.id, ...novo }]);
      setNovaCaminhaoPlaca('');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível adicionar o caminhão.');
    } finally {
      setAddingCaminhao(false);
    }
  };

  const removerCaminhao = async (id) => {
    try {
      await deleteDoc(doc(db, 'caminhoes', id));
      setCaminhoes(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível remover o caminhão.');
    }
  };

  const adicionarOperador = async () => {
    if (!novoOperadorNome.trim() || !novoOperadorCargo.trim()) return;
    setAddingOperador(true);
    try {
      const novo = {
        nome: novoOperadorNome.trim(),
        cargo: novoOperadorCargo.trim(),
        companyId: companyToEdit.id,
        criadoEm: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, 'operadores'), novo);
      setOperadores(prev => [...prev, { id: docRef.id, ...novo }]);
      setNovoOperadorNome('');
      setNovoOperadorCargo('');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível adicionar o operador.');
    } finally {
      setAddingOperador(false);
    }
  };

  const removerOperador = async (id) => {
    try {
      await deleteDoc(doc(db, 'operadores', id));
      setOperadores(prev => prev.filter(o => o.id !== id));
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível remover o operador.');
    }
  };

  const roleLabel = (role) => {
    if (role !== 'company_admin') return 'Usuário';
    return 'Company Admin';
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>{isEditing ? 'Editar Empresa' : 'Nova Empresa'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.formLabel}>Nome *</Text>
            <TextInput
              style={styles.formInput}
              value={form.name}
              onChangeText={v => setForm(p => ({ ...p, name: v }))}
              placeholder="Razão social"
              placeholderTextColor="#888888"
            />

            <Text style={styles.formLabel}>CNPJ</Text>
            <TextInput
              style={styles.formInput}
              value={form.cnpj}
              onChangeText={handleCnpjChange}
              placeholder="00.000.000/0000-00"
              placeholderTextColor="#888888"
              keyboardType="numeric"
              maxLength={18}
            />

            <Text style={styles.formLabel}>Logo da Empresa</Text>
            <TouchableOpacity
              style={styles.logoPickerBtn}
              onPress={pickAndUploadLogo}
              disabled={uploadingLogo}
              activeOpacity={0.8}
            >
              {uploadingLogo ? (
                <View style={styles.logoPickerContent}>
                  <ActivityIndicator size="small" color="#2E8C71" />
                  <Text style={styles.logoPickerText}>Enviando imagem...</Text>
                </View>
              ) : form.logo ? (
                <View style={styles.logoPickerContent}>
                  <Image source={{ uri: form.logo }} style={styles.logoPreview} resizeMode="contain" />
                  <View style={styles.logoPickerOverlay}>
                    <Ionicons name="camera-outline" size={18} color="#1F6452" />
                    <Text style={styles.logoPickerChangeText}>Trocar imagem</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.logoPickerContent}>
                  <View style={styles.logoPickerIconWrap}>
                    <Ionicons name="image-outline" size={28} color="#ccc" />
                  </View>
                  <Text style={styles.logoPickerText}>Toque para selecionar uma imagem</Text>
                  <Text style={styles.logoPickerHint}>JPG ou PNG</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.formLabel}>Cor Principal</Text>
            <View style={styles.pickerWrapper}>
              <ColorPicker
                color={form.primaryColor}
                onColorChangeComplete={v => setForm(p => ({ ...p, primaryColor: v }))}
                thumbSize={24}
                sliderSize={20}
                noSnap
                row
              />
            </View>
            <View style={styles.colorPreviewRow}>
              <View style={[styles.colorSwatch, { backgroundColor: form.primaryColor }]} />
              <Text style={styles.colorHex}>{form.primaryColor}</Text>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.formLabel}>Empresa Ativa</Text>
              <Switch
                value={form.active}
                onValueChange={v => setForm(p => ({ ...p, active: v }))}
                trackColor={{ false: '#e0e0e0', true: '#a5d6a7' }}
                thumbColor={form.active ? '#4CAF50' : '#bbb'}
              />
            </View>

            {isEditing && (
              <>
                <View style={styles.divider} />

                {loadingRelated ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#2E8C71" />
                    <Text style={styles.loadingText}>Carregando dados da empresa...</Text>
                  </View>
                ) : (
                  <>
                    <SectionHeader
                      title="Caminhões"
                      count={caminhoes.length}
                      expanded={expandedCaminhoes}
                      onToggle={() => setExpandedCaminhoes(p => !p)}
                    />
                    {expandedCaminhoes && (
                      <View style={styles.sectionBody}>
                        {caminhoes.length === 0 && (
                          <Text style={styles.emptyText}>Nenhum caminhão cadastrado.</Text>
                        )}
                        {caminhoes.map(c => (
                          <View key={c.id} style={styles.itemRow}>
                            <Text style={styles.itemLabel}>{c.placa}</Text>
                            <TouchableOpacity
                              onPress={() => removerCaminhao(c.id)}
                              style={styles.deleteBtn}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="trash-outline" size={16} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ))}
                        <View style={styles.addRow}>
                          <TextInput
                            style={[styles.formInput, styles.addInput]}
                            value={novaCaminhaoPlaca}
                            onChangeText={setNovaCaminhaoPlaca}
                            placeholder="Placa (ex: ABC-1234)"
                            placeholderTextColor="#888888"
                            autoCapitalize="characters"
                          />
                          <TouchableOpacity
                            style={[styles.addRowBtn, (addingCaminhao || !novaCaminhaoPlaca.trim()) && styles.addRowBtnDisabled]}
                            onPress={adicionarCaminhao}
                            disabled={addingCaminhao || !novaCaminhaoPlaca.trim()}
                            activeOpacity={0.8}
                          >
                            {addingCaminhao
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Ionicons name="add" size={20} color="#fff" />}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <SectionHeader
                      title="Operadores"
                      count={operadores.length}
                      expanded={expandedOperadores}
                      onToggle={() => setExpandedOperadores(p => !p)}
                    />
                    {expandedOperadores && (
                      <View style={styles.sectionBody}>
                        {operadores.length === 0 && (
                          <Text style={styles.emptyText}>Nenhum operador cadastrado.</Text>
                        )}
                        {operadores.map(o => (
                          <View key={o.id} style={styles.itemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemLabel}>{o.nome}</Text>
                              {o.cargo ? <Text style={styles.itemSub}>{o.cargo}</Text> : null}
                            </View>
                            <TouchableOpacity
                              onPress={() => removerOperador(o.id)}
                              style={styles.deleteBtn}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="trash-outline" size={16} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ))}
                        <View style={styles.addRow}>
                          <View style={{ flex: 1, gap: 8 }}>
                            <TextInput
                              style={[styles.formInput, { marginBottom: 0 }]}
                              value={novoOperadorNome}
                              onChangeText={setNovoOperadorNome}
                              placeholder="Nome completo"
                              placeholderTextColor="#888888"
                            />
                            <TextInput
                              style={[styles.formInput, { marginBottom: 0 }]}
                              value={novoOperadorCargo}
                              onChangeText={setNovoOperadorCargo}
                              placeholder="Cargo"
                              placeholderTextColor="#888888"
                            />
                          </View>
                          <TouchableOpacity
                            style={[styles.addRowBtn, (addingOperador || !novoOperadorNome.trim() || !novoOperadorCargo.trim()) && styles.addRowBtnDisabled]}
                            onPress={adicionarOperador}
                            disabled={addingOperador || !novoOperadorNome.trim() || !novoOperadorCargo.trim()}
                            activeOpacity={0.8}
                          >
                            {addingOperador
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Ionicons name="add" size={20} color="#fff" />}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <SectionHeader
                      title="Usuários"
                      count={usuarios.length}
                      expanded={expandedUsuarios}
                      onToggle={() => setExpandedUsuarios(p => !p)}
                    />
                    {expandedUsuarios && (
                      <View style={styles.sectionBody}>
                        {usuarios.length === 0 && (
                          <Text style={styles.emptyText}>Nenhum usuário nesta empresa.</Text>
                        )}
                        {usuarios.map(u => (
                          <View key={u.id} style={styles.itemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemLabel}>{u.nome || u.email}</Text>
                              <Text style={styles.itemSub}>{u.email}</Text>
                            </View>
                            <View style={styles.roleBadge}>
                              <Text style={styles.roleBadgeText}>{roleLabel(u.role)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.modalBtn, (saving || uploadingLogo) && styles.modalBtnDisabled]}
            onPress={() => onSave(form)}
            disabled={saving || uploadingLogo}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="checkmark" size={20} color="#fff" />}
            <Text style={styles.modalBtnTexto}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Empresa'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitulo: { fontSize: 17, fontWeight: '700', color: '#222' },
  scroll: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 16, backgroundColor: '#fafafa', color: '#000000', },

  logoPickerBtn: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 10,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#fafafa',
  },
  logoPickerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  logoPickerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoPickerText: { fontSize: 14, color: '#555', fontWeight: '500' },
  logoPickerHint: { fontSize: 12, color: '#aaa' },
  logoPreview: { width: '100%', height: 80 },
  logoPickerOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    width: '100%',
    justifyContent: 'center',
  },
  logoPickerChangeText: { fontSize: 13, color: '#2E8C71', fontWeight: '600' },

  pickerWrapper: { height: 200, marginBottom: 12, paddingHorizontal: 8 },
  colorPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  colorSwatch: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: '#e0e0e0' },
  colorHex: { fontSize: 13, color: '#555', fontWeight: '600', fontFamily: 'monospace' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1F6452', borderRadius: 10, padding: 14, marginTop: 8 },
  modalBtnDisabled: { backgroundColor: '#8FB8AC' },
  modalBtnTexto: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, color: '#aaa' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionCount: { fontSize: 12, fontWeight: '700', color: '#fff', backgroundColor: '#2E8C71', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sectionBody: { paddingTop: 12, paddingBottom: 4, gap: 8 },
  emptyText: { fontSize: 13, color: '#aaa', fontStyle: 'italic', paddingBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafafa', borderRadius: 8, borderWidth: 1, borderColor: '#efefef', padding: 10, gap: 10 },
  itemLabel: { fontSize: 14, fontWeight: '600', color: '#222' },
  itemSub: { fontSize: 12, color: '#888', marginTop: 1 },
  deleteBtn: { backgroundColor: '#D32F2F', borderRadius: 6, padding: 7, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  addInput: { flex: 1, marginBottom: 0 },
  addRowBtn: { backgroundColor: '#2E8C71', borderRadius: 8, padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  addRowBtnDisabled: { backgroundColor: '#aaa' },
  roleBadge: { backgroundColor: '#f0f0f0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: '#555' },
});
