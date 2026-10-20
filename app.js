/* 계정 · 메뉴 · 컬렉션 · 출격 설정 · 뽑기 · AI 대전 (데이터는 이 브라우저의 localStorage에 저장) */
const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
// 관리자(모든 카드 + BP/뽑기권 무제한). 비밀번호 원문은 코드에 없고 해시만 저장. 아이디는 소문자로 비교(Yoojin_choi 입력해도 됨)
const ADMIN = { id: 'yoojin_choi', pwHash: 'a7de886c461085419c23bfc25d6f9949947b6006f24108c11e6dca584844644a' };
const PULL_BP = 1000, NAME_MAX = 8;
const DIFFS = [
  { name: '김울급', info: '진짜 겁나 쉬움', bot: 60, bp: 50, p: { dmg: 1, gap: 2200, gain: 8, sdmg: 5, windup: 1800, shield: 0 } },
  { name: '쉬움', info: '입문용', bot: 150, bp: 100, p: { dmg: 2, gap: 1200, gain: 18, sdmg: 15, windup: 1400, shield: 0 } },
  { name: '보통', info: '봇도 방어막 사용', bot: 250, bp: 200, p: { dmg: 3, gap: 900, gain: 25, sdmg: 25, windup: 1100, shield: .35 } },
  { name: '어려움', info: '빠르고 방어도 잘함', bot: 400, bp: 400, p: { dmg: 4, gap: 800, gain: 25, sdmg: 30, windup: 900, shield: .6 } },
  { name: '헬모드', info: '각오하세요', bot: 700, bp: 1000, p: { dmg: 5, gap: 650, gain: 30, sdmg: 35, windup: 750, shield: .85 } },
];
let U = null, up = false, pulling = false;

const users = () => LS.get('kc_users') || {};
const persist = () => { const all = users(); all[U.id] = U; LS.set('kc_users', all); };
const fmt = n => n.toLocaleString('en-US');
const wal = () => U.admin ? 'BP ∞ · 뽑기권 ∞' : `BP ${fmt(U.bp)} · 뽑기권 ${U.tickets}`;
const toast = m => { const t = $('toast'); t.textContent = m; restart(t, 'on'); };
const len = v => Array.from(v).length;
const clip = v => Array.from(v).slice(0, NAME_MAX).join('');

async function hash(id, pw) {
  const data = new TextEncoder().encode(`${id}:${pw}:kimul-card`);
  if (window.crypto?.subtle) return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(x => x.toString(16).padStart(2, '0')).join('');
  return btoa(unescape(encodeURIComponent(`${id}:${pw}`)));
}
async function ensureAdmin() {
  const all = users(); delete all.admin; // 예전 admin 계정 제거
  const a = all[ADMIN.id] || { id: ADMIN.id, name: '관리자', bp: 0, tickets: 0, inv: [], deck: [], seq: 1 };
  Object.assign(a, { pw: ADMIN.pwHash, admin: true, tut: true });
  for (const t in CARDS) while (a.inv.filter(c => c.type === t).length < 5) a.inv.push({ id: a.seq++, type: t });
  all[a.id] = a; LS.set('kc_users', all);
}

/* ── 로그인 / 회원가입 / 이름 ── */
const mode = v => {
  up = v;
  $('t-in').classList.toggle('on', !v); $('t-up').classList.toggle('on', v);
  $('upw2').hidden = !v; $('abtn').textContent = v ? '회원가입' : '로그인'; $('aerr').textContent = '';
};
$('t-in').onclick = () => mode(false);
$('t-up').onclick = () => mode(true);

