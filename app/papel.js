/* Papel no time (DPS, Controle, Equilíbrio, Tanque, Suporte) a partir dos golpes e
   dos atributos base. Regra documentada no README, seção "Papel no time". Roda no
   navegador (window.Papel) e no Node (module.exports), para conferir a regra fora do app. */
(function (raiz) {
  'use strict';

  // natureza do golpe (battle_skill col 22, ver extrair\secoes_extra.py)
  const NAT_DANO = new Set([1, 2, 4, 5, 11]); // físico, mágico, dano fixo, % de PV, Cross Arts
  const NAT_CURA = new Set([8, 9, 10]);       // cura, cura fixa, reviver/cura em %
  // alvo do golpe (battle_skill col 33, textos skill_auto_explanation 1..13)
  const ALVO_ALIADO = new Set([2, 3, 6, 7, 12]);
  const ALVO_INIMIGO = new Set([1, 5, 11]);
  const ALVO_USUARIO = 10;

  /** Efeito principal de um golpe: dano, cura, limpeza, buff, debuff, proprio ou incerto. */
  function efeito(g) {
    if (!g || g.nat == null) return 'incerto';
    if (NAT_DANO.has(g.nat)) return 'dano';
    if (NAT_CURA.has(g.nat)) return 'cura';
    if (g.nat !== 0) return 'incerto';
    // natureza 0 (suporte): decide pelo alvo e pelo buff_set aplicado
    const buffAlvo = !!(g.bufAlvo && g.bufAlvo.length);
    const buffUsu = !!(g.bufUsu && g.bufUsu.length);
    const desc = g.desc || '';
    if (ALVO_ALIADO.has(g.alvo)) {
      if (buffAlvo) return 'buff';
      if (/\bRemove\b/.test(desc)) return 'limpeza'; // tira anormalidade, ferimento ou penalidade
      return 'incerto';
    }
    if (ALVO_INIMIGO.has(g.alvo)) {
      if (buffAlvo) return 'debuff';
      if (/Remove bônus|Rouba/.test(desc)) return 'debuff';
      return 'incerto';
    }
    // no usuário: Provocação, contra-ataque, reflexo, anular dano
    if (g.alvo === ALVO_USUARIO) return buffAlvo || buffUsu ? 'proprio' : 'incerto';
    return 'incerto'; // alvo misto (inimigo ou aliado, todos, aleatório) ou sem descrição
  }

  // Pesos e limiares (ver README). Atributos base na ordem PV PH ATQ DEF INT ESP VEL.
  const PESO = { cura: 2, buff: 1, limpeza: 1, debuff: 0.5, dano: -1, proprio: 0, incerto: 0 };
  const OFENSIVO = 1.5;   // maior entre ATQ e INT pelo menos 50% acima da média de DEF e ESP
  const DEFENSIVO = 1.0;  // maior entre ATQ e INT não passa da média de DEF e ESP
  const SUPORTE = 0;      // pontos >= 0, com pelo menos 1 golpe de cura, buff ou limpeza
  const DPS = -2;         // pontos <= -2
  const TANQUE_RAZAO = 1.25; // defesa própria só conta como tanque abaixo desta razão
  const TANQUE_PV = 1.15;    // PV pelo menos 15% acima da média do estágio
  const CONTROLE = 2;        // golpes de debuff

  const PAPEIS = ['DPS', 'Controle', 'Equilíbrio', 'Tanque', 'Suporte'];
  // Foco do Monster Arena (ma_realtime.lua, MA_foco): o Suporte cura primeiro e põe na
  // frente dos ataques todo golpe que não é dano nem cura (buff, debuff, Provocação).
  const FOCO = {
    DPS: ['Ataque', 'dano é o que ele tem'],
    Controle: ['Suporte', 'o foco Suporte lança os debuffs antes de atacar'],
    'Equilíbrio': ['Equilíbrio', 'sorteio entre dano e apoio'],
    Tanque: ['Suporte', 'o foco Suporte mantém a defesa própria ativa antes de atacar'],
    Suporte: ['Suporte', 'cura e buff passam na frente'],
  };

  function pontuar(conta, ajuste) {
    let p = ajuste;
    for (const k in conta) p += PESO[k] * conta[k];
    return p;
  }

  function classificar(conta, perfil, razao, pvRel) {
    const ajuste = perfil === 'defensivo' ? 1 : perfil === 'ofensivo' ? -1 : 0;
    const pontos = pontuar(conta, ajuste);
    const apoio = conta.cura + conta.buff + conta.limpeza;
    if (conta.proprio >= 1 && perfil === 'defensivo') return 'Tanque'; // sinal mais forte que o kit de apoio
    if (pontos >= SUPORTE && apoio >= 1) return 'Suporte';
    if ((conta.proprio >= 1 && razao != null && razao < TANQUE_RAZAO) ||
        (perfil === 'defensivo' && pvRel >= TANQUE_PV)) return 'Tanque';
    if (conta.debuff >= CONTROLE && conta.debuff >= apoio) return 'Controle';
    if (pontos <= DPS) return 'DPS';
    return 'Equilíbrio';
  }

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  /** Papel de um Digimon. pvMedio: PV base médio do estágio dele. */
  function digimon(d, golpes, pvMedio) {
    const ids = d.especiais.concat(d.aprende.map(a => a[1]));
    const conta = { dano: 0, cura: 0, limpeza: 0, buff: 0, debuff: 0, proprio: 0, incerto: 0 };
    for (const id of ids) conta[efeito(golpes[id])]++;

    let razao = null, perfil = 'neutro', pvRel = 1;
    if (d.base) {
      const [pv, , atq, def, int, esp] = d.base;
      razao = Math.max(atq, int) / ((def + esp) / 2);
      if (razao >= OFENSIVO) perfil = 'ofensivo';
      else if (razao <= DEFENSIVO) perfil = 'defensivo';
      if (pvMedio) pvRel = pv / pvMedio;
    }
    const papel = classificar(conta, perfil, razao, pvRel);

    // incerto quando os golpes não decifrados, lidos todos como cura ou todos como dano, mudam o rótulo
    const n = conta.incerto;
    const como = k => Object.assign({}, conta, { incerto: 0, [k]: conta[k] + n });
    const incerto = n > 0 && (classificar(como('cura'), perfil, razao, pvRel) !== papel ||
                              classificar(como('dano'), perfil, razao, pvRel) !== papel);

    const g = [];
    if (conta.dano) g.push(plural(conta.dano, 'golpe de dano', 'golpes de dano'));
    if (conta.cura) g.push(plural(conta.cura, 'de cura', 'de cura'));
    if (conta.limpeza) g.push(plural(conta.limpeza, 'de limpeza', 'de limpeza'));
    if (conta.buff) g.push(plural(conta.buff, 'de buff', 'de buff'));
    if (conta.debuff) g.push(plural(conta.debuff, 'de debuff', 'de debuff'));
    if (conta.proprio) g.push(plural(conta.proprio, 'de defesa própria', 'de defesa própria'));
    const partes = g.length ? [g.join(', ')] : [];
    if (d.base) {
      const [, , atq, , int] = d.base;
      if (perfil === 'ofensivo') partes.push(`${atq >= int ? 'ATQ' : 'INT'} alto`);
      else if (perfil === 'defensivo') partes.push('DEF e ESP altos');
      else partes.push('atributos equilibrados');
      if (pvRel >= TANQUE_PV) partes.push('PV alto para o estágio');
    }
    if (n) partes.push(plural(n, 'golpe de efeito incerto', 'golpes de efeito incerto'));

    return { papel, motivo: partes.join(', '), conta, perfil, razao, pvRel, incerto, foco: FOCO[papel] };
  }

  /** Papel de todos os Digimon dos dados: Map id -> resultado de digimon(). */
  function calcular(D) {
    const soma = {}, qtd = {};
    for (const d of D.digimon) if (d.base) {
      soma[d.estagio] = (soma[d.estagio] || 0) + d.base[0];
      qtd[d.estagio] = (qtd[d.estagio] || 0) + 1;
    }
    return new Map(D.digimon.map(d => [d.id, digimon(d, D.golpes, qtd[d.estagio] ? soma[d.estagio] / qtd[d.estagio] : 0)]));
  }

  const api = { efeito, digimon, calcular, classificar, PESO, PAPEIS, FOCO,
    OFENSIVO, DEFENSIVO, SUPORTE, DPS, TANQUE_RAZAO, TANQUE_PV, CONTROLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Papel = api;
})(typeof window !== 'undefined' ? window : this);
