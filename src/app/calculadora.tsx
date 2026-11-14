import { useState } from 'react';
import { Text, View } from 'react-native';

import { areaMm2, arredondar, formatarMpa, lerNumero, paraKn, resistenciaMpa, type UnidadeCarga } from '@/core/resistencia';
import { fmt } from '@/i18n/fmt';
import { useApp } from '@/services/app';
import { Campo, Cartao, Secao, Segmento, Tela, Texto } from '@/ui/componentes';
import { Espaco, useTema } from '@/ui/tema';

export default function Calculadora() {
  const { t } = useApp();
  const tema = useTema();
  const [carga, setCarga] = useState('');
  const [unidade, setUnidade] = useState<UnidadeCarga>('kN');
  const [diametro, setDiametro] = useState(100);
  const valor = lerNumero(carga);
  const kn = valor ? paraKn(valor, unidade) : null;
  const br = (n: number, casas: number) => String(arredondar(n, casas)).replace('.', ',');

  return (
    <Tela>
      <Campo rotulo={`${t.calc.carga} (${unidade})`} value={carga} onChangeText={setCarga} keyboardType="decimal-pad" placeholder="0" autoFocus />
      <Secao titulo={t.romp.unidade} />
      <Segmento
        valor={unidade}
        aoMudar={setUnidade}
        opcoes={[
          { valor: 'kN', rotulo: 'kN' },
          { valor: 'tf', rotulo: 'tf' },
          { valor: 'kgf', rotulo: 'kgf' },
        ]}
      />
      <Secao titulo={t.romp.molde} />
      <Segmento
        valor={diametro}
        aoMudar={setDiametro}
        opcoes={[
          { valor: 100, rotulo: t.romp.m100 },
          { valor: 150, rotulo: t.romp.m150 },
        ]}
      />
      <Cartao style={{ gap: Espaco.xs }}>
        <Texto tipo="pequeno" cor="textoSuave">
          {t.cp.resistencia}
        </Texto>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ color: kn ? tema.texto : tema.textoSuave, fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
            {kn ? formatarMpa(resistenciaMpa(kn, diametro)) : '–'}
          </Text>
          <Text style={{ color: tema.textoSuave, fontSize: 18, fontWeight: '700' }}>MPa</Text>
        </View>
        <Texto tipo="pequeno" cor="textoSuave">
          {kn ? fmt(t.calc.conversao, { kn: br(kn, 2), tf: br(kn / 9.80665, 2) }) : t.calc.dica}
        </Texto>
        <Texto tipo="pequeno" cor="textoSuave">
          {fmt(t.calc.area, { a: br(areaMm2(diametro), 1) })}
        </Texto>
      </Cartao>
      <Texto tipo="pequeno" cor="textoSuave">
        {t.romp.aviso}
      </Texto>
    </Tela>
  );
}
