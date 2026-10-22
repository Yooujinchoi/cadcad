/* 계정(Firebase Auth) · 저장(Firestore) · 메뉴 · 컬렉션 · 출격 설정 · 뽑기 · AI 대전 */
firebase.initializeApp({
  apiKey: "AIzaSyAn9r8ir_HvhbOrul1vkY3TPUWNsnxfV9A",
  authDomain: "kimul-card.firebaseapp.com",
  databaseURL: "https://kimul-card-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kimul-card",
  storageBucket: "kimul-card.firebasestorage.app",
  messagingSenderId: "388739327635",
  appId: "1:388739327635:web:bd8748e8a56310ddf50f66",
});
const auth = firebase.auth(), db = firebase.firestore();
const ADMIN_EMAIL = 'yooujin_choi@kimul.app'; // 아이디 Yooujin_choi 로 가입한 계정이 관리자
const mail = id => `${id}@kimul.app`;
const uid = () => auth.currentUser.uid;
const NAME_MAX = 8;
const DIFFS = [
  { name: '훈련봇', info: '체력 무한 · 공격 안 함 · 방어막 안 씀 · 보상 없음 (연습용)', train: true, bot: 1, bp: 0, p: { dmg: 0, gap: 1000, gain: 0, sdmg: 0, windup: 1000, shield: 0 } },
  { name: '김울급', info: '진짜 겁나 쉬움', bot: 60, bp: 50, p: { dmg: 1, gap: 2200, gain: 5, sdmg: 5, windup: 1800, shield: 0 } },
  { name: '쉬움', info: '입문용', bot: 200, bp: 200, p: { dmg: 5, gap: 1200, gain: 5, sdmg: 40, cost: 100, windup: 1400, shield: 0 } },
  { name: '보통', info: '봇도 방어막 사용', bot: 500, bp: 400, p: { dmg: 7, gap: 900, gain: 5, sdmg: 55, cost: 80, windup: 1100, shield: .35 } },
  { name: '어려움', info: '빠르고 방어도 잘함', bot: 1000, bp: 500, p: { dmg: 12, gap: 800, gain: 5, sdmg: 80, cost: 65, windup: 900, shield: .6 } },
  { name: '헬모드', info: '각오하세요', bot: 5000, bp: 2000, p: { dmg: 25, gap: 650, gain: 5, sdmg: 100, cost: 50, windup: 750, shield: .85 } },
];
const AUTH_ERR = {
  'auth/email-already-in-use': '이미 사용 중인 아이디예요.',
  'auth/invalid-credential': '아이디 또는 비밀번호가 올바르지 않아요.',
  'auth/wrong-password': '아이디 또는 비밀번호가 올바르지 않아요.',
  'auth/user-not-found': '아이디 또는 비밀번호가 올바르지 않아요.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
  'auth/network-request-failed': '네트워크 연결을 확인하세요.',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해보세요.',
};
let U = null, up = false, pulling = false;

const fmt = n => n.toLocaleString('en-US');
const wal = () => U.admin ? 'BP ∞ · 뽑기권 ∞' : `BP ${fmt(U.bp)} · 뽑기권 ${U.tickets}`;
const toast = m => { const t = $('toast'); t.textContent = m; restart(t, 'on'); };
const len = v => Array.from(v).length;
const clip = v => Array.from(v).slice(0, NAME_MAX).join('');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const persist = () => { const { admin, ...d } = U; return db.collection('users').doc(uid()).set(d).catch(e => toast('저장 실패: ' + (e.code || e.message))); };

