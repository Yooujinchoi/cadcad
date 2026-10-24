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
const ADMIN_NO = '00000000'; // 관리자 고유 번호 (일반 계정은 10000000~99999999)
const uid = () => auth.currentUser.uid;
const NAME_MAX = 13;
const DIFFS = [
  { name: '훈련봇', info: '체력 무한 · 공격 안 함 · 방어막 안 씀 · 보상 없음 (연습용)', train: true, bot: 1, bp: 0, p: { dmg: 0, gap: 1000, gain: 0, sdmg: 0, windup: 1000, shield: 0 } },
  { name: '김울급', info: '진짜 겁나 쉬움', bot: 60, bp: 50, p: { dmg: 1, gap: 2200, gain: 5, sdmg: 5, windup: 1800, shield: 0 } },
  { name: '쉬움', info: '입문용', bot: 200, bp: 400, p: { dmg: 5, gap: 1200, gain: 5, sdmg: 40, cost: 100, windup: 1400, shield: 0 } },
  { name: '보통', info: '기본기 연습', bot: 500, bp: 1000, p: { dmg: 7, gap: 900, gain: 5, sdmg: 55, cost: 80, windup: 1100, shield: 0 } },
  { name: '어려움', info: '빠르고 아픔', bot: 1000, bp: 4000, p: { dmg: 12, gap: 800, gain: 5, sdmg: 80, cost: 65, windup: 900, shield: 0 } },
  { name: '헬모드', info: '각오하세요', bot: 5000, bp: 20000, p: { dmg: 25, gap: 650, gain: 5, sdmg: 100, cost: 50, windup: 750, shield: 0 } },
  // 서호모드: 민준급 2장 + 울트라 슈퍼 레어 2장 정도는 있어야 깰 수 있게 맞춤 (봇 체력 × 초당 공격이 그 덱의 체력 × 초당 데미지보다 조금 작게)
  { name: '서호모드', info: '민준급 2장 + 울트라 2장은 있어야 깰 수 있어요', bot: 6500, bp: 60000, p: { dmg: 32, gap: 650, gain: 5, sdmg: 120, cost: 60, windup: 800, shield: 0 } },
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
  const gotNo = await ensureNo();
  const mig = migrate();
  if (U.admin) {
    U.tut = true;
    for (const t in CARDS) if (!CARDS[t].tutorial && !CARDS[t].variant && !U.inv.some(c => c.type === t)) { U.inv.push({ id: U.seq++, type: t }); U.lv[t] = 1; }
  }
  const gf = gifts(), rc = recalls();
  if (!snap.exists || U.admin || mig || gf.length || rc.length || gotNo) await persist();
  const notes = [];
  if (mig && mig.n) notes.push(`같은 카드 ${mig.n}장이 레벨업으로 바뀌었어요.${mig.bp ? `\n최대 레벨을 넘은 카드는 ${fmt(mig.bp)} BP로 돌려받았어요.` : ''}`);
  rc.forEach(r => notes.push(`⚠ ${CARDS[r.type].name} 카드 회수\n카드가 회수되고, 보상으로 뽑기권 ${r.tickets}장 · ${fmt(r.bp)} BP를 받았어요.`));
  gf.forEach(g => notes.push(`🎁 ${g.title}\n뽑기권 ${g.tickets}장 · ${fmt(g.bp)} BP를 받았어요!`));
  if (notes.length) setTimeout(() => panel('알림', notes.join('\n\n'), '확인'), 800);
}
// 선물: 계정마다 한 번만 지급. before 날짜 이전에 만든 계정만 받음 (새 선물은 배열에 추가)
const GIFTS = [
  { id: 'gift-2026-10', title: '업데이트 기념 선물', tickets: 20, bp: 20000, before: '2026-10-23T00:00:00+09:00' },
];
function gifts() {
  const created = Date.parse((auth.currentUser.metadata || {}).creationTime || '');
  U.gifts = U.gifts || [];
  const got = [];
  for (const g of GIFTS) {
    if (U.gifts.includes(g.id)) continue;
    if (g.before && !(created < Date.parse(g.before))) continue;
    U.tickets += g.tickets; U.bp += g.bp; U.gifts.push(g.id); got.push(g);
  }
  return got;
}
// 카드 회수: 이 카드를 가진 일반 계정에서 빼고 보상 지급 (계정마다 한 번, 관리자는 제외)
const RECALLS = [
  { id: 'recall-dark', type: 'dark', tickets: 100, bp: 10000 },
];
function recalls() {
  if (U.admin) return [];
  U.recalls = U.recalls || [];
  const got = [];
  for (const r of RECALLS) {
    if (U.recalls.includes(r.id)) continue;
    const c = U.inv.find(x => x.type === r.type);
    if (!c) continue;
    U.inv = U.inv.filter(x => x.type !== r.type);
    U.deck = U.deck.filter(id => id !== c.id);
    if (U.lv) delete U.lv[r.type];
    U.tickets += r.tickets; U.bp += r.bp; U.recalls.push(r.id); got.push(r);
  }
  return got;
}
// ── 아이템: 기본은 힐, 상점에서 방어막을 사면 장착 가능 ──
const hasItem = (u, k) => k === 'heal' || !!(u.admin || (u.items || []).includes(k));
const hasShield = u => hasItem(u, 'shield');
const myItem = () => U.item && hasItem(U, U.item) ? U.item : 'heal';
const ITEM_LIST = [['heal', '✚ 힐'], ['shield', '🛡 방어막'], ['gw', '⊘ 치감'], ['cleanse', '✦ 정화']];
const addItem = (u, k) => { u.items = [...new Set([...(u.items || []), k])]; u.item = k; };
$('item-bar').addEventListener('click', e => {
  const b = e.target.closest('[data-item]'); if (!b) return;
  if (!hasItem(U, b.dataset.item)) return panel('잠긴 아이템', '상점에서 살 수 있어요.\n한 번 사면 계속 쓸 수 있어요.', '상점으로', shop, '닫기');
  U.item = b.dataset.item; persist(); deck();
});

