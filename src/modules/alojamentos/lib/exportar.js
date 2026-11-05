import {
  alojs, byId, vagas, staysOn, invest, custoFixo, temCustoFixo, fdate, num, isOn, quartoNome, daysBetween,
  compLabel, totalItem, todayISO, STATUS, CHAVE, PAG_ST,
} from './regras.js';

const nv = (v) => (num(v) === null ? '' : +num(v).toFixed(2));

/** As abas da planilha exportada. Mesmas do protótipo, sem os acessos. */
export function montarAbas(base, hoje = todayISO()) {
  const nm = (id) => byId(base, id)?.nome || id;
  const comAloj = (lista) => lista.filter((x) => byId(base, x.alojamento_id));
  const txt = (a, b) => String(a ?? '').localeCompare(String(b ?? ''));

  return {
    Alojamentos: alojs(base).map((a) => ({
      Alojamento: a.nome,
      Sigla: a.sigla,
      'Situação': STATUS[a.status]?.l,
      Tipo: a.tipo,
      Cidade: a.cidade,
      UF: a.uf,
      'País': a.pais,
      'Endereço': a.endereco,
      CEP: a.cep,
      'Composição': a.composicao,
      Quartos: (a.quartos || []).length,
      Vagas: vagas(a),
      'Moradores atuais': staysOn(base, a.id, hoje).length,
      'Locatário (CNPJ)': a.cnpj_locacao,
      'Centro de custo': a.centro_custo,
      Gerente: a.gerente,
      Projeto: a.projeto,
      'Proprietário': a.proprietario_nome,
      'Tel. proprietário': a.proprietario_telefone,
      'E-mail proprietário': a.proprietario_email,
      'Imobiliária': a.imobiliaria_nome,
      'Tel. imobiliária': a.imobiliaria_telefone,
      'E-mail imobiliária': a.imobiliaria_email,
      'Aluguel (R$)': nv(a.aluguel_valor),
      'Venc. aluguel (dia)': a.aluguel_vencimento,
      'Cobrança aluguel': a.aluguel_cobranca,
      'Condomínio': a.condominio_nome,
      'Condomínio (R$)': nv(a.condominio_valor),
      'Cobrança condomínio': a.condominio_cobranca,
      'IPTU (R$)': nv(a.iptu),
      'Caução (R$)': nv(a.caucao),
      'Custo fixo mensal (R$)': temCustoFixo(a) ? +custoFixo(a).toFixed(2) : '',
      'Síndico': a.sindico_nome,
      'Tel. síndico': a.sindico_telefone,
      Diarista: a.diarista_nome,
      'Tel. diarista': a.diarista_telefone,
      'Diária (R$)': nv(a.diarista_valor),
      'Frequência diarista': a.diarista_intervalo,
      'Vagas garagem': a.garagem_vagas ?? '',
      'Usuários garagem': a.garagem_usuarios,
      'Início contrato': fdate(a.contrato_inicio),
      'Fim contrato': fdate(a.contrato_fim),
      Prazo: a.contrato_prazo,
      'Prorrogação automática': a.contrato_renovacao_automatica ? 'Sim' : 'Não',
      'Cláusulas': a.contrato_observacao,
      'Entrega prevista': fdate(a.encerramento_previsto),
      'Devolução': fdate(a.devolucao_data),
      'Contas controladas': (a.contas_controladas || []).join(', '),
      'Pendências abertas': (a.pendencias || []).filter((p) => !p.feito).map((p) => p.texto).join(' | '),
      'Investimento mobiliário (R$)': +invest(base, a.id).toFixed(2),
      'Observações': a.observacoes,
    })),
    'Contas de consumo': alojs(base).flatMap((a) => (a.contas || []).map((c) => ({
      Alojamento: a.nome,
      Conta: c.tipo,
      Fornecedor: c.fornecedor,
      'UC / cód. cliente': c.codigo,
      'Cobrança': c.cobranca,
      'Vencimento (dia)': c.vencimento,
      'Situação': c.status === 'cancelada' ? 'Cancelada' : 'Ativa',
      'Observação': c.obs,
    }))),
    'Ocupação': comAloj(base.estadias)
      .sort((x, y) => nm(x.alojamento_id).localeCompare(nm(y.alojamento_id)) || txt(x.entrada, y.entrada))
      .map((e) => ({
        Alojamento: nm(e.alojamento_id),
        Quarto: quartoNome(byId(base, e.alojamento_id), e),
        Morador: e.morador,
        Entrada: fdate(e.entrada),
        'Saída': fdate(e.saida),
        'Situação': isOn(e, hoje) ? 'Morando' : 'Saiu',
        'Saída prevista': fdate(e.saida_prevista),
        Dias: e.entrada ? daysBetween(e.entrada, e.saida || hoje) : '',
        Chave: CHAVE[e.chave]?.l,
        'Obs. chave': e.chave_obs,
        'Observações': e.obs,
      })),
    Pagamentos: comAloj(base.pagamentos)
      .sort((x, y) => txt(x.competencia, y.competencia) || nm(x.alojamento_id).localeCompare(nm(y.alojamento_id)))
      .map((p) => ({
        'Competência': compLabel(p.competencia),
        Alojamento: nm(p.alojamento_id),
        Conta: p.conta,
        'Valor (R$)': nv(p.valor),
        Vencimento: fdate(p.vencimento),
        'Data pagamento': fdate(p.data_pagamento),
        'Situação': PAG_ST[p.status]?.l,
        Forma: p.forma,
        'Observação': p.obs,
      })),
    'Mobiliário': comAloj(base.itens)
      .sort((x, y) => nm(x.alojamento_id).localeCompare(nm(y.alojamento_id)))
      .map((i) => ({
        Alojamento: nm(i.alojamento_id),
        Produto: i.produto,
        Quantidade: +i.quantidade || 0,
        'Preço unitário (R$)': nv(i.preco_unitario),
        'Total (R$)': +totalItem(i).toFixed(2),
        Fornecedor: i.fornecedor,
        'Data compra': fdate(i.data_compra),
        Destino: i.destino,
        'Observação': i.obs,
      })),
    'Ocorrências': comAloj(base.ocorrencias)
      .sort((x, y) => txt(x.data, y.data))
      .map((o) => ({
        Data: fdate(o.data),
        Alojamento: nm(o.alojamento_id),
        Tipo: o.tipo,
        'Descrição': o.descricao,
      })),
  };
}

/** Só carrega a biblioteca quando a pessoa pede a planilha. */
export async function exportarXlsx(base) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  Object.entries(montarAbas(base)).forEach(([nome, linhas]) => {
    const ws = XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ 'Sem registros': '' }]);
    const chaves = Object.keys(linhas[0] || { 'Sem registros': '' });
    ws['!cols'] = chaves.map((k) => ({
      wch: Math.min(48, Math.max(k.length + 2, ...linhas.map((r) => String(r[k] ?? '').length + 1))),
    }));
    XLSX.utils.book_append_sheet(wb, ws, nome);
  });
  XLSX.writeFile(wb, `PHD_Alojamentos_${todayISO()}.xlsx`);
}
