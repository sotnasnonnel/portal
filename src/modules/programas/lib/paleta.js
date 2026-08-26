/**
 * Cor da BORDA do cartão no kanban — a legenda que a planilha pede para
 * distinguir ideia de iniciativa (aba Campo de Ideias, B36).
 *
 * O par foi validado, não escolhido no olho (validate_palette.js, superfície
 * #fcfcfb, --pairs all):
 *   Lightness band PASS · Chroma floor PASS
 *   CVD separation PASS  ΔE 20.8 (protan) · 26.8 (tritan)
 *   Normal-vision  PASS  ΔE 25.0
 *   Contraste vs superfície PASS (>= 3:1)
 *
 * A cor do CARTÃO (a outra legenda, por setor) fica em config/programas.js,
 * junto da lista de setores.
 */
export const COR_FORMA = {
  ideia: '#3b74b8',
  iniciativa: '#b4522a',
};