// 방 비밀번호 해시용 SHA-256
function sha256(str) {
  const P = []; for (let n = 2; P.length < 64; n++) if (P.every(p => n % p)) P.push(n);
  const fr = x => Math.floor((x - Math.floor(x)) * 4294967296);
  const K = P.map(p => fr(Math.cbrt(p)));
  let H = P.slice(0, 8).map(p => fr(Math.sqrt(p)));
  const bytes = new TextEncoder().encode(str), bl = bytes.length * 8, m = [...bytes, 0x80];
  while (m.length % 64 !== 56) m.push(0);
  m.push(0, 0, 0, 0, bl >>> 24 & 255, bl >>> 16 & 255, bl >>> 8 & 255, bl & 255);
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < m.length; i += 64) {
    const w = [];
    for (let t = 0; t < 16; t++) w[t] = (m[i + 4 * t] << 24 | m[i + 4 * t + 1] << 16 | m[i + 4 * t + 2] << 8 | m[i + 4 * t + 3]) | 0;
    for (let t = 16; t < 64; t++) {
      const s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = H.map((x, j) => (x + [a, b, c, d, e, f, g, h][j]) | 0);
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/* ── 로그인 / 회원가입 / 이름 ── */
const mode = v => {
  up = v;
  $('t-in').classList.toggle('on', !v); $('t-up').classList.toggle('on', v);
  $('upw2').hidden = !v; $('abtn').textContent = v ? '회원가입' : '로그인'; $('aerr').textContent = '';
};
$('t-in').onclick = () => mode(false);
$('t-up').onclick = () => mode(true);

async function loadUser() {
  const u = auth.currentUser, snap = await db.collection('users').doc(u.uid).get();
  U = snap.exists ? snap.data() : { id: u.email.split('@')[0], name: '', tut: false, bp: 0, tickets: 0, inv: [], deck: [], seq: 1 };
  U.admin = u.email === ADMIN_EMAIL;
  const mig = migrate();
  if (U.admin) {
    U.tut = true;
    for (const t in CARDS) if (!CARDS[t].tutorial && !CARDS[t].variant && !U.inv.some(c => c.type === t)) { U.inv.push({ id: U.seq++, type: t }); U.lv[t] = 1; }
  }
  if (!snap.exists || U.admin || mig) await persist();
  if (mig && mig.n) setTimeout(() => panel('레벨 시스템 도입', `같은 카드 ${mig.n}장이 레벨업으로 바뀌었어요.${mig.bp ? `\n최대 레벨을 넘은 카드는 ${fmt(mig.bp)} BP로 돌려받았어요.` : ''}`, '확인'), 800);
}
function migrate() { // 레벨 시스템 도입 시 한 번: 중복 카드 → 레벨, 최대 레벨 초과분 → BP
  if (U.lvv) return null;
  U.lv = U.lv || {};
  const first = {}, keep = [], byId = {}; let n = 0, bp = 0;
  for (const c of U.inv) {
    byId[c.id] = c;
    if (!CARDS[c.type] || CARDS[c.type].tutorial || CARDS[c.type].variant) continue;
    if (!first[c.type]) { first[c.type] = c; keep.push(c); U.lv[c.type] = U.lv[c.type] || 1; continue; }
    n++;
    if (U.lv[c.type] < LV_MAX) U.lv[c.type]++; else bp += rar(c.type).refund || 0;
  }
  U.deck = [...new Set(U.deck.map(id => byId[id] && first[byId[id].type] && first[byId[id].type].id).filter(Boolean))];
  U.inv = keep; if (!U.admin) U.bp += bp; U.lvv = 1;
  return { n, bp };
}

$('auth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('uid').value.trim().toLowerCase(), pw = $('upw').value, err = m => { $('aerr').textContent = m; }, btn = $('abtn');
  if (!/^[a-z0-9_]{4,12}$/.test(id)) return err('아이디는 영문·숫자·_ 4~12자로 입력하세요.');
  if (pw.length < 6) return err('비밀번호는 6자 이상 입력하세요.');
  if (up && pw !== $('upw2').value) return err('비밀번호 확인이 일치하지 않아요.');
  btn.disabled = true; err('');
  try {
    if (up) {
      const c = await auth.createUserWithEmailAndPassword(mail(id), pw);
      await db.collection('users').doc(c.user.uid).set({ id, name: '', tut: false, bp: 0, tickets: 0, inv: [], deck: [], seq: 1 });
    } else await auth.signInWithEmailAndPassword(mail(id), pw);
    await loadUser();
    $('upw').value = $('upw2').value = '';
    enter();
  } catch (x) { err(AUTH_ERR[x.code] || '오류: ' + (x.code || x.message)); }
  finally { btn.disabled = false; }
});

function enter() {
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
  U.tut ? menu() : tutorial(0);
});

function tutorialDone() {
  U.tut = true; U.tickets += 10; U.bp += 10000;
  for (let k = 0; k < 3; k++) grant('kimul'); // 중복은 레벨업 → 평범한 김울 Lv.3
  persist();
  panel('튜토리얼 클리어를 축하합니다', '획득 보상\n10회 뽑기권 , 평범한 김울 카드 3장 , 10,000 BP', '메뉴화면으로', menu);
}

