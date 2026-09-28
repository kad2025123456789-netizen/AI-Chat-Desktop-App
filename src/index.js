import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import { FiPlus, FiSend, FiPaperclip, FiSettings, FiMenu, FiTrash2, FiCopy, FiCheck, FiZap, FiX, FiAlertCircle } from 'react-icons/fi';
import axios from 'axios';
import './styles.css';

const DEFAULTS = {
  endpoint: 'https://api.z.ai/api/paas/v4/chat/completions',
  model: 'glm-5.2',
  apiKey: 'a0f50057b2e44824ad167348d6dbc10d.vHBSt6Ky7v8Dstzs',
  demoMode: false,
  system: 'أنت مساعد ذكي ومفيد جداً. أجب بالعربية بوضوح وصدق وإبداع. تفاعل مع المستخدم بحماس وقدم إجابات مفصلة وعملية وممتعة.'
};

const id = () => crypto.randomUUID();
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };

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
    const chat = { id: id(), title: 'محادثة جديدة', messages: [], created: Date.now() };
    setChats(list => [chat, ...list]); 
    setActive(chat.id);
  };
  
  const updateCurrent = fn => setChats(list => list.map(chat => chat.id === active ? fn(chat) : chat));

  const send = async (value = input) => {
    const text = value.trim();
    if (!text || busy) return;

    const user = { id: id(), role: 'user', content: text, time: Date.now() };
    const history = [...(current?.messages || []), user];
    
    updateCurrent(chat => ({
      ...chat,
      title: chat.messages.length ? chat.title : text.slice(0, 30) + (text.length > 30 ? '...' : ''),
      messages: history
    }));
    
    setInput('');
    setBusy(true);
    setStatus('⏳ جاري التواصل مع Z.ai الآن...');

    try {
      const response = await axios.post(settings.endpoint, {
        model: settings.model || 'glm-5.2',
        messages: [
          { role: 'system', content: settings.system },
          ...history.map(message => ({ role: message.role, content: message.content }))
        ],
        temperature: 0.8,
        top_p: 0.95,
        max_tokens: 2048
      }, {
        headers: {
          'Authorization': `Bearer ${settings.apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      });

      const answer = response.data?.choices?.[0]?.message?.content || 'لم يصل رد من Z.ai.';
      updateCurrent(chat => ({
        ...chat,
        messages: [...chat.messages, { id: id(), role: 'assistant', content: answer, time: Date.now() }]
      }));
      setStatus('✅ تم بنجاح!');
      setTimeout(() => setStatus(''), 1800);
    } catch (error) {
      let message = 'تعذر الاتصال بـ Z.ai.';
      if (error.response?.status === 401) {
        message = '❌ مفتاح Z.ai غير صحيح أو منتهي الصلاحية.';
      } else if (error.response?.status === 429) {
        message = '⏱️ تم تجاوز حد الاستخدام؛ حاول لاحقاً.';
      } else if (error.response?.data?.error?.message) {
        message = `❌ ${error.response.data.error.message}`;
      } else if (error.code === 'ECONNABORTED') {
        message = '⏱️ انتهت مهلة الاتصال؛ حاول مرة أخرى.';
      } else if (error.message) {
        message = `❌ ${error.message}`;
      }
      
      updateCurrent(chat => ({
        ...chat,
        messages: [...chat.messages, { id: id(), role: 'assistant', error: true, content: message, time: Date.now() }]
      }));
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = () => {
    if (!settings.apiKey.trim()) {
      setStatus('⚠️ أدخل مفتاح Z.ai الخاص بك');
      return;
    }
    localStorage.setItem('aichat-settings', JSON.stringify(settings));
    setShowSettings(false);
    setStatus('✅ تم حفظ الإعدادات');
    setTimeout(() => setStatus(''), 2000);
  };

  const copy = async message => {
    await navigator.clipboard.writeText(message.content);
    setCopied(message.id);
    setTimeout(() => setCopied(''), 1200);
  };

  const insert = event => {
    const file = event.target.files?.[0];
    if (file) setInput(value => `${value}${value ? '\n' : ''}[ملف مرفق: ${file.name}]\n`);
    event.target.value = '';
  };

  return <div className="app">
    <aside className={`sidebar ${menu ? '' : 'collapsed'}`}>
      <div className="brand">
        <div className="logo"><FiZap /></div>
        {menu && <><b>AI Chat</b><span>Z.AI</span></>}
      </div>
      {menu && <button className="new-chat" onClick={createChat}><FiPlus /> محادثة جديدة</button>}
      <div className="chat-list">
        {menu && chats.map(chat => (
          <button
            className={`chat-item ${chat.id === active ? 'selected' : ''}`}
            key={chat.id}
            onClick={() => setActive(chat.id)}
          >
            <span>{chat.title}</span>
            <FiTrash2 onClick={event => {
              event.stopPropagation();
              setChats(list => list.filter(item => item.id !== chat.id));
              if (active === chat.id) setActive('');
            }} />
          </button>
        ))}
      </div>
      <div className="side-bottom">
        {menu && <>
          <button onClick={() => setShowSettings(true)}><FiSettings /> الإعدادات</button>
          <small>متصل بـ Z.ai · GLM-5.2</small>
        </>}
      </div>
    </aside>

    <main className="main">
      <header>
        <button className="icon-btn" onClick={() => setMenu(value => !value)}><FiMenu /></button>
        <div>
          <strong>{current?.title || 'AI Chat'}</strong>
          <small>GLM-5.2 · Z.ai · {busy ? '🟢 جاري الاتصال' : '⚪ جاهز'}</small>
        </div>
        <div className="header-actions">
          {status && <span className="status-msg">{status}</span>}
          <button className="icon-btn" onClick={() => setShowSettings(true)}><FiSettings /></button>
        </div>
      </header>

      <section className="messages">
        {!current?.messages.length ? (
          <div className="welcome">
            <div className="welcome-icon"><FiZap /></div>
            <h1>كيف أساعدك اليوم؟</h1>
            <p>متصل مباشرة بـ Z.ai GLM-5.2 بقوة كاملة. اكتب أي سؤال وستحصل على رد ذكي وسريع.</p>
            <div className="prompts">
              <button onClick={() => send('مرحباً! من أنت وما إمكانياتك؟')}>تحدث معي</button>
              <button onClick={() => send('اقترح لي فكرة تطبيق مبتكرة وقوية')}>فكرة تطبيق</button>
              <button onClick={() => send('اكتب لي خطة تعلم عملية واحترافية للبرمجة')}>خطة تعلم</button>
            </div>
          </div>
        ) : (
          current.messages.map(m => (
            <motion.article
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`message ${m.role} ${m.error ? 'error' : ''}`}
              key={m.id}
            >
              <div className="avatar">
                {m.role === 'user' ? 'أنت' : <FiZap />}
              </div>
              <div className="bubble">
                <div className="role">{m.role === 'user' ? 'أنت' : 'GLM-5.2'}</div>
                <div className="content">{m.content}</div>
                {m.role === 'assistant' && !m.error && (
                  <button className="copy" onClick={() => copy(m)}>
                    {copied === m.id ? <FiCheck /> : <FiCopy />}
                  </button>
                )}
              </div>
            </motion.article>
          ))
        )}
        {busy && (
          <div className="typing">
            <FiZap />
            <i></i><i></i><i></i>
            GLM-5.2 يكتب الآن...
          </div>
        )}
        <div ref={bottom} />
      </section>

      <div className="composer-wrap">
        <div className="composer">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="اكتب رسالتك هنا... (Enter للإرسال)"
            rows="1"
          />
          <div className="composer-actions">
            <button title="إدراج ملف" onClick={() => fileRef.current.click()}><FiPaperclip /></button>
            <button
              className="send"
              onClick={() => send()}
              disabled={busy || !input.trim()}
            >
              <FiSend />
            </button>
          </div>
          <input ref={fileRef} type="file" hidden onChange={insert} />
        </div>
        <small className="hint">
          🔐 مفتاح Z.ai محفوظ محلياً · اتصال مباشر وآمن · لا تقلق على خصوصيتك
        </small>
      </div>
    </main>

    <AnimatePresence>
      {showSettings && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="modal" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
            <div className="modal-head">
              <h2>إعدادات Z.ai</h2>
              <button onClick={() => setShowSettings(false)}><FiX /></button>
            </div>

            <div className="notice">
              <FiAlertCircle /> أنت متصل مباشرة بـ Z.ai. المفتاح محفوظ محلياً على جهازك فقط.
            </div>

            <label>
              🔑 مفتاح Z.ai API
              <input
                type="password"
                value={settings.apiKey}
                onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="مفتاحك الخاص..."
              />
            </label>

            <label>
              🤖 اسم النموذج
              <input
                value={settings.model}
                onChange={e => setSettings({ ...settings, model: e.target.value })}
                placeholder="glm-5.2"
              />
            </label>

            <label>
              📝 تعليمات النظام
              <textarea
                value={settings.system}
                onChange={e => setSettings({ ...settings, system: e.target.value })}
                rows="4"
              />
            </label>

            <div className="modal-actions">
              <button onClick={() => setShowSettings(false)}>إلغاء</button>
              <button className="primary" onClick={saveSettings}>حفظ والاتصال</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
