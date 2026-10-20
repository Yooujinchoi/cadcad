/* 전투 엔진 + 튜토리얼 (계정/메뉴는 app.js) */
const $ = id => document.getElementById(id);
const SHIELD_MS = 1200, SWAP_MS = 2500;

// 프로필 사진(128px JPEG data URL)만 허용 → 다른 사람이 보낸 값도 안전하게 표시
const safePhoto = p => typeof p === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]{20,60000}$/.test(p) ? p : '';
const avHtml = (p, cls = '') => { const s = safePhoto(p); return `<span class="av ${cls}">${s ? `<img src="${s}" alt="">` : '🧑'}</span>`; };

// 등급(낮음→높음): 김울급 < 버러지 < 레어 < 슈퍼레어 < 민준급
const RARITY = {
  kimul: { name: '김울급', color: '#9aa5a5', rank: 0 },
  worm: { name: '버러지', color: '#7bc47f', rank: 1 },
  rare: { name: '레어', color: '#5aa9ff', rank: 2 },
  sr: { name: '슈퍼레어', color: '#c07bff', rank: 3 },
  minjun: { name: '민준급', color: '#ff9f3d', rank: 4 },
};
// 스킬포인트: 평타 1회당 쌓이는 양(gain)은 카드마다 다름, 스킬은 cost 필요
const CARDS = {
  kimul: { name: '평범한 김울', img: 'kimul.jpg', rarity: 'kimul', hp: 100,
    basic: { name: '평타', dmg: 5, cd: 500, gain: 5 },
    skill: { name: '째려보기', dmg: 40, cd: 800, cost: 100, hold: 450 } },
  yongsa: { name: '용사 김울', img: 'yongsa.jpg', rarity: 'sr', hp: 700,
    basic: { name: '평타', dmg: 13, cd: 500, gain: 8 },
    skill: { name: '울칼리버', dmg: 110, cd: 800, cost: 100, hold: 450 } },
};
const rar = t => RARITY[CARDS[t].rarity];

