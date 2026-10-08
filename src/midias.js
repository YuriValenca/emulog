import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { estaOnline, comTempoLimite } from './helpers/rede';
import { paraData } from './helpers/datas';
import { lerJson, gravarJson } from './helpers/armazenamento';

export const LIMITE_MIDIAS_POR_PROJETO = 10;

const LADO_MAIOR_PX = 1280;
const QUALIDADE_JPEG = 0.6;
const TEMPO_LIMITE_FIRESTORE_MS = 15000;
const DIAS_GUARDANDO_ENVIADAS = 7;
const PASTA_LOCAL = `${FileSystem.documentDirectory}midias/`;

const ESTADO = { PENDENTE: 'pendente', ENVIADA: 'enviada', EXCLUIR: 'excluir' };

const chaveIndice = ({ companyId, uid }) => `midias:${companyId}:${uid}`;
const chaveProjetosExcluidos = ({ companyId, uid }) => `midiasProjetosExcluidos:${companyId}:${uid}`;
const sessaoValida = (sessao) => !!sessao?.companyId && !!sessao?.uid;

const caminhoLocal = (id) => `${PASTA_LOCAL}${id}.jpg`;
const colecaoRemota = (projetoId) => collection(db, 'projetos', projetoId, 'midias');
const gerarIdMidia = () => doc(collection(db, 'projetos')).id;

// O índice é lido e regravado por telas e pela sincronização ao mesmo tempo; a fila evita que uma escrita apague a outra
let filaDoIndice = Promise.resolve();

function alterarJsonEmFila(chave, alterar) {
  const proxima = filaDoIndice.then(async () => {
    const novo = alterar(await lerJson(chave, {}));
    await gravarJson(chave, novo);
    return novo;
  });
  filaDoIndice = proxima.catch(() => {});
  return proxima;
}

const alterarIndice = (sessao, alterar) => alterarJsonEmFila(chaveIndice(sessao), alterar);

const lerIndice = (sessao) => lerJson(chaveIndice(sessao), {});

const apagarArquivoLocal = (id) => FileSystem.deleteAsync(caminhoLocal(id), { idempotent: true });

function redimensionamento({ width, height }) {
  if (!width || !height) return { width: LADO_MAIOR_PX };
  return width >= height
    ? { width: Math.min(width, LADO_MAIOR_PX) }
    : { height: Math.min(height, LADO_MAIOR_PX) };
}

async function comprimirParaPastaLocal(foto, id) {
  const comprimida = await ImageManipulator.manipulateAsync(
    foto.uri,
    [{ resize: redimensionamento(foto) }],
    { compress: QUALIDADE_JPEG, format: ImageManipulator.SaveFormat.JPEG }
  );
  await FileSystem.makeDirectoryAsync(PASTA_LOCAL, { intermediates: true });
  await FileSystem.moveAsync({ from: comprimida.uri, to: caminhoLocal(id) });
}

export async function adicionarMidia(foto, { projetoId, companyIdDoProjeto }, sessao) {
  const id = gerarIdMidia();
  await comprimirParaPastaLocal(foto, id);

  const midia = { id, projetoId, companyIdDoProjeto, criadoEm: new Date().toISOString(), estado: ESTADO.PENDENTE };
  await alterarIndice(sessao, indice => ({ ...indice, [id]: midia }));
  sincronizarMidias(sessao);
  return { id, criadoEm: midia.criadoEm, uri: caminhoLocal(id) };
}

export async function excluirMidia({ id }, { projetoId, companyIdDoProjeto }, sessao) {
  await apagarArquivoLocal(id);
  await alterarIndice(sessao, indice => ({
    ...indice,
    [id]: { id, projetoId, companyIdDoProjeto, criadoEm: indice[id]?.criadoEm, estado: ESTADO.EXCLUIR },
  }));
  sincronizarMidias(sessao);
}

