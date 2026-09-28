import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import { FiPlus, FiSend, FiPaperclip, FiSettings, FiMenu, FiTrash2, FiCopy, FiCheck, FiZap, FiX, FiAlertCircle } from 'react-icons/fi';
import axios from 'axios';
import './styles.css';

const id = () => crypto.randomUUID();
const DEFAULTS = {
  endpoint: 'https://api.z.ai/api/paas/v4/chat/completions',
  model: 'glm-5.2',
  apiKey: '',
  system: 'أنت مساعد ذكي ومفيد. أجب بالعربية بوضوح وصدق، ولا تدّعي تنفيذ شيء لم تنفذه.'
};

function loadChats() {
  try { return JSON.parse(localStorage.getItem('aichat-chats')) || []; } catch { return []; }
}

function App() {
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('aichat-settings') || '{}') }; }
    catch { return DEFAULTS; }
  });
  const [chats, setChats] = useState(loadChats);
  const [active, setActive] = useState(() => localStorage.getItem('aichat-active') || '');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const fileRef = useRef();
  const bottom = useRef();
  const current = chats.find(c => c.id === active) || null;

  useEffect(() => { localStorage.setItem('aichat-chats', JSON.stringify(chats)); }, [chats]);
  useEffect(() => {
    if (active) localStorage.setItem('aichat-active', active);
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, active]);

  const newChat = () => {
    const chat = { id: id(), title: 'محادثة جديدة', messages: [], created: Date.now() };
    setChats(list => [chat, ...list]);
    setActive(chat.id);
  };

  useEffect(() => {
    if (!active && chats.length === 0) newChat();
    else if (!active && chats[0]) setActive(chats[0].id);
  }, []);

  const update = fn => setChats(list => list.map(chat => chat.id === active ? fn(chat) : chat));

  const send = async (value = input) => {
    const text = value.trim();
    if (!text || busy) return;
    if (!settings.apiKey.trim()) {
      setStatusMsg('⚠️ أدخل مفتاح Z.ai في الإعدادات');
      setShowSettings(true);
      return;
    }

    const user = { id: id(), role: 'user', content: text, time: Date.now() };
    const history = [...(current?.messages || []), user];
    update(chat => ({
      ...chat,
      title: chat.messages.length ? chat.title : text.slice(0, 30) + (text.length > 30 ? '...' : ''),
      messages: history
    }));
    setInput('');
    setBusy(true);
    setStatusMsg('⏳ جاري الاتصال بـ Z.ai...');

    try {
      const response = await axios.post(settings.endpoint, {
        model: settings.model || 'glm-5.2',
        messages: [
          { role: 'system', content: settings.system },
          ...history.map(message => ({ role: message.role, content: message.content }))
        ],
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 2048
      }, {
        headers: {
          Authorization: `Bearer ${settings.apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      });

      const answer = response.data?.choices?.[0]?.message?.content || 'لم يصل نص من Z.ai.';
      update(chat => ({
        ...chat,
        messages: [...chat.messages, { id: id(), role: 'assistant', content: answer, time: Date.now() }]
      }));
      setStatusMsg('✅ تم بنجاح');
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (error) {
      let message = 'تعذر الاتصال بـ Z.ai.';
      if (error.response?.status === 401) message = '❌ مفتاح Z.ai غير صحيح أو منتهي الصلاحية.';
      else if (error.response?.status === 429) message = '⏱️ تم تجاوز حد الاستخدام؛ حاول لاحقاً.';
      else if (error.response?.data?.error?.message) message = `❌ ${error.response.data.error.message}`;
      else if (error.code === 'ECONNABORTED') message = '⏱️ انتهت مهلة الاتصال؛ حاول مرة أخرى.';
      else if (error.message) message = `❌ ${error.message}`;
      update(chat => ({
        ...chat,
        messages: [...chat.messages, { id: id(), role: 'assistant', error: true, content: message, time: Date.now() }]
      }));
      setStatusMsg(message);
    } finally { setBusy(false); }
  };

  const insert = event => {
    const file = event.target.files?.[0];
    if (file) setInput(value => `${value}${value ? '\n' : ''}[ملف مرفق: ${file.name}]\n`);
    event.target.value = '';
  };
  const saveSettings = () => {
    if (!settings.apiKey.trim()) { setStatusMsg('⚠️ أدخل مفتاح API الخاص بك'); return; }
    localStorage.setItem('aichat-settings', JSON.stringify(settings));
    setShowSettings(false);
    setStatusMsg('✅ تم حفظ الإعدادات');
    setTimeout(() => setStatusMsg(''), 2000);
  };
  const copy = async message => {
    await navigator.clipboard.writeText(message.content);
    setCopied(message.id);
    setTimeout(() => setCopied(''), 1300);
  };

  return <div className="app">
    <aside className={`sidebar ${menu ? '' : 'collapsed'}`}>
      <div className="brand"><div className="logo"><FiZap /></div>{menu && <><b>AI Chat</b><span>Z.AI</span></>}</div>
      {menu && <button className="new-chat" onClick={newChat}><FiPlus /> محادثة جديدة</button>}
      <div className="chat-list">{menu && chats.map(chat => <button className={`chat-item ${chat.id === active ? 'selected' : ''}`} key={chat.id} onClick={() => setActive(chat.id)}><span>{chat.title}</span><FiTrash2 onClick={event => { event.stopPropagation(); setChats(list => list.filter(item => item.id !== chat.id)); if (chat.id === active) setActive(''); }} /></button>)}</div>
      <div className="side-bottom">{menu && <><button onClick={() => setShowSettings(true)}><FiSettings /> الإعدادات</button><small>GLM-5.2 · تخزين محلي</small></>}</div>
    </aside>

    <main className="main">
      <header><button className="icon-btn" onClick={() => setMenu(value => !value)}><FiMenu /></button><div><strong>{current?.title || 'AI Chat'}</strong><small>{settings.model} · Z.ai · {busy ? '🟢 نشط' : '⚪ جاهز'}</small></div><div className="header-actions">{statusMsg && <span className="status-msg">{statusMsg}</span>}<button className="icon-btn" onClick={() => setShowSettings(true)}><FiSettings /></button></div></header>
      <section className="messages">
        {!current?.messages.length ? <div className="welcome"><div className="welcome-icon"><FiZap /></div><h1>كيف أساعدك اليوم؟</h1><p>اتصال مباشر بـ Z.ai عبر إعداداتك، دون Ollama أو خادم وسيط.</p><div className="prompts"><button onClick={() => send('اكتب لي خطة تعلم عملية للبرمجة')}>خطة تعلم برمجة</button><button onClick={() => send('اقترح فكرة تطبيق مبتكرة')}>فكرة تطبيق</button><button onClick={() => send('اشرح الخوارزميات الأساسية')}>شرح تقني</button></div></div> : current.messages.map(message => <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`message ${message.role} ${message.error ? 'error' : ''}`} key={message.id}><div className="avatar">{message.role === 'user' ? 'أنت' : <FiZap />}</div><div className="bubble"><div className="role">{message.role === 'user' ? 'أنت' : 'GLM-5.2'}</div><div className="content">{message.content}</div>{message.role === 'assistant' && !message.error && <button className="copy" onClick={() => copy(message)}>{copied === message.id ? <FiCheck /> : <FiCopy />}</button>}</div></motion.article>)}
        {busy && <div className="typing"><FiZap /><i></i><i></i><i></i> يكتب GLM-5.2...</div>}<div ref={bottom} />
      </section>
      <div className="composer-wrap"><div className="composer"><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="اكتب رسالتك هنا... (Enter للإرسال)" rows="1" /><div className="composer-actions"><button title="إدراج ملف" onClick={() => fileRef.current.click()}><FiPaperclip /></button><button className="send" onClick={() => send()} disabled={busy || !input.trim()}><FiSend /></button></div><input ref={fileRef} type="file" hidden onChange={insert} /></div><small className="hint">🔐 المفتاح يُحفظ محلياً فقط · اتصال مباشر بـ Z.ai</small></div>
    </main>

    <AnimatePresence>{showSettings && <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="modal" initial={{ scale: 0.95 }} animate={{ scale: 1 }}><div className="modal-head"><h2>إعدادات الاتصال بـ Z.ai</h2><button onClick={() => setShowSettings(false)}><FiX /></button></div><div className="notice"><FiAlertCircle /> الاتصال مباشر بـ Z.ai ويتطلب اعتماداً صالحاً من المنصة. لا يتم إرسال المفتاح إلى خادمنا.</div><label>🔑 مفتاح Z.ai API<input type="password" value={settings.apiKey} onChange={event => setSettings({ ...settings, apiKey: event.target.value })} placeholder="أدخل مفتاحك" /></label><label>🤖 اسم النموذج<input value={settings.model} onChange={event => setSettings({ ...settings, model: event.target.value })} placeholder="glm-5.2" /></label><label>🔗 رابط endpoint<textarea value={settings.endpoint} onChange={event => setSettings({ ...settings, endpoint: event.target.value })} rows="2" /></label><label>📝 تعليمات النظام<textarea value={settings.system} onChange={event => setSettings({ ...settings, system: event.target.value })} rows="3" /></label><div className="modal-actions"><button onClick={() => setShowSettings(false)}>إلغاء</button><button className="primary" onClick={saveSettings}>حفظ والاتصال</button></div></motion.div></motion.div>}</AnimatePresence>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
