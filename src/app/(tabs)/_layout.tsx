import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';

import { useApp } from '@/services/app';
import { useTema } from '@/ui/tema';

export default function AbasLayout() {
  const { t } = useApp();
  const tema = useTema();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tema.marinho },
        headerTintColor: tema.sobreMarinho,
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: tema.primaria,
        tabBarInactiveTintColor: tema.textoSuave,
        tabBarStyle: { backgroundColor: tema.superficie, borderTopColor: tema.borda, minHeight: 64 },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
        sceneStyle: { backgroundColor: tema.fundo },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t.abas.painel,
          headerTitle: t.app.nome,
          tabBarIcon: ({ focused }) => <Ionicons name="grid" size={26} color={focused ? tema.primaria : tema.textoSuave} />,
        }}
      />
      <Tabs.Screen
        name="obras"
        options={{ title: t.abas.obras, tabBarIcon: ({ focused }) => <Ionicons name="business" size={26} color={focused ? tema.primaria : tema.textoSuave} /> }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{ title: t.abas.ajustes, tabBarIcon: ({ focused }) => <Ionicons name="settings" size={26} color={focused ? tema.primaria : tema.textoSuave} /> }}
      />
    </Tabs>
  );
}
