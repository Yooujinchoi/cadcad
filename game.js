const $ = id => document.getElementById(id);
const NAME_MAX = 8, SHIELD_MS = 1200;

// 카드 데이터: 새 카드는 여기에 추가
const CARD = {
  hp: 100,
  basic: { name: '평타', dmg: 5, cd: 500, gain: 10 },              // 평타 1회 = 스킬 게이지 +10
  skill: { name: '째려보기', dmg: 40, cd: 800, cost: 100, hold: 450 }, // 게이지 100 필요, 꾹 눌러 발동
};

// 훈련봇: 플레이어가 평타만 연타해도 스킬은 최소 약 5.4초 뒤에 나감.
// 훈련봇은 1.0초부터 0.8초마다 평타(+25) → 3.4초에 게이지 100 → 4.2초에 스킬 시전. 항상 먼저 찬다.
const BOT = {
  start: 1000,
  basic: { dmg: 3, gap: 800, gain: 25 },
  skill: { dmg: 25, windup: 1000 }, // windup: 스킬이 날아오기 전 예고 시간(이때 방어막)
};

// 튜토리얼 단계
const STAGES = [
  { title: '튜토리얼 1단계', bot: 30, deal: true,
    intro: '이 게임은 카드를 뽑아 상대방을 조지는 게임입니다.\n처음에는 기본카드인 평범한 김울 카드를 지급해드립니다.\n공격방법은 카드를 누르면 상대방에게 기본공격이 나갑니다.',
    hint: n => `${n}님, 카드를 눌러 기본공격을 해보세요!`,
    after: '좋아요! 계속 눌러서 처치하세요.' },
  { title: '튜토리얼 2단계', bot: 100, skill: true, atk: true,
    intro: '이제 기본공격이 아닌 스킬을 사용해 봅시다.\n카드를 꾹 눌러 스킬을 사용해보세요.',
    hint: () => '평타를 쳐서 스킬 게이지를 채우세요!' },
  { title: '튜토리얼 3단계', bot: 300, skill: true, atk: true, shield: true, cards: 2, deal: true,
    intro: '이 게임은 포켓몬고 형식의 전투방식을 가지고 있습니다.\n훈련봇과 전투하여 승리를 가져오세요.\n방어막을 적절히 활용하세요.',
    hint: () => '카드가 2장 지급됐어요! 방어막으로 훈련봇의 스킬을 막으세요.' },
];

const S = { name: '', stage: 0, tok: 0, ready: false, busy: false, bot: null, cards: [], cur: 0, shields: 0, shieldUntil: 0 };
const card = $('card'), input = $('name'), hint = $('hint');
const st = () => STAGES[S.stage];

const show = id => document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id);
const len = v => Array.from(v).length;
const clip = v => Array.from(v).slice(0, NAME_MAX).join('');
const load = () => { try { return localStorage.getItem('name') || ''; } catch { return ''; } };
const save = v => { try { localStorage.setItem('name', v); } catch {} };
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const say = msg => { hint.textContent = msg; };
const pct = (a, b) => (a / b * 100) + '%';
const later = (fn, ms) => { const t = S.tok; setTimeout(() => { if (t === S.tok && S.ready) fn(); }, ms); };

/* ── 이름 설정 ── */
const sync = () => { if (len(input.value) > NAME_MAX) input.value = clip(input.value); $('cnt').textContent = len(input.value); };
input.addEventListener('input', e => e.isComposing ? $('cnt').textContent = Math.min(NAME_MAX, len(input.value)) : sync());
input.addEventListener('compositionend', sync);
const rename = () => { input.value = S.name; sync(); show('s-name'); };

$('name-form').addEventListener('submit', e => {
  e.preventDefault();
  const v = clip(input.value.trim());
  if (!v) { restart(input, 'err'); input.focus(); return; }
  S.name = v; save(v); input.blur();
  goStage(0);
});

/* ── 안내 패널 ── */
function panel(title, text, ok, onOk, sub, onSub) {
  $('p-title').textContent = title;
  $('p-text').textContent = text;
  $('p-ok').textContent = ok;
  $('p-ok').onclick = () => { $('over').hidden = true; onOk(); };
  const b = $('p-sub');
  b.hidden = !sub;
  if (sub) { b.textContent = sub; b.onclick = () => { $('over').hidden = true; onSub(); }; }
  $('over').hidden = false;
}