/* ── 메뉴 ── */
function menu() {
  $('m-name').textContent = U.name; $('m-wal').textContent = wal(); $('m-av').innerHTML = avHtml(U.photo);
  $('m-dot').hidden = U.seenPatch === PATCHES[0].v;
  show('s-menu');
}
$('m-ai').onclick = diffs;
$('m-deck').onclick = deck;
$('m-shop').onclick = shop;
$('m-coll').onclick = coll;
$('m-gacha').onclick = gacha;
$('m-out').onclick = () => { auth.signOut(); U = null; show('s-auth'); };

/* ── 패치 내역 (내용은 patches.js) ── */
function patches() {
  $('patch-list').innerHTML = PATCHES.map((p, i) => `<article class="patch${i === 0 ? ' new' : ''}"><h3>v${esc(p.v)} · ${esc(p.title)}${i === 0 ? '<em>NEW</em>' : ''}</h3><ul>${p.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></article>`).join('');
  show('s-patch');
  if (U.seenPatch !== PATCHES[0].v) { U.seenPatch = PATCHES[0].v; persist(); }
}
$('m-patch').onclick = patches;

/* ── 프로필 (사진은 128px로 줄여 Firestore에 저장) ── */
function profile() {
  $('pf-name').textContent = U.name; $('pf-av').innerHTML = avHtml(U.photo, 'xl');
  $('pf-rn').textContent = `이름 변경 (이름변경권 ${U.admin ? '∞' : (U.nt || 0)}장)`;
  show('s-prof');
}
$('pf-rn').onclick = () => {
  if (!U.admin && !(U.nt > 0)) return panel('이름변경권이 필요해요', '상점에서 이름변경권을 구매하면\n이름을 바꿀 수 있어요.', '상점으로', shop, '닫기');
  ask('이름 변경', `새 이름을 입력하세요. (최대 ${NAME_MAX}글자)\n이름변경권 1장이 사용돼요.`, '새 이름', v => {
    v = clip(v.trim());
    if (!v) return toast('이름을 입력하세요.');
    if (v === U.name) return toast('현재 이름과 같아요.');
    if (!U.admin) U.nt -= 1;
    U.name = v; persist(); profile(); toast('이름을 바꿨어요.');
  }, NAME_MAX);
};

/* ── 상점 (BP로 구매) ── */
const ITEMS = [
  { icon: '🎟', name: '뽑기 티켓 1장', price: 500, give: u => { u.tickets += 1; } },
  { icon: '🎟', name: '뽑기 티켓 10장', price: 4800, note: '장당 480 BP', give: u => { u.tickets += 10; } },
  { icon: '✏️', name: '이름변경권 1장', price: 1000, give: u => { u.nt = (u.nt || 0) + 1; } },
];
function shop() {
  $('sh-wal').textContent = U.admin ? 'BP ∞ · 뽑기권 ∞ · 변경권 ∞' : `BP ${fmt(U.bp)} · 뽑기권 ${U.tickets} · 변경권 ${U.nt || 0}`;
  $('sh-list').innerHTML = ITEMS.map((it, i) => `<button class="mbtn item" data-i="${i}"><span>${it.icon} ${it.name}${it.note ? `<small>${it.note}</small>` : ''}</span><b>${fmt(it.price)} BP</b></button>`).join('');
  show('s-shop');
}
$('sh-list').addEventListener('click', e => {
  const b = e.target.closest('[data-i]'); if (!b) return;
  const it = ITEMS[+b.dataset.i];
  if (!U.admin && U.bp < it.price) return toast('BP가 부족해요.');
  panel('구매 확인', `${it.name}\n${U.admin ? '관리자는 무료예요.' : fmt(it.price) + ' BP를 사용할까요?'}`, '구매', () => {
    if (!U.admin) { if (U.bp < it.price) return toast('BP가 부족해요.'); U.bp -= it.price; }
    it.give(U); persist(); shop(); toast(`구매 완료: ${it.name}`);
  }, '취소');
});
$('m-me').onclick = profile;
$('pf-up').onclick = () => $('pf-file').click();
$('pf-del').onclick = () => { U.photo = ''; persist(); profile(); toast('기본 사진으로 바꿨어요.'); };
$('pf-file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { U.photo = await shrink(f); await persist(); profile(); toast('프로필 사진을 바꿨어요.'); }
  catch { toast('사진을 불러오지 못했어요.'); }
};
function shrink(file) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height), c = document.createElement('canvas');
      c.width = c.height = 128;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', .8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(); };
    img.src = url;
  });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) ({ menu, coll, deck, gacha })[b.dataset.go](); });

