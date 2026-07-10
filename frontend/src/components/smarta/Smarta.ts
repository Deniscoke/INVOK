/**
 * Smarta — global floating AI guide for INVOK.
 *
 * A bottom-right floating button opens a small (non-fullscreen) chat panel with
 * the 2D avatar, chat history, text input, send, microphone (voice input) and
 * per-reply copy. Replies are spoken via TTS with avatar lip-sync when available.
 *
 * Lives on <body>, mounted once at app start, so it survives the hash router's
 * re-render of #app. State is module-local and intentionally simple.
 */
import { createAvatar, type SmartaAvatar } from './avatar';
import { askSmarta, type ChatTurn } from './smartaApi';
import { speak, stopSpeaking } from './tts';

const MAX_INPUT = 1000;
const GREETING = 'Čau! Som Smarta 🦊 Tvoj parťák do školy aj mimo nej. Spýtaj sa ma na hocičo — úlohy, projekty, matiku, slovinu, nápady na výzvu… proste čo treba. 😎';

// Minimal Web Speech API typing (no standard lib types).
interface MinimalRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type RecognitionCtor = new () => MinimalRecognition;
type SpeechWindow = Window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };

let mounted = false;
const messages: ChatTurn[] = [{ role: 'assistant', content: GREETING }];
let open = false;
let busy = false;
let ttsEnabled = true;
let listening = false;

let avatar: SmartaAvatar;
let panel: HTMLElement;
let messagesEl: HTMLElement;
let inputEl: HTMLTextAreaElement;
let micBtn: HTMLButtonElement | null = null;
let recognition: MinimalRecognition | null = null;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COPY_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

function renderMessages(): void {
  const rows = messages
    .map((m, i) => {
      if (m.role === 'user') {
        return `<div class="smarta-msg smarta-msg--user"><div class="smarta-bubble">${escapeHtml(m.content)}</div></div>`;
      }
      return `<div class="smarta-msg smarta-msg--bot">
        <div class="smarta-bubble">${escapeHtml(m.content)}
          <button class="smarta-copy" type="button" data-index="${i}" aria-label="Kopírovať odpoveď" title="Kopírovať">${COPY_ICON}</button>
        </div>
      </div>`;
    })
    .join('');
  const typing = busy
    ? '<div class="smarta-msg smarta-msg--bot"><div class="smarta-bubble smarta-typing"><span></span><span></span><span></span></div></div>'
    : '';
  messagesEl.innerHTML = rows + typing;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setBusy(value: boolean): void {
  busy = value;
  renderMessages();
}

async function send(): Promise<void> {
  const text = inputEl.value.trim().slice(0, MAX_INPUT);
  if (!text || busy) return; // empty-input guard
  stopSpeaking();
  inputEl.value = '';
  autoSize();
  messages.push({ role: 'user', content: text });
  setBusy(true);

  const reply = await askSmarta(messages.slice(-12));
  setBusy(false);
  messages.push({ role: 'assistant', content: reply.reply });
  renderMessages();

  if (ttsEnabled) void speak(reply.reply, avatar);
}

function copyMessage(index: number, btn: HTMLElement): void {
  const msg = messages[index];
  if (!msg) return;
  void navigator.clipboard?.writeText(msg.content).then(() => {
    btn.classList.add('smarta-copy--done');
    window.setTimeout(() => btn.classList.remove('smarta-copy--done'), 1200);
  });
}

function autoSize(): void {
  inputEl.style.height = 'auto';
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
}

function toggleOpen(force?: boolean): void {
  open = force ?? !open;
  panel.classList.toggle('smarta-panel--open', open);
  panel.setAttribute('aria-hidden', String(!open));
  if (open) {
    avatar.preload?.(); // warm up the heavy "open mouth" frame before speaking
    renderMessages();
    inputEl.focus();
  } else if (listening) {
    recognition?.stop();
  }
}

// --- Voice input (Web Speech API, graceful fallback) -----------------------
function setupRecognition(): void {
  const Ctor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
  if (!Ctor || !micBtn) {
    if (micBtn) {
      micBtn.disabled = true;
      micBtn.title = 'Hlasový vstup nie je v tomto prehliadači dostupný';
      micBtn.classList.add('smarta-icon-btn--disabled');
    }
    return;
  }
  recognition = new Ctor();
  recognition.lang = 'sk-SK';
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event): void => {
    const transcript = event.results?.[0]?.[0]?.transcript ?? '';
    if (transcript) {
      inputEl.value = (inputEl.value ? `${inputEl.value} ` : '') + transcript;
      autoSize();
    }
  };
  recognition.onend = (): void => {
    listening = false;
    micBtn?.classList.remove('smarta-icon-btn--active');
  };
  recognition.onerror = (): void => {
    listening = false;
    micBtn?.classList.remove('smarta-icon-btn--active');
  };

  micBtn.addEventListener('click', () => {
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      listening = true;
      micBtn?.classList.add('smarta-icon-btn--active');
    } catch {
      listening = false;
    }
  });
}

