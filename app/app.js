/* Compêndio Digimon Story: Time Stranger. Sem dependências, abre direto do disco. */
(function () {
  'use strict';
  const D = window.DADOS;
  const app = document.getElementById('app');
  if (!D) {
    app.innerHTML = '<div class="painel"><h2>Dados não encontrados</h2><p>Rode <code>python -I extrair\\extrair.py</code> na pasta do projeto para gerar <code>app/dados/dados.js</code> a partir do jogo instalado.</p></div>';
    return;
  }

  // ------------------------------------------------------------------ base
  const ST = ['PV', 'PH', 'ATQ', 'DEF', 'INT', 'ESP', 'VEL'];
  const ST10 = ['PV', 'PH', 'ATQ', 'DEF', 'INT', 'ESP', 'VEL', 'PREC', 'EVAS', 'CRÍT'];
  const RES = { 0: 'Normal', 1: 'Fraco', 2: 'Muito fraco', 3: 'Resistente', 4: 'Imune' };
  const E = D.enums;
  const porId = new Map(D.digimon.map(d => [d.id, d]));
  const evoDe = new Map(); // destino -> [origem]
  for (const [src, lst] of Object.entries(D.evolucoes)) {
    for (const ev of lst) {
      if (!evoDe.has(ev.para)) evoDe.set(ev.para, []);
      evoDe.get(ev.para).push({ de: +src, modo: ev.modo, item: ev.item });
    }
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n == null ? '' : Number(n).toLocaleString('pt-BR'));
  const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tipoNome = t => (E.tipos[t] || '').replace(/^Digimon /, '');
  const estagio = e => E.estagios[e] || '';
  const elemNome = e => (E.elementos[e] || '');
  const icElem = e => (e >= 0 && e <= 10 ? `<img class="ic" src="dados/img/ui/elem${e}.png" alt="" onerror="this.remove()">` : '');
  const icTipo = t => `<img class="ic" src="dados/img/ui/tipo${t}.png" alt="" onerror="this.remove()">`;
  const itemNome = id => (D.itens[id] ? D.itens[id].nome : `Item ${id}`);
  const persNome = p => E.personalidades[p] || '';

  // ------------------------------------------------------------------ estado local
  const CHAVE = 'compendio-dsts.v1';
  const S = Object.assign({ col: {}, metas: [], spoiler: false, pers: 0, red: {}, cmp: [], vista: {} }, normalizar(ler()));
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  // Tudo que vem do navegador ou de backup importado vira número validado antes de
  // chegar ao HTML (ids de Digimon existentes, níveis 0..2, personalidade 0..16).
  function normalizar(o) {
    const out = {};
    if (!o || typeof o !== 'object') return out;
    const idOk = x => Number.isInteger(+x) && porId.has(+x);
    if (o.col && typeof o.col === 'object') {
      out.col = {};
      for (const [k, v] of Object.entries(o.col)) if (idOk(k) && (+v === 1 || +v === 2)) out.col[+k] = +v;
    }
    if (Array.isArray(o.metas)) out.metas = o.metas.filter(m => m && idOk(m.de) && idOk(m.para)).map(m => ({ de: +m.de, para: +m.para }));
    if (Array.isArray(o.cmp)) out.cmp = o.cmp.filter(idOk).map(Number).slice(0, 9);
    if (o.pers != null) { const p = +o.pers; out.pers = Number.isInteger(p) && p >= 0 && p <= 16 ? p : 0; }
    if (o.red && typeof o.red === 'object') {
      out.red = {};
      for (const [k, v] of Object.entries(o.red)) if (/^[1-4]$/.test(k) && Number.isInteger(+v) && +v >= 0 && +v <= 4) out.red[k] = +v;
    }
    if (o.spoiler != null) out.spoiler = !!o.spoiler;
    if (o.vista && typeof o.vista === 'object') {
      // filtros de texto passam por esc() ou só viram .value; ids e números são revalidados
      const v = out.vista = Object.assign({}, o.vista);
      v.arvore = idOk(v.arvore) ? +v.arvore : undefined;
      v.prof = [1, 2, 3, 4, 6].includes(+v.prof) ? +v.prof : undefined;
      if (v.caminho && typeof v.caminho === 'object') {
        const c = v.caminho;
        v.caminho = { a: idOk(c.a) ? +c.a : 0, b: idOk(c.b) ? +c.b : 0, est: Array.isArray(c.est) ? c.est.map(Number).filter(Number.isInteger) : [],
          patente: Number.isInteger(+c.patente) ? +c.patente : 0, tenho: !!c.tenho, devo: c.devo !== false };
      } else delete v.caminho;
      for (const k of ['lista', 'itf']) if (v[k] && typeof v[k] !== 'object') delete v[k];
      if (typeof v.itensAba !== 'string') delete v.itensAba;
    }
    return out;
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) { aviso('Não deu para salvar no navegador.'); } }
  function aviso(t) { const el = document.getElementById('dica'); el.textContent = t; el.hidden = false; clearTimeout(aviso.t); aviso.t = setTimeout(() => (el.hidden = true), 2200); }

  const status = id => S.col[id] || 0; // 0 desconhecido, 1 visto, 2 obtido
  const oculto = id => S.spoiler && !status(id);
  const nome = id => { const d = porId.get(id); if (!d) return `#${id}`; return oculto(id) ? '???' : d.nome; };
  function ret(id, cls) {
    const d = porId.get(id);
    if (!d || d.img == null) return `<span class="ret ${cls || ''}"></span>`;
    return `<img class="ret ${cls || ''} ${oculto(id) ? 'oculto' : ''}" loading="lazy" src="dados/img/${String(d.img).padStart(3, '0')}.webp" alt="">`;
  }
  const link = id => `<a href="#/digimon/${encodeURIComponent(id)}">${esc(nome(id))}</a>`;
  const MARCA = ['', '👁', '★'];

  // ------------------------------------------------------------------ redução por personalidade
  // Habilidade de agente "Digievolução de <categoria>": reduz os atributos exigidos
  // quando a personalidade atual do Digimon é igual à personalidade base do alvo.
  function reducao(alvo) {
    const d = porId.get(alvo);
    if (!S.pers || !d || d.pers !== S.pers) return 0;
    const cat = D.persCat[S.pers];
    const r = D.reducao.find(x => x.cat === cat && (!x.pers || x.pers === S.pers));
    const copias = +(S.red[cat] || 0);
    return r ? Math.min(100, r.pct * copias) : 0;
  }
  function linhasCond(alvo, origem) {
    const c = D.condicoes[alvo];
    const out = [];
    if (!c) return [{ t: 'Sem condição na tabela' }];
    const pct = reducao(alvo);
    if (c.patente) out.push({ t: `Patente de Agente ${c.patente} ou superior` });
    if (c.nivel) out.push({ t: `Nível ${c.nivel} ou superior` });
    if (c.st) c.st.forEach((v, k) => {
      if (!v) return;
      if (pct) {
        const r = Math.floor(v * (100 - pct) / 100);
        out.push({ t: `${ST[k]} ${fmt(r)} ou mais`, extra: `<span class="risco">${fmt(v)}</span> −${pct}%`, red: 1 });
      } else out.push({ t: `${ST[k]} ${fmt(v)} ou mais` });
    });
    if (c.talento) out.push({ t: `Talento ${c.talento} ou mais` });
    if (c.elo) out.push({ t: `Elo ${c.elo}% ou mais` });
    if (c.item) out.push({ t: `Ter o item ${itemNome(c.item)}` });
    if (c.dna) {
      const outros = c.dna.filter(x => x[0] !== origem);
      const lst = (outros.length && outros.length < c.dna.length ? outros : c.dna);
      out.push({ t: 'DNA: ' + lst.map(([id, p]) => `${link(id)}${p ? ` (personalidade ${esc(persNome(p))})` : ''}`).join(' + '), html: 1 });
    }
    if (c.especial) out.push({ t: 'Condição especial de história (não decifrada nas tabelas)', av: 1 });
    if (c.cru) out.push({ t: 'Não decifrado: ' + c.cru.join(', '), av: 1 });
    if (!out.length) out.push({ t: 'Sem requisito' });
    return out;
  }
  function htmlCond(alvo, origem) {
    return '<ul>' + linhasCond(alvo, origem).map(l =>
      `<li class="${l.red ? 'red' : ''} ${l.av ? 'aviso' : ''}">${l.html ? l.t : esc(l.t)}${l.extra ? ' <small>' + l.extra + '</small>' : ''}</li>`).join('') + '</ul>';
  }

  // ------------------------------------------------------------------ roteador
  const rotas = {};
  function ir() {
    const h = location.hash.replace(/^#\/?/, '') || 'digimon';
    const [v, ...args] = h.split('/');
    document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('ativo', a.dataset.v === (v === 'item' ? 'itens' : v)));
    (rotas[v] || rotas.digimon)(...args.map(decodeURIComponent));
    if (!ir.manter) window.scrollTo(0, 0);
    ir.manter = false;
  }
  window.addEventListener('hashchange', ir);
  const spoilerBox = document.getElementById('spoiler');
  spoilerBox.checked = S.spoiler;
  spoilerBox.addEventListener('change', () => { S.spoiler = spoilerBox.checked; salvar(); ir.manter = true; ir(); });

  // ------------------------------------------------------------------ seletor de Digimon com busca
  function seletor(el, aoEscolher, placeholder) {
    el.classList.add('busca');
    el.innerHTML = `<input type="search" placeholder="${esc(placeholder || 'Buscar Digimon…')}"><div class="sug" hidden></div>`;
    const inp = el.querySelector('input'), sug = el.querySelector('.sug');
    let itens = [], sel = 0;
    function mostrar() {
      const q = semAcento(inp.value.trim());
      if (!q) { sug.hidden = true; return; }
      itens = D.digimon.filter(d => !oculto(d.id) && (semAcento(d.nome).includes(q) || String(d.dex) === q)).slice(0, 30);
      sel = 0;
      sug.innerHTML = itens.map((d, i) => `<div data-i="${i}" class="${i === 0 ? 'sel' : ''}">${ret(d.id, 'p')}<span>${esc(d.nome)} <small>${esc(estagio(d.estagio))}</small></span></div>`).join('') || '<div><small>Nada encontrado</small></div>';
      sug.hidden = false;
    }
    function escolher(i) { const d = itens[i]; if (!d) return; inp.value = ''; sug.hidden = true; aoEscolher(d.id); }
    inp.addEventListener('input', mostrar);
    inp.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault(); sel = Math.max(0, Math.min(itens.length - 1, sel + (ev.key === 'ArrowDown' ? 1 : -1)));
        sug.querySelectorAll('div').forEach((x, i) => x.classList.toggle('sel', i === sel));
      } else if (ev.key === 'Enter') { ev.preventDefault(); escolher(sel); }
      else if (ev.key === 'Escape') sug.hidden = true;
    });
    sug.addEventListener('mousedown', ev => { const x = ev.target.closest('[data-i]'); if (x) { ev.preventDefault(); escolher(+x.dataset.i); } });
    inp.addEventListener('blur', () => setTimeout(() => (sug.hidden = true), 150));
    return inp;
  }

  // ------------------------------------------------------------------ lista de Digimon
  rotas.digimon = function (id) {
    if (id) return detalhe(+id);
    const f = S.vista.lista || (S.vista.lista = { q: '', est: '', tipo: '', fam: '', col: '', dlc: '', ord: 'dex' });
    app.innerHTML = `
      <div class="filtros">
        <input type="search" id="q" placeholder="Nome ou nº do guia" value="${esc(f.q)}">
        <select id="est"><option value="">Todos os estágios</option>${Object.entries(E.estagios).filter(([k, v]) => +k > 0 && D.digimon.some(d => d.estagio === +k)).map(([k, v]) => `<option value="${k}">${esc(v)}${+k >= 8 && +k <= 13 ? ' (' + k + ')' : ''}</option>`).join('')}</select>
        <select id="tipo"><option value="">Todos os tipos</option>${Object.keys(E.tipos).map(k => `<option value="${k}">${esc(tipoNome(k))}</option>`).join('')}</select>
        <select id="fam"><option value="">Todas as famílias</option>${Object.entries(E.familias).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
        <select id="col"><option value="">Coleção: todos</option><option value="0">Desconhecidos</option><option value="1">Vistos</option><option value="2">Obtidos</option><option value="12">Vistos ou obtidos</option></select>
        <select id="dlc"><option value="">Base e DLC</option><option value="b">Só base</option><option value="d">Só DLC</option></select>
        <select id="ord"><option value="dex">Ordem do guia</option><option value="nome">Nome</option><option value="est">Estágio</option>${ST.map((s, k) => `<option value="s${k}">${s} base</option>`).join('')}</select>
        <span class="conta" id="conta"></span>
      </div>
      <div class="grade" id="grade"></div>`;
    for (const k of ['est', 'tipo', 'fam', 'col', 'dlc', 'ord']) app.querySelector('#' + k).value = f[k];
    const desenhar = () => {
      const q = semAcento(f.q.trim());
      let l = D.digimon.filter(d =>
        (!q || (!oculto(d.id) && semAcento(d.nome).includes(q)) || String(d.dex) === q) &&
        (!f.est || d.estagio === +f.est) && (!f.tipo || d.tipo === +f.tipo) &&
        (!f.fam || d.familias.includes(+f.fam)) &&
        (!f.col || (f.col === '12' ? status(d.id) > 0 : status(d.id) === +f.col)) &&
        (!f.dlc || (f.dlc === 'd') === !!d.dlc));
      if (f.ord === 'nome') l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
      else if (f.ord === 'est') l.sort((a, b) => a.estagio - b.estagio || a.dex - b.dex);
      else if (f.ord[0] === 's') { const k = +f.ord.slice(1); l.sort((a, b) => ((b.base || [])[k] || 0) - ((a.base || [])[k] || 0)); }
      app.querySelector('#conta').textContent = `${l.length} de ${D.digimon.length}`;
      app.querySelector('#grade').innerHTML = l.map(d => `
        <a class="card" href="#/digimon/${d.id}">
          <span class="dex">${d.dex}</span><span class="marca-col">${MARCA[status(d.id)]}</span>
          ${ret(d.id)}<span class="nome">${esc(nome(d.id))}</span>
          <span class="meta">${esc(estagio(d.estagio))}${oculto(d.id) ? '' : ' · ' + esc(tipoNome(d.tipo))}</span>
          ${d.dlc ? '<span class="tag dlc">DLC</span>' : ''}
        </a>`).join('') || '<p class="vazio">Nenhum Digimon com esses filtros.</p>';
    };
    app.querySelector('#q').addEventListener('input', e => { f.q = e.target.value; desenhar(); });
    for (const k of ['est', 'tipo', 'fam', 'col', 'dlc', 'ord']) app.querySelector('#' + k).addEventListener('change', e => { f[k] = e.target.value; salvar(); desenhar(); });
    desenhar();
    app.querySelector('#q').focus();
  };

  // ------------------------------------------------------------------ detalhe
  function botoesColecao(id) {
    const s = status(id);
    return `<span class="seg col-status" data-id="${id}">${['Desconhecido', 'Visto', 'Obtido'].map((t, i) => `<button data-s="${i}" class="${s === i ? 'ativo' : ''}">${t}</button>`).join('')}</span>`;
  }
  function ligarColecao(raiz, depois) {
    raiz.querySelectorAll('.col-status').forEach(g => g.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      const id = +g.dataset.id, s = +b.dataset.s;
      if (s) S.col[id] = s; else delete S.col[id];
      salvar(); depois ? depois() : (ir.manter = true, ir());
    }));
  }
  function tabelaGolpes(lista) {
    return `<div class="tabela-rolagem"><table><thead><tr><th>Golpe</th><th>Elem.</th><th>Natureza</th><th class="num">Poder</th><th class="num">PH</th><th>Alvo</th><th class="num">Prec.</th></tr></thead><tbody>${lista.map(([rot, id]) => {
      const g = D.golpes[id] || { nome: `#${id}` };
      const ac = g.ac && (g.ac[0] > 1 || g.ac[1] > 1) ? ` ×${g.ac[0]}${g.ac[1] !== g.ac[0] ? '~' + g.ac[1] : ''}` : '';
      const ef = [].concat((g.bufAlvo || []).map(b => `${b[1]}% ${b[0]}`), (g.bufUsu || []).map(b => `${b[0]} (usuário)`));
      return `<tr><td>${rot ? `<small>${esc(rot)}</small> ` : ''}<b>${esc(g.nome)}</b>${g.desc ? `<div class="desc">${esc(g.desc)}</div>` : ''}${ef.length ? `<div class="desc">${esc(ef.join(' · '))}</div>` : ''}</td>
        <td>${g.el >= 0 ? icElem(g.el) + ' ' + esc(elemNome(g.el)) : ''}</td><td>${esc(D.naturezas[g.nat] || '')}</td>
        <td class="num">${g.pod ? fmt(g.pod) + ac : ''}</td><td class="num">${g.ph ? fmt(g.ph) : ''}</td>
        <td>${esc(D.alvos[g.alvo] || '')}</td><td class="num">${g.sempre ? 'sempre' : g.prec ? g.prec + '%' : ''}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function seletorPersonalidade() {
    return `<label>Personalidade do seu Digimon: <select class="sel-pers"><option value="0">não informada</option>${Object.entries(E.personalidades).map(([k, v]) => `<option value="${k}" ${+k === S.pers ? 'selected' : ''}>${esc(v)} (${esc(D.persCatNomes[D.persCat[k]] || '')})</option>`).join('')}</select></label>`;
  }
  function ligarPersonalidade(raiz) {
    raiz.querySelectorAll('.sel-pers').forEach(s => s.addEventListener('change', () => { S.pers = +s.value; salvar(); ir.manter = true; ir(); }));
  }

  function detalhe(id) {
    const d = porId.get(id);
    if (!d) { app.innerHTML = '<p class="vazio">Digimon não encontrado.</p>'; return; }
    if (oculto(id)) {
      app.innerHTML = `<div class="painel cab">${ret(id, 'g')}<div class="info"><h1>??? <small>nº ${d.dex}</small></h1>
        <p class="suave">Modo sem spoiler: marque como visto para revelar.</p>${botoesColecao(id)}</div></div>`;
      ligarColecao(app);
      return;
    }
    const max = Math.max(...D.digimon.map(x => Math.max(...(x.base || [0]))));
    const para = D.evolucoes[id] || [];
    const de = evoDe.get(id) || [];
    const metaDe = new Set(S.metas.filter(m => m.de === id).map(m => m.para));
    const loc = D.locais[id] || [];
    const sorted = arr => arr.slice().sort((a, b) => (porId.get(a.para || a.de) || {}).estagio - (porId.get(b.para || b.de) || {}).estagio);
    app.innerHTML = `
      <div class="painel cab">
        ${ret(id, 'g')}
        <div class="info">
          <h1>${esc(d.nome)} <small class="suave">nº ${d.dex}</small> ${d.dlc ? '<span class="tag dlc">DLC ' + d.dlc + '</span>' : ''}</h1>
          <div class="linha">
            <span class="tag">${esc(estagio(d.estagio))}</span>
            <span class="tag">${icTipo(d.tipo)} ${esc(tipoNome(d.tipo))}</span>
            <span class="tag">Personalidade base: ${esc(persNome(d.pers))}</span>
            ${d.familias.map(f => `<span class="tag">${esc(E.familias[f] || '')}</span>`).join('')}
          </div>
          <div class="linha" style="margin-top:8px">${botoesColecao(id)}
            <a href="#/arvore/${id}">Árvore</a> · <a href="#/caminho/${id}">Caminho a partir daqui</a> · <a href="#" id="add-cmp">Comparar</a></div>
          ${d.perfil ? `<p class="perfil">${esc(d.perfil)}</p>` : ''}
        </div>
      </div>
      <div class="duas">
        <div class="painel"><h2>Atributos base</h2>
          ${d.base ? `<div class="barras">${d.base.map((v, k) => `<span>${ST[k]}</span><span class="barra"><i style="width:${(100 * v / max).toFixed(1)}%"></i></span><span class="num">${fmt(v)}</span>`).join('')}</div>
          <p><small>Total ${fmt(d.base.reduce((a, b) => a + b, 0))}. Valor base da espécie na tabela do jogo (sem treino, nível ou bônus).</small></p>` : '<p class="vazio">Sem atributos na tabela.</p>'}
        </div>
        <div class="painel"><h2>Resistências</h2>
          <div class="res">${d.res.map((v, k) => `<div>${icElem(k + 1)}<span>${esc(elemNome(k + 1))}</span><span class="v${v}">${RES[v] || v}${E.resist[v] != null && v ? ' ×' + E.resist[v] : ''}</span></div>`).join('')}</div>
        </div>
      </div>
      <div class="painel"><h2>Golpes</h2>
        ${tabelaGolpes(d.especiais.map((g, i) => ['Especial', g]).concat(d.aprende.map(([nv, g]) => ['Nv. ' + nv, g])))}
      </div>
      <div class="painel"><h2>Evolui para (${para.length})</h2>
        <div class="linha" style="margin-bottom:10px">${seletorPersonalidade()} <small class="suave">${reducaoResumo()}</small></div>
        <div class="evos">${sorted(para).map(ev => `
          <div class="evo"><div class="topo-evo">${ret(ev.para, 'p')}<div><a class="n" href="#/digimon/${ev.para}">${esc(nome(ev.para))}</a>
            <div><small>${esc(estagio((porId.get(ev.para) || {}).estagio))}${ev.modo ? ' · Mudança de Modo' : ''}${!oculto(ev.para) ? ' · base ' + esc(persNome((porId.get(ev.para) || {}).pers)) : ''}</small></div></div></div>
            ${ev.item != null ? `<p class="aviso">Item ligado à evolução: ${esc(D.itens[ev.item] ? D.itens[ev.item].nome : 'id ' + ev.item + ' (sem nome no jogo)')}</p>` : ''}
            ${htmlCond(ev.para, id)}
            <div class="acoes"><button data-meta="${ev.para}" class="${metaDe.has(ev.para) ? 'ativo' : ''}">${metaDe.has(ev.para) ? '✓ Meta' : 'Marcar como meta'}</button></div>
          </div>`).join('') || '<p class="vazio">Não evolui.</p>'}</div>
      </div>
      <div class="painel"><h2>Evolui de (${de.length})</h2>
        <div class="evos">${sorted(de).map(ev => `<div class="evo"><div class="topo-evo">${ret(ev.de, 'p')}<div><a class="n" href="#/digimon/${ev.de}">${esc(nome(ev.de))}</a><div><small>${esc(estagio((porId.get(ev.de) || {}).estagio))}${ev.modo ? ' · Mudança de Modo' : ''}</small></div></div></div></div>`).join('') || '<p class="vazio">Nenhuma evolução leva a este Digimon.</p>'}</div>
        ${de.length ? '<p><small>O jogo permite De-digievoluir para estas formas.</small></p>' : ''}
      </div>
      <div class="painel"><h2>Locais</h2>
        ${loc.length ? `<ul>${loc.map(l => `<li>${esc(l.mapa)}${l.eras ? ' <span class="tag">' + l.eras.join(' e ') + '</span>' : ''}${l.hist ? ' <small>depende do avanço da história</small>' : ''}${l.evento ? ' <span class="tag">evento</span>' : ''}${l.dlc ? ' <span class="tag dlc">DLC</span>' : ''}</li>`).join('')}</ul>
        <p><small>Encontros no campo (símbolos de inimigo). 2020 e 2028 são as duas eras do jogo.</small></p>` : '<p class="vazio">Não aparece solto no campo: obtido por evolução, evento ou missão.</p>'}
      </div>`;
    ligarColecao(app);
    ligarPersonalidade(app);
    app.querySelector('#add-cmp').addEventListener('click', ev => { ev.preventDefault(); adicionarComparar(id); });
    app.querySelectorAll('[data-meta]').forEach(b => b.addEventListener('click', () => {
      const alvo = +b.dataset.meta, i = S.metas.findIndex(m => m.de === id && m.para === alvo);
      if (i >= 0) S.metas.splice(i, 1); else S.metas.push({ de: id, para: alvo });
      salvar(); ir.manter = true; ir();
    }));
  }
  function reducaoResumo() {
    if (!S.pers) return 'Escolha a personalidade para ver a redução das habilidades de agente.';
    const cat = D.persCat[S.pers];
    const r = D.reducao.find(x => x.cat === cat);
    const c = +(S.red[cat] || 0);
    if (!r) return '';
    if (!c) return `${r.nome}: não marcada como comprada (veja Ajustes).`;
    return `${r.nome} ×${c}: −${r.pct * c}% nos atributos quando a personalidade base do alvo é ${persNome(S.pers)}.`;
  }

  // ------------------------------------------------------------------ árvore
  rotas.arvore = function (id) {
    id = +id || S.vista.arvore || 50;
    S.vista.arvore = id; salvar();
    const prof = S.vista.prof || 2;
    app.innerHTML = `<div class="filtros"><span id="sel"></span>
      <label>Profundidade <select id="prof">${[1, 2, 3, 4, 6].map(n => `<option ${n === prof ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <small class="suave">Clique num Digimon para centralizar. Tracejado: Mudança de Modo. Barra verde: obtido.</small></div>
      <div class="painel"><div class="arvore" id="arv"></div></div>`;
    seletor(app.querySelector('#sel'), x => (location.hash = '#/arvore/' + x));
    app.querySelector('#prof').addEventListener('change', e => { S.vista.prof = +e.target.value; salvar(); ir.manter = true; ir(); });
    // colunas por distância: negativas = antecessores, positivas = sucessores
    const nivel = new Map([[id, 0]]), arestas = [];
    let borda = [id];
    for (let p = 1; p <= prof; p++) {
      const prox = [];
      for (const x of borda) for (const ev of D.evolucoes[x] || []) {
        arestas.push([x, ev.para, ev.modo]);
        if (!nivel.has(ev.para)) { nivel.set(ev.para, p); prox.push(ev.para); }
      }
      borda = prox;
    }
    borda = [id];
    for (let p = 1; p <= prof; p++) {
      const prox = [];
      for (const x of borda) for (const ev of evoDe.get(x) || []) {
        arestas.push([ev.de, x, ev.modo]);
        if (!nivel.has(ev.de)) { nivel.set(ev.de, -p); prox.push(ev.de); }
      }
      borda = prox;
    }
    const cols = new Map();
    for (const [n, l] of nivel) { if (!cols.has(l)) cols.set(l, []); cols.get(l).push(n); }
    const chaves = [...cols.keys()].sort((a, b) => a - b);
    const arv = app.querySelector('#arv');
    arv.innerHTML = chaves.map(k => `<div class="col"><h3>${k < 0 ? 'Antes ' + -k : k > 0 ? 'Depois ' + k : 'Centro'}</h3>${cols.get(k).sort((a, b) => (porId.get(a).estagio - porId.get(b).estagio) || a - b).map(n =>
      `<a class="no ${n === id ? 'centro' : ''} ${status(n) === 2 ? 'tem' : ''}" data-n="${n}" href="#/arvore/${n}">${ret(n, 'p')}<span>${esc(nome(n))}<br><small>${esc(estagio(porId.get(n).estagio))}</small></span></a>`).join('')}</div>`).join('');
    if (nivel.size > 1) {
      requestAnimationFrame(() => {
        const base = arv.getBoundingClientRect();
        const pos = n => { const el = arv.querySelector(`[data-n="${n}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x1: r.left - base.left + arv.scrollLeft, x2: r.right - base.left + arv.scrollLeft, y: r.top - base.top + r.height / 2 }; };
        const vistas = new Set();
        let svg = '';
        for (const [a, b, modo] of arestas) {
          const k = a + '>' + b; if (vistas.has(k)) continue; vistas.add(k);
          const pa = pos(a), pb = pos(b); if (!pa || !pb) continue;
          const [s, t] = pa.x2 <= pb.x1 ? [{ x: pa.x2, y: pa.y }, { x: pb.x1, y: pb.y }] : [{ x: pa.x1, y: pa.y }, { x: pb.x2, y: pb.y }];
          const m = (s.x + t.x) / 2;
          svg += `<path class="${modo ? 'modo' : ''}" d="M${s.x},${s.y} C${m},${s.y} ${m},${t.y} ${t.x},${t.y}"/>`;
        }
        arv.insertAdjacentHTML('afterbegin', `<svg class="linhas" width="${arv.scrollWidth}" height="${arv.scrollHeight}">${svg}</svg>`);
      });
    }
  };

  // ------------------------------------------------------------------ caminho mais curto
  rotas.caminho = function (a, b) {
    const c = S.vista.caminho || (S.vista.caminho = { a: 0, b: 0, est: [], patente: 0, tenho: false, devo: true });
    if (a) c.a = +a; if (b) c.b = +b;
    salvar();
    const estagios = [...new Set(D.digimon.map(d => d.estagio))].sort((x, y) => x - y);
    app.innerHTML = `
      <div class="painel">
        <div class="linha"><b>De</b> <span id="sa"></span> ${c.a ? ret(c.a, 'p') + ' ' + link(c.a) : ''}
          <button id="troca" title="Inverter">⇄</button>
          <b>Para</b> <span id="sb"></span> ${c.b ? ret(c.b, 'p') + ' ' + link(c.b) : ''}</div>
        <details style="margin-top:10px" ${c.est.length || c.patente || c.tenho || !c.devo ? 'open' : ''}><summary>Filtros</summary>
          <div class="chips" style="margin:8px 0">Estágios permitidos no meio do caminho:
            ${estagios.map(e => `<label><input type="checkbox" data-est="${e}" ${!c.est.length || c.est.includes(e) ? 'checked' : ''}>${esc(estagio(e))}${e >= 8 && e <= 13 ? ' ' + e : ''}</label>`).join('')}</div>
          <div class="linha">
            <label>Patente de Agente máxima <select id="pat"><option value="0">qualquer</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option ${n === c.patente ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label><input type="checkbox" id="tenho" ${c.tenho ? 'checked' : ''}> Só Digimon que tenho (obtidos)</label>
            <label><input type="checkbox" id="devo" ${c.devo ? 'checked' : ''}> Permitir De-digievolução</label>
          </div>
        </details>
      </div>
      <div id="res"></div>`;
    seletor(app.querySelector('#sa'), x => { c.a = x; salvar(); location.hash = '#/caminho'; ir(); }, 'Origem…');
    seletor(app.querySelector('#sb'), x => { c.b = x; salvar(); location.hash = '#/caminho'; ir(); }, 'Destino…');
    app.querySelector('#troca').addEventListener('click', () => { [c.a, c.b] = [c.b, c.a]; salvar(); ir.manter = true; ir(); });
    app.querySelectorAll('[data-est]').forEach(x => x.addEventListener('change', () => {
      c.est = [...app.querySelectorAll('[data-est]')].filter(y => y.checked).map(y => +y.dataset.est);
      if (c.est.length === estagios.length) c.est = [];
      salvar(); calcular();
    }));
    app.querySelector('#pat').addEventListener('change', e => { c.patente = +e.target.value; salvar(); calcular(); });
    app.querySelector('#tenho').addEventListener('change', e => { c.tenho = e.target.checked; salvar(); calcular(); });
    app.querySelector('#devo').addEventListener('change', e => { c.devo = e.target.checked; salvar(); calcular(); });
    function calcular() {
      const res = app.querySelector('#res');
      if (!c.a || !c.b) { res.innerHTML = '<p class="vazio">Escolha a origem e o destino.</p>'; return; }
      if (c.a === c.b) { res.innerHTML = '<p class="vazio">Origem e destino são o mesmo Digimon.</p>'; return; }
      const pode = n => n === c.a || n === c.b || ((!c.est.length || c.est.includes(porId.get(n).estagio)) && (!c.tenho || status(n) === 2));
      const veio = new Map([[c.a, null]]);
      let fila = [c.a];
      while (fila.length && !veio.has(c.b)) {
        const prox = [];
        for (const x of fila) {
          const viz = (D.evolucoes[x] || []).filter(ev => !c.patente || !(D.condicoes[ev.para] || {}).patente || D.condicoes[ev.para].patente <= c.patente).map(ev => [ev.para, ev.modo ? 'modo' : 'evo']);
          if (c.devo) for (const ev of evoDe.get(x) || []) viz.push([ev.de, ev.modo ? 'modo' : 'devo']);
          for (const [n, tipo] of viz) if (!veio.has(n) && pode(n)) { veio.set(n, [x, tipo]); prox.push(n); }
        }
        fila = prox;
      }
      if (!veio.has(c.b)) { res.innerHTML = '<div class="painel"><p>Não há caminho com esses filtros.</p></div>'; return; }
      const passos = [];
      for (let n = c.b; n !== c.a; n = veio.get(n)[0]) passos.unshift([veio.get(n)[0], n, veio.get(n)[1]]);
      const rot = { evo: 'Digievolui', devo: 'De-digievolui', modo: 'Mudança de Modo' };
      res.innerHTML = `<div class="painel"><h2>${passos.length} passo${passos.length > 1 ? 's' : ''}</h2>
        <div class="linha" style="margin-bottom:10px">${seletorPersonalidade()}</div>
        <div class="passos"><div class="passo">${ret(c.a, 'p')} <b>${link(c.a)}</b></div>
        ${passos.map(([de, para, tipo]) => `<div class="passo"><span class="seta">↓ ${rot[tipo]}</span>
          <div class="evo" style="flex:1"><div class="topo-evo">${ret(para, 'p')}<div><a class="n" href="#/digimon/${para}">${esc(nome(para))}</a><div><small>${esc(estagio(porId.get(para).estagio))}</small></div></div></div>
          ${tipo === 'devo' ? '<p><small>De-digievolução: sem requisitos de atributo.</small></p>' : htmlCond(para, de)}</div></div>`).join('')}</div></div>`;
      ligarPersonalidade(res);
    }
    calcular();
  };

  // ------------------------------------------------------------------ comparar (até 9 lado a lado)
  function adicionarComparar(id) {
    if (S.cmp.includes(id)) { location.hash = '#/comparar'; return; }
    if (S.cmp.length >= 9) { aviso('Máximo de 9 na comparação.'); return; }
    S.cmp.push(id); salvar(); location.hash = '#/comparar';
  }
  rotas.comparar = function () {
    const l = S.cmp.filter(x => porId.has(x));
    app.innerHTML = `<div class="filtros"><span id="sel"></span><span class="suave">${l.length}/9 abas</span>
      ${l.length ? '<button id="limpar">Limpar</button>' : ''}</div><div class="cmp" id="cmp" style="--n:${Math.max(1, l.length)}"></div>`;
    seletor(app.querySelector('#sel'), x => adicionarComparar(x) || rotas.comparar(), 'Adicionar Digimon…');
    if (app.querySelector('#limpar')) app.querySelector('#limpar').addEventListener('click', () => { S.cmp = []; salvar(); rotas.comparar(); });
    if (!l.length) { app.querySelector('#cmp').innerHTML = '<p class="vazio">Adicione até 9 Digimon para comparar lado a lado.</p>'; return; }
    const melhor = ST.map((_, k) => Math.max(...l.map(id => (porId.get(id).base || [])[k] || 0)));
    app.querySelector('#cmp').innerHTML = l.map((id, i) => {
      const d = porId.get(id), o = oculto(id);
      const tot = d.base ? d.base.reduce((a, b) => a + b, 0) : 0;
      return `<div class="painel col">
        <div class="linha" style="justify-content:space-between"><span class="suave">Aba ${i + 1}</span><span>
          ${i ? `<button data-mv="${i}" data-d="-1" title="Mover para a esquerda">←</button>` : ''}
          ${i < l.length - 1 ? `<button data-mv="${i}" data-d="1" title="Mover para a direita">→</button>` : ''}
          <button data-rm="${id}" title="Remover">✕</button></span></div>
        <div style="text-align:center">${ret(id, 'g')}<h3>${link(id)}</h3><small>${esc(estagio(d.estagio))}${o ? '' : ' · ' + esc(tipoNome(d.tipo)) + ' · ' + esc(persNome(d.pers))}</small></div>
        ${o ? '' : `<table>${(d.base || []).map((v, k) => `<tr><td>${ST[k]}</td><td class="num ${v === melhor[k] && l.length > 1 ? 'melhor' : ''}">${fmt(v)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="num"><b>${fmt(tot)}</b></td></tr></table>
        <h3 style="margin-top:10px">Resistências</h3>
        <div>${d.res.map((v, k) => v ? `<div>${icElem(k + 1)} ${esc(elemNome(k + 1))}: <span class="v${v}">${RES[v]}</span></div>` : '').join('') || '<small>Nenhuma fraqueza ou resistência</small>'}</div>
        <h3 style="margin-top:10px">Golpes</h3>
        <div>${d.especiais.concat(d.aprende.map(x => x[1])).map(g => { const s = D.golpes[g] || {}; return `<div>${icElem(s.el)} ${esc(s.nome || g)} <small>${s.pod ? s.pod : ''}</small></div>`; }).join('')}</div>
        <h3 style="margin-top:10px">Evolui para</h3><div>${(D.evolucoes[id] || []).map(ev => link(ev.para)).join(', ') || '<small>nada</small>'}</div>`}
      </div>`;
    }).join('');
    app.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { S.cmp = S.cmp.filter(x => x !== +b.dataset.rm); salvar(); rotas.comparar(); }));
    app.querySelectorAll('[data-mv]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.mv, j = i + +b.dataset.d; [S.cmp[i], S.cmp[j]] = [S.cmp[j], S.cmp[i]]; salvar(); rotas.comparar();
    }));
  };

  // ------------------------------------------------------------------ itens
  const lojasDoItem = new Map();
  D.lojas.forEach(l => l.itens.forEach(v => { if (!lojasDoItem.has(v[0])) lojasDoItem.set(v[0], []); lojasDoItem.get(v[0]).push([l, v]); }));
  const lojaNome = l => (l.lojistaNome ? `Loja de ${l.lojistaNome}` : `Loja ${l.id}`) + (l.mapas && l.mapas.length ? ` (${l.mapas.join(', ')})` : '');
  const qtd = (lst) => lst.map(([i, q]) => `${q}× <a href="#/item/${i}">${esc(itemNome(i))}</a>`).join(', ');

  rotas.item = function (id) {
    const it = D.itens[id];
    if (!it) { app.innerHTML = '<p class="vazio">Item não encontrado.</p>'; return; }
    const g = it.golpe && D.golpes[it.golpe];
    const feito = D.receitas.filter(r => r.res === +id);
    const usado = D.receitas.filter(r => r.mat.some(m => m[0] === +id));
    const decomp = D.decomposicao.filter(r => r.de === +id);
    const vemDe = D.decomposicao.filter(r => r.da.some(m => m[0] === +id));
    const lojas = lojasDoItem.get(+id) || [];
    app.innerHTML = `<p><a href="#/itens">← Itens</a></p>
      <div class="painel"><h1>${g ? icElem(g.el) + ' ' : ''}${esc(it.nome)}</h1>
        <div class="linha"><span class="tag">${esc(D.categorias[it.cat] || '')}</span>${it.dlc ? '<span class="tag dlc">DLC ' + it.dlc + '</span>' : ''}
          ${it.compra ? `<span>Compra: <b>${fmt(it.compra)}</b></span>` : ''}${it.venda ? `<span>Venda: <b>${fmt(it.venda)}</b></span>` : ''}</div>
        ${it.desc ? `<p class="perfil">${esc(it.desc)}</p>` : ''}
        ${it.st ? `<p>${it.st.map((v, k) => v ? `${ST10[k]} ${v > 0 ? '+' : ''}${fmt(v)}` : '').filter(Boolean).join(' · ')}</p>` : ''}
        ${it.prot ? `<p>Proteção contra: ${it.prot.map(e => icElem(e) + ' ' + esc(elemNome(e))).join(', ')}</p>` : ''}
        ${it.efeito ? `<p>${it.efeito.map(esc).join('<br>')}</p>` : ''}
      </div>
      ${g ? `<div class="painel"><h2>Golpe ensinado</h2>${tabelaGolpes([['', it.golpe]])}</div>` : ''}
      ${feito.length ? `<div class="painel"><h2>Criação</h2><ul>${feito.map(r => `<li>${qtd(r.mat) || '<small>sem material</small>'}${r.custo ? ` + ${fmt(r.custo)} de custo` : ''}</li>`).join('')}</ul></div>` : ''}
      ${usado.length ? `<div class="painel"><h2>Usado para criar</h2><ul>${usado.map(r => `<li><a href="#/item/${r.res}">${esc(itemNome(r.res))}</a> <small>(${qtd(r.mat).replace(/<[^>]+>/g, '')})</small></li>`).join('')}</ul></div>` : ''}
      ${decomp.length ? `<div class="painel"><h2>Decompõe em</h2><ul>${decomp.map(r => `<li>${qtd(r.da)}</li>`).join('')}</ul></div>` : ''}
      ${vemDe.length ? `<div class="painel"><h2>Sai da decomposição de</h2><ul>${vemDe.map(r => `<li><a href="#/item/${r.de}">${esc(itemNome(r.de))}</a></li>`).join('')}</ul></div>` : ''}
      ${lojas.length ? `<div class="painel"><h2>Vendido em</h2><ul>${lojas.map(([l, v]) => `<li>${esc(lojaNome(l))}: ${fmt(v[1] > 0 ? v[1] : it.compra)}${v[2] ? ' <small>compra única</small>' : ''}${v[3] ? ` <small>após ${esc(v[3])}</small>` : ''}</li>`).join('')}</ul></div>` : ''}`;
  };

  rotas.itens = function (aba) {
    aba = aba || S.vista.itensAba || 'itens';
    S.vista.itensAba = aba; salvar();
    const abas = { itens: 'Itens', criacao: 'Criação', decomp: 'Decomposição', discos: 'Discos por elemento', lojas: 'Lojas' };
    app.innerHTML = `<div class="abas">${Object.entries(abas).map(([k, v]) => `<button class="${k === aba ? 'ativo' : ''}" data-aba="${k}">${v}</button>`).join('')}</div><div id="corpo"></div>`;
    app.querySelectorAll('[data-aba]').forEach(b => b.addEventListener('click', () => (location.hash = '#/itens/' + b.dataset.aba)));
    const corpo = app.querySelector('#corpo');
    const f = S.vista.itf || (S.vista.itf = { q: '', cat: '' });
    if (aba === 'itens') {
      corpo.innerHTML = `<div class="filtros"><input type="search" id="q" placeholder="Buscar item…" value="${esc(f.q)}">
        <select id="cat"><option value="">Todas as categorias</option>${Object.entries(D.categorias).map(([k, v]) => `<option value="${k}" ${f.cat === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select><span class="conta" id="conta"></span></div>
        <div class="painel tabela-rolagem"><table><thead><tr><th>Item</th><th>Categoria</th><th class="num">Compra</th><th class="num">Venda</th><th>Descrição</th></tr></thead><tbody id="tb"></tbody></table></div>`;
      const desenhar = () => {
        const q = semAcento(f.q.trim());
        const l = Object.entries(D.itens).filter(([id, it]) => (!q || semAcento(it.nome).includes(q)) && (f.cat === '' || it.cat === +f.cat));
        corpo.querySelector('#conta').textContent = l.length + ' itens';
        corpo.querySelector('#tb').innerHTML = l.slice(0, 600).map(([id, it]) => `<tr><td><a href="#/item/${id}">${esc(it.nome)}</a>${it.dlc ? ' <span class="tag dlc">DLC</span>' : ''}</td><td>${esc(D.categorias[it.cat] || '')}</td>
          <td class="num">${it.compra ? fmt(it.compra) : ''}</td><td class="num">${it.venda ? fmt(it.venda) : ''}</td><td class="desc">${esc((it.desc || (it.efeito || []).join(' ')).slice(0, 140))}</td></tr>`).join('');
      };
      corpo.querySelector('#q').addEventListener('input', e => { f.q = e.target.value; desenhar(); });
      corpo.querySelector('#cat').addEventListener('change', e => { f.cat = e.target.value; salvar(); desenhar(); });
      desenhar();
    } else if (aba === 'criacao') {
      corpo.innerHTML = `<div class="filtros"><input type="search" id="q" placeholder="Resultado ou material…"><span class="conta" id="conta"></span></div>
        <div class="painel tabela-rolagem"><table><thead><tr><th>Resultado</th><th>Materiais</th><th class="num">Custo</th></tr></thead><tbody id="tb"></tbody></table></div>`;
      const desenhar = q => {
        q = semAcento(q || '');
        const l = D.receitas.filter(r => !q || semAcento(itemNome(r.res)).includes(q) || r.mat.some(m => semAcento(itemNome(m[0])).includes(q)));
        corpo.querySelector('#conta').textContent = l.length + ' receitas';
        corpo.querySelector('#tb').innerHTML = l.map(r => `<tr><td><a href="#/item/${r.res}">${esc(itemNome(r.res))}</a> <small>${esc(D.categorias[(D.itens[r.res] || {}).cat] || '')}</small></td><td>${qtd(r.mat) || '<small>nenhum</small>'}</td><td class="num">${fmt(r.custo)}</td></tr>`).join('');
      };
      corpo.querySelector('#q').addEventListener('input', e => desenhar(e.target.value));
      desenhar('');
    } else if (aba === 'decomp') {
      corpo.innerHTML = `<div class="painel tabela-rolagem"><table><thead><tr><th>Item</th><th>Decompõe em</th></tr></thead><tbody>${D.decomposicao.map(r => `<tr><td><a href="#/item/${r.de}">${esc(itemNome(r.de))}</a></td><td>${qtd(r.da)}</td></tr>`).join('')}</tbody></table></div>`;
    } else if (aba === 'discos') {
      const discos = Object.entries(D.itens).filter(([, it]) => it.cat === 3 && it.golpe);
      const grupos = new Map();
      for (const [id, it] of discos) { const g = D.golpes[it.golpe] || {}; const k = g.el == null ? -1 : g.el; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push([id, it, g]); }
      corpo.innerHTML = `<p class="suave">Habilidades de Acessório (Discos de Habilidade), agrupadas pelo elemento do golpe.</p>` +
        [...grupos.keys()].sort((a, b) => (a < 0) - (b < 0) || a - b).map(k => `<div class="painel"><h2>${k >= 0 ? icElem(k) + ' ' + esc(elemNome(k)) : 'Suporte (sem elemento)'}</h2>
          ${tabelaGolpes(grupos.get(k).map(([id, it]) => ['', it.golpe]))}</div>`).join('');
    } else if (aba === 'lojas') {
      corpo.innerHTML = `<p class="suave">O jogo não liga a loja ao mapa numa tabela. O local vem do NPC lojista nos mapas (quando é um Digimon) e pode listar mais de uma cidade. Lojas de lojista humano aparecem só pelo número.</p>` +
        D.lojas.map(l => `<details class="painel"><summary><b>${esc(lojaNome(l))}</b> · ${l.itens.length} itens</summary>
          <table><tbody>${l.itens.map(v => `<tr><td><a href="#/item/${v[0]}">${esc(itemNome(v[0]))}</a>${v[2] ? ' <small>compra única</small>' : ''}</td><td class="num">${fmt(v[1] > 0 ? v[1] : (D.itens[v[0]] || {}).compra)}</td><td><small>${v[3] ? 'após ' + esc(v[3]) : ''}</small></td></tr>`).join('')}</tbody></table></details>`).join('');
    }
  };

  // ------------------------------------------------------------------ coleção e metas
  rotas.colecao = function () {
    const tot = D.digimon.length;
    const vis = D.digimon.filter(d => status(d.id) >= 1).length, obt = D.digimon.filter(d => status(d.id) === 2).length;
    const porEst = new Map();
    D.digimon.forEach(d => { const k = d.estagio; if (!porEst.has(k)) porEst.set(k, [0, 0]); porEst.get(k)[0]++; if (status(d.id) === 2) porEst.get(k)[1]++; });
    app.innerHTML = `
      <div class="painel"><h2>Coleção</h2>
        <p><b>${obt}</b> obtidos e <b>${vis}</b> vistos de <b>${tot}</b> no Guia de Campo. Marcações feitas à mão, guardadas só neste navegador.</p>
        <div class="chips">${[...porEst].sort((a, b) => a[0] - b[0]).map(([k, [n, o]]) => `<span class="tag">${esc(estagio(k))}${k >= 8 && k <= 13 ? ' ' + k : ''}: ${o}/${n}</span>`).join('')}</div>
        <div class="linha" style="margin-top:10px">
          <button id="exp">Exportar backup</button> <label class="tag" style="cursor:pointer">Importar backup <input type="file" id="imp" accept=".json" hidden></label>
          <button id="zerar">Zerar coleção</button>
        </div>
      </div>
      <div class="painel"><h2>Metas de evolução (${S.metas.length})</h2>
        <div class="linha" style="margin-bottom:8px">${seletorPersonalidade()}</div>
        ${S.metas.length ? '<div class="evos">' + S.metas.map((m, i) => `<div class="evo"><div class="topo-evo">${ret(m.de, 'p')} → ${ret(m.para, 'p')}<div>${link(m.de)} → ${link(m.para)}</div></div>
          ${htmlCond(m.para, m.de)}<div class="acoes"><a href="#/caminho/${m.de}/${m.para}">Caminho</a><button data-rmm="${i}">Remover</button></div></div>`).join('') + '</div>'
          : '<p class="vazio">Nenhuma meta. Na ficha de um Digimon, use “Marcar como meta” numa evolução.</p>'}
      </div>
      <div class="painel"><h2>Marcar rápido</h2>
        <div class="filtros"><input type="search" id="q" placeholder="Filtrar por nome…"><select id="est"><option value="">Todos os estágios</option>${[...porEst.keys()].sort((a, b) => a - b).map(k => `<option value="${k}">${esc(estagio(k))}${k >= 8 && k <= 13 ? ' ' + k : ''}</option>`).join('')}</select></div>
        <div class="tabela-rolagem"><table><tbody id="tb"></tbody></table></div>
      </div>`;
    const desenhar = () => {
      const q = semAcento(app.querySelector('#q').value.trim()), e = app.querySelector('#est').value;
      app.querySelector('#tb').innerHTML = D.digimon.filter(d => (!q || (!oculto(d.id) && semAcento(d.nome).includes(q))) && (!e || d.estagio === +e))
        .map(d => `<tr><td class="num">${d.dex}</td><td>${ret(d.id, 'p')}</td><td>${link(d.id)}</td><td><small>${esc(estagio(d.estagio))}</small></td><td>${botoesColecao(d.id)}</td></tr>`).join('');
      ligarColecao(app.querySelector('#tb'), desenhar);
    };
    app.querySelector('#q').addEventListener('input', desenhar);
    app.querySelector('#est').addEventListener('change', desenhar);
    desenhar();
    ligarPersonalidade(app);
    app.querySelectorAll('[data-rmm]').forEach(b => b.addEventListener('click', () => { S.metas.splice(+b.dataset.rmm, 1); salvar(); rotas.colecao(); }));
    app.querySelector('#exp').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ col: S.col, metas: S.metas, pers: S.pers, red: S.red, cmp: S.cmp }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'compendio-colecao.json'; a.click(); URL.revokeObjectURL(a.href);
    });
    app.querySelector('#imp').addEventListener('change', ev => {
      const f = ev.target.files[0]; if (!f) return;
      f.text().then(t => { const o = normalizar(JSON.parse(t)); for (const k of ['col', 'metas', 'pers', 'red', 'cmp']) if (o[k] != null) S[k] = o[k]; salvar(); aviso('Backup importado.'); rotas.colecao(); })
        .catch(() => aviso('Arquivo inválido.'));
    });
    app.querySelector('#zerar').addEventListener('click', () => { if (confirm('Apagar todas as marcações de coleção?')) { S.col = {}; salvar(); rotas.colecao(); } });
  };

  // ------------------------------------------------------------------ ajustes
  rotas.ajustes = function () {
    app.innerHTML = `
      <div class="painel"><h2>Redução de requisitos por personalidade</h2>
        <p>No jogo, as habilidades de agente “Digievolução de &lt;categoria&gt;” reduzem os atributos exigidos numa evolução quando a personalidade atual do seu Digimon é igual à <b>personalidade base</b> do Digimon alvo. Patente, Talento e Elo não mudam.</p>
        <p>${seletorPersonalidade()}</p>
        <table><thead><tr><th>Habilidade</th><th>Categoria</th><th>Personalidades</th><th class="num">Redução</th><th>Cópias compradas</th></tr></thead><tbody>
        ${D.reducao.map(r => `<tr><td>${esc(r.nome)}</td><td>${esc(D.persCatNomes[r.cat])}</td>
          <td><small>${Object.entries(D.persCat).filter(([p, c]) => c === r.cat).map(([p]) => esc(persNome(+p))).join(', ')}</small></td>
          <td class="num">${r.pct}% cada</td><td><select data-cat="${r.cat}">${Array.from({ length: r.copias + 1 }, (_, i) => `<option value="${i}" ${+(S.red[r.cat] || 0) === i ? 'selected' : ''}>${i}</option>`).join('')}</select></td></tr>`).join('')}
        </tbody></table>
        <p class="aviso">O tabuleiro de habilidades tem ${D.reducao[0] ? D.reducao[0].copias : 4} cópias de cada uma (mesmo nome, ${D.reducao[0] ? D.reducao[0].pct : 20}% cada). Se elas somam não está provado pelos dados: com 1 cópia marcada o cálculo é seguro; acima disso o app soma.</p>
      </div>
      <div class="painel"><h2>Dados</h2>
        <p>Gerados em ${esc(D.versao.gerado)} a partir de: <small>${esc(D.versao.pacotes.join(', '))}</small></p>
        <p>${D.digimon.length} Digimon, ${Object.keys(D.golpes).length} golpes, ${Object.keys(D.itens).length} itens, ${D.receitas.length} receitas.</p>
        <p><small>Depois de atualização ou DLC nova, rode de novo <code>python -I extrair\\extrair.py --limpar</code>.</small></p>
      </div>`;
    ligarPersonalidade(app);
    app.querySelectorAll('[data-cat]').forEach(s => s.addEventListener('change', () => { S.red[s.dataset.cat] = +s.value; salvar(); }));
  };

  ir();
})();