$('auth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('uid').value.trim().toLowerCase(), pw = $('upw').value, all = users(), err = m => { $('aerr').textContent = m; };
  if (!/^[a-z0-9_]{4,12}$/.test(id)) return err('아이디는 영문·숫자·_ 4~12자로 입력하세요.');
  if (pw.length < 4) return err('비밀번호는 4자 이상 입력하세요.');
  const h = await hash(id, pw);
  if (up) {
    if (pw !== $('upw2').value) return err('비밀번호 확인이 일치하지 않아요.');
    if (all[id]) return err('이미 사용 중인 아이디예요.');
    U = { id, pw: h, name: '', tut: false, bp: 0, tickets: 0, inv: [], deck: [], seq: 1 };
    persist();
  } else {
    if (!all[id] || all[id].pw !== h) return err('아이디 또는 비밀번호가 올바르지 않아요.');
    U = all[id];
  }
  err(''); $('upw').value = $('upw2').value = '';
  enter();
});

function enter() {
  LS.set('kc_session', U.id);
  if (!U.name) { $('name').value = ''; $('cnt').textContent = 0; show('s-name'); }
  else if (!U.tut) tutorial(0);
  else menu();
}

const input = $('name');
const sync = () => { if (len(input.value) > NAME_MAX) input.value = clip(input.value); $('cnt').textContent = len(input.value); };
input.addEventListener('input', e => e.isComposing ? $('cnt').textContent = Math.min(NAME_MAX, len(input.value)) : sync());
input.addEventListener('compositionend', sync);
$('name-form').addEventListener('submit', e => {
  e.preventDefault();
  const v = clip(input.value.trim());
  if (!v) { restart(input, 'err'); input.focus(); return; }
  U.name = v; persist(); input.blur();
  tutorial(0);
});

function tutorialDone() {
  U.tut = true; U.tickets += 10; U.bp += 10000;
  for (let k = 0; k < 3; k++) U.inv.push({ id: U.seq++, type: 'kimul' });
  persist();
  panel('튜토리얼 클리어를 축하합니다', '획득 보상\n10회 뽑기권 , 평범한 김울 카드 3장 , 10,000 BP', '메뉴화면으로', menu);
}

/* ── 메뉴 ── */
function menu() {
  $('m-name').textContent = U.name; $('m-wal').textContent = wal();
  show('s-menu');
}
$('m-ai').onclick = diffs;
$('m-multi').onclick = () => panel('멀티 게임', '방 만들기 · 방 비밀번호 · 방장 기능은 준비 중이에요.\n곧 만나요!', '확인');
$('m-deck').onclick = deck;
$('m-coll').onclick = coll;
$('m-gacha').onclick = gacha;
$('m-out').onclick = () => { U = null; LS.set('kc_session', null); show('s-auth'); };
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) ({ menu, coll, deck, gacha })[b.dataset.go](); });

/* ── AI 대전 ── */
function diffs() {
  $('diff-list').innerHTML = DIFFS.map((d, i) => `<button class="mbtn big d" data-i="${i}"><b>${d.name}</b><small>${d.info} · 체력 ${d.bot} · 승리 +${d.bp} BP</small></button>`).join('');
  show('s-diff');
}
$('diff-list').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) startAI(DIFFS[+b.dataset.i]); });

function startAI(d) {
  let types = U.deck.map(id => U.inv.find(c => c.id === id)).filter(Boolean).map(c => c.type);
  if (!types.length) types = U.inv.slice(0, 5).map(c => c.type);
  if (!types.length) return panel('카드가 없어요', '뽑기에서 카드를 먼저 뽑아주세요.', '확인');
  battle({ who: U.name, tag: d.name, botName: `${d.name} 봇`, bot: d.bot, p: d.p, atk: true, skill: true, shield: true, quit: true, deck: types,
    hint: () => '전투 시작! 평타로 게이지를 모아 스킬을 쓰세요.',
    win: () => { if (!U.admin) U.bp += d.bp; persist(); panel('승리!', `${d.name} 봇을 쓰러뜨렸어요!\n+${d.bp} BP`, '메뉴로', menu, '다시 하기', () => startAI(d)); },
    lose: () => panel('패배', '카드가 모두 쓰러졌어요.', '다시 도전', () => startAI(d), '메뉴로', menu) });
}

