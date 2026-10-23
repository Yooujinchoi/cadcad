/* 전투 엔진 + 튜토리얼 (계정/메뉴는 app.js) */
const $ = id => document.getElementById(id);
const GW_MS = 7000, GW_MULT = 0.6; // 치감: 7초 동안 상대 회복 40% 감소
const SHIELD_MS = 1200, SWAP_MS = 2500, HEAL_AMT = 150, HEAL_USES = 2, HEAL_CD = 20000; // 힐: 150 회복, 한 판에 2번, 재사용 20초

// 프로필 사진(128px JPEG data URL)만 허용 → 다른 사람이 보낸 값도 안전하게 표시
const safePhoto = p => typeof p === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]{20,60000}$/.test(p) ? p : '';
const avHtml = (p, cls = '') => { const s = safePhoto(p); return `<span class="av ${cls}">${s ? `<img src="${s}" alt="">` : '🧑'}</span>`; };

// 등급(낮음→높음): 김울급 < 레어 < 슈퍼레어 < 울트라 슈퍼 레어 < 민준급 < 티원~
const RARITY = {
  kimul: { name: '김울급', color: '#9aa5a5', rank: 0, refund: 50, up: 30 },
  rare: { name: '레어', color: '#5aa9ff', rank: 2, refund: 150, up: 90 },
  sr: { name: '슈퍼레어', color: '#c07bff', rank: 3, refund: 300, up: 180 },
  usr: { name: '울트라 슈퍼 레어', color: '#ff5c8a', rank: 4, refund: 800, up: 360 },
  minjun: { name: '민준급', color: '#ff9f3d', rank: 5, refund: 2000, up: 750 },
  t1: { name: '티원~', color: '#ff3b3b', rank: 6, refund: 5000, up: 1500, adminOnly: true }, // 관리자 전용: 뽑기·등급 안내에 안 나옴
};
// 스킬포인트: 평타 1회당 쌓이는 양(gain)은 카드마다 다름, 스킬은 cost 필요
const CARDS = {
  kimul: { name: '평범한 김울', img: 'kimul.jpg', rarity: 'kimul', hp: 100,
    basic: { name: '평타', dmg: 5, cd: 500, gain: 5 },
    skill: { name: '째려보기', dmg: 40, cd: 800, cost: 100, hold: 450 } },
  yongsa: { name: '용사 김울', img: 'yongsa.jpg', rarity: 'sr', hp: 700,
    basic: { name: '평타', dmg: 40, cd: 900, gain: 8 }, // 묵직한 평타: 40 데미지 · 0.9초마다
    skill: { name: '울칼리버', dmg: 210, cd: 800, cost: 100, hold: 450 } },
  angry: { name: '개씹빡친김울', img: 'angry.jpg', rarity: 'minjun', hp: 1300,
    basic: { name: '평타', dmg: 35, cd: 500, gain: 6 },
    skill: { name: '분노광선', dmg: 300, cd: 800, cost: 100, hold: 450 },
    skill2: { name: '지랄하기', dmg: 5, cd: 500, cost: 50, poison: { sec: 6 } } }, // 스킬 2개: 둘 중 하나를 쓰면 스킬포인트 전부 소모. 지랄하기 = 독 5 × 6초
  nature: { name: '자연인 김승현', img: 'nature.jpg', rarity: 'rare', hp: 650, // 탱커
    basic: { name: '평타', dmg: 4, cd: 700, gain: 7 },
    skill: { name: '정글카이팅', dmg: 60, cd: 800, cost: 80, hold: 450 } },
  ltake: { name: 'L을 가져가는 김울', img: 'ltake.jpg', rarity: 'usr', hp: 1000,
    basic: { name: '평타', dmg: 18, cd: 350, gain: 5 }, // 지속딜: 약한 평타를 빠르게
    skill: { name: '애 가지고 튀기', dmg: 170, cd: 800, cost: 50, hold: 450 } },
  soyul: { name: '평범한 소율', img: 'soyul.jpg', rarity: 'kimul', hp: 120,
    basic: { name: '평타', dmg: 6, cd: 500, gain: 5 },
    skill: { name: '멘탈공격', dmg: 40, cd: 800, cost: 100, hold: 450 } },
  jeonghun: { name: '평범한 정훈', img: 'jeonghun.jpg', rarity: 'kimul', hp: 110, // 평범한 김울과 평범한 소율 사이
    basic: { name: '평타', dmg: 5.5, cd: 500, gain: 5 },
    skill: { name: '꺼지시라~', dmg: 40, cd: 800, cost: 100, hold: 450 } },
  sangyeop: { name: '평범한 상엽', img: 'sangyeop.jpg', rarity: 'kimul', hp: 110, // 평범한 정훈과 능력치 같음
    basic: { name: '평타', dmg: 5.5, cd: 500, gain: 5 },
    skill: { name: '김울급 행동', dmg: 40, cd: 800, cost: 100, hold: 450 } },
  handsome: { name: '잘생긴척하는김울', img: 'handsome.jpg', rarity: 'minjun', hp: 1300,
    basic: { name: '평타', dmg: 15, cd: 150, gain: 5 },
    skill: { name: '머니머니머니', dmg: 70, cd: 800, cost: 100, hold: 450, vamp: { ms: 7000 } } }, // 70 데미지 + 7초 동안 평타 피흡 (잃은 체력 비율만큼)
  gabeorin: { name: '가버린용상엽', img: 'gabeorin.jpg', rarity: 'usr', hp: 700,
    basic: { name: '평타', dmg: 22, cd: 500, gain: 8 }, // 한방딜: 스킬 위주
    skill: { name: '꿈나라여행', dmg: 280, cd: 800, cost: 100, hold: 450, heal: 60 } }, // 스킬 사용 시 체력 60 회복
  lolboy: { name: '롤대남 서호', img: 'lolboy.jpg', rarity: 'usr', hp: 900,
    basic: { name: '평타', dmg: 20, cd: 500, gain: 8 },
    skill: { name: '진혼곡', dmg: 210, cd: 800, cost: 100, hold: 450, requiem: { bench: 110 } } }, // 지금 카드 210, 대기 카드 110 (방어막으로 막으면 전부 무효)
  seoho: { name: '낚시꾼 서호', img: 'seoho.jpg', rarity: 'sr', hp: 500,
    basic: { name: '평타', dmg: 20, cd: 500, gain: 9 },
    skill: { name: '월척이다', dmg: 170, cd: 800, cost: 90, hold: 450, drain: 10 } }, // 맞히면 상대 스킬포인트 -10 (상대가 스킬 준비 중이면 무효)
  furry: { name: '퍼리민준', img: 'furry.jpg', rarity: 'sr', hp: 500,
    basic: { name: '평타', dmg: 19, cd: 500, gain: 6.5, lifeHit: 4, rage: { at: 0.5, cd: 350 } }, // 때릴 때마다 체력 +4, 체력 50% 이하면 0.35초마다
    skill: { name: '물어 뜯기', dmg: 140, cd: 800, cost: 80, hold: 450, heal: 60 } },
  lovebug: { name: '러브버그', img: 'lovebug.jpg', rarity: 'sr', hp: 1100,
    basic: { name: '평타', dmg: 15, cd: 500, gain: 8 },
    skill: { name: '커플공격', dmg: 150, cd: 800, cost: 100, hold: 450, barrier: { amt: 60, step: 5 } } }, // 보호막: 다 사라진 뒤에만 새로 생기고, 생길 때마다 5씩 줄어듦 (60 → 55 → 50 …)
  dark: { name: '어둠의 인도자 김민준', img: 'dark.jpg?v=2', rarity: 't1', hp: 1600, retired: true, // 회수됨: 뽑기에서 안 나옴 (관리자만 보유)
    basic: { name: '평타', dmg: 40, cd: 400, gain: 10 },
    skill: { name: '그 긴거', dmg: 450, cd: 800, cost: 100, hold: 450, barrier: { amt: 200, step: 0 } }, // 보호막 200: 다 사라진 뒤에만 다시 생김 (크기 그대로)
    lastStand: { name: '최후의 일격', at: 0.1, dmg: 600 } }, // 체력 10% 이하가 되면 자동으로 600 (한 판에 한 번)
  eater: { name: '잘처먹는 김민준', img: 'eater.jpg', rarity: 'minjun', hp: 1600,
    basic: { name: '평타', dmg: 27, cd: 600, gain: 8 },
    skill: { name: '네가 사는 거라면 나도 끼지~', dmg: 120, steal: true, cd: 800, cost: 100, hold: 450 } }, // 120 데미지, 준 만큼 체력 흡수
  heukyeom: { name: '흑염룡 김울', img: 'heukyeom.jpg', rarity: 'usr', hp: 950,
    basic: { name: '평타', dmg: 41, cd: 750, gain: 10 },
    skill: { name: '저주', dmg: 0, cd: 800, cost: 100, hold: 450, curse: { ms: 6500, mult: 1.2 } } }, // 6.5초 동안 상대가 받는 피해 1.2배, 그동안 스킬포인트 안 쌓임
  // 버프 스킬: 데미지 대신 3초 동안 평타가 20 데미지 · 0.2초마다로 바뀜
  shinan: { name: '신난 김울', img: 'shinan.jpg', rarity: 'rare', hp: 350,
    basic: { name: '평타', dmg: 14, cd: 800, gain: 6.5 },
    skill: { name: '신난다', dmg: 0, cd: 300, cost: 80, hold: 450, buff: { ms: 3000, dmg: 20, cd: 200 } } },
};
// 튜토리얼 전용 평범한 김울(버프): 평타 7, 스킬포인트 +10. 컬렉션·뽑기·관리자 지급에는 안 나옴
CARDS.kimul_tut = { ...CARDS.kimul, tutorial: true, basic: { ...CARDS.kimul.basic, dmg: 7, gain: 10 } };
const rar = t => RARITY[CARDS[t].rarity];

