import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { datasDeRompimento, formatarData, hoje as dataDeHoje, somarDias } from '@/core/datas';
import { lerNumero } from '@/core/resistencia';
import { dataCurta, diaSemanaCurto } from '@/features/lab/apresentacao';
import { criarRecebimento, IDADES_COMUNS, lerIdades, rotuloCb } from '@/features/lab/lab.repo';
import { ErroValidacao, listarObras, siglaDe } from '@/features/obras/obras.repo';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { useConsulta } from '@/services/consulta';
import { Aviso, Botao, Campo, Galeria, Passo, Pastilhas, Secao, Tela, Texto } from '@/ui/componentes';
import { BotaoFoto } from '@/ui/foto';
import { Espaco, Raio, useTema } from '@/ui/tema';

const agoraHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function NovoRecebimento() {
  const { db, ctx, t, idioma, pode } = useApp();
  const tema = useTema();
  const hoje = dataDeHoje();
  const obras = useConsulta(useCallback(() => listarObras(db), [db]));
  const [obraId, setObraId] = useState<string | null>(null);
  const [nf, setNf] = useState('');
  const [data, setData] = useState(hoje);
  const [idades, setIdades] = useState<number[]>([]);
  const [opcoesIdade, setOpcoesIdade] = useState<number[]>(IDADES_COMUNS);
  const [porIdade, setPorIdade] = useState(2);
  const [caminhao, setCaminhao] = useState('');
  const [concreteira, setConcreteira] = useState('');
  const [chegada, setChegada] = useState(agoraHHMM);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [volume, setVolume] = useState('');
  const [fck, setFck] = useState('');
  const [slumpEsp, setSlumpEsp] = useState('');
  const [slumpMed, setSlumpMed] = useState('');
  const [peca, setPeca] = useState('');
  const [obs, setObs] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    lerIdades(db).then((padrao) => {
      setIdades(padrao);
      setOpcoesIdade([...new Set([...IDADES_COMUNS, ...padrao])].sort((a, b) => a - b));
    });
  }, [db]);

  const obraEscolhida = obraId ?? (obras?.length === 1 ? obras[0].id : null);
  const previstas = datasDeRompimento(data, idades);
  const totalCps = previstas.length * porIdade;

  if (!pode('cps.identificar')) {
    return (
      <Tela>
        <Aviso texto={t.comum.semPermissao} icone="lock-closed" cor="perigo" />
      </Tela>
    );
  }

  async function salvar() {
    setErro(null);
    if (!obraEscolhida) return setErro(t.recebimento.erroObra);
    setSalvando(true);
    try {
      const { recebimento } = await criarRecebimento(db, ctx, {
        obraId: obraEscolhida,
        nf,
        dataMoldagem: data,
        idades,
        cpsPorIdade: porIdade,
        caminhao,
        concreteira,
        horaChegada: chegada,
        horaInicio: inicio,
        horaFim: fim,
        volumeM3: lerNumero(volume),
        fck: lerNumero(fck),
        slumpEspecificado: lerNumero(slumpEsp),
        slumpMedido: lerNumero(slumpMed),
        peca,
        observacao: obs,
        fotos,
      });
      router.replace({ pathname: '/recebimento/[id]', params: { id: recebimento.id } });
    } catch (e) {
      const campo = e instanceof ErroValidacao ? e.campo : null;
      setErro(
        campo === 'nf'
          ? (e as ErroValidacao).codigo === 'duplicado'
            ? t.recebimento.erroNfDuplicada
            : t.recebimento.erroNf
          : campo === 'idades'
            ? t.recebimento.erroIdades
            : campo === 'obra'
              ? t.recebimento.erroObra
              : t.comum.erroSalvar,
      );
      setSalvando(false);
    }
  }

  const alternarIdade = (i: number) => setIdades((atual) => (atual.includes(i) ? atual.filter((x) => x !== i) : [...atual, i]));

  return (
    <Tela rodape={<Botao titulo={t.recebimento.salvar} icone="checkmark-circle" onPress={salvar} desabilitado={salvando} />}>
      {erro ? <Aviso texto={erro} icone="alert-circle" cor="perigo" /> : null}

      <Secao titulo={t.recebimento.obra} />
      {obras && obras.length === 0 ? <Aviso texto={t.recebimento.semObra} icone="business" /> : null}
      <Pastilhas
        opcoes={(obras ?? []).map((o) => ({ valor: o.id, rotulo: `${siglaDe(o)} · ${o.nome}` }))}
        selecionadas={obraEscolhida ? [obraEscolhida] : []}
        aoTocar={setObraId}
      />

      <Secao titulo={t.recebimento.identificacao} />
      <Campo rotulo={t.recebimento.nf} value={nf} onChangeText={setNf} autoCapitalize="characters" />
      <Passo
        rotulo={t.recebimento.dataMoldagem}
        valor={`${dataCurta(data, hoje, t, idioma)} · ${formatarData(data)}`}
        aoMenos={() => setData(somarDias(data, -1))}
        aoMais={() => setData(data < hoje ? somarDias(data, 1) : data)}
      />
      <BotaoFoto titulo={t.comum.tirarFoto} aoCapturar={(f) => setFotos((a) => [...a, f])} aoFalhar={() => setErro(t.comum.erroFoto)} />
      <Galeria fotos={fotos} />

      <Secao titulo={t.recebimento.cps} />
      <Texto tipo="pequeno" cor="textoSuave">
        {t.recebimento.idades}
      </Texto>
      <Pastilhas opcoes={opcoesIdade.map((i) => ({ valor: i, rotulo: `${i}d` }))} selecionadas={idades} aoTocar={alternarIdade} />
      <Passo
        rotulo={t.recebimento.cpsPorIdade}
        valor={String(porIdade)}
        aoMenos={() => setPorIdade(Math.max(1, porIdade - 1))}
        aoMais={() => setPorIdade(Math.min(10, porIdade + 1))}
      />
      {previstas.length ? (
        <View style={{ backgroundColor: tema.superficie, borderColor: tema.borda, borderWidth: 1, borderRadius: Raio.m, overflow: 'hidden' }}>
          <View style={{ backgroundColor: tema.faixa, paddingHorizontal: Espaco.m, paddingVertical: 8 }}>
            <Texto tipo="forte" style={{ fontSize: 13 }}>
              {fmt(t.recebimento.resumo, { n: totalCps, ultimo: rotuloCb(totalCps) })}
            </Texto>
          </View>
          {previstas.map((p, k) => (
            <View
              key={p.idade}
              style={{ flexDirection: 'row', alignItems: 'center', gap: Espaco.m, paddingHorizontal: Espaco.m, paddingVertical: 9, borderTopWidth: 1, borderTopColor: tema.borda }}>
              <Text style={{ width: 44, color: tema.primaria, fontSize: 16, fontWeight: '800' }}>{p.idade}d</Text>
              <Text style={{ flex: 1, color: tema.texto, fontSize: 15, fontWeight: '700' }}>
                {`${diaSemanaCurto(p.data, idioma)} ${formatarData(p.data)}`}
              </Text>
              <Text style={{ color: tema.textoSuave, fontSize: 13 }}>
                {`CB ${rotuloCb(k * porIdade + 1)}${porIdade > 1 ? `–${rotuloCb((k + 1) * porIdade)}` : ''}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Secao titulo={t.recebimento.concreto} />
      <View style={{ flexDirection: 'row', gap: Espaco.m }}>
        <View style={{ flex: 1 }}>
          <Campo rotulo={t.recebimento.caminhao} value={caminhao} onChangeText={setCaminhao} autoCapitalize="characters" />
        </View>
        <View style={{ flex: 1 }}>
          <Campo rotulo={t.recebimento.concreteira} value={concreteira} onChangeText={setConcreteira} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: Espaco.m }}>
        <View style={{ flex: 1 }}>
          <Campo rotulo={t.recebimento.fck} value={fck} onChangeText={setFck} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Campo rotulo={t.recebimento.volume} value={volume} onChangeText={setVolume} keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: Espaco.m }}>
        <View style={{ flex: 1 }}>
          <Campo rotulo={t.recebimento.slumpEsp} value={slumpEsp} onChangeText={setSlumpEsp} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Campo rotulo={t.recebimento.slumpMed} value={slumpMed} onChangeText={setSlumpMed} keyboardType="decimal-pad" />
        </View>
      </View>
      <Campo rotulo={t.recebimento.peca} value={peca} onChangeText={setPeca} />

      <Secao titulo={t.recebimento.horarios} />
      <View style={{ flexDirection: 'row', gap: Espaco.m }}>
        <View style={{ flex: 1 }}>
          <Campo rotulo={t.recebimento.horaChegada} value={chegada} onChangeText={setChegada} placeholder="00:00" />
        </View>
        <View style={{ flex: 1 }}>
          <Campo rotulo={t.recebimento.horaInicio} value={inicio} onChangeText={setInicio} placeholder="00:00" />
        </View>
        <View style={{ flex: 1 }}>
          <Campo rotulo={t.recebimento.horaFim} value={fim} onChangeText={setFim} placeholder="00:00" />
        </View>
      </View>
      <Campo rotulo={t.comum.observacoes} value={obs} onChangeText={setObs} multiline />
    </Tela>
  );
}
