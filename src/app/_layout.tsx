import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

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
  const { logado, t, papel, estadoVinculo } = useApp();
  const tema = Cores[useColorScheme() === 'dark' ? 'dark' : 'light'];
  // Conta logada cujo vínculo com a empresa ainda está sendo consultado pela primeira vez.
  if (logado && !papel && estadoVinculo === 'carregando') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.fundo }}>
        <ActivityIndicator size="large" color={tema.primaria} />
      </View>
    );
  }
  const semEmpresa = logado && !papel;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tema.marinho },
        headerTintColor: tema.sobreMarinho,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: tema.fundo },
      }}>
      <Stack.Protected guard={logado && !semEmpresa}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="obras" options={{ title: t.obras.titulo }} />
        <Stack.Screen name="obra/[id]" options={{ title: t.obras.titulo }} />
        <Stack.Screen name="recebimento/novo" options={{ title: t.recebimento.novo }} />
        <Stack.Screen name="recebimento/[id]" options={{ title: t.recebimento.titulo }} />
        <Stack.Screen name="cp/[id]" options={{ title: t.cp.titulo }} />
        <Stack.Screen name="romper" options={{ title: t.romp.registrar }} />
        <Stack.Screen name="tanque/[id]" options={{ title: t.tanques.titulo }} />
        <Stack.Screen name="guardar" options={{ title: t.tanques.guardar }} />
        <Stack.Screen name="calculadora" options={{ title: t.calc.titulo }} />
        <Stack.Screen name="funcionarios" options={{ title: t.funcionarios.titulo }} />
      </Stack.Protected>
      <Stack.Protected guard={semEmpresa}>
        <Stack.Screen name="empresa" options={{ title: t.app.nome }} />
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
