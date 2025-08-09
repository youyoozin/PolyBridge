// ===== 새로운 의견 모달 동작 =====
// (중복 선언 방지, 한 번만 선언)
const openBtn = document.getElementById('newOpinion');
const ovl = document.getElementById('opinionOverlay');
const dlg = document.getElementById('opinionModal');
const btnClose = document.getElementById('opinionClose');
const btnShare = document.getElementById('opinionShare');
const btnSubmit = document.getElementById('opinionSubmit');
const claim = document.getElementById('opinionClaim');
const counter = document.getElementById('opinionCounter');
const reason = document.getElementById('opinionReason');
const source = document.getElementById('opinionSource');

const MAX = 100;

// 예시: 실제 사용자 정보 (실제 서비스에서는 로그인 정보 등에서 가져와야 함)
const myNick = localStorage.getItem('myNick') || '홍길동';
const myProfile = localStorage.getItem('myProfile') || './assets/default-profile.png';

function updateCounter() {
  if (!claim || !counter) return;
  let v = (claim.value || '').slice(0, MAX);
  if (v.length !== claim.value.length) claim.value = v;
  counter.textContent = v.length + '/100';
}

function closeModal() {
  if (!ovl) return;
  ovl.classList.remove('show');
  ovl.setAttribute('aria-hidden', 'true');
  if (claim) claim.value = '';
  if (reason) reason.value = '';
  if (source) source.value = '';
  updateCounter();
}

function openModal() {
  if (!ovl) return;
  // 모달 내 닉네임/프로필 동적 할당
  const nickEl = document.getElementById('opinionNick');
  const avatarEl = document.getElementById('opinionAvatar');
  if (nickEl) nickEl.textContent = myNick;
  if (avatarEl) {
    if (!myProfile || myProfile === 'profile1.png' || myProfile === '프로필.png' || myProfile === './assets/프로필.png') {
      avatarEl.src = './assets/default-profile.png';
    } else {
      avatarEl.src = myProfile;
    }
  }
  ovl.classList.add('show');
  ovl.removeAttribute('aria-hidden');
  if (claim) {
    claim.value = '';
    claim.focus();
  }
  if (reason) reason.value = '';
  if (source) source.value = '';
  updateCounter();
}

if (openBtn && ovl) {
  openBtn.addEventListener('click', e => {
    openModal();
  });
}
if (btnClose) btnClose.addEventListener('click', closeModal);
if (ovl) ovl.addEventListener('click', e => { if (e.target === ovl) closeModal(); });
if (claim) {
  claim.addEventListener('input', updateCounter);
  claim.addEventListener('keyup', updateCounter);
}
document.addEventListener('keydown', e => {
  if (ovl && ovl.classList.contains('show') && e.key === 'Escape') closeModal();
});
if (btnSubmit) btnSubmit.addEventListener('click', () => {
  const c = (claim && claim.value.trim()) || '';
  const r = (reason && reason.value.trim()) || '';
  const s = (source && source.value.trim()) || '';
  if (!c) {
    alert('생각(주장)을 입력해 주세요.');
    if (claim) claim.focus();
    return;
  }
  if ([c, r, s].some(profanityCheck)) {
    alert('비속어가 포함되어 있습니다.');
    return;
  }
  // 메시지 추가 (카드 추가)
  if (typeof addMessage === 'function') {
    addMessage(c, true); // reason/source는 저장하지 않음(확장 시 수정)
    renderCards && renderCards();
  } else {
    // fallback: 배열에 push 후 renderCards()
    if (!window._opinions) window._opinions = [];
    window._opinions.push({ text: c, reason: r, source: s, ts: Date.now() });
    if (typeof renderCards === 'function') renderCards();
  }
  closeModal();
});
// profanityCheck 훅 (비속어 필터 연결용, 현재는 항상 false)
function profanityCheck(text) {
  return false;
}

// 주제 및 메시지 데이터
const TOPICS = [
  { id: 't1', text: '민생지원금은 필요한가?' },
  { id: 't2', text: '청년 기본소득 도입의 장단점은?' },
  { id: 't3', text: '선거연령 하향, 찬반은?' }
];

const STORAGE_KEY = 'room_messages_v1';

