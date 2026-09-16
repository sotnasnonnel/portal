import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Search } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal, Aviso, Moeda } from '../components/ui';
import { lerArquivoXlsx } from '../../lib/arquivos';
import { lerBradesco, beneficioDasVidas } from '../../lib/planilha';
import { normalizar, dataBr, mascararCpf, mascararCnpj, competenciaRotulo } from '../../lib/formato';
import { salvarPrestador, registrarImportacao, auditar } from '../../lib/dados';
import { mesclarDependentes, ROTA_FOLHA } from './comum';
import { Contador, Etapas, Progresso, BadgeVida } from './pecas';

const ARQUIVOS = [
  ['liquido', 'Planilha de Líquido PJ', 'Aba EMISSÃO NF: os prestadores da folha.'],
  ['conferencia', 'Conferência do plano de saúde', 'Aba Consolidada Planilha Fopag: titulares e dependentes.'],
  ['baseAtivos', 'Base de ativos Bradesco', 'Nome, titularidade, certificado e CPF de cada vida.'],
];

/**
 * Conferência Bradesco: cruza a folha (EMISSÃO NF) com a conferência do plano e a
 * base de ativos, e grava plano médico + dependentes no cadastro de quem já é
 * prestador. Não cria prestador e não mexe em envelope: o desconto do mês entra
 * pelo input da Folha do mês.
 */
