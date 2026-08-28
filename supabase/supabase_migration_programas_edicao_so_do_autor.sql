-- ============================================================================
-- Programas — duas regras de acesso, agora separadas com clareza.
-- (Aplicada no portal_phd em 2026-08-27.)
--
--   AVALIAÇÃO da indicação (status, comentário, premiação) -> só time comercial
--   CONTEÚDO do registro (o que a pessoa escreveu)         -> só quem inseriu
--
-- Faltava a segunda metade: o comercial conseguia reescrever empresa, contato e
-- descrição de uma indicação alheia, e o admin do módulo conseguia reescrever a
-- ideia de qualquer um.
--
-- EXCLUIR não entra nessa trava: continua permitido ao autor e ao admin do
-- módulo, que de outro modo não teria como remover o registro de alguém que
-- saiu da empresa.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Campo de Ideias: editar é só de quem escreveu.
-- ---------------------------------------------------------------------------
drop policy if exists programas_ideias_update on public.programas_ideias;
create policy programas_ideias_update on public.programas_ideias
  for update to authenticated
  using (autor_id = app_private.my_colaborador_id())
  with check (autor_id = app_private.my_colaborador_id());

-- ---------------------------------------------------------------------------
-- Alavanca: a policy segue liberando os dois lados (o comercial PRECISA gravar
-- status e premiação), e quem separa o que cada um pode tocar é o trigger.
-- Coluna não é assunto de RLS: ela decide quem escreve NA LINHA.
--
-- O coalesce em `sou_autor` não é enfeite: `old.indicado_por = my_colaborador_id()`
-- devolve NULL — e não false — quando não há colaborador vinculado à sessão, e
-- como `not NULL` é NULL, o IF não dispararia. A trava passaria calada
-- justamente no caso mais perigoso, o do chamador sem identidade.
-- ---------------------------------------------------------------------------
create or replace function app_private.alavanca_protege_avaliacao()
returns trigger language plpgsql security definer set search_path to '' as $fn$
declare
  sou_comercial boolean := coalesce(app_private.is_programas_comercial(), false);
  sou_autor boolean := coalesce(
    old.indicado_por = app_private.my_colaborador_id(), false
  );
begin
  -- Nunca mudam, para ninguém: são a identidade da indicação.
  if new.indicado_por is distinct from old.indicado_por
     or new.numero is distinct from old.numero
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Autoria, numero e data de criacao da indicacao nao podem ser alterados.';
  end if;

  -- A AVALIAÇÃO é do comercial.
  if not sou_comercial and (
       new.status is distinct from old.status
    or new.comentario is distinct from old.comentario
    or new.valor_contrato is distinct from old.valor_contrato
    or new.valor_premio is distinct from old.valor_premio
    or new.pago_em is distinct from old.pago_em
    or new.concluida_em is distinct from old.concluida_em
  ) then
    raise exception
      'So o time comercial pode alterar status, comentario e premiacao da indicacao.';
  end if;

  -- O CONTEÚDO é de quem indicou. Vale inclusive para o comercial: se ele
  -- discorda do que está escrito, comenta — não reescreve o relato alheio.
  if not sou_autor and (
       new.oportunidade is distinct from old.oportunidade
    or new.descricao is distinct from old.descricao
    or new.empresa is distinct from old.empresa
    or new.contato_nome is distinct from old.contato_nome
    or new.contato_cargo is distinct from old.contato_cargo
    or new.contato_telefone is distinct from old.contato_telefone
    or new.contato_email is distinct from old.contato_email
    or new.tratativas is distinct from old.tratativas
  ) then
    raise exception 'So quem fez a indicacao pode alterar os dados dela.';
  end if;

  -- `elegibilidade` fica de fora das duas travas de propósito: o autor a
  -- recalcula ao trocar empresa/contato, e o comercial pode sobrepor o veredito
  -- automático. Nenhum dos dois é escrita indevida.
  return new;
end
$fn$;

drop trigger if exists programas_alavanca_protege on public.programas_alavanca;
create trigger programas_alavanca_protege
  before update on public.programas_alavanca
  for each row execute function app_private.alavanca_protege_avaliacao();