// ── 레벨: 같은 카드는 한 장만 보유하고, 중복은 레벨업. 레벨당 체력·평타·스킬 +1% (Lv.20 = 1.19배)
//    → 최대 레벨이어도 한 등급 위 카드의 Lv.1을 넘지 않도록 맞춤. 레벨업 비용 = 등급별 up × 현재 레벨 (BP)
const LV_MAX = 20, LV_STEP = 0.01;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function ensureCard(key) { // 'yongsa@3' 같은 레벨 카드를 필요할 때 만들어 둠 (상대가 보낸 값도 안전하게 처리)
  key = String(key || 'kimul');
  if (own(CARDS, key)) return key;
  const [t, l] = key.split('@'), b = own(CARDS, t) && !CARDS[t].variant ? CARDS[t] : null;
  if (!b || l === undefined) return 'kimul';
  const lv = Math.min(LV_MAX, Math.max(1, Math.floor(+l) || 1)), m = 1 + LV_STEP * (lv - 1), r = x => Number.isInteger(x) ? Math.round(x * m) : Math.round(x * m * 10) / 10; // 5.5처럼 소수인 값은 소수 첫째 자리까지
  const s = { ...b.skill, dmg: r(b.skill.dmg) };
  if (b.skill.heal) s.heal = r(b.skill.heal);
  if (b.skill.buff) s.buff = { ...b.skill.buff, dmg: r(b.skill.buff.dmg) };
  if (b.skill.range) s.range = b.skill.range.map(r);
  if (b.skill.requiem) s.requiem = { ...b.skill.requiem, bench: r(b.skill.requiem.bench) };
  if (b.skill.barrier) s.barrier = { ...b.skill.barrier, amt: r(b.skill.barrier.amt) };
  CARDS[key] = { ...b, ...(b.lastStand ? { lastStand: { ...b.lastStand, dmg: r(b.lastStand.dmg) } } : {}), variant: true, lv, hp: r(b.hp), basic: { ...b.basic, dmg: r(b.basic.dmg), ...(b.basic.lifeHit ? { lifeHit: r(b.basic.lifeHit) } : {}) }, skill: s, ...(b.skill2 ? { skill2: { ...b.skill2, dmg: r(b.skill2.dmg) } } : {}) };
  return key;
}
const lvKey = (t, lv) => lv > 1 ? ensureCard(`${t}@${lv}`) : t;
// 버프 스킬 효과 중에는 평타가 바뀌고, 스킬포인트는 쌓이지 않음 (무한 연속 사용 방지)
const buffOn = c => c.buffUntil > performance.now();
// 분노(퍼리민준): 체력이 일정 비율 이하로 내려가면 평타 속도가 빨라짐
const rageOn = c => { const d = CARDS[c.type]; return !!d.basic.rage && c.hp > 0 && c.hp <= d.hp * d.basic.rage.at; };
const basicOf = c => {
  const d = CARDS[c.type], b = d.skill.buff;
  if (b && buffOn(c)) return { ...d.basic, dmg: b.dmg, cd: b.cd, gain: 0 };
  const r = rageOn(c) ? { ...d.basic, cd: d.basic.rage.cd } : d.basic;
  return c.noGainUntil > performance.now() ? { ...r, gain: 0 } : r; // 저주를 건 동안은 스킬포인트 안 쌓임
};
const basicDesc = d => `데미지 ${d.basic.dmg} · ${d.basic.cd / 1000}초마다${d.basic.lifeHit ? ` · 때릴 때마다 체력 +${d.basic.lifeHit}` : ''}${d.basic.rage ? ` · 체력 ${d.basic.rage.at * 100}% 이하면 ${d.basic.rage.cd / 1000}초마다` : ''}`;
const skillDesc = d => d.skill.curse ? `${d.skill.curse.ms / 1000}초 동안 상대가 받는 피해 ${d.skill.curse.mult}배 (그동안 스킬포인트 안 쌓임)` : d.skill.buff ? `${d.skill.buff.ms / 1000}초 동안 평타 ${d.skill.buff.dmg} · ${d.skill.buff.cd / 1000}초마다` : `데미지 ${d.skill.range ? d.skill.range.join('~') : d.skill.dmg}${d.skill.requiem ? ` · 상대 대기 카드에는 ${d.skill.requiem.bench} (방어막으로 막으면 전부 무효)` : ''}${d.skill.steal ? ' · 준 만큼 체력 흡수' : ''}${d.skill.vamp ? ` · ${d.skill.vamp.ms / 1000}초 동안 평타 피흡 (잃은 체력이 많을수록 많이 회복)` : ''}${d.skill.heal ? ` · 체력 ${d.skill.heal} 회복` : ''}${d.skill.drain ? ` · 상대 스킬포인트 -${d.skill.drain}` : ''}${d.skill.barrier ? ` · 보호막 ${d.skill.barrier.amt} (보호막이 다 사라진 뒤에만 새로 생겨요${d.skill.barrier.step ? `, 생길 때마다 ${d.skill.barrier.step}씩 줄어요` : ''})` : ''}`;