export default function ConferenciaBradesco({ onFechar }) {
  const { prestadores = [], recarregar, notificar } = useFechamentoPj();
  const [arquivos, setArquivos] = useState({ liquido: null, conferencia: null, baseAtivos: null });
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [leitura, setLeitura] = useState(null);
  const [busca, setBusca] = useState('');
  const [gravando, setGravando] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [concluido, setConcluido] = useState(null);

  const prontos = ARQUIVOS.every(([k]) => arquivos[k]);

  async function processar() {
    setErro('');
    setLendo(true);
    try {
      const [liquido, conferencia, baseAtivos] = await Promise.all([
        lerArquivoXlsx(arquivos.liquido), lerArquivoXlsx(arquivos.conferencia), lerArquivoXlsx(arquivos.baseAtivos),
      ]);
      const r = lerBradesco({ liquido, conferencia, baseAtivos });
      const nomes = ARQUIVOS.map(([k]) => arquivos[k].name);
      setLeitura({ ...r, nomes, fonte: `${nomes.join(' + ')} • cruzamento Líquido PJ + Bradesco` });
    } catch (e) {
      setErro(e.message || 'Não foi possível cruzar as planilhas.');
    } finally {
      setLendo(false);
    }
  }

  const analise = useMemo(() => {
    if (!leitura) return null;
    const porNome = new Map(prestadores.map((p) => [normalizar(p.nome), p]));
    const titulares = leitura.folha.linhas.map((linha) => ({
      linha,
      prestador: porNome.get(normalizar(linha.nome)) || null,
      vidas: leitura.porTitular.get(normalizar(linha.nome)) || [],
    }));
    // A folha pode repetir o nome: grava uma vez por prestador.
    const atualizacoes = new Map();
    titulares.forEach((t) => {
      if (!t.prestador || atualizacoes.has(t.prestador.id)) return;
      const beneficio = beneficioDasVidas(t.vidas, leitura.fonte);
      if (beneficio) atualizacoes.set(t.prestador.id, { prestador: t.prestador, beneficio });
    });
    const pendentes = leitura.vidas.filter((v) => v.tipo === 'Dependente' && v.conferencia !== 'Dados localizados');
    return {
      titulares,
      atualizacoes: [...atualizacoes.values()],
      semCadastro: titulares.filter((t) => !t.prestador),
      localizados: titulares.filter((t) => t.prestador).length,
      pendentes,
    };
  }, [leitura, prestadores]);

  const visiveis = useMemo(() => {
    if (!analise) return [];
    const b = normalizar(busca);
    return b ? analise.titulares.filter((t) => normalizar(t.linha.nome).includes(b)) : analise.titulares;
  }, [analise, busca]);

  async function confirmar() {
    const { atualizacoes, semCadastro, localizados } = analise;
    setErro('');
    setGravando(true);
    setProgresso({ feitos: 0, total: atualizacoes.length });
    let feitos = 0;
    try {
      for (const { prestador, beneficio } of atualizacoes) {
        await salvarPrestador({
          id: prestador.id,
          beneficios: { ...(prestador.beneficios || {}), medico: beneficio.medico },
          dependentes: mesclarDependentes(prestador.dependentes, beneficio.dependentes),
        });
        feitos += 1;
        setProgresso({ feitos, total: atualizacoes.length });
      }
      await registrarImportacao({
        tipo: 'bradesco',
        competencia: leitura.folha.competencia || null,
        arquivo: leitura.nomes.join(' + '),
        linhas: leitura.folha.linhas.length,
        localizados,
        sem_correspondencia: semCadastro.length,
        resumo: { ...leitura.totais, beneficios_atualizados: atualizacoes.length, vidas: leitura.vidas.length },
      });
      await auditar('Conferência Bradesco importada',
        `${atualizacoes.length} prestador(es) com plano médico atualizado • ${leitura.totais.dependentesConciliados} dependente(s) conciliado(s) • ${leitura.totais.conflitos} vínculo(s) divergente(s)`);
      await recarregar();
      notificar(`Benefícios atualizados em ${atualizacoes.length} prestador(es).`);
      setConcluido({ atualizados: atualizacoes.length });
    } catch (e) {
      setErro(`${e.message || 'Falha ao gravar.'} ${feitos} de ${atualizacoes.length} prestador(es) já foram atualizados.`);
      notificar('A conferência parou no meio. Confira o erro.', 'erro');
      await recarregar();
    } finally {
      setGravando(false);
    }
  }

  let etapa = 1;
  if (concluido) etapa = 3;
  else if (leitura) etapa = 2;

  let rodape;
  if (etapa === 1) {
    rodape = (
      <>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={lendo}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={processar} disabled={!prontos || lendo}>
          {lendo ? 'Cruzando…' : 'Cruzar planilhas e conferir'}
        </button>
      </>
    );
  } else if (etapa === 2) {
    rodape = (
      <>
        <button type="button" className="btn btn-ghost" onClick={() => { setLeitura(null); setErro(''); }} disabled={gravando}>Voltar</button>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={gravando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={confirmar} disabled={gravando || !analise.atualizacoes.length}>
          {gravando ? 'Gravando…' : `Atualizar benefícios de ${analise.atualizacoes.length} prestador(es)`}
        </button>
      </>
    );
  } else {
    rodape = <button type="button" className="btn btn-primary" onClick={onFechar}>Fechar</button>;
  }

  return (
    <Modal titulo="Conferência Bradesco" subtitulo="Titulares, dependentes e plano médico" largura="lg"
      onFechar={onFechar} bloqueado={gravando} rodape={rodape}>
      <Etapas etapas={['Arquivos', 'Conferência', 'Concluído']} atual={etapa} />

      {etapa === 1 && (
        <>
          <p className="form-hint">
            Prestador da EMISSÃO NF → titular da conferência do plano → dependente → certificado na base de ativos.
          </p>
          <div className="pjp-arquivos">
            {ARQUIVOS.map(([k, rotulo, dica], i) => (
              <label key={k} className="pj-arquivo">
                <FileSpreadsheet size={26} />
                <span className="pjp-arquivo-rotulo">
                  <b>{i + 1}. {rotulo}</b>
                  <small>{arquivos[k] ? arquivos[k].name : dica}</small>
                </span>
                <input type="file" accept=".xlsx" hidden
                  onChange={(e) => { const f = e.target.files?.[0] || null; setArquivos((a) => ({ ...a, [k]: f })); setErro(''); }} />
              </label>
            ))}
          </div>
          <Aviso tipo="info">
            Esta conferência atualiza só o cadastro (plano médico e dependentes) de quem já é prestador. Ela não cria
            prestadores e não mexe nos envelopes: os descontos do mês entram pelo input da planilha na Folha do mês.
          </Aviso>
        </>
      )}

      {etapa === 2 && analise && (
        <>
          <div className="pjp-contadores">
            <Contador valor={leitura.totais.prestadores} rotulo="Prestadores da EMISSÃO NF" />
            <Contador valor={analise.localizados} rotulo="Já cadastrados" />
            <Contador valor={leitura.totais.comPlano} rotulo="Com plano médico" />
            <Contador valor={leitura.totais.dependentesConciliados} rotulo="Dependentes conciliados" />
            <Contador valor={leitura.totais.semPlano} rotulo="Sem plano na competência" />
            <Contador valor={leitura.totais.dependentesPendentes} rotulo="Dependentes pendentes" alerta={leitura.totais.dependentesPendentes > 0} />
            <Contador valor={leitura.totais.conflitos} rotulo="Vínculos divergentes" alerta={leitura.totais.conflitos > 0} />
          </div>

          {leitura.folha.competencia && (
            <p className="form-hint">Competência lida da planilha: <b>{competenciaRotulo(leitura.folha.competencia)}</b>.</p>
          )}
          {!leitura.colunaNascimento && (
            <Aviso tipo="alerta">A base de ativos não tem a coluna de data de nascimento: os dependentes serão gravados sem nascimento.</Aviso>
          )}
          {analise.semCadastro.length > 0 && (
            <Aviso tipo="alerta">
              {analise.semCadastro.length} prestador(es) da EMISSÃO NF sem cadastro: ficam de fora. Cadastre-os antes (ou pelo input da Folha do mês) e rode a conferência de novo.
            </Aviso>
          )}
          {analise.pendentes.length > 0 && (
            <details className="pjp-recolher">
              <summary>{analise.pendentes.length} dependente(s) com pendência na base de ativos</summary>
              <ul className="pjp-lista">
                {analise.pendentes.map((v, i) => (
                  <li key={`${v.titular}-${v.nome}-${i}`} className="pjp-item-linha">
                    <span>{v.nome}<span className="pj-sub"> • titular {v.titular}</span></span>
                    <BadgeVida valor={v.conferencia} />
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="pj-toolbar">
            <div className="table-search">
              <Search size={16} />
              <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar titular" aria-label="Buscar titular" />
            </div>
            <span className="pjp-registro">{visiveis.length}/{analise.titulares.length}</span>
          </div>

          <div>
            {visiveis.map(({ linha, prestador, vidas }) => (
              <details key={`${linha.linha}-${linha.nome}`} className="pjp-recolher pjp-titular">
                <summary>
                  <span>
                    {linha.nome}
                    <span className="pj-sub">{[linha.email, `${vidas.length} vida(s)`].filter(Boolean).join(' • ')}</span>
                  </span>
                  <span className="pjp-acoes">
                    <Moeda valor={linha.bruto} />
                    {prestador ? <span className="badge aprovada">Já cadastrado</span> : <span className="badge pj-neutro">Sem cadastro</span>}
                  </span>
                </summary>
                <div className="pj-pares pjp-recolher-nota">
                  <div className="pj-par"><small>Razão social</small><b>{linha.razao_social || '—'}</b></div>
                  <div className="pj-par"><small>CNPJ</small><b>{linha.cnpj ? mascararCnpj(linha.cnpj) : '—'}</b></div>
                </div>
                {vidas.length ? (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr><th>Vida</th><th>Tipo</th><th>CPF</th><th>Nascimento</th><th className="pj-direita">Valor</th><th>Situação</th><th>Conferência</th></tr>
                      </thead>
                      <tbody>
                        {vidas.map((v, i) => (
                          <tr key={`${v.nome}-${i}`}>
                            <td>{v.nome}</td>
                            <td>{v.tipo}</td>
                            <td className="pjp-nowrap">{v.cpf ? mascararCpf(v.cpf) : '—'}</td>
                            <td className="pjp-nowrap">{dataBr(v.nascimento)}</td>
                            <td className="pj-direita"><Moeda valor={v.valor} /></td>
                            <td>{v.situacao}</td>
                            <td><BadgeVida valor={v.conferencia} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="form-hint pjp-recolher-nota">Sem plano médico na conferência.</p>}
              </details>
            ))}
          </div>

          {progresso && gravando && <Progresso rotulo="Atualizando cadastros" feitos={progresso.feitos} total={progresso.total} />}
        </>
      )}

      {etapa === 3 && (
        <>
          <Aviso tipo="sucesso">Plano médico e dependentes atualizados em {concluido.atualizados} prestador(es).</Aviso>
          <Aviso tipo="alerta">
            Envelopes da competência aberta com a divergência "desconto de plano sem benefício" precisam ser recalculados para
            a divergência sair. <Link to={ROTA_FOLHA} onClick={onFechar}>Ir para a Folha do mês</Link>.
          </Aviso>
        </>
      )}

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </Modal>
  );
}
