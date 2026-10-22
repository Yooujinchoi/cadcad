/* 멀티: 방 목록 · 방 만들기(비밀번호) · 방장 시작 · 실시간 1대1 (Firebase Realtime Database) */
const rdb = () => firebase.database();
let R = null; // 현재 방 { id, ref, host, started, over, offs }

const ask = (title, text, ph, cb, max = 20) => {
  panel(title, text, '확인', () => cb($('p-in').value), '취소');
  const i = $('p-in'); i.value = ''; i.placeholder = ph; i.maxLength = max; i.inputMode = 'text'; i.hidden = false;
};
const noCards = () => panel('카드가 없어요', '뽑기에서 카드를 먼저 뽑아주세요.', '확인');

/* ── 로비 ── */
function lobby() {
  show('s-lobby');
  const ref = rdb().ref('rooms');
  const cb = ref.on('value', snap => {
    if ($('s-lobby').hidden) return ref.off('value', cb);
    const rooms = Object.entries(snap.val() || {}).filter(([, r]) => r.state === 'wait' && r.hostName);
    $('l-list').innerHTML = rooms.map(([id, r]) => `<button class="mbtn" data-id="${id}"><span>${avHtml(((r.players || {})[r.host] || {}).photo, 'sm')} ${r.pw ? '🔒 ' : ''}${esc(r.hostName)}님의 방</span> <small>${Object.keys(r.players || {}).length}/2</small></button>`).join('')
      || '<p class="empty">열린 방이 없어요.<br>방을 만들어 보세요!</p>';
  }, e => toast('방 목록 오류: ' + e.code));
}
$('m-multi').onclick = lobby;

$('l-make').onclick = () => ask('방 만들기', '방 비밀번호를 정하세요.\n비워두면 누구나 들어올 수 있어요.', '비밀번호 (선택)', pw => makeRoom(pw.trim()));

async function makeRoom(pw) {
  const types = myDeck(); if (!types.length) return noCards();
  const ref = rdb().ref('rooms').push();
  try {
    await ref.set({ host: uid(), hostName: U.name, pw: pw ? sha256(`${pw}:${ref.key}`) : '', state: 'wait', players: { [uid()]: { name: U.name, deck: types, photo: U.photo || '' } } });
  } catch (e) { return toast('방 만들기 실패: ' + e.code); }
  ref.onDisconnect().remove();
  enterRoom(ref.key, true);
}

$('l-list').onclick = e => { const b = e.target.closest('[data-id]'); if (b) tryJoin(b.dataset.id); };

async function tryJoin(id) {
  const r = (await rdb().ref('rooms/' + id).once('value')).val();
  if (!r || r.state !== 'wait') return toast('방이 사라졌어요.');
  if (!r.pw) return joinRoom(id);
  ask('비밀번호 입력', '이 방은 잠겨 있어요.', '비밀번호', v => sha256(`${v.trim()}:${id}`) === r.pw ? joinRoom(id) : toast('비밀번호가 틀렸어요.'));
}

async function joinRoom(id) {
  const types = myDeck(); if (!types.length) return noCards();
  const me = uid();
  const res = await rdb().ref(`rooms/${id}/players`).transaction(p => {
    p = p || {};
    if (!p[me] && Object.keys(p).length >= 2) return;
    p[me] = { name: U.name, deck: types, photo: U.photo || '' };
    return p;
  });
  if (!res.committed) return toast('방이 가득 찼어요.');
  rdb().ref(`rooms/${id}/players/${me}`).onDisconnect().remove();
  enterRoom(id, false);
}

/* ── 대기실 ── */
function enterRoom(id, host) {
  const ref = rdb().ref('rooms/' + id);
  R = { id, ref, host, started: false, over: false, offs: [] };
  show('s-room');
  const cb = ref.on('value', snap => onRoom(snap.val()));
  R.offs.push(() => ref.off('value', cb));
}