// ── 고유 번호: 계정마다 8자리, 서버(nos)에 한 번만 등록되고 바꿀 수 없음 ──
let noErr = '', noBusy = false;
async function ensureNo() {
  if (U.admin) { // 관리자는 00000000 고정 (예전에 받은 번호가 있으면 정리)
    if (U.no === ADMIN_NO) return false;
    try {
      const rdb = firebase.database(), old = U.no;
      await rdb.ref('nos/' + ADMIN_NO).set(auth.currentUser.uid);
      if (old) await rdb.ref('nos/' + old).remove().catch(() => {});
      U.no = ADMIN_NO; return true;
    } catch (e) { noErr = e.code || e.message || '오류'; return false; }
  }
  if (U.no) return false;
  const me = auth.currentUser.uid;
  for (let i = 0; i < 6; i++) {
    const no = String(10000000 + Math.floor(Math.random() * 90000000));
    try {
      const r = await firebase.database().ref('nos/' + no).transaction(cur => cur === null ? me : undefined);
      if (r.committed) { U.no = no; return true; }
    } catch (e) { noErr = e.code || e.message || '오류'; return false; } // 규칙이 아직 없으면 다음에 다시 시도
  }
  return false;
}
$('pf-no').onclick = () => {
  if (!U.no) return;
  (navigator.clipboard ? navigator.clipboard.writeText(U.no) : Promise.reject()).then(() => toast('고유 번호를 복사했어요.'), () => toast(`고유 번호: ${U.no}`));
};

