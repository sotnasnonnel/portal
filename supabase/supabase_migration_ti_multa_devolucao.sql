-- TI: data da devolução e prazo de 24 meses para a multa por devolução antecipada.
--
-- Multa = mensalidade × 3 ÷ 24 × meses restantes até o vencimento
-- (src/modules/ti/lib/multa.js). O vencimento é início do prazo + 24 meses.
--
-- APLICAR ANTES DO DEPLOY DO FRONT: o Movimentar novo grava data_devolucao.
--
-- Carga dos prazos: tabela de multa enviada pela Selbet (18 equipamentos
-- devolvidos). Ela não traz número de série, então o cruzamento é pelo modelo
-- (descrição): todos começam em 01/04/2026, menos o Inspiron 3520 de R$ 209,80,
-- que começa em 16/04/2026. Só entram os Selbet devolvidos/recolhidos (mais o
-- Inspiron 3520, o único de R$ 209,80 na base). Os modelos que não estão na
-- tabela (Acer Vero, Latitude 7490, Vostro 5510, Latitude 5491) ficam sem início.

alter table public.ti_ativos add column if not exists data_devolucao date;

comment on column public.ti_ativos.inicio_contrato is
  'Início do prazo de 24 meses do aluguel (entrega do equipamento). Vencimento = início + 24 meses.';
comment on column public.ti_ativos.data_devolucao is
  'Data em que o equipamento foi devolvido (Devolução/Recolhido). Base da multa por devolução antecipada.';

update public.ti_ativos
   set inicio_contrato = date '2026-04-01',
       vencimento_contrato = date '2028-04-01'
 where fornecedor = 'Selbet'
   and situacao in ('Devolução', 'Recolhido')
   and inicio_contrato is null
   and descricao in (
     'NOTEBOOK ACER NITRO V15 CORE I7 13620H 16GB 1TB SSD RTX3050',
     'NOTEBOOK DELL INSPIRON 3520 I5-1235U RAM 8GB SSD 512GB 15.6POL WIN11 PRO',
     'NOTEBOOK LENOVO E480 I7-8550U 8GB 1TB HDD W10 PRO GFX - 1 ANO ON-SITE',
     'NOTEBOOK LENOVO GAMING 3I INTEL CORE I5-11300 8GB GTX1650',
     'NOTEBOOK LENOVO IDEAPAD 3 RYZEN 5 5500U 8GB 256GB 15.6P',
     'WORKSTATION NOTEBOOK GABINETE DELL PRECISION 5510 S/ ETIQ COA',
     'MONITOR AOC 21,5 LED FULL HD E2270SWHEN / HDMI / VESA',
     'MONITOR LG 22 POL',
     'NOTEBOOK DELL INSPIRON 3525 RYZEN5 5500U 8GB 256GB SSD 15P',
     'NOTEBOOK LENOVO IDEAPAD 3I CORE I5 10GEN 8GB SSD 256GB 15P'
   );

update public.ti_ativos
   set inicio_contrato = date '2026-04-16',
       vencimento_contrato = date '2028-04-16'
 where fornecedor = 'Selbet'
   and inicio_contrato is null
   and descricao = 'NOTEBOOK DELL INSPIRON 3520 I5-1235U RAM 8GB SSD 512GB 15.6POL WIN11 PRO'
   and valor_mensal = 209.80;
