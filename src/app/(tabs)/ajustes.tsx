import Constants from 'expo-constants';
import { useCallback } from 'react';
import { View } from 'react-native';

import { versaoDoBanco } from '@/core/db/migracoes';
import { GLOSSARIO } from '@/i18n/glossario';
import { useApp, type Idioma } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Botao, Cartao, Tela, Texto } from '@/ui/componentes';
import { Espaco, useTema } from '@/ui/tema';

const IDIOMAS: { codigo: Idioma; nome: string }[] = [
  { codigo: 'pt', nome: 'Português (Brasil)' },
  { codigo: 'es', nome: 'Español (Latinoamérica)' },
];

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Texto tipo="pequeno" cor="textoSuave">
        {rotulo}
      </Texto>
      <Texto selectable>{valor}</Texto>
    </View>
  );
}

export default function Ajustes() {
  const { db, t, idioma, trocarIdioma, modoLocal, email, empresaNome, papel, dispositivoId, sair } = useApp();
  const tema = useTema();
  const versao = useConsulta(useCallback(() => versaoDoBanco(db), [db]));

  return (
    <Tela>
      <Texto tipo="rotulo" cor="textoSuave">
        {t.ajustes.idioma}
      </Texto>
      <View style={{ gap: Espaco.p }}>
        {IDIOMAS.map((i) => (
          <Botao
            key={i.codigo}
            titulo={i.nome}
            icone={idioma === i.codigo ? 'radio-button-on' : 'radio-button-off'}
            variante={idioma === i.codigo ? 'primario' : 'secundario'}
            onPress={() => trocarIdioma(i.codigo)}
          />
        ))}
      </View>

      <Texto tipo="rotulo" cor="textoSuave">
        {t.ajustes.conta}
      </Texto>
      <Cartao style={{ gap: Espaco.m }}>
        {modoLocal ? (
          <Texto>{t.ajustes.contaLocal}</Texto>
        ) : (
          <>
            <Linha rotulo={t.entrar.email} valor={email ?? '–'} />
            <Linha rotulo={t.ajustes.empresa} valor={empresaNome ?? '–'} />
            <Linha rotulo={t.ajustes.funcao} valor={papel ? t.papeis[papel] : t.entrar.semVinculo} />
            <Botao titulo={t.ajustes.sair} icone="log-out" variante="secundario" onPress={sair} />
          </>
        )}
      </Cartao>

      <Texto tipo="rotulo" cor="textoSuave">
        {t.ajustes.glossario}
      </Texto>
      <Cartao style={{ gap: Espaco.p }}>
        {GLOSSARIO.map((g) => (
          <View key={g.pt} style={{ flexDirection: 'row', gap: Espaco.m }}>
            <Texto tipo="pequeno" style={{ flex: 1 }}>
              {g.pt}
            </Texto>
            <Texto tipo="pequeno" style={{ flex: 1, color: tema.destaque }}>
              {g.es}
            </Texto>
          </View>
        ))}
      </Cartao>

      <Texto tipo="rotulo" cor="textoSuave">
        {t.ajustes.aparelho}
      </Texto>
      <Cartao style={{ gap: Espaco.m }}>
        <Linha rotulo={t.ajustes.idAparelho} valor={dispositivoId} />
        <Linha rotulo={t.ajustes.versaoBanco} valor={versao === undefined ? '–' : String(versao)} />
        <Linha rotulo={t.ajustes.versaoApp} valor={Constants.expoConfig?.version ?? '–'} />
      </Cartao>
    </Tela>
  );
}
