import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
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

// ── Elementos de sistema de laboratório: densos, legíveis e tocáveis ─────────

/** Sigla da obra: o identificador visual mais importante do sistema. */
export function Sigla({ texto, tamanho = 'm', apagada }: { texto: string; tamanho?: 'p' | 'm' | 'g'; apagada?: boolean }) {
  const tema = useTema();
  const d = { p: { w: 40, h: 26, f: 12 }, m: { w: 52, h: 36, f: 15 }, g: { w: 76, h: 52, f: 22 } }[tamanho];
  return (
    <View
      style={{
        minWidth: d.w,
        height: d.h,
        paddingHorizontal: 6,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: apagada ? tema.borda : tema.marinho,
      }}>
      <Text style={{ color: apagada ? tema.textoSuave : tema.sobreMarinho, fontSize: d.f, fontWeight: '800', letterSpacing: 0.5 }}>{texto}</Text>
    </View>
  );
}

export type Tom = 'neutro' | 'primaria' | 'ok' | 'alerta' | 'perigo' | 'destaque';

export function coresDoTom(tema: Tema, tom: Tom): { fundo: string; texto: string } {
  if (tom === 'neutro') return { fundo: tema.faixa, texto: tema.textoSuave };
  return { fundo: tema[`${tom}Suave`], texto: tema[tom] };
}

/** Etiqueta curta de situação. */
export function Selo({ texto, tom = 'neutro', icone }: { texto: string; tom?: Tom; icone?: NomeIcone }) {
  const tema = useTema();
  const c = coresDoTom(tema, tom);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.fundo, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      {icone ? <Ionicons name={icone} size={13} color={c.texto} /> : null}
      <Text style={{ color: c.texto, fontSize: 12, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

/** Título de seção com ação opcional à direita. */
export function Secao({ titulo, acao, aoTocar, contador }: { titulo: string; acao?: string; aoTocar?: () => void; contador?: number }) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Texto tipo="rotulo" cor="textoSuave">
          {titulo}
        </Texto>
        {contador !== undefined ? (
          <View style={{ backgroundColor: tema.borda, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
            <Text style={{ color: tema.texto, fontSize: 12, fontWeight: '800' }}>{contador}</Text>
          </View>
        ) : null}
      </View>
      {acao && aoTocar ? (
        <Pressable onPress={aoTocar} hitSlop={12} accessibilityRole="button">
          <Text style={{ color: tema.primaria, fontSize: 14, fontWeight: '700' }}>{acao}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Bloco de lista: linhas separadas por fio, dentro de uma única superfície. */
export function Lista({ children, vazio }: { children?: ReactNode; vazio?: string }) {
  const tema = useTema();
  const itens = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <View style={{ backgroundColor: tema.superficie, borderColor: tema.borda, borderWidth: 1, borderRadius: Raio.m, overflow: 'hidden' }}>
      {itens.length === 0 && vazio ? (
        <Text style={{ color: tema.textoSuave, fontSize: 14, padding: Espaco.g }}>{vazio}</Text>
      ) : (
        itens.map((item, i) => (
          <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: tema.borda } : undefined}>
            {item}
          </View>
        ))
      )}
    </View>
  );
}

/** Linha de lista: algo à esquerda, título + detalhe, algo à direita. */
export function Linha({
  esquerda,
  titulo,
  detalhe,
  direita,
  aoTocar,
  selecionada,
}: {
  esquerda?: ReactNode;
  titulo: string;
  detalhe?: string | null;
  direita?: ReactNode;
  aoTocar?: () => void;
  selecionada?: boolean;
}) {
  const tema = useTema();
  const corpo = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espaco.m,
        paddingHorizontal: Espaco.m,
        paddingVertical: 10,
        minHeight: 52,
        backgroundColor: selecionada ? tema.primariaSuave : undefined,
      }}>
      {esquerda}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: tema.texto, fontSize: 15, fontWeight: '700' }}>
          {titulo}
        </Text>
        {detalhe ? (
          <Text numberOfLines={2} style={{ color: tema.textoSuave, fontSize: 13, lineHeight: 18 }}>
            {detalhe}
          </Text>
        ) : null}
      </View>
      {direita}
      {aoTocar && !direita ? <Ionicons name="chevron-forward" size={18} color={tema.textoSuave} /> : null}
    </View>
  );
  if (!aoTocar) return corpo;
  return (
    <Pressable onPress={aoTocar} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {corpo}
    </Pressable>
  );
}