/* ── 컬렉션 / 출격 카드 ── */
const cardEl = (c, extra = '', n = '') => `<button class="cc${extra}" data-id="${c.id}"><img src="${CARDS[c.type].img}" alt="${CARDS[c.type].name}">${n}</button>`;
const EMPTY = '<p class="empty">아직 카드가 없어요.<br>뽑기에서 카드를 뽑아보세요!</p>';

function coll() {
  $('coll-cnt').textContent = `${U.inv.length}장`;
  $('coll-grid').innerHTML = U.inv.map(c => cardEl(c)).join('') || EMPTY;
  show('s-coll');
}
$('coll-grid').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) detail(U.inv.find(c => c.id == b.dataset.id)); });

function detail(c) {
  const d = CARDS[c.type];
  panel(d.name, `체력 ${d.hp}\n${d.basic.name}: 데미지 ${d.basic.dmg} (게이지 +${d.basic.gain})\n${d.skill.name}: 데미지 ${d.skill.dmg} (게이지 ${d.skill.cost} 필요)`,
    '닫기', null, '카드 폐기', () => discard(c), d.img);
}
function discard(c) {
  panel('카드 폐기', '정말 카드를 폐기하시겠습니까?\n(한번 폐기하면 되돌릴 수 없습니다)', '취소', () => detail(c), '폐기하기', () => {
    U.inv = U.inv.filter(x => x.id !== c.id); U.deck = U.deck.filter(id => id !== c.id);
    persist(); coll(); toast('카드를 폐기했어요.');
  });
}

function deck() {
  $('deck-cnt').textContent = `${U.deck.length}/5`;
  $('deck-grid').innerHTML = U.inv.map(c => { const i = U.deck.indexOf(c.id); return cardEl(c, i >= 0 ? ' sel' : '', i >= 0 ? `<i class="no">${i + 1}</i>` : ''); }).join('') || EMPTY;
  show('s-deck');
}
$('deck-grid').addEventListener('click', e => {
  const b = e.target.closest('[data-id]'); if (!b) return;
  const id = +b.dataset.id, i = U.deck.indexOf(id);
  if (i >= 0) U.deck.splice(i, 1);
  else if (U.deck.length >= 5) return toast('출격 카드는 최대 5장이에요.');
  else U.deck.push(id);
  persist(); deck();
});

/* ── 뽑기 ── */
const POOL = ['kimul'];
function gacha() { pulling = false; $('pack').className = 'pack'; $('g-wal').textContent = wal(); show('s-gacha'); }

function draw(n) {
  if (pulling) return;
  if (!U.admin) {
    const useT = Math.min(U.tickets, n), bp = (n - useT) * PULL_BP;
    if (U.bp < bp) return toast('뽑기권 또는 BP가 부족해요.');
    U.tickets -= useT; U.bp -= bp;
  }
  const got = Array.from({ length: n }, () => ({ id: U.seq++, type: POOL[Math.floor(Math.random() * POOL.length)] }));
  U.inv.push(...got); persist();
  pulling = true; $('g-wal').textContent = wal();
  $('pack').className = 'pack shake';
  setTimeout(() => { $('pack').className = 'pack open'; navigator.vibrate?.(40); setTimeout(() => results(got), 450); }, 850);
}
function results(got) {
  const g = $('rgrid');
  g.className = got.length === 1 ? 'rgrid one' : 'rgrid';
  g.innerHTML = got.map((c, i) => `<div class="rc" style="animation-delay:${i * .12}s"><img src="${CARDS[c.type].img}" alt="${CARDS[c.type].name}"></div>`).join('');
  $('res').hidden = false;
}
$('g1').onclick = () => draw(1);
$('g10').onclick = () => draw(10);
$('r-ok').onclick = () => { $('res').hidden = true; gacha(); };

/* ── 시작 ── */
(async () => {
  await ensureAdmin();
  const sid = LS.get('kc_session'), saved = sid && users()[sid];
  if (saved) { U = saved; enter(); } else show('s-auth');
})();
