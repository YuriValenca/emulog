import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PESAGENS_POR_AMOSTRA, criarAmostraVazia, criarPesagemVazia, pesagemConcluida } from '../helpers/pesagem';
import { calibragemParaArmazenar } from '../helpers/calibragem';
import { kgParaTexto } from '../helpers/numeros';
import { gerarIdRascunho, prepararRascunho, enviarRascunho } from '../rascunhos';
import { furosTemDados, furosParaFormulario } from '../helpers/furos';
import { useAppAuth } from './auth';

const ProjetoFormContext = createContext(null);
const CHAVE_LEGADA = 'projetoEmAndamento';
const ATRASO_ENVIO_RASCUNHO_MS = 2000;

const chaveProjetoEmAndamento = (companyId, uid) => `projetoEmAndamento:${companyId}:${uid}`;

const pesagensDaAmostra = (amostra) => (Array.isArray(amostra) ? amostra : amostra?.pesagens || []);

const temTexto = (valor) => !!String(valor ?? '').trim();

export const projetoTemDados = (projeto) =>
  !!projeto && (
    [projeto.nomeProjeto, projeto.numeroNF, projeto.kgPrevisto, projeto.kgAplicado, projeto.informacoesGerais]
      .some(temTexto) ||
    !!projeto.clienteSelecionado ||
    !!projeto.caminhaoSelecionado ||
    (projeto.equipeSelecionada || []).length > 0 ||
    furosTemDados(projeto.furos) ||
    (projeto.amostras || []).some(amostra => pesagensDaAmostra(amostra).some(pesagemConcluida))
  );

export const contarPesagensDoProjeto = (projeto) =>
  (projeto?.amostras || []).reduce(
    (total, amostra) => total + pesagensDaAmostra(amostra).filter(pesagemConcluida).length,
    0
  );

export const descartarProjetoEmAndamento = (companyId, uid) =>
  AsyncStorage.removeItem(chaveProjetoEmAndamento(companyId, uid));

export const definirProjetoEmAndamento = (projeto, companyId, uid) =>
  AsyncStorage.setItem(chaveProjetoEmAndamento(companyId, uid), JSON.stringify({ ...projeto, uidSessao: uid }));

async function migrarChaveLegada(companyId, uid) {
  const legado = await AsyncStorage.getItem(CHAVE_LEGADA);
  if (!legado) return null;

  const projeto = JSON.parse(legado);
  if (projeto.companyId !== companyId || projeto.uidUsuario !== uid) return null;

  await definirProjetoEmAndamento(projeto, companyId, uid);
  await AsyncStorage.removeItem(CHAVE_LEGADA);
  return { ...projeto, uidSessao: uid };
}

export async function buscarProjetoEmAndamento(companyId, uid) {
  if (!companyId || !uid) return null;
  const salvo = await AsyncStorage.getItem(chaveProjetoEmAndamento(companyId, uid));
  return salvo ? JSON.parse(salvo) : migrarChaveLegada(companyId, uid);
}

