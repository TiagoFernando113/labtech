import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Switch, View } from 'react-native';

import { resumoPorObra } from '@/features/lab/lab.repo';
import { listarObras, siglaDe } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Botao, Linha, Lista, Selo, Sigla, Tela, Texto } from '@/ui/componentes';
import { ALVO_TOQUE } from '@/ui/tema';

export default function Obras() {
  const { db, t, pode } = useApp();
  const [encerradas, setEncerradas] = useState(false);
  const dados = useConsulta(
    useCallback(
      async () => ({ obras: await listarObras(db, { incluirEncerradas: encerradas }), resumo: new Map((await resumoPorObra(db)).map((r) => [r.obra_id, r])) }),
      [db, encerradas],
    ),
  );

  return (
    <Tela rodape={pode('obras.gerenciar') ? <Botao titulo={t.obras.nova} icone="add-circle" onPress={() => router.push('/obra/nova')} /> : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: ALVO_TOQUE }}>
        <Texto>{t.obras.mostrarEncerradas}</Texto>
        <Switch value={encerradas} onValueChange={setEncerradas} accessibilityLabel={t.obras.mostrarEncerradas} />
      </View>
      <Lista vazio={dados ? `${t.obras.vazio} ${pode('obras.gerenciar') ? t.obras.vazioDica : ''}` : t.comum.carregando}>
        {(dados?.obras ?? []).map((o) => {
          const r = dados?.resumo.get(o.id);
          return (
            <Linha
              key={o.id}
              esquerda={<Sigla texto={siglaDe(o)} apagada={!o.ativa} />}
              titulo={o.nome}
              detalhe={[o.cliente, r ? fmt(t.obras.resumo, { r: r.recebimentos, c: r.cps, p: r.pendentes }) : t.obras.semRegistros].filter(Boolean).join(' · ')}
              direita={!o.ativa ? <Selo texto={t.obras.encerrada} tom="alerta" /> : undefined}
              aoTocar={() => router.push({ pathname: '/obra/[id]', params: { id: o.id } })}
            />
          );
        })}
      </Lista>
    </Tela>
  );
}
