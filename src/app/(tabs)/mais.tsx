import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { versaoDoBanco } from '@/core/db/migracoes';
import { gravarIdades, IDADES_COMUNS, lerIdades } from '@/features/lab/lab.repo';
import { GLOSSARIO } from '@/i18n/glossario';
import { useApp, type Idioma } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Botao, Campo, Cartao, Linha, Lista, Pastilhas, Secao, Tela, Texto } from '@/ui/componentes';
import { Espaco, useTema } from '@/ui/tema';

const IDIOMAS: { codigo: Idioma; nome: string }[] = [
  { codigo: 'pt', nome: 'Português (Brasil)' },
  { codigo: 'es', nome: 'Español (Latinoamérica)' },
];

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Texto tipo="pequeno" cor="textoSuave">
        {rotulo}
      </Texto>
      <Texto selectable>{valor}</Texto>
    </View>
  );
}

export default function Mais() {
  const { db, t, idioma, trocarIdioma, modoLocal, email, empresaNome, papel, dispositivoId, sair, pode } = useApp();
  const tema = useTema();
  const versao = useConsulta(useCallback(() => versaoDoBanco(db), [db]));
  const [idades, setIdades] = useState<number[]>([]);
  const [outra, setOutra] = useState('');
  useEffect(() => {
    lerIdades(db).then(setIdades);
  }, [db]);
  const podeParametros = pode('parametros.gerenciar');
  async function mudarIdades(novas: number[]) {
    if (!novas.length) return;
    setIdades(await gravarIdades(db, novas));
  }
  const opcoesIdade = [...new Set([...IDADES_COMUNS, ...idades])].sort((a, b) => a - b);

  return (
    <Tela>
      <Secao titulo={t.mais.cadastros} />
      <Lista>
        <Linha titulo={t.obras.titulo} aoTocar={() => router.push('/obras')} />
        <Linha titulo={t.calc.titulo} aoTocar={() => router.push('/calculadora')} />
        {pode('funcionarios.gerenciar') && !modoLocal ? <Linha titulo={t.funcionarios.gerenciar} aoTocar={() => router.push('/funcionarios')} /> : null}
      </Lista>

      <Secao titulo={t.mais.idadesTitulo} />
      <Pastilhas
        opcoes={opcoesIdade.map((i) => ({ valor: i, rotulo: `${i}d` }))}
        selecionadas={idades}
        aoTocar={(i) => (podeParametros ? mudarIdades(idades.includes(i) ? idades.filter((x) => x !== i) : [...idades, i]) : undefined)}
      />
      {podeParametros ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Espaco.m }}>
          <View style={{ flex: 1 }}>
            <Campo rotulo={t.mais.outraIdade} value={outra} onChangeText={setOutra} keyboardType="number-pad" />
          </View>
          <Botao
            titulo={t.mais.adicionar}
            variante="secundario"
            onPress={() => {
              const n = parseInt(outra, 10);
              if (n > 0) mudarIdades([...idades, n]);
              setOutra('');
            }}
          />
        </View>
      ) : null}
      <Texto tipo="pequeno" cor="textoSuave">
        {t.mais.idadesDica}
      </Texto>

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
            <Info rotulo={t.entrar.email} valor={email ?? '–'} />
            <Info rotulo={t.ajustes.empresa} valor={empresaNome ?? '–'} />
            <Info rotulo={t.ajustes.funcao} valor={papel ? t.papeis[papel] : t.entrar.semVinculo} />
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
        <Info rotulo={t.ajustes.idAparelho} valor={dispositivoId} />
        <Info rotulo={t.ajustes.versaoBanco} valor={versao === undefined ? '–' : String(versao)} />
        <Info rotulo={t.ajustes.versaoApp} valor={Constants.expoConfig?.version ?? '–'} />
      </Cartao>
    </Tela>
  );
}
