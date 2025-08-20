(function(){
  // Create a namespace on window
  const QS = (window.QuickSquadChat = window.QuickSquadChat || {});

  // Default config
  const defaults = {
    endpoint: "/quicksquad-ai", // Your server route
    title: "QuickSquad",
    subtitle: "AI Assistant",
    brand: { primary: "#0ea5e9", textOnPrimary: "#ffffff" },
    position: "bottom-right", // or bottom-left
    quickPrompts: [
      "Open a bank account online",
      "Fix Wi‑Fi that keeps dropping",
      "Reset my email password",
      "Find the nearest DMV",
      "Explain Roth IRA vs 401(k)"
    ],
    disclaimer: "General guidance only — not financial, legal, or medical advice.",
    greeting: "Hi! I'm your QuickSquad assistant. How can I help today?",
  };

  // Helpers
  function el(tag, attrs = {}, children = []){
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if(k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if(k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if(v !== null && v !== undefined) node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(ch=>{
      if(ch === null || ch === undefined) return;
      if(typeof ch === 'string') node.appendChild(document.createTextNode(ch));
      else node.appendChild(ch);
    });
    return node;
  }

  function svgIcon(pathD){
    const svg = el('svg', { viewBox: '0 0 24 24', width: '20', height: '20', 'aria-hidden':'true' });
    svg.appendChild(el('path', { d: pathD, fill: 'currentColor' }));
    return svg;
  }

  function injectStyles(primary){
    if(document.getElementById('qs-widget-styles')) return;
    const style = el('style', { id:'qs-widget-styles' });
    style.textContent = `
      :root{ --qs-primary: ${primary}; --qs-bg: #ffffff; --qs-text: #111827; --qs-muted: #6b7280; }
      .qs-floating-bubble{ position: fixed; z-index: 99999; bottom: 20px; right: 20px; display:flex; align-items:center; justify-content:center; width:56px; height:56px; border-radius:50%; background: var(--qs-primary); color:#fff; box-shadow: 0 12px 24px rgba(0,0,0,.18); cursor:pointer; }
      .qs-floating-bubble.qs-left{ right:auto; left:20px; }
      .qs-panel{ position: fixed; z-index: 99999; bottom: 90px; right: 20px; width: min(420px, 92vw); max-height: 75vh; display:none; flex-direction:column; background: var(--qs-bg); color: var(--qs-text); border:1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 48px rgba(0,0,0,.18); }
      .qs-panel.qs-left{ right:auto; left:20px; }
      .qs-header{ display:flex; align-items:center; gap:10px; padding:12px 14px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
      .qs-logo{ display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; background: var(--qs-primary); color:#fff; font-weight:700; }
      .qs-title-wrap{ display:flex; flex-direction:column; line-height:1.1; }
      .qs-title{ font-size: 14px; font-weight: 700; }
      .qs-sub{ font-size: 12px; color: var(--qs-muted); }
      .qs-body{ display:flex; flex-direction:column; padding: 12px; gap: 8px; overflow:auto; }
      .qs-msg{ max-width: 85%; padding: 10px 12px; border-radius: 12px; font-size: 14px; line-height:1.3; box-shadow: 0 2px 6px rgba(0,0,0,.06); }
      .qs-msg.user{ align-self: flex-end; background:#e8f6fe; border:1px solid #bae6fd; }
      .qs-msg.bot{ align-self: flex-start; background:#f9fafb; border:1px solid #e5e7eb; }
      .qs-quick{ display:flex; flex-wrap:wrap; gap:8px; padding: 0 12px 12px; border-bottom:1px dashed #e5e7eb; }
      .qs-chip{ font-size:12px; border:1px solid #e5e7eb; padding:6px 8px; border-radius:999px; background:#fff; cursor:pointer; }
      .qs-input-wrap{ display:flex; align-items:center; gap:8px; padding:10px; border-top:1px solid #e5e7eb; background:#fff; }
      .qs-input{ flex:1; padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px; font-size:14px; }
      .qs-send{ display:flex; align-items:center; gap:6px; background: var(--qs-primary); color:#fff; border:none; padding:10px 12px; border-radius:10px; cursor:pointer; }
      .qs-disclaimer{ padding: 8px 12px; font-size:11px; color: var(--qs-muted); background:#fafafa; border-top:1px solid #f1f5f9; }
      .qs-typing{ display:flex; align-items:center; gap:6px; color: var(--qs-muted); font-size:12px; padding:0 12px; }
      .qs-dot{ width:6px; height:6px; border-radius:50%; background: #d1d5db; animation: qs-pulse 1s infinite ease-in-out; }
      .qs-dot:nth-child(2){ animation-delay: .2s }
      .qs-dot:nth-child(3){ animation-delay: .4s }
      @keyframes qs-pulse { 0%, 80%, 100%{ opacity:.3; transform: translateY(0) } 40%{ opacity:1; transform: translateY(-3px) } }
    `;
    document.head.appendChild(style);
  }

  function persist(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(_){} }
  function readPersist(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch(_) { return fallback } }

  async function askAPI(endpoint, messages){
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, userAgent: navigator.userAgent })
    });
    if(!res.ok){ throw new Error('Network error'); }
    const data = await res.json();
    return data.reply || "Sorry, I couldn't process that right now.";
  }

  QS.init = function init(userCfg = {}){
    const cfg = { ...defaults, ...userCfg };
    injectStyles(cfg.brand.primary);

    // Elements
    const bubble = el('button', { class: 'qs-floating-bubble' + (cfg.position === 'bottom-left' ? ' qs-left':''), title: 'Chat with QuickSquad' }, [
      svgIcon('M2 21l1.5-4.5A9 9 0 1112 21a9.7 9.7 0 01-4.5-1L2 21z')
    ]);

    const panel = el('section', { class: 'qs-panel' + (cfg.position === 'bottom-left' ? ' qs-left':'') });
    const header = el('div', { class: 'qs-header' }, [
      el('div', { class: 'qs-logo' }, ['Q']),
      el('div', { class: 'qs-title-wrap' }, [
        el('div', { class: 'qs-title' }, [cfg.title]),
        el('div', { class: 'qs-sub' }, [cfg.subtitle])
      ]),
      el('div', { style: { marginLeft:'auto', display:'flex', gap:'8px' } }, [
        el('a', { href: 'https://quicksquad.live', target: '_blank', style: { fontSize:'12px', color:'var(--qs-muted)' } }, ['Website'])
      ])
    ]);

    const quick = el('div', { class: 'qs-quick' }, cfg.quickPrompts.map(text => el('button', { class: 'qs-chip', onclick(){ sendUser(text) } }, [text])));
    const body = el('div', { class: 'qs-body', role:'log', 'aria-live':'polite' });
    const typing = el('div', { class:'qs-typing', style:{ display:'none' } }, [ el('span', {}, ['Assistant is typing ']), el('div', { class:'qs-dot' }), el('div', { class:'qs-dot' }), el('div', { class:'qs-dot' }) ]);

    const inputWrap = el('div', { class:'qs-input-wrap' });
    const input = el('input', { class:'qs-input', type:'text', placeholder:'Ask anything…' });
    const sendBtn = el('button', { class:'qs-send', onclick: () => { if(input.value.trim()) sendUser(input.value.trim()) } }, [ svgIcon('M2 21l21-9L2 3v7l15 2-15 2v7z'), el('span', {}, ['Send']) ]);
    inputWrap.appendChild(input); inputWrap.appendChild(sendBtn);

    const disclaimer = el('div', { class:'qs-disclaimer' }, [cfg.disclaimer]);

    panel.appendChild(header);
    panel.appendChild(quick);
    panel.appendChild(body);
    panel.appendChild(typing);
    panel.appendChild(inputWrap);
    panel.appendChild(disclaimer);

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    // State
    const PERSIST_KEY = 'qs_thread_v1';
    let history = readPersist(PERSIST_KEY, []);

    function togglePanel(){
      const isOpen = panel.style.display === 'flex';
      panel.style.display = isOpen ? 'none' : 'flex';
      bubble.setAttribute('aria-expanded', String(!isOpen));
      if(!isOpen && body.childElementCount === 0){
        addBot(cfg.greeting);
      }
    }

    bubble.addEventListener('click', togglePanel);

    function addMsg(text, who){
      const msg = el('div', { class: 'qs-msg ' + who }, [text]);
      body.appendChild(msg);
      body.scrollTop = body.scrollHeight;
    }

    function addBot(text){ addMsg(text, 'bot') }
    function addUser(text){ addMsg(text, 'user') }

    async function sendUser(text){
      addUser(text);
      input.value = '';
      typing.style.display = 'flex';

      const messages = [
        { role: 'system', content: 'You are QuickSquad\'s AI assistant for U.S. users. Be concise, friendly, and practical. Give step-by-step guidance for tech support, online banking setup, navigation, and general info. Include short safety notes where relevant. DO NOT provide personalized financial, medical, or legal advice; offer general info and suggest contacting a professional if asked for specifics.' },
        ...history,
        { role: 'user', content: text }
      ];

      try {
        const reply = await askAPI(cfg.endpoint, messages);
        addBot(reply);
        history = messages.concat({ role: 'assistant', content: reply }).slice(-24); // keep last 24 turns
        persist(PERSIST_KEY, history);
      } catch(err){
        addBot("Sorry — I ran into an issue. Please try again in a moment or contact support@quicksquad.live.");
      } finally {
        typing.style.display = 'none';
      }
    }

    // Enter to send
    input.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); if(input.value.trim()) sendUser(input.value.trim()); }
    });

    // Auto-open on first load (optional)
    // togglePanel();

  };
})();

// Auto‑remove this inline example tag if inlined into HTML directly
const _script = document.getElementById('qs-inline-example');
if(_script) _script.remove();