// 메시지 데이터 복구 또는 초기화
let messagesByTopic = {
  t1: [
    { me: true, text: '예시 의견(나)', ts: Date.now() - 60000 },
    { me: false, text: '예시 의견(상대)', ts: Date.now() - 30000 }
  ],
  t2: [],
  t3: []
};
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      messagesByTopic = { ...messagesByTopic, ...parsed };
    }
  }
} catch {}

// 상태
let currentTopic = 't1';


// DOM
const topicList = document.getElementById('topicList');
const cardGrid = document.querySelector('.card-grid');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const newOpinionBtn = document.getElementById('newOpinion');
const roomTitle = document.querySelector('.room-title');

const MAX_LEN = 100;
function clamp100(s) {
  if (!s) return '';
  const t = s.trim();
  return t.length > MAX_LEN ? t.slice(0, MAX_LEN).trim() + '…' : t;
}

// ====== Presence(접속 표시) 기능 ======
const PRESENCE_KEY = 'presence_v1';
const PRESENCE_TIMEOUT = 20000; // 20초
const HEARTBEAT_INTERVAL = 10000; // 10초
const presenceChannel = new BroadcastChannel('presence');

// 유저 정보 (없으면 임시 생성)
let user = null;
try {
  user = JSON.parse(localStorage.getItem('user'));
} catch {}
if (!user || !user.userId) {
  user = { userId: 'u_' + Math.random().toString(36).slice(2, 10), nickname: '익명' };
  localStorage.setItem('user', JSON.stringify(user));
}
const myUserId = user.userId;

function loadPresence() {
  try {
    return JSON.parse(localStorage.getItem(PRESENCE_KEY)) || {};
  } catch { return {}; }
}
function savePresence(map) {
  localStorage.setItem(PRESENCE_KEY, JSON.stringify(map));
}
function setOnline(roomId, myId) {
  const map = loadPresence();
  if (!map[roomId]) map[roomId] = {};
  map[roomId][myId] = { ts: Date.now() };
  savePresence(map);
  presenceChannel.postMessage({ type: 'enter', roomId, userId: myId, ts: Date.now() });
}
function setHeartbeat(roomId, myId) {
  const map = loadPresence();
  if (!map[roomId]) map[roomId] = {};
  map[roomId][myId] = { ts: Date.now() };
  savePresence(map);
  presenceChannel.postMessage({ type: 'heartbeat', roomId, userId: myId, ts: Date.now() });
}
function setOffline(roomId, myId) {
  const map = loadPresence();
  if (map[roomId]) {
    delete map[roomId][myId];
    if (Object.keys(map[roomId]).length === 0) delete map[roomId];
    savePresence(map);
    presenceChannel.postMessage({ type: 'leave', roomId, userId: myId, ts: Date.now() });
  }
}
function handlePresenceEvent(e) {
  if (!e.data || !e.data.roomId) return;
  // 최신화
  const map = loadPresence();
  if (!map[e.data.roomId]) map[e.data.roomId] = {};
  if (e.data.type === 'leave') {
    delete map[e.data.roomId][e.data.userId];
    if (Object.keys(map[e.data.roomId]).length === 0) delete map[e.data.roomId];
  } else {
    map[e.data.roomId][e.data.userId] = { ts: e.data.ts };
  }
  savePresence(map);
  updateBulbs();
}

function getOtherOnlineUser(roomId, exceptUserId) {
  const map = loadPresence();
  const now = Date.now();
  if (!map[roomId]) return null;
  return Object.entries(map[roomId])
    .filter(([uid, v]) => uid !== exceptUserId && now - v.ts <= PRESENCE_TIMEOUT)
    .map(([uid]) => uid)[0] || null;
}

function updateBulbs() {
  // 카드 내 .bulb 상태 갱신 (1:1 기준)
  const cards = topicList.querySelectorAll('li');
  cards.forEach((li, idx) => {
    let bulb = li.querySelector('.bulb');
    if (!bulb) return;
    const topicId = TOPICS[idx].id;
    const otherOnline = getOtherOnlineUser(topicId, myUserId);
    bulb.classList.toggle('on', !!otherOnline);
    bulb.classList.toggle('off', !otherOnline);
  });
}

// 하트비트 타이머
let heartbeatTimer = null;
function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  setOnline(currentTopic, myUserId);
  heartbeatTimer = setInterval(() => {
    setHeartbeat(currentTopic, myUserId);
    updateBulbs();
  }, HEARTBEAT_INTERVAL);
}
function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  setOffline(currentTopic, myUserId);
}

