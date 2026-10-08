import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { paraData } from './helpers/datas';
import { estaOnline, comTempoLimite } from './helpers/rede';
import { pesagemConcluida } from './helpers/pesagem';
import { paraRefCaminhao, paraRefsEquipe } from './helpers/referencias';
import { paraKg, kgParaTexto } from './helpers/numeros';
import { furosParaSalvar } from './helpers/furos';

const COLECAO = 'projetos_rascunho';
const TEMPO_LIMITE_FIRESTORE_MS = 10000;

const chaveRascunhos = ({ companyId, uid }) => `rascunhos:${companyId}:${uid}`;
const chavePendencias = ({ companyId, uid }) => `rascunhosPendentes:${companyId}:${uid}`;
const sessaoValida = (sessao) => !!sessao?.companyId && !!sessao?.uid;

// O id já nasce como id de documento do Firestore (gerado no aparelho, funciona offline),
// pra ser o mesmo no rascunho local, no remoto e no projeto concluído
export const gerarIdRascunho = () => doc(collection(db, COLECAO)).id;

async function lerJson(chave, padrao) {
  const salvo = await AsyncStorage.getItem(chave);
  return salvo ? JSON.parse(salvo) : padrao;
}

const gravarJson = (chave, valor) => AsyncStorage.setItem(chave, JSON.stringify(valor));

const pesagensDaAmostra = (amostra) => (Array.isArray(amostra) ? amostra : amostra?.pesagens || []);

// No Firestore o rascunho segue o formato de projetos (cliente, informacoesOperacao, só pesagens feitas),
// que é o que o portal lê; no aparelho continua no formato do formulário
function paraFirestore(rascunho) {
  const {
    peso, uidSessao,
    clienteSelecionado, caminhaoSelecionado, equipeSelecionada,
    numeroNF, kgPrevisto, kgAplicado, informacoesGerais,
    ...dados
  } = JSON.parse(JSON.stringify(rascunho));
  return {
    ...dados,
    cliente: clienteSelecionado ?? null,
    informacoesOperacao: {
      numeroNF: numeroNF ?? '',
      kgPrevisto: paraKg(kgPrevisto),
      kgAplicado: paraKg(kgAplicado),
      caminhao: paraRefCaminhao(caminhaoSelecionado),
      equipe: paraRefsEquipe(equipeSelecionada),
      informacoesGerais: informacoesGerais ?? '',
    },
    // Firestore não aceita array dentro de array
    amostras: (dados.amostras || []).map((amostra, indice) => ({
      amostraId: indice,
      pesagens: pesagensDaAmostra(amostra).filter(pesagemConcluida),
    })),
    furos: furosParaSalvar(dados.furos),
    dataCriacao: Timestamp.fromDate(paraData(dados.dataCriacao)),
    dataAtualizacao: Timestamp.fromDate(paraData(dados.dataAtualizacao)),
    calibragem: dados.calibragem
      ? { ...dados.calibragem, timestamp: Timestamp.fromDate(paraData(dados.calibragem.timestamp)) }
      : null,
  };
}

function doFirestore(documento) {
  const { cliente, informacoesOperacao = {}, ...dados } = documento.data();
  return {
    ...dados,
    id: documento.id,
    clienteSelecionado: cliente ?? null,
    caminhaoSelecionado: informacoesOperacao.caminhao ?? null,
    equipeSelecionada: informacoesOperacao.equipe ?? [],
    numeroNF: informacoesOperacao.numeroNF ?? '',
    kgPrevisto: kgParaTexto(informacoesOperacao.kgPrevisto),
    kgAplicado: kgParaTexto(informacoesOperacao.kgAplicado),
    informacoesGerais: informacoesOperacao.informacoesGerais ?? '',
    amostras: (dados.amostras || []).map(pesagensDaAmostra),
    dataCriacao: paraData(dados.dataCriacao).toISOString(),
    dataAtualizacao: paraData(dados.dataAtualizacao).toISOString(),
    calibragem: dados.calibragem
      ? { ...dados.calibragem, timestamp: paraData(dados.calibragem.timestamp).toISOString() }
      : null,
  };
}

export function prepararRascunho(projeto) {
  const agora = new Date().toISOString();
  return {
    ...projeto,
    id: projeto.id || gerarIdRascunho(),
    dataCriacao: projeto.dataCriacao || agora,
    dataAtualizacao: agora,
  };
}

