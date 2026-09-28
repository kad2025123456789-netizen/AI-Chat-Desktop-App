import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import { FiPlus, FiSend, FiPaperclip, FiSettings, FiMenu, FiTrash2, FiCopy, FiCheck, FiZap, FiX } from 'react-icons/fi';
import axios from 'axios';
import './styles.css';

const DEFAULTS = {
  endpoint: 'https://api.z.ai/api/paas/v4/chat/completions',
  model: 'glm-5.2',
  apiKey: '',
  demoMode: true,
  system: 'أنت مساعد ذكي ومفيد. أجب بالعربية بوضوح وصدق، ولا تدّعي تنفيذ شيء لم تنفذه.'
};
const makeId = () => crypto.randomUUID();
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };

function demoReply(text) {
  if (/مرحبا|السلام|اهلا|أهلا/i.test(text)) return 'مرحباً بك! أنا وضع التجربة المحلي. اكتب أي سؤال وسأحاكي تفاعلاً فورياً دون مفتاح API.';
  if (/صورة|صور/i.test(text)) return 'أستطيع في وضع التجربة إعداد وصف للصورة، لكن التوليد الفعلي يحتاج مزود صور متاحاً. جرّب كتابة: صورة لمدينة مستقبلية عند الغروب.';
  return `فهمت طلبك: «${text}»\n\nهذا رد تجريبي محلي حتى تتمكن من تجربة الواجهة بسهولة. عند إيقاف «الوضع التجريبي» وإضافة اعتماد Z.ai صالح، سيُرسل السؤال فعلياً إلى النموذج المحدد.`;
}