// ── 우편함: 관리자가 특정 계정에 보낸 보상 (Realtime Database mail/<uid>) ──
let mailRef = null;
function listenMail() {
  if (mailRef || !auth.currentUser) return;
  mailRef = firebase.database().ref('mail/' + auth.currentUser.uid);
  mailRef.on('value', s => Object.keys(s.val() || {}).forEach(claimMail), () => {});
}
function stopMail() { if (mailRef) mailRef.off(); mailRef = null; }
function claimMail(id) { // 지우는 데 성공한 기기만 보상을 받아서 두 번 받을 수 없음
  let got = null;
  mailRef.child(id).transaction(cur => { got = cur; return cur ? null : undefined; }, (err, ok) => {
    if (err || !ok || !got || !U) return;
    const tk = Math.max(0, Math.floor(+got.tickets || 0)), bp = Math.max(0, Math.floor(+got.bp || 0));
    const cs = (Array.isArray(got.cards) ? got.cards : Object.values(got.cards || {})).filter(k => CARDS[k] && !CARDS[k].tutorial && !CARDS[k].variant);
    U.tickets += tk; U.bp += bp; cs.forEach(k => grant(k)); persist();
    toast(`🎁 보상 도착! 뽑기권 ${tk}장 · ${fmt(bp)} BP${cs.length ? ' · 카드 ' + cs.map(k => CARDS[k].name).join(', ') : ''}`);
    if (!$('s-menu').hidden) menu();
  });
}
$('m-gift').onclick = () => { // 관리자: 고유 번호로 보상 보내기
  if (!U.admin) return;
  const num = () => { $('p-in').inputMode = 'numeric'; };
  ask('보상 지급', '받을 계정의 고유 번호(8자리)를 입력하세요.\n고유 번호는 각자 프로필에서 볼 수 있어요.', '고유 번호', no => {
    no = no.replace(/\D/g, '');
    if (no.length !== 8) return toast('고유 번호는 8자리 숫자예요.');
    firebase.database().ref('nos/' + no).once('value').then(s => {
      const to = s.val();
      if (!to) return toast('그 고유 번호의 계정이 없어요.');
      ask('보상 지급', `고유 번호 ${no}에게 줄 뽑기권 수를 입력하세요.`, '뽑기권 (0 이상)', tk => {
        ask('보상 지급', `고유 번호 ${no}에게 줄 BP를 입력하세요.`, 'BP (0 이상)', bp => {
          const list = giftable();
          ask('보상 지급 · 카드', `줄 카드 번호를 쉼표로 적으세요. (없으면 비워두기)\n${list.map((k, i) => `${i + 1}. ${CARDS[k].name} (${rar(k).name})`).join('\n')}`, '예: 3, 7', cs => {
            tk = Math.max(0, Math.floor(+tk || 0)); bp = Math.max(0, Math.floor(+bp || 0));
            const cards = cs.split(/[^0-9]+/).filter(Boolean).map(x => list[+x - 1]).filter(Boolean);
            if (!tk && !bp && !cards.length) return toast('보낼 보상이 없어요.');
            firebase.database().ref('mail/' + to).push({ tickets: tk, bp, cards, at: firebase.database.ServerValue.TIMESTAMP })
              .then(() => toast(`${no}에게 보냈어요: 뽑기권 ${tk}장 · ${fmt(bp)} BP${cards.length ? ' · 카드 ' + cards.length + '장' : ''}`))
              .catch(e => toast('지급 실패: ' + (e.code || e.message)));
          }, 60);
        }, 9); num();
      }, 5); num();
    }).catch(e => toast('조회 실패: ' + (e.code || e.message)));
  }, 8); num();
};

const giftable = () => Object.keys(CARDS).filter(k => !CARDS[k].tutorial && !CARDS[k].variant).sort((a, b) => rar(a).rank - rar(b).rank || a.localeCompare(b));

// ── 카드 도감: 없는 카드도 능력치까지 볼 수 있음 ──
function dex() {
  const keys = Object.keys(CARDS).filter(k => !CARDS[k].tutorial && !CARDS[k].variant && !CARDS[k].retired && !RARITY[CARDS[k].rarity].adminOnly)
    .sort((a, b) => rar(b).rank - rar(a).rank || a.localeCompare(b));
  const has = k => U.inv.some(c => c.type === k);
  $('dex-cnt').textContent = `${keys.filter(has).length}/${keys.length}종 보유`;
  $('dex-grid').innerHTML = keys.map(k => tileEl(k, has(k) ? '보유' : '미보유', has(k) ? '' : ' unowned')).join('');
  show('s-dex');
}
$('coll-dex').onclick = dex;
$('dex-back').onclick = () => coll();
$('dex-grid').addEventListener('click', e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  const k = b.dataset.t, d = CARDS[k], own = U.inv.some(c => c.type === k); // 도감은 Lv.1 기준
  const txt = `등급 ${rar(k).name} · ${own ? '보유 중' : '미보유'}\n(Lv.1 기준 능력치)\n체력 ${d.hp}\n${d.basic.name}: ${basicDesc(d)} (스킬포인트 +${d.basic.gain})\n${d.skill.name}: ${skillDesc(d)} (스킬포인트 ${d.skill.cost} 필요)`
    + (d.skill2 ? `\n${d.skill2.name}: 독 ${d.skill2.dmg} × ${d.skill2.poison.sec}초 (스킬포인트 ${d.skill2.cost}부터)` : '')
    + (d.lastStand ? `\n${d.lastStand.name}: 체력 ${d.lastStand.at * 100}% 이하가 되면 자동으로 ${d.lastStand.dmg}` : '')
    + '';
  panel(d.name, txt, '닫기', null, null, null, d.img);
});

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
  listenNotice(); listenMail();
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
  $('m-story').hidden = !U.admin; // 스토리 모드 베타: 관리자만
  $('m-notice').hidden = !U.admin; $('m-gift').hidden = !U.admin;
  show('s-menu');
}
$('m-ai').onclick = diffs;
$('m-deck').onclick = deck;
$('m-shop').onclick = shop;
$('m-coll').onclick = coll;
$('m-gacha').onclick = gacha;
$('m-out').onclick = () => { stopNotice(); stopMail(); auth.signOut(); U = null; show('s-auth'); };