/* ── AI 대전 ── */
function myDeck() { // 출격 카드(같은 카드는 한 장) → 레벨이 반영된 카드
  let list = U.deck.map(id => U.inv.find(c => c.id === id)).filter(Boolean);
  if (!list.length) list = U.inv.slice().sort(byRank);
  return [...new Set(list.map(c => c.type))].slice(0, 5).map(t => lvKey(t, lvOf(t)));
}
function diffs() {
  $('diff-list').innerHTML = DIFFS.map((d, i) => `<button class="mbtn big d" data-i="${i}"><b>${d.name}</b><small>${d.train ? d.info : `${d.info} · 체력 ${fmt(d.bot)} · 평타 ${d.p.dmg} · 스킬 ${d.p.sdmg} · 스킬포인트 ${d.p.cost || 100} · 승리 +${fmt(d.bp)} BP`}</small></button>`).join('');
  show('s-diff');
}
$('diff-list').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) startAI(DIFFS[+b.dataset.i]); });

function startAI(d) {
  const types = myDeck();
  if (!types.length) return panel('카드가 없어요', '뽑기에서 카드를 먼저 뽑아주세요.', '확인');
  battle({ who: U.name, tag: d.name, botName: d.train ? '훈련봇' : `${d.name} 봇`, bot: d.bot, p: d.p, atk: !d.train, dummy: !!d.train, skill: true, shield: true, quit: true, deck: types,
    hint: () => d.train ? '훈련봇은 공격하지 않아요. 평타 · 스킬 · 교체를 마음껏 연습하고, 다 하면 나가기를 누르세요.' : '전투 시작! 평타로 게이지를 모아 스킬을 쓰세요.',
    win: () => { if (!U.admin) U.bp += d.bp; persist(); panel('승리!', `${d.name} 봇을 쓰러뜨렸어요!\n+${d.bp} BP`, '메뉴로', menu, '다시 하기', () => startAI(d)); },
    lose: () => panel('패배', '카드가 모두 쓰러졌어요.', '다시 도전', () => startAI(d), '메뉴로', menu) });
}

/* ── 컬렉션 / 출격 카드 ── */
const byRank = (a, b) => rar(b.type).rank - rar(a.type).rank || a.id - b.id;
const cardEl = (c, extra = '', n = '') => { const d = CARDS[c.type], r = rar(c.type); return `<button class="cc${extra}" data-id="${c.id}" style="--rc:${r.color}"><img src="${d.img}" alt="${d.name}"><i class="rt" style="background:${r.color}">${r.name}</i>${n}</button>`; };
const EMPTY = '<p class="empty">아직 카드가 없어요.<br>뽑기에서 카드를 뽑아보세요!</p>';

// 같은 카드는 한 칸으로 묶어서 보여줌 (높은 등급 먼저)
const groups = () => {
  const m = {}; for (const c of U.inv) (m[c.type] = m[c.type] || []).push(c);
  return Object.keys(m).sort((a, b) => rar(b).rank - rar(a).rank || a.localeCompare(b)).map(t => ({ type: t, list: m[t] }));
};
const tileEl = (t, count, extra = '', badge = '') => {
  const d = CARDS[t], r = rar(t);
  return `<button class="tile${extra}" data-t="${t}" style="--rc:${r.color}"><span class="art"><img src="${d.img}" alt="${d.name}">${badge}<i class="cnt">${count}</i></span><b class="tn">${d.name}</b><span class="tr">${r.name}</span></button>`;
};

function coll() {
  const gs = groups();
  $('coll-cnt').textContent = `${gs.length}종`;
  $('coll-grid').innerHTML = gs.map(g => tileEl(g.type, `Lv.${lvOf(g.type)}`)).join('') || EMPTY;
  show('s-coll');
}
$('coll-grid').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) detail(b.dataset.t); });