function onRoom(r) {
  if (!R) return;
  if (!r) {
    if (!R.started) { toast('방이 사라졌어요.'); closeRoom(); lobby(); }
    else if (!R.over) { R.over = true; end(true); } // 전투 중 상대가 나감
    return;
  }
  if (R.started) {
    if (r.result && !R.over) { R.over = true; if (r.result.loser !== uid()) end(true); }
    return;
  }
  const ps = Object.entries(r.players || {}).sort(([a]) => a === r.host ? -1 : 1);
  $('r-title').textContent = `${r.hostName}님의 방${r.pw ? ' 🔒' : ''}`;
  $('r-slots').innerHTML = [0, 1].map(i => { const p = ps[i]; return `<div class="slot${p ? ' on' : ''}">${p ? (p[0] === r.host ? '👑 ' : '') + avHtml(p[1].photo, 'sm') + esc(p[1].name) : '대기 중...'}</div>`; }).join('');
  $('r-start').hidden = !R.host; $('r-start').disabled = ps.length < 2;
  $('r-msg').textContent = R.host ? (ps.length < 2 ? '상대가 들어오길 기다리는 중이에요.' : '준비 완료! 게임을 시작하세요.') : '방장이 게임을 시작할 때까지 기다려 주세요.';
  if (r.state === 'play' && ps.length === 2) startPvp(ps);
}

$('r-start').onclick = () => { if (R && R.host) R.ref.update({ state: 'play' }); };
$('r-leave').onclick = () => { closeRoom(); lobby(); };

function closeRoom() {
  if (!R) return;
  const r = R; R = null;
  r.offs.forEach(f => f());
  r.ref.child('result').onDisconnect().cancel();
  if (r.host) { r.ref.onDisconnect().cancel(); r.ref.remove(); }
  else { r.ref.child('players/' + uid()).onDisconnect().cancel(); r.ref.child('players/' + uid()).remove(); }
}

/* ── 실시간 대결 ── */
function startPvp(ps) {
  const me = uid(), mine = ps.find(([k]) => k === me)[1], [fid, foe] = ps.find(([k]) => k !== me);
  const evRef = R.ref.child('ev'), stRef = R.ref.child('state');
  R.started = true; R.over = false;
  R.ref.child('result').onDisconnect().set({ loser: me });

  const c1 = stRef.child(fid).on('value', s => { // 상대 상태 → 상대 체력바
    const v = s.val(), b = S.bot;
    if (!v || !b) return;
    if (v.hp < b.hp && v.ci === (b.ci ?? v.ci)) {
      floatTxt($('enemy'), '-' + (b.hp - v.hp), 'dmg');
      restart($('bot'), 'hurt'); setTimeout(() => $('bot').classList.remove('hurt'), 300);
    }
    if ((v.blk || 0) > (b.blk || 0)) floatTxt($('enemy'), '방어!', 'dmg blk');
    if (CARDS[v.ty] && v.ty !== b.ty) $('bot').style.backgroundImage = `url(${CARDS[v.ty].img})`;
    Object.assign(b, { cost: v.cost || 100, ty: v.ty, ci: v.ci, hp: v.hp, max: v.max, en: v.en, left: v.left, blk: v.blk || 0 });
    $('bname').textContent = `${foe.name} (남은 카드 ${v.left})`;
    renderBot();
  });
  const c2 = evRef.on('child_added', s => { const e = s.val(); if (e && e.u !== me) foeAttack(e); });
  R.offs.push(() => stRef.child(fid).off('value', c1), () => evRef.off('child_added', c2));

  battle({ who: U.name, tag: '멀티', botName: foe.name, foe: { deck: foe.deck, photo: foe.photo }, bot: 100, p: { windup: 900, shield: 0 }, skill: true, shield: true, quit: true, deck: mine.deck, delay: 3000,
    hint: () => '상대와 실시간 대결! 평타로 게이지를 모아 스킬을 쓰세요.',
    pvp: { send: (k, d, x) => evRef.push({ u: me, k, d, x: x || 0 }) },
    sync: () => { const c = S.cards[S.cur]; stRef.child(me).set({ ty: c.type, ci: S.cur, cost: CARDS[c.type].skill.cost, hp: c.hp, max: CARDS[c.type].hp, en: c.en, left: S.cards.filter(x => x.hp > 0).length, blk: S.myBlk }); },
    dead: () => { if (R) { R.over = true; R.ref.child('result').set({ loser: me }); } },
    exit: () => { if (R) { R.over = true; R.ref.child('result').set({ loser: me }); } finishPvp(false); },
    win: () => finishPvp(true), lose: () => finishPvp(false) });
}

function finishPvp(win) {
  closeRoom();
  panel(win ? '승리!' : '패배', win ? '상대를 쓰러뜨렸어요!' : '카드가 모두 쓰러졌어요.', '멀티 로비로', lobby, '메뉴로', menu);
}
