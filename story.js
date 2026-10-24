/* 스토리 모드 (베타 · 관리자 전용)
   - 가로 화면 · 우리 팀 5장을 뒤/중/앞 줄에 배치 (한 줄 3칸)
   - 평타는 자동, 스킬은 아래 버튼을 눌러서 사용
   - 앞줄 우선 공격: 적은 우리 앞줄부터, 우리는 적의 앞쪽 열부터 때림 */
const LANE_NAME = ['뒤', '중', '앞'];
const MAX_TEAM = 5;
// 시험 전투 (나중에 스토리 장마다 바꿀 부분)
const STAGE = {
  name: '시험 전투',
  enemies: [
    ...[0, 1, 2].map(r => ({ name: '잡몹', hp: 420, atk: 14, cd: 1100, col: 0, row: r })),
    ...[0, 1, 2].map(r => ({ name: '잡몹', hp: 420, atk: 14, cd: 1100, col: 1, row: r })),
    { name: '보스', hp: 3200, atk: 45, cd: 1300, col: 2, row: 1, boss: true, every: 6, sdmg: 90 }, // 6번째 공격마다 앞줄 전체 공격
  ],
};
const ST = { slots: Array(9).fill(null), sel: 0, run: null, tok: 0 }; // 칸 번호 = 줄(0뒤 1중 2앞) × 3 + 행

const pickable = () => Object.keys(CARDS).filter(k => !CARDS[k].tutorial && !CARDS[k].variant).sort((a, b) => rar(b).rank - rar(a).rank || a.localeCompare(b));
const teamGrid = cell => LANE_NAME.map((n, l) => `<div class="st-lane"><em>${n}</em>${[0, 1, 2].map(r => cell(l * 3 + r)).join('')}</div>`).join('');
const stMsg = m => { $('st-msg').textContent = m; };

/* ── 가로 화면 ── */
function landscape(on) {
  try {
    if (on) { const p = document.documentElement.requestFullscreen?.(); if (p) p.then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); }
    else { screen.orientation?.unlock?.(); if (document.fullscreenElement) document.exitFullscreen?.(); }
  } catch {}
}

/* ── 배치 화면 ── */
function storyOpen() { if (!U.admin) return; show('s-story'); landscape(true); setupView(); }
function setupView() {
  ST.run = null; ST.tok++;
  $('st-over').hidden = true;
  const used = ST.slots.filter(Boolean);
  stMsg('칸을 고르고 오른쪽 카드를 누르면 배치돼요. 배치된 칸을 누르면 빠져요. (최대 5장)');
  $('st-team').innerHTML = teamGrid(i => {
    const k = ST.slots[i];
    return `<div class="st-slot${ST.sel === i ? ' sel' : ''}${k ? ' on' : ''}" data-s="${i}" style="${k ? `--rc:${rar(k).color}` : ''}">${k ? `<img src="${CARDS[k].img}" alt="">` : '+'}</div>`;
  });
  $('st-enemy').innerHTML = `<div class="st-pick">${pickable().map(k => `<button class="st-card${used.includes(k) ? ' used' : ''}" data-k="${k}" style="--rc:${rar(k).color}"><img src="${CARDS[k].img}" alt=""><span>${CARDS[k].name}</span></button>`).join('')}</div>`;
  $('st-bar').innerHTML = `<span class="st-count">${used.length} / ${MAX_TEAM}장</span><button class="btn st-go" data-act="go"${used.length ? '' : ' disabled'}>전투 시작</button>`;
}

