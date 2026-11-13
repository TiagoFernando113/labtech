import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Lê do banco local sempre que a tela ganha foco. Devolve `undefined` até a primeira leitura. */
export function useConsulta<T>(ler: () => Promise<T>): T | undefined {
  const [dado, setDado] = useState<T>();
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      ler().then((d) => {
        if (vivo) setDado(d);
      });
      return () => {
        vivo = false;
      };
    }, [ler]),
  );
  return dado;
}
