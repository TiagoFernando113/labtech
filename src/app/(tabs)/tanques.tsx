import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { hoje as dataDeHoje } from '@/core/datas';
import { dataCurta } from '@/features/lab/apresentacao';
import { listarCps, listarTanques } from '@/features/lab/lab.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Botao, Selo, Tela, Texto } from '@/ui/componentes';
import { Espaco, Raio, useTema } from '@/ui/tema';

export default function Tanques() {
  const { db, t, idioma, pode } = useApp();
  const tema = useTema();
  const hoje = dataDeHoje();
  const dados = useConsulta(
    useCallback(async () => ({ tanques: await listarTanques(db, hoje), fora: (await listarCps(db, { foraDoTanque: true, limite: 1000 })).length }), [db, hoje]),
  );
  const maior = Math.max(1, ...(dados?.tanques.map((x) => x.quantidade) ?? [1]));

  return (
    <Tela
      rodape={
        pode('tanques.registrar') ? <Botao titulo={t.tanques.guardar} icone="enter" onPress={() => router.push('/guardar')} desabilitado={!dados?.fora} /> : undefined
      }>
      {dados === undefined ? <Texto cor="textoSuave">{t.comum.carregando}</Texto> : null}
      {(dados?.tanques ?? []).map((q) => (
        <Pressable
          key={q.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/tanque/[id]', params: { id: q.id } })}
          style={({ pressed }) => ({
            backgroundColor: tema.superficie,
            borderColor: q.vencidos ? tema.perigo : tema.borda,
            borderWidth: 1,
            borderRadius: Raio.g,
            padding: Espaco.g,
            gap: Espaco.m,
            opacity: pressed ? 0.75 : 1,
          })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.m }}>
            <View style={{ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.destaqueSuave }}>
              <Ionicons name="water" size={24} color={tema.destaque} />
            </View>
            <View style={{ flex: 1 }}>
              <Texto tipo="forte">{q.nome}</Texto>
              <Texto tipo="pequeno" cor="textoSuave">
                {q.quantidade ? fmt(t.tanques.proximaSaida, { data: dataCurta(q.proxima_saida ?? hoje, hoje, t, idioma) }) : t.tanques.vazio}
              </Texto>
            </View>
            <Text style={{ color: tema.texto, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{q.quantidade}</Text>
            <Ionicons name="chevron-forward" size={18} color={tema.textoSuave} />
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: tema.faixa, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round((q.quantidade / maior) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: tema.destaque }} />
          </View>
          {q.vencidos ? <Selo texto={fmt(t.tanques.vencidos, { n: q.vencidos })} tom="perigo" icone="alert-circle" /> : null}
        </Pressable>
      ))}
      {dados ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Espaco.xs }}>
          <Texto tipo="pequeno" cor="textoSuave">
            {t.tanques.fora}
          </Texto>
          <Selo texto={fmt(t.tanques.cps, { n: dados.fora })} tom={dados.fora ? 'alerta' : 'neutro'} />
        </View>
      ) : null}
    </Tela>
  );
}
