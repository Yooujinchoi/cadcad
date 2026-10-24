/* 스토리 모드 (베타 · 관리자 전용)
   - 가로 화면 · 우리 팀 5장을 뒤/중/앞 줄에 배치 (한 줄 3칸)
   - 평타는 자동, 스킬은 아래 버튼을 눌러서 사용
   - 앞줄 우선 공격: 적은 우리 앞줄부터, 우리는 적의 앞쪽 열부터 때림 */
const LANE_NAME = ['뒤', '중', '앞'];
const MAX_TEAM = 5;
const SKILL_CD = 10000; // 베타: 모든 스킬 쿨타임 10초
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
  stMsg('카드를 끌어서 원하는 칸에 놓으세요. 칸의 카드를 밖으로 끌어내면 빠져요. (최대 5장)');
  $('st-team').innerHTML = teamGrid(i => {
    const k = ST.slots[i];
    return `<div class="st-slot${ST.sel === i ? ' sel' : ''}${k ? ' on' : ''}" data-s="${i}" style="${k ? `--rc:${rar(k).color}` : ''}">${k ? `<img src="${CARDS[k].img}" alt="" draggable="false">` : '+'}</div>`;
  });
  $('st-enemy').innerHTML = `<div class="st-pick">${pickable().map(k => `<button class="st-card${used.includes(k) ? ' used' : ''}" data-k="${k}" style="--rc:${rar(k).color}"><img src="${CARDS[k].img}" alt="" draggable="false"><span>${CARDS[k].name}</span></button>`).join('')}</div>`;
  $('st-bar').innerHTML = `<span class="st-count">${used.length} / ${MAX_TEAM}장</span><button class="btn st-go" data-act="go"${used.length ? '' : ' disabled'}>전투 시작</button>`;
}

/* ── 전투 ── */
function unit(k, i) {
  const d = CARDS[k];
  return { k, d, lane: Math.floor(i / 3), row: i % 3, slot: i, hp: d.hp, max: d.hp, cdEnd: SKILL_CD, next: 400 + Math.random() * 500, barrier: 0, bonus: 0 };
}
function startStory() {
  ST.tok++;
  const allies = ST.slots.map((k, i) => k && unit(k, i)).filter(Boolean);
  const enemies = STAGE.enemies.map(e => ({ ...e, max: e.hp, next: 700 + Math.random() * 700, n: 0 }));
  ST.run = { allies, enemies, t0: performance.now(), over: false, tok: ST.tok };
  battleView(); stMsg(`${STAGE.name}! 평타는 자동이에요. 스킬은 10초마다 아래 버튼으로 쓸 수 있어요.`);
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
  $('st-bar').innerHTML = R.allies.map((a, i) => `<button class="st-sk" data-u="${i}" id="sk${i}" style="--rc:${rar(a.k).color}"><img src="${a.d.img}" alt=""><span><b>${a.d.skill.name}</b><small>${a.d.name}</small><div class="st-sp"><i></i></div></span><em class="st-cd"></em></button>`).join('');
  R.allies.forEach((a, i) => draw('a', i)); R.enemies.forEach((e, i) => draw('e', i));
}
function draw(side, i) {
  const R = ST.run, u = side === 'a' ? R.allies[i] : R.enemies[i], el = $(side === 'a' ? 'au' + i : 'eu' + i);
  if (!el) return;
  const tot = Math.max(u.max, u.hp + (u.barrier || 0));
  el.querySelector('.st-hp i').style.width = (u.hp / tot * 100) + '%';
  const s = el.querySelector('.st-hp s'); if (s) { s.style.left = (u.hp / tot * 100) + '%'; s.style.width = ((u.barrier || 0) / tot * 100) + '%'; }
  el.classList.toggle('dead', u.hp <= 0);
  if (side === 'a') drawCd(i);
}
function drawCd(i) { // 스킬 쿨타임 표시 (카드 아래 줄 + 스킬 버튼)
  const R = ST.run, a = R.allies[i], left = Math.max(0, a.cdEnd - (performance.now() - R.t0)), p = (1 - left / SKILL_CD) * 100;
  const el = $('au' + i); if (el) el.querySelector('.st-sp i').style.width = p + '%';
  const b = $('sk' + i); if (!b) return;
  b.querySelector('.st-sp i').style.width = p + '%';
  b.classList.toggle('ready', !left && a.hp > 0); b.disabled = a.hp <= 0;
  b.querySelector('.st-cd').textContent = a.hp <= 0 ? '' : left ? Math.ceil(left / 1000) + '초' : '사용!';
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
  R.allies.forEach((a, i) => drawCd(i));
  if (!R.enemies.some(e => e.hp > 0)) finish(true);
  else if (!R.allies.some(a => a.hp > 0)) finish(false);
}

