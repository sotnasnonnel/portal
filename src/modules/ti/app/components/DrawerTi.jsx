import { useTi } from './TiContext';
import FormAtivo from './FormAtivo';
import DetalheAtivo from './DetalheAtivo';

export default function DrawerTi() {
  const { drawer } = useTi();
  if (!drawer) return null;
  // `key`: trocar de registro recomeça o rascunho em vez de herdar o anterior.
  const chave = `${drawer.modo}-${drawer.id || 'novo'}`;
  if (drawer.modo === 'form') return <FormAtivo key={chave} id={drawer.id} init={drawer.init} />;
  return <DetalheAtivo key={chave} id={drawer.id} />;
}