/** Indicador compacto para grades de painel. */
export function Kpi({ valor, legenda, tom = 'neutro', aoTocar }: { valor: number | string; legenda: string; tom?: Tom; aoTocar?: () => void }) {
  const tema = useTema();
  const c = coresDoTom(tema, tom);
  const ativo = tom !== 'neutro' && valor !== 0 && valor !== '–';
  return (
    <Pressable
      onPress={aoTocar}
      disabled={!aoTocar}
      accessibilityRole={aoTocar ? 'button' : undefined}
      accessibilityLabel={`${legenda}: ${valor}`}
      style={({ pressed }) => ({
        flexBasis: '30%',
        flexGrow: 1,
        minWidth: 96,
        backgroundColor: ativo ? c.fundo : tema.superficie,
        borderColor: ativo ? c.texto : tema.borda,
        borderWidth: 1,
        borderRadius: Raio.m,
        paddingHorizontal: 10,
        paddingVertical: 10,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text style={{ color: ativo ? c.texto : tema.texto, fontSize: 24, lineHeight: 28, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{valor}</Text>
      <Text numberOfLines={2} style={{ color: tema.textoSuave, fontSize: 11.5, lineHeight: 14, fontWeight: '600' }}>
        {legenda}
      </Text>
    </Pressable>
  );
}

/** Escolha única entre poucas opções, lado a lado. */
export function Segmento<T extends string | number>({ opcoes, valor, aoMudar }: { opcoes: { valor: T; rotulo: string }[]; valor: T; aoMudar: (v: T) => void }) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: tema.superficie, borderColor: tema.borda, borderWidth: 1, borderRadius: Raio.m, overflow: 'hidden' }}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable
            key={String(o.valor)}
            onPress={() => aoMudar(o.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
            style={{ flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, backgroundColor: ativo ? tema.marinho : undefined }}>
            <Text numberOfLines={1} style={{ color: ativo ? tema.sobreMarinho : tema.textoSuave, fontSize: 14, fontWeight: '700' }}>
              {o.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Opções em pastilhas que quebram de linha; seleção única ou múltipla. */
export function Pastilhas<T extends string | number>({
  opcoes,
  selecionadas,
  aoTocar,
}: {
  opcoes: { valor: T; rotulo: string }[];
  selecionadas: T[];
  aoTocar: (v: T) => void;
}) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.p }}>
      {opcoes.map((o) => {
        const ativo = selecionadas.includes(o.valor);
        return (
          <Pressable
            key={String(o.valor)}
            onPress={() => aoTocar(o.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
            style={{
              minHeight: 46,
              minWidth: 56,
              paddingHorizontal: 14,
              borderRadius: Raio.m,
              borderWidth: 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: ativo ? tema.primaria : tema.superficie,
              borderColor: ativo ? tema.primaria : tema.borda,
            }}>
            <Text style={{ color: ativo ? tema.sobrePrimaria : tema.texto, fontSize: 15, fontWeight: '700' }}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Menos / valor / mais: para datas e quantidades sem teclado. */
export function Passo({ rotulo, valor, aoMenos, aoMais }: { rotulo: string; valor: string; aoMenos: () => void; aoMais: () => void }) {
  const tema = useTema();
  const botao = (icone: NomeIcone, onPress: () => void, nome: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}: ${nome}`}
      style={({ pressed }) => ({ width: 52, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.faixa, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icone} size={22} color={tema.texto} />
    </Pressable>
  );
  return (
    <View style={{ gap: Espaco.xs }}>
      <Texto tipo="pequeno" cor="textoSuave">
        {rotulo}
      </Texto>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.superficie, borderColor: tema.borda, borderWidth: 2, borderRadius: Raio.m, overflow: 'hidden' }}>
        {botao('remove', aoMenos, '-')}
        <Text style={{ flex: 1, textAlign: 'center', color: tema.texto, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{valor}</Text>
        {botao('add', aoMais, '+')}
      </View>
    </View>
  );
}

/** Par rótulo/valor para fichas. */
export function Dado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <View style={{ flexBasis: '46%', flexGrow: 1, gap: 1 }}>
      <Texto tipo="pequeno" cor="textoSuave" style={{ fontSize: 12 }}>
        {rotulo}
      </Texto>
      <Texto tipo="forte" style={{ fontSize: 15 }} selectable>
        {valor || '–'}
      </Texto>
    </View>
  );
}

/** Caixa de pesquisa. */
export function Pesquisa({ valor, aoMudar, dica }: { valor: string; aoMudar: (t: string) => void; dica: string }) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.p, backgroundColor: tema.superficie, borderColor: tema.borda, borderWidth: 2, borderRadius: Raio.m, paddingHorizontal: Espaco.m, minHeight: 48 }}>
      <Ionicons name="search" size={20} color={tema.textoSuave} />
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        placeholder={dica}
        placeholderTextColor={tema.textoSuave}
        accessibilityLabel={dica}
        autoCapitalize="none"
        autoCorrect={false}
        style={[{ flex: 1, color: tema.texto, fontSize: 16, minHeight: 44 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
      />
      {valor ? (
        <Pressable onPress={() => aoMudar('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="×">
          <Ionicons name="close-circle" size={20} color={tema.textoSuave} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Miniaturas das fotos de um registro; tocar amplia. */
export function Galeria({ fotos, aoAbrir }: { fotos: string[]; aoAbrir?: (indice: number) => void }) {
  const tema = useTema();
  if (!fotos.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.p }}>
      {fotos.map((f, i) => (
        <Pressable key={i} onPress={() => aoAbrir?.(i)} disabled={!aoAbrir} accessibilityRole="imagebutton">
          <Image source={{ uri: f }} style={{ width: 84, height: 84, borderRadius: Raio.m, borderWidth: 1, borderColor: tema.borda, backgroundColor: tema.faixa }} />
        </Pressable>
      ))}
    </View>
  );
}

/** Foto ampliada em tela cheia; tocar fecha. */
export function FotoAmpliada({ foto, aoFechar }: { foto: string | null; aoFechar: () => void }) {
  return (
    <Modal visible={foto !== null} transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable onPress={aoFechar} accessibilityRole="button" style={{ flex: 1, backgroundColor: 'rgba(4,10,24,0.94)', alignItems: 'center', justifyContent: 'center' }}>
        {foto ? <Image source={{ uri: foto }} resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : null}
      </Pressable>
    </Modal>
  );
}
