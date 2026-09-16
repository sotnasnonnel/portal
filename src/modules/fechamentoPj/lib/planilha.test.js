import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lerFolha, eventosDeDesconto, casarLinhas, lerOrganograma, rateiosPorNome, sugerirPrestador, lerBradesco, beneficioDasVidas,
} from './planilha.js';
import { cpfValido, cnpjValido, codigoRmCentroCusto, paraNumero, competenciaParaIso, proximaCompetencia } from './formato.js';

const CAB = ['Nome Completo', 'Tomador de Serviço', 'Período', 'Valor Bruto', 'Plano de Saúde Dependente',
  'Coparticipação Titular', 'Coparticipação Dependente', 'Previdência Privada', 'Total Descontos',
  'Valor Líquido para emissão da Nota Fiscal', 'CNPJ', 'Razão Social', 'CNPJ'];

const folha = (linhas) => [{ nome: 'Resumo', linhas: [['x']] }, { nome: 'EMISSÃO NF', linhas: [['LIQUIDO PJ'], CAB, ...linhas] }];

test('lê a aba EMISSÃO NF, usa a última coluna CNPJ e soma coparticipação num evento só', () => {
  const r = lerFolha(folha([
    ['Fulana de Tal', 'PHD Assessoria', '08/2026', 'R$ 10.000,00', 300, 20, 30, 0, 350, 9650, '00.000.000/0001-00', 'FULANA LTDA', '11.222.333/0001-81'],
    ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  ]));
  assert.equal(r.aba, 'EMISSÃO NF');
  assert.equal(r.competencia, '2026-08-01');
  assert.equal(r.linhas.length, 1);
  const l = r.linhas[0];
  assert.equal(l.bruto, 10000);
  assert.equal(l.cnpj, '11.222.333/0001-81');
  assert.equal(l.soma_colunas, 350);
  const eventos = eventosDeDesconto(l, 'teste');
  assert.deepEqual(eventos.map((e) => [e.codigo, e.valor]), [['2001', 300], ['2002', 50]]);
});

test('sem aba reconhecível dá erro claro', () => {
  assert.throws(() => lerFolha([{ nome: 'X', linhas: [['a', 'b']] }]), /EMISSÃO NF/);
});

test('casamento por CNPJ, depois CPF, depois nome — e sem casar duas linhas no mesmo prestador', () => {
  const prestadores = [
    { id: 1, nome: 'JOSÉ DA SILVA', cnpj: '11.222.333/0001-81', cpf: '' },
    { id: 2, nome: 'MARIA SOUZA', cnpj: '', cpf: '529.982.247-25' },
    { id: 3, nome: 'ANA LIMA', cnpj: '', cpf: '' },
  ];
  const r = casarLinhas([
    { linha: 3, nome: 'Outro Nome', cnpj: '11222333000181' },
    { linha: 4, nome: 'M. Souza', cpf: '52998224725' },
    { linha: 5, nome: 'Ana  Lima' },
    { linha: 6, nome: 'Jose da Silva' },
    { linha: 7, nome: 'Novo' },
  ], prestadores);
  assert.deepEqual(r.map((x) => x.criterio), ['CNPJ', 'CPF', 'Nome', null, null]);
  assert.match(r[3].conflito, /linha 3/);
  assert.equal(r[4].prestador, null);
});

test('organograma: de-para do CCCOD em aba separada e alocação normalizada', () => {
  const abas = [
    { nome: 'Planilha1', linhas: [['Nome Completo', 'COD CT', 'Alocação'], ['Fulano', 'CORP>MKT', 0.5], ['Fulano', 'AURA-CT03', '0,5'], ['Beltrano', 'CORP>RH', 1]] },
    { nome: 'CC', linhas: [['COD CT', 'CCCOD'], ['CORP>MKT', 3000050100], ['AURA-CT03', '1.040.030102'], ['CORP>RH', '']] },
  ];
  const r = lerOrganograma(abas, 'org.xlsx');
  assert.equal(r.linhas.length, 3);
  const cc = Object.fromEntries(r.centros.map((c) => [c.cod_ct, c.codigo_rm]));
  assert.deepEqual(cc, { 'CORP>MKT': '3.000.050100', 'AURA-CT03': '1.040.030102', 'CORP>RH': null });
  const grupos = rateiosPorNome(r.linhas);
  assert.deepEqual(grupos.find((g) => g.chave === 'FULANO').itens.map((i) => i.percentual), [50, 50]);
});

test('sugestão de nome parecido', () => {
  const s = sugerirPrestador('JOAO PEDRO ALVES', [{ id: 1, nome: 'JOÃO PEDRO ALVES SANTOS' }, { id: 2, nome: 'PEDRO LIMA' }]);
  assert.equal(s.prestador.id, 1);
});

test('conferência Bradesco liga dependente ao titular pelo certificado', () => {
  const liquido = folha([['Titular Um', 'PHD', '08/2026', 5000, 0, 0, 0, 0, 0, 5000, '', '', '']]);
  const conferencia = [{ nome: 'Consolidada Planilha Fopag', linhas: [
    ['Titular', 'Dependente', 'Titularidade', 'Valor'],
    ['Titular Um', '', 'Titular', 400],
    ['Titular Um', 'Filha Um', 'Dependente', 200],
    ['Titular Um', 'Filho Errado', 'Dependente', 200],
    ['Fora da Folha', '', 'Titular', 999],
  ] }];
  const baseAtivos = [{ nome: 'Base', linhas: [
    ['Nome', 'Titularidade', 'Certificado', 'CPF', 'Plano'],
    ['Titular Um', 'TITULAR', '0000206/00', '1', 'TREN'],
    ['Filha Um', 'DEPENDENTE', '0000206/01', '2', 'TREN'],
    ['Filho Errado', 'DEPENDENTE', '0000999/01', '3', 'TREN'],
    ['Outro Titular', 'TITULAR', '0000999/00', '4', 'TREN'],
  ] }];
  const r = lerBradesco({ liquido, conferencia, baseAtivos });
  assert.equal(r.vidas.length, 3);
  assert.deepEqual(r.vidas.map((v) => v.conferencia), ['Dados localizados', 'Dados localizados', 'Vínculo divergente']);
  const b = beneficioDasVidas(r.porTitular.get('TITULAR UM'), 'teste', '2026-08-01');
  assert.equal(b.medico.valor, 800);
  assert.equal(b.dependentes.length, 2);
});

test('formatos: documentos, código RM, números e competência', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('111.111.111-11'), false);
  assert.equal(cnpjValido('11.222.333/0001-81'), true);
  assert.equal(cnpjValido('11.222.333/0001-82'), false);
  assert.equal(codigoRmCentroCusto('1004100102'), '1.004.100102');
  assert.equal(codigoRmCentroCusto('1004100102.0'), '1.004.100102');
  assert.equal(codigoRmCentroCusto('CORP>MKT'), '');
  assert.equal(paraNumero('R$ 1.234,56'), 1234.56);
  assert.equal(paraNumero('1234.56'), 1234.56);
  assert.equal(competenciaParaIso('13/2026'), null);
  assert.equal(proximaCompetencia('2026-12-01'), '2027-01-01');
});