// Marca o projeto inteiro: offline não dá pra saber quais fotos já estão no banco, então a busca fica pra sincronização
export async function excluirMidiasDoProjeto(projetoId, companyIdDoProjeto, sessao) {
  if (!sessaoValida(sessao) || !projetoId) return;
  const indice = await lerIndice(sessao);
  const locais = Object.values(indice).filter(midia => midia.projetoId === projetoId);
  await Promise.all(locais.map(midia => apagarArquivoLocal(midia.id)));
  await alterarIndice(sessao, atual => {
    locais.forEach(midia => delete atual[midia.id]);
    return atual;
  });
  await alterarJsonEmFila(chaveProjetosExcluidos(sessao), atuais => ({ ...atuais, [projetoId]: companyIdDoProjeto }));
  sincronizarMidias(sessao);
}

async function enviarMidia(midia, sessao) {
  const base64 = await FileSystem.readAsStringAsync(caminhoLocal(midia.id), { encoding: FileSystem.EncodingType.Base64 });
  // TODO: Quando o projeto Firebase estiver no plano Blaze, guardar a imagem no Storage em vez de base64 no Firestore:
  //   const caminho = `companies/${midia.companyIdDoProjeto}/projetos/${midia.projetoId}/${midia.id}.jpg`;
  //   const blob = await lerArquivoComoBlob(caminhoLocal(midia.id)); // fetch(uri).blob() falha no RN; montar o Blob via XMLHttpRequest
  //   await uploadBytes(ref(getStorage(), caminho), blob, { contentType: 'image/jpeg' });
  // e gravar { caminho } no lugar de { imagem }; na leitura, getDownloadURL(ref(getStorage(), caminho)).
  // Faltam ainda as storage.rules no Emulog-portal e uma migração das fotos antigas em base64.
  const documento = {
    companyId: midia.companyIdDoProjeto,
    projetoId: midia.projetoId,
    enviadoPor: sessao.uid,
    criadoEm: Timestamp.fromDate(paraData(midia.criadoEm)),
    imagem: `data:image/jpeg;base64,${base64}`,
  };
  await comTempoLimite(setDoc(doc(colecaoRemota(midia.projetoId), midia.id), documento), TEMPO_LIMITE_FIRESTORE_MS);
}

const marcarComoEnviada = (id, sessao) =>
  alterarIndice(sessao, indice => {
    // Se foi apagada enquanto subia, continua marcada pra excluir
    if (indice[id]?.estado === ESTADO.PENDENTE) {
      indice[id] = { ...indice[id], estado: ESTADO.ENVIADA, enviadaEm: new Date().toISOString() };
    }
    return indice;
  });

const removerDoIndiceSeAindaExcluir = (id, sessao) =>
  alterarIndice(sessao, indice => {
    if (indice[id]?.estado === ESTADO.EXCLUIR) delete indice[id];
    return indice;
  });

async function processarMidia(midia, sessao) {
  if (midia.estado === ESTADO.PENDENTE) {
    const arquivo = await FileSystem.getInfoAsync(caminhoLocal(midia.id));
    if (!arquivo.exists) return alterarIndice(sessao, indice => { delete indice[midia.id]; return indice; });
    await enviarMidia(midia, sessao);
    return marcarComoEnviada(midia.id, sessao);
  }
  if (midia.estado === ESTADO.EXCLUIR) {
    await comTempoLimite(deleteDoc(doc(colecaoRemota(midia.projetoId), midia.id)), TEMPO_LIMITE_FIRESTORE_MS);
    return removerDoIndiceSeAindaExcluir(midia.id, sessao);
  }
}

async function excluirProjetoRemoto(projetoId, companyIdDoProjeto, sessao) {
  const remotas = await buscarMidiasRemotas(projetoId, companyIdDoProjeto, { lancarErro: true });
  for (const midia of remotas) {
    await comTempoLimite(deleteDoc(doc(colecaoRemota(projetoId), midia.id)), TEMPO_LIMITE_FIRESTORE_MS);
  }
  await alterarJsonEmFila(chaveProjetosExcluidos(sessao), atuais => {
    delete atuais[projetoId];
    return atuais;
  });
}

const enviadaHaMuitoTempo = (midia) =>
  midia.estado === ESTADO.ENVIADA
  && Date.now() - paraData(midia.enviadaEm).getTime() > DIAS_GUARDANDO_ENVIADAS * 24 * 60 * 60 * 1000;

