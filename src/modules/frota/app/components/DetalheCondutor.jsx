import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useFrota } from './FrotaContext';
import CascaDrawer from './CascaDrawer';
import { ArquivoLinha, EnviarArquivo } from './Anexos';
import Confirmar from './Confirmar';
import { LinhaAuditoria, Pill, Placa } from './Pecas';
import {
  conformidade, norm, ocsDe, ocTone, placaAtualDe, stTone, sum, todayISO,
} from '../../lib/regras';
import {
  fmtDate, iniciais, linhaClicavel, money,
} from '../../lib/formato';
import {
  enviarAnexo, excluirRegistro, removerAnexos, salvarRegistro,
} from '../../lib/frota';
import { pathsDosAnexos } from '../../lib/schemas';

/** Cartão de um documento do condutor, com envio direto da ficha. */
function CartaoDoc({
  titulo, tone, rotulo, children, arquivo, oQue, podeEnviar, ocupado, onEnviar,
}) {
  return (
    <div className="frota-card frota-doc">
      <div className="frota-card-h">
        <h3>{titulo}</h3>
        <span className="frota-card-nota"><Pill tone={tone}>{rotulo}</Pill></span>
      </div>
      <div className="frota-doc-txt">{children}</div>
      <div className="frota-files">
        {arquivo && <ArquivoLinha arquivo={arquivo} />}
        {podeEnviar ? (
          <EnviarArquivo rotulo={`${arquivo ? 'Substituir' : 'Enviar'} ${oQue} (PDF ou imagem)`} ocupado={ocupado} onEscolher={([f]) => onEnviar(f)} />
        ) : !arquivo && <span className="frota-muted">Nenhum arquivo enviado.</span>}
      </div>
    </div>
  );
}

