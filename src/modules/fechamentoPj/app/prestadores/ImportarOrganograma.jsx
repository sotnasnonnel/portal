import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';
import { useFechamentoPj } from '../components/contexto';
import { Modal, Aviso } from '../components/ui';
import { lerArquivoXlsx } from '../../lib/arquivos';
import { lerOrganograma, rateiosPorNome, sugerirPrestador } from '../../lib/planilha';
import { normalizar, fmtNum, round2 } from '../../lib/formato';
import { salvarCentros, salvarRateio, registrarImportacao, auditar } from '../../lib/dados';
import { rateiosDoPrestador, ROTA_CONFIGURACOES } from './comum';
import { Contador, Etapas, Progresso } from './pecas';

// Rateio igual = mesmos centros com os mesmos percentuais (2 casas).
const assinatura = (itens) => itens.map((i) => `${i.cod_ct}:${round2(i.percentual)}`).sort().join('|');

/**
 * Input do organograma: lê Nome Completo / COD CT / Alocação (+ CCCOD), casa os
 * nomes com o cadastro e substitui o rateio de quem mudou. O organograma traz
 * também os CLT; quem não é prestador fica de lado, sem erro.
 */
export default function ImportarOrganograma({ onFechar }) {
  const { prestadores = [], rateios = [], centros = [], centrosMapa, recarregar, notificar } = useFechamentoPj();
  const [arquivo, setArquivo] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [leitura, setLeitura] = useState(null);
  const [aceitas, setAceitas] = useState(() => new Map());
  const [gravando, setGravando] = useState(false);
  const [progresso, setProgresso] = useState(null);

  async function processar() {
    setErro('');
    setLendo(true);
    try {
      const abas = await lerArquivoXlsx(arquivo);
      const r = lerOrganograma(abas, arquivo.name);
      if (!r.linhas.length) throw new Error(`A aba ${r.aba} não tem linhas com nome, COD CT e alocação.`);
      setLeitura({ ...r, arquivo: arquivo.name, grupos: rateiosPorNome(r.linhas) });
      setAceitas(new Map());
    } catch (e) {
      setErro(e.message || 'Não foi possível ler o organograma.');
    } finally {
      setLendo(false);
    }
  }

  const analise = useMemo(() => {
    if (!leitura) return null;
    const porNome = new Map(prestadores.map((p) => [normalizar(p.nome), p]));
    const porId = new Map(prestadores.map((p) => [p.id, p]));
    const diretos = new Set(leitura.grupos.map((g) => porNome.get(g.chave)?.id).filter(Boolean));
    const candidatos = prestadores.filter((p) => !diretos.has(p.id));

    const casados = [];
    const semCadastro = [];
    leitura.grupos.forEach((g) => {
      const direto = porNome.get(g.chave);
      const aceito = aceitas.has(g.chave) ? porId.get(aceitas.get(g.chave)) : null;
      const prestador = direto || aceito;
      if (prestador) {
        const atuais = rateiosDoPrestador(rateios, prestador.id);
        casados.push({ grupo: g, prestador, sugestao: !direto, muda: assinatura(atuais) !== assinatura(g.itens) });
      } else {
        semCadastro.push({ grupo: g, sugestao: sugerirPrestador(g.nome, candidatos, 0.6) });
      }
    });

    const usados = new Set(casados.map((c) => c.prestador.id));
    const ativosSemLinha = prestadores.filter((p) => p.situacao === 'ativo' && !usados.has(p.id));

    const existentes = new Map(centros.map((c) => [c.cod_ct, c]));
    const centrosNovos = leitura.centros.filter((c) => !existentes.has(c.cod_ct));
    // Só grava código RM que o arquivo traz; código já cadastrado nunca é apagado.
    const centrosAtualizados = leitura.centros
      .filter((c) => existentes.has(c.cod_ct) && c.codigo_rm && existentes.get(c.cod_ct).codigo_rm !== c.codigo_rm)
      .map((c) => ({ ...c, descricao: existentes.get(c.cod_ct).descricao }));
    const mapaFinal = { ...centrosMapa };
    leitura.centros.forEach((c) => { if (c.codigo_rm) mapaFinal[c.cod_ct] = c.codigo_rm; });
    const ccsUsados = new Set(casados.flatMap((c) => c.grupo.itens.map((i) => i.cod_ct)));
    const semRm = [...ccsUsados].filter((cc) => !mapaFinal[cc]).sort();

    return { casados, semCadastro, ativosSemLinha, centrosNovos, centrosAtualizados, semRm, usados, aMudar: casados.filter((c) => c.muda) };
  }, [leitura, aceitas, prestadores, rateios, centros, centrosMapa]);

  const aceitar = (chave, prestadorId) => setAceitas((m) => new Map(m).set(chave, prestadorId));
  const desfazer = (chave) => setAceitas((m) => { const n = new Map(m); n.delete(chave); return n; });

  async function confirmar() {
    const { casados, semCadastro, ativosSemLinha, centrosNovos, centrosAtualizados, aMudar } = analise;
    setErro('');
    setGravando(true);
    setProgresso({ feitos: 0, total: aMudar.length });
    const origem = `${leitura.arquivo} • ${leitura.aba}`;
    try {
      await salvarCentros([
        ...centrosNovos.map((c) => ({ cod_ct: c.cod_ct, codigo_rm: c.codigo_rm || null, origem: c.origem })),
        ...centrosAtualizados.map((c) => ({ cod_ct: c.cod_ct, codigo_rm: c.codigo_rm, descricao: c.descricao, origem: c.origem })),
      ]);
      for (let i = 0; i < aMudar.length; i += 1) {
        const { prestador, grupo } = aMudar[i];
        await salvarRateio(prestador.id, grupo.itens, origem);
        setProgresso({ feitos: i + 1, total: aMudar.length });
      }
      await registrarImportacao({
        tipo: 'organograma',
        arquivo: leitura.arquivo,
        linhas: leitura.linhas.length,
        localizados: casados.length,
        sem_correspondencia: semCadastro.length,
        resumo: {
          aba: leitura.aba,
          rateios_atualizados: aMudar.length,
          rateios_sem_mudanca: casados.length - aMudar.length,
          sugestoes_aceitas: casados.filter((c) => c.sugestao).map((c) => ({ planilha: c.grupo.nome, prestador: c.prestador.nome })),
          centros_novos: centrosNovos.length,
          centros_codigo_rm_atualizado: centrosAtualizados.length,
          ativos_sem_linha: ativosSemLinha.length,
        },
      });
      await auditar('Organograma importado',
        `${leitura.arquivo} • ${aMudar.length} rateio(s) atualizado(s), ${casados.length} prestador(es) localizado(s), ${centrosNovos.length} centro(s) de custo novo(s)`);
      await recarregar();
      notificar(`Organograma importado: ${aMudar.length} rateio(s) atualizado(s).`);
      onFechar();
    } catch (e) {
      setErro(e.message || 'Falha ao gravar o organograma.');
      notificar('A importação parou no meio. Confira o erro e importe de novo.', 'erro');
      // O que já foi gravado precisa aparecer na tela.
      await recarregar();
    } finally {
      setGravando(false);
    }
  }

  const etapa = leitura ? 2 : 1;
  const rodape = etapa === 1 ? (
    <>
      <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={lendo}>Cancelar</button>
      <button type="button" className="btn btn-primary" onClick={processar} disabled={!arquivo || lendo}>
        {lendo ? 'Lendo…' : 'Ler e conferir'}
      </button>
    </>
  ) : (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => { setLeitura(null); setErro(''); }} disabled={gravando}>Voltar</button>
      <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={gravando}>Cancelar</button>
      <button type="button" className="btn btn-primary" onClick={confirmar}
        disabled={gravando || (!analise.aMudar.length && !analise.centrosNovos.length && !analise.centrosAtualizados.length)}>
        {gravando ? 'Gravando…' : `Confirmar e atualizar ${analise.aMudar.length} rateio(s)`}
      </button>
    </>
  );

  return (
    <Modal titulo="Importar organograma" subtitulo="Rateio fixo por centro de custo" largura="lg" onFechar={onFechar} bloqueado={gravando} rodape={rodape}>
      <Etapas etapas={['Arquivo', 'Conferência']} atual={etapa} />

      {etapa === 1 && (
        <>
          <p className="form-hint">
            A planilha precisa de uma aba com as colunas <b>Nome Completo</b>, <b>COD CT</b> e <b>Alocação</b>. O código RM do
            centro de custo é lido da coluna <b>CCCOD</b>, na mesma aba ou numa aba própria.
          </p>
          <label className="pj-arquivo">
            <FileSpreadsheet size={28} />
            <span className="pjp-arquivo-rotulo">
              <b>{arquivo ? arquivo.name : 'Selecionar organograma (.xlsx)'}</b>
              <small>{arquivo ? `${Math.round(arquivo.size / 1024)} KB` : 'Clique para escolher o arquivo'}</small>
            </span>
            <input type="file" accept=".xlsx" hidden onChange={(e) => { setArquivo(e.target.files?.[0] || null); setErro(''); }} />
          </label>
          <ul className="form-hint">
            <li>O nome é comparado sem acento e sem diferença de maiúsculas.</li>
            <li>Alocação decimal (0,5) vira percentual; um prestador pode ter vários centros.</li>
            <li>O rateio atual só é trocado quando o nome casa com o cadastro.</li>
            <li>Código RM já cadastrado nunca é apagado por um arquivo sem CCCOD.</li>
          </ul>
        </>
      )}

      {etapa === 2 && analise && (
        <>
          <div className="pjp-contadores">
            <Contador valor={leitura.linhas.length} rotulo="Linhas lidas" />
            <Contador valor={analise.casados.length} rotulo="Prestadores localizados" />
            <Contador valor={analise.semCadastro.length} rotulo="Sem correspondência" />
            <Contador valor={analise.aMudar.length} rotulo="Rateios a atualizar" />
            <Contador valor={analise.centrosNovos.length} rotulo="Centros de custo novos" />
            <Contador valor={analise.semRm.length} rotulo="CC sem código RM" alerta={analise.semRm.length > 0} />
          </div>

          <p className="form-hint">Aba <b>{leitura.aba}</b> de <b>{leitura.arquivo}</b>.</p>

          {analise.semRm.length > 0 && (
            <Aviso tipo="alerta">
              Centros de custo sem código RM: {analise.semRm.join(', ')}. O rateio é gravado assim mesmo, mas o TXT do RM fica
              pendente até o de-para ser preenchido em <Link to={ROTA_CONFIGURACOES} onClick={onFechar}>Configurações</Link>.
            </Aviso>
          )}

          <div className="pjp-colunas">
            <div>
              <div className="pj-secao-titulo">Rateios encontrados</div>
              {analise.casados.length ? (
                <ul className="pjp-lista">
                  {analise.casados.map(({ grupo, prestador, muda, sugestao }) => (
                    <li key={grupo.chave}>
                      <div className="pjp-item-linha">
                        <span><b>{prestador.nome}</b>{sugestao && <span className="pj-sub">Planilha: {grupo.nome}</span>}</span>
                        {muda ? <span className="badge pendente">Atualizar</span> : <span className="badge pj-neutro">Sem mudança</span>}
                      </div>
                      <div className="pj-sub">{grupo.itens.map((i) => `${i.cod_ct} ${fmtNum(i.percentual)}%`).join(' + ')}</div>
                      {sugestao && (
                        <button type="button" className="pj-link" onClick={() => desfazer(grupo.chave)} disabled={gravando}>Desfazer correspondência</button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="form-hint">Nenhum nome do organograma casou com o cadastro.</p>}
            </div>

            <div>
              <div className="pj-secao-titulo">Itens para conferir</div>
              <details className="pjp-recolher" open={analise.semCadastro.some((s) => s.sugestao)}>
                <summary>
                  {analise.semCadastro.length} nome(s) do organograma sem cadastro PJ
                  {analise.semCadastro.some((s) => s.sugestao) && ` • ${analise.semCadastro.filter((s) => s.sugestao).length} com possível correspondência`}
                </summary>
                <p className="form-hint pjp-recolher-nota">
                  O organograma inclui os CLT: a maioria destes nomes não é prestador PJ cadastrado e fica de fora.
                </p>
                <ul className="pjp-lista">
                  {[...analise.semCadastro].sort((a, b) => Number(Boolean(b.sugestao)) - Number(Boolean(a.sugestao))).map(({ grupo, sugestao }) => {
                    const ocupado = sugestao && analise.usados.has(sugestao.prestador.id);
                    return (
                      <li key={grupo.chave}>
                        <div className="pjp-item-linha">
                          <span>{grupo.nome}</span>
                          <span className="pj-sub">{grupo.itens.map((i) => i.cod_ct).join(' + ')}</span>
                        </div>
                        {sugestao && (
                          <div className="pjp-item-linha">
                            <span className="pj-sub">
                              Possível correspondência: <b>{sugestao.prestador.nome}</b> ({Math.round(sugestao.score * 100)}%)
                            </span>
                            <button type="button" className="btn btn-sm btn-outline" disabled={ocupado || gravando}
                              title={ocupado ? 'Esse prestador já tem uma linha do organograma' : undefined}
                              onClick={() => aceitar(grupo.chave, sugestao.prestador.id)}>
                              <Check size={14} /> Usar
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>

              <details className="pjp-recolher">
                <summary>
                  <AlertTriangle size={14} className="pjp-alerta-icone" /> {analise.ativosSemLinha.length} prestador(es) ativo(s) sem linha no organograma
                </summary>
                <p className="form-hint pjp-recolher-nota">O rateio atual deles será preservado.</p>
                <ul className="pjp-lista">
                  {analise.ativosSemLinha.map((p) => (
                    <li key={p.id}>
                      {p.nome}
                      <div className="pj-sub">{rateiosDoPrestador(rateios, p.id).map((r) => `${r.cod_ct} ${fmtNum(r.percentual)}%`).join(' + ') || 'Sem rateio cadastrado'}</div>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>

          {progresso && gravando && (
            <Progresso rotulo="Gravando rateios" feitos={progresso.feitos} total={progresso.total} />
          )}
        </>
      )}

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </Modal>
  );
}
