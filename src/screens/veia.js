import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal } from 'react-native';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Mantenha para ícones


export default function NovaAmostraScreen() {
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [quantidadeAmostras, setQuantidadeAmostras] = useState(1);
  const [amostras, setAmostras] = useState(Array.from({ length: 1 }, () => Array.from({ length: 4 }, () => ({ peso: '', densidade: '', timestamp: '' }))));
  const [amostraAtual, setAmostraAtual] = useState(0);
  const [pesagemAtual, setPesagemAtual] = useState(0);
  const [peso, setPeso] = useState('');
  const [modalVisivel, setModalVisivel] = useState(false);
  const [modalMensagem, setModalMensagem] = useState('');
  const [ultimaCalibragem, setUltimaCalibragem] = useState(null);
  const [temporizador, setTemporizador] = useState(false);
  const [cicloAtual, setCicloAtual] = useState(1);
  const [esperandoNovoCiclo, setEsperandoNovoCiclo] = useState(false);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [uidUsuario, setUidUsuario] = useState(null);
  const navigation = useNavigation();
  const [dispositivosBluetooth, setDispositivosBluetooth] = useState([]);


useEffect(() => {
  const auth = getAuth();
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      setUidUsuario(user.uid);
    } else {
      // Usuário não está logado ou a sessão expirou
      console.log("Nenhum usuário logado ou sessão expirou");
    }
  });

  return () => unsubscribe(); // Limpa o observador quando o componente é desmontado
}, []);



  useEffect(() => {
    const buscarUltimaCalibragem = async () => {
      const q = query(collection(db, "calibragens"), orderBy("timestamp", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const calibragemDoc = querySnapshot.docs[0].data();
        const calibragemData = calibragemDoc.timestamp.toDate();
        setUltimaCalibragem({
          tara: calibragemDoc.tara,
          pesoCheio: calibragemDoc.pesoCheio,
          densidade: calibragemDoc.densidade,
          timestamp: calibragemData,
          necessitaCalibragem: Math.abs(new Date() - calibragemData) / 36e5 > 14,
        });
      }
    };

    buscarUltimaCalibragem();
  }, []);

  useEffect(() => {
    if (temporizador) {
      const timer = setTimeout(() => {
        setTemporizador(false);
        Alert.alert("Continuar", "Você pode prosseguir com a próxima pesagem.", [{ text: "OK" }]);
      }, 20000); // 5 segundos de espera
      return () => clearTimeout(timer);
    }
  }, [temporizador]);

  const calcularDensidade = (peso) => {
    if (!ultimaCalibragem) {
      Alert.alert("Erro", "Calibragem não disponível.");
      return 0;
    }
    const volumeCopo = ultimaCalibragem.pesoCheio - ultimaCalibragem.tara;
    return ((peso - ultimaCalibragem.tara) / volumeCopo).toFixed(3);
  };

const confirmarPesagem = () => {
  const densidadeCalculada = calcularDensidade(parseFloat(peso));
  const timestamp = new Date().toLocaleTimeString();
  const pesagem = { peso, densidade: densidadeCalculada, timestamp };

  if (!amostras[amostraAtual]) {
    amostras[amostraAtual] = [];
  }

  if (!amostras[amostraAtual][cicloAtual - 1]) {
    amostras[amostraAtual][cicloAtual - 1] = {};
  }

  amostras[amostraAtual][cicloAtual - 1] = pesagem;

  setAmostras([...amostras]);
  setPeso('');

  // Mantém a mensagem do modal sincronizada com a ação atual
  setModalMensagem(`Ciclo ${cicloAtual} - Amostra ${amostraAtual + 1}:\nPeso: ${peso}\nDensidade: ${densidadeCalculada},\nHorário: ${timestamp}`);
  setModalVisivel(true);

  const proximaAmostra = amostraAtual + 1;
  if (proximaAmostra < quantidadeAmostras) {
    setAmostraAtual(proximaAmostra);
  } else {
    if (cicloAtual < 4) {
  setCicloAtual(cicloAtual + 1);
  setAmostraAtual(0);
  iniciarTemporizadorEspera(); // Inicia o temporizador de espera
} else {
      setModalMensagem("Última pesagem realizada. Projeto concluído!");
      // Aqui, considere chamar uma função de conclusão ou preparar a UI para um novo projeto.
    }
  }
};


const iniciarTemporizadorEspera = () => {
  setEsperandoNovoCiclo(true);
  setTempoRestante(10); // 120 segundos = 2 minutos

  const intervalId = setInterval(() => {
    setTempoRestante((tempoAtual) => {
      if (tempoAtual <= 1) {
        clearInterval(intervalId);
        setEsperandoNovoCiclo(false);
        setModalMensagem("Iniciar novo ciclo de pesagens");
        // Adicione aqui o alarme visual ou outra notificação
        return 0;
      } else {
        return tempoAtual - 1;
      }
    });
  }, 1000); // Atualiza a cada segundo
};







const iniciarNovoCiclo = () => {
  setAmostras(Array.from({ length: quantidadeAmostras }, () => Array.from({ length: 4 }, () => ({ peso: '', densidade: '', timestamp: '' }))));
  setAmostraAtual(0);
  setPesagemAtual(0);
  setCicloAtual(1); // Reinicia os ciclos de pesagem
  setModalVisivel(false);
  setModalMensagem('');
  setPeso('');
};

  const finalizarProjeto = async () => {
  if (uidUsuario) {
    await salvarProjetoNoFirestore();
    resetarFormulario();
    navigation.replace('Home'); // Substitui a tela atual pela Home, sem permitir voltar
  } else {
    console.log("UID do usuário não está disponível.");
    Alert.alert("Erro", "Falha ao identificar o usuário logado.");
  }
};



const prepararDadosDoProjetoParaSalvar = () => {
  // Planificando o array de amostras
  const amostrasPlanificadas = amostras.flatMap((grupo, indexGrupo) => 
    grupo.map((amostra, indexAmostra) => ({
      ...amostra,
      grupoId: indexGrupo,
      amostraId: indexAmostra
    }))
  );

  const projeto = {
    nomeProjeto,
    dataCriacao: new Date(),
    uidUsuario: uidUsuario,  // Substitua pelo UID real do usuário
    calibragem: ultimaCalibragem,
    quantidadeAmostras,
    amostras: amostrasPlanificadas
  };

  return projeto;
};



const salvarProjetoNoFirestore = async () => {
  const dadosDoProjeto = prepararDadosDoProjetoParaSalvar();
  
  try {
    await addDoc(collection(db, 'projetos'), dadosDoProjeto);
    Alert.alert("Sucesso", "Projeto salvo com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar o projeto:", error);
    Alert.alert("Erro", "Não foi possível salvar o projeto. Tente novamente.");
  }
};



  const resetarFormulario = () => {
    setNomeProjeto('');
    setQuantidadeAmostras(1);
    setAmostras(Array.from({ length: 1 }, () => Array.from({ length: 4 }, () => ({ peso: '', densidade: '', timestamp: '' }))));
    setAmostraAtual(0);
    setPeso('');
    setModalVisivel(false);
    setModalMensagem('');
  };

  const necessitaNovaCalibragem = () => {
    if (!ultimaCalibragem) return false;
    // Calcula a diferença de tempo em horas
    const horasDesdeUltimaCalibragem = Math.abs(new Date() - ultimaCalibragem.timestamp) / 36e5;
    return horasDesdeUltimaCalibragem > 14;
  };

const buscarDispositivosBluetooth = async () => {
  try {
    // Exemplo: isso poderia ser uma chamada para a biblioteca de Bluetooth para escanear por dispositivos
    const dispositivosEncontrados = await algumaBibliotecaBluetooth.scanForDevices();
    setDispositivosBluetooth(dispositivosEncontrados);
  } catch (erro) {
    console.error("Erro ao buscar dispositivos Bluetooth:", erro);
    Alert.alert("Erro", "Não foi possível buscar dispositivos Bluetooth.");
  }
};


  return (
  <ScrollView style={styles.container}>
    {ultimaCalibragem ? (
      <View style={styles.calibragemView}>
        <Text style={styles.infoText}>Tara: {ultimaCalibragem.tara}</Text>
        <Text style={styles.infoText}>Peso Cheio: {ultimaCalibragem.pesoCheio}</Text>
        <Text style={styles.infoText}>Densidade: {ultimaCalibragem.densidade}</Text>
        <Text style={styles.infoText}>Última Calibragem: {ultimaCalibragem.timestamp.toLocaleDateString()}</Text>
        <Text style={styles.alertText}>
          {ultimaCalibragem.necessitaCalibragem ? "Necessita nova calibragem" : "Calibragem OK"}
        </Text>
      </View>
    ) : (
      <Text>Carregando dados da calibragem...</Text>
    )}
    <TextInput
      style={styles.input}
      placeholder="Nome do Projeto/Cliente"
      value={nomeProjeto}
      onChangeText={setNomeProjeto}
    />
    <Picker
      selectedValue={quantidadeAmostras}
      style={{ height: 50, width: 150 }}
      onValueChange={(itemValue, itemIndex) => setQuantidadeAmostras(itemValue)}
    >
      {Array.from({ length: 6 }, (_, i) => i + 1).map(value => (
        <Picker.Item key={value} label={`${value} amostra(s)`} value={value} />
      ))}
    </Picker>

{/* Para os cards de seleção, use TouchableOpacity com Icons do react-native-vector-icons */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 20 }}>
        <TouchableOpacity onPress={() => { console.log('Handle manual pesagem'); }} style={styles.card}>
  <Icon name="scale-bathroom" size={30} color="#000" />
  <Text>Pesagem Manual</Text>
</TouchableOpacity>
<TouchableOpacity onPress={abrirModalBluetooth} style={styles.card}>
  <Icon name="bluetooth-connect" size={30} color="#000" />
  <Text>Conectar Bluetooth</Text>
</TouchableOpacity>


      </View>

    <View>
      <Text>Pesagem do Ciclo {cicloAtual} - Amostra {amostraAtual + 1}:</Text>
      <TextInput
        style={styles.input}
        placeholder="Peso"
        keyboardType="numeric"
        value={peso}
        onChangeText={setPeso}
        editable={!temporizador}
      />
      <TouchableOpacity style={styles.button} onPress={confirmarPesagem} disabled={temporizador}>
        <Text style={styles.buttonText}>Confirmar Pesagem</Text>
      </TouchableOpacity>
    </View>

<Modal
  visible={modalVisivel}
  onRequestClose={() => setModalVisivel(false)}>
  <View style={styles.centeredView}>
    <ScrollView style={styles.modalView}>
      {dispositivosBluetooth.map((dispositivo, index) => (
        <TouchableOpacity
          key={index}
          style={styles.dispositivoItem}
          onPress={() => conectarAoDispositivo(dispositivo.id)}>
          <Text style={styles.dispositivoTexto}>{dispositivo.nome}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
</Modal>


   
<Modal
  animationType="slide"
  transparent={true}
  visible={modalVisivel || esperandoNovoCiclo}
  onRequestClose={() => {
    // Impede que o modal seja fechado utilizando gestos ou botões de hardware
    // em casos específicos, como durante a contagem regressiva.
  }}
>
  <View style={styles.centeredView}>
    <View style={styles.modalView}>
      {esperandoNovoCiclo ? (
        <>
          <Text style={styles.modalText}>Tempo restante para o novo ciclo: {tempoRestante}s</Text>
          {/* Optamos por não mostrar nenhum botão de ação durante a contagem regressiva */}
          <Text style={{ marginTop: 20, color: '#999' }}>Aguarde para iniciar o novo ciclo...</Text>
        </>
      ) : (
        <>
          <Text style={styles.modalText}>{modalMensagem}</Text>
          {cicloAtual === 4 && modalMensagem === "Última pesagem realizada. Projeto concluído!" ? (
            <TouchableOpacity
  style={[styles.button, styles.buttonClose]}
  onPress={finalizarProjeto}>
  <Text style={styles.textStyle}>Finalizar Projeto</Text>
</TouchableOpacity>

          ) : (
            <>
              {modalMensagem !== "Última pesagem realizada. Projeto concluído!" && (
                <TouchableOpacity
                  style={[styles.button, styles.buttonClose]}
                  onPress={() => setModalVisivel(false)}
                >
                  <Text style={styles.textStyle}>Continuar</Text>
                </TouchableOpacity>

              )}
            </>
          )}
        </>
      )}
    </View>
  </View>
</Modal>
{/* Botão Voltar */}
      <TouchableOpacity
        style={styles.voltarBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.voltarText}>Voltar</Text>
      </TouchableOpacity>

  </ScrollView>
);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  input: {
    backgroundColor: '#FFF',
    borderColor: '#CCC',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 18,
  },
  button: {
    backgroundColor: '#F67D22',
    padding: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  buttonClose: {
    backgroundColor: '#2196F3',
    marginTop: 15,
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center"
  },
  calibragemView: {
    marginBottom: 20,
  },
  infoText: {
    fontSize: 16,
  },
  alertText: {
    fontSize: 16,
    color: 'red',
    fontWeight: 'bold',
  },
voltarBtn: {
    marginTop: 10,
    backgroundColor: '#525659',
    padding: 10,
    borderRadius: 5,
  },
  voltarText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 19,
  },

});
