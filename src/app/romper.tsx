import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { formatarData } from '@/core/datas';
import { arredondar, formatarMpa, lerNumero, media, paraKn, resistenciaMpa, type UnidadeCarga } from '@/core/resistencia';
import { buscarRecebimento, listarCps, registrarRompimento, rotuloCb } from '@/features/lab/lab.repo';
import { siglaDe } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Aviso, Botao, Campo, Cartao, Secao, Segmento, Selo, Sigla, Tela, Texto } from '@/ui/componentes';
import { Espaco, useTema } from '@/ui/tema';

/** Registro dos resultados de um grupo: os CPs de um recebimento que rompem na mesma idade. */
export default function Romper() {
  const { recebimento, idade } = useLocalSearchParams<{ recebimento: string; idade: string }>();
  const { db, ctx, t, pode } = useApp();
  const tema = useTema();
  const dados = useConsulta(
    useCallback(
      async () => ({ r: await buscarRecebimento(db, recebimento), cps: await listarCps(db, { recebimentoId: recebimento, idade: Number(idade) }) }),
      [db, recebimento, idade],
    ),
  );
  const [cargas, setCargas] = useState<Record<string, string>>({});
  const [unidade, setUnidade] = useState<UnidadeCarga>('kN');
  const [diametro, setDiametro] = useState<number | null>(null);
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const r = dados?.r;
  if (!r || !dados.cps.length) return <Tela>{<Texto cor="textoSuave">{dados ? t.romp.vazio : t.comum.carregando}</Texto>}</Tela>;
  const d = diametro ?? dados.cps.find((c) => c.diametro_mm)?.diametro_mm ?? 100;
  const podeRegistrar = pode('ensaios.registrar');

  // Valor em edição, ou o já lançado convertido para a unidade escolhida.
  const texto = (id: string, cargaKn: number | null) =>
    cargas[id] ?? (cargaKn ? String(arredondar(cargaKn / paraKn(1, unidade), 2)).replace('.', ',') : '');
  const calculados = dados.cps.map((c) => {
    const valor = lerNumero(texto(c.id, c.carga_kn));
    const kn = valor ? paraKn(valor, unidade) : null;
    return { cp: c, kn, mpa: kn ? resistenciaMpa(kn, d) : null, alterado: cargas[c.id] !== undefined || (diametro !== null && c.mpa !== null) };
  });
  const valores = calculados.map((c) => c.mpa).filter((m): m is number => m !== null);
  const maior = valores.length ? Math.max(...valores) : null;
  const med = media(valores);

  async function salvar() {
    setErro(null);
    const paraGravar = calculados.filter((c) => c.kn && (c.alterado || c.cp.mpa === null));
    if (!paraGravar.length) return setErro(t.romp.erroCarga);
    setSalvando(true);
    try {
      for (const c of paraGravar) await registrarRompimento(db, ctx, c.cp.id, { cargaKn: c.kn!, diametroMm: d, observacao: obs || c.cp.observacao_ensaio });
      router.back();
    } catch {
      setErro(t.comum.erroSalvar);
      setSalvando(false);
    }
  }

  return (
    <Tela rodape={podeRegistrar ? <Botao titulo={t.romp.salvar} icone="checkmark-circle" onPress={salvar} desabilitado={salvando} /> : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.m }}>
        <Sigla texto={siglaDe({ sigla: r.obra_sigla, nome: r.obra_nome })} tamanho="g" />
        <View style={{ flex: 1 }}>
          <Texto tipo="subtitulo">{`NF ${r.nf} · ${fmt(t.comum.dias, { n: Number(idade) })}`}</Texto>
          <Texto tipo="pequeno" cor="textoSuave">
            {`${r.obra_nome} · ${t.cp.moldagem} ${formatarData(r.data_moldagem)} · ${t.cp.rompimentoPrevisto} ${formatarData(dados.cps[0].data_rompimento)}`}
          </Texto>
        </View>
      </View>
      {!podeRegistrar ? <Aviso texto={t.romp.semPermissao} icone="lock-closed" /> : null}
      {erro ? <Aviso texto={erro} icone="alert-circle" cor="perigo" /> : null}

      <Secao titulo={t.romp.unidade} />
      <Segmento
        valor={unidade}
        aoMudar={(u) => {
          setUnidade(u);
          setCargas({});
        }}
        opcoes={[
          { valor: 'kN', rotulo: 'kN' },
          { valor: 'tf', rotulo: 'tf' },
          { valor: 'kgf', rotulo: 'kgf' },
        ]}
      />
      <Secao titulo={t.romp.molde} />
      <Segmento
        valor={d}
        aoMudar={setDiametro}
        opcoes={[
          { valor: 100, rotulo: t.romp.m100 },
          { valor: 150, rotulo: t.romp.m150 },
        ]}
      />

      {calculados.map(({ cp, mpa }) => (
        <View key={cp.id} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Espaco.m }}>
          <View style={{ flex: 1.3 }}>
            <Campo
              rotulo={`${fmt(t.romp.carga, { cb: rotuloCb(cp.cb) })} (${unidade})${cp.mpa !== null && cargas[cp.id] === undefined ? ` · ${t.romp.jaRompido}` : ''}`}
              value={texto(cp.id, cp.carga_kn)}
              onChangeText={(v) => setCargas((a) => ({ ...a, [cp.id]: v }))}
              keyboardType="decimal-pad"
              editable={podeRegistrar}
              placeholder="0"
            />
          </View>
          <View style={{ flex: 1, minHeight: 56, justifyContent: 'center', alignItems: 'flex-end' }}>
            <Text style={{ color: mpa ? tema.texto : tema.textoSuave, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {mpa ? formatarMpa(mpa) : '–'}
            </Text>
            <Text style={{ color: tema.textoSuave, fontSize: 12, fontWeight: '600' }}>MPa</Text>
          </View>
        </View>
      ))}

      {maior !== null ? (
        <Cartao style={{ gap: Espaco.p }}>
          <View style={{ flexDirection: 'row', gap: Espaco.g }}>
            <View style={{ flex: 1 }}>
              <Texto tipo="pequeno" cor="textoSuave">
                {t.romp.maior}
              </Texto>
              <Texto tipo="subtitulo">{`${formatarMpa(maior)} MPa`}</Texto>
            </View>
            {valores.length > 1 && med !== null ? (
              <View style={{ flex: 1 }}>
                <Texto tipo="pequeno" cor="textoSuave">
                  {t.romp.media}
                </Texto>
                <Texto tipo="subtitulo">{`${formatarMpa(med)} MPa`}</Texto>
              </View>
            ) : null}
          </View>
          {r.fck ? <Selo texto={fmt(t.romp.fck, { fck: String(r.fck).replace('.', ',') })} /> : null}
          <Texto tipo="pequeno" cor="textoSuave">
            {t.romp.aviso}
          </Texto>
        </Cartao>
      ) : null}

      {podeRegistrar ? <Campo rotulo={t.comum.observacoes} value={obs} onChangeText={setObs} multiline /> : null}
    </Tela>
  );
}
