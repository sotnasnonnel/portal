import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classificar, dataPorExtenso, lerCartaoCnpj, lerCpf, lerContrato, lerComprovanteEndereco,
  lerCertidaoNascimento, nomeDaPasta, analisarPasta, diferencas,
} from './documentos.js';

// Trechos reais das pastas que o RH manda, encurtados no que não é lido.

const CARTAO_CNPJ = `REPÚBLICA FEDERATIVA DO BRASIL CADASTRO NACIONAL DA PESSOA JURÍDICA
NÚMERO DE INSCRIÇÃO 68.712.216/0001-13 MATRIZ COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL
DATA DE ABERTURA 20/08/2026 NOME EMPRESARIAL STAFF TECNOLOGIA E TREINAMENTO LTDA
TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA) STAFF TECNOLOGIA E TREINAMENTO PORTE ME
LOGRADOURO R DOS MILAGRES NÚMERO 16 COMPLEMENTO TERREO CEP 45.576-125
BAIRRO/DISTRITO DOIS DE DEZEMBRO MUNICÍPIO IPIAU UF BA
ENDEREÇO ELETRÔNICO NOVACONT.IPIAU@GMAIL.COM TELEFONE (73) 8109-4540 SITUAÇÃO CADASTRAL ATIVA`;

const COMPROVANTE_CPF = `Cadastro de Pessoa Física (CPF) - Receita Federal QR CODE República Federativa do Brasil
CPF 029.198.015-54 Nome ANDERSON NONATO DOS SANTOS Nascimento 07/05/1986 REGULAR
Este documento digital não pode ser utilizado como documento de identificação.`;

