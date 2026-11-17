(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const socket = io({ transports: ['websocket', 'polling'] });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let roomId = '';
  let secret = '';
  let cryptoKey = null;
  let joined = false;

  const toB64Url = bytes => {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const fromB64Url = str => {
    const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    return Uint8Array.from(atob(padded), ch => ch.charCodeAt(0));
  };
  const randomToken = bytes => toB64Url(crypto.getRandomValues(new Uint8Array(bytes)));
  const fullCode = () => `${roomId}.${secret}`;
  const inviteUrl = () => `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}#key=${encodeURIComponent(secret)}`;

  async function importKey(keyText) {
    const raw = fromB64Url(keyText);
    if (raw.byteLength !== 32) throw new Error('Invalid key length');
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(plainText) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoder.encode(plainText));
    return { iv: toB64Url(iv), ciphertext: toB64Url(new Uint8Array(ciphertext)) };
  }
  async function decrypt(payload) {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64Url(payload.iv) }, cryptoKey, fromB64Url(payload.ciphertext));
    return decoder.decode(plaintext);
  }
  function showError(message) { $('lobbyError').textContent = message || ''; }
  function setPeer(online) {
    $('peerStatus').replaceChildren();
    const dot = document.createElement('span'); dot.className = 'dot' + (online ? ' on' : '');
    const label = document.createElement('span'); label.textContent = online ? 'Other person connected' : 'Waiting for the other person';
    $('peerStatus').append(dot, label);
  }
  function addMessage(text, mine, sentAt) {
    const bubble = document.createElement('div'); bubble.className = 'bubble ' + (mine ? 'mine' : 'theirs');
    bubble.appendChild(document.createTextNode(text));
    const time = document.createElement('span'); time.className = 'time';
    time.textContent = new Date(sentAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.appendChild(time); $('messages').appendChild(bubble); $('messages').scrollTop = $('messages').scrollHeight;
  }
  function showChat() {
    $('lobby').style.display = 'none'; $('chat').style.display = 'flex';
    $('activeCode').value = fullCode(); $('messages').replaceChildren(); setPeer(false); $('messageInput').focus();
  }
  function parseInvite(input) {
    const value = input.trim();
    if (!value) throw new Error('Paste an invite link or full room code.');
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      const rid = url.searchParams.get('room') || '';
      const key = new URLSearchParams(url.hash.slice(1)).get('key') || '';
      return { room: rid, key };
    }
    const match = value.match(/^([a-f0-9]{32})\.([A-Za-z0-9_-]{43})$/);
    if (match) return { room: match[1], key: match[2] };
    throw new Error('Use the invite link or full code in the format roomID.secretKey.');
  }
  async function enterRoom(id, key) {
    showError('');
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      showError('HTTPS is required for secure browser encryption. Deploy the site with HTTPS.'); return;
    }
    if (!/^[a-f0-9]{32}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(key)) {
      showError('Invite link or room code is invalid.'); return;
    }
    try { cryptoKey = await importKey(key); }
    catch (_error) { showError('This browser could not load the encryption key.'); return; }
    roomId = id; secret = key;
    socket.emit('join-room', roomId, result => {
      if (!result || !result.ok) { cryptoKey = null; roomId = ''; secret = ''; showError(result?.error || 'Could not join room.'); return; }
      joined = true;
      history.replaceState(null, '', `${location.pathname}?room=${encodeURIComponent(roomId)}`);
      showChat(); setPeer(result.count > 1);
    });
  }

  $('create').addEventListener('click', async () => {
    try {
      // A hex room ID is easy to validate server-side and independent from the secret.
      roomId = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      secret = randomToken(32);
      await enterRoom(roomId, secret);
      $('roomCode').value = fullCode();
    } catch (_error) { showError('Could not create a secure room. Try a modern browser.'); }
  });
  $('join').addEventListener('click', () => {
    try { const invite = parseInvite($('roomCode').value); enterRoom(invite.room, invite.key); }
    catch (error) { showError(error.message); }
  });
  $('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(fullCode()); $('copy').textContent = 'Copied!'; setTimeout(() => $('copy').textContent = 'Copy code', 1300); }
    catch (_error) { $('activeCode').select(); document.execCommand('copy'); }
  });
  $('share').addEventListener('click', async () => {
    const url = inviteUrl();
    try {
      if (navigator.share) await navigator.share({ title: 'aapka sathi private chat', text: 'Join my private chat using this one-time invite link.', url });
      else { await navigator.clipboard.writeText(url); $('share').textContent = 'Link copied!'; setTimeout(() => $('share').textContent = 'Share invite', 1300); }
    } catch (_error) { /* Share sheet dismissed or clipboard unavailable. */ }
  });
  $('leave').addEventListener('click', () => { joined = false; socket.disconnect(); roomId = ''; secret = ''; cryptoKey = null; location.href = location.pathname; });
  $('sendForm').addEventListener('submit', async event => {
    event.preventDefault(); const text = $('messageInput').value.trim();
    if (!text || !joined || !cryptoKey || !socket.connected) return;
    $('send').disabled = true;
    try {
      const payload = await encrypt(text);
      socket.emit('encrypted-message', payload);
      addMessage(text, true, Date.now()); $('messageInput').value = '';
    } catch (_error) { showError('Could not encrypt/send this message. Check your connection and try again.'); }
    finally { $('send').disabled = false; $('messageInput').focus(); }
  });
  socket.on('encrypted-message', async payload => {
    if (!joined || !cryptoKey) return;
    try { addMessage(await decrypt(payload), false, payload.sentAt); }
    catch (_error) { addMessage('[Unable to decrypt this message. Check that the invite key matches.]', false, payload.sentAt); }
  });
  socket.on('peer-status', state => setPeer(!!state.online));
  socket.on('disconnect', () => { if (joined) setPeer(false); });
  socket.on('connect', () => {
    if (joined && roomId) socket.emit('join-room', roomId, result => { if (result?.ok) setPeer(result.count > 1); });
  });

  // Invite secret is in URL fragment; the browser never includes it in HTTP requests.
  try {
    const url = new URL(location.href);
    const id = url.searchParams.get('room');
    const key = new URLSearchParams(url.hash.slice(1)).get('key');
    if (id && key) enterRoom(id, key);
  } catch (_error) { /* Ignore malformed links and leave the lobby visible. */ }
})();
