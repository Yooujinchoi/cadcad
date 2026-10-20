const $ = id => document.getElementById(id);
const NAME_MAX = 8;
const TOTAL_STAGES = 3;

// 카드 데이터: 새 카드는 여기에 추가
const CARD = {
  name: '평범한 김울',
  basic: { name: '평타', dmg: 5, cd: 500 },
  skill: { name: '째려보기', dmg: 20, cd: 2000, hold: 450 }, // hold: 꾹 누르는 시간(ms)
};

// 튜토리얼 단계: 3단계는 내용이 정해지면 여기에 추가
const STAGES = [
  { title: '튜토리얼 1단계', hp: 30, skill: false, deal: true,
    intro: '이 게임은 카드를 뽑아 상대방을 조지는 게임입니다.\n처음에는 기본카드인 평범한 김울 카드를 지급해드립니다.\n공격방법은 카드를 누르면 상대방에게 기본공격이 나갑니다.',
    hint: n => `${n}님, 카드를 눌러 기본공격을 해보세요!`,
    after: '좋아요! 계속 눌러서 처치하세요.' },
  { title: '튜토리얼 2단계', hp: 60, skill: true, basic: false,
    intro: '이제 기본공격이 아닌 스킬을 사용해 봅시다.\n카드를 꾹 눌러 스킬을 사용해보세요.',
    hint: () => '카드를 꾹 눌러 스킬을 사용하세요!',
    after: '스킬이 들어갔어요! 쿨타임이 끝나면 또 써보세요.' },
];

const S = { name: '', stage: 0, hp: 0, max: 0, busy: false, ready: false };
const card = $('card'), input = $('name');

const show = id => document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id);
const len = v => Array.from(v).length;
const clip = v => Array.from(v).slice(0, NAME_MAX).join('');
const load = () => { try { return localStorage.getItem('name') || ''; } catch { return ''; } };
const save = v => { try { localStorage.setItem('name', v); } catch {} };
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

/* ── 이름 설정 ── */
const sync = () => { if (len(input.value) > NAME_MAX) input.value = clip(input.value); $('cnt').textContent = len(input.value); };
input.addEventListener('input', e => e.isComposing ? $('cnt').textContent = Math.min(NAME_MAX, len(input.value)) : sync());
input.addEventListener('compositionend', sync);

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

/* ── 튜토리얼 단계 ── */
function goStage(i) {
  if (i >= STAGES.length) return finish();
  const st = STAGES[i];
  Object.assign(S, { stage: i, max: st.hp, hp: st.hp, busy: false, ready: false });
  $('who').textContent = S.name;
  $('stg').textContent = `튜토리얼 ${i + 1}/${TOTAL_STAGES}`;
  $('n1').textContent = CARD.basic.name; $('d1').textContent = CARD.basic.dmg;
  $('n2').textContent = CARD.skill.name; $('d2').textContent = CARD.skill.dmg;
  $('sk').hidden = !st.skill;
  $('cd').style.transition = 'none'; $('cd').style.transform = 'scaleY(0)';
  $('bot').className = 'bot';
  $('hint').textContent = '';
  card.className = st.deal ? 'card away' : 'card';
  setHp();
  show('s-game');
  panel(st.title, st.intro, '시작하기', () => beginStage(st));
}

function beginStage(st) {
  S.ready = true;
  $('hint').textContent = st.hint(S.name);
  if (st.deal) {
    card.className = 'card deal';
    card.addEventListener('animationend', () => { if (!S.busy && S.hp > 0) card.className = 'card pulse'; }, { once: true });
  } else card.className = 'card pulse';
}

function finish() {
  S.ready = false;
  panel('튜토리얼 2단계 클리어', `${S.name}님, 3단계는 준비 중이에요.`,
    '처음부터 다시', () => goStage(0),
    '이름 바꾸기', () => { input.value = S.name; sync(); show('s-name'); });
}

function setHp() {
  $('hpf').style.width = (S.hp / S.max * 100) + '%';
  $('hpt').textContent = `${S.hp} / ${S.max}`;
}

/* ── 입력: 탭 = 평타, 꾹 누르기 = 스킬 ── */
let timer, pressing = false, held = false;
const stopPress = () => { clearTimeout(timer); pressing = false; card.classList.remove('charging'); };

card.addEventListener('pointerdown', () => {
  if (!S.ready || S.busy) return;
  pressing = true; held = false;
  if (STAGES[S.stage].skill) {
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
  if (STAGES[S.stage].basic === false) {
    const h = $('hint');
    h.textContent = '기본공격은 이미 익혔어요. 카드를 꾹 눌러 스킬을 사용하세요!';
    restart(h, 'nudge');
    return;
  }
  attack('basic');
}

/* ── 공격 ── */
function attack(kind) {
  if (!S.ready || S.busy) return;
  const a = CARD[kind], big = kind === 'skill';
  S.busy = true;
  card.className = 'card'; void card.offsetWidth; card.className = 'card cast';

  const cd = $('cd');
  cd.style.transition = 'none'; cd.style.transform = 'scaleY(1)'; void cd.offsetHeight;
  cd.style.transition = `transform ${a.cd}ms linear`; cd.style.transform = 'scaleY(0)';
  setTimeout(() => { if (S.hp > 0) S.busy = false; }, a.cd);

  const mid = r => [r.left + r.width / 2 - 16, r.top + r.height / 2 - 16];
  const [x1, y1] = mid(card.getBoundingClientRect());
  const [x2, y2] = mid($('bot').getBoundingClientRect());
  const orb = document.createElement('div');
  orb.className = big ? 'orb eye' : 'orb';
  document.body.appendChild(orb);
  orb.animate(
    [{ transform: `translate(${x1}px,${y1}px) scale(.6)` }, { transform: `translate(${x2}px,${y2}px) scale(${big ? 2.6 : 1.5})` }],
    { duration: big ? 460 : 380, easing: 'cubic-bezier(.5,0,.8,.6)' }
  ).onfinish = () => { orb.remove(); hit(a, big); };
}

function hit(a, big) {
  S.hp = Math.max(0, S.hp - a.dmg);
  setHp();
  navigator.vibrate?.(big ? [30, 30, 50] : 25);

  const bot = $('bot');
  bot.className = 'bot'; void bot.offsetWidth; bot.className = 'bot hurt';
  setTimeout(() => { if (S.hp > 0) bot.className = 'bot'; }, 300);

  const d = document.createElement('span');
  d.className = big ? 'dmg crit' : 'dmg';
  d.textContent = '-' + a.dmg;
  $('enemy').appendChild(d);
  d.addEventListener('animationend', () => d.remove());

  if (S.hp <= 0) {
    S.ready = false;
    bot.className = 'bot down';
    $('hint').textContent = '훈련봇을 처치했어요!';
    const next = S.stage + 1;
    setTimeout(() => goStage(next), 1100);
  } else {
    $('hint').textContent = STAGES[S.stage].after;
  }
}

/* ── 시작 ── */
input.value = load(); sync();
show('s-name');
