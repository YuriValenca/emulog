import { LOGO_EMULOG } from './assets/logoEmulog';
import { formatarDataHora } from './helpers/datas';
import { kgPreenchido, formatarKg as formatarNumero } from './helpers/numeros';
import { pesagemConcluida, formatarHoraPesagem } from './helpers/pesagem';
import { somarCargasReais } from './helpers/furos';

export const temInformacoesDaOperacao = (info) =>
  !!info && !!(
    info.numeroNF?.trim()
    || kgPreenchido(info.kgPrevisto)
    || kgPreenchido(info.kgAplicado)
    || info.caminhao
    || info.equipe?.length > 0
    || info.informacoesGerais?.trim()
  );

const estilos = (cor) => `
  @page { margin: 13mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; }
  table.pagina { width: 100%; border-collapse: collapse; margin: 0; }
  table.pagina > tbody > tr > td, table.pagina > tfoot > tr > td { border: none; padding: 0; }
  .espaco-rodape { height: 28px; }
  .rodape {
    position: fixed; bottom: 0; left: 0; right: 0;
    border-top: 3px solid ${cor}; padding-top: 4px; background: #fff;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 8px; color: #888;
  }
  .rodape-marca { display: flex; align-items: center; gap: 4px; font-weight: bold; color: #555; }
  .rodape-marca img { height: 12px; }
  h1 { color: #333; }
  .header-container {
    display: flex;
    align-items: flex-start;
    border-bottom: 3px solid ${cor};
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .logo { height: 48px; width: auto; max-width: 180px; object-fit: contain; margin-bottom: 0; }
  .project-details { margin-left: 20px; flex: 1; }
  .project-details h1 { font-size: 16px; margin: 0 0 6px 0; color: #222; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
  th { background-color: #f2f2f2; }
  .amostra-container { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .amostra-box { width: 48%; border: 1px solid #ccc; padding: 10px; }
  .amostra-header { background-color: #f2f2f2; padding: 5px; font-weight: bold; margin-bottom: 10px; }
  .pesagem-row { margin-bottom: 5px; }
  .content-box {
    border: 2px solid ${cor};
    padding: 10px;
    border-radius: 5px;
    color: black;
    margin-top: 20px;
  }
  .content-box h2 { color: ${cor}; margin: 0 0 6px 0; font-size: 12px; }
  .informacoesGerais-box { border: 1px solid #ccc; padding: 10px; margin-top: 20px; }
  .informacoesGerais-header { background-color: #f2f2f2; padding: 5px; font-weight: bold; }
  .info-box { border: 1px solid #ccc; padding: 10px; margin-top: 20px; }
  .info-header { background-color: ${cor}; color: #fff; padding: 6px 10px; font-weight: bold; }
  .tabela-furos { margin-top: 8px; }
  .tabela-furos th, .tabela-furos td { padding: 4px 6px; text-align: center; }
  .tabela-furos th { background-color: ${cor}; color: #fff; }
  .tabela-furos tr { page-break-inside: avoid; break-inside: avoid; }
  .fotos-grade { display: flex; flex-wrap: wrap; justify-content: space-between; }
  .foto { width: 48%; margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid; }
  .foto img { box-sizing: border-box; width: 100%; max-height: 320px; object-fit: contain; border: 1px solid #ddd; }
  .foto p { margin: 4px 0 0 0; text-align: center; color: #555; }
  .section-title {
    font-size: 13px;
    font-weight: bold;
    color: ${cor};
    margin: 20px 0 8px 0;
    border-left: 4px solid ${cor};
    padding-left: 8px;
    page-break-after: avoid;
    break-after: avoid;
  }
`;

const cabecalhoDoProjeto = (projeto, logoEmpresa) => `
  <div class="header-container">
    <img src="${logoEmpresa}" class="logo" alt="Logo" />
    <div class="project-details">
      <h1>Projeto: ${projeto.nomeProjeto}</h1>
      ${projeto.cliente ? `<p style="margin: 0; color: #555;"><strong>Cliente:</strong> ${projeto.cliente.nome}</p>` : ''}
      <p style="margin: 4px 0 0 0; color: #555;"><strong>Data de Criação:</strong> ${projeto.dataCriacao}</p>
      ${projeto.dataConclusao ? `<p style="margin: 4px 0 0 0; color: #555;"><strong>Data de Conclusão:</strong> ${projeto.dataConclusao}</p>` : ''}
      <p style="margin: 4px 0 0 0; color: #555;">
        <strong>Calibragem:</strong>
        Tara ${projeto.calibragem?.tara || '—'} ·
        Peso Cheio ${projeto.calibragem?.pesoCheio || '—'} ·
        ${projeto.calibragemVencida ? '<span style="color:#D32F2F">Necessita recalibrar</span>' : '<span style="color:#4CAF50">OK</span>'}
      </p>
    </div>
  </div>`;

// O rodapé é fixo e se repete em toda página; o tfoot vazio da tabela também se repete e reserva o espaço dele,
// senão o conteúdo passaria por baixo do rodapé
const documento = ({ cor, projeto, logoEmpresa, conteudo }) => `
  <html>
    <head>
      <meta charset="UTF-8">
      <style>${estilos(cor)}</style>
    </head>
    <body>
      <div class="rodape">
        <span class="rodape-marca"><img src="${LOGO_EMULOG}" /> Emulog</span>
        <span>Gerado em ${formatarDataHora(new Date())}</span>
      </div>
      <table class="pagina"><tbody><tr><td>
        ${cabecalhoDoProjeto(projeto, logoEmpresa)}
        ${conteudo}
      </td></tr></tbody>
      <tfoot><tr><td><div class="espaco-rodape"></div></td></tr></tfoot></table>
    </body>
  </html>`;

