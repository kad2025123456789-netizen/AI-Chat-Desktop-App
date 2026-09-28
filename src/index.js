import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import { FiPlus, FiSend, FiPaperclip, FiImage, FiSettings, FiMenu, FiTrash2, FiCopy, FiCheck, FiZap, FiX } from 'react-icons/fi';
import axios from 'axios';
import './styles.css';

const defaults = { endpoint: 'https://api.z.ai/api/paas/v4', model: 'glm-5.2', apiKey: '', system: 'أنت مساعد ذكي ومفيد. أجب بالعربية بوضوح وصدق، ولا تدّعي تنفيذ شيء لم تنفذه.' };
const id = () => crypto.randomUUID();
function loadChats() { try { return JSON.parse(localStorage.getItem('aichat-chats')) || []; } catch { return []; } }
function App() {
  const [settings, setSettings] = useState(() => ({ ...defaults, ...JSON.parse(localStorage.getItem('aichat-settings') || '{}') }));
  const [chats, setChats] = useState(loadChats);
  const [active, setActive] = useState(() => localStorage.getItem('aichat-active') || '');
  const [input, setInput] = useState(''); const [busy, setBusy] = useState(false); const [menu, setMenu] = useState(true); const [showSettings, setShowSettings] = useState(false); const [copied, setCopied] = useState('');
  const fileRef = useRef(); const bottom = useRef();
  const current = chats.find(c => c.id === active) || null;
  useEffect(() => { localStorage.setItem('aichat-chats', JSON.stringify(chats)); }, [chats]);
  useEffect(() => { if (active) localStorage.setItem('aichat-active', active); bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [chats, active]);
  const newChat = () => { const c = { id: id(), title: 'محادثة جديدة', messages: [], created: Date.now() }; setChats(x => [c, ...x]); setActive(c.id); };
  useEffect(() => { if (!active && !chats.length) newChat(); else if (!active && chats[0]) setActive(chats[0].id); }, []);
  const update = (fn) => setChats(list => list.map(c => c.id === active ? fn(c) : c));
  const send = async (text = input) => {
    text = text.trim(); if (!text || busy) return; if (!settings.apiKey) { setShowSettings(true); return; }
    const user = { id: id(), role: 'user', content: text, time: Date.now() }; const history = [...(current?.messages || []), user];
    update(c => ({ ...c, title: c.messages.length ? c.title : text.slice(0,  thirty = 30), messages: history })); setInput(''); setBusy(true);
    try {
      const res = await axios.post(`${settings.endpoint.replace(/\\/$/, '')}/chat/completions`, { model: settings.model, messages: [{ role: 'system', content: settings.system }, ...history.map(m => ({ role: m.role, content: m.content }))], temperature: .7, stream: false }, { headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' }, timeout: 120000 });
      const answer = res.data?.choices?.[0]?.message?.content || 'لم يصل نص من الخادم.';
      update(c => ({ ...c, messages: [...c.messages, { id: id(), role: 'assistant', content: answer, time: Date.now() }] }));
    } catch (e) { update(c => ({ ...c, messages: [...c.messages, { id: id(), role: 'assistant', error: true, content: `تعذر الاتصال بالنموذج. تحقق من المفتاح والرابط والنموذج.\\n\\nالتفاصيل: ${e.response?.data?.error?.message || e.message}`, time: Date.now() }] })); }
    finally { setBusy(false); }
  };
  const insert = e => { const file = e.target.files?.[0]; if (file) setInput(x => `${x}${x ? '\\n' : ''}[ملف مرفق: ${file.name}]\\n`); e.target.value = ''; };
  const saveSettings = () => { localStorage.setItem('aichat-settings', JSON.stringify(settings)); setShowSettings(false); };
  const copy = async (m) => { await navigator.clipboard.writeText(m.content); setCopied(m.id); setTimeout(() => setCopied(''), 1300); };
  return <div className="app">
    <aside className={`sidebar ${menu ? '' : 'collapsed'}`}><div className="brand"><div className="logo"><FiZap/></div>{menu && <><b>AI Chat</b><span>DESKTOP</span></>}</div>{menu && <button className="new-chat" onClick={newChat}><FiPlus/> محادثة جديدة</button>}<div className="chat-list">{menu && chats.map(c => <button className={`chat-item ${c.id === active ? 'selected' : ''}`} key={c.id} onClick={() => setActive(c.id)}><span>{c.title}</span><FiTrash2 onClick={e => { e.stopPropagation(); setChats(x => x.filter(z => z.id !== c.id)); if (c.id === active) setActive(''); }}/></button>)}</div><div className="side-bottom">{menu && <><button onClick={() => setShowSettings(true)}><FiSettings/> الإعدادات</button><small>خصوصيتك أولاً · تخزين محلي</small></>}</div></aside>
    <main className="main"><header><button className="icon-btn" onClick={() => setMenu(!menu)}><FiMenu/></button><div><strong>{current?.title || 'AI Chat'}</strong><small>{settings.model} · OpenAI-compatible</small></div><div className="header-actions"><button className="icon-btn" onClick={() => setShowSettings(true)}><FiSettings/></button></div></header>
      <section className="messages">{!current?.messages.length ? <div className="welcome"><div className="welcome-icon"><FiZap/></div><h1>كيف أساعدك اليوم؟</h1><p>محادثة محلية بواجهة حديثة، متصلة مباشرة بمزود API تختاره أنت.</p><div className="prompts"><button onClick={() => send('اكتب لي خطة تعلم عملية للبرمجة')}>خطة تعلم للبرمجة</button><button onClick={() => send('اقترح فكرة تطبيق مبتكرة')}>فكرة تطبيق مبتكرة</button><button onClick={() => send('حلل هذا النص بشكل احترافي')}>تحليل احترافي</button></div></div> : current.messages.map(m => <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`message ${m.role} ${m.error ? 'error' : ''}`} key={m.id}><div className="avatar">{m.role === 'user' ? 'أنت' : <FiZap/>}</div><div className="bubble"><div className="role">{m.role === 'user' ? 'أنت' : 'المساعد'}</div><div className="content">{m.content}</div>{m.role === 'assistant' && <button className="copy" onClick={() => copy(m)}>{copied === m.id ? <FiCheck/> : <FiCopy/>}</button>}</div></motion.article>)}{busy && <div className="typing"><FiZap/><i></i><i></i><i></i> يكتب الآن...</div>}<div ref={bottom}/></section>
      <div className="composer-wrap"><div className="composer"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="اكتب رسالتك هنا... (Enter للإرسال)" rows="1"/><div className="composer-actions"><button title="إدراج ملف" onClick={() => fileRef.current.click()}><FiPaperclip/></button><button title="إنشاء صورة" onClick={() => setInput(x => `${x}${x ? ' ' : ''}أنشئ صورة: `)}><FiImage/></button><button className="send" onClick={() => send()} disabled={busy || !input.trim()}><FiSend/></button></div><input ref={fileRef} type="file" hidden onChange={insert}/></div><small className="hint">قدّم مفتاح API من مزودك في الإعدادات. لا يتم رفعه إلى خادمنا.</small></div>
    </main>
    <AnimatePresence>{showSettings && <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="modal" initial={{ scale: .95 }} animate={{ scale: 1 }}><div className="modal-head"><h2>إعدادات الاتصال</h2><button onClick={() => setShowSettings(false)}><FiX/></button></div><p className="notice">هذا التطبيق لا يملك API مجانيًا خاصًا به. أدخل مفتاح مزود OpenAI-compatible؛ يتم حفظه محليًا فقط.</p><label>رابط API<textarea value={settings.endpoint} onChange={e => setSettings({ ...settings, endpoint: e.target.value })} rows="1"/></label><label>اسم النموذج<input value={settings.model} onChange={e => setSettings({ ...settings, model: e.target.value })}/></label><label>مفتاح API<input type="password" value={settings.apiKey} onChange={e => setSettings({ ...settings, apiKey: e.target.value })} placeholder="sk-..."/></label><label>تعليمات النظام<textarea value={settings.system} onChange={e => setSettings({ ...settings, system: e.target.value })} rows="3"/></label><div className="modal-actions"><button onClick={() => setShowSettings(false)}>إلغاء</button><button className="primary" onClick={saveSettings}>حفظ وتشغيل</button></div></motion.div></motion.div>}</AnimatePresence>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