/* ── 화면 갱신 ── */
function renderBot() {
  const b = S.bot;
  $('hpf').style.width = pct(b.hp, b.max);
  $('hpt').textContent = `${b.hp} / ${b.max}`;
  $('bspf').style.width = b.en + '%';
  $('bsp').classList.toggle('full', b.en >= 100);
}
function renderPlayer() {
  const c = S.cards[S.cur], o = S.cards[1 - S.cur];
  $('chf').style.width = pct(c.hp, CARD.hp);
  $('cht').textContent = `HP ${c.hp} / ${CARD.hp}`;
  $('pspf').style.width = c.en + '%';
  $('pspt').textContent = `스킬 ${c.en} / ${CARD.skill.cost}`;
  $('psp').classList.toggle('full', c.en >= CARD.skill.cost);
  if (o) { $('mhf').style.width = pct(o.hp, CARD.hp); $('mini').classList.toggle('dead', o.hp <= 0); }
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
  o.animate(
    [{ transform: `translate(${x1}px,${y1}px) scale(.6)` }, { transform: `translate(${x2}px,${y2}px) scale(${scale})` }],
    { duration: dur, easing: 'cubic-bezier(.5,0,.8,.6)' }
  ).onfinish = () => { o.remove(); if (t === S.tok) cb(); };
}

/* ── 단계 진행 ── */
function goStage(i) {
  if (i >= STAGES.length) return finish();
  const g = STAGES[i];
  S.tok++;
  Object.assign(S, {
    stage: i, ready: false, busy: false, cur: 0, shields: 3, shieldUntil: 0,
    bot: { hp: g.bot, max: g.bot, en: 0 },
    cards: Array.from({ length: g.cards || 1 }, () => ({ hp: CARD.hp, en: 0 })),
  });
  $('who').textContent = S.name;
  $('stg').textContent = `튜토리얼 ${i + 1}/${STAGES.length}`;
  $('n1').textContent = CARD.basic.name; $('d1').textContent = CARD.basic.dmg;
  $('n2').textContent = CARD.skill.name; $('d2').textContent = CARD.skill.dmg;
  $('sk').hidden = !g.skill;
  $('psp').hidden = !g.skill;
  $('bsp').hidden = !g.atk;
  $('shield').parentElement.hidden = !g.shield;
  $('mini').parentElement.hidden = !g.cards;
  $('cd').style.transition = 'none'; $('cd').style.transform = 'scaleY(0)';
  $('bot').className = 'bot';
  $('active').className = 'active';
  hint.className = 'hint'; say('');
  card.className = g.deal ? 'card away' : 'card';
  renderBot(); renderPlayer(); renderShield();
  show('s-game');
  panel(g.title, g.intro, '시작하기', () => beginStage(g));
}

function beginStage(g) {
  S.ready = true;
  say(g.hint(S.name));
  if (g.deal) {
    card.className = 'card deal';
    card.addEventListener('animationend', () => { if (!S.busy) card.className = 'card pulse'; }, { once: true });
  } else card.className = 'card pulse';
  if (g.atk) later(botAct, BOT.start);
}

function finish() {
  S.ready = false;
  panel('튜토리얼 완료', `${S.name}님, 튜토리얼을 모두 마쳤어요.\n다음 내용은 준비 중이에요.`,
    '처음부터 다시', () => goStage(0), '이름 바꾸기', rename);
}

function lose() {
  S.ready = false;
  setTimeout(() => panel('패배', '카드가 모두 쓰러졌어요.\n방어막을 활용해서 다시 도전해 보세요.', '다시 도전', () => goStage(S.stage)), 700);
}

/* ── 훈련봇 ── */
function botAct() {
  const b = S.bot;
  if (b.en >= 100) return botSkill();
  const el = $('bot');
  restart(el, 'lunge'); setTimeout(() => el.classList.remove('lunge'), 260);
  b.en = Math.min(100, b.en + BOT.basic.gain); renderBot();
  fly(el, card, 'orb bad', 1.2, 320, () => hurtPlayer(BOT.basic.dmg, false));
  later(botAct, BOT.basic.gap);
}