/* ── 공지: 관리자가 쓰면 모든 계정 화면 위쪽에 실시간으로 표시 (Realtime Database 'notice') ── */
let noticeRef = null, noticeNow = null;
function listenNotice() {
  if (noticeRef) return;
  noticeRef = firebase.database().ref('notice');
  noticeRef.on('value', s => { noticeNow = s.val(); renderNotice(); }, () => {});
}
function stopNotice() { if (noticeRef) noticeRef.off(); noticeRef = null; noticeNow = null; renderNotice(); }
function renderNotice() {
  let closed = null; try { closed = localStorage.getItem('kc_notice_closed'); } catch {}
  const n = noticeNow, on = !!(n && n.text && String(n.at) !== closed);
  $('notice').hidden = !on; $('app').classList.toggle('has-notice', on);
  if (on) $('notice-t').textContent = n.text;
}
$('notice-t').onclick = () => { if (noticeNow) panel('📢 공지', noticeNow.text, '확인'); };
$('notice-x').onclick = () => { if (noticeNow) { try { localStorage.setItem('kc_notice_closed', String(noticeNow.at)); } catch {} } renderNotice(); }; // 닫으면 새 공지가 올라올 때까지 숨김
$('m-notice').onclick = () => {
  if (!U.admin) return;
  ask('공지 쓰기', '모든 계정 화면 위쪽에 보일 공지예요.\n비워두고 확인을 누르면 공지가 내려가요.', '공지 내용 (최대 100자)', v => {
    v = v.trim();
    const ref = firebase.database().ref('notice');
    (v ? ref.set({ text: v, at: firebase.database.ServerValue.TIMESTAMP, by: U.name }) : ref.remove())
      .then(() => toast(v ? '공지를 올렸어요.' : '공지를 내렸어요.'))
      .catch(e => toast('공지 실패: ' + (e.code || e.message) + ' (Realtime Database 규칙을 확인하세요)'));
  }, 100);
  $('p-in').value = noticeNow && noticeNow.text ? noticeNow.text : '';
};

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
  $('pf-no').textContent = U.no ? `고유 번호 ${U.no} · 복사` : '고유 번호 발급 중…';
  if (!U.no && !noBusy) { // 프로필을 열 때마다 다시 시도 (규칙을 나중에 바꿔도 새로고침 없이 발급)
    noBusy = true;
    ensureNo().then(ok => { noBusy = false; if (ok) { persist(); profile(); } else $('pf-no').textContent = `고유 번호 발급 실패 · ${noErr || '잠시 후 다시'}`; });
  }
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
  { icon: '🎟', name: '뽑기 티켓 100장', price: 48000, note: '장당 480 BP', give: u => { u.tickets += 100; } },
  { icon: '✏️', name: '이름변경권 1장', price: 1000, give: u => { u.nt = (u.nt || 0) + 1; } },
  { icon: '🛡', name: '아이템: 방어막', price: 10000, note: '전투에서 힐 대신 장착 · 한 번 사면 계속 사용', owned: u => hasShield(u),
    give: u => addItem(u, 'shield') },
  { icon: '⊘', name: '아이템: 치감', price: 20000, note: '멀티에서 7초 동안 상대 회복 40% 감소 · 한 판에 2번 · 한 번 사면 계속', owned: u => hasItem(u, 'gw'), give: u => addItem(u, 'gw') },
  { icon: '✦', name: '아이템: 정화', price: 20000, note: '내 카드의 독 · 저주 · 치감을 바로 없앰 · 한 판에 2번 · 한 번 사면 계속', owned: u => hasItem(u, 'cleanse'), give: u => addItem(u, 'cleanse') },
];
function shop() {
  $('sh-wal').textContent = U.admin ? 'BP ∞ · 뽑기권 ∞ · 변경권 ∞' : `BP ${fmt(U.bp)} · 뽑기권 ${U.tickets} · 변경권 ${U.nt || 0}`;
  $('sh-list').innerHTML = ITEMS.map((it, i) => `<button class="mbtn item" data-i="${i}"><span>${it.icon} ${it.name}${it.note ? `<small>${it.note}</small>` : ''}</span><b>${it.owned && it.owned(U) ? '보유 중' : fmt(it.price) + ' BP'}</b></button>`).join('');
  show('s-shop');
}
$('sh-list').addEventListener('click', e => {
  const b = e.target.closest('[data-i]'); if (!b) return;
  const it = ITEMS[+b.dataset.i];
  if (it.owned && it.owned(U)) return toast('이미 가지고 있어요. 출격 카드 설정에서 장착할 수 있어요.');
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
  battle({ who: U.name, tag: d.name, botName: d.train ? '훈련봇' : `${d.name} 봇`, bot: d.bot, p: d.p, atk: !d.train, dummy: !!d.train, skill: true, shield: true, item: myItem(), quit: true, deck: types,
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
  const txt = `등급 ${rar(t).name} · Lv.${lv} / ${LV_MAX}${inDeck ? ' · 출격 중' : ''}\n체력 ${d.hp}\n${d.basic.name}: ${basicDesc(d)} (스킬포인트 +${d.basic.gain})\n${d.skill.name}: ${skillDesc(d)} (스킬포인트 ${d.skill.cost} 필요)${d.skill.buff ? '\n※ 스킬 효과 중에는 스킬포인트가 쌓이지 않아요' : ''}${d.lastStand ? `\n${d.lastStand.name}: 체력 ${d.lastStand.at * 100}% 이하가 되면 자동으로 상대에게 ${d.lastStand.dmg} 데미지 (한 판에 한 번)` : ''}${d.skill2 ? `\n${d.skill2.name}: 독 ${d.skill2.dmg} × ${d.skill2.poison.sec}초 (스킬포인트 ${d.skill2.cost}부터 사용 가능)\n※ 두 스킬 중 하나를 쓰면 스킬포인트를 전부 써요` : ''}`
    + (nx ? `\n\n다음 Lv.${lv + 1}: 체력 ${nx.hp} · 평타 ${nx.basic.dmg}${nx.skill.dmg ? ` · 스킬 ${nx.skill.dmg}` : ''}\n같은 카드를 뽑으면 무료로 레벨업돼요.` : '\n\n최대 레벨이에요! 같은 카드를 뽑으면 BP로 바뀌어요.');
  if (nx) panel(d.name, txt, `레벨업 · ${U.admin ? '무료' : fmt(cost) + ' BP'}`, () => levelUp(t), '닫기', null, d.img);
  else panel(d.name, txt, '닫기', null, null, null, d.img);
}
// 출격 카드: 위 5칸 = 출격 순서, 아래 = 보유 카드(남은 수량)
function deck() {
  const seen = new Set(), used = U.deck.map(id => U.inv.find(c => c.id === id)).filter(c => c && !seen.has(c.type) && seen.add(c.type));
  U.deck = used.map(c => c.id);
  $('deck-cnt').textContent = `${used.length}/5`;
  const cur = myItem(); // 아이템 장착
  $('item-bar').innerHTML = '<span>아이템</span>' + ITEM_LIST.map(([k, label]) => `<button class="ichip${cur === k ? ' on' : ''}${hasItem(U, k) ? '' : ' locked'}" data-item="${k}">${label}${hasItem(U, k) ? '' : ' 🔒'}</button>`).join('');
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
// 등급별 뽑기 확률(%) — 합계 100
const RATES = { kimul: 58.7, rare: 25, sr: 10, usr: 6, minjun: 0.3 }; // 티원~는 관리자 전용 (뽑기 없음)
const poolOf = r => Object.keys(CARDS).filter(k => !CARDS[k].tutorial && !CARDS[k].variant && !CARDS[k].retired && !RARITY[CARDS[k].rarity].adminOnly && CARDS[k].rarity === r);
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
  $('g-tiers').innerHTML = '<em>낮음</em>' + Object.values(RARITY).filter(r => !r.adminOnly).sort((a, b) => a.rank - b.rank).map(r => `<span style="background:${r.color}">${r.name}</span>`).join('<i>›</i>') + '<em>높음</em>';
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
