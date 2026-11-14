import { createElement, useRef, type ChangeEvent } from 'react';

import { Botao } from './componentes';

const LADO_MAXIMO = 1280;

async function reduzir(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const tela = document.createElement('canvas');
  tela.width = Math.round(bitmap.width * escala);
  tela.height = Math.round(bitmap.height * escala);
  tela.getContext('2d')!.drawImage(bitmap, 0, 0, tela.width, tela.height);
  return tela.toDataURL('image/jpeg', 0.72);
}

/** Abre a câmera do celular (ou a galeria no computador) e devolve a foto já reduzida. */
export function BotaoFoto({ titulo, aoCapturar, aoFalhar }: { titulo: string; aoCapturar: (dados: string) => void; aoFalhar?: () => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      aoCapturar(await reduzir(arquivo));
    } catch {
      aoFalhar?.();
    }
  }
  return (
    <>
      {createElement('input', {
        ref: entrada,
        type: 'file',
        accept: 'image/*',
        capture: 'environment',
        onChange: escolher,
        style: { display: 'none' },
        'data-testid': 'entrada-foto',
      })}
      <Botao titulo={titulo} icone="camera" variante="secundario" onPress={() => entrada.current?.click()} />
    </>
  );
}

export const FOTO_DISPONIVEL = true;