// 튜토리얼 훈련봇: 평타 1회당 스킬포인트 +5 (100 필요)
const TUT_BOT = { dmg: 3, gap: 800, gain: 5, sdmg: 25, windup: 1000, shield: 0 };
const TUTORIAL = [
  { bot: 30, deal: true, deck: ['kimul_tut'],
    intro: '이 게임은 카드를 뽑아 상대방을 조지는 게임입니다.\n처음에는 기본카드인 평범한 김울 카드를 지급해드립니다.\n공격방법은 카드를 누르면 상대방에게 기본공격이 나갑니다.',
    hint: n => `${n}님, 카드를 눌러 기본공격을 해보세요!`, after: '좋아요! 계속 눌러서 처치하세요.' },
  { bot: 200, skill: true, deck: ['kimul_tut'],
    intro: '이제 기본공격이 아닌 스킬을 사용해 봅시다.\n카드를 꾹 눌러 스킬을 사용해보세요.',
    hint: () => '평타를 쳐서 스킬 게이지를 채우세요!' },
  { bot: 300, skill: true, atk: true, shield: true, deck: ['kimul_tut', 'kimul_tut'], deal: true,
    intro: '이 게임은 포켓몬고 형식의 전투방식을 가지고 있습니다.\n훈련봇과 전투하여 승리를 가져오세요.\n방어막을 적절히 활용하세요.',
    hint: () => '카드가 2장 지급됐어요! 방어막으로 스킬을 막고, 작은 카드를 눌러 교체할 수 있어요.' },
];

const S = { tok: 0, cfg: null, p: TUT_BOT, ready: false, busy: false, bot: null, cards: [], cur: 0, shields: 0, shieldUntil: 0, swapUntil: 0 };
const card = $('card'), hint = $('hint');
const cd = () => CARDS[S.cards[S.cur].type];

const show = id => document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id);
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const say = m => { hint.textContent = m; };
const pct = (a, b) => (a / b * 100) + '%';
const later = (fn, ms) => { const t = S.tok; setTimeout(() => { if (t === S.tok && S.ready) fn(); }, ms); };

function panel(title, text, ok, onOk, sub, onSub, img) {
  $('p-in').hidden = true;
  $('p-title').textContent = title;
  $('p-text').textContent = text;
  $('p-img').hidden = !img; if (img) $('p-img').src = img;
  $('p-ok').textContent = ok;
  $('p-ok').onclick = () => { $('over').hidden = true; onOk && onOk(); };
  const b = $('p-sub');
  b.hidden = !sub;
  if (sub) { b.textContent = sub; b.onclick = () => { $('over').hidden = true; onSub && onSub(); }; }
  $('over').hidden = false;
}

function tutorial(i) {
  if (i >= TUTORIAL.length) return tutorialDone();
  battle({ ...TUTORIAL[i], who: U.name, tag: `튜토리얼 ${i + 1}/${TUTORIAL.length}`, botName: '대충 훈련봇', p: TUT_BOT,
    title: `튜토리얼 ${i + 1}단계`,
    win: () => tutorial(i + 1),
    lose: () => panel('패배', '카드가 모두 쓰러졌어요.\n방어막을 활용해서 다시 도전해 보세요.', '다시 도전', () => tutorial(i)) });
}