/** Ficha do condutor: CNH, termo, veículos e ocorrências. */
export default function DetalheCondutor({ id }) {
  const {
    dados, cfg, abrirDetalhe, abrirForm, fecharDrawer, recarregar, toast, podeEscrever, podeExcluir,
  } = useFrota();
  const [confirma, setConfirma] = useState(false);
  const [enviando, setEnviando] = useState('');
  const c = dados.condutores.find((x) => x.id === id);
  if (!c) return null;

  const k = conformidade(c, dados.veiculos, cfg);
  const oc = ocsDe(c.nome, dados.ocorrencias).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  const nk = norm(c.nome);
  const dirige = (nome) => norm(nome).split(' / ').includes(nk);
  const vh = dados.veiculos.filter((v) => dirige(v.condutor) || (v.historico || []).some((h) => dirige(h.condutor)));

  // Enviar o termo sem data de assinatura registra hoje e vincula ao veículo atual.
  const enviar = async (campo, file) => {
    setEnviando(campo);
    try {
      const a = await enviarAnexo('condutores', file, campo === 'termo_arquivo' ? 'Termo de responsabilidade' : 'CNH');
      const patch = { [campo]: a };
      if (campo === 'termo_arquivo') {
        if (!c.termo_assinatura) {
          patch.termo_assinatura = todayISO();
          patch.termo_validade = null;
        }
        if (!c.termo_placa) patch.termo_placa = placaAtualDe(c.nome, dados.veiculos) || null;
      }
      await salvarRegistro('condutores', id, patch);
      if (c[campo]?.path && c[campo].path !== a.path) removerAnexos([c[campo].path]);
      await recarregar(['condutores']);
      toast(campo === 'termo_arquivo' ? 'Termo anexado ao condutor' : 'CNH anexada ao condutor');
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setEnviando('');
    }
  };

  const excluir = async () => {
    try {
      await excluirRegistro('condutores', id);
      removerAnexos(pathsDosAnexos('condutores', c));
      await recarregar(['condutores']);
      toast('Excluído');
      fecharDrawer();
    } catch (e) {
      setConfirma(false);
      toast(e.message, 'err');
    }
  };

  return (
    <CascaDrawer
      onFechar={fecharDrawer}
      cabecalho={(
        <div className="frota-cellv">
          <span className="frota-avatar">{iniciais(c.nome)}</span>
          <div>
            <h2>{c.nome}</h2>
            <p>
              {c.email || ''} <Pill tone={c.situacao === 'Ativo' ? 'ok' : 'neutral'}>{c.situacao || 'Inativo'}</Pill>{' '}
              {c.situacao === 'Ativo' && <Pill tone={k.geral.tone}>{k.geral.label}</Pill>}
            </p>
          </div>
        </div>
      )}
      rodape={podeEscrever ? (
        <>
          {podeExcluir('condutores') && (
            <button type="button" className="frota-btn danger" onClick={() => setConfirma(true)}><Trash2 size={15} /> Excluir</button>
          )}
          <span className="frota-sp" />
          <button type="button" className="frota-btn primary" onClick={() => abrirForm('condutores', id)}><Pencil size={15} /> Editar</button>
        </>
      ) : (
        <>
          <span className="frota-sp" />
          <button type="button" className="frota-btn" onClick={fecharDrawer}>Fechar</button>
        </>
      )}
    >
      <div className="frota-stack">
        <div className="frota-grid g2">
          <CartaoDoc
            titulo="Termo de responsabilidade"
            tone={k.termo.tone}
            rotulo={k.termo.label}
            arquivo={c.termo_arquivo}
            oQue="termo assinado"
            podeEnviar={podeEscrever}
            ocupado={enviando === 'termo_arquivo'}
            onEnviar={(f) => enviar('termo_arquivo', f)}
          >
            Assinado em <b>{c.termo_assinatura ? fmtDate(c.termo_assinatura) : '—'}</b> · válido até <b>{k.termoVal ? fmtDate(k.termoVal) : '—'}</b>
            <br />
            Veículo do termo: <b>{c.termo_placa || '—'}</b>{k.placaAtual && <> · atual: <b>{k.placaAtual}</b></>}
          </CartaoDoc>
          <CartaoDoc
            titulo="CNH"
            tone={k.cnh.tone}
            rotulo={k.cnh.label}
            arquivo={c.cnh_arquivo}
            oQue="cópia da CNH"
            podeEnviar={podeEscrever}
            ocupado={enviando === 'cnh_arquivo'}
            onEnviar={(f) => enviar('cnh_arquivo', f)}
          >
            Categoria <b>{c.cnh_categoria || '—'}</b> · validade <b>{c.cnh_validade ? fmtDate(c.cnh_validade) : '—'}</b>
            {c.cnh_fonte && <><br /><span className="frota-muted">{c.cnh_fonte}</span></>}
          </CartaoDoc>
        </div>
        {podeEscrever && (
          <p className="frota-hint">Ao enviar o termo sem data de assinatura, o sistema registra a data de hoje e vincula ao veículo atual. Ajuste em Editar se necessário.</p>
        )}

        <section className="frota-fsec">
          <h3>Dados</h3>
          <dl className="frota-dl">
            <div><dt>E-mail</dt><dd>{c.email || '—'}</dd></div>
            <div><dt>CT / Centro de custo</dt><dd>{c.ct || '—'}</dd></div>
            <div><dt>Gestor</dt><dd>{c.gestor || '—'}</dd></div>
            <div><dt>Veículo atual</dt><dd>{k.placaAtual ? <Placa placa={k.placaAtual} /> : '—'}</dd></div>
          </dl>
          {c.obs && <div className="frota-note"><span className="pre">{c.obs}</span></div>}
        </section>

        <section className="frota-fsec">
          <h3>Veículos do condutor</h3>
          {vh.length ? (
            <table className="frota-mini">
              <thead><tr><th>Placa</th><th>Modelo</th><th>Locadora</th><th>Status</th></tr></thead>
              <tbody>
                {vh.map((v) => (
                  <tr key={v.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('veiculos', v.id))}>
                    <td>{v.placa || 'reserva'}</td><td>{v.modelo || ''}</td><td>{v.locadora || ''}</td>
                    <td>{dirige(v.condutor) ? <Pill tone={stTone(v.status)}>{v.status}</Pill> : <Pill>Anterior</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="frota-muted">Nenhum veículo vinculado.</p>}
        </section>

        <section className="frota-fsec">
          <h3>Multas e avarias</h3>
          {oc.length ? (
            <table className="frota-mini">
              <thead><tr><th>Data</th><th>Ocorrência</th><th>Placa</th><th className="n">Valor</th><th>Status</th></tr></thead>
              <tbody>
                {oc.map((o) => (
                  <tr key={o.id} className="frota-click" {...linhaClicavel(() => abrirDetalhe('ocorrencias', o.id))}>
                    <td>{fmtDate(o.data)}</td><td>{o.tipo} · {o.categoria || ''}</td><td>{o.placa || ''}</td><td className="n">{money(o.valor)}</td><td><Pill tone={ocTone(o.status || 'Aberta')}>{o.status || 'Aberta'}</Pill></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3}>{oc.length} ocorrência(s)</td><td className="n">{money(sum(oc, 'valor'))}</td><td /></tr></tfoot>
            </table>
          ) : <p className="frota-muted">Nenhuma ocorrência registrada.</p>}
        </section>

        <LinhaAuditoria doc={c} />
      </div>
      {confirma && (
        <Confirmar
          titulo="Excluir condutor?"
          texto={`“${c.nome}” será removido da base para todos os usuários. Essa ação não pode ser desfeita.`}
          ok="Excluir"
          perigo
          onOk={excluir}
          onFechar={() => setConfirma(false)}
        />
      )}
    </CascaDrawer>
  );
}