/* ── 전투 ── */
function unit(k, i) {
  const d = CARDS[k];
  return { k, d, lane: Math.floor(i / 3), row: i % 3, slot: i, hp: d.hp, max: d.hp, sp: 0, next: 400 + Math.random() * 500, barrier: 0, bonus: 0 };
}
function startStory() {
  ST.tok++;
  const allies = ST.slots.map((k, i) => k && unit(k, i)).filter(Boolean);
  const enemies = STAGE.enemies.map(e => ({ ...e, max: e.hp, next: 700 + Math.random() * 700, n: 0 }));
  ST.run = { allies, enemies, t0: performance.now(), over: false, tok: ST.tok };
  battleView(); stMsg(`${STAGE.name}! 평타는 자동이에요. 스킬이 차면 아래 버튼을 누르세요.`);
  const tok = ST.tok, step = () => { if (ST.tok !== tok || !ST.run || ST.run.over) return; tick(performance.now() - ST.run.t0); requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function battleView() {
  const R = ST.run;
  $('st-team').innerHTML = teamGrid(i => {
    const ai = R.allies.findIndex(a => a.slot === i);
    if (ai < 0) return '<div class="st-slot vacant"></div>';
    const a = R.allies[ai];
    return `<div class="st-u al" id="au${ai}" style="--rc:${rar(a.k).color}"><img src="${a.d.img}" alt=""><div class="st-hp"><i></i><s></s></div><div class="st-sp"><i></i></div></div>`;
  });
  const col = c => `<div class="st-col">${R.enemies.map((e, i) => e.col === c ? `<div class="st-u en${e.boss ? ' boss' : ''}" id="eu${i}"><b>${e.name}</b><div class="st-hp"><i></i></div></div>` : '').join('')}</div>`;
  $('st-enemy').innerHTML = col(0) + col(1) + `<div class="st-col bosscol">${col(2).replace('<div class="st-col">', '').replace(/<\/div>$/, '')}</div>`;
  $('st-bar').innerHTML = R.allies.map((a, i) => `<button class="st-sk" data-u="${i}" id="sk${i}" style="--rc:${rar(a.k).color}"><img src="${a.d.img}" alt=""><span><b>${a.d.skill.name}</b><small>${a.d.name}</small><div class="st-sp"><i></i></div></span></button>`).join('');
  R.allies.forEach((a, i) => draw('a', i)); R.enemies.forEach((e, i) => draw('e', i));
}
function draw(side, i) {
  const R = ST.run, u = side === 'a' ? R.allies[i] : R.enemies[i], el = $(side === 'a' ? 'au' + i : 'eu' + i);
  if (!el) return;
  const tot = Math.max(u.max, u.hp + (u.barrier || 0));
  el.querySelector('.st-hp i').style.width = (u.hp / tot * 100) + '%';
  const s = el.querySelector('.st-hp s'); if (s) { s.style.left = (u.hp / tot * 100) + '%'; s.style.width = ((u.barrier || 0) / tot * 100) + '%'; }
  el.classList.toggle('dead', u.hp <= 0);
  if (side === 'a') {
    const p = Math.min(1, u.sp / u.d.skill.cost) * 100;
    el.querySelector('.st-sp i').style.width = p + '%';
    const b = $('sk' + i); if (b) { b.querySelector('.st-sp i').style.width = p + '%'; b.classList.toggle('ready', p >= 100 && u.hp > 0); b.disabled = u.hp <= 0; }
  }
}
function pop(side, i, text, cls = '') {
  const el = $(side === 'a' ? 'au' + i : 'eu' + i); if (!el) return;
  const d = document.createElement('span'); d.className = 'st-dmg ' + cls; d.textContent = text;
  el.appendChild(d); d.addEventListener('animationend', () => d.remove());
  el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
}

/* 앞줄 우선: 같은 행을 먼저, 없으면 그 줄의 다른 칸 */
function frontEnemy(row) {
  const E = ST.run.enemies;
  for (const c of [0, 1, 2]) {
    const alive = E.map((e, i) => [e, i]).filter(([e]) => e.col === c && e.hp > 0);
    if (alive.length) return (alive.find(([e]) => e.row === row) || alive[0])[1];
  }
  return -1;
}
function frontAlly(row) {
  const A = ST.run.allies;
  for (const l of [2, 1, 0]) {
    const alive = A.map((a, i) => [a, i]).filter(([a]) => a.lane === l && a.hp > 0);
    if (alive.length) return (alive.find(([a]) => a.row === row) || alive[alive.length * Math.random() | 0])[1];
  }
  return -1;
}
function hurt(side, i, dmg, cls) {
  const R = ST.run, u = side === 'a' ? R.allies[i] : R.enemies[i];
  if (!u || u.hp <= 0) return 0;
  if (u.curseUntil > performance.now()) dmg = Math.round(dmg * u.curseMult);
  let left = dmg;
  if (u.barrier > 0) { const ab = Math.min(u.barrier, left); u.barrier -= ab; left -= ab; }
  u.hp = Math.max(0, u.hp - left);
  pop(side, i, '-' + dmg, cls); draw(side, i);
  return dmg;
}
function healU(i, n) { const a = ST.run.allies[i]; if (!a || a.hp <= 0 || n <= 0) return; const g = Math.min(n, a.max - a.hp); if (g > 0) { a.hp += g; pop('a', i, '+' + g, 'heal'); draw('a', i); } }

function tick(t) {
  const R = ST.run, now = performance.now();
  R.allies.forEach((a, i) => { // 우리 팀 자동 평타
    if (a.hp <= 0 || t < a.next) return;
    const buff = a.buffUntil > now ? a.d.skill.buff : null, tg = frontEnemy(a.row);
    if (tg < 0) return;
    let dmg = buff ? buff.dmg : a.d.basic.dmg;
    if (a.bonus) { dmg += a.bonus; a.bonus = 0; }
    hurt('e', tg, dmg);
    if (!buff) a.sp = Math.min(a.d.skill.cost, a.sp + a.d.basic.gain);
    if (a.d.basic.lifeHit) healU(i, a.d.basic.lifeHit);
    a.next = t + (buff ? buff.cd : a.d.basic.cd); draw('a', i);
  });
  R.enemies.forEach((e, i) => { // 적 자동 공격 (앞줄부터)
    if (e.hp <= 0 || t < e.next) return;
    e.n++;
    if (e.boss && e.every && e.n % e.every === 0) {
      const front = [2, 1, 0].find(l => R.allies.some(a => a.lane === l && a.hp > 0));
      stMsg(`보스의 강타! ${LANE_NAME[front]}줄 전체에 ${e.sdmg}`);
      R.allies.forEach((a, ai) => { if (a.lane === front) hurt('a', ai, e.sdmg, 'big'); });
    } else { const tg = frontAlly(e.row); if (tg >= 0) hurt('a', tg, e.atk); }
    e.next = t + e.cd;
  });
  if (!R.enemies.some(e => e.hp > 0)) finish(true);
  else if (!R.allies.some(a => a.hp > 0)) finish(false);
}

/* 스킬: 기존 카드 스킬을 여러 명 전투에 맞게 적용 */
function useSkill(i) {
  const R = ST.run; if (!R || R.over) return;
  const a = R.allies[i], s = a.d.skill, now = performance.now();
  if (a.hp <= 0) return;
  if (a.sp < s.cost) return stMsg(`${a.d.name}: 스킬포인트가 아직 모자라요.`);
  a.sp = 0;
  const tg = frontEnemy(a.row);
  if (s.buff) { a.buffUntil = now + s.buff.ms; stMsg(`${s.name}! ${s.buff.ms / 1000}초 동안 평타 강화`); }
  else if (s.curse && tg >= 0) { const e = R.enemies[tg]; e.curseUntil = now + s.curse.ms; e.curseMult = s.curse.mult; pop('e', tg, '저주', 'sp'); stMsg(`${s.name}! ${e.name}이(가) 받는 피해 ${s.curse.mult}배`); }
  else if (s.requiem) { R.enemies.forEach((e, ei) => { if (e.hp > 0) hurt('e', ei, ei === tg ? s.dmg : s.requiem.bench, 'big'); }); stMsg(`${s.name}! 적 전체 공격`); }
  else if (tg >= 0) {
    const dmg = s.range ? s.range[0] + Math.floor(Math.random() * (s.range[1] - s.range[0] + 1)) : s.dmg;
    const got = hurt('e', tg, dmg, 'big');
    if (s.steal) healU(i, got);
    stMsg(`${a.d.name}의 ${s.name}!`);
  }
  if (s.heal) healU(i, s.heal);
  if (s.barrier && !(a.barrier > 0)) { a.barrier = s.barrier.amt; pop('a', i, '보호막', 'heal'); }
  if (s.nextBonus) a.bonus = s.nextBonus;
  draw('a', i);
}

function finish(win) {
  const R = ST.run; if (R.over) return; R.over = true;
  const sec = Math.round((performance.now() - R.t0) / 1000);
  $('st-over-t').textContent = win ? '승리!' : '패배';
  $('st-over-p').textContent = win ? `${STAGE.name}에서 ${sec}초 만에 이겼어요. 쓰러진 카드 ${R.allies.filter(a => a.hp <= 0).length}장` : '우리 팀이 모두 쓰러졌어요. 배치를 바꿔서 다시 도전해 보세요.';
  $('st-over').hidden = false;
}

/* ── 버튼 ── */
$('m-story').onclick = storyOpen;
$('st-exit').onclick = () => { ST.tok++; ST.run = null; landscape(false); menu(); };
$('st-team').addEventListener('click', e => {
  if (ST.run) return;
  const b = e.target.closest('[data-s]'); if (!b) return;
  const i = +b.dataset.s;
  if (ST.slots[i]) ST.slots[i] = null;
  ST.sel = i; setupView();
});
$('st-enemy').addEventListener('click', e => {
  if (ST.run) return;
  const b = e.target.closest('[data-k]'); if (!b) return;
  const k = b.dataset.k, at = ST.slots.indexOf(k);
  if (at >= 0) { ST.slots[at] = null; ST.sel = at; return setupView(); } // 이미 배치된 카드는 빼기
  if (ST.slots.filter(Boolean).length >= MAX_TEAM) return stMsg('카드는 5장까지만 배치할 수 있어요.');
  let i = ST.slots[ST.sel] ? ST.slots.findIndex(x => !x) : ST.sel;
  if (i < 0) return;
  ST.slots[i] = k;
  const nx = [...ST.slots.keys()].find(j => j > i && !ST.slots[j]); ST.sel = nx !== undefined ? nx : ST.slots.findIndex(x => !x);
  setupView();
});
$('st-bar').addEventListener('click', e => {
  const go = e.target.closest('[data-act="go"]'); if (go && !ST.run) return startStory();
  const b = e.target.closest('[data-u]'); if (b && ST.run) useSkill(+b.dataset.u);
});
$('st-again').onclick = () => { $('st-over').hidden = true; startStory(); };
$('st-setup').onclick = () => setupView();
