export type Papel = 'admin' | 'laboratorista' | 'ajudante';

export type Acao =
  | 'obras.ver'
  | 'obras.gerenciar'
  | 'funcionarios.gerenciar'
  | 'parametros.gerenciar'
  | 'concretagens.registrar'
  | 'cps.registrar'
  | 'cps.identificar'
  | 'ensaios.registrar'
  | 'tanques.registrar'
  | 'tanques.manutencao'
  | 'fotos.registrar'
  | 'relatorios.gerar'
  | 'relatorios.gerais';

const TODAS: Acao[] = [
  'obras.ver',
  'obras.gerenciar',
  'funcionarios.gerenciar',
  'parametros.gerenciar',
  'concretagens.registrar',
  'cps.registrar',
  'cps.identificar',
  'ensaios.registrar',
  'tanques.registrar',
  'tanques.manutencao',
  'fotos.registrar',
  'relatorios.gerar',
  'relatorios.gerais',
];

/**
 * Matriz de permissões por função. É a referência da interface;
 * a autoridade final são as políticas (RLS) do Supabase.
 */
export const PERMISSOES: Record<Papel, ReadonlySet<Acao>> = {
  admin: new Set(TODAS),
  laboratorista: new Set<Acao>([
    'obras.ver',
    'concretagens.registrar',
    'cps.registrar',
    'cps.identificar',
    'ensaios.registrar',
    'tanques.registrar',
    'tanques.manutencao',
    'fotos.registrar',
    'relatorios.gerar',
  ]),
  ajudante: new Set<Acao>(['obras.ver', 'cps.identificar', 'tanques.registrar', 'fotos.registrar']),
};

export function pode(papel: Papel | null, acao: Acao): boolean {
  return papel !== null && PERMISSOES[papel].has(acao);
}
