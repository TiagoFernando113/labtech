import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { dbExpo } from '@/core/db/expo';
import { migrar } from '@/core/db/migracoes';
import { AppProvider, useApp } from '@/services/app';
import { Cores } from '@/ui/tema';

SplashScreen.preventAutoHideAsync();

const esconderAbertura = () => {
  SplashScreen.hideAsync();
};

async function prepararBanco(banco: SQLiteDatabase) {
  await migrar(dbExpo(banco));
}

function Navegacao() {
  const { logado, t } = useApp();
  const tema = Cores[useColorScheme() === 'dark' ? 'dark' : 'light'];
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tema.marinho },
        headerTintColor: tema.sobreMarinho,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: tema.fundo },
      }}>
      <Stack.Protected guard={logado}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="obra/[id]" options={{ title: t.obras.nova, presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!logado}>
        <Stack.Screen name="entrar" options={{ title: t.app.nome }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const escuro = useColorScheme() === 'dark';
  return (
    <ThemeProvider value={escuro ? DarkTheme : DefaultTheme}>
      <StatusBar style="light" />
      <SQLiteProvider databaseName="labtech.db" onInit={prepararBanco}>
        <AppProvider aoFicarPronto={esconderAbertura}>
          <Navegacao />
        </AppProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