const CONTRATO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ESPECIALIZADOS Figuram como Partes:
A) PHD ASSESSORIA EM GESTAO LTDA , pessoa jurídica de direito privado, inscrita no CNPJ nº 45.420.053/0001-08,
a seguir denominada "CONTRATANTE"; e B) STAFF TECNOLOGIA E TREINAMENTO LTDA empresário individual, inscrito no
CNPJ sob o nº 68.712.216/0001-13, com sede na Rua dos Milagres, 16, por intermédio da sua titular, com endereço
de e-mail contato.stafftecnologia@outlook.com , a seguir denominada "CONTRATADA".
CLÁUSULA SEGUNDA – DA VIGÊNCIA Por expresso acordo entre as Partes, o presente Contrato terá o prazo de
36 (trinta e seis) meses contados à partir de 20/08/2026 , a ser renovado por meio de aditivo contratual.
CLÁUSULA TERCEIRA – DA CONTRAPRESTAÇÃO A contraprestação pelos serviços prestados será no valor fixo de
R$ 17.396,56 (dezessete mil trezentos e noventa e seis reais e cinquenta e seis centavos) mensais.`;

const CONTA_AGUA = `Empresa Baiana de Águas e Saneamento S/A CNPJ: 13.504.675/0001-10
Nome ANDERSON NONATO DOS SANTOS CPF/CNPJ 029.198.015-54
RU DOS MILAGRES,00016 - 2 DE DEZEMBRO IPIAU - BA - BRASIL - CEP 45576-125 Data Vencimento 10/09/2026`;

const CERTIDAO = `Nome ANA LIZ LOPES NONATO Matrícula 136572 01 55 2025 1 00003 Número do CPF 136.356.665-21
CERTIDÃO DE NASCIMENTO Data de nascimento Seis de agosto de dois mil e vinte e cinco Dia 08 10:00 horas
Horário de nascimento Ipiaú Município da naturalidade 06 2025 Mês Ano BA UF Feminino Sexo
Nome do(a) Genitor(a) Município de nascimento Ana Carol Santos Lopes Ipiaú BA UF
Avô(ó)(s) respectivo(s) André Tomés Lopes; Gilmara Souza Santos
Genitor(a) Anderson Nonato dos Santos Município de nascimento Canavieiras UF BA
Avô(ó)(s) respectivo(s) Ademir Queiroz dos Santos; Maria Suely Nonato dos Santos`;

test('classifica pelo nome do arquivo, com a ordem certa nos casos ambíguos', () => {
  assert.equal(classificar('p/00.Contrato PJ - Anderson pdf-D4Sign.pdf'), 'Contrato');
  assert.equal(classificar('p/2.CONTRATO SOCIAL - STAFF.pdf'), 'Contrato social');
  // "CTPSContratosDigitais" tem "Contratos" no meio e não pode virar Contrato.
  assert.equal(classificar('p/6-CTPSContratosDigitais_029.198.015-54.pdf'), 'CTPS');
  // "Conta bancária CNPJ" é banco, não cartão CNPJ.
  assert.equal(classificar('p/3.Conta bancária CNPJ.pdf'), 'Dados bancários');
  assert.equal(classificar('p/1.CARTÃO CNPJ - STAFF.pdf'), 'Cartão CNPJ');
  // "RG e CPF" é RG.
  assert.equal(classificar('p/11-RG e CPF-DIGITAL Conjugue - Ana Carol.pdf'), 'RG');
  assert.equal(classificar('p/7-CPF.pdf'), 'CPF');
  assert.equal(classificar('p/10-Comprovante de Residencia.pdf'), 'Comprovante de endereço');
  assert.equal(classificar('p/12-Certidão de Nascimento - Ana Liz.PDF'), 'Certidão de nascimento');
  assert.equal(classificar('p/11-União Estável_Anderson x Ana Carol.pdf'), 'Certidão de casamento');
  assert.equal(classificar('p/qualquer coisa.pdf'), 'Outros');
});

test('data por extenso da certidão', () => {
  assert.equal(dataPorExtenso('Seis de agosto de dois mil e vinte e cinco'), '2025-08-06');
  assert.equal(dataPorExtenso('Vinte e cinco de dezembro de dois mil e dois'), '2002-12-25');
  assert.equal(dataPorExtenso('Primeiro de janeiro de dois mil'), '2000-01-01');
  assert.equal(dataPorExtenso('qualquer coisa'), null);
});

test('data por extenso para no fim do ano, sem comer o resto da certidão', () => {
  // 'Dia'/'horas' vêm logo depois e não podem somar ao ano.
  assert.equal(dataPorExtenso('Seis de agosto de dois mil e vinte e cinco Dia 08 10:00 horas'), '2025-08-06');
});

test('cartão CNPJ: o NÚMERO lido é o do endereço, não o da inscrição', () => {
  const r = lerCartaoCnpj(CARTAO_CNPJ);
  assert.equal(r.cnpj, '68712216000113');
  assert.equal(r.razao_social, 'STAFF TECNOLOGIA E TREINAMENTO LTDA');
  assert.equal(r.logradouro, 'R DOS MILAGRES');
  assert.equal(r.numero, '16');
  assert.equal(r.complemento, 'TERREO');
  assert.equal(r.cep, '45576125');
  assert.equal(r.bairro, 'DOIS DE DEZEMBRO');
  assert.equal(r.municipio, 'IPIAU');
  assert.equal(r.uf, 'BA');
});

test('comprovante de CPF traz nome, CPF e nascimento', () => {
  assert.deepEqual(lerCpf(COMPROVANTE_CPF), {
    cpf: '02919801554', nome: 'ANDERSON NONATO DOS SANTOS', data_nascimento: '1986-05-07',
  });
});

test('contrato: início vem da vigência e o valor da contraprestação', () => {
  const r = lerContrato(CONTRATO);
  assert.equal(r.data_inicio, '2026-08-20');
  assert.equal(r.origem_data, 'Vigência do contrato');
  assert.equal(r.valor_mensal, 17396.56);
  // O CNPJ é o da CONTRATADA; o da PHD aparece antes e não pode vencer.
  assert.equal(r.cnpj, '68712216000113');
  assert.equal(r.email, 'contato.stafftecnologia@outlook.com');
});

test('comprovante de endereço lê a linha da ligação', () => {
  // Bairro e município ficam de fora de propósito: na conta eles vêm colados
  // ('2 DE DEZEMBRO IPIAU') e separá-los seria adivinhação.
  assert.deepEqual(lerComprovanteEndereco(CONTA_AGUA), {
    logradouro: 'RU DOS MILAGRES', numero: '16', uf: 'BA', cep: '45576125',
  });
  assert.equal(lerComprovanteEndereco('conta sem endereço nenhum'), null);
});

test('certidão de nascimento: registrado, CPF, data e genitores', () => {
  const r = lerCertidaoNascimento(CERTIDAO);
  assert.equal(r.nome, 'ANA LIZ LOPES NONATO');
  assert.equal(r.cpf, '13635666521');
  assert.equal(r.nascimento, '2025-08-06');
  assert.equal(r.sexo, 'Feminino');
  assert.ok(r.genitores.some((g) => g.includes('Anderson Nonato dos Santos')));
});

test('nome do prestador sai da pasta raiz do ZIP', () => {
  assert.equal(nomeDaPasta(['Anderson Nonato dos Santos/7-CPF.pdf'], 'x.zip'), 'Anderson Nonato dos Santos');
  assert.equal(nomeDaPasta(['7-CPF.pdf'], 'Maria Silva.zip'), 'Maria Silva');
});

const PASTA = [
  { caminho: 'Anderson Nonato dos Santos/7-CPF.pdf', texto: COMPROVANTE_CPF },
  { caminho: 'Anderson Nonato dos Santos/00.Contrato PJ - Anderson pdf-D4Sign.pdf', texto: CONTRATO },
  { caminho: 'Anderson Nonato dos Santos/1.CARTÃO CNPJ - STAFF.pdf', texto: CARTAO_CNPJ },
  { caminho: 'Anderson Nonato dos Santos/10-Comprovante de Residencia.pdf', texto: CONTA_AGUA },
  { caminho: 'Anderson Nonato dos Santos/12-Certidão de Nascimento - Ana Liz Lopes Nonato.PDF', texto: CERTIDAO },
  { caminho: 'Anderson Nonato dos Santos/12-Certidão de Nascimento - Layne Borges_Filha.pdf', texto: '' },
  { caminho: 'Anderson Nonato dos Santos/11-União Estável_Anderson x Ana Carol.pdf', texto: '' },
  { caminho: 'Anderson Nonato dos Santos/3.Conta bancária CNPJ.pdf', texto: '' },
];

test('a pasta inteira vira uma conferência com campo, fonte e dependentes', () => {
  const r = analisarPasta(PASTA, 'Anderson Nonato dos Santos.zip');
  assert.equal(r.nome, 'ANDERSON NONATO DOS SANTOS');
  assert.equal(r.podeConfirmar, true);
  assert.equal(r.perfil.cpf, '02919801554');
  assert.equal(r.perfil.data_inicio, '2026-08-20');
  assert.equal(r.perfil.valor_mensal, 17396.56);
  assert.equal(r.perfil.cep, '45576125');
  // Todo campo diz de qual arquivo veio.
  assert.ok(r.campos.every((c) => c.fonte && c.rotulo));
  assert.equal(r.campos.find((c) => c.campo === 'cpf').fonte, '7-CPF.pdf');
});

test('dependente com certidão lida é confirmado; digitalizado fica para revisão', () => {
  const r = analisarPasta(PASTA, 'Anderson Nonato dos Santos.zip');
  const anaLiz = r.dependentes.find((d) => d.nome === 'ANA LIZ LOPES NONATO');
  assert.equal(anaLiz.parentesco, 'Filha');
  assert.equal(anaLiz.cpf, '13635666521');
  assert.equal(anaLiz.nascimento, '2025-08-06');
  // O titular consta como genitor, então a filiação está provada pela certidão.
  assert.equal(anaLiz.situacao, 'Dados localizados');

  const layne = r.dependentes.find((d) => d.nome === 'Layne Borges');
  assert.equal(layne.parentesco, 'Filho(a)');
  assert.match(layne.situacao, /Revisar/);

  const conjuge = r.dependentes.find((d) => d.parentesco === 'Cônjuge');
  assert.equal(conjuge.nome, 'Ana Carol');
});

test('o titular nunca entra como dependente de si mesmo', () => {
  const r = analisarPasta(PASTA, 'Anderson Nonato dos Santos.zip');
  assert.ok(!r.dependentes.some((d) => /ANDERSON/i.test(d.nome)));
});

test('pasta só com digitalizações não libera a confirmação', () => {
  const r = analisarPasta([
    { caminho: 'Fulano de Tal/4-RG.pdf', texto: '' },
    { caminho: 'Fulano de Tal/00.Contrato PJ.pdf', texto: '' },
  ], 'Fulano de Tal.zip');
  assert.equal(r.nome, 'Fulano de Tal');
  assert.equal(r.podeConfirmar, false);
  assert.ok(r.avisos.length > 0);
});

test('diferenças comparam o lido com o cadastro atual', () => {
  const perfil = { cpf: '02919801554', municipio: 'IPIAU', valor_mensal: 17396.56 };
  const d = diferencas(perfil, { cpf: '02919801554', municipio: 'SALVADOR', valor_mensal: null });
  assert.equal(d.length, 2);
  assert.deepEqual(d.map((x) => x.campo).sort(), ['municipio', 'valor_mensal']);
  assert.equal(diferencas(perfil, null).length, 0);
});
