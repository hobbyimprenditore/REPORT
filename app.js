/* ═══════════════════════════════════════════════════════
   REPORT — App Logic
   Analisi avvisi di vendita immobiliare via Claude AI
═══════════════════════════════════════════════════════ */

'use strict';

// ── STATE ─────────────────────────────────────────────
const state = {
  apiKey: '',
  files: [],
  results: [],
  unified: null,
};

const $ = id => document.getElementById(id);

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupDragDrop();
  $('fileInput').addEventListener('change', e => handleFiles(Array.from(e.target.files)));
});

// ── API KEY ───────────────────────────────────────────
function verifyApiKey() {
  const key = $('apiKey').value.trim();
  const status = $('apiStatus');
  if (!key.startsWith('sk-ant')) {
    status.className = 'field-hint error';
    status.textContent = '✕ Chiave non valida. Deve iniziare con sk-ant-…';
    return;
  }
  state.apiKey = key;
  status.className = 'field-hint ok';
  status.textContent = '✓ Chiave configurata! Ora puoi caricare i documenti.';
  updateAnalyzeBtn();
}

// ── DRAG & DROP ───────────────────────────────────────
function setupDragDrop() {
  const zone = $('uploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });
}

function handleFiles(files) {
  const allowed = ['pdf', 'txt', 'doc', 'docx', 'png', 'jpg', 'jpeg'];
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) { alert(`Formato non supportato: ${file.name}`); continue; }
    if (state.files.find(f => f.name === file.name)) continue;
    state.files.push({
      id: `f${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      file, name: file.name, size: file.size, type: ext,
      text: null, status: 'pending'
    });
  }
  renderFileList();
  updateAnalyzeBtn();
}

function removeFile(id) {
  state.files = state.files.filter(f => f.id !== id);
  renderFileList();
  updateAnalyzeBtn();
}

function clearAll() {
  state.files = []; state.results = []; state.unified = null;
  renderFileList();
  updateAnalyzeBtn();
  $('fileInput').value = '';
  $('block-progress').classList.add('hidden');
  $('block-results').classList.add('hidden');
  $('analyzeWrapper').classList.add('hidden');
  window.scrollTo({ top: $('inizia').offsetTop - 80, behavior: 'smooth' });
}

// ── RENDER FILE LIST ──────────────────────────────────
function renderFileList() {
  const list = $('fileList');
  const wrapper = $('analyzeWrapper');
  if (state.files.length === 0) {
    list.classList.add('hidden'); list.innerHTML = '';
    wrapper.classList.add('hidden'); return;
  }
  list.classList.remove('hidden');
  wrapper.classList.remove('hidden');
  list.innerHTML = state.files.map(f => `
    <div class="file-item" id="item_${f.id}">
      <div class="file-ico">${fileIcon(f.type)}</div>
      <div class="file-meta">
        <div class="file-name">${esc(f.name)}</div>
        <div class="file-size">${fmtSize(f.size)}</div>
      </div>
      <span class="file-badge ${f.status}" id="badge_${f.id}">${badgeLabel(f.status)}</span>
      <button class="file-del" onclick="removeFile('${f.id}')" title="Rimuovi">✕</button>
    </div>`).join('');
}

function setFileStatus(id, status) {
  const f = state.files.find(f => f.id === id);
  if (f) f.status = status;
  const el = $(`badge_${id}`);
  if (el) { el.className = `file-badge ${status}`; el.textContent = badgeLabel(status); }
}

function fileIcon(ext) {
  return { pdf: '📕', txt: '📄', doc: '📝', docx: '📝', png: '🖼️', jpg: '🖼️', jpeg: '🖼️' }[ext] || '📄';
}

function badgeLabel(s) {
  return { pending: 'In attesa', processing: 'Analisi…', done: '✓ OK', error: '✕ Errore' }[s] || s;
}

function updateAnalyzeBtn() {
  $('analyzeBtn').disabled = state.files.length === 0 || !state.apiKey;
}

// ── MAIN ANALYSIS ─────────────────────────────────────
async function startAnalysis() {
  if (!state.apiKey) { alert('Inserisci prima la chiave API nel Passo 1.'); return; }
  if (state.files.length === 0) { alert('Carica almeno un documento.'); return; }

  $('block-progress').classList.remove('hidden');
  $('block-results').classList.add('hidden');
  $('analyzeBtn').disabled = true;
  $('block-progress').scrollIntoView({ behavior: 'smooth', block: 'center' });

  state.results = [];
  setProgress(5, 'Avvio analisi…', `${state.files.length} documento/i da elaborare`);

  // Extract text
  for (let i = 0; i < state.files.length; i++) {
    const f = state.files[i];
    setFileStatus(f.id, 'processing');
    addLog(`📂 Lettura: ${f.name}`, 'info');
    try {
      f.text = await extractText(f);
      addLog(`✓ Testo estratto (${f.text.length} caratteri)`, 'ok');
    } catch (e) {
      f.text = `[Impossibile leggere ${f.name}: ${e.message}]`;
      addLog(`⚠ Lettura parziale: ${f.name}`, 'warn');
    }
    setProgress(5 + Math.round((i + 1) / state.files.length * 25));
  }

  // Analyze each file
  for (let i = 0; i < state.files.length; i++) {
    const f = state.files[i];
    $('progressTitle').textContent = `Analisi documento ${i + 1} di ${state.files.length}`;
    $('progressDesc').textContent = f.name;
    addLog(`⚖️ Analisi legale: ${f.name}…`, 'info');
    try {
      const result = await analyzeWithClaude(f.text, f.name);
      state.results.push({ fileId: f.id, name: f.name, rawAnalysis: result });
      setFileStatus(f.id, 'done');
      addLog(`✓ Analisi completata: ${f.name}`, 'ok');
    } catch (e) {
      setFileStatus(f.id, 'error');
      addLog(`✕ Errore analisi ${f.name}: ${e.message}`, 'warn');
      console.error(e);
    }
    setProgress(30 + Math.round((i + 1) / state.files.length * 55));
  }

  // Merge
  if (state.results.length === 0) {
    $('progressTitle').textContent = '❌ Analisi fallita';
    $('progressDesc').textContent = 'Nessun documento analizzato. Verifica la chiave API e il formato dei file.';
    $('analyzeBtn').disabled = false;
    return;
  }

  addLog(`🔗 Consolidamento report (${state.results.length} documenti)…`, 'info');
  $('progressTitle').textContent = 'Consolidamento report…';
  $('progressDesc').textContent = 'Unificazione di tutti i dati in un unico report';

  try {
    const unified = state.results.length > 1
      ? await mergeAnalyses(state.results)
      : state.results[0].rawAnalysis;
    state.unified = unified;
    setProgress(100);
    addLog('✅ Report unificato pronto!', 'ok');
    setTimeout(() => {
      $('block-progress').classList.add('hidden');
      renderResults(unified);
      $('block-results').classList.remove('hidden');
      $('block-results').scrollIntoView({ behavior: 'smooth' });
    }, 700);
  } catch (e) {
    addLog(`✕ Errore consolidamento: ${e.message}`, 'warn');
    // Fallback: use first result
    state.unified = state.results[0].rawAnalysis;
    renderResults(state.unified);
    $('block-progress').classList.add('hidden');
    $('block-results').classList.remove('hidden');
  }
  $('analyzeBtn').disabled = false;
}

// ── TEXT EXTRACTION ───────────────────────────────────
function extractText(f) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (f.type === 'txt') {
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Lettura fallita'));
      reader.readAsText(f.file, 'utf-8');
    } else if (['png', 'jpg', 'jpeg'].includes(f.type)) {
      reader.onload = e => resolve(`[IMMAGINE:BASE64:${e.target.result}]`);
      reader.onerror = () => reject(new Error('Lettura immagine fallita'));
      reader.readAsDataURL(f.file);
    } else {
      reader.onload = e => {
        try {
          const arr = new Uint8Array(e.target.result);
          let text = '';
          for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            if ((c >= 32 && c <= 126) || c === 10 || c === 13) text += String.fromCharCode(c);
          }
          const lines = text.split('\n').filter(l => l.trim().length > 6 && /[a-zA-ZÀ-ÿ]{3,}/.test(l));
          const cleaned = lines.join('\n').replace(/\s{3,}/g, ' ').trim();
          resolve(cleaned.length > 80 ? cleaned : `[Testo limitato dal formato ${f.type}. Per risultati migliori usa file .txt]`);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Lettura binaria fallita'));
      reader.readAsArrayBuffer(f.file);
    }
  });
}

// ── CLAUDE API ────────────────────────────────────────
async function callClaude(messages, system) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': state.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 4096, system, messages })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Errore HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return data.content?.map(b => b.text || '').join('') || '';
}

async function analyzeWithClaude(text, filename) {
  const isImage = text.startsWith('[IMMAGINE:BASE64:');

  const system = `Sei un avvocato esperto in diritto immobiliare ed esecuzioni forzate con 20 anni di esperienza nell'analisi di procedure esecutive immobiliari in Italia.

Analizza l'avviso di vendita e restituisci SOLO un JSON valido con questa struttura (usa null per dati mancanti, mai stringhe vuote):

{
  "procedura": {
    "tipo": "esecuzione immobiliare | fallimento | liquidazione coatta | altro",
    "tribunale": null,
    "rge": null,
    "giudice": null,
    "delegato": null,
    "data_pubblicazione": null
  },
  "immobile": {
    "tipologia": null,
    "ubicazione": null,
    "superficie_catastale": null,
    "foglio": null,
    "particella": null,
    "subalterno": null,
    "categoria_catastale": null,
    "rendita_catastale": null,
    "descrizione": null
  },
  "economico": {
    "prezzo_base_prima_asta": null,
    "prezzo_base_seconda_asta": null,
    "offerta_minima": null,
    "valore_stima": null,
    "rilanci_minimi": null,
    "cauzione": null,
    "sconto_percentuale": null
  },
  "vincoli": {
    "ipoteche": null,
    "trascrizioni": null,
    "altri_gravami": null,
    "occupanti": null,
    "situazione_giuridica_occupanti": null
  },
  "modalita_vendita": {
    "data_prima_asta": null,
    "data_seconda_asta": null,
    "termine_offerte": null,
    "modalita_offerta": null,
    "modalita_pagamento": null
  },
  "analisi_legale": {
    "completezza_490cpc": null,
    "criticita": [],
    "elementi_attenzione": [],
    "conformita_normativa": null
  },
  "rischi": [],
  "opportunita": [],
  "valutazione_economica": null,
  "spese_stimate": null,
  "giudizio": {
    "livello_rischio": "BASSO | MEDIO | ALTO",
    "convenienza": "ALTA | MEDIA | BASSA",
    "sintesi": null,
    "raccomandazione": null
  }
}

Regole:
- Sii preciso e professionale come un avvocato senior
- Usa null (non stringa vuota) per dati assenti nel documento
- Spiega i rischi in linguaggio chiaro anche per non esperti
- Il giudizio deve riflettere concretamente rischi e opportunità identificati
- Restituisci SOLO il JSON, nessun testo prima o dopo`;

  let userContent;
  if (isImage) {
    const b64full = text.replace('[IMMAGINE:BASE64:', '').replace(']', '');
    const [meta, data] = b64full.split(',');
    const mediaType = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
      { type: 'text', text: `Analizza questo avviso di vendita immobiliare (file: ${filename}).` }
    ];
  } else {
    userContent = `Analizza il seguente avviso di vendita immobiliare (file: ${filename}):\n\n${text.slice(0, 15000)}`;
  }

  const raw = await callClaude([{ role: 'user', content: userContent }], system);
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e) {
    throw new Error('Risposta API non valida: ' + e.message);
  }
}

// ── MERGE ─────────────────────────────────────────────
async function mergeAnalyses(results) {
  const prompt = `Hai analizzato ${results.length} documenti della stessa procedura esecutiva immobiliare.

Dati estratti:
${results.map((r, i) => `--- Documento ${i + 1}: ${r.name} ---\n${JSON.stringify(r.rawAnalysis, null, 2)}`).join('\n\n')}

Crea un JSON unificato con la stessa struttura:
- Compensa i dati mancanti (null) da un documento con quelli presenti negli altri
- In caso di conflitti, scegli il dato più recente o affidabile
- Aggrega rischi e opportunità da tutti i documenti (rimuovi duplicati)
- Aggiorna "giudizio.sintesi" per riflettere l'analisi complessiva

Restituisci SOLO il JSON valido, nessun testo aggiuntivo.`;

  try {
    const raw = await callClaude(
      [{ role: 'user', content: prompt }],
      'Sei un avvocato esperto. Restituisci SOLO JSON valido con la stessa struttura ricevuta.'
    );
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e) {
    console.warn('Merge API fallita, uso merge locale:', e);
    return localMerge(results.map(r => r.rawAnalysis));
  }
}

function localMerge(objects) {
  const result = {};
  const keys = [...new Set(objects.flatMap(o => Object.keys(o || {})))];
  for (const key of keys) {
    const vals = objects.map(o => o?.[key]);
    if (vals.some(v => v !== null && !Array.isArray(v) && typeof v === 'object')) {
      result[key] = localMerge(vals.filter(v => v !== null && typeof v === 'object' && !Array.isArray(v)));
    } else if (vals.some(Array.isArray)) {
      result[key] = [...new Set(vals.filter(Array.isArray).flat())];
    } else {
      result[key] = vals.find(v => v !== null && v !== undefined && v !== '') ?? null;
    }
  }
  return result;
}

// ── RENDER RESULTS ────────────────────────────────────
function renderResults(d) {
  renderVerdict(d);
  $('tab-panoramica').innerHTML = buildPanoramica(d);
  $('tab-legale').innerHTML = buildLegale(d);
  $('tab-economica').innerHTML = buildEconomica(d);
  $('tab-rischi').innerHTML = buildRischi(d);
  $('tab-tabella').innerHTML = buildTabella(d);
  switchTab('panoramica', document.querySelector('.rtab'));
}

function renderVerdict(d) {
  const g = d.giudizio || {};
  const banner = $('verdictBanner');
  const risk = g.livello_rischio || 'MEDIO';
  const cls = { BASSO: 'low', MEDIO: 'mid', ALTO: 'high' }[risk] || 'mid';
  const icon = { BASSO: '✅', MEDIO: '⚠️', ALTO: '🔴' }[risk] || '⚠️';
  banner.className = `verdict-banner ${cls}`;
  banner.innerHTML = `
    <div class="vb-icon">${icon}</div>
    <div class="vb-text">
      <div class="vb-eyebrow">Giudizio finale</div>
      <div class="vb-title">Rischio ${risk} — Convenienza ${g.convenienza || 'N/D'}</div>
      <div class="vb-desc">${esc(g.sintesi || 'Analisi completata.')}</div>
    </div>`;
  banner.classList.remove('hidden');
}

// ── TAB CONTENT BUILDERS ──────────────────────────────
function buildPanoramica(d) {
  const p = d.procedura || {};
  const im = d.immobile || {};
  const ec = d.economico || {};
  const g = d.giudizio || {};
  const riskCls = { BASSO: 'opp', MEDIO: 'info', ALTO: 'risk' }[g.livello_rischio] || 'info';

  return `<div class="prose">
    <h3>📋 Panoramica della Procedura</h3>
    <div class="info-card info-card-grid">
      ${ifield('Tipo procedura', p.tipo)}
      ${ifield('Tribunale', p.tribunale)}
      ${ifield('Numero RGE', p.rge)}
      ${ifield('Giudice', p.giudice)}
      ${ifield('Professionista delegato', p.delegato)}
      ${ifield('Data pubblicazione', p.data_pubblicazione)}
    </div>

    <h3>🏠 L'Immobile</h3>
    <div class="info-card info-card-grid">
      ${ifield('Tipologia', p.tipo)}
      ${ifield('Tipologia immobile', im.tipologia)}
      ${ifield('Indirizzo', im.ubicazione, 'full')}
      ${ifield('Superficie catastale', im.superficie_catastale)}
      ${ifield('Categoria catastale', im.categoria_catastale)}
      ${ifield('Rendita catastale', im.rendita_catastale)}
    </div>
    ${im.descrizione ? `<div class="alert-card info"><span class="alert-icon">📝</span><div class="alert-text">${esc(im.descrizione)}</div></div>` : ''}

    <h3>💰 Prezzi principali</h3>
    <div class="info-card info-card-grid">
      ${ifield('Valore di stima', ec.valore_stima, 'big')}
      ${ifield('Prezzo base asta', ec.prezzo_base_prima_asta, 'big')}
      ${ifield('Sconto sul valore', ec.sconto_percentuale, 'green')}
      ${ifield('Cauzione richiesta', ec.cauzione)}
    </div>

    <h3>⚖️ Valutazione sintetica</h3>
    <div class="alert-card ${riskCls}">
      <span class="alert-icon">${{ BASSO:'✅', MEDIO:'⚠️', ALTO:'🔴' }[g.livello_rischio] || 'ℹ️'}</span>
      <div class="alert-text">
        <strong>Rischio ${g.livello_rischio || '?'} — Convenienza ${g.convenienza || '?'}</strong><br/>
        ${esc(g.sintesi || '')}<br/><br/>
        <strong>Raccomandazione:</strong> ${esc(g.raccomandazione || '')}
      </div>
    </div>
  </div>`;
}

function buildLegale(d) {
  const p = d.procedura || {};
  const al = d.analisi_legale || {};
  const mo = d.modalita_vendita || {};
  const vin = d.vincoli || {};

  return `<div class="prose">
    <h3>⚖️ Verifica Art. 490 c.p.c.</h3>
    <div class="alert-card info">
      <span class="alert-icon">📜</span>
      <div class="alert-text">${esc(al.completezza_490cpc || 'Verifica non disponibile nel documento.')}</div>
    </div>
    <div class="info-card">
      <div class="if-label">Conformità normativa</div>
      <div class="if-value">${esc(al.conformita_normativa || 'N/D')}</div>
    </div>

    <h3>📅 Modalità di vendita</h3>
    <div class="info-card info-card-grid">
      ${ifield('Data prima asta', mo.data_prima_asta)}
      ${ifield('Data seconda asta', mo.data_seconda_asta)}
      ${ifield('Termine offerte', mo.termine_offerte)}
      ${ifield('Modalità offerta', mo.modalita_offerta)}
      ${ifield('Modalità pagamento', mo.modalita_pagamento, 'full')}
    </div>

    <h3>🏗️ Vincoli e oneri sull'immobile</h3>
    <div class="info-card info-card-grid">
      ${ifield('Ipoteche', vin.ipoteche, 'full')}
      ${ifield('Trascrizioni', vin.trascrizioni, 'full')}
      ${ifield('Altri gravami', vin.altri_gravami, 'full')}
      ${ifield('Occupanti', vin.occupanti, 'full')}
      ${ifield('Situazione giuridica occupanti', vin.situazione_giuridica_occupanti, 'full')}
    </div>

    ${al.criticita?.length ? `
      <h3>🚨 Criticità legali identificate</h3>
      ${al.criticita.map(c => `<div class="alert-card risk"><span class="alert-icon">⚠️</span><div class="alert-text">${esc(c)}</div></div>`).join('')}` : ''}

    ${al.elementi_attenzione?.length ? `
      <h3>👁️ Elementi da tenere sotto controllo</h3>
      ${al.elementi_attenzione.map(e => `<div class="alert-card warn"><span class="alert-icon">👉</span><div class="alert-text">${esc(e)}</div></div>`).join('')}` : ''}
  </div>`;
}

function buildEconomica(d) {
  const ec = d.economico || {};
  return `<div class="prose">
    <h3>💰 Prezzi e offerte</h3>
    <div class="info-card info-card-grid">
      ${ifield('Valore di stima peritale', ec.valore_stima, 'big')}
      ${ifield('Prezzo base prima asta', ec.prezzo_base_prima_asta, 'big')}
      ${ifield('Prezzo base seconda asta', ec.prezzo_base_seconda_asta)}
      ${ifield('Offerta minima accettata', ec.offerta_minima)}
      ${ifield('Sconto rispetto alla stima', ec.sconto_percentuale, 'green')}
      ${ifield('Rilanci minimi (rialzi)', ec.rilanci_minimi)}
      ${ifield('Cauzione da versare', ec.cauzione)}
    </div>

    <h3>📈 Analisi del valore</h3>
    <div class="alert-card info">
      <span class="alert-icon">🔍</span>
      <div class="alert-text">${esc(d.valutazione_economica || 'Analisi del valore non disponibile.')}</div>
    </div>

    <h3>🧾 Spese aggiuntive stimate</h3>
    <div class="alert-card warn">
      <span class="alert-icon">💡</span>
      <div class="alert-text">
        ${esc(d.spese_stimate || 'Stima non disponibile. Come regola generale, considera: imposte di registro o IVA (a seconda che il venditore sia privato o impresa), onorari notarili, eventuali spese per sgombero occupanti, costi di ristrutturazione.')}
      </div>
    </div>
  </div>`;
}

function buildRischi(d) {
  const rischi = d.rischi || [];
  const opps = d.opportunita || [];
  return `<div class="prose">
    <h3>🔴 Rischi principali da considerare</h3>
    ${rischi.length
      ? rischi.map(r => `<div class="alert-card risk"><span class="alert-icon">⚠️</span><div class="alert-text">${esc(r)}</div></div>`).join('')
      : '<div class="alert-card opp"><span class="alert-icon">✅</span><div class="alert-text">Nessun rischio significativo identificato nei documenti analizzati.</div></div>'}

    <h3>🟢 Opportunità per l'investitore</h3>
    ${opps.length
      ? opps.map(o => `<div class="alert-card opp"><span class="alert-icon">💚</span><div class="alert-text">${esc(o)}</div></div>`).join('')
      : '<p>Nessuna opportunità specifica identificata.</p>'}

    <h3>⚖️ Giudizio finale</h3>
    <div class="alert-card ${{ BASSO: 'opp', MEDIO: 'info', ALTO: 'risk' }[d.giudizio?.livello_rischio] || 'info'}">
      <span class="alert-icon">${{ BASSO:'✅', MEDIO:'⚠️', ALTO:'🔴' }[d.giudizio?.livello_rischio] || 'ℹ️'}</span>
      <div class="alert-text">
        <strong>Raccomandazione finale:</strong><br/>
        ${esc(d.giudizio?.raccomandazione || 'Consulta sempre un avvocato abilitato prima di procedere all\'acquisto.')}
      </div>
    </div>
  </div>`;
}

function buildTabella(d) {
  const p = d.procedura || {};
  const im = d.immobile || {};
  const ec = d.economico || {};
  const vin = d.vincoli || {};
  const mo = d.modalita_vendita || {};
  const al = d.analisi_legale || {};
  const g = d.giudizio || {};

  const sections = [
    { cat: 'Dati Procedura', rows: [
      ['Tipo di procedura', p.tipo],
      ['Tribunale', p.tribunale],
      ['Numero RGE', p.rge],
      ["Giudice dell'esecuzione", p.giudice],
      ['Professionista delegato', p.delegato],
      ['Data pubblicazione', p.data_pubblicazione],
    ]},
    { cat: 'Immobile', rows: [
      ['Tipologia', im.tipologia],
      ['Ubicazione completa', im.ubicazione],
      ['Superficie catastale', im.superficie_catastale],
      ['Foglio / Particella / Sub.', [im.foglio, im.particella, im.subalterno].filter(Boolean).join(' / ') || null],
      ['Categoria catastale', im.categoria_catastale],
      ['Rendita catastale', im.rendita_catastale],
    ]},
    { cat: 'Aspetti Economici', rows: [
      ['Valore di stima', ec.valore_stima],
      ['Prezzo base prima asta', ec.prezzo_base_prima_asta],
      ['Prezzo base seconda asta', ec.prezzo_base_seconda_asta],
      ['Offerta minima', ec.offerta_minima],
      ['Sconto sulla stima', ec.sconto_percentuale],
      ['Rilanci minimi', ec.rilanci_minimi],
      ['Cauzione richiesta', ec.cauzione],
    ]},
    { cat: 'Vincoli e Oneri', rows: [
      ['Ipoteche iscritte', vin.ipoteche],
      ['Trascrizioni', vin.trascrizioni],
      ['Altri gravami', vin.altri_gravami],
      ['Occupanti', vin.occupanti],
      ['Situazione giuridica occupanti', vin.situazione_giuridica_occupanti],
    ]},
    { cat: 'Modalità Vendita', rows: [
      ['Data prima asta', mo.data_prima_asta],
      ['Data seconda asta', mo.data_seconda_asta],
      ['Termine offerte', mo.termine_offerte],
      ['Modalità offerta', mo.modalita_offerta],
      ['Modalità pagamento', mo.modalita_pagamento],
    ]},
    { cat: 'Analisi Legale', rows: [
      ['Conformità art. 490 c.p.c.', al.conformita_normativa],
      ['Criticità', (al.criticita || []).join(' • ') || null],
      ['Elementi attenzione', (al.elementi_attenzione || []).join(' • ') || null],
    ]},
    { cat: 'Giudizio', rows: [
      ['Livello di rischio', g.livello_rischio],
      ['Convenienza', g.convenienza],
      ['Sintesi', g.sintesi],
      ['Raccomandazione', g.raccomandazione],
      ['Rischi identificati', (d.rischi || []).join(' • ') || null],
      ['Opportunità identificate', (d.opportunita || []).join(' • ') || null],
    ]},
  ];

  let rows = '';
  for (const s of sections) {
    for (let i = 0; i < s.rows.length; i++) {
      const [key, val] = s.rows[i];
      const isGiudizio = s.cat === 'Giudizio';
      const valHtml = val
        ? `<span class="dt-val ${isGiudizio && key === 'Livello di rischio' ? (val === 'ALTO' ? 'risk' : val === 'BASSO' ? 'good' : '') : ''}">${esc(String(val))}</span>`
        : '<span class="dt-val nd">N/D — dato non presente nel documento</span>';
      rows += `<tr>
        ${i === 0 ? `<td class="dt-cat" rowspan="${s.rows.length}">${esc(s.cat)}</td>` : ''}
        <td class="dt-key">${esc(key)}</td>
        <td>${valHtml}</td>
      </tr>`;
    }
  }

  return `<div class="data-table-wrap">
    <table class="data-table">
      <thead><tr>
        <th style="width:140px">Categoria</th>
        <th style="width:200px">Dato</th>
        <th>Valore / Dettaglio</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ── TAB SWITCH ────────────────────────────────────────
function switchTab(name, el) {
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.rtab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`.rtab[onclick*="${name}"]`)?.classList.add('active');
  $(`tab-${name}`)?.classList.add('active');
}

// ── HELPERS: IFIELD ───────────────────────────────────
function ifield(label, val, type) {
  const colSpan = type === 'full' ? 'style="grid-column:1/-1"' : '';
  const cls = val ? `if-value${type === 'big' ? ' big' : type === 'green' ? ' green' : ''}` : 'if-value nd';
  return `<div class="info-field" ${colSpan}>
    <div class="if-label">${esc(label)}</div>
    <div class="${cls}">${val ? esc(String(val)) : 'N/D'}</div>
  </div>`;
}

// ── EXPORT ────────────────────────────────────────────
function exportHTML() {
  if (!state.unified) return;
  const d = state.unified;
  const g = d.giudizio || {};
  const riskCls = { BASSO: '#16a34a', MEDIO: '#d97706', ALTO: '#dc2626' }[g.livello_rischio] || '#6b7280';
  const tableHTML = buildTabella(d)
    .replace(/class="data-table-wrap"/g, '')
    .replace(/class="data-table"/g, 'style="width:100%;border-collapse:collapse;font-size:14px"')
    .replace(/class="dt-cat"/g, 'style="font-weight:800;color:#2563eb;background:#eff6ff;padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:12px;text-transform:uppercase"')
    .replace(/class="dt-key"/g, 'style="font-weight:600;color:#374151;padding:10px 14px;border-bottom:1px solid #e5e7eb"')
    .replace(/class="([^"]*dt-val[^"]*)"/g, 'style="padding:10px 14px;border-bottom:1px solid #e5e7eb"');

  const html = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"/>
<title>REPORT — Analisi Asta Immobiliare ${new Date().toLocaleDateString('it-IT')}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#111;line-height:1.7;background:#fff}
  h1{font-size:28px;font-weight:800;margin-bottom:4px}
  h2{font-size:20px;font-weight:700;margin:32px 0 12px;color:#0f1117;border-bottom:2px solid #e5e7eb;padding-bottom:8px}
  .meta{color:#6b7280;font-size:14px;margin-bottom:32px}
  .verdict{padding:20px 24px;border-radius:10px;border:2px solid ${riskCls};background:${riskCls}18;margin:24px 0;display:flex;gap:16px;align-items:flex-start}
  .v-icon{font-size:40px}
  .v-title{font-size:20px;font-weight:800;color:${riskCls}}
  .v-desc{font-size:15px;color:#374151;margin-top:6px}
  .alert{padding:14px 18px;border-radius:8px;margin:10px 0;font-size:15px;display:flex;gap:12px}
  .alert.risk{background:#fef2f2;border:1px solid #fecaca;color:#7f1d1d}
  .alert.opp{background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d}
  .alert.info{background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a5f}
  table th{background:#0f1117;color:white;padding:10px 14px;text-align:left;font-size:12px;letter-spacing:.06em}
  @media print{body{margin:10px}}
</style></head><body>
<h1>⚖️ REPORT — Analisi Avviso di Vendita Immobiliare</h1>
<div class="meta">Generato il ${new Date().toLocaleString('it-IT')} &nbsp;|&nbsp; Documenti analizzati: ${state.results.length}</div>

<div class="verdict">
  <div class="v-icon">${{ BASSO:'✅', MEDIO:'⚠️', ALTO:'🔴' }[g.livello_rischio] || 'ℹ️'}</div>
  <div>
    <div class="v-title">Rischio ${g.livello_rischio || '?'} — Convenienza ${g.convenienza || '?'}</div>
    <div class="v-desc">${esc(g.sintesi || '')}</div>
  </div>
</div>

<h2>Analisi Legale</h2>
<div class="alert info"><span>📜</span><span>${esc(d.analisi_legale?.completezza_490cpc || 'N/D')}</span></div>
${(d.analisi_legale?.criticita || []).map(c => `<div class="alert risk"><span>⚠️</span><span>${esc(c)}</span></div>`).join('')}

<h2>Valutazione Economica</h2>
<div class="alert info"><span>🔍</span><span>${esc(d.valutazione_economica || 'N/D')}</span></div>
<div class="alert warn" style="background:#fffbeb;border:1px solid #fde68a"><span>💡</span><span>${esc(d.spese_stimate || 'Stima spese non disponibile.')}</span></div>

<h2>Rischi</h2>
${(d.rischi || []).map(r => `<div class="alert risk"><span>🔴</span><span>${esc(r)}</span></div>`).join('') || '<p>Nessun rischio identificato.</p>'}

<h2>Opportunità</h2>
${(d.opportunita || []).map(o => `<div class="alert opp"><span>🟢</span><span>${esc(o)}</span></div>`).join('') || '<p>Nessuna opportunità identificata.</p>'}

<h2>Tabella Dati Principali</h2>
${tableHTML}

<h2>Raccomandazione finale</h2>
<div class="alert info"><span>⚖️</span><span>${esc(g.raccomandazione || 'Consulta sempre un avvocato abilitato prima di procedere.')}</span></div>

<hr style="margin:40px 0;border:none;border-top:1px solid #e5e7eb"/>
<p style="font-size:12px;color:#9ca3af">⚠️ Questo report è uno strumento di supporto informativo e non costituisce consulenza legale professionale ai sensi della L. 247/2012.</p>
</body></html>`;
  download('report_asta_immobiliare.html', html, 'text/html');
}

function exportText() {
  if (!state.unified) return;
  const d = state.unified;
  const p = d.procedura || {}; const im = d.immobile || {}; const ec = d.economico || {};
  const vin = d.vincoli || {}; const mo = d.modalita_vendita || {}; const g = d.giudizio || {};
  const al = d.analisi_legale || {};
  const n = v => v || 'N/D';
  const txt = `
══════════════════════════════════════════════════════
  REPORT — Analisi Avviso di Vendita Immobiliare
  Data: ${new Date().toLocaleString('it-IT')}
  Documenti analizzati: ${state.results.length}
══════════════════════════════════════════════════════

GIUDIZIO FINALE
  Rischio:        ${n(g.livello_rischio)}
  Convenienza:    ${n(g.convenienza)}
  Sintesi:        ${n(g.sintesi)}
  Raccomandazione:${n(g.raccomandazione)}

DATI PROCEDURA
  Tipo:           ${n(p.tipo)}
  Tribunale:      ${n(p.tribunale)}
  N° RGE:         ${n(p.rge)}
  Giudice:        ${n(p.giudice)}
  Delegato:       ${n(p.delegato)}
  Data pubbl.:    ${n(p.data_pubblicazione)}

IMMOBILE
  Tipologia:      ${n(im.tipologia)}
  Indirizzo:      ${n(im.ubicazione)}
  Superficie:     ${n(im.superficie_catastale)}
  Catasto:        Fg.${n(im.foglio)} / Part.${n(im.particella)} / Sub.${n(im.subalterno)}
  Categoria:      ${n(im.categoria_catastale)}
  Rendita:        ${n(im.rendita_catastale)}

ASPETTI ECONOMICI
  Valore stima:   ${n(ec.valore_stima)}
  Base 1ª asta:   ${n(ec.prezzo_base_prima_asta)}
  Base 2ª asta:   ${n(ec.prezzo_base_seconda_asta)}
  Offerta min:    ${n(ec.offerta_minima)}
  Sconto:         ${n(ec.sconto_percentuale)}
  Rilanci:        ${n(ec.rilanci_minimi)}
  Cauzione:       ${n(ec.cauzione)}

VINCOLI E ONERI
  Ipoteche:       ${n(vin.ipoteche)}
  Trascrizioni:   ${n(vin.trascrizioni)}
  Altri gravami:  ${n(vin.altri_gravami)}
  Occupanti:      ${n(vin.occupanti)}
  Sit. giur.:     ${n(vin.situazione_giuridica_occupanti)}

MODALITÀ VENDITA
  1ª asta:        ${n(mo.data_prima_asta)}
  2ª asta:        ${n(mo.data_seconda_asta)}
  Termine off.:   ${n(mo.termine_offerte)}
  Mod. offerta:   ${n(mo.modalita_offerta)}
  Pagamento:      ${n(mo.modalita_pagamento)}

ANALISI LEGALE
  ${n(al.completezza_490cpc)}
  ${n(al.conformita_normativa)}

CRITICITÀ
${(al.criticita || []).map((c, i) => `  ${i+1}. ${c}`).join('\n') || '  Nessuna criticità identificata.'}

RISCHI
${(d.rischi || []).map((r, i) => `  ${i+1}. [RISCHIO] ${r}`).join('\n') || '  Nessun rischio.'}

OPPORTUNITÀ
${(d.opportunita || []).map((o, i) => `  ${i+1}. [OPP.] ${o}`).join('\n') || '  Nessuna opportunità.'}

VALUTAZIONE ECONOMICA
  ${n(d.valutazione_economica)}
  Spese stimate: ${n(d.spese_stimate)}

══════════════════════════════════════════════════════
  Non costituisce consulenza legale ex L. 247/2012
══════════════════════════════════════════════════════
`.trim();
  download('report_asta_immobiliare.txt', txt, 'text/plain');
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── PROGRESS HELPERS ──────────────────────────────────
function setProgress(pct, title, desc) {
  $('progressBar').style.width = pct + '%';
  if (title) $('progressTitle').textContent = title;
  if (desc) $('progressDesc').textContent = desc;
}

function addLog(msg, type = 'info') {
  const log = $('progressSteps') || $('block-progress').querySelector('.progress-steps');
  const el = document.createElement('div');
  el.className = `plog ${type}`;
  el.textContent = msg;
  $('progressLog').appendChild(el);
  $('progressLog').scrollTop = $('progressLog').scrollHeight;
}

// ── UTILS ─────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function v(val) { return val || 'N/D'; }

function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
