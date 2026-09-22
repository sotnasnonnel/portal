import { useEffect, useMemo, useState } from 'react';
import { FolderArchive, Check, AlertTriangle, RefreshCw, Plus, Trash2, Undo2 } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal, Aviso } from '../components/ui';
import { lerPastaDoPrestador } from '../../lib/pastaDocumentos';
import { diferencas } from '../../lib/documentos';
import { normalizar, dataBr, fmtBRL, mascararCpf, mascararCnpj, cpfValido, digitos } from '../../lib/formato';
import { salvarPrestador, registrarImportacao, auditar } from '../../lib/dados';
import { Contador, Etapas, Progresso } from './pecas';
import TableScroll from '../../../../components/UI/TableScroll';

const MASCARA = { cpf: mascararCpf, cnpj: mascararCnpj };

const PARENTESCOS = ['Cônjuge', 'Filho', 'Filha', 'Filho(a)', 'Enteado(a)', 'Pai', 'Mãe', 'Outro'];

const BADGE_DEPENDENTE = {
  'Dados localizados': 'aprovada',
  'Preenchido na conferência': 'aprovada',
  Descartado: 'reprovada',
};

// O que falta para o dependente entrar no cadastro sem pendência.
const LACUNAS = [['cpf', 'CPF'], ['nascimento', 'nascimento'], ['sexo', 'sexo'], ['parentesco', 'parentesco']];

function situacaoDoDependente(d) {
  if (d.descartado) return 'Descartado';
  if (d.cpf && !cpfValido(d.cpf)) return 'CPF inválido';
  const faltando = LACUNAS.filter(([campo]) => !d[campo]).map(([, rotulo]) => rotulo);
  if (!faltando.length) return d.lido ? 'Dados localizados' : 'Preenchido na conferência';
  return `Falta ${faltando.join(', ')}`;
}

function valorLegivel(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (campo === 'valor_mensal') return fmtBRL(valor);
  if (campo.startsWith('data_')) return dataBr(valor);
  return MASCARA[campo] ? MASCARA[campo](valor) : String(valor);
}

/**
 * Importação documental do prestador: abre o ZIP da pasta, lê o texto dos PDFs e
 * monta a conferência antes de gravar. Nenhum arquivo é publicado nem guardado —
 * só os campos confirmados na tela entram no cadastro.
 */