/* 스킬: 기존 카드 스킬을 여러 명 전투에 맞게 적용 */
function useSkill(i) {
  const R = ST.run; if (!R || R.over) return;
  const a = R.allies[i], s = a.d.skill, now = performance.now();
  if (a.hp <= 0) return;
  const t = now - R.t0;
  if (t < a.cdEnd) return stMsg(`${a.d.name}: ${Math.ceil((a.cdEnd - t) / 1000)}초 뒤에 쓸 수 있어요.`);
  a.cdEnd = t + SKILL_CD;
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
/* ── 끌어다 놓기 배치 (터치·마우스 모두) ── */
let drag = null;
const portrait = () => matchMedia('(orientation: portrait)').matches;
function slotAt(x, y) {
  if (drag) drag.g.style.visibility = 'hidden';
  const el = document.elementFromPoint(x, y);
  if (drag) drag.g.style.visibility = '';
  return el && el.closest('#st-team [data-s]');
}
function beginDrag(e, k, from) {
  if (ST.run || drag) return;
  e.preventDefault();
  const g = document.createElement('img');
  g.className = 'st-ghost' + (portrait() ? ' rot' : ''); g.src = CARDS[k].img; g.alt = '';
  document.body.appendChild(g);
  drag = { k, from, g, x0: e.clientX, y0: e.clientY, moved: false };
  moveDrag(e);
}
function moveDrag(e) {
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true;
  drag.g.style.left = e.clientX + 'px'; drag.g.style.top = e.clientY + 'px';
  const over = slotAt(e.clientX, e.clientY);
  document.querySelectorAll('#st-team .over').forEach(x => { if (x !== over) x.classList.remove('over'); });
  if (over) over.classList.add('over');
}
function endDrag(e) {
  if (!drag) return;
  const d = drag, over = e ? slotAt(e.clientX, e.clientY) : null;
  drag = null; d.g.remove();
  if (!e) return setupView();
  const used = ST.slots.filter(Boolean).length, full = () => stMsg('카드는 5장까지만 배치할 수 있어요.');
  if (!d.moved) { // 그냥 누르면: 칸의 카드는 빼고, 목록 카드는 빈 칸에 넣기
    if (d.from >= 0) ST.slots[d.from] = null;
    else if (ST.slots.includes(d.k)) ST.slots[ST.slots.indexOf(d.k)] = null;
    else if (used < MAX_TEAM) ST.slots[ST.slots.findIndex(x => !x)] = d.k;
    else { setupView(); return full(); }
    return setupView();
  }
  if (over) {
    const i = +over.dataset.s, cur = ST.slots[i], old = d.from >= 0 ? d.from : ST.slots.indexOf(d.k);
    if (old >= 0) { ST.slots[old] = cur; ST.slots[i] = d.k; } // 자리 옮기기 / 서로 바꾸기
    else if (cur || used < MAX_TEAM) ST.slots[i] = d.k;        // 빈 칸이면 추가, 찬 칸이면 교체
    else { setupView(); return full(); }
  } else if (d.from >= 0) ST.slots[d.from] = null;             // 칸 밖으로 끌어내면 빼기
  setupView();
}
$('st-team').addEventListener('pointerdown', e => { const s = e.target.closest('[data-s]'); if (s && ST.slots[+s.dataset.s]) beginDrag(e, ST.slots[+s.dataset.s], +s.dataset.s); });
$('st-enemy').addEventListener('pointerdown', e => { const c = e.target.closest('[data-k]'); if (c) beginDrag(e, c.dataset.k, -1); });
document.addEventListener('pointermove', moveDrag);
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', () => endDrag(null));
$('st-bar').addEventListener('click', e => {
  const go = e.target.closest('[data-act="go"]'); if (go && !ST.run) return startStory();
  const b = e.target.closest('[data-u]'); if (b && ST.run) useSkill(+b.dataset.u);
});
$('st-again').onclick = () => { $('st-over').hidden = true; startStory(); };
$('st-setup').onclick = () => setupView();
