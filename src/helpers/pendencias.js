import { PESAGENS_OBRIGATORIAS, contarPesagensConcluidas } from './pesagem';
import { listarFurosIncompletos } from './furos';
import { kgPreenchido as valorPreenchido } from './numeros';

const MAXIMO_DE_FUROS_LISTADOS = 10;

const pluralizarPesagens = (quantidade) => (quantidade === 1 ? '1 pesagem' : `${quantidade} pesagens`);

const listarAmostrasIncompletas = (amostras) =>
  amostras
    .map((amostra, index) => ({
      numero: index + 1,
      faltam: PESAGENS_OBRIGATORIAS - contarPesagensConcluidas(amostra),
    }))
    .filter(({ faltam }) => faltam > 0);

const algumaAmostraCompleta = (amostras) =>
  amostras.some(amostra => contarPesagensConcluidas(amostra) >= PESAGENS_OBRIGATORIAS);

const pendenciasDeIdentificacao = ({ nomeProjeto, clienteSelecionado }) => [
  !nomeProjeto.trim() && 'Informe o nome do projeto.',
  !clienteSelecionado && 'Selecione um cliente da lista.',
];

function listarNumerosDeFuros(numeros) {
  const listados = numeros.slice(0, MAXIMO_DE_FUROS_LISTADOS).join(', ');
  const restantes = numeros.length - MAXIMO_DE_FUROS_LISTADOS;
  return restantes > 0 ? `${listados} e mais ${restantes}` : listados;
}

function pendenciaDeFurosIncompletos(itens) {
  const incompletos = listarFurosIncompletos(itens);
  if (incompletos.length === 0) return null;
  if (incompletos.length === 1) return `Preencha a profundidade e a carga do Furo ${incompletos[0]}.`;
  return `Preencha a profundidade e a carga dos furos ${listarNumerosDeFuros(incompletos)}.`;
}

export const pendenciasDosFuros = (furos) =>
  furos
    ? [
      !valorPreenchido(furos.profundidadePrevista) && 'Informe a profundidade prevista dos furos.',
      !valorPreenchido(furos.cargaPrevista) && 'Informe a carga prevista dos furos.',
      furos.itens.length === 0 && 'Adicione pelo menos um furo.',
      pendenciaDeFurosIncompletos(furos.itens),
    ].filter(Boolean)
    : [];

export const pendenciasParaAvancar = (projeto) => [
  ...pendenciasDeIdentificacao(projeto),
  !algumaAmostraCompleta(projeto.amostras) && `Conclua as ${PESAGENS_OBRIGATORIAS} pesagens de pelo menos uma amostra.`,
].filter(Boolean);

export const pendenciasParaSalvar = (projeto) => [
  ...pendenciasDeIdentificacao(projeto),
  ...pendenciasDosFuros(projeto.furos),
  ...listarAmostrasIncompletas(projeto.amostras).map(
    ({ numero, faltam }) => `Amostra ${numero}: ${faltam === 1 ? 'falta' : 'faltam'} ${pluralizarPesagens(faltam)}.`
  ),
].filter(Boolean);
