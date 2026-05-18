import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ProjetoFormContext = createContext(null);

export function ProjetoFormProvider({ children }) {
  const inicializado = useRef(false);

  const [nomeProjeto, setNomeProjeto] = useState('');
  const [quantidadeAmostras, setQuantidadeAmostras] = useState(1);
  const [amostras, setAmostras] = useState(
    Array.from({ length: 1 }, () =>
      Array.from({ length: 5 }, () => ({ peso: '', densidade: '', timestamp: '' }))
    )
  );
  const [amostraAtual, setAmostraAtual] = useState(0);
  const [pesagemAtual, setPesagemAtual] = useState(1);
  const [peso, setPeso] = useState('');
  const [ultimaCalibragem, setUltimaCalibragem] = useState(null);
  const [uidUsuario, setUidUsuario] = useState(null);

  const [numeroNF, setNumeroNF] = useState('');
  const [kgPrevisto, setKgPrevisto] = useState('');
  const [kgAplicado, setKgAplicado] = useState('');
  const [caminhaoSelecionado, setCaminhaoSelecionado] = useState(null);
  const [equipeSelecionada, setEquipeSelecionada] = useState([]);
  const [informacoesGerais, setInformacoesGerais] = useState('');

  const salvarEstadoDoProjeto = async () => {
    const projeto = {
      nomeProjeto, quantidadeAmostras, amostras,
      amostraAtual, pesagemAtual, peso,
      numeroNF, kgPrevisto, kgAplicado,
      caminhaoSelecionado, equipeSelecionada,
      informacoesGerais,
    };
    try {
      await AsyncStorage.setItem('projetoEmAndamento', JSON.stringify(projeto));
    } catch (error) {
      console.error("Erro ao salvar estado do projeto:", error);
    }
  };

  useEffect(() => {
    if (!inicializado.current) {
      inicializado.current = true;
      return;
    }
    salvarEstadoDoProjeto();
  }, [
    nomeProjeto, quantidadeAmostras, amostras,
    amostraAtual, pesagemAtual, peso,
    numeroNF, kgPrevisto, kgAplicado,
    caminhaoSelecionado, equipeSelecionada,
    informacoesGerais,
  ]);

  const limparEstadoDoProjeto = async () => {
    try {
      await AsyncStorage.removeItem('projetoEmAndamento');
    } catch (error) {
      console.error("Erro ao limpar estado do projeto:", error);
    }
  };

  const resetarFormulario = () => {
    setNomeProjeto('');
    setQuantidadeAmostras(1);
    setAmostras(Array.from({ length: 1 }, () =>
      Array.from({ length: 5 }, () => ({ peso: '', densidade: '', timestamp: '' }))
    ));
    setAmostraAtual(0);
    setPesagemAtual(1);
    setPeso('');
    setNumeroNF('');
    setKgPrevisto('');
    setKgAplicado('');
    setCaminhaoSelecionado(null);
    setEquipeSelecionada([]);
    setInformacoesGerais('');
  };

  const restaurarDoStorage = async () => {
    try {
      const projetoSalvo = await AsyncStorage.getItem('projetoEmAndamento');
      if (!projetoSalvo) return false;

      const projeto = JSON.parse(projetoSalvo);
      setNomeProjeto(projeto.nomeProjeto || '');
      setQuantidadeAmostras(projeto.quantidadeAmostras || 1);
      setAmostraAtual(projeto.amostraAtual || 0);
      setPesagemAtual(projeto.pesagemAtual || 1);
      setPeso(projeto.peso || '');
      setNumeroNF(projeto.numeroNF || '');
      setKgPrevisto(projeto.kgPrevisto || '');
      setKgAplicado(projeto.kgAplicado || '');
      setCaminhaoSelecionado(projeto.caminhaoSelecionado || null);
      setEquipeSelecionada(projeto.equipeSelecionada || []);
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
          novasAmostras = Array.from({ length: projeto.quantidadeAmostras }, () =>
            Array.from({ length: 5 }, () => ({ peso: '', densidade: '', timestamp: '' }))
          );
        }
      } else {
        novasAmostras = Array.from({ length: projeto.quantidadeAmostras }, () =>
          Array.from({ length: 5 }, () => ({ peso: '', densidade: '', timestamp: '' }))
        );
      }

      while (novasAmostras.length < projeto.quantidadeAmostras) {
        novasAmostras.push(Array.from({ length: 5 }, () => ({ peso: '', densidade: '', timestamp: '' })));
      }
      novasAmostras = novasAmostras.map(amostra => {
        if (Array.isArray(amostra)) {
          while (amostra.length < 5) amostra.push({ peso: '', densidade: '', timestamp: '' });
          return amostra;
        }
        return Array.from({ length: 5 }, () => ({ peso: '', densidade: '', timestamp: '' }));
      });

      setAmostras(novasAmostras);
      return true;
    } catch (error) {
      console.error("Erro ao restaurar projeto:", error);
      return false;
    }
  };

  return (
    <ProjetoFormContext.Provider value={{
      nomeProjeto, setNomeProjeto,
      quantidadeAmostras, setQuantidadeAmostras,
      amostras, setAmostras,
      amostraAtual, setAmostraAtual,
      pesagemAtual, setPesagemAtual,
      peso, setPeso,
      ultimaCalibragem, setUltimaCalibragem,
      uidUsuario, setUidUsuario,
      numeroNF, setNumeroNF,
      kgPrevisto, setKgPrevisto,
      kgAplicado, setKgAplicado,
      caminhaoSelecionado, setCaminhaoSelecionado,
      equipeSelecionada, setEquipeSelecionada,
      informacoesGerais, setInformacoesGerais,
      salvarEstadoDoProjeto,
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
