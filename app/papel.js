/* Papel no time do Monster Arena (rinha em tempo real), a partir dos golpes e dos
   atributos base. A regra segue o que o laço do mod faz hoje (ma_realtime.lua),
   não o combate por turno do jogo. Documentada no README, seção "Papel no time".
   Roda no navegador (window.Papel) e no Node (module.exports). */
(function (raiz) {
  'use strict';

  // natureza do golpe (battle_skill col 22 = linha da battle_formula)
  const NAT_DANO = new Set([1, 2, 4, 5, 11]); // físico, mágico, dano fixo, % de PV, Cross Arts
  const NAT_CURA = new Set([8, 9, 10]);       // cura (ESP), cura fixa, cura em % de PV
  // alvo do golpe (battle_skill col 33, textos skill_auto_explanation 1..13)
  const ALVO_ALIADO = new Set([2, 3, 6, 7, 12]);
  const ALVO_INIMIGO = new Set([1, 5, 11]);
  const ALVO_USUARIO = 10;

  // O que o laço do mod faz com cada estado (ma_realtime.lua, commits 0e85d64
  // e 2a60a09 de 16/11, por 20 s, estado_dur):
  //   MA_dano_estados: ATQ ↑ / ATQ ↓ de quem bate e DEF ↑ / DEF ↓ de quem
  //     apanha, dano × ou ÷ 1,25; Redução de Dano recebido corta para 70%.
  //   MA_vel_atualiza: só VEL ↑ e VEL ↓, 1,25× mais rápido ou mais lento.
  //   aim_penalty: Provocação puxa a mira do lado de lá 8 m.
  //   MA_INCAPACITANTES: 105, 106, 107, 110, 111, 112, 113, 205 tiram a ação 5 s.
  //   veneno_fams: 103 e 108 tiram 6% do PV a cada 5 s até o fim da luta.
  //   MA_limpa: golpe de limpeza ("Remove") tira estado, redução e ferida do aliado.
  // O resto (INT, ESP, PREC, EVAS, CRÍT, resistências, contra-ataque, reflexo,
  // imunidades) só aparece no card, sem efeito na luta.
  const BUFF_EFETIVO = new Set([
    'Aumento de ATQ', 'Aumento de DEF', 'Aumento de VEL',
    'Redução de Dano Físico recebido', 'Redução de Dano Mágico recebido',
  ]);
  const TANQUE_EFETIVO = new Set(['Provocação']);
  // Reforço defensivo: em si mesmo é de tanque; em aliado é apoio.
  const DEFESA = new Set(['Aumento de DEF', 'Redução de Dano Físico recebido', 'Redução de Dano Mágico recebido']);
  const OFENSIVO = new Set(['Aumento de ATQ', 'Aumento de VEL']);
  const CONTROLE_EFETIVO = new Set([
    'Confusão', 'Paralisia', 'Sono', 'Caótico', 'Imobilização', 'Sono Profundo',
    'Cristalização', 'Imobilizado na próxima rodada', // tiram a ação 5 s
    'Veneno', 'Veneno Mortal',                           // 6% do PV a cada 5 s
    'Redução de ATQ', 'Redução de DEF', 'Redução de VEL', // menos dano, mais dano levado, mais lento
  ]);
  const temNome = (lista, nomes) => (lista || []).some(b => nomes.has(b[0]));
  const LIMPEZA = /\bRemove\b/;

  /** Efeito do golpe na rinha: { tipo, controle }.
      tipo: dano, cura, buff, tanque, limpeza, controle, inerte (sem efeito no
      mod) ou incerto. controle: true quando um golpe de dano também aplica
      estado que vale no mod. */
  function efeito(g) {
    if (!g || g.nat == null) return { tipo: 'incerto', controle: false };
    if (NAT_DANO.has(g.nat)) return { tipo: 'dano', controle: temNome(g.bufAlvo, CONTROLE_EFETIVO) };
    if (NAT_CURA.has(g.nat)) return { tipo: 'cura', controle: false };
    if (g.nat !== 0) return { tipo: 'incerto', controle: false };
    const tem = !!((g.bufAlvo && g.bufAlvo.length) || (g.bufUsu && g.bufUsu.length) || /\bRemove\b|Rouba/.test(g.desc || ''));
    if (ALVO_INIMIGO.has(g.alvo)) {
      if (temNome(g.bufAlvo, CONTROLE_EFETIVO)) return { tipo: 'controle', controle: true };
      return { tipo: tem ? 'inerte' : 'incerto', controle: false };
    }
    if (ALVO_ALIADO.has(g.alvo) || g.alvo === ALVO_USUARIO) {
      if (temNome(g.bufAlvo, TANQUE_EFETIVO) || temNome(g.bufUsu, TANQUE_EFETIVO)) return { tipo: 'tanque', controle: false };
      const todos = (g.bufAlvo || []).concat(g.bufUsu || []);
      if (g.alvo === ALVO_USUARIO && temNome(todos, DEFESA) && !temNome(todos, OFENSIVO)) return { tipo: 'tanque', controle: false };
      if (temNome(g.bufAlvo, BUFF_EFETIVO) || temNome(g.bufUsu, BUFF_EFETIVO)) return { tipo: 'buff', controle: false };
      if (LIMPEZA.test(g.desc || '') && !(g.bufAlvo && g.bufAlvo.length)) return { tipo: 'limpeza', controle: false };
      return { tipo: tem ? 'inerte' : 'incerto', controle: false };
    }
    return { tipo: 'incerto', controle: false }; // alvo misto ou sem efeito descrito
  }

  // Limiares (ver README). Atributos base na ordem PV PH ATQ DEF INT ESP VEL.
  // No mod o dano é PV máx do alvo × 6,5% × 2·ATQ/(ATQ + DEF do alvo): só ATQ e
  // DEF contam, e PV não protege (cada golpe tira a mesma fração dele).
  const ATQ_ALTO = 1.15;  // ATQ base 15% acima da média do estágio
  const DEF_ALTA = 1.2;   // DEF base 20% acima da média do estágio
  const SUPORTE = 2;      // pontos de apoio (cura 2, buff ou limpeza 1)
  const SUPORTE_FORTE = 3; // com isso é Suporte mesmo com ATQ alto
  const CONTROLE = 2;     // golpes com estado que vale no mod

  const PAPEIS = ['DPS', 'Controle', 'Equilíbrio', 'Tanque', 'Suporte'];
  // Foco do Monster Arena (MA_foco, um botão por papel na lateral do card desde
  // 16/11): Suporte cura antes de tudo e adianta o apoio que vale na luta;
  // Controle adianta o golpe que prende ou enfraquece; Tanque se provoca e se
  // protege primeiro e atrai a mira do lado de lá.
  const FOCO = {
    DPS: ['Ataque', 'mira o inimigo mais ferido e usa o kit de dano'],
    Controle: ['Controle', 'adianta o golpe que prende ou enfraquece o alvo que ainda não tem o estado e evita o inimigo já preso'],
    'Equilíbrio': ['Equilíbrio', 'sorteio entre dano e apoio'],
    Tanque: ['Tanque', 'se reforça primeiro com Provocação, Redução de Dano e DEF, vai em quem bate no time e atrai a mira do lado de lá'],
    Suporte: ['Suporte', 'cura com aliado abaixo de 80% e adianta o apoio que vale na luta'],
  };

  // c.tanque (Provocação, ou DEF e Redução de Dano só em si) leva a Tanque
  // mesmo sem DEF alta.
  function classificar(c, atqRel, defRel) {
    const apoio = 2 * c.cura + c.buff + (c.limpeza || 0);
    const atqAlto = atqRel >= ATQ_ALTO;
    if (apoio >= SUPORTE_FORTE || (apoio >= SUPORTE && !atqAlto)) return 'Suporte';
    if (c.controle >= CONTROLE && !atqAlto) return 'Controle';
    if ((defRel >= DEF_ALTA || (c.tanque || 0) > 0) && !atqAlto) return 'Tanque';
    if (atqAlto || apoio + c.controle === 0) return 'DPS';
    return 'Equilíbrio';
  }

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  /** Papel de um Digimon. medio: { atq, def } base médios do estágio dele. */
  function digimon(d, golpes, medio) {
    const ids = d.especiais.concat(d.aprende.map(a => a[1]));
    const c = { dano: 0, cura: 0, buff: 0, tanque: 0, limpeza: 0, controle: 0, inerte: 0, incerto: 0, controleNoDano: 0 };
    for (const id of ids) {
      const e = efeito(golpes[id]);
      c[e.tipo]++;
      if (e.tipo === 'dano' && e.controle) c.controleNoDano++;
    }
    const conta = Object.assign({}, c, { controle: c.controle + c.controleNoDano });

    let atqRel = 1, defRel = 1;
    if (d.base && medio) {
      atqRel = d.base[2] / medio.atq;
      defRel = d.base[3] / medio.def;
    }
    const papel = classificar(conta, atqRel, defRel);

    // incerto quando os golpes não decifrados, lidos todos como cura ou todos como dano, mudam o rótulo
    const n = c.incerto;
    const como = k => Object.assign({}, conta, { [k]: conta[k] + n });
    const incerto = n > 0 && (classificar(como('cura'), atqRel, defRel) !== papel ||
                              classificar(como('dano'), atqRel, defRel) !== papel);

    const g = [];
    if (c.dano) g.push(plural(c.dano, 'golpe de dano', 'golpes de dano') + (c.controleNoDano ? ` (${c.controleNoDano} com estado)` : ''));
    if (c.cura) g.push(plural(c.cura, 'de cura', 'de cura'));
    if (c.buff) g.push(plural(c.buff, 'de buff que vale', 'de buff que vale'));
    if (c.limpeza) g.push(plural(c.limpeza, 'de limpeza', 'de limpeza'));
    if (c.tanque) g.push(plural(c.tanque, 'de tanque (Provocação ou defesa em si)', 'de tanque (Provocação ou defesa em si)'));
    if (c.controle) g.push(plural(c.controle, 'de controle', 'de controle'));
    if (c.inerte) g.push(plural(c.inerte, 'sem efeito no mod', 'sem efeito no mod'));
    const partes = g.length ? [g.join(', ')] : [];
    if (d.base) {
      partes.push(atqRel >= ATQ_ALTO ? 'ATQ alto para o estágio' : atqRel < 0.85 ? 'ATQ baixo para o estágio' : 'ATQ médio para o estágio');
      if (defRel >= DEF_ALTA) partes.push('DEF alta para o estágio');
    }
    if (n) partes.push(plural(n, 'golpe de efeito incerto', 'golpes de efeito incerto'));

    // Desde 16/11 o foco Suporte só adianta o apoio que vale; o inerte ainda
    // pode sair no sorteio pelo peso.
    const avisoFoco = papel === 'Suporte' && c.inerte > 0
      ? `${plural(c.inerte, 'golpe', 'golpes')} sem efeito no mod ainda ${c.inerte === 1 ? 'pode sair' : 'podem sair'} no sorteio` : '';

    return { papel, motivo: partes.join(', '), conta, atqRel, defRel, incerto, foco: FOCO[papel], avisoFoco };
  }

  /** Papel de todos os Digimon dos dados: Map id -> resultado de digimon(). */
  function calcular(D) {
    const soma = {};
    for (const d of D.digimon) if (d.base) {
      const s = soma[d.estagio] || (soma[d.estagio] = { atq: 0, def: 0, n: 0 });
      s.atq += d.base[2]; s.def += d.base[3]; s.n++;
    }
    const medio = e => (soma[e] ? { atq: soma[e].atq / soma[e].n, def: soma[e].def / soma[e].n } : null);
    return new Map(D.digimon.map(d => [d.id, digimon(d, D.golpes, medio(d.estagio))]));
  }

  const api = { efeito, digimon, calcular, classificar, PAPEIS, FOCO,
    ATQ_ALTO, DEF_ALTA, SUPORTE, SUPORTE_FORTE, CONTROLE, BUFF_EFETIVO, TANQUE_EFETIVO, CONTROLE_EFETIVO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Papel = api;
})(typeof window !== 'undefined' ? window : this);