// A cópia local só serve pra mostrar a foto sem internet logo depois de tirada; depois disso o banco basta
async function limparCopiasLocaisAntigas(sessao) {
  const antigas = Object.values(await lerIndice(sessao)).filter(enviadaHaMuitoTempo);
  await Promise.all(antigas.map(midia => apagarArquivoLocal(midia.id)));
  await alterarIndice(sessao, indice => {
    antigas.forEach(midia => { if (enviadaHaMuitoTempo(indice[midia.id] || {})) delete indice[midia.id]; });
    return indice;
  });
}

async function executarComAviso(descricao, tarefa) {
  try {
    await tarefa();
  } catch (error) {
    // Fica pendente (sem rede, sem permissão nas rules etc.) e tenta de novo na próxima sincronização
    console.warn(`${descricao} pendente:`, error.message);
  }
}

let sincronizando = false;
let pedidaDuranteSincronizacao = false;
let ultimaSessao = null;

export async function sincronizarMidias(sessao) {
  if (!sessaoValida(sessao)) return;
  ultimaSessao = sessao;
  if (sincronizando) {
    pedidaDuranteSincronizacao = true;
    return;
  }
  sincronizando = true;
  pedidaDuranteSincronizacao = false;
  try {
    if (!(await estaOnline())) return;

    for (const midia of Object.values(await lerIndice(sessao))) {
      await executarComAviso(`Foto ${midia.id}`, () => processarMidia(midia, sessao));
    }
    const projetosExcluidos = await lerJson(chaveProjetosExcluidos(sessao), {});
    for (const [projetoId, companyIdDoProjeto] of Object.entries(projetosExcluidos)) {
      await executarComAviso(`Fotos do projeto ${projetoId}`, () => excluirProjetoRemoto(projetoId, companyIdDoProjeto, sessao));
    }
    await limparCopiasLocaisAntigas(sessao);
  } catch (error) {
    console.error('Erro ao sincronizar fotos:', error);
  } finally {
    sincronizando = false;
    if (pedidaDuranteSincronizacao) sincronizarMidias(ultimaSessao);
  }
}

// Usada quando a rede volta, fora de qualquer tela que conheça a sessão
export const sincronizarMidiasDaUltimaSessao = () => sincronizarMidias(ultimaSessao);

async function buscarMidiasRemotas(projetoId, companyIdDoProjeto, { lancarErro = false } = {}) {
  try {
    if (!(await estaOnline())) throw new Error('Sem internet');
    // As rules só liberam a leitura da própria empresa, então a consulta precisa filtrar por ela
    const consulta = query(colecaoRemota(projetoId), where('companyId', '==', companyIdDoProjeto));
    const snap = await comTempoLimite(getDocs(consulta), TEMPO_LIMITE_FIRESTORE_MS);
    return snap.docs.map(documento => ({
      id: documento.id,
      criadoEm: paraData(documento.data().criadoEm).toISOString(),
      uri: documento.data().imagem,
    }));
  } catch (error) {
    if (lancarErro) throw error;
    console.warn('Erro ao buscar fotos remotas:', error.message);
    return null;
  }
}

export async function listarMidias({ projetoId, companyIdDoProjeto }, sessao) {
  const [indice, remotas] = await Promise.all([
    sessaoValida(sessao) ? lerIndice(sessao) : {},
    buscarMidiasRemotas(projetoId, companyIdDoProjeto),
  ]);
  const locais = Object.values(indice).filter(midia => midia.projetoId === projetoId);
  const excluidas = new Set(locais.filter(midia => midia.estado === ESTADO.EXCLUIR).map(midia => midia.id));

  const porId = new Map((remotas || []).filter(midia => !excluidas.has(midia.id)).map(midia => [midia.id, midia]));
  locais
    .filter(midia => midia.estado !== ESTADO.EXCLUIR)
    .forEach(midia => porId.set(midia.id, { id: midia.id, criadoEm: midia.criadoEm, uri: caminhoLocal(midia.id) }));

  return {
    midias: [...porId.values()].sort((a, b) => paraData(a.criadoEm) - paraData(b.criadoEm)),
    remotasCarregadas: remotas !== null,
  };
}

export async function lerMidiaComoDataUri({ uri }) {
  if (uri.startsWith('data:')) return uri;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:image/jpeg;base64,${base64}`;
}
