import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { listarObras } from '@/features/obras/obras.repo';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Botao, Cartao, Tela, Texto } from '@/ui/componentes';
import { ALVO_TOQUE, Espaco, useTema } from '@/ui/tema';

export default function Obras() {
  const { db, t, pode } = useApp();
  const tema = useTema();
  const [encerradas, setEncerradas] = useState(false);
  const obras = useConsulta(useCallback(() => listarObras(db, { incluirEncerradas: encerradas }), [db, encerradas]));
  const gerencia = pode('obras.gerenciar');

  return (
    <Tela rodape={gerencia ? <Botao titulo={t.obras.nova} icone="add-circle" onPress={() => router.push('/obra/nova')} /> : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: ALVO_TOQUE }}>
        <Texto>{t.obras.mostrarEncerradas}</Texto>
        <Switch value={encerradas} onValueChange={setEncerradas} accessibilityLabel={t.obras.mostrarEncerradas} />
      </View>

      {obras === undefined ? (
        <Texto cor="textoSuave">{t.comum.carregando}</Texto>
      ) : obras.length === 0 ? (
        <Cartao style={{ alignItems: 'center', gap: Espaco.p, paddingVertical: Espaco.xxg }}>
          <Ionicons name="business-outline" size={48} color={tema.textoSuave} />
          <Texto tipo="forte">{t.obras.vazio}</Texto>
          {gerencia ? (
            <Texto tipo="pequeno" cor="textoSuave" style={{ textAlign: 'center' }}>
              {t.obras.vazioDica}
            </Texto>
          ) : null}
        </Cartao>
      ) : (
        obras.map((o) => (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            disabled={!gerencia}
            onPress={() => router.push({ pathname: '/obra/[id]', params: { id: o.id } })}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.m, minHeight: ALVO_TOQUE + 16 }}>
              <Ionicons name="business" size={28} color={o.ativa ? tema.primaria : tema.textoSuave} />
              <View style={{ flex: 1, gap: 2 }}>
                <Texto tipo="forte">{o.nome}</Texto>
                {o.codigo || o.endereco ? (
                  <Texto tipo="pequeno" cor="textoSuave">
                    {[o.codigo, o.endereco].filter(Boolean).join(' · ')}
                  </Texto>
                ) : null}
                {!o.ativa ? (
                  <Texto tipo="pequeno" cor="alerta">
                    {t.obras.encerrada}
                  </Texto>
                ) : null}
              </View>
              {gerencia ? <Ionicons name="chevron-forward" size={22} color={tema.textoSuave} /> : null}
            </Cartao>
          </Pressable>
        ))
      )}
    </Tela>
  );
}