export function mountSmarta(): void {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;

  avatar = createAvatar();

  const root = document.createElement('div');
  root.className = 'smarta-root';
  root.innerHTML = `
    <button class="smarta-fab" type="button" aria-label="Otvoriť Smartu" title="Smarta — tvoja AI sprievodkyňa">
      <span class="smarta-fab__avatar"></span>
    </button>
    <section class="smarta-panel" aria-hidden="true" aria-label="Smarta chat">
      <header class="smarta-stage">
        <div class="smarta-stage__tools">
          <button class="smarta-icon-btn smarta-mute" type="button" aria-label="Stlmiť hlas" title="Hlas zap./vyp.">🔊</button>
          <button class="smarta-icon-btn smarta-close" type="button" aria-label="Zavrieť" title="Zavrieť">✕</button>
        </div>
        <span class="smarta-stage__avatar"></span>
        <div class="smarta-stage__name"><strong>Smarta</strong><span>AI sprievodkyňa INVOK</span></div>
      </header>
      <div class="smarta-messages" role="log" aria-live="polite"></div>
      <form class="smarta-input" novalidate>
        <button class="smarta-icon-btn smarta-mic" type="button" aria-label="Hlasový vstup" title="Hlasový vstup">🎤</button>
        <textarea class="smarta-text" rows="1" maxlength="${MAX_INPUT}" placeholder="Napíš Smarte…" aria-label="Správa pre Smartu"></textarea>
        <button class="smarta-send" type="submit" aria-label="Odoslať" title="Odoslať">➤</button>
      </form>
    </section>`;
  document.body.appendChild(root);

  panel = root.querySelector('.smarta-panel') as HTMLElement;
  messagesEl = root.querySelector('.smarta-messages') as HTMLElement;
  inputEl = root.querySelector('.smarta-text') as HTMLTextAreaElement;
  micBtn = root.querySelector('.smarta-mic') as HTMLButtonElement;

  // Big avatar on the panel stage (this one lip-syncs); small one on the FAB.
  (root.querySelector('.smarta-stage__avatar') as HTMLElement).appendChild(avatar.el);
  const fabAvatar = createAvatar();
  (root.querySelector('.smarta-fab__avatar') as HTMLElement).appendChild(fabAvatar.el);

  root.querySelector('.smarta-fab')?.addEventListener('click', () => toggleOpen());
  root.querySelector('.smarta-close')?.addEventListener('click', () => toggleOpen(false));

  const muteBtn = root.querySelector('.smarta-mute') as HTMLButtonElement;
  muteBtn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    muteBtn.textContent = ttsEnabled ? '🔊' : '🔇';
    if (!ttsEnabled) stopSpeaking();
  });

  root.querySelector('.smarta-input')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void send();
  });
  inputEl.addEventListener('input', autoSize);
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  });
  messagesEl.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest('.smarta-copy');
    if (btn) copyMessage(Number(btn.getAttribute('data-index')), btn as HTMLElement);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) toggleOpen(false);
  });

  setupRecognition();
}