// 튜토리얼 훈련봇 (플레이어 최속 스킬 ≈5.4초 < 봇 스킬 시전 4.2초)
const TUT_BOT = { dmg: 3, gap: 800, gain: 25, sdmg: 25, windup: 1000, shield: 0 };
const TUTORIAL = [
  { bot: 30, deal: true,
    intro: '이 게임은 카드를 뽑아 상대방을 조지는 게임입니다.\n처음에는 기본카드인 평범한 김울 카드를 지급해드립니다.\n공격방법은 카드를 누르면 상대방에게 기본공격이 나갑니다.',
    hint: n => `${n}님, 카드를 눌러 기본공격을 해보세요!`, after: '좋아요! 계속 눌러서 처치하세요.' },
  { bot: 200, skill: true,
    intro: '이제 기본공격이 아닌 스킬을 사용해 봅시다.\n카드를 꾹 눌러 스킬을 사용해보세요.',
    hint: () => '평타를 쳐서 스킬 게이지를 채우세요!' },
  { bot: 300, skill: true, atk: true, shield: true, deck: ['kimul', 'kimul'], deal: true,
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
  $('hpf').style.width = pct(b.hp, b.max);
  $('hpt').textContent = `${b.hp} / ${b.max}`;
  $('bspf').style.width = pct(b.en, b.cost);
  $('bspt').textContent = `스킬 ${b.en} / ${b.cost}`;
  $('bsp').classList.toggle('full', b.en >= b.cost);
}
function renderPlayer() {
  const c = S.cards[S.cur], d = CARDS[c.type];
  card.style.setProperty('--rc', rar(c.type).color);
  if (!$('cimg').src.endsWith(d.img)) $('cimg').src = d.img;
  $('n1').textContent = d.basic.name; $('d1').textContent = d.basic.dmg;
  $('n2').textContent = d.skill.name; $('d2').textContent = d.skill.dmg;
  $('chf').style.width = pct(c.hp, d.hp);
  $('cht').textContent = `HP ${c.hp} / ${d.hp}`;
  $('pspf').style.width = c.en + '%';
  $('pspt').textContent = `스킬 ${c.en} / ${d.skill.cost}`;
  $('psp').classList.toggle('full', c.en >= d.skill.cost);
  $('bench').innerHTML = S.cards.map((x, i) => i === S.cur ? '' :
    `<div class="mini${x.hp <= 0 ? ' dead' : ''}" data-i="${i}" style="--rc:${rar(x.type).color}" role="button" aria-label="카드 교체"><img src="${CARDS[x.type].img}" alt=""><span class="hp"><div style="width:${pct(x.hp, CARDS[x.type].hp)}"></div></span></div>`).join('');
  if (S.cfg.sync) S.cfg.sync();
}
function renderShield() { $('shn').textContent = S.shields; $('shield').disabled = S.shields <= 0; }

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
  const types = cfg.deck || ['kimul'];
  Object.assign(S, { cfg, p: cfg.p, ready: false, busy: false, cur: 0, shields: 3, shieldUntil: 0, swapUntil: 0, myBlk: 0,
    bot: { hp: cfg.bot, max: cfg.bot, en: 0, sh: 3, cost: cfg.p.cost || 100 },
    cards: types.map(t => ({ type: t, hp: CARDS[t].hp, en: 0 })) });
  $('who').textContent = cfg.who;
  $('stg').textContent = cfg.tag;
  $('bname').textContent = cfg.botName;
  $('enemy').classList.toggle('pvp', !!cfg.foe); // 멀티: 상대 카드 + 상대 프로필 배치
  $('bot').style.backgroundImage = cfg.foe ? `url(${(CARDS[cfg.foe.deck[0]] || CARDS.kimul).img})` : '';
  $('bav').hidden = !cfg.foe;
  if (cfg.foe) $('bav').innerHTML = avHtml(cfg.foe.photo, 'lg');
  $('quit').hidden = !cfg.quit;
  $('sk').hidden = $('psp').hidden = !cfg.skill;
  $('bsp').hidden = !cfg.atk;
  $('shield').parentElement.style.visibility = cfg.shield ? '' : 'hidden';
  $('bench').parentElement.style.visibility = types.length > 1 ? '' : 'hidden';
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
function foeSkill(d, windup, done) {
  const el = $('bot');
  el.classList.add('windup');
  say(S.cfg.shield ? '스킬을 준비 중! 방어막을 펼치세요!' : '훈련봇이 스킬을 준비 중이에요!');
  later(() => {
    el.classList.remove('windup');
    fly(el, card, 'orb bad eye', 2.2, 300, () => {
      if (performance.now() < S.shieldUntil) { S.myBlk++; floatTxt($('active'), '방어!', 'dmg me blk'); say('방어 성공!'); navigator.vibrate?.(15); renderPlayer(); }
      else { hurtPlayer(d, true); say('스킬에 맞았어요!'); }
    });
    if (done) done();
  }, windup);
}
function foeAttack(e) { if (S.ready) e.k === 'skill' ? foeSkill(e.d, S.p.windup) : foeBasic(e.d); }
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
  c.hp = Math.max(0, c.hp - d);
  restart($('active'), 'hurt');
  navigator.vibrate?.(big ? [40, 30, 60] : 15);
  floatTxt($('active'), '-' + d, big ? 'dmg crit me' : 'dmg me');
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
  const c = S.cards[S.cur], a = CARDS[c.type][kind], big = kind === 'skill';
  if (big) { if (c.en < a.cost) return; c.en -= a.cost; renderPlayer(); }
  S.busy = true;
  card.className = 'card'; void card.offsetWidth; card.className = 'card cast';

  const el = $('cd');
  el.style.transition = 'none'; el.style.transform = 'scaleY(1)'; void el.offsetHeight;
  el.style.transition = `transform ${a.cd}ms linear`; el.style.transform = 'scaleY(0)';
  later(() => { S.busy = false; }, a.cd);

  if (S.cfg.pvp) { // 멀티: 공격 신호만 보내고, 결과는 상대 화면에서 계산
    S.cfg.pvp.send(kind, a.dmg);
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

function hit(a, big, c, blocked) {
  if (!S.ready) return;
  const b = S.bot, bot = $('bot');
  if (blocked) { floatTxt($('enemy'), '방어!', 'dmg blk'); say('봇이 방어막으로 스킬을 막았어요!'); return; }
  b.hp = Math.max(0, b.hp - a.dmg);
  renderBot();
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
