import { PESAGENS_OBRIGATORIAS, contarPesagensConcluidas } from './pesagem';
import { listarFurosVazios } from './furos';

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

const pendenciaDeFurosVazios = (furos) => {
  const vazios = listarFurosVazios(furos);
  if (vazios.length === 0) return null;
  if (vazios.length === 1) return `Preencha ou apague o Furo ${vazios[0]}.`;
  return `Preencha ou apague os furos ${vazios.join(', ')}.`;
};

export const pendenciasParaAvancar = (projeto) => [
  ...pendenciasDeIdentificacao(projeto),
  !algumaAmostraCompleta(projeto.amostras) && `Conclua as ${PESAGENS_OBRIGATORIAS} pesagens de pelo menos uma amostra.`,
  pendenciaDeFurosVazios(projeto.furos),
].filter(Boolean);

export const pendenciasParaSalvar = (projeto) => [
  ...pendenciasDeIdentificacao(projeto),
  pendenciaDeFurosVazios(projeto.furos),
  ...listarAmostrasIncompletas(projeto.amostras).map(
    ({ numero, faltam }) => `Amostra ${numero}: ${faltam === 1 ? 'falta' : 'faltam'} ${pluralizarPesagens(faltam)}.`
  ),
].filter(Boolean);