/* ── 화면 갱신 ── */
function renderBot() {
  const b = S.bot;
  if (S.cfg && S.cfg.dummy) { // 연습용 훈련봇: 체력 무한, 누적·초당 데미지 표시
    const sec = S.dmgStart ? (performance.now() - S.dmgStart) / 1000 : 0;
    $('hpf').style.width = '100%'; $('hps').style.width = '0';
    $('hpt').textContent = `∞ · 누적 데미지 ${S.dmgTotal.toLocaleString('en-US')}`;
    $('bname').textContent = `훈련봇 · 초당 데미지 ${sec >= 1 ? (S.dmgTotal / sec).toFixed(1) : '-'}`;
    return;
  }
  const bar = b.bar || 0, tot = Math.max(b.max, b.hp + bar); // 상대 보호막(멀티)
  $('hpf').style.width = pct(b.hp, tot); $('hps').style.left = pct(b.hp, tot); $('hps').style.width = pct(bar, tot);
  $('hpt').textContent = `${b.hp} / ${b.max}${bar ? ` (+${bar})` : ''}`;
  $('bspf').style.width = pct(b.en, b.cost);
  $('bspt').textContent = `스킬 ${b.en} / ${b.cost}`;
  $('bsp').classList.toggle('full', b.en >= b.cost);
}
function renderPlayer() {
  const c = S.cards[S.cur], d = CARDS[c.type];
  card.style.setProperty('--rc', rar(c.type).color);
  if (!$('cimg').src.endsWith(d.img)) $('cimg').src = d.img;
  $('n1').textContent = d.basic.name; $('d1').textContent = basicOf(c).dmg; $('active').classList.toggle('buffed', buffOn(c)); $('active').classList.toggle('vamp', vampOn(c));
  const rg = rageOn(c); $('active').classList.toggle('rage', rg);
  if (rg && !c.raged && S.ready) say('체력이 절반 이하! 공격 속도가 빨라졌어요!');
  c.raged = rg;
  $('n2').textContent = d.skill.name; $('d2').textContent = d.skill.curse ? '×' + d.skill.curse.mult : d.skill.buff ? '⚡' : d.skill.range ? d.skill.range.join('~') : d.skill.dmg; $('d2').classList.toggle('wide', !!(d.skill.range || d.skill.curse));
  const s2 = d.skill2, b2 = $('sk2btn'); // 두 번째 스킬 버튼 (개씹빡친김울)
  b2.hidden = !s2 || !S.cfg.skill;
  if (s2) { b2.classList.toggle('ready', c.en >= s2.cost); $('sk2c').textContent = s2.cost; }
  const bar = c.barrier || 0, tot = Math.max(d.hp, c.hp + bar);
  $('chf').style.width = pct(c.hp, tot); $('chs').style.left = pct(c.hp, tot); $('chs').style.width = pct(bar, tot);
  $('cht').textContent = `HP ${c.hp} / ${d.hp}${bar ? ` (+${bar})` : ''}`;
  $('pspf').style.width = c.en + '%';
  $('pspt').textContent = `스킬 ${c.en} / ${d.skill.cost}`;
  $('psp').classList.toggle('full', c.en >= d.skill.cost);
  $('bench').innerHTML = S.cards.map((x, i) => i === S.cur ? '' :
    `<div class="mini${x.hp <= 0 ? ' dead' : ''}" data-i="${i}" style="--rc:${rar(x.type).color}" role="button" aria-label="카드 교체"><img src="${CARDS[x.type].img}" alt=""><div class="hp"><div style="width:${pct(x.hp, CARDS[x.type].hp)}"></div></div></div>`).join('');
  if (S.cfg.sync) S.cfg.sync();
}
const ITEM_ICON = { heal: '✚', gw: '⊘', cleanse: '✦' }; // 방어막은 방패 그림
function renderShield() {
  const b = $('shield'), it = S.item;
  $('shn').textContent = S.shields; b.disabled = S.shields <= 0;
  ['heal', 'gw', 'cleanse'].forEach(k => b.classList.toggle(k, it === k));
  b.classList.toggle('alt', it !== 'shield');
  b.querySelector('.ico-heal').textContent = ITEM_ICON[it] || '';
  b.classList.toggle('cool', it === 'heal' && performance.now() < S.healAt);
  b.setAttribute('aria-label', { heal: '힐', shield: '방어막', gw: '치감', cleanse: '정화' }[it]);
}

function floatTxt(parent, text, cls) {
  const d = document.createElement('span');
  d.className = cls; d.textContent = text;
  parent.appendChild(d);
  d.addEventListener('animationend', () => d.remove());
}
function fly(from, to, cls, scale, dur, cb) {
  const t = S.tok, mid = r => [r.left + r.width / 2 - 16, r.top + r.height / 2 - 16];
  const [x1, y1] = mid(from.getBoundingClientRect()), [x2, y2] = mid(to.getBoundingClientRect());
  const o = document.createElement('div');
  o.className = cls; document.body.appendChild(o);
  o.animate([{ transform: `translate(${x1}px,${y1}px) scale(.6)` }, { transform: `translate(${x2}px,${y2}px) scale(${scale})` }],
    { duration: dur, easing: 'cubic-bezier(.5,0,.8,.6)' }).onfinish = () => { o.remove(); if (t === S.tok) cb(); };
}

/* ── 전투 시작 ── */
function battle(cfg) {
  S.tok++;
  const types = (cfg.deck || ['kimul']).map(ensureCard);
  Object.assign(S, { cfg, p: cfg.p, ready: false, busy: false, cur: 0, shields: 3, shieldUntil: 0, swapUntil: 0, item: cfg.item || 'shield', myBlk: 0, dmgTotal: 0, dmgStart: 0,
    bot: { hp: cfg.bot, max: cfg.bot, en: 0, sh: 3, cost: cfg.p.cost || 100 },
    cards: types.map(t => ({ type: t, hp: CARDS[t].hp, en: 0 })) });
  S.shields = { heal: HEAL_USES, shield: 3, gw: 2, cleanse: 2 }[S.item] || 3;
  S.gwUntil = 0; S.curseUntil = 0; S.poisonUntil = 0; S.poisonGen = (S.poisonGen || 0) + 1;
  S.healAt = 0;
  $('who').textContent = cfg.who;
  $('stg').textContent = cfg.tag;
  $('bname').textContent = cfg.botName;
  $('enemy').classList.toggle('pvp', !!cfg.foe); // 멀티: 상대 카드 + 상대 프로필 배치
  $('bot').style.backgroundImage = cfg.foe ? `url(${CARDS[ensureCard(cfg.foe.deck[0])].img})` : '';
  $('bav').hidden = !cfg.foe;
  if (cfg.foe) $('bav').innerHTML = avHtml(cfg.foe.photo, 'lg');
  $('quit').hidden = !cfg.quit;
  $('sk').hidden = $('psp').hidden = !cfg.skill;
  $('bsp').hidden = !cfg.atk;
  $('shield').parentElement.style.visibility = cfg.shield ? '' : 'hidden';
  $('bench').hidden = types.length < 2;
  cd_reset();
  $('bot').className = 'bot'; $('active').className = 'active';
  hint.className = 'hint'; say('');
  card.className = cfg.deal ? 'card away' : 'card';
  renderBot(); renderPlayer(); renderShield();
  show('s-game');
  const t = S.tok;
  cfg.intro ? panel(cfg.title, cfg.intro, '시작하기', () => begin(cfg))
    : cfg.delay ? (say('3초 뒤에 시작해요! 준비하세요.'), setTimeout(() => { if (S.tok === t) begin(cfg); }, cfg.delay))
    : begin(cfg);
}
function cd_reset() { $('cd').style.transition = 'none'; $('cd').style.transform = 'scaleY(0)'; }