// ── 레벨 ──
const lvOf = t => (U.lv && U.lv[t]) || 1;
function grant(t) { // 카드 획득: 처음이면 새 카드, 이미 있으면 레벨업, 최대 레벨이면 BP
  U.lv = U.lv || {};
  if (!U.inv.some(c => c.type === t)) { U.inv.push({ id: U.seq++, type: t }); U.lv[t] = 1; return { type: t, res: 'new', lv: 1 }; }
  if (lvOf(t) < LV_MAX) { U.lv[t] = lvOf(t) + 1; return { type: t, res: 'up', lv: U.lv[t] }; }
  const bp = rar(t).refund || 0; if (!U.admin) U.bp += bp;
  return { type: t, res: 'max', lv: LV_MAX, bp };
}
function levelUp(t) {
  const lv = lvOf(t), cost = rar(t).up * lv;
  if (lv >= LV_MAX) return toast('이미 최대 레벨이에요.');
  if (!U.admin && U.bp < cost) return toast(`BP가 부족해요. (${fmt(cost)} BP 필요 · 보유 ${fmt(U.bp)} BP)`);
  if (!U.admin) U.bp -= cost;
  U.lv[t] = lv + 1; persist(); coll(); detail(t);
  toast(`${CARDS[t].name} Lv.${lv + 1} 달성!`);
}
function detail(t) {
  const lv = lvOf(t), d = CARDS[lvKey(t, lv)], inDeck = U.inv.some(c => c.type === t && U.deck.includes(c.id));
  const nx = lv < LV_MAX ? CARDS[lvKey(t, lv + 1)] : null, cost = rar(t).up * lv;
  const txt = `등급 ${rar(t).name} · Lv.${lv} / ${LV_MAX}${inDeck ? ' · 출격 중' : ''}\n체력 ${d.hp}\n${d.basic.name}: 데미지 ${d.basic.dmg} · ${d.basic.cd / 1000}초마다 (스킬포인트 +${d.basic.gain})\n${d.skill.name}: ${skillDesc(d)} (스킬포인트 ${d.skill.cost} 필요)${d.skill.buff ? '\n※ 스킬 효과 중에는 스킬포인트가 쌓이지 않아요' : ''}${d.skill2 ? `\n${d.skill2.name}: 독 ${d.skill2.dmg} × ${d.skill2.poison.sec}초 (스킬포인트 ${d.skill2.cost}부터 사용 가능)\n※ 두 스킬 중 하나를 쓰면 스킬포인트를 전부 써요` : ''}`
    + (nx ? `\n\n다음 Lv.${lv + 1}: 체력 ${nx.hp} · 평타 ${nx.basic.dmg}${nx.skill.dmg ? ` · 스킬 ${nx.skill.dmg}` : ''}\n같은 카드를 뽑으면 무료로 레벨업돼요.` : '\n\n최대 레벨이에요! 같은 카드를 뽑으면 BP로 바뀌어요.');
  if (nx) panel(d.name, txt, `레벨업 · ${U.admin ? '무료' : fmt(cost) + ' BP'}`, () => levelUp(t), '닫기', null, d.img);
  else panel(d.name, txt, '닫기', null, null, null, d.img);
}
// 출격 카드: 위 5칸 = 출격 순서, 아래 = 보유 카드(남은 수량)
function deck() {
  const seen = new Set(), used = U.deck.map(id => U.inv.find(c => c.id === id)).filter(c => c && !seen.has(c.type) && seen.add(c.type));
  U.deck = used.map(c => c.id);
  $('deck-cnt').textContent = `${used.length}/5`;
  $('deck-slots').innerHTML = [0, 1, 2, 3, 4].map(i => {
    const c = used[i];
    if (!c) return `<div class="slot5 vacant"><span>${i + 1}</span></div>`;
    return `<button class="slot5" data-i="${i}" style="--rc:${rar(c.type).color}" aria-label="${CARDS[c.type].name} 빼기"><img src="${CARDS[c.type].img}" alt=""><i class="no">${i + 1}</i></button>`;
  }).join('');
  $('deck-grid').innerHTML = groups().map(g => {
    const inDeck = g.list.filter(c => U.deck.includes(c.id)).length, left = g.list.length - inDeck;
    const pos = U.deck.indexOf(g.list[0].id);
    return tileEl(g.type, `Lv.${lvOf(g.type)}`, pos >= 0 ? ' out' : '', pos >= 0 ? `<i class="no">${pos + 1}</i>` : '');
  }).join('') || EMPTY;
  show('s-deck');
}
$('deck-slots').addEventListener('click', e => {
  const b = e.target.closest('[data-i]'); if (!b) return;
  U.deck.splice(+b.dataset.i, 1); persist(); deck();
});
$('deck-grid').addEventListener('click', e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  if (U.deck.length >= 5) return toast('5칸이 다 찼어요. 위 칸을 눌러 빼고 넣으세요.');
  const c = U.inv.find(x => x.type === b.dataset.t);
  if (!c) return;
  if (U.deck.includes(c.id)) return toast('이미 출격 중이에요. 같은 카드는 한 장만 출격할 수 있어요.');
  U.deck.push(c.id); persist(); deck();
});

