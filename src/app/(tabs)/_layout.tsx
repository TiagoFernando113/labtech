import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { useApp } from '@/services/app';
import { useTema } from '@/ui/tema';

type Icone = ComponentProps<typeof Ionicons>['name'];

export default function AbasLayout() {
  const { t } = useApp();
  const tema = useTema();
  const aba = (name: string, title: string, icone: Icone, headerTitle?: string) => (
    <Tabs.Screen
      key={name}
      name={name}
      options={{
        title,
        headerTitle: headerTitle ?? title,
        tabBarIcon: ({ focused }) => <Ionicons name={icone} size={24} color={focused ? tema.primaria : tema.textoSuave} />,
      }}
    />
  );
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tema.marinho },
        headerTintColor: tema.sobreMarinho,
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: tema.primaria,
        tabBarInactiveTintColor: tema.textoSuave,
        tabBarStyle: { backgroundColor: tema.superficie, borderTopColor: tema.borda, minHeight: 62 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        sceneStyle: { backgroundColor: tema.fundo },
      }}>
      {aba('index', t.abas.painel, 'grid', t.app.nome)}
      {aba('cps', t.abas.cps, 'cube', t.cp.titulo)}
      {aba('rompimentos', t.abas.rompimentos, 'calendar', t.romp.titulo)}
      {aba('tanques', t.abas.tanques, 'water', t.tanques.titulo)}
      {aba('mais', t.abas.mais, 'menu')}
    </Tabs>
  );
}
