import { useFrota } from './FrotaContext';
import FormFrota from './FormFrota';
import DetalheVeiculo from './DetalheVeiculo';
import DetalheCondutor from './DetalheCondutor';

export default function DrawerFrota() {
  const { drawer } = useFrota();
  if (!drawer) return null;
  // `key`: trocar de registro recomeça o rascunho em vez de herdar o anterior.
  const chave = `${drawer.modo}-${drawer.col}-${drawer.id || 'novo'}`;
  if (drawer.modo === 'form') return <FormFrota key={chave} col={drawer.col} id={drawer.id} init={drawer.init} />;
  if (drawer.col === 'veiculos') return <DetalheVeiculo key={chave} id={drawer.id} />;
  return <DetalheCondutor key={chave} id={drawer.id} />;
}
