import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { estaOnline, comTempoLimite } from './helpers/rede';
import { lerJson, gravarJson } from './helpers/armazenamento';

const CHAVE_PENDENTES = 'informacoesOperacaoPendentes';
const TEMPO_LIMITE_FIRESTORE_MS = 15000;

// Salvar e sincronizar mexem na mesma chave ao mesmo tempo; a fila evita que uma escrita apague a outra
let filaDePendentes = Promise.resolve();

function alterarPendentes(alterar) {
  const proxima = filaDePendentes.then(async () => {
    const novas = alterar(await lerJson(CHAVE_PENDENTES, {}));
    await gravarJson(CHAVE_PENDENTES, novas);
    return novas;
  });
  filaDePendentes = proxima.catch(() => {});
  return proxima;
}

// Só remove se ninguém editou de novo enquanto a versão anterior subia
const removerSeInalterada = (projetoId, versao) => alterarPendentes((pendentes) => {
  if (pendentes[projetoId]?.versao !== versao) return pendentes;
  const { [projetoId]: _removida, ...restantes } = pendentes;
  return restantes;
});

async function enviarPendente(projetoId, { informacoesOperacao, versao }) {
  try {
    await comTempoLimite(
      updateDoc(doc(db, 'projetos', projetoId), { informacoesOperacao }),
      TEMPO_LIMITE_FIRESTORE_MS
    );
  } catch (erro) {
    // Projeto excluído no portal enquanto a edição esperava: não tem mais onde gravar
    if (erro?.code !== 'not-found') throw erro;
  }
  await removerSeInalterada(projetoId, versao);
}

export async function lerInformacoesPendentes(projetoId) {
  const pendentes = await lerJson(CHAVE_PENDENTES, {});
  return pendentes[projetoId]?.informacoesOperacao ?? null;
}

export async function salvarInformacoesDaOperacao(projetoId, informacoesOperacao) {
  const pendente = { informacoesOperacao, versao: Date.now() };
  await alterarPendentes(pendentes => ({ ...pendentes, [projetoId]: pendente }));
  if (!(await estaOnline())) return false;
  try {
    await enviarPendente(projetoId, pendente);
    return true;
  } catch (erro) {
    console.warn('Informações da operação ficam pendentes no aparelho:', erro.message);
    return false;
  }
}

let sincronizando = false;

export async function sincronizarInformacoesPendentes() {
  if (sincronizando || !auth.currentUser || !(await estaOnline())) return;
  sincronizando = true;
  try {
    const pendentes = await lerJson(CHAVE_PENDENTES, {});
    for (const [projetoId, pendente] of Object.entries(pendentes)) {
      try {
        await enviarPendente(projetoId, pendente);
      } catch (erro) {
        // Fica na fila (sem rede, projeto de outra empresa etc.) e tenta de novo depois, sem travar os outros
        console.warn(`Informações do projeto ${projetoId} pendentes:`, erro.message);
      }
    }
  } catch (erro) {
    console.error('Erro ao sincronizar informações da operação:', erro);
  } finally {
    sincronizando = false;
  }
}
