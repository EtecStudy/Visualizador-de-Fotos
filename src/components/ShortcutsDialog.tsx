import { Keyboard } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';
import { Modal } from './ui/primitives';

const SECTIONS = [
  {
    title: 'Visualização',
    items: [
      ['← / →', 'Foto anterior / próxima'],
      ['+ / −', 'Aumentar / diminuir zoom'],
      ['0', 'Ajustar à tela'],
      ['1', 'Tamanho original (100%)'],
      ['Arrastar', 'Mover a imagem com zoom'],
      ['Duplo clique', 'Alternar ajustar / 100%'],
      ['C', 'Comparar antes e depois'],
      ['G', 'Grade de terços'],
      ['D', 'Detalhe 1:1 (lupa)'],
      ['F', 'Tela cheia'],
      ['I', 'Informações da imagem'],
      ['T', 'Mostrar / ocultar filmes'],
    ],
  },
  {
    title: 'Edição',
    items: [
      ['E', 'Entrar / sair da edição'],
      ['R / Shift+R', 'Girar 90° à direita / esquerda'],
      ['Enter', 'Aplicar recorte'],
      ['Ctrl+Z', 'Desfazer'],
      ['Ctrl+Shift+Z', 'Refazer'],
      ['Esc', 'Cancelar recorte / sair da edição'],
      ['Ctrl+S', 'Salvar como…'],
    ],
  },
  {
    title: 'Arquivos e IA',
    items: [
      ['O / Ctrl+O', 'Abrir imagens'],
      ['U', 'Upscale por IA'],
      ['Delete', 'Fechar imagem atual'],
      ['?', 'Mostrar atalhos'],
    ],
  },
];

export function ShortcutsDialog() {
  const open = useAppStore((state) => state.shortcutsOpen);
  const setOpen = useAppStore((state) => state.setShortcutsOpen);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Atalhos de teclado"
      subtitle="Tudo o que você precisa sem tirar as mãos do teclado."
      icon={<Keyboard size={18} />}
      size="sm"
    >
      <div className="shortcuts">
        {SECTIONS.map((section) => (
          <section key={section.title} className="shortcuts__section">
            <h3>{section.title}</h3>
            <dl>
              {section.items.map(([keys, description]) => (
                <div key={keys} className="shortcuts__row">
                  <dt>
                    <kbd>{keys}</kbd>
                  </dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="shortcuts__note">
        As teclas <kbd>+</kbd>, <kbd>−</kbd> e os números funcionam também no teclado numérico.
      </p>
    </Modal>
  );
}