export function ProjetoFormProvider({ children }) {
  const { companyId: companyIdSessao, uid: uidSessao } = useAppAuth();
  const temporizadorEnvio = useRef(null);

  const [carregado, setCarregado] = useState(false);
  const [idProjeto, setIdProjeto] = useState(gerarIdRascunho);
  const [dataCriacao, setDataCriacao] = useState(null);
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [quantidadeAmostras, setQuantidadeAmostras] = useState(1);
  const [amostras, setAmostras] = useState(() => [criarAmostraVazia()]);
  const [amostraAtual, setAmostraAtual] = useState(0);
  const [pesagemAtual, setPesagemAtual] = useState(1);
  const [peso, setPeso] = useState('');
  const [furos, setFuros] = useState([]);
  const [ultimaCalibragem, setUltimaCalibragem] = useState(null);
  const [uidUsuario, setUidUsuario] = useState(null);
  const [companyId, setCompanyId] = useState(null);

  const [numeroNF, setNumeroNF] = useState('');
  const [kgPrevisto, setKgPrevisto] = useState('');
  const [kgAplicado, setKgAplicado] = useState('');
  const [caminhaoSelecionado, setCaminhaoSelecionado] = useState(null);
  const [equipeSelecionada, setEquipeSelecionada] = useState([]);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [informacoesGerais, setInformacoesGerais] = useState('');

  const agendarEnvioDoRascunho = (projeto) => {
    clearTimeout(temporizadorEnvio.current);
    if (!projetoTemDados(projeto)) return;

    temporizadorEnvio.current = setTimeout(async () => {
      try {
        // Se o projeto foi concluído, apagado ou virou rascunho nesse meio-tempo, não pode ser reenviado
        const atual = await buscarProjetoEmAndamento(companyIdSessao, uidSessao);
        if (atual?.id !== projeto.id) return;
        await enviarRascunho(prepararRascunho(atual), { companyId: companyIdSessao, uid: uidSessao });
      } catch (error) {
        console.error('Erro ao enviar rascunho:', error);
      }
    }, ATRASO_ENVIO_RASCUNHO_MS);
  };

  const salvarEstadoDoProjeto = async () => {
    if (!carregado || !companyIdSessao || !uidSessao) return;

    const projeto = {
      id: idProjeto,
      dataCriacao,
      dataAtualizacao: new Date().toISOString(),
      companyId: companyId || companyIdSessao,
      uidUsuario: uidUsuario || uidSessao,
      calibragem: ultimaCalibragem ? calibragemParaArmazenar(ultimaCalibragem) : null,
      nomeProjeto, quantidadeAmostras, amostras,
      amostraAtual, pesagemAtual, peso,
      furos,
      numeroNF, kgPrevisto, kgAplicado,
      caminhaoSelecionado, equipeSelecionada,
      clienteSelecionado,
      informacoesGerais,
    };
    try {
      await definirProjetoEmAndamento(projeto, companyIdSessao, uidSessao);
      agendarEnvioDoRascunho(projeto);
    } catch (error) {
      console.error("Erro ao salvar estado do projeto:", error);
    }
  };

  useEffect(() => {
    const projetoAtual = {
      nomeProjeto, amostras, furos, numeroNF, kgPrevisto, kgAplicado, informacoesGerais,
      clienteSelecionado, caminhaoSelecionado, equipeSelecionada,
    };
    if (!dataCriacao && projetoTemDados(projetoAtual)) {
      setDataCriacao(new Date().toISOString());
    }
  }, [
    nomeProjeto, amostras, furos, numeroNF, kgPrevisto, kgAplicado, informacoesGerais,
    clienteSelecionado, caminhaoSelecionado, equipeSelecionada,
  ]);

  useEffect(() => {
    salvarEstadoDoProjeto();
  }, [
    carregado,
    idProjeto, dataCriacao,
    companyId, uidUsuario,
    ultimaCalibragem,
    nomeProjeto, quantidadeAmostras, amostras,
    amostraAtual, pesagemAtual, peso,
    furos,
    numeroNF, kgPrevisto, kgAplicado,
    caminhaoSelecionado, equipeSelecionada,
    clienteSelecionado,
    informacoesGerais,
  ]);

  const limparEstadoDoProjeto = async () => {
    try {
      await descartarProjetoEmAndamento(companyIdSessao, uidSessao);
    } catch (error) {
      console.error("Erro ao limpar estado do projeto:", error);
    }
  };

  const cancelarEnvioDoRascunho = () => clearTimeout(temporizadorEnvio.current);

  const resetarFormulario = () => {
    cancelarEnvioDoRascunho();
    setIdProjeto(gerarIdRascunho());
    setDataCriacao(null);
    setCompanyId(companyIdSessao);
    setUidUsuario(uidSessao);
    setNomeProjeto('');
    setQuantidadeAmostras(1);
    setAmostras([criarAmostraVazia()]);
    setAmostraAtual(0);
    setPesagemAtual(1);
    setPeso('');
    setFuros([]);
    setNumeroNF('');
    setKgPrevisto('');
    setKgAplicado('');
    setCaminhaoSelecionado(null);
    setEquipeSelecionada([]);
    setClienteSelecionado(null);
    setInformacoesGerais('');
  };

  const restaurarDoStorage = async () => {
    try {
      const projeto = await buscarProjetoEmAndamento(companyIdSessao, uidSessao);

      if (!projeto) {
        setCompanyId(companyIdSessao);
        setUidUsuario(uidSessao);
        return null;
      }

      if (projeto.id) setIdProjeto(projeto.id);
      setDataCriacao(projeto.dataCriacao || null);
      setCompanyId(projeto.companyId);
      setUidUsuario(projeto.uidUsuario || uidSessao);
      setNomeProjeto(projeto.nomeProjeto || '');
      setQuantidadeAmostras(projeto.quantidadeAmostras || 1);
      setAmostraAtual(projeto.amostraAtual || 0);
      setPesagemAtual(projeto.pesagemAtual || 1);
      setPeso(projeto.peso || '');
      setFuros(furosParaFormulario(projeto.furos));
      setNumeroNF(projeto.numeroNF || '');
      setKgPrevisto(kgParaTexto(projeto.kgPrevisto));
      setKgAplicado(kgParaTexto(projeto.kgAplicado));
      setCaminhaoSelecionado(projeto.caminhaoSelecionado || null);
      setEquipeSelecionada(projeto.equipeSelecionada || []);
      setClienteSelecionado(projeto.clienteSelecionado || null);
      setInformacoesGerais(projeto.informacoesGerais || '');

      let novasAmostras = [];
      if (Array.isArray(projeto.amostras)) {
        if (Array.isArray(projeto.amostras[0])) {
          novasAmostras = projeto.amostras;
        } else if (typeof projeto.amostras[0] === 'object' && projeto.amostras[0].pesagens) {
          novasAmostras = projeto.amostras.map(a => a.pesagens);
        } else if (typeof projeto.amostras[0] === 'object' && projeto.amostras[0].peso !== undefined) {
          novasAmostras = [projeto.amostras];
        } else {
          novasAmostras = Array.from({ length: projeto.quantidadeAmostras }, criarAmostraVazia);
        }
      } else {
        novasAmostras = Array.from({ length: projeto.quantidadeAmostras }, criarAmostraVazia);
      }

      while (novasAmostras.length < projeto.quantidadeAmostras) {
        novasAmostras.push(criarAmostraVazia());
      }
      novasAmostras = novasAmostras.map(amostra => {
        if (Array.isArray(amostra)) {
          while (amostra.length < PESAGENS_POR_AMOSTRA) amostra.push(criarPesagemVazia());
          return amostra;
        }
        return criarAmostraVazia();
      });

      setAmostras(novasAmostras);
      return projeto;
    } catch (error) {
      console.error("Erro ao restaurar projeto:", error);
      return null;
    } finally {
      setCarregado(true);
    }
  };

  return (
    <ProjetoFormContext.Provider value={{
      idProjeto, dataCriacao,
      nomeProjeto, setNomeProjeto,
      quantidadeAmostras, setQuantidadeAmostras,
      amostras, setAmostras,
      amostraAtual, setAmostraAtual,
      pesagemAtual, setPesagemAtual,
      peso, setPeso,
      furos, setFuros,
      ultimaCalibragem, setUltimaCalibragem,
      uidUsuario, setUidUsuario,
      companyId, setCompanyId,
      numeroNF, setNumeroNF,
      kgPrevisto, setKgPrevisto,
      kgAplicado, setKgAplicado,
      caminhaoSelecionado, setCaminhaoSelecionado,
      equipeSelecionada, setEquipeSelecionada,
      clienteSelecionado, setClienteSelecionado,
      informacoesGerais, setInformacoesGerais,
      salvarEstadoDoProjeto,
      cancelarEnvioDoRascunho,
      limparEstadoDoProjeto,
      resetarFormulario,
      restaurarDoStorage,
    }}>
      {children}
    </ProjetoFormContext.Provider>
  );
}

export function useProjetoForm() {
  const ctx = useContext(ProjetoFormContext);
  if (!ctx) throw new Error('useProjetoForm deve ser usado dentro de ProjetoFormProvider');
  return ctx;
}
