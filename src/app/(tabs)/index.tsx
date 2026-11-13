import { router } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { contarPendentes } from '@/core/sync/fila';
import { contarObrasAtivas } from '@/features/obras/obras.repo';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Aviso, Botao, Indicador, Tela, Texto } from '@/ui/componentes';
import { Espaco } from '@/ui/tema';

export default function Painel() {
  const { db, t, modoLocal, pode, empresaNome, papel } = useApp();
  const numeros = useConsulta(
    useCallback(async () => ({ obras: await contarObrasAtivas(db), pendentes: await contarPendentes(db) }), [db]),
  );

  return (
    <Tela>
      <View style={{ gap: Espaco.xs }}>
        <Texto tipo="titulo">{t.painel.ola}</Texto>
        <Texto cor="textoSuave">
          {[empresaNome, papel ? t.papeis[papel] : null].filter(Boolean).join(' · ') || t.app.subtitulo}
        </Texto>
      </View>

      {modoLocal ? <Aviso texto={t.painel.avisoLocal} icone="phone-portrait" /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Espaco.m }}>
        <Indicador valor={numeros?.obras ?? '–'} legenda={t.painel.obrasAtivas} icone="business" />
        <Indicador
          valor={numeros?.pendentes ?? '–'}
          legenda={numeros?.pendentes ? t.painel.aguardandoEnvio : t.painel.tudoEnviado}
          icone={numeros?.pendentes ? 'cloud-upload' : 'cloud-done'}
          cor={numeros?.pendentes ? 'alerta' : 'ok'}
        />
      </View>

      <Texto tipo="rotulo" cor="textoSuave">
        {t.painel.atalhos}
      </Texto>
      {pode('obras.gerenciar') ? (
        <Botao titulo={t.painel.novaObra} icone="add-circle" onPress={() => router.push('/obra/nova')} />
      ) : null}
      <Botao titulo={t.painel.verObras} icone="business" variante="secundario" onPress={() => router.push('/obras')} />
    </Tela>
  );
}
