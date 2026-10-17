import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { estaOnline, comTempoLimite } from './helpers/rede';
import { lerJson, gravarJson } from './helpers/armazenamento';

const CHAVE_PENDENTES = 'calibragensPendentes';
const TEMPO_LIMITE_FIRESTORE_MS = 10000;

const referenciaCalibragem = (id) => doc(db, 'calibragens', id);
const gerarIdCalibragem = () => doc(collection(db, 'calibragens')).id;

// Salvar e sincronizar mexem na mesma chave ao mesmo tempo; a fila evita que uma escrita apague a outra
let filaDePendentes = Promise.resolve();

function alterarPendentes(alterar) {
  const proxima = filaDePendentes.then(async () => {
    const novas = alterar(await lerJson(CHAVE_PENDENTES, []));
    await gravarJson(CHAVE_PENDENTES, novas);
    return novas;
  });
  filaDePendentes = proxima.catch(() => {});
  return proxima;
}

const adicionarPendente = (calibragem) => alterarPendentes(pendentes => [...pendentes, calibragem]);
const removerPendente = (id) => alterarPendentes(pendentes => pendentes.filter(p => p.id !== id));

// As rules não deixam regravar uma calibragem: se o SDK já entregou a escrita que estourou o tempo, a nossa volta negada
async function jaEstaNoBanco(id) {
  const snap = await comTempoLimite(getDoc(referenciaCalibragem(id)), TEMPO_LIMITE_FIRESTORE_MS);
  return snap.exists();
}

async function enviarPendente({ id, timestamp, ...dados }) {
  try {
    await comTempoLimite(
      setDoc(referenciaCalibragem(id), { ...dados, timestamp: new Date(timestamp) }),
      TEMPO_LIMITE_FIRESTORE_MS
    );
  } catch (erro) {
    if (erro?.code !== 'permission-denied' || !(await jaEstaNoBanco(id))) throw erro;
  }
  await removerPendente(id);
}

export async function registrarCalibragemNoBanco(calibragem) {
  const pendente = { ...calibragem, id: gerarIdCalibragem(), timestamp: calibragem.timestamp.toISOString() };
  await adicionarPendente(pendente);
  if (!(await estaOnline())) return false;
  try {
    await enviarPendente(pendente);
    return true;
  } catch (erro) {
    console.warn('Calibragem fica pendente no aparelho:', erro.message);
    return false;
  }
}

let sincronizando = false;

export async function sincronizarCalibragensPendentes() {
  const uid = auth.currentUser?.uid;
  if (sincronizando || !uid || !(await estaOnline())) return;
  sincronizando = true;
  try {
    const pendentes = await lerJson(CHAVE_PENDENTES, []);
    // As rules exigem userId == auth.uid: as de outro usuário esperam ele logar de novo neste aparelho
    for (const pendente of pendentes.filter(p => p.userId === uid)) {
      await enviarPendente(pendente);
    }
  } catch (erro) {
    console.error('Erro ao sincronizar calibragens:', erro);
  } finally {
    sincronizando = false;
  }
}
