import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, TouchableOpacity,
  ScrollView, Modal,
} from 'react-native';
import {
  getAuth, createUserWithEmailAndPassword,
  onAuthStateChanged, deleteUser as deleteAuthUser,
} from 'firebase/auth';
import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, updateDoc, doc, getDoc,
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from './BackButton';
import ScrollToTopButton from './ScrollToTopButton';

const ABAS = ['Usuários', 'Caminhões', 'Operadores'];

export default function GerenciarUsuarios() {
  const [abaAtiva, setAbaAtiva] = useState(0);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [termoBuscaUsuario, setTermoBuscaUsuario] = useState('');
  const [currentUserUid, setCurrentUserUid] = useState(null);

  const [placaCaminhao, setPlacaCaminhao] = useState('');
  const [caminhoes, setCaminhoes] = useState([]);
  const [termoBuscaCaminhao, setTermoBuscaCaminhao] = useState('');

  const [nomeOperador, setNomeOperador] = useState('');
  const [cargoOperador, setCargoOperador] = useState('');
  const [operadores, setOperadores] = useState([]);
  const [termoBuscaOperador, setTermoBuscaOperador] = useState('');

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isConfirmationModalVisible, setIsConfirmationModalVisible] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState(null);

  const navigation = useNavigation();
  const auth = getAuth();
  const db = getFirestore();
  const scrollViewRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserUid(user.uid);
        await carregarUsuarios();
        await registrarUltimoLogin(user.uid);
      } else {
        setUsuarios([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (abaAtiva === 1) carregarCaminhoes();
    if (abaAtiva === 2) carregarOperadores();
  }, [abaAtiva]);

  const carregarUsuarios = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
    }
  };

  const carregarCaminhoes = async () => {
    try {
      const snap = await getDocs(collection(db, 'caminhoes'));
      setCaminhoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erro ao carregar caminhões:', e);
    }
  };

  const carregarOperadores = async () => {
    try {
      const snap = await getDocs(collection(db, 'operadores'));
      setOperadores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erro ao carregar operadores:', e);
    }
  };

  const registrarUltimoLogin = async (userId) => {
    try {
      const ref = doc(db, 'users', userId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { ultimoLogin: new Date().toISOString() });
      }
    } catch (e) {
      console.error('Erro ao registrar login:', e);
    }
  };

  const adicionarUsuario = async () => {
    try {
      const admin = auth.currentUser;
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      await addDoc(collection(db, 'users'), {
        uid: cred.user.uid,
        email,
        nome: nomeUsuario,
        ultimoLogin: new Date().toISOString(),
      });
      await auth.updateCurrentUser(admin);
      setEmail(''); setSenha(''); setNomeUsuario('');
      await carregarUsuarios();
      mostrarModal('Usuário adicionado com sucesso!');
    } catch (e) {
      console.error('Erro ao adicionar usuário:', e);
      Alert.alert('Erro', 'Não foi possível adicionar o usuário.');
    }
  };

  const adicionarCaminhao = async () => {
    if (!placaCaminhao.trim()) {
      Alert.alert('Atenção', 'Informe a placa do caminhão.');
      return;
    }
    try {
      await addDoc(collection(db, 'caminhoes'), {
        placa: placaCaminhao.trim().toUpperCase(),
        descricao: `Caminhão — ${placaCaminhao.trim().toUpperCase()}`,
        criadoEm: new Date().toISOString(),
      });
      setPlacaCaminhao('');
      await carregarCaminhoes();
      mostrarModal('Caminhão cadastrado com sucesso!');
    } catch (e) {
      console.error('Erro ao adicionar caminhão:', e);
      Alert.alert('Erro', 'Não foi possível cadastrar o caminhão.');
    }
  };

  const adicionarOperador = async () => {
    if (!nomeOperador.trim()) {
      Alert.alert('Atenção', 'Informe o nome do operador.');
      return;
    }
    try {
      await addDoc(collection(db, 'operadores'), {
        nome: nomeOperador.trim(),
        cargo: cargoOperador.trim(),
        criadoEm: new Date().toISOString(),
      });
      setNomeOperador(''); setCargoOperador('');
      await carregarOperadores();
      mostrarModal('Operador cadastrado com sucesso!');
    } catch (e) {
      console.error('Erro ao adicionar operador:', e);
      Alert.alert('Erro', 'Não foi possível cadastrar o operador.');
    }
  };

  const confirmarDelecao = (id, colecao) => {
    setPendingDeletion({ id, colecao });
    setIsConfirmationModalVisible(true);
  };

  const executarDelecao = async () => {
    if (!pendingDeletion) return;
    const { id, colecao } = pendingDeletion;
    try {
      if (colecao === 'users') {
        const snap = await getDoc(doc(db, 'users', id));
        if (snap.exists()) {
          await deleteDoc(doc(db, 'users', id));
        }
        await carregarUsuarios();
      } else if (colecao === 'caminhoes') {
        await deleteDoc(doc(db, 'caminhoes', id));
        await carregarCaminhoes();
      } else if (colecao === 'operadores') {
        await deleteDoc(doc(db, 'operadores', id));
        await carregarOperadores();
      }
      mostrarModal('Registro removido com sucesso!');
    } catch (e) {
      console.error('Erro ao deletar:', e);
      Alert.alert('Erro', 'Não foi possível remover o registro.');
    } finally {
      setIsConfirmationModalVisible(false);
      setPendingDeletion(null);
    }
  };

  const mostrarModal = (msg) => {
    setModalMessage(msg);
    setModalVisible(true);
  };

  const fecharModais = () => {
    setModalVisible(false);
    setIsConfirmationModalVisible(false);
    setPendingDeletion(null);
  };

  const handleScroll = (e) => setShowScrollButton(e.nativeEvent.contentOffset.y > 200);
  const scrollToTop = () => scrollViewRef.current?.scrollTo({ y: 0, animated: true });

  const usuariosFiltrados = usuarios
  .filter(u =>u.nome?.toLowerCase().includes(termoBuscaUsuario.toLowerCase()));

  const caminhoesFiltrados = caminhoes
  .filter(c => c.placa?.toLowerCase().includes(termoBuscaCaminhao.toLowerCase()));

  const operadoresFiltrados = operadores
    .filter(o => o.nome?.toLowerCase().includes(termoBuscaOperador.toLowerCase()))
    .sort((a, b) => a.nome?.localeCompare(b.nome, 'pt-BR'));

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      ref={scrollViewRef}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      <BackButton onPress={() => navigation.goBack()} />
      <Text style={styles.titulo}>Gerenciar Cadastros</Text>

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
        <View>
          <Text style={styles.secaoTitulo}>Adicionar Usuário</Text>
          <View style={styles.formulario}>
            <Text style={styles.label}>Nome</Text>
            <TextInput value={nomeUsuario} onChangeText={setNomeUsuario} style={styles.input} placeholder="Nome completo" />
            <Text style={styles.label}>Email</Text>
            <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.label}>Senha</Text>
            <TextInput value={senha} onChangeText={setSenha} secureTextEntry style={styles.input} placeholder="Senha" />
            <TouchableOpacity style={styles.adicionarBtn} onPress={adicionarUsuario} activeOpacity={0.8}>
              <Ionicons name="person-add" size={20} color="white" />
              <Text style={styles.adicionarBtnTexto}>Adicionar Usuário</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Buscar por nome</Text>
          <TextInput
            value={termoBuscaUsuario}
            onChangeText={setTermoBuscaUsuario}
            style={styles.input}
            placeholder="Digite o nome"
          />

          <Text style={styles.listaTitulo}>Lista de Usuários ({usuariosFiltrados.length})</Text>
          {usuariosFiltrados.map((usuario) => (
            <View key={usuario.id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardNome}>{usuario.nome}</Text>
                <Text style={styles.cardSub}>{usuario.email}</Text>
                <Text style={styles.cardMeta}>
                  Último login: {usuario.ultimoLogin ? new Date(usuario.ultimoLogin).toLocaleString() : 'Não disponível'}
                </Text>
              </View>
              {usuario.uid !== currentUserUid && (
                <TouchableOpacity
                  onPress={() => confirmarDelecao(usuario.id, 'users')}
                  style={styles.botaoDeletar}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={18} color="white" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {abaAtiva === 1 && (
        <View>
          <Text style={styles.secaoTitulo}>Cadastrar Caminhão</Text>
          <View style={styles.formulario}>
            <Text style={styles.label}>Placa</Text>
            <TextInput
              value={placaCaminhao}
              onChangeText={setPlacaCaminhao}
              style={styles.input}
              placeholder="Ex: ABC-1234"
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.adicionarBtn} onPress={adicionarCaminhao} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={20} color="white" />
              <Text style={styles.adicionarBtnTexto}>Cadastrar Caminhão</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Buscar por placa</Text>
          <TextInput
            value={termoBuscaCaminhao}
            onChangeText={setTermoBuscaCaminhao}
            style={styles.input}
            placeholder="Digite a placa"
          />

          <Text style={styles.listaTitulo}>Caminhões cadastrados ({caminhoesFiltrados.length})</Text>
          {caminhoesFiltrados.length === 0 && (
            <Text style={styles.vazio}>Nenhum caminhão cadastrado.</Text>
          )}
          {caminhoesFiltrados.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardNome}>{c.placa}</Text>
                <Text style={styles.cardMeta}>
                  Cadastrado em: {c.criadoEm ? new Date(c.criadoEm).toLocaleDateString() : '—'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => confirmarDelecao(c.id, 'caminhoes')}
                style={styles.botaoDeletar}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {abaAtiva === 2 && (
        <View>
          <Text style={styles.secaoTitulo}>Cadastrar Operador</Text>
          <View style={styles.formulario}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              value={nomeOperador}
              onChangeText={setNomeOperador}
              style={styles.input}
              placeholder="Nome completo"
            />
            <Text style={styles.label}>Cargo</Text>
            <TextInput
              value={cargoOperador}
              onChangeText={setCargoOperador}
              style={styles.input}
              placeholder="Ex: Operador, Motorista"
            />
            <TouchableOpacity style={styles.adicionarBtn} onPress={adicionarOperador} activeOpacity={0.8}>
              <Ionicons name="person-add-outline" size={20} color="white" />
              <Text style={styles.adicionarBtnTexto}>Cadastrar Operador</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Buscar por nome</Text>
          <TextInput
            value={termoBuscaOperador}
            onChangeText={setTermoBuscaOperador}
            style={styles.input}
            placeholder="Digite o nome"
          />

          <Text style={styles.listaTitulo}>Operadores cadastrados ({operadoresFiltrados.length})</Text>
          {operadoresFiltrados.length === 0 && (
            <Text style={styles.vazio}>Nenhum operador cadastrado.</Text>
          )}
          {operadoresFiltrados.map((o) => (
            <View key={o.id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardNome}>{o.nome}</Text>
                {o.cargo ? <Text style={styles.cardSub}>{o.cargo}</Text> : null}
                <Text style={styles.cardMeta}>
                  Cadastrado em: {o.criadoEm ? new Date(o.criadoEm).toLocaleDateString() : '—'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => confirmarDelecao(o.id, 'operadores')}
                style={styles.botaoDeletar}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {showScrollButton && <ScrollToTopButton onPress={scrollToTop} />}

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={fecharModais}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Ionicons name="checkmark-circle" size={40} color="#4CAF50" style={{ marginBottom: 12 }} />
            <Text style={styles.modalText}>{modalMessage}</Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#FF9621' }]} onPress={fecharModais}>
              <Text style={styles.modalBtnTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={isConfirmationModalVisible} onRequestClose={fecharModais}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Ionicons name="warning-outline" size={40} color="#FF5C00" style={{ marginBottom: 12 }} />
            <Text style={styles.modalText}>Deseja remover este registro?</Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#808080' }]} onPress={fecharModais}>
              <Text style={styles.modalBtnTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#FF5C00' }]} onPress={executarDelecao}>
              <Text style={styles.modalBtnTexto}>Remover</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#FFF', paddingTop: 72 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#E75F07', marginTop: 4 },

  abaContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    padding: 4,
    marginBottom: 20,
  },
  abaBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  abaBtnAtiva: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  abaBtnTexto: { fontSize: 13, color: '#888', fontWeight: '600' },
  abaBtnTextoAtivo: { color: '#E75F07' },

  secaoTitulo: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 },
  formulario: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginBottom: 12,
    borderRadius: 8,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  adicionarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9621',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  adicionarBtnTexto: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  listaTitulo: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 10, marginTop: 4 },
  vazio: { color: '#aaa', fontStyle: 'italic', marginBottom: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  cardInfo: { flex: 1 },
  cardNome: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 2 },
  cardSub: { fontSize: 13, color: '#555', marginBottom: 2 },
  cardMeta: { fontSize: 11, color: '#999', fontStyle: 'italic' },

  botaoDeletar: {
    backgroundColor: '#FF5C00',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalView: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalText: { fontSize: 16, textAlign: 'center', marginBottom: 16, color: '#333' },
  modalBtn: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  modalBtnTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