function begin(cfg) {
  S.ready = true;
  say(cfg.hint(cfg.who));
  if (cfg.deal) {
    card.className = 'card deal';
    card.addEventListener('animationend', () => { if (!S.busy) card.className = 'card pulse'; }, { once: true });
  } else card.className = 'card pulse';
  if (cfg.atk) later(botAct, 1000);
}

function end(win) {
  S.ready = false;
  const cfg = S.cfg;
  setTimeout(() => { if (S.cfg === cfg) cfg[win ? 'win' : 'lose'](); }, win ? 1100 : 700);
}

$('quit').addEventListener('click', () => panel('전투 나가기', '전투를 포기하고 메뉴로 돌아갈까요?', '계속 싸우기', null, '나가기', () => { S.tok++; S.ready = false; (S.cfg.exit || menu)(); }));

/* ── 훈련봇/AI/상대 플레이어 공격 ── */
function foeBasic(d) {
  const el = $('bot');
  restart(el, 'lunge'); setTimeout(() => el.classList.remove('lunge'), 260);
  fly(el, card, 'orb bad', 1.2, 320, () => hurtPlayer(d, false));
}
function foeSkill(d, windup, done, drain, psn) {
  const el = $('bot');
  el.classList.add('windup');
  say(S.cfg.shield && S.item === 'shield' ? '스킬을 준비 중! 방어막을 펼치세요!' : '상대가 스킬을 준비 중이에요!');
  later(() => {
    el.classList.remove('windup');
    fly(el, card, 'orb bad eye', 2.2, 300, () => {
      if (performance.now() < S.shieldUntil) { S.myBlk++; floatTxt($('active'), '방어!', 'dmg me blk'); say('방어 성공!'); navigator.vibrate?.(15); renderPlayer(); }
      else if (psn) poisonMe(d, psn);
      else { if (drain) drainMe(drain); hurtPlayer(d, true); say('스킬에 맞았어요!'); }
    });
    if (done) done();
  }, windup);
}
function foeAttack(e) {
  if (!S.ready) return;
  if (e.k === 'requiem') return foeRequiem(e.d, e.x);
  if (e.k === 'curse') return foeCurse(e.d, e.x);
  if (e.k === 'gw') return foeGW(e.x);
  if (e.k === 'poison') foeSkill(e.d, S.p.windup, null, 0, e.x);
  else if (e.k === 'skill') foeSkill(e.d, S.p.windup, null, e.x);
  else foeBasic(e.d);
}
function botAct() {
  const b = S.bot;
  if (b.en >= b.cost) return foeSkill(S.p.sdmg, S.p.windup, () => { S.bot.en = 0; renderBot(); later(botAct, S.p.gap); });
  b.en = Math.min(b.cost, b.en + S.p.gain); renderBot();
  foeBasic(S.p.dmg);
  later(botAct, S.p.gap);
}
function hurtPlayer(d, big) {
  if (!S.ready) return;
  const c = S.cards[S.cur];
  if (performance.now() < S.curseUntil) d = Math.round(d * (S.curseMult || 1.2)); // 저주: 받는 피해 증가
  let left = d;
  if (c.barrier > 0) { const ab = Math.min(c.barrier, left); c.barrier -= ab; left -= ab; } // 보호막이 먼저 막음
  c.hp = Math.max(0, c.hp - left);
  const ls = CARDS[c.type].lastStand;
  if (ls && !c.lastUsed && c.hp <= CARDS[c.type].hp * ls.at) lastStand(c, ls);
  restart($('active'), 'hurt');
  navigator.vibrate?.(big ? [40, 30, 60] : 15);
  floatTxt($('active'), '-' + d, left ? (big ? 'dmg crit me' : 'dmg me') : 'dmg me barrier');
  if (c.hp <= 0) {
    const next = S.cards.findIndex(x => x.hp > 0);
    if (next < 0) { renderPlayer(); if (S.cfg.dead) S.cfg.dead(); return end(false); }
    S.cur = next; stopPress();
    say('카드가 쓰러졌어요! 다음 카드가 나옵니다.');
    card.className = 'card deal';
  }
  renderPlayer();
}

/* ── 입력: 탭 = 평타, 꾹 = 스킬, 방어막, 교체 ── */
let timer, pressing = false, held = false;
const stopPress = () => { clearTimeout(timer); pressing = false; card.classList.remove('charging'); };
const full = () => S.cfg.skill && S.cards[S.cur].en >= cd().skill.cost;

card.addEventListener('pointerdown', () => {
  if (!S.ready || S.busy) return;
  pressing = true; held = false;
  if (full()) {
    card.classList.add('charging');
    timer = setTimeout(() => { held = true; pressing = false; attack('skill'); }, cd().skill.hold);
  }
});
card.addEventListener('pointerup', () => { const tap = pressing && !held; stopPress(); held = false; if (tap) onTap(); });
card.addEventListener('pointerleave', stopPress);
card.addEventListener('pointercancel', stopPress);
card.addEventListener('contextmenu', e => e.preventDefault());
card.addEventListener('click', e => { if (e.detail === 0) onTap(); });

function onTap() {
  if (!S.ready || S.busy) return;
  if (full()) { say('게이지가 가득 찼어요! 카드를 꾹 눌러 스킬을 사용하세요!'); restart(hint, 'nudge'); }
  attack('basic');
}

