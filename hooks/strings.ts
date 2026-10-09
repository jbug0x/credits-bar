// Every label the mod draws or toasts, in each language. Add a language by adding a table.
export type Lang = 'en' | 'pt'

type Table = {
  left: (percent: number) => string
  resetsIn: (duration: string) => string
  resetting: string
  outIn: (duration: string) => string
  noReading: string
  noLimit: string
  noLimitBar: string
  context: string
  usedPercent: (percent: number) => string
  tokens: string
  tokensLine: (input: string, output: string) => string
  cacheHit: (percent: number) => string
  session: string
  lastReply: string
  replies: string
  days: (n: number) => string
  spend: string
  peak: string
  today: string
  projects: string
  models: string
  goal: string
  goalLine: (spent: string, goal: string) => string
  hide: string
  chipEmpty: string
  chipLeft: (percent: number) => string
  // toasts
  limitUsed: (label: string, percent: number) => string
  paceWarn: (label: string, pace: string) => string
  goalHit: (spent: string, goal: string) => string
  summary: (spent: string, parts: string) => string
  usedShort: (label: string, percent: number) => string
  // commands
  panelClosed: string
  panelOpened: string
  panelCannot: string
  barHidden: string
  barShown: string
  exported: (path: string, rows: number) => string
  exportFailed: (reason: string) => string
  cmdPanel: string
  cmdBar: string
  cmdExport: string
  cmdPet: string
  petOn: string
  petOff: string
  mood: Record<'idle' | 'sleep' | 'work' | 'tired' | 'scared' | 'party', string>
  // what the pet mutters, a few per mood, rotating
  bubbles: Record<'idle' | 'sleep' | 'work' | 'tired' | 'scared' | 'party', string[]>
}