export default function ImportarDocumentos({ prestador = null, onFechar }) {
  const { prestadores = [], recarregar, notificar } = useFechamentoPj();
  const [arquivo, setArquivo] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState('');
  const [leitura, setLeitura] = useState(null);
  const [conferido, setConferido] = useState(false);
  const [gravando, setGravando] = useState(false);

  // Quem vai receber os dados: o prestador de onde o assistente foi aberto ou,
  // na lista, o cadastro que casar por CPF (e só depois por nome).
  const alvo = useMemo(() => {
    if (prestador) return prestador;
    if (!leitura) return null;
    const porCpf = leitura.perfil.cpf && prestadores.find((p) => p.cpf === leitura.perfil.cpf);
    if (porCpf) return porCpf;
    return prestadores.find((p) => normalizar(p.nome) === normalizar(leitura.nome)) || null;
  }, [prestador, prestadores, leitura]);

  const mudancas = useMemo(() => (leitura ? diferencas(leitura.perfil, alvo) : []), [leitura, alvo]);

  // Os dependentes viram rascunho editável: o que a certidão não entregou (é o
  // caso de quem só tem documento digitalizado) fica em branco para preencher
  // aqui, em vez de entrar no cadastro pela metade.
  const [dependentes, setDependentes] = useState([]);
  useEffect(() => {
    setDependentes((leitura?.dependentes || []).map((d, i) => ({
      ...d,
      chave: `${normalizar(d.nome)}-${i}`,
      lido: d.situacao === 'Dados localizados',
      descartado: false,
    })));
  }, [leitura]);

  const alterarDependente = (i, patch) => setDependentes((atual) => atual.map((d, k) => (k === i ? { ...d, ...patch } : d)));

  const paraGravar = useMemo(() => dependentes.filter((d) => !d.descartado), [dependentes]);
  const cpfRuim = paraGravar.some((d) => d.cpf && !cpfValido(d.cpf));

  async function processar() {
    setErro('');
    setLendo(true);
    setProgresso({ feitos: 0, total: 0, arquivo: '' });
    try {
      const r = await lerPastaDoPrestador(arquivo, setProgresso);
      setLeitura(r);
      setConferido(false);
    } catch (e) {
      setErro(e.message || 'Não foi possível ler a pasta.');
    } finally {
      setLendo(false);
      setProgresso(null);
    }
  }

  async function confirmar() {
    setErro('');
    setGravando(true);
    try {
      // Dependentes: o que já existe no cadastro manda, e o que a pasta trouxe
      // entra pelo nome — importar de novo não duplica ninguém.
      const atuais = Array.isArray(alvo?.dependentes) ? alvo.dependentes : [];
      const porNome = new Map(atuais.map((d) => [normalizar(d.nome), d]));
      paraGravar.forEach(({ chave, lido, descartado, ...d }) => { // eslint-disable-line no-unused-vars
        porNome.set(normalizar(d.nome), {
          ...porNome.get(normalizar(d.nome)), ...d, situacao: situacaoDoDependente(d),
        });
      });

      const salvo = await salvarPrestador({
        ...(alvo || {}),
        ...leitura.perfil,
        nome: alvo?.nome || leitura.nome,
        dependentes: [...porNome.values()],
      });

      // O cadastro já está salvo neste ponto. Se o histórico falhar, ele não
      // pode derrubar a importação inteira nem fazer parecer que nada foi
      // gravado — vira um aviso.
      let historico = '';
      try {
        await registrarImportacao({
          tipo: 'documental',
          arquivo: leitura.arquivo,
          linhas: leitura.documentos.length,
          localizados: alvo ? 1 : 0,
          sem_correspondencia: alvo ? 0 : 1,
          resumo: {
            prestador: salvo.nome,
            campos: leitura.campos.map((c) => ({ campo: c.campo, valor: c.valor, fonte: c.fonte })),
            dependentes: paraGravar.length,
            descartados: dependentes.length - paraGravar.length,
            alteracoes: mudancas.map((m) => ({ campo: m.campo, de: m.atual, para: m.novo })),
            avisos: leitura.avisos,
            digitalizados: leitura.documentos.filter((d) => d.status !== 'Lido').length,
          },
        });
        await auditar(alvo ? 'Cadastro atualizado pela pasta documental' : 'Prestador cadastrado pela pasta documental',
          `${leitura.arquivo} • ${leitura.campos.length} campo(s) lido(s), ${paraGravar.length} dependente(s), ${mudancas.length} alteração(ões)`,
          { prestadorId: salvo.id });
      } catch (e) {
        historico = ` O cadastro foi salvo, mas o histórico da importação não: ${e.message}`;
      }

      await recarregar();
      notificar(`${salvo.nome}: ${leitura.campos.length} campo(s) e ${paraGravar.length} dependente(s) gravados.${historico}`,
        historico ? 'alerta' : 'sucesso');
      onFechar();
    } catch (e) {
      setErro(e.message || 'Falha ao gravar o cadastro.');
      notificar('A importação não foi gravada. Confira o erro e tente de novo.', 'erro');
      await recarregar();
    } finally {
      setGravando(false);
    }
  }

  const etapa = leitura ? 2 : 1;
  const bloqueado = !leitura?.podeConfirmar || !conferido || cpfRuim;

  const rodape = etapa === 1 ? (
    <>
      <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={lendo}>Cancelar</button>
      <button type="button" className="btn btn-primary" onClick={processar} disabled={!arquivo || lendo}>
        {lendo ? 'Lendo documentos…' : 'Ler e conferir'}
      </button>
    </>
  ) : (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => { setLeitura(null); setErro(''); }} disabled={gravando}>Voltar</button>
      <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={gravando}>Cancelar</button>
      <button type="button" className="btn btn-primary" onClick={confirmar} disabled={bloqueado || gravando}>
        {gravando ? 'Gravando…' : (alvo ? 'Atualizar cadastro e dependentes' : 'Cadastrar novo prestador')}
      </button>
    </>
  );

  return (
    <Modal
      titulo="Importação documental do prestador"
      subtitulo="Contrato, dados pessoais, endereço e dependentes"
      largura="lg"
      onFechar={onFechar}
      bloqueado={lendo || gravando}
      rodape={rodape}
    >
      <Etapas etapas={['Pasta do prestador', 'Conferência']} atual={etapa} />

      {etapa === 1 && (
        <>
          <p className="form-hint">
            Envie a <b>pasta do prestador compactada em .zip</b>, do jeito que ela chega do RH. O sistema classifica cada
            documento pelo nome e lê o conteúdo dos PDFs para montar a conferência.
          </p>
          <label className="pj-arquivo">
            <FolderArchive size={28} />
            <span className="pjp-arquivo-rotulo">
              <b>{arquivo ? arquivo.name : 'Selecionar pasta do prestador (.zip)'}</b>
              <small>{arquivo ? `${Math.round(arquivo.size / 1024)} KB` : 'Clique para escolher o arquivo'}</small>
            </span>
            <input type="file" accept=".zip,application/zip" hidden
              onChange={(e) => { setArquivo(e.target.files?.[0] || null); setErro(''); }} />
          </label>

          {lendo && progresso?.total > 0 && (
            <Progresso feitos={progresso.feitos} total={progresso.total} rotulo={progresso.arquivo || 'Lendo PDFs'} />
          )}

          <Aviso tipo="info">
            <b>Proteção dos documentos.</b> A leitura acontece no seu navegador: os arquivos não sobem para o servidor e não
            ficam guardados. Só os campos confirmados nesta tela entram no cadastro.
          </Aviso>

          <ul className="form-hint">
            <li>O contrato dá o início da vigência e o valor mensal; a assinatura só entra se não houver vigência.</li>
            <li>Cartão CNPJ e comprovante de endereço preenchem empresa e endereço.</li>
            <li>Certidão de nascimento identifica o dependente e prova a filiação pelo nome do genitor.</li>
            <li>Documento digitalizado não tem texto: ele é listado, mas nada dele é preenchido sozinho.</li>
          </ul>
        </>
      )}

      {etapa === 2 && leitura && (
        <>
          <div className="pjp-contadores">
            <Contador valor={leitura.documentos.length} rotulo="Documentos encontrados" />
            <Contador valor={leitura.campos.length} rotulo="Campos identificados" />
            <Contador valor={leitura.dependentes.length} rotulo="Dependentes localizados" />
            <Contador valor={leitura.avisos.length} rotulo="Avisos para revisar" alerta={leitura.avisos.length > 0} />
          </div>

          <div className="pjd-correspondencia">
            <div>
              <small>Correspondência no sistema</small>
              <b>{alvo ? `Cadastro localizado • código ${alvo.codigo}` : 'Novo prestador'}</b>
              <span>{alvo ? alvo.nome : 'Será criado somente após a confirmação'}</span>
            </div>
            <div>
              <small>Início do contrato lido</small>
              <b>{leitura.perfil.data_inicio ? dataBr(leitura.perfil.data_inicio) : 'Não identificado'}</b>
              <span>Prioridade: vigência do contrato; assinatura só na falta dela.</span>
            </div>
          </div>

          <div className="pjd-colunas">
            <section>
              <div className="pj-secao-titulo">Dados do titular ({leitura.campos.length})</div>
              {leitura.campos.length ? (
                <div className="pjd-campos">
                  {leitura.campos.map((c) => (
                    <article key={c.campo}>
                      <div>
                        <b>{c.rotulo}</b>
                        <small>{c.fonte}</small>
                      </div>
                      <strong>{valorLegivel(c.campo, c.valor)}</strong>
                      <em className={c.confianca === 'Alta' ? 'ok' : 'alerta'}>confiança {c.confianca.toLowerCase()}</em>
                    </article>
                  ))}
                </div>
              ) : (
                <Aviso tipo="alerta">
                  Nenhum campo foi lido com segurança. Os documentos foram separados por tipo, mas o cadastro precisa ser
                  preenchido à mão.
                </Aviso>
              )}
            </section>

            <section>
              <div className="pj-secao-titulo">Dependentes encontrados ({dependentes.filter((d) => !d.descartado).length})</div>
              <p className="form-hint">
                O que a certidão não entregou fica em branco para você preencher aqui. Dependente que não deveria estar na
                lista pode ser descartado — a pasta às vezes traz o nome no arquivo sem o documento correspondente.
              </p>
              {dependentes.length ? (
                <div className="pjd-dependentes">
                  {dependentes.map((d, i) => (
                    <article key={d.chave} className={d.descartado ? 'pjd-descartado' : ''}>
                      <header>
                        <div>
                          <b>{d.nome}</b>
                          <small>{d.fonte}</small>
                        </div>
                        <span className={`badge ${BADGE_DEPENDENTE[situacaoDoDependente(d)] || 'pj-neutro'}`}>
                          {situacaoDoDependente(d)}
                        </span>
                        <button type="button" className="btn-icon" title={d.descartado ? 'Trazer de volta' : 'Descartar dependente'}
                          onClick={() => alterarDependente(i, { descartado: !d.descartado })}>
                          {d.descartado ? <Undo2 size={15} /> : <Trash2 size={15} />}
                        </button>
                      </header>
                      {!d.descartado && (
                        <div className="pjd-dependente-campos">
                          <label>
                            <small>CPF</small>
                            <input type="text" inputMode="numeric" value={mascararCpf(d.cpf)} placeholder="000.000.000-00"
                              onChange={(e) => alterarDependente(i, { cpf: digitos(e.target.value).slice(0, 11) })} />
                            {d.cpf && !cpfValido(d.cpf) && <em className="pjd-erro">CPF inválido</em>}
                          </label>
                          <label>
                            <small>Nascimento</small>
                            <input type="date" value={d.nascimento || ''}
                              onChange={(e) => alterarDependente(i, { nascimento: e.target.value || null })} />
                          </label>
                          <label>
                            <small>Sexo</small>
                            <select value={d.sexo || ''} onChange={(e) => alterarDependente(i, { sexo: e.target.value })}>
                              <option value="">—</option>
                              <option value="Feminino">Feminino</option>
                              <option value="Masculino">Masculino</option>
                            </select>
                          </label>
                          <label>
                            <small>Parentesco</small>
                            <select value={d.parentesco || ''} onChange={(e) => alterarDependente(i, { parentesco: e.target.value })}>
                              <option value="">—</option>
                              {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </label>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : <p className="form-hint">Nenhum dependente identificado na pasta.</p>}
            </section>
          </div>

          <div className="pjd-colunas">
            <section>
              <div className="pj-secao-titulo">Validação cadastral</div>
              <div className="pjd-validacao">
                {leitura.validacoes.map((v) => (
                  <article key={v.rotulo} className={v.ok ? 'ok' : 'alerta'}>
                    {v.ok ? <Check size={15} /> : <AlertTriangle size={15} />}
                    <span>
                      <strong>{v.rotulo}</strong>
                      <small>{v.detalhe}</small>
                    </span>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <div className="pj-secao-titulo">{alvo ? 'Alterações identificadas' : 'Inclusão identificada'}</div>
              <div className="pjd-validacao">
                {!alvo && (
                  <article className="mudanca">
                    <Plus size={15} />
                    <span>
                      <strong>Novo prestador</strong>
                      <small>Os dados confirmados serão incluídos no cadastro.</small>
                    </span>
                  </article>
                )}
                {alvo && !mudancas.length && (
                  <article className="ok">
                    <Check size={15} />
                    <span>
                      <strong>Cadastro já atualizado</strong>
                      <small>Nenhuma diferença entre a pasta e o que está gravado.</small>
                    </span>
                  </article>
                )}
                {alvo && mudancas.map((m) => (
                  <article key={m.campo} className="mudanca">
                    <RefreshCw size={15} />
                    <span>
                      <strong>{m.rotulo}</strong>
                      <small>{valorLegivel(m.campo, m.atual)} → {valorLegivel(m.campo, m.novo)}</small>
                    </span>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {leitura.avisos.length > 0 && (
            <Aviso tipo="alerta">
              <b>Pontos para conferir antes de gravar</b>
              <ul className="pjd-avisos">
                {leitura.avisos.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </Aviso>
          )}

          <details className="pjd-arquivos">
            <summary>Ver classificação dos {leitura.documentos.length} arquivos</summary>
            <TableScroll>
              <table className="data-table">
                <thead><tr><th>Tipo</th><th>Arquivo</th><th>Leitura</th></tr></thead>
                <tbody>
                  {leitura.documentos.map((d) => (
                    <tr key={d.nome}>
                      <td>{d.tipo}</td>
                      <td>{d.nome}</td>
                      <td>
                        <span className={`badge ${d.status === 'Lido' ? 'aprovada' : 'pj-neutro'}`}>{d.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </details>

          {!leitura.podeConfirmar && (
            <Aviso tipo="alerta">
              Sem identificação do prestador e sem a vigência do contrato o cadastro não pode ser gravado por aqui. Confira
              a pasta ou preencha o cadastro à mão.
            </Aviso>
          )}

          {cpfRuim && <Aviso tipo="alerta">Há CPF de dependente com dígito inválido. Corrija ou apague o campo para conseguir gravar.</Aviso>}

          <label className="pjd-confirmar">
            <input type="checkbox" checked={conferido} onChange={(e) => setConferido(e.target.checked)}
              disabled={!leitura.podeConfirmar} />
            <span>
              <b>Confirmo a validação dos documentos e das alterações</b>
              <small>O cadastro só é atualizado depois desta confirmação.</small>
            </span>
          </label>
        </>
      )}

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </Modal>
  );
}