/* ── 뽑기 ── */
// 등급별 뽑기 확률(%) — 냥코대전쟁 레어뽑기 참고, 울트라 슈퍼 레어 7 · 민준급 1.5 (합계 100)
const RATES = { kimul: 36.5, worm: 20, rare: 25, sr: 10, usr: 7, minjun: 1.5 };
const poolOf = r => Object.keys(CARDS).filter(k => !CARDS[k].tutorial && !CARDS[k].variant && CARDS[k].rarity === r);
// 카드가 아직 없는 등급의 확률은 바로 아래(카드가 있는) 등급으로 넘김. 등급 안 카드는 같은 확률
function effRates() {
  const eff = {}; let carry = 0, last = null;
  for (const r of Object.keys(RARITY).sort((a, b) => RARITY[b].rank - RARITY[a].rank)) {
    carry += RATES[r] || 0;
    if (poolOf(r).length) { eff[r] = carry; carry = 0; last = r; }
  }
  if (carry && last) eff[last] += carry;
  return eff;
}
const pickCard = () => {
  const eff = effRates(); let x = Math.random() * 100, r;
  for (r in eff) if ((x -= eff[r]) < 0) break;
  const p = poolOf(r); return p[Math.floor(Math.random() * p.length)];
};
const rateText = () => { // 등급별 확률만 표시 (카드가 없는 등급은 아래 등급에 합산된 실제 확률)
  const eff = effRates();
  return '확률 · ' + Object.keys(eff).sort((a, b) => RARITY[a].rank - RARITY[b].rank).map(r => `${RARITY[r].name} ${+eff[r].toFixed(1)}%`).join(' / ');
};
function gacha() {
  pulling = false; $('pack').className = 'pack'; $('g-wal').textContent = wal();
  $('g-rate').textContent = rateText();
  $('g-tiers').innerHTML = '<em>낮음</em>' + Object.values(RARITY).sort((a, b) => a.rank - b.rank).map(r => `<span style="background:${r.color}">${r.name}</span>`).join('<i>›</i>') + '<em>높음</em>';
  show('s-gacha');
}

function draw(n) {
  if (pulling) return;
  if (!U.admin) { // 뽑기는 뽑기권으로만
    if (U.tickets < n) return panel('뽑기권이 부족해요', `${n}회 뽑기에는 뽑기권 ${n}장이 필요해요. (보유 ${U.tickets}장)\n상점에서 뽑기권을 살 수 있어요.`, '상점으로', shop, '닫기');
    U.tickets -= n;
  }
  const got = Array.from({ length: n }, () => grant(pickCard())); // 새 카드 / 중복은 레벨업 / 최대 레벨이면 BP
  persist();
  pulling = true; $('g-wal').textContent = wal();
  $('pack').className = 'pack shake';
  setTimeout(() => { $('pack').className = 'pack open'; navigator.vibrate?.(40); setTimeout(() => results(got), 450); }, 850);
}
function results(got) {
  const g = $('rgrid');
  g.className = got.length === 1 ? 'rgrid one' : 'rgrid';
  g.innerHTML = got.map((c, i) => { const r = rar(c.type), lab = c.res === 'new' ? 'NEW' : c.res === 'up' ? `Lv.${c.lv}↑` : `+${fmt(c.bp)} BP`; return `<div class="rc" style="--rc:${r.color};animation-delay:${i * .12}s"><img src="${CARDS[c.type].img}" alt="${CARDS[c.type].name}"><i class="rt" style="background:${r.color}">${r.name}</i><b class="rl${c.res === 'new' ? ' new' : ''}">${lab}</b></div>`; }).join('');
  $('res').hidden = false;
}
$('g1').onclick = () => draw(1);
$('g10').onclick = () => draw(10);
$('r-ok').onclick = () => { $('res').hidden = true; gacha(); };

/* ── 시작: 로그인 유지 확인 ── */
let booted = false;
auth.onAuthStateChanged(async u => {
  if (booted) return;
  booted = true;
  if (!u) return show('s-auth');
  try { await loadUser(); enter(); } catch (e) { toast('불러오기 실패: ' + (e.code || e.message)); show('s-auth'); }
});