$('shield').addEventListener('click', () => {
  if (S.item === 'gw') { // 치감: 멀티에서 상대 회복 40% 감소 7초
    if (!S.ready || S.shields <= 0) return;
    if (!S.cfg.pvp) return say('봇은 회복하지 않아서 치감은 멀티에서 써요.');
    S.shields--; renderShield(); S.cfg.pvp.send('gw', 0, GW_MS / 1000);
    floatTxt($('enemy'), '치유 감소', 'dmg sp'); say(`치감! ${GW_MS / 1000}초 동안 상대 회복 40% 감소`);
    return;
  }
  if (S.item === 'cleanse') { // 정화: 내 카드의 나쁜 효과 즉시 제거
    if (!S.ready || S.shields <= 0) return;
    const now = performance.now();
    if (!(now < S.gwUntil || now < S.curseUntil || now < S.poisonUntil)) return say('없앨 나쁜 효과가 없어요.');
    S.shields--; S.gwUntil = 0; S.curseUntil = 0; S.poisonUntil = 0; S.poisonGen++;
    $('active').classList.remove('cursed', 'gwd');
    floatTxt($('active'), '정화!', 'dmg me buff'); say('정화! 나쁜 효과가 모두 사라졌어요.'); renderShield();
    return;
  }
  if (S.item === 'heal') { // 힐 아이템: 150 회복, 한 판에 2번, 재사용 20초
    if (!S.ready || S.shields <= 0) return;
    const now = performance.now();
    if (now < S.healAt) return say(`힐 재사용까지 ${Math.ceil((S.healAt - now) / 1000)}초 남았어요.`);
    const c = S.cards[S.cur], max = CARDS[c.type].hp;
    if (c.hp >= max) return say('체력이 가득 차 있어요.');
    S.shields--; S.healAt = now + HEAL_CD; heal(c, HEAL_AMT); say(`힐! 체력 +${HEAL_AMT}`); renderShield();
    const t = S.tok; setTimeout(() => { if (S.tok === t) renderShield(); }, HEAL_CD + 50);
    return;
  }
  const now = performance.now();
  if (!S.ready || S.shields <= 0 || now < S.shieldUntil) return;
  S.shields--; S.shieldUntil = now + SHIELD_MS;
  $('active').classList.add('shielded');
  setTimeout(() => $('active').classList.remove('shielded'), SHIELD_MS);
  renderShield();
});

$('bench').addEventListener('click', e => {
  const b = e.target.closest('[data-i]');
  if (!b || !S.ready) return;
  const i = +b.dataset.i;
  if (S.cards[i].hp <= 0) return say('쓰러진 카드는 교체할 수 없어요.');
  if (performance.now() < S.swapUntil) return say('교체 쿨타임 중이에요!');
  S.cur = i; S.swapUntil = performance.now() + SWAP_MS; stopPress();
  card.className = 'card deal'; say('카드를 교체했어요!');
  renderPlayer();
});

function attack(kind) {
  if (!S.ready || S.busy) return;
  const c = S.cards[S.cur], big = kind !== 'basic';
  let a = kind === 'basic' ? basicOf(c) : CARDS[c.type][kind];
  if (!a) return;
  if (big) { if (c.en < a.cost) return; c.en = 0; renderPlayer(); } // 스킬을 쓰면 스킬포인트 전부 소모
  if (a.range) a = { ...a, dmg: a.range[0] + Math.floor(Math.random() * (a.range[1] - a.range[0] + 1)) };
  if (big && a.buff) return startBuff(c, a);
  if (big && a.heal) heal(c, a.heal);
  if (big && a.barrier) grantBarrier(c, a.barrier);
  if (big && a.vamp) startVamp(c, a);
  if (big && a.requiem) return castRequiem(c, a);
  if (big && a.curse) return castCurse(c, a);
  S.busy = true;
  card.className = 'card'; void card.offsetWidth; card.className = 'card cast';

  const el = $('cd');
  el.style.transition = 'none'; el.style.transform = 'scaleY(1)'; void el.offsetHeight;
  el.style.transition = `transform ${a.cd}ms linear`; el.style.transform = 'scaleY(0)';
  later(() => { S.busy = false; }, a.cd);

  if (S.cfg.pvp) { // 멀티: 공격 신호만 보내고, 결과는 상대 화면에서 계산
    S.cfg.pvp.send(a.poison ? 'poison' : big ? 'skill' : 'basic', a.dmg, a.poison ? a.poison.sec : (a.drain || 0));
    if (a.steal) heal(c, a.dmg);
    if (!big && a.lifeHit) heal(c, a.lifeHit);
    if (!big && vampOn(c)) heal(c, vampAmt(c, a.dmg));
    if (!big && S.cfg.skill) {
      const cost = CARDS[c.type].skill.cost, was = c.en;
      c.en = Math.min(cost, c.en + a.gain);
      if (c.en >= cost && was < cost) say('스킬 게이지 완료! 카드를 꾹 눌러 스킬을 사용하세요!');
      renderPlayer();
    }
    return fly(card, $('bot'), big ? 'orb eye' : 'orb', big ? 2.6 : 1.5, big ? 460 : 380, () => {});
  }
  const b = S.bot;
  let blocked = false;
  if (big && b.sh > 0 && Math.random() < S.p.shield) {
    blocked = true; b.sh--;
    $('bot').classList.add('shielded'); setTimeout(() => $('bot').classList.remove('shielded'), SHIELD_MS);
  }
  fly(card, $('bot'), big ? 'orb eye' : 'orb', big ? 2.6 : 1.5, big ? 460 : 380, () => hit(a, big, c, blocked));
}

function heal(c, n) { // 체력 회복 (최대 체력까지)
  if (performance.now() < S.gwUntil) n = Math.round(n * GW_MULT); // 치감
  const got = Math.min(n, CARDS[c.type].hp - c.hp);
  if (got <= 0) return;
  c.hp += got;
  floatTxt($('active'), '+' + got, 'dmg me heal');
  renderPlayer();
}

