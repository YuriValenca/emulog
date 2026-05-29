import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { auth, secondaryAuth } from '../../firebaseConfig';
import BackButton from '../BackButton';
import ModalEmpresa from './addCompanyModal';
import ModalGerarLicencas from './addLicenseModal';
import ModalAdicionarUsuario from './addUserModal';
import AbaDashboard from './dashboard';
import AbaEmpresas from './companies';
import AbaLicencas from './licenses';
import AbaUsuarios from './users';

const db = getFirestore();
const ABAS = ['Dashboard', 'Empresas', 'Licenças', 'Usuários'];

function formatDate(value) {
  if (!value) return '—';
  let date;
  if (value?.toDate) date = value.toDate();
  else if (value?.seconds) date = new Date(value.seconds * 1000);
  else date = new Date(value);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function generateXplogKey() {
  const code = 'XXXXX-XXXXX-XXXXX-XXXXX'.replace(/X/g, () => 
    Math.random().toString(36).substring(2, 3).toUpperCase()
  );
  return `XPLOG-${code}`;
}

export default function SuperadminPanel() {
  const navigation = useNavigation();
  const [abaAtiva, setAbaAtiva] = useState(0);

  const [companies, setCompanies] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [licenseCompanyFilter, setLicenseCompanyFilter] = useState(null);

  const [modalEmpresaVisivel, setModalEmpresaVisivel] = useState(false);
  const [modalLicencaVisivel, setModalLicencaVisivel] = useState(false);
  const [modalUsuarioVisivel, setModalUsuarioVisivel] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [saving, setSaving] = useState(false);

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    try {
      const [snapC, snapU] = await Promise.all([
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'users')),
      ]);

      const companiesData = snapC.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompanies(companiesData);
      setUsers(snapU.docs.map(d => ({ id: d.id, ...d.data() })));

      const allLicenses = [];
      await Promise.all(
        companiesData.map(async (c) => {
          const snapL = await getDocs(collection(db, 'companies', c.id, 'licenses'));
          snapL.docs.forEach(d => allLicenses.push({ id: d.id, companyId: c.id, companyName: c.name, ...d.data() }));
        })
      );
      setLicenses(allLicenses);

      if (!licenseCompanyFilter && companiesData.length > 0) {
        const initialCompany = companiesData.find(c => c.name !== 'Explog');
        if (initialCompany) setLicenseCompanyFilter(initialCompany.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [licenseCompanyFilter]);

  useEffect(() => { carregarTudo(); }, []);

  const handleSalvarEmpresa = async (formData) => {
    if (!formData.name.trim()) {
      Alert.alert('Atenção', 'Nome da empresa é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      if (selectedCompany) {
        await updateDoc(doc(db, 'companies', selectedCompany.id), {
          name: formData.name.trim(),
          cnpj: formData.cnpj.trim(),
          logo: formData.logo,
          primaryColor: formData.primaryColor,
          active: formData.active,
        });
      } else {
        await addDoc(collection(db, 'companies'), {
          name: formData.name.trim(),
          cnpj: formData.cnpj.trim(),
          logo: formData.logo,
          primaryColor: formData.primaryColor,
          active: formData.active,
          founding: false,
          licenseLimitOverride: null,
          licenseExpiryOverride: null,
          createdAt: Timestamp.now(),
        });
      }
      setModalEmpresaVisivel(false);
      setSelectedCompany(null);
      await carregarTudo();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar a empresa.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEmpresaAtiva = async (company) => {
    try {
      await updateDoc(doc(db, 'companies', company.id), { active: !company.active });
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, active: !c.active } : c));
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível atualizar o status.');
    }
  };
  
  const handleProcessarGeracaoLote = async (quantidade, mesesValidade) => {
    if (!licenseCompanyFilter) return;
    setSaving(true);

    try {
      const targetSubcollection = collection(db, 'companies', licenseCompanyFilter, 'licenses');
      
      const expDate = new Date();
      expDate.setMonth(expDate.getMonth() + mesesValidade);
      const expiresAtTimestamp = Timestamp.fromDate(expDate);
      const novasLicencasLocais = [];

      const promessas = Array.from({ length: quantidade }).map(async () => {
        const novaChave = generateXplogKey();
        const dadosLicenca = {
          key: novaChave,
          status: 'available',
          createdAt: Timestamp.now(),
          expiresAt: expiresAtTimestamp,
          deviceId: null,
        };

        const docRef = await addDoc(targetSubcollection, dadosLicenca);
        novasLicencasLocais.push({
          id: docRef.id,
          companyId: licenseCompanyFilter,
          companyName: empresaFiltradaNome,
          ...dadosLicenca
        });
      });

      await Promise.all(promessas);
      setLicenses(prev => [...prev, ...novasLicencasLocais]);

      Alert.alert('Sucesso', `${quantidade} licença(s) gerada(s) com validade de ${mesesValidade} meses.`);
      setModalLicencaVisivel(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Houve uma falha ao gerar o lote de licenças.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeLicense = async (license) => {
    Alert.alert('Revogar Licença', `Tem certeza que deseja revogar a licença ${license.key}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revogar',
        style: 'destructive',
        onPress: async () => {
          try {
            const licenseRef = doc(db, 'companies', license.companyId, 'licenses', license.id);
            await updateDoc(licenseRef, { status: 'revoked' });

            setLicenses(prev => prev.map(l => 
              l.id === license.id ? { ...l, status: 'revoked' } : l
            ));
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível revogar a licença.');
          }
        }
      }
    ]);
  };

  const handleRemoveLicense = async (license) => {
    Alert.alert('Excluir Licença', `Deseja remover permanentemente o registro da licença ${license.key}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            const licenseRef = doc(db, 'companies', license.companyId, 'licenses', license.id);
            await deleteDoc(licenseRef);

            setLicenses(prev => prev.filter(l => l.id !== license.id));
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível remover a licença.');
          }
        }
      }
    ]);
  };

  const handleAdicionarUsuario = async (userData) => {
    setSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.senha);

      const novosDadosFirestore = {
        uid: cred.user.uid,
        email: userData.email,
        nome: userData.nome,
        companyId: userData.companyId,
        role: 'user',
        ultimoLogin: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'users'), novosDadosFirestore);
      await secondaryAuth.signOut();

      setUsers(prev => [...prev, { id: docRef.id, ...novosDadosFirestore }]);
      Alert.alert('Sucesso', 'Usuário criado e configurado com êxito.');
      setModalUsuarioVisivel(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Houve um problema ao processar o cadastro.');
    } finally {
      setSaving(false);
    }
  };

  const handleExcluirUsuario = async (user) => {
    Alert.alert('Remover Usuário', `Deseja permanentemente excluir o acesso de ${user.nome}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', user.id));
            setUsers(prev => prev.filter(u => u.id !== user.id));
            Alert.alert('Sucesso', 'Usuário removido da base.');
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível deletar o usuário.');
          }
        }
      }
    ]);
  };

  const empresaFiltradaNome = useMemo(() => {
    const comp = companies.find(c => c.id === licenseCompanyFilter);
    return comp ? comp.name : '';
  }, [companies, licenseCompanyFilter]);

  const dashStats = useMemo(() => {
    console.log(licenses)
    return {
      totalCompanies: companies.length,
      activeCompanies: companies.filter(c => c.active || c.founding).length,
      totalUsers: users.length,
      totalLicenses: licenses.length,
      activeLicenses: licenses.filter(l => l.status === 'active').length,
      availableLicenses: licenses.filter(l => l.status === 'available').length,
      expiringSoon: licenses.filter(l => {
        if (l.status !== 'active') return false;
        const exp = l.expiresAt?.toDate ? l.expiresAt.toDate() : new Date(l.expiresAt?.seconds * 1000);
        const diff = (exp - new Date()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 30;
      }).length,
    };
  }, [companies, users, licenses]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E75F07" />
        <Text style={styles.loadingText}>Carregando painel...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.titulo}>Painel Administrativo</Text>

        <View style={styles.abaContainer}>
          {ABAS.map((aba, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.abaBtn, abaAtiva === i && styles.abaBtnAtiva]}
              onPress={() => setAbaAtiva(i)}
              activeOpacity={0.8}
            >
              <Text style={[styles.abaBtnTexto, abaAtiva === i && styles.abaBtnTextoAtivo]}>
                {aba}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {abaAtiva === 0 && (
          <AbaDashboard stats={dashStats} companies={companies} licenses={licenses} />
        )}

        {abaAtiva === 1 && (
          <AbaEmpresas
            companies={companies}
            licenses={licenses}
            onAddPress={() => { setSelectedCompany(null); setModalEmpresaVisivel(true); }}
            onEditPress={(c) => { setSelectedCompany(c); setModalEmpresaVisivel(true); }}
            onToggleActive={toggleEmpresaAtiva}
            formatDate={formatDate}
          />
        )}

        {abaAtiva === 2 && (
          <AbaLicencas
            companies={companies}
            licenses={licenses}
            filteredFilterId={licenseCompanyFilter}
            onSetFilterId={setLicenseCompanyFilter}
            onGeneratePress={() => setModalLicencaVisivel(true)}
            onRevokePress={handleRevokeLicense}
            onRemovePress={handleRemoveLicense}
            formatDate={formatDate}
          />
        )}

        {abaAtiva === 3 && (
          <AbaUsuarios
            users={users}
            companies={companies}
            onAddPress={() => setModalUsuarioVisivel(true)}
            onDeletePress={handleExcluirUsuario}
          />
        )}
      </ScrollView>

      <ModalEmpresa
        visible={modalEmpresaVisivel}
        companyToEdit={selectedCompany}
        onClose={() => { setModalEmpresaVisivel(false); setSelectedCompany(null); }}
        onSave={handleSalvarEmpresa}
        saving={saving}
      />

      <ModalGerarLicencas
        visible={modalLicencaVisivel}
        companyName={empresaFiltradaNome}
        onClose={() => setModalLicencaVisivel(false)}
        onSave={handleProcessarGeracaoLote}
        saving={saving}
      />

      <ModalAdicionarUsuario
        visible={modalUsuarioVisivel}
        companies={companies}
        onClose={() => setModalUsuarioVisivel(false)}
        onSave={handleAdicionarUsuario}
        saving={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  container: { padding: 20, paddingTop: 72, paddingBottom: 40 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },
  loadingText: { color: '#aaa', fontSize: 14 },
  titulo: { fontSize: 22, fontWeight: '800', color: '#E75F07', marginBottom: 16 },
  abaContainer: { flexDirection: 'row', backgroundColor: '#eee', borderRadius: 10, padding: 4, marginBottom: 20 },
  abaBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  abaBtnAtiva: { backgroundColor: '#fff', elevation: 2 },
  abaBtnTexto: { fontSize: 11, fontWeight: '600', color: '#888' },
  abaBtnTextoAtivo: { color: '#E75F07' },
});