// unload/이탈 처리
window.addEventListener('beforeunload', () => {
  setOffline(currentTopic, myUserId);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') setOffline(currentTopic, myUserId);
  else setOnline(currentTopic, myUserId);
});
presenceChannel.onmessage = handlePresenceEvent;

// 주제 목록 렌더링
function renderTopics() {
  topicList.innerHTML = '';
  TOPICS.forEach(t => {
    const li = document.createElement('li');
    li.className = currentTopic === t.id ? 'active' : '';
    li.tabIndex = 0;
    // 닉네임+전구: 내 닉네임(1:1 기준, 카드마다 다르게 보여도 됨)
    const nick = document.createElement('span');
    nick.className = 'nick';
    nick.textContent = user.nickname || '익명';
    // 전구 아이콘
    const bulb = document.createElement('span');
    bulb.className = 'bulb off';
    bulb.title = '상대방 접속 여부';
    bulb.textContent = '💡';
    // 카드 텍스트
    const label = document.createElement('span');
    label.textContent = t.text;
    label.style.marginLeft = '8px';
    li.appendChild(nick);
    li.appendChild(bulb);
    li.appendChild(label);
    li.setAttribute('data-room-id', t.id);
    li.addEventListener('click', () => {
      if (currentTopic !== t.id) {
        // 이전 방 오프라인 처리
        setOffline(currentTopic, myUserId);
        currentTopic = t.id;
        // 타이틀 변경
        if (roomTitle) roomTitle.textContent = t.text;
        renderTopics();
        renderChat && renderChat();
        renderCards && renderCards();
        setOnline(currentTopic, myUserId);
        startHeartbeat();
        updateBulbs();
      }
    });
    topicList.appendChild(li);
  });
  updateBulbs();
}


// 카드(채팅방 목록) 렌더링
function renderCards() {
  if (!cardGrid) return;
  cardGrid.innerHTML = '';
  (messagesByTopic[currentTopic] || []).forEach(msg => {
    const card = document.createElement('article');
    card.className = 'chat-card';

    // card-head
    const head = document.createElement('div');
    head.className = 'card-head';
    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.alt = '프로필';
    avatar.src = msg.profile || './assets/default-profile.png';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const nick = document.createElement('span');
    nick.className = 'nick';
    nick.textContent = msg.nick || (msg.me ? user.nickname : '상대방');
    const bulb = document.createElement('span');
    bulb.className = 'bulb off';
    bulb.setAttribute('aria-label', 'presence');
    bulb.title = '접속 상태';
    bulb.textContent = '💡';
    meta.appendChild(nick);
    meta.appendChild(bulb);
    head.appendChild(avatar);
    head.appendChild(meta);
    card.appendChild(head);

    // card-body
    const body = document.createElement('div');
    body.className = 'card-body';
    const claim = document.createElement('p');
    claim.className = 'claim-text';
    claim.textContent = clamp100(msg.text);
    body.appendChild(claim);
    card.appendChild(body);

    cardGrid.appendChild(card);
  });
  updateBulbs();
}

// 입력폼 maxlength 및 실시간 100자 제한
if (messageInput) {
  messageInput.setAttribute('maxlength', MAX_LEN);
  messageInput.addEventListener('keyup', e => {
    if (messageInput.value.length > MAX_LEN) {
      messageInput.value = messageInput.value.slice(0, MAX_LEN);
    }
  });
}

function addMessage(text, me = true) {
  messagesByTopic[currentTopic] = messagesByTopic[currentTopic] || [];
  messagesByTopic[currentTopic].push({
    me,
    text: clamp100(text),
    ts: Date.now(),
    nick: me ? myNick : '상대방',
    profile: me ? myProfile : './assets/default-profile.png'
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesByTopic));
}


// 입력 폼 핸들러
chatForm.addEventListener('submit', e => {
  e.preventDefault();
  let text = messageInput.value.trim();
  if (!text) return;
  if (profanityCheck(text)) {
    alert('비속어가 포함되어 있습니다.');
    return;
  }
  text = clamp100(text);
  addMessage(text, true);
  renderCards();
  messageInput.value = '';
  messageInput.focus();
});




// 초기 렌더
renderTopics();
if (roomTitle && TOPICS.find(t => t.id === currentTopic)) {
  roomTitle.textContent = TOPICS.find(t => t.id === currentTopic).text;
}
renderCards();
setOnline(currentTopic, myUserId);
startHeartbeat();
