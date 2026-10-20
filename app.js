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
const ADMIN_EMAIL = 'yoojin_choi@kimul.app'; // 아이디 Yoojin_choi 로 가입한 계정이 관리자
const mail = id => `${id}@kimul.app`;
const uid = () => auth.currentUser.uid;
const PULL_BP = 1000, NAME_MAX = 8;
const DIFFS = [
  { name: '김울급', info: '진짜 겁나 쉬움', bot: 60, bp: 50, p: { dmg: 1, gap: 2200, gain: 8, sdmg: 5, windup: 1800, shield: 0 } },
  { name: '쉬움', info: '입문용', bot: 150, bp: 100, p: { dmg: 2, gap: 1200, gain: 18, sdmg: 15, windup: 1400, shield: 0 } },
  { name: '보통', info: '봇도 방어막 사용', bot: 250, bp: 200, p: { dmg: 3, gap: 900, gain: 25, sdmg: 25, windup: 1100, shield: .35 } },
  { name: '어려움', info: '빠르고 방어도 잘함', bot: 400, bp: 400, p: { dmg: 4, gap: 800, gain: 25, sdmg: 30, windup: 900, shield: .6 } },
  { name: '헬모드', info: '각오하세요', bot: 700, bp: 1000, p: { dmg: 5, gap: 650, gain: 30, sdmg: 35, windup: 750, shield: .85 } },
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
  if (U.admin) {
    U.tut = true;
    for (const t in CARDS) while (U.inv.filter(c => c.type === t).length < 5) U.inv.push({ id: U.seq++, type: t });
  }
  if (!snap.exists || U.admin) await persist();
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
$('m-deck').onclick = deck;
$('m-coll').onclick = coll;
$('m-gacha').onclick = gacha;
$('m-out').onclick = () => { auth.signOut(); U = null; show('s-auth'); };
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) ({ menu, coll, deck, gacha })[b.dataset.go](); });

/* ── AI 대전 ── */
function myDeck() {
  let types = U.deck.map(id => U.inv.find(c => c.id === id)).filter(Boolean).map(c => c.type);
  if (!types.length) types = U.inv.slice(0, 5).map(c => c.type);
  return types;
}
function diffs() {
  $('diff-list').innerHTML = DIFFS.map((d, i) => `<button class="mbtn big d" data-i="${i}"><b>${d.name}</b><small>${d.info} · 체력 ${d.bot} · 승리 +${d.bp} BP</small></button>`).join('');
  show('s-diff');
}
$('diff-list').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) startAI(DIFFS[+b.dataset.i]); });

function startAI(d) {
  const types = myDeck();
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

/* ── 시작: 로그인 유지 확인 ── */
let booted = false;
auth.onAuthStateChanged(async u => {
  if (booted) return;
  booted = true;
  if (!u) return show('s-auth');
  try { await loadUser(); enter(); } catch (e) { toast('불러오기 실패: ' + (e.code || e.message)); show('s-auth'); }
});
