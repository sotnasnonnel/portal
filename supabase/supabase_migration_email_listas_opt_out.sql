-- Quem administra um módulo não precisa, por isso, estar na lista de e-mails
-- dele. Ser admin dá a VISÃO das telas; receber o aviso de tudo que acontece é
-- outra coisa, e para um diretor que já acompanha pelo portal vira só ruído.
--
-- A saída é por pessoa, não por papel: tirar o papel tiraria também a visão, e
-- tirar a lista inteira calaria quem depende dela para trabalhar.
--
-- Vale só para os envios em LISTA (por papel ou por cargo). O aviso de "aguarda
-- sua aprovação", que vai para o aprovador nomeado da etapa, continua chegando
-- em qualquer caso: sem ele o pedido espera em silêncio.
alter table public.colaboradores
  add column if not exists recebe_email_listas boolean not null default true;

comment on column public.colaboradores.recebe_email_listas is
  'false tira a pessoa dos e-mails enviados em lista (admins do Financeiro, '
  'diretoria/gerência e admins de Programas). Não afeta o aviso ao aprovador '
  'nomeado de uma etapa, nem os avisos ao solicitante ou ao técnico.';

update public.colaboradores
   set recebe_email_listas = false
 where email = 'pedro.morais@phdengenharia.eng.br';
