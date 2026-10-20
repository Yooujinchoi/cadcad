const $ = id => document.getElementById(id);
const NAME_MAX = 8;
const BOT_HP = 50;

// 카드 데이터: 새 카드는 여기에 추가
const CARD = { name: '평범한 김울', skill: '매서운 눈빛', dmg: 10, cd: 900 };

const S = { name: '', hp: BOT_HP, busy: false };

const show = id => document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== id);
const clip = v => Array.from(v).slice(0, NAME_MAX).join('');
const load = () => { try { return localStorage.getItem('name') || ''; } catch { return ''; } };
const save = v => { try { localStorage.setItem('name', v); } catch {} };

/* ── 이름 설정 ── */
const input = $('name');
const sync = () => {
  if (!input.value || Array.from(input.value).length > NAME_MAX) input.value = clip(input.value);
  $('cnt').textContent = Array.from(input.value).length;
};
input.addEventListener('input', e => { if (!e.isComposing) sync(); else $('cnt').textContent = Math.min(NAME_MAX, Array.from(input.value).length); });
input.addEventListener('compositionend', sync);

$('name-form').addEventListener('submit', e => {
  e.preventDefault();
  const v = clip(input.value.trim());
  if (!v) {
    input.classList.remove('err'); void input.offsetWidth; input.classList.add('err');
    input.focus();
    return;
  }
  S.name = v; save(v); input.blur();
  startTutorial();
});

/* ── 튜토리얼 ── */
function startTutorial() {
  S.hp = BOT_HP; S.busy = false;
  $('who').textContent = S.name;
  $('sk').textContent = CARD.skill;
  $('dm').textContent = CARD.dmg;
  $('cd').style.transition = 'none'; $('cd').style.transform = 'scaleY(0)';
  $('bot').className = 'bot';
  $('over').hidden = true;
  setHp();
  $('hint').textContent = `${S.name}님, 카드를 눌러 스킬을 사용해 보세요!`;
  const c = $('card');
  c.className = 'card deal';
  c.addEventListener('animationend', () => { if (!S.busy && S.hp > 0) c.className = 'card pulse'; }, { once: true });
  show('s-game');
}

function setHp() {
  $('hpf').style.width = (S.hp / BOT_HP * 100) + '%';
  $('hpt').textContent = `${S.hp} / ${BOT_HP}`;
}

$('card').addEventListener('click', () => {
  if (S.busy || S.hp <= 0) return;
  S.busy = true;

  const card = $('card');
  card.className = 'card'; void card.offsetWidth; card.className = 'card cast';

  // 쿨타임 표시
  const cd = $('cd');
  cd.style.transition = 'none'; cd.style.transform = 'scaleY(1)'; void cd.offsetHeight;
  cd.style.transition = `transform ${CARD.cd}ms linear`; cd.style.transform = 'scaleY(0)';
  setTimeout(() => { if (S.hp > 0) S.busy = false; }, CARD.cd);

  // 스킬 이펙트: 카드 → 훈련봇
  const mid = r => [r.left + r.width / 2 - 16, r.top + r.height / 2 - 16];
  const [x1, y1] = mid(card.getBoundingClientRect());
  const [x2, y2] = mid($('bot').getBoundingClientRect());
  const orb = document.createElement('div');
  orb.className = 'orb';
  document.body.appendChild(orb);
  orb.animate(
    [{ transform: `translate(${x1}px,${y1}px) scale(.6)` }, { transform: `translate(${x2}px,${y2}px) scale(1.5)` }],
    { duration: 380, easing: 'cubic-bezier(.5,0,.8,.6)' }
  ).onfinish = () => { orb.remove(); hit(); };
});

function hit() {
  S.hp = Math.max(0, S.hp - CARD.dmg);
  setHp();
  navigator.vibrate?.(25);

  const bot = $('bot');
  bot.className = 'bot'; void bot.offsetWidth; bot.className = 'bot hurt';
  setTimeout(() => { if (S.hp > 0) bot.className = 'bot'; }, 300);

  const d = document.createElement('span');
  d.className = 'dmg'; d.textContent = '-' + CARD.dmg;
  $('enemy').appendChild(d);
  d.addEventListener('animationend', () => d.remove());

  if (S.hp <= 0) {
    bot.className = 'bot down';
    $('hint').textContent = '훈련봇을 쓰러뜨렸어요!';
    setTimeout(() => {
      $('done-msg').textContent = `${S.name}님, 카드 사용법을 모두 익혔어요.`;
      $('over').hidden = false;
    }, 900);
  } else {
    $('hint').textContent = S.hp <= BOT_HP / 2 ? '좋아요! 계속 눌러서 쓰러뜨려 보세요.' : '쿨타임이 끝나면 다시 사용할 수 있어요.';
  }
}

$('again').addEventListener('click', startTutorial);
$('rename').addEventListener('click', () => { $('over').hidden = true; input.value = S.name; sync(); show('s-name'); });

/* ── 시작 ── */
input.value = load(); sync();
show('s-name');
