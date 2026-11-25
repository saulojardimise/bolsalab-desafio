// Editor da carteira recomendada (parte 4).
// O líder monta a carteira do mês: 3 a 7 ativos, comprado ou vendido, percentuais que somam 100%,
// uma tese por ativo e o cenário econômico. Os outros integrantes só veem a carteira enviada.
// As regras também são conferidas no banco (desafio_enviar_carteira); aqui é para ajudar a montar.
// O rascunho fica guardado no banco (qualquer aparelho) e neste navegador até ser enviado.
/* global sb, rpc, estado, esc, tela, msgErro, desenhar, carregar, confirmarDuasVezes */

const CLASSES = { acao: 'Ação', etf: 'ETF', bdr: 'BDR', tesouro: 'Tesouro', minicontrato: 'Minicontrato' };
const MINIS = [
  { ticker: 'WIN', nome: 'Mini Ibovespa', tipo: 'minicontrato' },
  { ticker: 'WDO', nome: 'Mini dólar', tipo: 'minicontrato' },
];
const LIMITE = { ativos: [3, 7], peso: 40, vendido: 30, mini: 30, tese: [300, 800], cenario: [800, 3000] };

const cart = {
  pronto: false, ativos: [], janelas: [], janela: null, enviada: null,
  posicoes: [], cenario: '', sel: 'cenario', salvoEm: null,
};

const dataBR = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const pctTxt = (v) => `${(Math.round(v * 100) / 100).toLocaleString('pt-BR')}%`;
const classeDe = (ativo) => (cart.ativos.find((a) => a.ticker === ativo)?.tipo) ?? null;

