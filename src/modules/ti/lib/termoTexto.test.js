import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELOS, textoDoModelo, textoDoTermo, textoParaAceite } from './termoTexto.js';

test('texto do aceite: o texto inteiro do modelo, nos cinco campos do PDF', () => {
  for (const m of MODELOS) {
    const t = textoParaAceite(m);
    assert.deepEqual(Object.keys(t).sort(), ['abertura', 'assinatura', 'clausulas', 'declaracao', 'identificacao']);
    assert.equal(t.abertura, textoDoModelo(m).abertura);
    assert.deepEqual(t.clausulas, textoDoModelo(m).clausulas);
    // Vai para o banco como JSON: nada pode se perder na ida.
    assert.deepEqual(JSON.parse(JSON.stringify(t)), t);
  }
});

test('termo registrado usa o texto guardado, não o atual', () => {
  const guardado = { ...textoParaAceite('CLT'), abertura: 'Texto antigo que a pessoa leu.' };
  assert.equal(textoDoTermo({ modelo: 'CLT', texto_aceito: guardado }).abertura, 'Texto antigo que a pessoa leu.');
  assert.equal(textoDoTermo({ modelo: 'PJ' }).abertura, textoDoModelo('PJ').abertura);
});