// 스킬포인트 깎기(월척이다). 스킬 준비 중(봇: 스킬 예고 중 / 플레이어: 카드를 꾹 누르는 중)이면 무효
function drainBot(n) {
  const b = S.bot;
  if ($('bot').classList.contains('windup')) return say('상대가 스킬 준비 중이라 스킬포인트를 못 깎았어요.');
  if (!b.en) return;
  b.en = Math.max(0, b.en - n);
  floatTxt($('enemy'), `스킬포인트 -${n}`, 'dmg sp');
  renderBot();
}
function drainMe(n) {
  const c = S.cards[S.cur];
  if (!S.ready || !c || card.classList.contains('charging') || !c.en) return;
  c.en = Math.max(0, c.en - n);
  floatTxt($('active'), `스킬포인트 -${n}`, 'dmg me sp');
  renderPlayer();
}

// 독(지랄하기): 1초마다 데미지, 지속시간 동안 계속 (그동안 스킬포인트는 계속 쌓임)
function poisonBot(a) {
  say(`${a.name}! ${a.poison.sec}초 동안 독 데미지`);
  let n = a.poison.sec;
  const tick = () => { if (n-- <= 0) return; dmgBot(a.dmg); if (S.bot.hp > 0) later(tick, 1000); };
  later(tick, 1000);
}
function dmgBot(d) {
  const b = S.bot;
  if (b.curseUntil > performance.now()) d = Math.round(d * b.curseMult);
  if (S.cfg.dummy) { S.dmgTotal += d; S.dmgStart = S.dmgStart || performance.now(); } else b.hp = Math.max(0, b.hp - d);
  renderBot();
  floatTxt($('enemy'), '-' + d, 'dmg psn');
  if (b.hp <= 0 && S.ready) { $('bot').className = 'bot down'; say('처치했어요!'); end(true); }
}
function poisonMe(d, sec) {
  sec = Math.min(10, Math.max(1, Math.floor(+sec) || 1));
  say('독에 걸렸어요!');
  S.poisonUntil = Math.max(S.poisonUntil || 0, performance.now() + sec * 1000);
  const g = S.poisonGen;
  const tick = () => { if (g !== S.poisonGen || sec-- <= 0) return; hurtPlayer(d, false); later(tick, 1000); };
  later(tick, 1000);
}

$('sk2btn').addEventListener('click', () => {
  if (!S.ready || S.busy) return;
  const c = S.cards[S.cur], s2 = CARDS[c.type].skill2;
  if (!s2) return;
  if (c.en < s2.cost) return say(`${s2.name}: 스킬포인트 ${s2.cost} 이상이면 쓸 수 있어요. (쓰면 스킬포인트 전부 소모)`);
  attack('skill2');
});

function lastStand(c, ls) { // 최후의 일격: 체력이 일정 이하로 떨어지면 자동으로 강한 공격 (한 판에 한 번)
  c.lastUsed = true;
  navigator.vibrate?.([60, 40, 60, 40, 120]);
  floatTxt($('active'), ls.name + '!', 'dmg me buff');
  say(`${ls.name}! 상대에게 ${ls.dmg} 데미지!`);
  if (S.cfg.pvp) { S.cfg.pvp.send('skill', ls.dmg, 0); fly(card, $('bot'), 'orb eye', 3.2, 520, () => {}); return; }
  fly(card, $('bot'), 'orb eye', 3.2, 520, () => hit({ name: ls.name, dmg: ls.dmg }, true, c, false));
}

// 피흡(머니머니머니): 효과 중 평타 데미지 × 잃은 체력 비율만큼 회복 (체력이 적을수록 많이)
const vampOn = c => c.vampUntil > performance.now();
const vampAmt = (c, dmg) => { const max = CARDS[c.type].hp; return Math.round(dmg * Math.max(0, max - c.hp) / max); };
function startVamp(c, a) {
  const t = S.tok;
  c.vampUntil = performance.now() + a.vamp.ms;
  say(`${a.name}! ${a.vamp.ms / 1000}초 동안 평타로 잃은 체력 비율만큼 회복해요!`);
  renderPlayer();
  setTimeout(() => { if (S.tok === t) renderPlayer(); }, a.vamp.ms + 30);
}

// 진혼곡(롤대남 서호): 카서스 궁처럼 잠깐 읊조린 뒤 하늘에서 빛기둥이 상대 카드 전부에 떨어짐
const REQ_MS = 1500;
function veil(on) { $('veil').hidden = !on; }
function pillars(els) {
  navigator.vibrate?.([30, 30, 90]);
  els.forEach(el => {
    if (!el) return;
    const r = el.getBoundingClientRect(), p = document.createElement('div');
    p.className = 'pillar'; p.style.left = r.left + 'px'; p.style.width = r.width + 'px'; p.style.height = r.bottom + 'px';
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  });
}
function castRequiem(c, a) { // 내가 쓸 때
  S.busy = true; later(() => { S.busy = false; }, REQ_MS + a.cd);
  $('active').classList.add('channel'); veil(true);
  say(`${a.name}… 지금 카드 ${a.dmg}, 대기 카드 ${a.requiem.bench}!`);
  if (S.cfg.pvp) S.cfg.pvp.send('requiem', a.dmg, a.requiem.bench);
  later(() => {
    $('active').classList.remove('channel'); veil(false);
    pillars([$('bot')]);
    if (!S.cfg.pvp) hit({ name: a.name, dmg: a.dmg }, true, c, false); // 봇은 카드가 하나라 한 번만
  }, REQ_MS);
}
function foeRequiem(d, bd) { // 상대가 쓸 때 (멀티): 지금 카드 d, 대기 카드 bd
  bd = bd > 0 ? bd : d;
  $('bot').classList.add('windup'); veil(true);
  say(S.item === 'shield' ? '상대가 진혼곡을 부르고 있어요! 방어막을 펼치세요!' : '상대가 진혼곡을 부르고 있어요!');
  later(() => {
    $('bot').classList.remove('windup'); veil(false);
    if (performance.now() < S.shieldUntil) { // 방어막으로 막으면 모든 카드 무효
      S.myBlk++; floatTxt($('active'), '방어!', 'dmg me blk'); say('진혼곡을 막았어요!'); renderPlayer(); return;
    }
    pillars([card, ...document.querySelectorAll('#bench .mini:not(.dead)')]);
    S.cards.forEach((x, i) => { // 대기 카드들 먼저
      if (i === S.cur || x.hp <= 0) return;
      let left = bd;
      if (x.barrier > 0) { const ab = Math.min(x.barrier, left); x.barrier -= ab; left -= ab; }
      x.hp = Math.max(0, x.hp - left);
    });
    hurtPlayer(d, true); // 지금 카드 (쓰러지면 교체, 화면 갱신)
    say('진혼곡에 맞았어요! 대기 카드까지 피해를 입었어요.');
  }, REQ_MS);
}

