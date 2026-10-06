import { paraDecimal } from './numeros';
import { paraData } from './datas';

const HORAS_ATE_RECALIBRAGEM = 14;
const MS_POR_HORA = 36e5;

export function calcularTara(pesoVazio, pesoCheio) {
  return Number((pesoCheio - pesoVazio).toFixed(3));
}

export function precisaRecalibrar(timestamp, referencia = new Date()) {
  return Math.abs(referencia.getTime() - timestamp.getTime()) / MS_POR_HORA > HORAS_ATE_RECALIBRAGEM;
}

export const calibragemVencidaNoProjeto = (projeto) =>
  !!projeto.calibragem?.timestamp && !!projeto.dataCriacao
  && precisaRecalibrar(paraData(projeto.calibragem.timestamp), paraData(projeto.dataCriacao));

export function normalizarCalibragem(bruta) {
  const timestamp = paraData(bruta.timestamp);
  return {
    tara: paraDecimal(bruta.tara),
    pesoCheio: paraDecimal(bruta.pesoCheio),
    pesoVazio: paraDecimal(bruta.pesoVazio),
    timestamp,
    necessitaCalibragem: precisaRecalibrar(timestamp),
  };
}

export const calibragemParaArmazenar = (calibragem) => ({ ...calibragem, timestamp: calibragem.timestamp.toISOString() });

export function serializarCalibragem(calibragem) {
  return JSON.stringify(calibragemParaArmazenar(calibragem));
}

export const restaurarCalibragemCongelada = (armazenada) => ({
  ...normalizarCalibragem(armazenada),
  necessitaCalibragem: armazenada.necessitaCalibragem ?? false,
});

export function calibragemDoProjeto(calibragem) {
  return {
    tara: calibragem?.tara ?? 0,
    pesoCheio: calibragem?.pesoCheio ?? 0,
    pesoVazio: calibragem?.pesoVazio ?? 0,
    timestamp: calibragem?.timestamp ?? new Date(),
  };
}
