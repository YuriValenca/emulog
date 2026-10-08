import {
  paraKg as paraNumero,
  kgParaTexto as numeroParaTexto,
  kgPreenchido as valorPreenchido,
} from './numeros';

let contadorDeFuros = 0;

// O id só existe no aparelho, pra key da lista não embaralhar os inputs quando um furo do meio é apagado
const gerarIdFuro = () => `${Date.now()}-${contadorDeFuros++}`;

export const textoFuros = (quantidade) => (quantidade === 1 ? '1 furo' : `${quantidade} furos`);

export const criarFuro = (profundidadeReal = '') => ({ id: gerarIdFuro(), profundidadeReal, cargaReal: '' });

export const criarFurosVazios = () => ({ profundidadePrevista: '', cargaPrevista: '', itens: [criarFuro()] });

const valorNumerico = (valor) => paraNumero(valor) !== null;

export const furoCompleto = (furo) => valorNumerico(furo?.profundidadeReal) && valorNumerico(furo?.cargaReal);

export const furoTemDados = (furo) => valorPreenchido(furo?.profundidadeReal) || valorPreenchido(furo?.cargaReal);

export const furosTemDados = (furos) =>
  !!furos && (
    valorPreenchido(furos.profundidadePrevista)
    || valorPreenchido(furos.cargaPrevista)
    || (furos.itens || []).some(furoTemDados)
  );

export const listarFurosIncompletos = (itens) =>
  (itens || [])
    .map((furo, indice) => ({ numero: indice + 1, completo: furoCompleto(furo) }))
    .filter(({ completo }) => !completo)
    .map(({ numero }) => numero);

// Arredonda em 2 casas: somar decimais em ponto flutuante deixa resto (ex.: 61,88 + 0,1)
export const somarCargasReais = (itens) =>
  Math.round((itens || []).reduce((total, furo) => total + (paraNumero(furo?.cargaReal) ?? 0), 0) * 100) / 100;

// Furos que ainda seguem a prevista (vazios ou iguais à anterior) acompanham a mudança; os ajustados ficam como estão
export function aplicarProfundidadePrevista(furos, texto) {
  const seguePrevista = (furo) =>
    !valorPreenchido(furo.profundidadeReal) || furo.profundidadeReal === furos.profundidadePrevista;
  return {
    ...furos,
    profundidadePrevista: texto,
    itens: furos.itens.map(furo => (seguePrevista(furo) ? { ...furo, profundidadeReal: texto } : furo)),
  };
}

export const furosParaSalvar = (furos) =>
  furos
    ? {
      profundidadePrevista: paraNumero(furos.profundidadePrevista),
      cargaPrevista: paraNumero(furos.cargaPrevista),
      itens: (furos.itens || []).map(furo => ({
        profundidadeReal: paraNumero(furo.profundidadeReal),
        cargaReal: paraNumero(furo.cargaReal),
      })),
    }
    : null;

// Array era o formato de teste antes da etapa de furos; nunca foi pra produção, então só é descartado
export const furosParaFormulario = (furos) =>
  !furos || Array.isArray(furos)
    ? null
    : {
      profundidadePrevista: numeroParaTexto(furos.profundidadePrevista),
      cargaPrevista: numeroParaTexto(furos.cargaPrevista),
      itens: (furos.itens || []).map(furo => ({
        id: furo.id ?? gerarIdFuro(),
        profundidadeReal: numeroParaTexto(furo.profundidadeReal),
        cargaReal: numeroParaTexto(furo.cargaReal),
      })),
    };