async function enfileirar(id, pendencia, sessao) {
  const pendencias = await lerJson(chavePendencias(sessao), {});
  pendencias[id] = { ...pendencia, versao: Date.now() };
  await gravarJson(chavePendencias(sessao), pendencias);
}

async function removerPendenciaSeInalterada(id, versao, sessao) {
  const pendencias = await lerJson(chavePendencias(sessao), {});
  if (pendencias[id]?.versao !== versao) return;
  delete pendencias[id];
  await gravarJson(chavePendencias(sessao), pendencias);
}

function executarPendencia(id, { acao, dados }) {
  const referencia = doc(db, COLECAO, id);
  const escrita = acao === 'excluir' ? deleteDoc(referencia) : setDoc(referencia, paraFirestore(dados));
  return comTempoLimite(escrita, TEMPO_LIMITE_FIRESTORE_MS);
}

let sincronizando = false;
let ultimaSessao = null;

export async function sincronizarRascunhos(sessao) {
  if (!sessaoValida(sessao)) return;
  ultimaSessao = sessao;
  if (sincronizando) return;
  sincronizando = true;
  try {
    if (!(await estaOnline())) return;

    const pendencias = await lerJson(chavePendencias(sessao), {});
    for (const [id, pendencia] of Object.entries(pendencias)) {
      try {
        await executarPendencia(id, pendencia);
        await removerPendenciaSeInalterada(id, pendencia.versao, sessao);
      } catch (error) {
        // Fica na fila (sem rede, sem permissão nas rules etc.) e tenta de novo na próxima sincronização
        console.warn(`Rascunho ${id} pendente:`, error.message);
      }
    }
  } catch (error) {
    console.error('Erro ao sincronizar rascunhos:', error);
  } finally {
    sincronizando = false;
  }
}

// Usada quando a rede volta, fora de qualquer tela que conheça a sessão
export const sincronizarRascunhosDaUltimaSessao = () => sincronizarRascunhos(ultimaSessao);

export async function enviarRascunho(rascunho, sessao) {
  if (!sessaoValida(sessao)) return;
  await enfileirar(rascunho.id, { acao: 'salvar', dados: rascunho }, sessao);
  sincronizarRascunhos(sessao);
}

export const listarRascunhosLocais = (sessao) => lerJson(chaveRascunhos(sessao), []);

export async function removerRascunhoLocal(id, sessao) {
  const rascunhos = await listarRascunhosLocais(sessao);
  await gravarJson(chaveRascunhos(sessao), rascunhos.filter(r => r.id !== id));
}

export async function salvarComoRascunho(projeto, sessao) {
  const rascunho = prepararRascunho(projeto);
  const rascunhos = await listarRascunhosLocais(sessao);
  await gravarJson(chaveRascunhos(sessao), [...rascunhos.filter(r => r.id !== rascunho.id), rascunho]);
  await enviarRascunho(rascunho, sessao);
}

export async function excluirRascunho(id, sessao) {
  await removerRascunhoLocal(id, sessao);
  await enfileirar(id, { acao: 'excluir' }, sessao);
  sincronizarRascunhos(sessao);
}

function consultaDeRascunhos({ companyId, uid }, role) {
  const referencia = collection(db, COLECAO);
  if (role === 'superadmin') return referencia;
  if (role === 'company_admin') return query(referencia, where('companyId', '==', companyId));
  return query(referencia, where('companyId', '==', companyId), where('uidUsuario', '==', uid));
}

async function buscarRascunhosRemotos(sessao, role) {
  if (!(await estaOnline())) return [];
  try {
    const snap = await comTempoLimite(getDocs(consultaDeRascunhos(sessao, role)), TEMPO_LIMITE_FIRESTORE_MS);
    return snap.docs.map(doFirestore);
  } catch (error) {
    console.warn('Erro ao buscar rascunhos remotos:', error.message);
    return [];
  }
}

export async function listarRascunhosDoHistorico(sessao, role, idEmAndamento) {
  if (!sessaoValida(sessao)) return [];
  const [locais, remotos, pendencias] = await Promise.all([
    listarRascunhosLocais(sessao),
    buscarRascunhosRemotos(sessao, role),
    lerJson(chavePendencias(sessao), {}),
  ]);

  const porId = new Map(remotos.map(r => [r.id, r]));
  locais.forEach(r => porId.set(r.id, r));

  return [...porId.values()]
    .filter(r => r.id !== idEmAndamento && pendencias[r.id]?.acao !== 'excluir')
    .sort((a, b) => paraData(b.dataAtualizacao) - paraData(a.dataAtualizacao));
}