export const STRINGS: Record<Lang, Table> = {
  en: {
    left: p => `${p}% left`,
    resetsIn: d => `resets in ${d}`,
    resetting: 'resetting',
    outIn: d => `out in ${d}`,
    noReading: 'No usage reading yet. Send a prompt.',
    noLimit: 'No usage limit reported (not on a subscription?).',
    noLimitBar: 'Credits: no usage limit reported yet ',
    context: 'Context',
    usedPercent: p => `${p}% used`,
    tokens: 'Tokens',
    tokensLine: (i, o) => `in ${i} · out ${o}`,
    cacheHit: p => `cache ${p}%`,
    session: 'Session',
    lastReply: 'last reply',
    replies: 'Replies',
    days: n => `${n} days`,
    spend: 'spend',
    peak: 'peak',
    today: 'today',
    projects: 'Projects (7d)',
    models: 'Models (session)',
    goal: 'Daily goal',
    goalLine: (s, g) => `${s} of ${g}`,
    hide: 'Hide (/credits-bar to restore)',
    chipEmpty: '◔ credits',
    chipLeft: p => `◔ ${p}% left`,
    limitUsed: (l, p) => `${l} limit ${p}% used`,
    paceWarn: (l, p) => `${l} window ${p}, before it resets`,
    goalHit: (s, g) => `Daily goal reached: ${s} of ${g}`,
    summary: (s, parts) => `Session ended: ${s} spent${parts ? ` · ${parts}` : ''}`,
    usedShort: (l, p) => `${l} ${p}% used`,
    panelClosed: 'Credits panel closed.',
    panelOpened: 'Credits panel opened.',
    panelCannot: 'The panel could not be placed here.',
    barHidden: 'Credits bar hidden. Run /credits-bar to show it again.',
    barShown: 'Credits bar shown.',
    exported: (p, n) => `History exported: ${n} rows in ${p}`,
    exportFailed: r => `Could not export the history: ${r}`,
    cmdPanel: 'Open or close the usage side panel',
    cmdBar: 'Show or hide the one-line usage bar above the prompt',
    cmdExport: 'Export the spend history to credits-history.csv in the current folder',
    cmdPet: 'Show or hide the pet',
    petOn: 'The pet is back.',
    petOff: 'The pet went to nap. Run /credits-pet to bring it back.',
    mood: {
      idle: 'chilling',
      sleep: 'sleeping',
      work: 'working',
      tired: 'tired',
      scared: 'panicking',
      party: 'celebrating'
    },
    bubbles: {
      idle: ['all quiet in here', 'got any tasks for me?', 'watching the bars', 'psst, nice code'],
      sleep: ['zzz...', 'five more minutes', 'dreaming of green bars'],
      work: ['clack clack clack', 'on it!', 'crunching tokens', 'almost there...'],
      tired: ['phew, that is a lot', 'could use a break', 'running low...'],
      scared: ['the limit is right there!', 'abort abort', 'please slow down'],
      party: ['we did it!', 'nailed it', 'another one done!']
    }
  },
  pt: {
    left: p => `${p}% restante`,
    resetsIn: d => `reseta em ${d}`,
    resetting: 'resetando',
    outIn: d => `acaba em ${d}`,
    noReading: 'Ainda sem leitura de uso. Envie um prompt.',
    noLimit: 'Nenhum limite de uso informado (sem assinatura?).',
    noLimitBar: 'Créditos: nenhum limite informado ainda ',
    context: 'Contexto',
    usedPercent: p => `${p}% usado`,
    tokens: 'Tokens',
    tokensLine: (i, o) => `entrada ${i} · saída ${o}`,
    cacheHit: p => `cache ${p}%`,
    session: 'Sessão',
    lastReply: 'última resposta',
    replies: 'Respostas',
    days: n => `${n} dias`,
    spend: 'gasto',
    peak: 'pico',
    today: 'hoje',
    projects: 'Projetos (7d)',
    models: 'Modelos (sessão)',
    goal: 'Meta diária',
    goalLine: (s, g) => `${s} de ${g}`,
    hide: 'Ocultar (/credits-bar para voltar)',
    chipEmpty: '◔ créditos',
    chipLeft: p => `◔ ${p}% restante`,
    limitUsed: (l, p) => `Limite de ${l}: ${p}% usado`,
    paceWarn: (l, p) => `Janela de ${l} ${p}, antes de resetar`,
    goalHit: (s, g) => `Meta diária atingida: ${s} de ${g}`,
    summary: (s, parts) => `Sessão encerrada: ${s} gastos${parts ? ` · ${parts}` : ''}`,
    usedShort: (l, p) => `${l} ${p}% usado`,
    panelClosed: 'Painel de créditos fechado.',
    panelOpened: 'Painel de créditos aberto.',
    panelCannot: 'Não foi possível posicionar o painel aqui.',
    barHidden: 'Barra de créditos oculta. Use /credits-bar para mostrar de novo.',
    barShown: 'Barra de créditos exibida.',
    exported: (p, n) => `Histórico exportado: ${n} linhas em ${p}`,
    exportFailed: r => `Não foi possível exportar o histórico: ${r}`,
    cmdPanel: 'Abrir ou fechar o painel lateral de uso',
    cmdBar: 'Mostrar ou ocultar a barra de uma linha acima do prompt',
    cmdExport: 'Exportar o histórico de gastos para credits-history.csv na pasta atual',
    cmdPet: 'Mostrar ou esconder o bichinho',
    petOn: 'O bichinho voltou.',
    petOff: 'O bichinho foi tirar uma soneca. Use /credits-pet para chamá-lo de volta.',
    mood: {
      idle: 'de boa',
      sleep: 'dormindo',
      work: 'trabalhando',
      tired: 'cansado',
      scared: 'em pânico',
      party: 'comemorando'
    },
    bubbles: {
      idle: ['tudo quieto por aqui', 'tem tarefa pra mim?', 'de olho nas barras', 'psiu, bom código'],
      sleep: ['zzz...', 'só mais cinco minutinhos', 'sonhando com barras verdes'],
      work: ['tec tec tec', 'deixa comigo!', 'mastigando tokens', 'quase lá...'],
      tired: ['ufa, é muita coisa', 'precisava de uma pausa', 'ficando sem fôlego...'],
      scared: ['o limite tá logo ali!', 'socorro', 'vai com calma, por favor'],
      party: ['conseguimos!', 'mandou bem', 'mais uma pronta!']
    }
  }
}