// 저주(흑염룡 김울): 상대가 받는 피해 증가
function castCurse(c, a) {
  const now = performance.now(), t = S.tok;
  c.noGainUntil = now + a.curse.ms;
  S.busy = true; later(() => { S.busy = false; }, a.cd);
  card.className = 'card'; void card.offsetWidth; card.className = 'card cast';
  say(`${a.name}! ${a.curse.ms / 1000}초 동안 상대가 받는 피해 ${a.curse.mult}배`);
  if (S.cfg.pvp) { S.cfg.pvp.send('curse', Math.round(a.curse.mult * 100), a.curse.ms / 1000); renderPlayer(); return; }
  S.bot.curseUntil = now + a.curse.ms; S.bot.curseMult = a.curse.mult;
  $('bot').classList.add('cursed'); floatTxt($('enemy'), '저주', 'dmg sp');
  setTimeout(() => { if (S.tok === t) $('bot').classList.remove('cursed'); }, a.curse.ms);
  renderPlayer();
}
function foeCurse(m, sec) { // 멀티: 상대가 나에게 저주 (방어막으로 막을 수 있음)
  m = Math.min(2, Math.max(1, (+m || 120) / 100)); sec = Math.min(10, Math.max(1, +sec || 6.5));
  $('bot').classList.add('windup');
  say(S.item === 'shield' ? '상대가 저주를 걸려고 해요! 방어막을 펼치세요!' : '상대가 저주를 걸려고 해요!');
  later(() => {
    $('bot').classList.remove('windup');
    if (performance.now() < S.shieldUntil) { S.myBlk++; floatTxt($('active'), '방어!', 'dmg me blk'); say('저주를 막았어요!'); renderPlayer(); return; }
    S.curseUntil = performance.now() + sec * 1000; S.curseMult = m;
    $('active').classList.add('cursed'); floatTxt($('active'), '저주', 'dmg me sp');
    say(`저주에 걸렸어요! ${sec}초 동안 받는 피해 ${m}배`);
    const t = S.tok; setTimeout(() => { if (S.tok === t && performance.now() >= S.curseUntil) $('active').classList.remove('cursed'); }, sec * 1000 + 30);
  }, S.p.windup);
}
function foeGW(sec) { // 멀티: 상대가 나에게 치감
  sec = Math.min(10, Math.max(1, +sec || 7));
  S.gwUntil = performance.now() + sec * 1000;
  $('active').classList.add('gwd'); floatTxt($('active'), '치유 감소', 'dmg me sp');
  say(`치감에 걸렸어요! ${sec}초 동안 회복 40% 감소`);
  const t = S.tok; setTimeout(() => { if (S.tok === t && performance.now() >= S.gwUntil) $('active').classList.remove('gwd'); }, sec * 1000 + 30);
}

function grantBarrier(c, b) { // 보호막(러브버그): 남아 있으면 안 생김, 다 사라진 뒤에만 새로 (300 → 280 → 260 …)
  if (c.barrier > 0) return say(`보호막이 ${c.barrier} 남아 있어서 새로 생기지 않았어요.`);
  if (c.barrierNext === undefined) c.barrierNext = b.amt;
  const amt = Math.max(0, c.barrierNext);
  if (!amt) return say('더 이상 보호막이 생기지 않아요.');
  c.barrier = amt; c.barrierNext = amt - b.step;
  floatTxt($('active'), `보호막 +${amt}`, 'dmg me barrier');
  renderPlayer();
}

function startBuff(c, a) {
  const t = S.tok;
  c.buffUntil = performance.now() + a.buff.ms;
  S.busy = true; later(() => { S.busy = false; }, a.cd);
  card.className = 'card'; void card.offsetWidth; card.className = 'card cast';
  navigator.vibrate?.([20, 40, 20]);
  floatTxt($('active'), a.name + '!', 'dmg me buff');
  say(`${a.name}! ${a.buff.ms / 1000}초 동안 평타가 빨라져요!`);
  renderPlayer();
  setTimeout(() => { if (S.tok === t) renderPlayer(); }, a.buff.ms + 30);
}

function hit(a, big, c, blocked) {
  if (!S.ready) return;
  const b = S.bot, bot = $('bot');
  if (blocked) { floatTxt($('enemy'), '방어!', 'dmg blk'); say('봇이 방어막으로 스킬을 막았어요!'); return; }
  if (a.poison) return poisonBot(a);
  if (S.bot.curseUntil > performance.now()) a = { ...a, dmg: Math.round(a.dmg * S.bot.curseMult) };
  if (S.cfg.dummy) { S.dmgTotal += a.dmg; S.dmgStart = S.dmgStart || performance.now(); }
  else b.hp = Math.max(0, b.hp - a.dmg);
  renderBot();
  if (big && a.drain) drainBot(a.drain);
  if (big && a.steal) heal(c, a.dmg);
  if (!big && a.lifeHit) heal(c, a.lifeHit);
  if (!big && vampOn(c)) heal(c, vampAmt(c, a.dmg));
  navigator.vibrate?.(big ? [30, 30, 50] : 25);
  restart(bot, 'hurt'); setTimeout(() => bot.classList.remove('hurt'), 300);
  floatTxt($('enemy'), '-' + a.dmg, big ? 'dmg crit' : 'dmg');

  if (!big && S.cfg.skill) {
    const was = c.en, cost = CARDS[c.type].skill.cost;
    c.en = Math.min(cost, c.en + a.gain);
    if (c.en >= cost && was < cost) say('스킬 게이지 완료! 카드를 꾹 눌러 스킬을 사용하세요!');
    renderPlayer();
  }
  if (b.hp <= 0) { bot.className = 'bot down'; say('처치했어요!'); end(true); }
  else if (S.cfg.after) say(S.cfg.after);
}