function App() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...load('aichat-settings', {}) }));
  const [chats, setChats] = useState(() => load('aichat-chats', []));
  const [active, setActive] = useState(() => localStorage.getItem('aichat-active') || '');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState('');
  const [status, setStatus] = useState('');
  const bottom = useRef(null);
  const fileRef = useRef(null);
  const current = chats.find(chat => chat.id === active) || null;

  useEffect(() => { localStorage.setItem('aichat-chats', JSON.stringify(chats)); }, [chats]);
  useEffect(() => { if (active) localStorage.setItem('aichat-active', active); bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [chats, active]);
  useEffect(() => { if (!active && !chats.length) createChat(); else if (!active && chats[0]) setActive(chats[0].id); }, []);

  const createChat = () => {
    const chat = { id: makeId(), title: 'محادثة جديدة', messages: [], created: Date.now() };
    setChats(list => [chat, ...list]); setActive(chat.id);
  };
  const updateCurrent = fn => setChats(list => list.map(chat => chat.id === active ? fn(chat) : chat));

  const send = async (value = input) => {
    const text = value.trim();
    if (!text || busy) return;
    const user = { id: makeId(), role: 'user', content: text, time: Date.now() };
    const history = [...(current?.messages || []), user];
    updateCurrent(chat => ({ ...chat, title: chat.messages.length ? chat.title : text.slice(0, 30) + (text.length > 30 ? '...' : ''), messages: history }));
    setInput(''); setBusy(true);

    if (settings.demoMode) {
      setStatus('🟣 وضع التجربة المحلي');
      window.setTimeout(() => {
        updateCurrent(chat => ({ ...chat, messages: [...chat.messages, { id: makeId(), role: 'assistant', content: demoReply(text), time: Date.now() }] }));
        setBusy(false); setStatus('');
      }, 700);
      return;
    }

    if (!settings.apiKey.trim()) { setShowSettings(true); setStatus('أضف مفتاح Z.ai أو فعّل وضع التجربة'); setBusy(false); return; }
    setStatus('⏳ جاري الاتصال بـ Z.ai...');
    try {
      const response = await axios.post(settings.endpoint, {
        model: settings.model || 'glm-5.2',
        messages: [{ role: 'system', content: settings.system }, ...history.map(message => ({ role: message.role, content: message.content }))],
        temperature: 0.7, max_tokens: 2048
      }, { headers: { Authorization: `Bearer ${settings.apiKey.trim()}`, 'Content-Type': 'application/json' }, timeout: 120000 });
      const answer = response.data?.choices?.[0]?.message?.content || 'لم يصل رد من Z.ai.';
      updateCurrent(chat => ({ ...chat, messages: [...chat.messages, { id: makeId(), role: 'assistant', content: answer, time: Date.now() }] }));
      setStatus('✅ تم بنجاح'); setTimeout(() => setStatus(''), 1800);
    } catch (error) {
      const message = error.response?.status === 401 ? '❌ مفتاح Z.ai غير صحيح.' : error.response?.data?.error?.message || `❌ ${error.message}`;
      updateCurrent(chat => ({ ...chat, messages: [...chat.messages, { id: makeId(), role: 'assistant', error: true, content: message, time: Date.now() }] }));
      setStatus(message);
    } finally { setBusy(false); }
  };

  const saveSettings = () => {
    localStorage.setItem('aichat-settings', JSON.stringify(settings));
    setShowSettings(false); setStatus(settings.demoMode ? '✅ الوضع التجريبي جاهز' : '✅ تم حفظ إعدادات Z.ai');
    setTimeout(() => setStatus(''), 2000);
  };
  const copy = async message => { await navigator.clipboard.writeText(message.content); setCopied(message.id); setTimeout(() => setCopied(''), 1200); };
  const insert = event => { const file = event.target.files?.[0]; if (file) setInput(value => `${value}${value ? '\n' : ''}[ملف مرفق: ${file.name}]\n`); event.target.value = ''; };

  return <div className="app">
    <aside className={`sidebar ${menu ? '' : 'collapsed'}`}>
      <div className="brand"><div className="logo"><FiZap /></div>{menu && <><b>AI Chat</b><span>{settings.demoMode ? 'DEMO' : 'Z.AI'}</span></>}</div>
      {menu && <button className="new-chat" onClick={createChat}><FiPlus /> محادثة جديدة</button>}
      <div className="chat-list">{menu && chats.map(chat => <button className={`chat-item ${chat.id === active ? 'selected' : ''}`} key={chat.id} onClick={() => setActive(chat.id)}><span>{chat.title}</span><FiTrash2 onClick={event => { event.stopPropagation(); setChats(list => list.filter(item => item.id !== chat.id)); if (active === chat.id) setActive(''); }} /></button>)}</div>
      <div className="side-bottom">{menu && <><button onClick={() => setShowSettings(true)}><FiSettings /> الإعدادات</button><small>{settings.demoMode ? 'وضع تجريبي مجاني' : 'اتصال مباشر بـ Z.ai'}</small></>}</div>
    </aside>

    <main className="main">
      <header><button className="icon-btn" onClick={() => setMenu(value => !value)}><FiMenu /></button><div><strong>{current?.title || 'AI Chat'}</strong><small>{settings.demoMode ? 'وضع تجريبي محلي · جاهز' : `${settings.model} · Z.ai`}</small></div><div className="header-actions">{status && <span className="status-msg">{status}</span>}<button className="icon-btn" onClick={() => setShowSettings(true)}><FiSettings /></button></div></header>
      <section className="messages">
        {!current?.messages.length ? <div className="welcome"><div className="welcome-icon"><FiZap /></div><h1>كيف أساعدك اليوم؟</h1><p>{settings.demoMode ? 'اكتب سؤالك الآن — ستتفاعل مع الواجهة فوراً دون إعدادات.' : 'متصل مباشرة بـ Z.ai'}</p><div className="prompts"><button onClick={() => send('مرحبا، عرفني بنفسك')}>تحدث مع المساعد</button><button onClick={() => send('اقترح فكرة تطبيق مبتكرة')}>فكرة تطبيق</button><button onClick={() => send('اكتب لي خطة تعلم عملية للبرمجة')}>خطة تعلم</button></div></div> : current.messages.map(message => <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`message ${message.role} ${message.error ? 'error' : ''}`} key={message.id}><div className="avatar">{message.role === 'user' ? 'أنت' : <FiZap />}</div><div className="bubble"><div className="role">{message.role === 'user' ? 'أنت' : settings.demoMode ? 'المساعد التجريبي' : settings.model}</div><div className="content">{message.content}</div>{message.role === 'assistant' && !message.error && <button className="copy" onClick={() => copy(message)}>{copied === message.id ? <FiCheck /> : <FiCopy />}</button>}</div></motion.article>)}
        {busy && <div className="typing"><FiZap /><i></i><i></i><i></i> يكتب الآن...</div>}<div ref={bottom} />
      </section>
      <div className="composer-wrap"><div className="composer"><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="اكتب رسالتك هنا... (Enter للإرسال)" rows="1" /><div className="composer-actions"><button title="إدراج ملف" onClick={() => fileRef.current.click()}><FiPaperclip /></button><button className="send" disabled={busy || !input.trim()} onClick={() => send()}><FiSend /></button></div><input ref={fileRef} type="file" hidden onChange={insert} /></div><small className="hint">{settings.demoMode ? '🟣 وضع تجريبي مجاني — ابدأ بالكتابة الآن' : '🔐 اتصال مباشر بـ Z.ai · المفتاح محفوظ محلياً'}</small></div>
    </main>

    <AnimatePresence>{showSettings && <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="modal" initial={{ scale: .95 }} animate={{ scale: 1 }}><div className="modal-head"><h2>طريقة التشغيل</h2><button onClick={() => setShowSettings(false)}><FiX /></button></div><label className="demo-toggle"><input type="checkbox" checked={settings.demoMode} onChange={event => setSettings({ ...settings, demoMode: event.target.checked })} /><span><b>الوضع التجريبي المجاني</b><small>تحدث مع واجهة محلية فوراً دون مفتاح أو حساب</small></span></label><p className="notice">عند إيقاف الوضع التجريبي، سيستخدم التطبيق اتصال Z.ai الحقيقي ويتطلب مفتاحاً صالحاً من المنصة.</p><label>🔑 مفتاح Z.ai API<input type="password" value={settings.apiKey} onChange={event => setSettings({ ...settings, apiKey: event.target.value })} placeholder="اختياري في الوضع التجريبي" /></label><label>🤖 اسم النموذج<input value={settings.model} onChange={event => setSettings({ ...settings, model: event.target.value })} /></label><label>🔗 رابط Z.ai<textarea value={settings.endpoint} onChange={event => setSettings({ ...settings, endpoint: event.target.value })} rows="2" /></label><div className="modal-actions"><button onClick={() => setShowSettings(false)}>إلغاء</button><button className="primary" onClick={saveSettings}>حفظ وابدأ</button></div></motion.div></motion.div>}</AnimatePresence>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
