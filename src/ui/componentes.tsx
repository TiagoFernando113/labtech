import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ALVO_TOQUE, Espaco, Raio, useTema, type Tema } from './tema';

export type NomeIcone = ComponentProps<typeof Ionicons>['name'];

const TAMANHOS = {
  titulo: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  subtitulo: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  corpo: { fontSize: 17, lineHeight: 24, fontWeight: '500' },
  forte: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  pequeno: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  rotulo: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
} as const;

export function Texto({
  tipo = 'corpo',
  cor = 'texto',
  style,
  ...resto
}: TextProps & { tipo?: keyof typeof TAMANHOS; cor?: keyof Tema }) {
  const tema = useTema();
  return <Text style={[TAMANHOS[tipo], { color: tema[cor] }, style]} {...resto} />;
}

/** Tela rolável com margens seguras e teclado tratado. */
export function Tela({ children, rodape }: { children: ReactNode; rodape?: ReactNode }) {
  const tema = useTema();
  const margens = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tema.fundo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: Espaco.g,
          paddingBottom: Espaco.xxg,
          gap: Espaco.g,
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
        }}>
        {children}
      </ScrollView>
      {rodape ? (
        <View
          style={{
            padding: Espaco.g,
            paddingBottom: Espaco.g + margens.bottom,
            gap: Espaco.m,
            backgroundColor: tema.superficie,
            borderTopWidth: 1,
            borderTopColor: tema.borda,
          }}>
          {rodape}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Cartao({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const tema = useTema();
  return (
    <View style={[estilos.cartao, { backgroundColor: tema.superficie, borderColor: tema.borda }, style]}>{children}</View>
  );
}

export function Botao({
  titulo,
  onPress,
  icone,
  variante = 'primario',
  desabilitado,
}: {
  titulo: string;
  onPress: () => void;
  icone?: NomeIcone;
  variante?: 'primario' | 'secundario' | 'perigo';
  desabilitado?: boolean;
}) {
  const tema = useTema();
  const fundo = variante === 'primario' ? tema.primaria : tema.superficie;
  const cor = variante === 'primario' ? tema.sobrePrimaria : variante === 'perigo' ? tema.perigo : tema.texto;
  const borda = variante === 'primario' ? tema.primaria : variante === 'perigo' ? tema.perigo : tema.borda;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!desabilitado }}
      disabled={desabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: fundo, borderColor: borda, opacity: desabilitado ? 0.45 : pressed ? 0.8 : 1 },
      ]}>
      {icone ? <Ionicons name={icone} size={24} color={cor} /> : null}
      <Text style={[TAMANHOS.forte, { color: cor }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Campo({ rotulo, erro, ...resto }: TextInputProps & { rotulo: string; erro?: string | null }) {
  const tema = useTema();
  return (
    <View style={{ gap: Espaco.xs }}>
      <Texto tipo="pequeno" cor="textoSuave">
        {rotulo}
      </Texto>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={tema.textoSuave}
        style={[
          estilos.campo,
          { backgroundColor: tema.superficie, color: tema.texto, borderColor: erro ? tema.perigo : tema.borda },
        ]}
        {...resto}
      />
      {erro ? (
        <Texto tipo="pequeno" cor="perigo">
          {erro}
        </Texto>
      ) : null}
    </View>
  );
}

/** Número grande com legenda, para o painel. */
export function Indicador({
  valor,
  legenda,
  icone,
  cor = 'primaria',
}: {
  valor: string | number;
  legenda: string;
  icone: NomeIcone;
  cor?: keyof Tema;
}) {
  const tema = useTema();
  return (
    <Cartao style={{ flex: 1, minWidth: 140, gap: Espaco.xs }}>
      <Ionicons name={icone} size={26} color={tema[cor]} />
      <Text style={{ fontSize: 36, lineHeight: 40, fontWeight: '800', color: tema.texto, fontVariant: ['tabular-nums'] }}>
        {valor}
      </Text>
      <Texto tipo="pequeno" cor="textoSuave">
        {legenda}
      </Texto>
    </Cartao>
  );
}

export function Aviso({ texto, icone = 'information-circle', cor = 'alerta' }: { texto: string; icone?: NomeIcone; cor?: keyof Tema }) {
  const tema = useTema();
  return (
    <View style={[estilos.aviso, { borderColor: tema[cor], backgroundColor: tema.superficie }]}>
      <Ionicons name={icone} size={22} color={tema[cor]} />
      <Texto tipo="pequeno" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderRadius: Raio.g, borderWidth: 1, padding: Espaco.g },
  botao: {
    minHeight: ALVO_TOQUE,
    borderRadius: Raio.m,
    borderWidth: 2,
    paddingHorizontal: Espaco.g,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espaco.p,
  },
  campo: {
    minHeight: ALVO_TOQUE,
    borderRadius: Raio.m,
    borderWidth: 2,
    paddingHorizontal: Espaco.g,
    fontSize: 18,
  },
  aviso: { flexDirection: 'row', gap: Espaco.m, alignItems: 'center', borderRadius: Raio.m, borderWidth: 1, padding: Espaco.m },
});
