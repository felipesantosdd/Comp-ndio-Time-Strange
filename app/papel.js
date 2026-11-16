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

  // O que o laço do mod lê de R.estados (ma_realtime.lua):
  //   MA_vel_atualiza: famílias 125 (ATQ ↑) e 129 (VEL ↑) aceleram 1,25×,
  //     133 (ATQ ↓) e 137 (VEL ↓) desaceleram 1,25×, por 20 s (estado_dur).
  //   MA_INCAPACITANTES: 105, 106, 107, 110, 111, 112, 113, 205 tiram a ação 5 s.
  //   veneno_fams: 103 e 108 tiram 6% do PV a cada 5 s até o fim da luta.
  // O resto (DEF, INT, ESP, PREC, EVAS, CRÍT, resistências, Provocação,
  // contra-ataque, reflexo, imunidades) só aparece no card, sem efeito na luta.
  const BUFF_EFETIVO = new Set(['Aumento de ATQ', 'Aumento de VEL']);
  const CONTROLE_EFETIVO = new Set([
    'Confusão', 'Paralisia', 'Sono', 'Caótico', 'Imobilização', 'Sono Profundo',
    'Cristalização', 'Imobilizado na próxima rodada', // tiram a ação 5 s
    'Veneno', 'Veneno Mortal',                           // 6% do PV a cada 5 s
    'Redução de ATQ', 'Redução de VEL',                  // alvo 1,25× mais lento
  ]);
  const temNome = (lista, nomes) => (lista || []).some(b => nomes.has(b[0]));

  /** Efeito do golpe na rinha: { tipo, controle }.
      tipo: dano, cura, buff, controle, inerte (sem efeito no mod) ou incerto.
      controle: true quando um golpe de dano também aplica estado que vale no mod. */
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
      if (temNome(g.bufAlvo, BUFF_EFETIVO) || temNome(g.bufUsu, BUFF_EFETIVO)) return { tipo: 'buff', controle: false };
      return { tipo: tem ? 'inerte' : 'incerto', controle: false };
    }
    return { tipo: 'incerto', controle: false }; // alvo misto ou sem efeito descrito
  }

  // Limiares (ver README). Atributos base na ordem PV PH ATQ DEF INT ESP VEL.
  // No mod o dano é PV máx do alvo × 6,5% × 2·ATQ/(ATQ + DEF do alvo): só ATQ e
  // DEF contam, e PV não protege (cada golpe tira a mesma fração dele).
  const ATQ_ALTO = 1.15;  // ATQ base 15% acima da média do estágio
  const DEF_ALTA = 1.2;   // DEF base 20% acima da média do estágio
  const SUPORTE = 2;      // pontos de apoio (cura 2, buff 1)
  const SUPORTE_FORTE = 3; // com isso é Suporte mesmo com ATQ alto
  const CONTROLE = 2;     // golpes com estado que vale no mod

  const PAPEIS = ['DPS', 'Controle', 'Equilíbrio', 'Tanque', 'Suporte'];
  // Foco do Monster Arena (MA_foco): Suporte cura antes de tudo e põe na frente o
  // golpe de apoio (alvo aliado ou si mesmo); debuff em inimigo conta como ataque.
  const FOCO = {
    DPS: ['Ataque', 'mira o inimigo mais ferido e usa o kit de dano'],
    Controle: ['Equilíbrio', 'debuff conta como ataque no mod, o foco Suporte não o adianta'],
    'Equilíbrio': ['Equilíbrio', 'sorteio entre dano e apoio'],
    Tanque: ['Equilíbrio', 'aguenta mais, mas o mod não tem Provocação que puxe o inimigo'],
    Suporte: ['Suporte', 'cura com aliado abaixo de 80% e passa na frente'],
  };

  function classificar(c, atqRel, defRel) {
    const apoio = 2 * c.cura + c.buff;
    const atqAlto = atqRel >= ATQ_ALTO;
    if (apoio >= SUPORTE_FORTE || (apoio >= SUPORTE && !atqAlto)) return 'Suporte';
    if (c.controle >= CONTROLE && !atqAlto) return 'Controle';
    if (defRel >= DEF_ALTA && !atqAlto) return 'Tanque';
    if (atqAlto || apoio + c.controle === 0) return 'DPS';
    return 'Equilíbrio';
  }

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  /** Papel de um Digimon. medio: { atq, def } base médios do estágio dele. */
  function digimon(d, golpes, medio) {
    const ids = d.especiais.concat(d.aprende.map(a => a[1]));
    const c = { dano: 0, cura: 0, buff: 0, controle: 0, inerte: 0, incerto: 0, controleNoDano: 0 };
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
    if (c.buff) g.push(plural(c.buff, 'de buff de ATQ ou VEL', 'de buff de ATQ ou VEL'));
    if (c.controle) g.push(plural(c.controle, 'de controle', 'de controle'));
    if (c.inerte) g.push(plural(c.inerte, 'sem efeito no mod', 'sem efeito no mod'));
    const partes = g.length ? [g.join(', ')] : [];
    if (d.base) {
      partes.push(atqRel >= ATQ_ALTO ? 'ATQ alto para o estágio' : atqRel < 0.85 ? 'ATQ baixo para o estágio' : 'ATQ médio para o estágio');
      if (defRel >= DEF_ALTA) partes.push('DEF alta para o estágio');
    }
    if (n) partes.push(plural(n, 'golpe de efeito incerto', 'golpes de efeito incerto'));

    // Foco Suporte adianta todo golpe de apoio, inclusive o que não faz nada no mod.
    const avisoFoco = papel === 'Suporte' && c.inerte > 0
      ? `no foco Suporte ele também gasta tempo com ${plural(c.inerte, 'golpe', 'golpes')} sem efeito no mod` : '';

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
    ATQ_ALTO, DEF_ALTA, SUPORTE, SUPORTE_FORTE, CONTROLE, BUFF_EFETIVO, CONTROLE_EFETIVO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Papel = api;
})(typeof window !== 'undefined' ? window : this);