function botSkill() {
  const el = $('bot');
  el.classList.add('windup');
  say(st().shield ? '훈련봇이 스킬을 준비 중! 방어막을 펼치세요!' : '훈련봇이 스킬을 준비 중이에요!');
  later(() => {
    el.classList.remove('windup');
    S.bot.en = 0; renderBot();
    fly(el, card, 'orb bad eye', 2.2, 300, () => {
      if (performance.now() < S.shieldUntil) {
        floatTxt($('active'), '방어!', 'dmg me blk'); say('방어 성공!'); navigator.vibrate?.(15);
      } else { hurtPlayer(BOT.skill.dmg, true); say('훈련봇의 스킬에 맞았어요!'); }
    });
    later(botAct, BOT.basic.gap);
  }, BOT.skill.windup);
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
    if (next < 0) { renderPlayer(); return lose(); }
    S.cur = next; stopPress();
    say('카드가 쓰러졌어요! 다음 카드가 나옵니다.');
    card.className = 'card deal';
  }
  renderPlayer();
}

/* ── 플레이어 입력: 탭 = 평타, 꾹 누르기 = 스킬(게이지 100), 방어막 버튼 ── */
let timer, pressing = false, held = false;
const stopPress = () => { clearTimeout(timer); pressing = false; card.classList.remove('charging'); };

card.addEventListener('pointerdown', () => {
  if (!S.ready || S.busy) return;
  pressing = true; held = false;
  if (st().skill && S.cards[S.cur].en >= CARD.skill.cost) {
    card.classList.add('charging');
    timer = setTimeout(() => { held = true; pressing = false; attack('skill'); }, CARD.skill.hold);
  }
});
card.addEventListener('pointerup', () => {
  const tap = pressing && !held;
  stopPress(); held = false;
  if (tap) onTap();
});
card.addEventListener('pointerleave', stopPress);
card.addEventListener('pointercancel', stopPress);
card.addEventListener('contextmenu', e => e.preventDefault());
card.addEventListener('click', e => { if (e.detail === 0) onTap(); }); // 키보드 대응

function onTap() {
  if (!S.ready || S.busy) return;
  if (st().skill && S.cards[S.cur].en >= CARD.skill.cost) {
    say('게이지가 가득 찼어요! 카드를 꾹 눌러 스킬을 사용하세요!'); restart(hint, 'nudge');
  }
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

function attack(kind) {
  if (!S.ready || S.busy) return;
  const a = CARD[kind], big = kind === 'skill', c = S.cards[S.cur];
  if (big) { if (c.en < a.cost) return; c.en -= a.cost; renderPlayer(); }
  S.busy = true;
  card.className = 'card'; void card.offsetWidth; card.className = 'card cast';

  const cd = $('cd');
  cd.style.transition = 'none'; cd.style.transform = 'scaleY(1)'; void cd.offsetHeight;
  cd.style.transition = `transform ${a.cd}ms linear`; cd.style.transform = 'scaleY(0)';
  later(() => { S.busy = false; }, a.cd);

  fly(card, $('bot'), big ? 'orb eye' : 'orb', big ? 2.6 : 1.5, big ? 460 : 380, () => hit(a, big, c));
}

function hit(a, big, c) {
  if (!S.ready) return;
  const b = S.bot, bot = $('bot');
  b.hp = Math.max(0, b.hp - a.dmg);
  renderBot();
  navigator.vibrate?.(big ? [30, 30, 50] : 25);
  restart(bot, 'hurt'); setTimeout(() => bot.classList.remove('hurt'), 300);
  floatTxt($('enemy'), '-' + a.dmg, big ? 'dmg crit' : 'dmg');

  if (!big && st().skill) {
    const was = c.en;
    c.en = Math.min(CARD.skill.cost, c.en + a.gain);
    if (c.en >= CARD.skill.cost && was < CARD.skill.cost) say('스킬 게이지 완료! 카드를 꾹 눌러 스킬을 사용하세요!');
    renderPlayer();
  }

  if (b.hp <= 0) {
    S.ready = false;
    bot.className = 'bot down';
    say('훈련봇을 처치했어요!');
    const next = S.stage + 1;
    setTimeout(() => goStage(next), 1100);
  } else if (st().after) say(st().after);
}

/* ── 시작 ── */
input.value = load(); sync();
show('s-name');