function chaveRascunho() { return `desafio:rascunho:${estado.sessao?.user.id}:${cart.janela?.id}`; }
// o rascunho vai para o banco (vale em qualquer aparelho) e, por garantia, fica neste navegador também
let esperaSalvar = null;
function guardarRascunho() {
  try { localStorage.setItem(chaveRascunho(), JSON.stringify({ posicoes: cart.posicoes, cenario: cart.cenario, em: Date.now() })); } catch { /* segue */ }
  cart.situacaoRascunho = 'pendente'; pintarRascunho();
  clearTimeout(esperaSalvar);
  esperaSalvar = setTimeout(salvarNoServidor, 1500);
}
async function salvarNoServidor() {
  clearTimeout(esperaSalvar);
  if (!cart.janela) return;
  cart.situacaoRascunho = 'salvando'; pintarRascunho();
  try {
    const em = await rpc('desafio_salvar_rascunho', { p_janela: cart.janela.id, p_cenario: cart.cenario, p_posicoes: cart.posicoes });
    cart.salvoEm = Date.parse(em); cart.situacaoRascunho = 'salvo';
  } catch (e) { cart.situacaoRascunho = 'erro'; cart.erroRascunho = msgErro(e); }
  pintarRascunho();
}
function pintarRascunho() {
  const el = document.getElementById('rascunho-estado'); if (!el) return;
  const hora = cart.salvoEm ? new Date(cart.salvoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  el.textContent = { pendente: 'Alterações ainda não salvas…', salvando: 'Salvando rascunho…', erro: `Não salvou no servidor: ${cart.erroRascunho} (ficou guardado neste navegador)` }[cart.situacaoRascunho]
    ?? (cart.salvoEm ? `Rascunho salvo em ${hora}. Vale em qualquer aparelho.` : '');
  el.className = cart.situacaoRascunho === 'erro' ? 'faltam' : 'suave';
}
function lerRascunho() { try { return JSON.parse(localStorage.getItem(chaveRascunho()) || 'null'); } catch { return null; } }
function apagarRascunho() { try { localStorage.removeItem(chaveRascunho()); } catch { /* nada */ } }

// janela do mês: a aberta agora; senão a próxima; testador pode escolher qualquer uma
function janelaPadrao() {
  const agora = Date.now();
  return cart.janelas.find((j) => agora >= Date.parse(j.abre) && agora <= Date.parse(j.fecha))
    ?? cart.janelas.find((j) => Date.parse(j.fecha) >= agora) ?? cart.janelas[cart.janelas.length - 1];
}

async function abrirCarteira() {
  if (!cart.pronto) {
    const [a, j] = await Promise.all([
      sb.from('empresas').select('ticker, nome, tipo').eq('ativa', true).order('ticker').then((r) => r.data ?? []),
      sb.from('desafio_janelas').select('id, rotulo, abre, fecha, vale_de, vale_ate').order('abre').then((r) => r.data ?? []),
    ]);
    cart.ativos = [...a, ...MINIS];
    cart.janelas = j;
    cart.janela = janelaPadrao();
    cart.pronto = true;
  }
  await carregarJanela();
}

async function carregarJanela() {
  const lider = estado.equipe?.eu_lider;
  const [enviada, servidor] = await Promise.all([
    cart.janela ? rpc('desafio_minha_carteira', { p_janela: cart.janela.id }).catch(() => null) : null,
    cart.janela && lider ? rpc('desafio_meu_rascunho', { p_janela: cart.janela.id }).catch(() => null) : null,
  ]);
  cart.enviada = enviada;
  // o rascunho mais novo vence (o do banco ou o deste navegador); sem rascunho, parte da carteira enviada
  const local = lider ? lerRascunho() : null;
  const doServidor = servidor ? { ...servidor, em: Date.parse(servidor.atualizado_em) } : null;
  const r = [local, doServidor].filter(Boolean).sort((a, b) => b.em - a.em)[0] ?? null;
  const base = r ?? (enviada ? { posicoes: enviada.posicoes, cenario: enviada.cenario } : null);
  cart.posicoes = (base?.posicoes ?? []).map((p) => ({ ativo: p.ativo, lado: p.lado || 'comprado', peso: String(p.peso ?? '').replace('.', ','), tese: p.tese ?? '' }));
  cart.cenario = base?.cenario ?? '';
  cart.salvoEm = doServidor?.em ?? null;
  cart.situacaoRascunho = r && r === local && (!doServidor || local.em > doServidor.em) ? 'pendente' : null;
  if (cart.situacaoRascunho === 'pendente' && lider && estado.equipe.situacao === 'aprovada') setTimeout(salvarNoServidor, 500);
  cart.sel = cart.posicoes.length ? 0 : 'cenario';
}

// ---------------------------------------------------------------- regras (espelho do banco)
function conferir() {
  const p = cart.posicoes, itens = [];
  const pesos = p.map((x) => num(x.peso));
  const total = pesos.reduce((s, v) => s + v, 0);
  const vendido = p.reduce((s, x, i) => s + (x.lado === 'vendido' && classeDe(x.ativo) !== 'minicontrato' ? pesos[i] : 0), 0);
  const mini = p.reduce((s, x, i) => s + (classeDe(x.ativo) === 'minicontrato' ? pesos[i] : 0), 0);
  const ok = (cond, texto) => itens.push({ ok: !!cond, texto });
  ok(p.length >= LIMITE.ativos[0] && p.length <= LIMITE.ativos[1], `De 3 a 7 ativos (tem ${p.length})`);
  ok(Math.abs(total - 100) < 0.005, `Tudo junto soma 100% (soma ${pctTxt(total)})`);
  ok(pesos.every((v) => v > 0 && v <= LIMITE.peso), 'Cada ativo entre 0% e 40%');
  ok(vendido <= LIMITE.vendido, `Venda a descoberto até 30% (${pctTxt(vendido)})`);
  ok(mini <= LIMITE.mini, `Minicontratos até 30% (${pctTxt(mini)})`);
  ok(p.every((x) => !(x.lado === 'vendido' && classeDe(x.ativo) === 'tesouro')), 'Tesouro só comprado');
  const tesesOk = p.filter((x) => x.tese.trim().length >= LIMITE.tese[0] && x.tese.trim().length <= LIMITE.tese[1]).length;
  ok(p.length && tesesOk === p.length, `Teses de 300 a 800 caracteres (${tesesOk} de ${p.length} prontas)`);
  const c = cart.cenario.trim().length;
  ok(c >= LIMITE.cenario[0] && c <= LIMITE.cenario[1], `Cenário de 800 a 3.000 caracteres (tem ${c.toLocaleString('pt-BR')})`);
  return { itens, total, vendido, mini, pronta: itens.every((i) => i.ok) };
}

// ---------------------------------------------------------------- desenho
function htmlCarteira() {
  const e = estado.equipe, s = estado.situacao, lider = e.eu_lider;
  const j = cart.janela;
  if (!j) return '<section class="cartao"><p class="suave">O calendário das carteiras ainda não foi cadastrado.</p></section>';
  const agora = Date.now(), aberta = agora >= Date.parse(j.abre) && agora <= Date.parse(j.fecha);
  const podeEnviar = lider && (s.testador || (aberta && e.situacao === 'aprovada'));
  const seletor = s.testador
    ? `<select id="janela" aria-label="Mês da carteira">${cart.janelas.map((x) => `<option value="${x.id}" ${x.id === j.id ? 'selected' : ''}>${esc(x.rotulo)}</option>`).join('')}</select>`
    : `<strong>${esc(j.rotulo)}</strong>`;
  const prazo = `Envio de ${dataBR(j.abre)} a ${dataBR(j.fecha)} · vale de ${dataBR(j.vale_de + 'T12:00:00Z')} a ${dataBR(j.vale_ate + 'T12:00:00Z')}`;

  if (e.situacao !== 'aprovada' && !cart.enviada) {
    return `<section class="cartao" style="grid-column:1/-1"><h2>A carteira abre quando a equipe for aprovada</h2>
      <p>Depois que a organização aprovar a inscrição, o líder pode montar a carteira com calma e deixar salva. O envio só vale no prazo de cada mês.</p></section>`;
  }
  if (!lider) {
    const c = cart.enviada;
    return `<section class="cartao carteira-cabeca" style="grid-column:1/-1">${seletor}<p class="suave">${prazo}</p></section>
      ${c ? `<section class="cartao rolavel" style="grid-column:span 2"><h2>Carteira enviada · ${new Date(c.enviada_em).toLocaleDateString('pt-BR')}</h2>${htmlTabelaLeitura(c.posicoes)}</section>
        <section class="cartao rolavel"><h2>Cenário econômico</h2><p class="texto-longo">${esc(c.cenario)}</p></section>`
      : '<section class="cartao" style="grid-column:1/-1"><p>O líder ainda não enviou a carteira deste mês. Só o líder monta e envia; aqui você acompanha.</p></section>'}`;
  }

  const r = conferir();
  const sel = cart.sel;
  const p = typeof sel === 'number' ? cart.posicoes[sel] : null;
  return `
  <section class="cartao carteira-lista">
    <div class="carteira-cabeca">${seletor}<p class="suave">${prazo}</p></div>
    <ul class="posicoes" role="list">${cart.posicoes.map((x, i) => {
      const t = x.tese.trim().length, tok = t >= LIMITE.tese[0] && t <= LIMITE.tese[1];
      return `<li class="${sel === i ? 'ativa' : ''}">
        <button class="posicao-abrir" data-sel="${i}" aria-label="Editar ${esc(x.ativo)}">
          <strong>${esc(x.ativo)}</strong><span class="suave">${CLASSES[classeDe(x.ativo)] ?? ''}${x.lado === 'vendido' ? ' · vendido' : ''}</span>
          <span class="tese-estado ${tok ? 'certo' : ''}">${tok ? 'tese ✓' : `tese ${t}/300`}</span></button>
        <input class="peso" data-peso="${i}" inputmode="decimal" value="${esc(x.peso)}" aria-label="Percentual de ${esc(x.ativo)}"><span class="pct">%</span>
      </li>`; }).join('')}</ul>
    ${cart.posicoes.length < LIMITE.ativos[1] ? `<div class="busca-ativo">
      <label for="novo-ativo" class="sr">Adicionar ativo</label>
      <input id="novo-ativo" type="search" placeholder="+ Adicionar ativo: código ou nome (ex.: VALE3, Petrobras)" autocomplete="off" autocapitalize="characters" spellcheck="false">
      <ul id="sugestoes-ativo" class="sugestoes-ativo" role="listbox" hidden></ul>
      <p id="erro-ativo" class="erro-ativo" role="alert" hidden></p>
    </div>` : '<p class="suave">Já são 7 ativos, o máximo.</p>'}
    <button class="posicao-abrir cenario-abrir ${sel === 'cenario' ? 'ativa' : ''}" data-sel="cenario">
      <strong>Cenário econômico e impacto na carteira</strong>
      <span class="tese-estado ${cart.cenario.trim().length >= 800 && cart.cenario.trim().length <= 3000 ? 'certo' : ''}">${cart.cenario.trim().length.toLocaleString('pt-BR')}/800</span></button>
  </section>

  <section class="cartao carteira-texto">
    ${p ? `<div class="equipe-topo"><div><h2>${esc(p.ativo)}</h2><p class="suave">${esc(cart.ativos.find((a) => a.ticker === p.ativo)?.nome ?? '')}</p></div>
        <button class="botao-link botao-perigo" id="tirar-ativo">Tirar da carteira</button></div>
      <div class="lados" role="radiogroup" aria-label="Lado">
        <button role="radio" aria-checked="${p.lado === 'comprado'}" data-lado="comprado">Comprado</button>
        <button role="radio" aria-checked="${p.lado === 'vendido'}" data-lado="vendido" ${classeDe(p.ativo) === 'tesouro' ? 'disabled title="Tesouro só comprado"' : ''}>Vendido</button>
      </div>
      <label>Tese de investimento <textarea id="texto" rows="9" maxlength="800" placeholder="Por que este ativo? Fundamentos, valuation, riscos e o que pode fazer o preço andar.">${esc(p.tese)}</textarea></label>
      <p class="contador" id="contador"></p>`
    : `<h2>Cenário econômico e impacto na carteira</h2>
      <p class="suave">Macro, setorial, micro e internacional: o que está acontecendo e como isso afeta os ativos escolhidos.</p>
      <label class="sr" for="texto">Cenário</label>
      <textarea id="texto" rows="12" maxlength="3000" placeholder="Juros, inflação, câmbio, atividade, setores, cenário externo… e como cada fator mexe com a carteira.">${esc(cart.cenario)}</textarea>
      <p class="contador" id="contador"></p>`}
  </section>

  <section class="cartao carteira-resumo">
    <h2>Conferência</h2>
    <div class="barra-total" aria-hidden="true"><span id="barra" style="width:${Math.min(r.total, 100)}%"></span></div>
    <ul class="checagem" id="checagem">${htmlChecagem(r)}</ul>
    ${cart.enviada ? `<p class="ok">Enviada em ${new Date(cart.enviada.enviada_em).toLocaleString('pt-BR')}.${aberta || s.testador ? ' Dá para reenviar até o fim do prazo.' : ''}</p>` : ''}
    <button class="botao botao-principal" id="enviar-carteira" ${podeEnviar && r.pronta ? '' : 'disabled'}>${cart.enviada ? 'Reenviar carteira' : 'Enviar carteira'}</button>
    <p class="suave" id="aviso-envio">${!podeEnviar ? (e.situacao !== 'aprovada' ? 'A equipe precisa ser aprovada para enviar.' : agora > Date.parse(j.fecha) ? 'O prazo de envio deste mês terminou.' : `O envio abre em ${dataBR(j.abre)}. Até lá, vá montando: o rascunho fica salvo.`) : r.pronta ? 'Tudo certo para enviar.' : 'Complete os itens acima para enviar.'}</p>
    <button class="botao" id="salvar-rascunho" type="button">Salvar rascunho</button>
    <p id="rascunho-estado" class="suave"></p>
  </section>`;
}

function htmlChecagem(r) {
  return r.itens.map((i) => `<li class="${i.ok ? 'certo' : ''}">${i.ok ? '✓' : '○'} ${esc(i.texto)}</li>`).join('');
}

function htmlTabelaLeitura(posicoes) {
  return `<ul class="leitura">${(posicoes ?? []).map((p) => `<li>
    <div class="leitura-topo"><strong>${esc(p.ativo)}</strong><span class="suave">${CLASSES[p.classe] ?? ''}${p.lado === 'vendido' ? ' · vendido' : ''}</span><b>${pctTxt(Number(p.peso))}</b></div>
    <p class="texto-longo">${esc(p.tese)}</p></li>`).join('')}</ul>`;
}

// ---------------------------------------------------------------- comportamento
function atualizarResumo() {
  const r = conferir();
  const barra = document.getElementById('barra'); if (barra) { barra.style.width = `${Math.min(r.total, 100)}%`; barra.classList.toggle('passou', r.total > 100.005); }
  const ch = document.getElementById('checagem'); if (ch) ch.innerHTML = htmlChecagem(r);
  const b = document.getElementById('enviar-carteira');
  const s = estado.situacao, e = estado.equipe, j = cart.janela;
  const aberta = Date.now() >= Date.parse(j.abre) && Date.now() <= Date.parse(j.fecha);
  const podeEnviar = e.eu_lider && (s.testador || (aberta && e.situacao === 'aprovada'));
  if (b) b.disabled = !(podeEnviar && r.pronta);
  const aviso = document.getElementById('aviso-envio');
  if (aviso && podeEnviar) aviso.textContent = r.pronta ? 'Tudo certo para enviar.' : 'Complete os itens acima para enviar.';
  const t = document.getElementById('texto'), c = document.getElementById('contador');
  if (t && c) {
    const [min, max] = typeof cart.sel === 'number' ? LIMITE.tese : LIMITE.cenario;
    const n = t.value.trim().length;
    c.textContent = `${n.toLocaleString('pt-BR')} de ${min.toLocaleString('pt-BR')} a ${max.toLocaleString('pt-BR')} caracteres${n < min ? ` · faltam ${(min - n).toLocaleString('pt-BR')}` : ' ✓'}`;
    c.classList.toggle('certo', n >= min && n <= max);
  }
}

function ligarCarteira() {
  document.getElementById('janela')?.addEventListener('change', async (ev) => {
    cart.janela = cart.janelas.find((x) => x.id === ev.target.value);
    await carregarJanela(); desenhar();
  });
  if (!estado.equipe.eu_lider) return;
  tela.querySelectorAll('[data-sel]').forEach((b) => b.addEventListener('click', () => {
    cart.sel = b.dataset.sel === 'cenario' ? 'cenario' : Number(b.dataset.sel); desenhar();
  }));
  tela.querySelectorAll('[data-peso]').forEach((inp) => inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/[^\d,.]/g, '');
    cart.posicoes[Number(inp.dataset.peso)].peso = inp.value; guardarRascunho(); atualizarResumo();
  }));
  const texto = document.getElementById('texto');
  texto?.addEventListener('input', () => {
    if (typeof cart.sel === 'number') cart.posicoes[cart.sel].tese = texto.value; else cart.cenario = texto.value;
    guardarRascunho(); atualizarResumo();
    const marca = tela.querySelector(`[data-sel="${cart.sel}"] .tese-estado`);
    if (marca) {
      const n = texto.value.trim().length, [min, max] = typeof cart.sel === 'number' ? LIMITE.tese : LIMITE.cenario;
      marca.textContent = n >= min && n <= max ? (typeof cart.sel === 'number' ? 'tese ✓' : `${n.toLocaleString('pt-BR')} ✓`) : (typeof cart.sel === 'number' ? `tese ${n}/300` : `${n.toLocaleString('pt-BR')}/800`);
      marca.classList.toggle('certo', n >= min && n <= max);
    }
  });
  tela.querySelectorAll('[data-lado]').forEach((b) => b.addEventListener('click', () => {
    cart.posicoes[cart.sel].lado = b.dataset.lado; guardarRascunho(); desenhar();
  }));
  const tirar = document.getElementById('tirar-ativo');
  tirar?.addEventListener('click', () => confirmarDuasVezes(tirar, 'Tirar mesmo?', () => {
    cart.posicoes.splice(cart.sel, 1); cart.sel = cart.posicoes.length ? 0 : 'cenario'; guardarRascunho(); desenhar();
  }));
  // busca do ativo: lista própria (o datalist não funciona bem no celular) e o erro aparece logo abaixo do campo
  const novo = document.getElementById('novo-ativo');
  const lista = document.getElementById('sugestoes-ativo'), erroAtivo = document.getElementById('erro-ativo');
  const normal = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const achar = (texto) => {
    const t = normal(texto).trim();
    if (!t) return [];
    const livres = cart.ativos.filter((a) => !cart.posicoes.some((x) => x.ativo === a.ticker));
    return livres.filter((a) => a.ticker.startsWith(t) || normal(a.nome).includes(t))
      .sort((a, b) => (b.ticker === t) - (a.ticker === t) || (b.ticker.startsWith(t)) - (a.ticker.startsWith(t)) || a.ticker.localeCompare(b.ticker))
      .slice(0, 6);
  };
  const mostrarErro = (msg) => { erroAtivo.textContent = msg; erroAtivo.hidden = !msg; };
  const adicionar = (ticker) => {
    if (cart.posicoes.some((x) => x.ativo === ticker)) return mostrarErro(`${ticker} já está na carteira.`);
    cart.posicoes.push({ ativo: ticker, lado: 'comprado', peso: '', tese: '' });
    cart.sel = cart.posicoes.length - 1; guardarRascunho(); desenhar();
    tela.querySelector(`[data-peso="${cart.sel}"]`)?.focus();
  };
  novo?.addEventListener('input', () => {
    mostrarErro('');
    const achados = achar(novo.value);
    lista.innerHTML = achados.map((a) => `<li><button type="button" data-ticker="${esc(a.ticker)}">
      <strong>${esc(a.ticker)}</strong><span>${esc(a.nome)}</span><em>${CLASSES[a.tipo] ?? ''}</em></button></li>`).join('');
    lista.hidden = !achados.length;
    if (!achados.length && novo.value.trim().length >= 3) mostrarErro(`Nenhum ativo do BolsaLab com "${novo.value.trim()}". Confira o código (ex.: VALE3, não VALE5).`);
    lista.querySelectorAll('[data-ticker]').forEach((b) => b.addEventListener('click', () => adicionar(b.dataset.ticker)));
  });
  novo?.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const t = normal(novo.value).trim(), achados = achar(novo.value);
    const exato = cart.ativos.find((a) => a.ticker === t);
    if (exato) return adicionar(exato.ticker);
    if (achados.length === 1) return adicionar(achados[0].ticker);
    mostrarErro(achados.length ? 'Toque no ativo certo na lista.' : `${t || 'Esse código'} não está disponível no BolsaLab.`);
  });
  document.getElementById('salvar-rascunho')?.addEventListener('click', salvarNoServidor);
  pintarRascunho();
  document.getElementById('enviar-carteira')?.addEventListener('click', async (ev) => {
    ev.target.disabled = true;
    try {
      await rpc('desafio_enviar_carteira', {
        p_cenario: cart.cenario,
        p_posicoes: cart.posicoes.map((x) => ({ ativo: x.ativo, lado: x.lado, peso: num(x.peso), tese: x.tese })),
        p_janela: estado.situacao.testador ? cart.janela.id : null,
      });
      apagarRascunho(); clearTimeout(esperaSalvar);
      estado.recado = `${cart.janela.rotulo} enviada!`; estado.recadoOk = true;
      await carregarJanela();
    } catch (e) { estado.recado = msgErro(e); }
    desenhar();
  });
  atualizarResumo();
}
