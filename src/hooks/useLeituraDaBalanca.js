import { useEffect, useRef, useState } from 'react';

const TOLERANCIA_G = 2;
const TEMPO_PARA_ESTABILIZAR_MS = 2000;
const PESO_MINIMO_G = 1;

const pesoNaBalanca = (peso) => typeof peso === 'number' && peso >= PESO_MINIMO_G;
const mesmoPeso = (a, b) => Math.abs(a - b) <= TOLERANCIA_G;
const paraTexto = (peso) => String(Math.round(peso));

// O campo ativo só recebe o peso depois que o operador confirma o peso estabilizado.
// Não usa o 'stable' do BleProvider: lá o limite de 10 g ignora copo plástico vazio e a leitura trava até zerar.
export function useLeituraDaBalanca({ conectada, peso, ordemDosCampos, valores, preencherCampo }) {
  const [campoAtivo, setCampoAtivo] = useState(null);
  const [pesoParaConfirmar, setPesoParaConfirmar] = useState(null);
  // Peso já confirmado ou recusado: só volta a contar depois que a balança mudar
  const pesoIgnorado = useRef(null);

  const proximoCampoVazio = (campo) => {
    const proximo = ordemDosCampos[ordemDosCampos.indexOf(campo) + 1];
    return proximo && !valores[proximo] ? proximo : null;
  };

  useEffect(() => {
    if (!conectada) {
      setCampoAtivo(null);
      setPesoParaConfirmar(null);
      return;
    }
    const primeiroVazio = ordemDosCampos.find(campo => !valores[campo]);
    if (primeiroVazio) setCampoAtivo(atual => atual ?? primeiroVazio);
  }, [conectada]);

  useEffect(() => {
    if (!campoAtivo || !pesoNaBalanca(peso)) return;

    // Copo levantado com a confirmação aberta não invalida o peso; só uma pesagem diferente invalida
    if (pesoParaConfirmar !== null) {
      if (!mesmoPeso(peso, pesoParaConfirmar)) setPesoParaConfirmar(null);
      return;
    }

    if (pesoIgnorado.current !== null) {
      if (mesmoPeso(peso, pesoIgnorado.current)) return;
      pesoIgnorado.current = null;
    }

    const temporizador = setTimeout(() => setPesoParaConfirmar(peso), TEMPO_PARA_ESTABILIZAR_MS);
    return () => clearTimeout(temporizador);
  }, [peso, campoAtivo, pesoParaConfirmar]);

  const confirmarPeso = () => {
    preencherCampo(campoAtivo, paraTexto(pesoParaConfirmar));
    pesoIgnorado.current = pesoParaConfirmar;
    setPesoParaConfirmar(null);
    setCampoAtivo(proximoCampoVazio(campoAtivo));
  };

  const recusarPeso = () => {
    pesoIgnorado.current = pesoParaConfirmar;
    setPesoParaConfirmar(null);
  };

  const lerBalancaNoCampo = (campo) => {
    pesoIgnorado.current = null;
    setPesoParaConfirmar(null);
    preencherCampo(campo, '');
    setCampoAtivo(campo);
  };

  const digitarNoCampo = (campo) => {
    if (campoAtivo !== campo) return;
    setPesoParaConfirmar(null);
    setCampoAtivo(null);
  };

  const alternarCampo = (campo) => (campoAtivo === campo ? digitarNoCampo(campo) : lerBalancaNoCampo(campo));

  return { campoAtivo, pesoParaConfirmar, confirmarPeso, recusarPeso, alternarCampo, digitarNoCampo };
}