const informacoesDaOperacao = (info) => (temInformacoesDaOperacao(info) ? `
  <div class="info-box">
    <div class="info-header">Informações da Operação</div>
    <table>
      <tbody>
        ${info.numeroNF ? `<tr><td><strong>Nota Fiscal</strong></td><td>${info.numeroNF}</td></tr>` : ''}
        ${kgPreenchido(info.kgPrevisto) ? `<tr><td><strong>Kg Previsto</strong></td><td>${formatarNumero(info.kgPrevisto)} kg</td></tr>` : ''}
        ${kgPreenchido(info.kgAplicado) ? `<tr><td><strong>Kg Aplicado</strong></td><td>${formatarNumero(info.kgAplicado)} kg</td></tr>` : ''}
        ${info.caminhao ? `<tr><td><strong>Unidade de Bombeamento</strong></td><td>${info.caminhao.placa || ''}</td></tr>` : ''}
        ${info.equipe?.length > 0 ? `<tr><td><strong>Equipe</strong></td><td>${info.equipe.map(m => m.nome).join(', ')}</td></tr>` : ''}
      </tbody>
    </table>
  </div>` : '');

const observacaoTecnica = () => `
  <div class="content-box">
    <h2>Observação Técnica:</h2>
    <p>A 4ª pesagem de cada amostra deve estar com densidade na faixa de trabalho que vai de 1.00 a 1.10 g/cm³. Amostras fora da faixa devem ser informadas ao setor técnico da empresa.</p>
  </div>`;

const observacaoDoProjeto = (texto) => (texto ? `
  <div class="informacoesGerais-box">
    <div class="informacoesGerais-header">Observação sobre o projeto</div>
    <p>${texto}</p>
  </div>` : '');

const amostras = (lista) => lista.map((amostra, index) => {
  const pesagensValidas = (amostra.pesagens || []).filter(pesagemConcluida);
  return `
    ${index % 2 === 0 ? '<div class="amostra-container">' : ''}
    <div class="amostra-box">
      <div class="amostra-header">Amostra ${amostra.amostraId + 1}</div>
      ${pesagensValidas.map((p, i) => `
        <div class="pesagem-row">
          <strong>Pesagem ${i + 1}</strong>: ${p.peso} g, ${p.densidade} g/cm³, ${formatarHoraPesagem(p.timestamp)}
        </div>`).join('')}
    </div>
    ${index % 2 === 1 || index === lista.length - 1 ? '</div>' : ''}`;
}).join('');

const registroFotografico = (fotos) => `
  <p class="section-title">Registro fotográfico — ${fotos.length} foto${fotos.length !== 1 ? 's' : ''}</p>
  <div class="fotos-grade">
    ${fotos.map((foto, i) => `<div class="foto"><img src="${foto}" /><p>Foto ${i + 1}</p></div>`).join('')}
  </div>`;

export const montarRelatorioDoFogo = ({ projeto, logoEmpresa, cor, fotos, mostrarObservacaoTecnica }) =>
  documento({
    cor, projeto, logoEmpresa,
    conteudo: `
      ${informacoesDaOperacao(projeto.informacoesOperacao)}
      ${mostrarObservacaoTecnica ? observacaoTecnica() : ''}
      ${observacaoDoProjeto(projeto.informacoesOperacao?.informacoesGerais)}
      <p class="section-title">Amostras — quantidade: ${projeto.quantidadeAmostras}</p>
      ${Array.isArray(projeto.amostras) ? amostras(projeto.amostras) : '<p>Nenhuma amostra disponível</p>'}
      ${fotos.length ? registroFotografico(fotos) : ''}`,
  });

const resumoDosFuros = (furos) => {
  const quantidade = furos.itens.length;
  return `
    <div class="info-box">
      <div class="info-header">Resumo dos furos</div>
      <table>
        <tbody>
          <tr><td><strong>Quantidade de furos</strong></td><td>${quantidade}</td></tr>
          <tr><td><strong>Profundidade prevista</strong></td><td>${formatarNumero(furos.profundidadePrevista)} m</td></tr>
          <tr><td><strong>Carga prevista por furo</strong></td><td>${formatarNumero(furos.cargaPrevista)} kg</td></tr>
          <tr><td><strong>Total previsto</strong></td><td>${formatarNumero(quantidade * furos.cargaPrevista)} kg</td></tr>
          <tr><td><strong>Total aplicado real</strong></td><td>${formatarNumero(somarCargasReais(furos.itens))} kg</td></tr>
        </tbody>
      </table>
    </div>`;
};

const tabelaDeFuros = (furos) => `
  <p class="section-title">Furos</p>
  <table class="tabela-furos">
    <thead>
      <tr>
        <th>Nº do furo</th>
        <th>Prof. prevista (m)</th>
        <th>Prof. real (m)</th>
        <th>Carga prevista (kg)</th>
        <th>Carga real (kg)</th>
      </tr>
    </thead>
    <tbody>
      ${furos.itens.map((furo, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${formatarNumero(furos.profundidadePrevista)}</td>
          <td>${formatarNumero(furo.profundidadeReal)}</td>
          <td>${formatarNumero(furos.cargaPrevista)}</td>
          <td>${formatarNumero(furo.cargaReal)}</td>
        </tr>`).join('')}
    </tbody>
  </table>`;

export const montarRelatorioDeFuros = ({ projeto, logoEmpresa, cor }) =>
  documento({
    cor, projeto, logoEmpresa,
    conteudo: `
      ${resumoDosFuros(projeto.furos)}
      ${observacaoDoProjeto(projeto.informacoesOperacao?.informacoesGerais)}
      ${tabelaDeFuros(projeto.furos)}`,
  });
