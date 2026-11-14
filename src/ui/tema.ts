import { useColorScheme } from 'react-native';

/** Identidade LABTECH: azul-marinho, azul elétrico, ciano, branco e cinza industrial. */
export const Cores = {
  light: {
    fundo: '#EEF2F7',
    superficie: '#FFFFFF',
    marinho: '#0B1F3F',
    texto: '#0B1B33',
    textoSuave: '#56667F',
    borda: '#CFD8E3',
    primaria: '#0A5CFF',
    sobrePrimaria: '#FFFFFF',
    destaque: '#0891B2',
    ok: '#0E8A4B',
    alerta: '#A15C00',
    perigo: '#C62828',
    sobreMarinho: '#FFFFFF',
    sobreMarinhoSuave: '#B7C6DD',
    faixa: '#F5F8FC',
    primariaSuave: '#E3EDFF',
    okSuave: '#DDF3E7',
    alertaSuave: '#FBEBCF',
    perigoSuave: '#FBE1DE',
    destaqueSuave: '#D6F1F7',
  },
  dark: {
    fundo: '#07122A',
    superficie: '#0F2247',
    marinho: '#0B1F3F',
    texto: '#F1F5FB',
    textoSuave: '#9FB0CC',
    borda: '#21386A',
    primaria: '#3D8BFF',
    sobrePrimaria: '#04122B',
    destaque: '#22D3EE',
    ok: '#3DD68C',
    alerta: '#F2B33D',
    perigo: '#FF7B72',
    sobreMarinho: '#FFFFFF',
    sobreMarinhoSuave: '#B7C6DD',
    faixa: '#0B1A38',
    primariaSuave: '#16305F',
    okSuave: '#123A2A',
    alertaSuave: '#3D2F10',
    perigoSuave: '#42201D',
    destaqueSuave: '#0F3541',
  },
} as const;

export type Tema = { [K in keyof typeof Cores.light]: string };

export const Espaco = { xs: 4, p: 8, m: 12, g: 16, xg: 24, xxg: 32 } as const;
export const Raio = { m: 12, g: 18 } as const;
/** Altura mínima de qualquer coisa tocável: pensado para uso na obra, com luva ou mão suja. */
export const ALVO_TOQUE = 56;

export function useTema(): Tema {
  return Cores[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
