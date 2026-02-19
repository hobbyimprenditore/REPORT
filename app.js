/* ═══════════════════════════════════════════════════════
   LexAsta — App Logic
   Analisi avvisi di vendita immobiliare via Claude AI
═══════════════════════════════════════════════════════ */

'use strict';

// ── STATE ─────────────────────────────────────────────
const state = {
  apiKey: '',
  files: [],        // { id, file, name, size, type, text, status }
  results: [],      // { fileId, rawAnalysis }
  unified: null,    // final merged analysis object
};

// ── DOM REFS ──────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupDragDrop();
  $('fileInput').addEventListener('change', handleFileSelect);
});

// ── API KEY ───────────────────────────────────────────
function verifyApiKey() {
  const key = $('apiKey').value.trim();
  const status = $('apiStatus');
  if (!key.startsWith('sk-ant')) {
    status.className = 'api-status error';
    status.textContent = '✗ Formato chiave non valido. Deve iniziare con sk-ant-…';
    return;
  }
  state.apiKey = key;
  status.className = 'api-status ok';
  status.textContent = '✓ Chiave configurata correttamente';
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

function handleFileSelect(e) {
  handleFiles(Array.from(e.target.files));
}

function handleFiles(files) {
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt', 'doc', 'docx', 'png', 'jpg', 'jpeg'].includes(ext)) {
      alert(`File non supportato: ${file.name}`);
      continue;
    }
    if (state.files.find(f => f.name === file.name)) continue; // dedup
    state.files.push({
      id: `f${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      name: file.name,
      size: file.size,
      type: ext,
      text: null,
      status: 'pending'
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
  state.files = [];
  state.results = [];
  state.unified = null;
  renderFileList();
  updateAnalyzeBtn();
  $('progressSection').classList.add('hidden');
  $('analisi').classList.add('hidden');
  $('fileInput').value = '';
}

// ── FILE LIST RENDER ──────────────────────────────────
function renderFileList() {
  const list = $('fileList');
  if (state.files.length === 0) {
    list.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  list.classList.remove('hidden');
  list.innerHTML = state.files.map(f => `
    <div class="file-item" id="item_${f.id}">
      <div class="file-icon">${fileIcon(f.type)}</div>
      <div class="file-info">
        <div class="file-name">${escHtml(f.name)}</div>
        <div class="file-size">${formatSize(f.size)}</div>
      </div>
      <div class="file-status ${f.status}" id="status_${f.id}">${statusLabel(f.status)}</div>
      <button class="file-remove" onclick="removeFile('${f.id}')" title="Rimuovi">✕</button>
    </div>
  `).join('');
}

function fileIcon(ext) {
  const map = { pdf: '📕', txt: '📄', doc: '📝', docx: '📝', png: '🖼', jpg: '🖼', jpeg: '🖼' };
  return map[ext] || '📄';
}

function statusLabel(s) {
  const map = { pending: 'In attesa', processing: 'Analisi…', done: '✓ Completato', error: '✗ Errore' };
  return map[s] || s;
}

function setFileStatus(id, status) {
  const f = state.files.find(f => f.id === id);
  if (f) f.status = status;
  const el = $(`status_${id}`);
  if (el) { el.className = `file-status ${status}`; el.textContent = statusLabel(status); }
}

// ── ANALYZE BUTTON ────────────────────────────────────
function updateAnalyzeBtn() {
  const btn = $('analyzeBtn');
  btn.disabled = state.files.length === 0 || !state.apiKey;
}

// ── MAIN ANALYSIS FLOW ────────────────────────────────
async function startAnalysis() {
  if (!state.apiKey) { alert('Inserisci prima la API Key.'); return; }
  if (state.files.length === 0) { alert('Carica almeno un file.'); return; }

  // Show progress
  $('progressSection').classList.remove('hidden');
  $('analisi').classList.add('hidden');
  $('progressSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('analyzeBtn').disabled = true;

  state.results = [];
  setProgress(0, `Analisi di ${state.files.length} documento/i…`, 'Avvio elaborazione');

  // Step 1: extract text from all files
  for (let i = 0; i < state.files.length; i++) {
    const f = state.files[i];
    setFileStatus(f.id, 'processing');
    addLog(`Lettura file: ${f.name}`, 'info');
    try {
      f.text = await extractText(f);
      addLog(`✓ Testo estratto da ${f.name} (${f.text.length} caratteri)`, 'ok');
    } catch (e) {
      addLog(`✗ Errore lettura ${f.name}: ${e.message}`, 'warn');
      f.text = `[Impossibile estrarre testo da ${f.name}]`;
    }
    setProgress(Math.round((i + 1) / state.files.length * 30));
  }

  // Step 2: analyze each file
  for (let i = 0; i < state.files.length; i++) {
    const f = state.files[i];
    addLog(`Analisi legale: ${f.name}…`, 'info');
    $('progressTitle').textContent = `Analisi documento ${i + 1} di ${state.files.length}`;
    $('progressDesc').textContent = f.name;
    try {
      const analysis = await analyzeWithClaude(f.text, f.name);
      state.results.push({ fileId: f.id, name: f.name, rawAnalysis: analysis });
      setFileStatus(f.id, 'done');
      addLog(`✓ Analisi completata: ${f.name}`, 'ok');
    } catch (e) {
      setFileStatus(f.id, 'error');
      addLog(`✗ Errore analisi ${f.name}: ${e.message}`, 'warn');
    }
    setProgress(30 + Math.round((i + 1) / state.files.length * 50));
  }

  // Step 3: merge all results
  if (state.results.length > 0) {
    addLog('Consolidamento report unificato…', 'info');
    $('progressTitle').textContent = 'Consolidamento dati…';
    $('progressDesc').textContent = 'Fusione di tutti i report in un documento unico';
    try {
      const merged = await mergeAnalyses(state.results);
      state.unified = merged;
      addLog('✓ Report unificato generato', 'ok');
      setProgress(100);
      setTimeout(() => {
        $('progressSection').classList.add('hidden');
        renderResults(merged);
        $('analisi').classList.remove('hidden');
        $('analisi').scrollIntoView({ behavior: 'smooth' });
      }, 600);
    } catch (e) {
      addLog(`✗ Errore consolidamento: ${e.message}`, 'warn');
      $('progressTitle').textContent = 'Errore consolidamento';
    }
  } else {
    addLog('✗ Nessun documento analizzato con successo.', 'warn');
    $('progressTitle').textContent = 'Analisi fallita';
  }

  $('analyzeBtn').disabled = false;
}

// ── TEXT EXTRACTION ───────────────────────────────────
function extractText(f) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (['txt'].includes(f.type)) {
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Lettura fallita'));
      reader.readAsText(f.file, 'utf-8');
    } else if (['png', 'jpg', 'jpeg'].includes(f.type)) {
      // For images, we'll send as base64 to Claude vision
      reader.onload = e => resolve(`[IMMAGINE:BASE64:${e.target.result}]`);
      reader.onerror = () => reject(new Error('Lettura immagine fallita'));
      reader.readAsDataURL(f.file);
    } else if (['pdf', 'doc', 'docx'].includes(f.type)) {
      // Read as text (PDF text extraction is best-effort)
      reader.onload = e => {
        try {
          // Try to extract readable text from binary
          const arr = new Uint8Array(e.target.result);
          let text = '';
          for (let i = 0; i < arr.length; i++) {
            const c = arr[i];
            if ((c >= 32 && c <= 126) || c === 10 || c === 13) text += String.fromCharCode(c);
          }
          // Filter readable portions (heuristic)
          const lines = text.split('\n').filter(l => l.trim().length > 8 && /[a-zA-ZÀ-ÿ]{3,}/.test(l));
          const cleaned = lines.join('\n').replace(/\s{3,}/g, ' ').trim();
          resolve(cleaned.length > 100 ? cleaned : `[Testo non estraibile da ${f.name} — fornisci il contenuto come .txt]`);
        } catch(err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Lettura PDF fallita'));
      reader.readAsArrayBuffer(f.file);
    } else {
      reject(new Error('Formato non supportato'));
    }
  });
}

// ── CLAUDE API CALL ───────────────────────────────────
async function callClaude(messages, system) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': state.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system,
      messages
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data.content?.map(b => b.text || '').join('') || '';
}

// ── ANALYZE SINGLE DOCUMENT ───────────────────────────
async function analyzeWithClaude(text, filename) {
  const isImage = text.startsWith('[IMMAGINE:BASE64:');

  const system = `Sei un avvocato esperto in diritto immobiliare ed esecuzioni forzate con 20 anni di esperienza nell'analisi di procedure esecutive immobiliari.

Analizza l'avviso di vendita immobiliare fornito e restituisci un JSON strutturato con la seguente forma ESATTA (usa null per dati mancanti):

{
  "procedura": {
    "tipo": "esecuzione immobiliare | fallimento | liquidazione coatta | altro",
    "tribunale": "...",
    "rge": "...",
    "giudice": "...",
    "delegato": "...",
    "data_pubblicazione": "..."
  },
  "immobile": {
    "tipologia": "...",
    "ubicazione": "...",
    "superficie_catastale": "...",
    "foglio": "...",
    "particella": "...",
    "subalterno": "...",
    "categoria_catastale": "...",
    "rendita_catastale": "...",
    "descrizione": "..."
  },
  "economico": {
    "prezzo_base_prima_asta": "...",
    "prezzo_base_seconda_asta": "...",
    "offerta_minima": "...",
    "valore_stima": "...",
    "rilanci_minimi": "...",
    "cauzione": "...",
    "sconto_percentuale": "..."
  },
  "vincoli": {
    "ipoteche": "...",
    "trascrizioni": "...",
    "altri_gravami": "...",
    "occupanti": "...",
    "situazione_giuridica_occupanti": "..."
  },
  "modalita_vendita": {
    "data_prima_asta": "...",
    "data_seconda_asta": "...",
    "termine_offerte": "...",
    "modalita_offerta": "...",
    "modalita_pagamento": "...",
    "tribunale_competente": "..."
  },
  "analisi_legale": {
    "completezza_490cpc": "...",
    "criticita": ["...", "..."],
    "elementi_attenzione": ["...", "..."],
    "conformita_normativa": "..."
  },
  "rischi": ["...", "..."],
  "opportunita": ["...", "..."],
  "valutazione_economica": "...",
  "spese_stimate": "...",
  "giudizio": {
    "livello_rischio": "BASSO | MEDIO | ALTO",
    "convenienza": "ALTA | MEDIA | BASSA",
    "sintesi": "...",
    "raccomandazione": "..."
  }
}

Restituisci SOLO il JSON valido, senza markdown, senza commenti, senza testo aggiuntivo.`;

  let userContent;
  if (isImage) {
    const b64 = text.replace('[IMMAGINE:BASE64:', '').replace(']', '');
    const [meta, data] = b64.split(',');
    const mediaType = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
      { type: 'text', text: `Analizza questo avviso di vendita immobiliare (file: ${filename}).` }
    ];
  } else {
    userContent = `Analizza il seguente avviso di vendita immobiliare (file: ${filename}):\n\n${text.slice(0, 15000)}`;
  }

  const raw = await callClaude(
    [{ role: 'user', content: userContent }],
    system
  );

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error('JSON parse error:', e, '\nRaw:', raw);
    throw new Error('Risposta API non valida: ' + e.message);
  }
}

// ── MERGE ANALYSES ────────────────────────────────────
async function mergeAnalyses(results) {
  if (results.length === 1) return results[0].rawAnalysis;

  // Build merged by taking first non-null value across all results
  const all = results.map(r => r.rawAnalysis);

  const merged = deepMergeFirst(all);

  // If multiple files, also ask Claude to produce a unified narrative summary
  const summaryPrompt = `Hai analizzato ${results.length} documenti relativi alla stessa procedura esecutiva immobiliare.
Di seguito i dati estratti da ciascun documento:

${results.map((r, i) => `--- Documento ${i + 1}: ${r.name} ---\n${JSON.stringify(r.rawAnalysis, null, 2)}`).join('\n\n')}

Produci un JSON unificato con la stessa struttura, compensando i dati mancanti da un documento con quelli presenti negli altri. Se ci sono contraddizioni, scegli il dato più affidabile e segnalalo. Aggiorna il campo "giudizio.sintesi" per riflettere l'analisi complessiva di tutti i documenti.

Restituisci SOLO il JSON valido.`;

  try {
    const raw = await callClaude(
      [{ role: 'user', content: summaryPrompt }],
      'Sei un avvocato esperto in diritto immobiliare. Restituisci SOLO JSON valido, nessun testo aggiuntivo.'
    );
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch(e) {
    console.warn('Merge API fallita, uso merge locale:', e);
    return merged;
  }
}

function deepMergeFirst(objects) {
  const result = {};
  const keys = [...new Set(objects.flatMap(o => Object.keys(o || {})))];
  for (const key of keys) {
    const vals = objects.map(o => o?.[key]);
    if (vals.some(v => v !== null && typeof v === 'object' && !Array.isArray(v))) {
      result[key] = deepMergeFirst(vals.filter(v => v !== null && typeof v === 'object' && !Array.isArray(v)));
    } else if (vals.some(Array.isArray)) {
      const arr = vals.filter(Array.isArray).flat();
      result[key] = [...new Set(arr)];
    } else {
      result[key] = vals.find(v => v !== null && v !== undefined && v !== '') ?? null;
    }
  }
  return result;
}

// ── RENDER RESULTS ────────────────────────────────────
function renderResults(data) {
  // Verdict badge
  renderVerdict(data.giudizio);

  // Overview tab
  $('overviewContent').innerHTML = buildOverview(data);

  // Legal tab
  $('legalContent').innerHTML = buildLegal(data);

  // Economic tab
  $('economicContent').innerHTML = buildEconomic(data);

  // Risks tab
  $('risksContent').innerHTML = buildRisks(data);

  // Table tab
  $('tableContent').innerHTML = buildTable(data);

  // Reset to overview tab
  switchTab('overview', document.querySelector('.tab[data-tab="overview"]'));
}

function v(val, fallback = '<span class="val-missing">N/D</span>') {
  if (val === null || val === undefined || val === '') return fallback;
  return escHtml(String(val));
}

function renderVerdict(g) {
  if (!g) return;
  const badge = $('verdictBadge');
  const risk = g.livello_rischio || 'MEDIO';
  const cls = { 'BASSO': 'low', 'MEDIO': 'mid', 'ALTO': 'high' }[risk] || 'mid';
  const icon = { 'BASSO': '✅', 'MEDIO': '⚠️', 'ALTO': '🔴' }[risk] || '⚠️';
  badge.className = `verdict-badge ${cls}`;
  badge.innerHTML = `
    <div class="verdict-icon">${icon}</div>
    <div class="verdict-text">
      <div class="verdict-label">Giudizio Finale — Livello di Rischio</div>
      <div class="verdict-title">Rischio ${risk} — Convenienza ${v(g.convenienza, 'N/D')}</div>
      <div class="verdict-desc">${escHtml(g.sintesi || '')}</div>
    </div>
  `;
  badge.classList.remove('hidden');
}

function buildOverview(d) {
  const p = d.procedura || {};
  const im = d.immobile || {};
  const g = d.giudizio || {};
  return `
    <h2>Sintesi della Procedura</h2>
    <p><strong>Tipo di procedura:</strong> ${v(p.tipo)}</p>
    <p><strong>Immobile:</strong> ${v(im.tipologia)} — ${v(im.ubicazione)}</p>
    <p><strong>Categoria catastale:</strong> ${v(im.categoria_catastale)}</p>

    <h3>Descrizione</h3>
    <p>${v(im.descrizione, 'Nessuna descrizione disponibile.')}</p>

    <h3>Valutazione Sintetica</h3>
    <div class="${g.livello_rischio === 'ALTO' ? 'risk-block' : g.livello_rischio === 'BASSO' ? 'opp-block' : 'info-block'}">
      <strong>${v(g.livello_rischio, '?')} RISCHIO</strong> — Convenienza: ${v(g.convenienza)}<br/>
      ${escHtml(g.sintesi || '')}
    </div>
    <p><strong>Raccomandazione:</strong> ${v(g.raccomandazione)}</p>
  `;
}

function buildLegal(d) {
  const p = d.procedura || {};
  const a = d.analisi_legale || {};
  const v2 = d.modalita_vendita || {};
  return `
    <h2>Analisi Legale</h2>

    <h3>Dati della Procedura</h3>
    <p><strong>Tribunale:</strong> ${v(p.tribunale)}<br/>
    <strong>N° RGE:</strong> ${v(p.rge)}<br/>
    <strong>Giudice dell'esecuzione:</strong> ${v(p.giudice)}<br/>
    <strong>Professionista delegato:</strong> ${v(p.delegato)}<br/>
    <strong>Data pubblicazione:</strong> ${v(p.data_pubblicazione)}</p>

    <h3>Conformità Art. 490 c.p.c.</h3>
    <div class="info-block">${escHtml(a.completezza_490cpc || 'Verifica non disponibile.')}</div>
    <p>${escHtml(a.conformita_normativa || '')}</p>

    <h3>Modalità di Vendita</h3>
    <p><strong>Modalità offerta:</strong> ${v(v2.modalita_offerta)}<br/>
    <strong>Pagamento:</strong> ${v(v2.modalita_pagamento)}</p>

    <h3>Criticità Legali</h3>
    ${(a.criticita || []).length > 0
      ? (a.criticita || []).map(c => `<div class="risk-block">⚠ ${escHtml(c)}</div>`).join('')
      : '<p><em>Nessuna criticità rilevante identificata.</em></p>'}

    <h3>Elementi di Attenzione</h3>
    ${(a.elementi_attenzione || []).length > 0
      ? '<ul>' + (a.elementi_attenzione || []).map(e => `<li>${escHtml(e)}</li>`).join('') + '</ul>'
      : '<p><em>Nessun elemento specifico segnalato.</em></p>'}
  `;
}

function buildEconomic(d) {
  const e = d.economico || {};
  return `
    <h2>Valutazione Economica</h2>

    <h3>Prezzi e Offerte</h3>
    <p><strong>Valore di stima peritale:</strong> ${v(e.valore_stima)}<br/>
    <strong>Prezzo base prima asta:</strong> ${v(e.prezzo_base_prima_asta)}<br/>
    <strong>Prezzo base seconda asta:</strong> ${v(e.prezzo_base_seconda_asta)}<br/>
    <strong>Offerta minima:</strong> ${v(e.offerta_minima)}<br/>
    <strong>Sconto rispetto alla stima:</strong> ${v(e.sconto_percentuale)}<br/>
    <strong>Rilanci minimi:</strong> ${v(e.rilanci_minimi)}<br/>
    <strong>Cauzione:</strong> ${v(e.cauzione)}</p>

    <h3>Analisi del Rapporto Prezzo/Mercato</h3>
    <div class="info-block">${escHtml(d.valutazione_economica || 'Analisi non disponibile.')}</div>

    <h3>Spese Prevedibili</h3>
    <div class="opp-block">${escHtml(d.spese_stimate || 'Stima spese non disponibile. Considera: imposte di registro/IVA, onorari notarili, spese procedurali, eventuali costi di sgombero occupanti.')}</div>
  `;
}

function buildRisks(d) {
  const risks = d.rischi || [];
  const opps = d.opportunita || [];
  return `
    <h2>Rischi &amp; Opportunità</h2>

    <h3>⛔ Rischi Principali</h3>
    ${risks.length > 0
      ? risks.map(r => `<div class="risk-block">🔴 ${escHtml(r)}</div>`).join('')
      : '<p><em>Nessun rischio significativo identificato.</em></p>'}

    <h3>✅ Opportunità per l'Investitore</h3>
    ${opps.length > 0
      ? opps.map(o => `<div class="opp-block">🟢 ${escHtml(o)}</div>`).join('')
      : '<p><em>Nessuna opportunità specifica identificata.</em></p>'}

    <h3>Situazione Occupanti</h3>
    ${(() => {
      const vin = d.vincoli || {};
      return `<p><strong>Occupanti:</strong> ${v(vin.occupanti)}<br/>
      <strong>Situazione giuridica:</strong> ${v(vin.situazione_giuridica_occupanti)}</p>`;
    })()}
  `;
}

function buildTable(d) {
  const p = d.procedura || {};
  const im = d.immobile || {};
  const ec = d.economico || {};
  const vin = d.vincoli || {};
  const mo = d.modalita_vendita || {};
  const al = d.analisi_legale || {};

  const rows = [
    // PROCEDURA
    ['DATI PROCEDURA', 'Tipo di Procedura', p.tipo],
    ['', 'Tribunale', p.tribunale],
    ['', 'Numero RGE', p.rge],
    ['', 'Giudice dell\'Esecuzione', p.giudice],
    ['', 'Professionista Delegato', p.delegato],
    ['', 'Data Pubblicazione Avviso', p.data_pubblicazione],
    // IMMOBILE
    ['IMMOBILE', 'Tipologia', im.tipologia],
    ['', 'Ubicazione Completa', im.ubicazione],
    ['', 'Superficie Catastale', im.superficie_catastale],
    ['', 'Foglio / Particella', `${im.foglio || '—'} / ${im.particella || '—'}${im.subalterno ? ' / Sub. ' + im.subalterno : ''}`],
    ['', 'Categoria Catastale', im.categoria_catastale],
    ['', 'Rendita Catastale', im.rendita_catastale],
    // ECONOMICO
    ['ASPETTI ECONOMICI', 'Valore di Stima', ec.valore_stima],
    ['', 'Prezzo Base Prima Asta', ec.prezzo_base_prima_asta],
    ['', 'Prezzo Base Seconda Asta', ec.prezzo_base_seconda_asta],
    ['', 'Offerta Minima', ec.offerta_minima],
    ['', 'Sconto sulla Stima', ec.sconto_percentuale],
    ['', 'Offerte Aumentative (rilanci)', ec.rilanci_minimi],
    ['', 'Cauzione Richiesta', ec.cauzione],
    // VINCOLI
    ['VINCOLI E ONERI', 'Ipoteche Iscritte', vin.ipoteche],
    ['', 'Trascrizioni', vin.trascrizioni],
    ['', 'Altri Gravami', vin.altri_gravami],
    ['', 'Occupanti', vin.occupanti],
    ['', 'Situazione Giuridica Occupanti', vin.situazione_giuridica_occupanti],
    // MODALITÀ
    ['MODALITÀ VENDITA', 'Data Prima Asta', mo.data_prima_asta],
    ['', 'Data Seconda Asta', mo.data_seconda_asta],
    ['', 'Termine Presentazione Offerte', mo.termine_offerte],
    ['', 'Modalità Offerta', mo.modalita_offerta],
    ['', 'Modalità Pagamento', mo.modalita_pagamento],
    // CRITICITÀ
    ['CRITICITÀ', 'Rischi Identificati', (d.rischi || []).join(' | ')],
    ['', 'Elementi di Attenzione', (al.elementi_attenzione || []).join(' | ')],
    ['', 'Conformità Art. 490 c.p.c.', al.conformita_normativa],
    // GIUDIZIO
    ['GIUDIZIO', 'Livello di Rischio', d.giudizio?.livello_rischio],
    ['', 'Convenienza', d.giudizio?.convenienza],
    ['', 'Sintesi', d.giudizio?.sintesi],
    ['', 'Raccomandazione', d.giudizio?.raccomandazione],
  ];

  let lastCat = '';
  let tbody = '';

  for (const [cat, key, val] of rows) {
    const isCatRow = cat !== '';
    const catCell = isCatRow && cat !== lastCat
      ? `<td class="cat-cell" rowspan="${countRowspan(rows, cat)}">${escHtml(cat)}</td>`
      : (cat !== lastCat ? '' : '');
    if (cat !== '' && cat !== lastCat) lastCat = cat;

    const isRisk = cat === 'CRITICITÀ' && (key.includes('Rischi') || key.includes('Elementi'));
    const valHtml = (val === null || val === undefined || val === '')
      ? '<span class="val-missing">N/D — dato non presente nel/i documento/i</span>'
      : `<span class="${isRisk ? 'val-risk' : ''}">${escHtml(String(val))}</span>`;

    tbody += `<tr>
      ${cat !== lastCat || isCatRow && catCell ? catCell : ''}
      <td class="key-cell">${escHtml(key)}</td>
      <td class="val-cell">${valHtml}</td>
    </tr>`;
  }

  // Rebuild properly with rowspans
  return buildProperTable(rows);
}

function buildProperTable(rows) {
  // Group by category
  const groups = [];
  let current = null;
  for (const [cat, key, val] of rows) {
    if (cat !== '') {
      current = { cat, items: [] };
      groups.push(current);
    }
    current.items.push([key, val]);
  }

  let html = `<table class="data-table">
    <thead><tr>
      <th style="width:160px">Categoria</th>
      <th style="width:220px">Dato</th>
      <th>Valore / Dettaglio</th>
    </tr></thead>
    <tbody>`;

  for (const g of groups) {
    for (let i = 0; i < g.items.length; i++) {
      const [key, val] = g.items[i];
      const isRisk = g.cat === 'CRITICITÀ';
      const valHtml = (val === null || val === undefined || val === '')
        ? '<span class="val-missing">N/D — dato non presente nel/i documento/i</span>'
        : `<span class="${isRisk ? 'val-risk' : ''}">${escHtml(String(val))}</span>`;

      html += `<tr>`;
      if (i === 0) {
        html += `<td class="cat-cell" rowspan="${g.items.length}">${escHtml(g.cat)}</td>`;
      }
      html += `<td class="key-cell">${escHtml(key)}</td>
        <td class="val-cell">${valHtml}</td>
      </tr>`;
    }
  }

  html += `</tbody></table>`;
  return html;
}

function countRowspan(rows, cat) {
  let count = 0;
  let found = false;
  for (const [c] of rows) {
    if (c === cat) { found = true; count++; }
    else if (found && c !== '') break;
    else if (found && c === '') count++;
  }
  return count;
}

// ── TAB SWITCHING ─────────────────────────────────────
function switchTab(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  const tc = $(`tab-${name}`);
  if (tc) tc.classList.add('active');
}

// ── EXPORT ────────────────────────────────────────────
function exportHTML() {
  if (!state.unified) return;
  const d = state.unified;
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/>
<title>Report Analisi Asta Immobiliare — ${new Date().toLocaleDateString('it-IT')}</title>
<style>
  body { font-family: Georgia, serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #222; line-height: 1.8; }
  h1 { border-bottom: 3px solid #9a7b3a; padding-bottom: 10px; color: #1a1510; }
  h2 { color: #9a7b3a; margin-top: 32px; border-bottom: 1px solid #e0d8c8; padding-bottom: 6px; }
  h3 { color: #3d342a; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
  th { background: #1a1510; color: #c9a84c; padding: 10px 14px; text-align: left; }
  td { padding: 9px 14px; border-bottom: 1px solid #e0d8c8; vertical-align: top; }
  .cat { font-weight: bold; color: #9a7b3a; background: #fdf9f0; }
  .risk { background: #fdf0f0; border-left: 4px solid #8b2020; padding: 12px 16px; margin: 10px 0; }
  .opp  { background: #f0fdf4; border-left: 4px solid #1a5c2e; padding: 12px 16px; margin: 10px 0; }
  .verdict { padding: 20px; margin: 20px 0; border-radius: 4px; border: 2px solid; }
  .low  { border-color: #1a5c2e; background: #f0fdf4; }
  .mid  { border-color: #d4a017; background: #fffbf0; }
  .high { border-color: #8b2020; background: #fdf0f0; }
  .nd { color: #999; font-style: italic; }
  @media print { body { margin: 10px; } }
</style>
</head>
<body>
<h1>§ Report Analisi Avviso di Vendita Immobiliare</h1>
<p><strong>Generato il:</strong> ${new Date().toLocaleString('it-IT')}<br/>
<strong>Documenti analizzati:</strong> ${state.results.length}</p>

<div class="verdict ${d.giudizio?.livello_rischio === 'ALTO' ? 'high' : d.giudizio?.livello_rischio === 'BASSO' ? 'low' : 'mid'}">
  <strong>GIUDIZIO: Rischio ${d.giudizio?.livello_rischio || '?'} — Convenienza ${d.giudizio?.convenienza || '?'}</strong><br/>
  ${escHtml(d.giudizio?.sintesi || '')}
</div>

<h2>Analisi Legale</h2>
<p>${escHtml(d.analisi_legale?.completezza_490cpc || '')}</p>
${(d.analisi_legale?.criticita || []).map(c => `<div class="risk">⚠ ${escHtml(c)}</div>`).join('')}

<h2>Valutazione Economica</h2>
<p>${escHtml(d.valutazione_economica || '')}</p>
<p><strong>Spese stimate:</strong> ${escHtml(d.spese_stimate || 'N/D')}</p>

<h2>Rischi</h2>
${(d.rischi || []).map(r => `<div class="risk">🔴 ${escHtml(r)}</div>`).join('') || '<p>Nessun rischio identificato.</p>'}

<h2>Opportunità</h2>
${(d.opportunita || []).map(o => `<div class="opp">🟢 ${escHtml(o)}</div>`).join('') || '<p>Nessuna opportunità identificata.</p>'}

<h2>Tabella Dati Principali</h2>
${buildTable(d)}

<h2>Raccomandazione Finale</h2>
<p>${escHtml(d.giudizio?.raccomandazione || 'Consultare un avvocato abilitato prima di procedere.')}</p>

<hr/>
<p style="font-size:12px;color:#999">Report generato da LexAsta — Strumento di supporto all'analisi. Non costituisce consulenza legale ex L. 247/2012.</p>
</body></html>`;

  download('report_asta_immobiliare.html', html, 'text/html');
}

function exportText() {
  if (!state.unified) return;
  const d = state.unified;
  const p = d.procedura || {};
  const im = d.immobile || {};
  const ec = d.economico || {};
  const vin = d.vincoli || {};
  const mo = d.modalita_vendita || {};
  const al = d.analisi_legale || {};

  const txt = `
══════════════════════════════════════════════════════════
  REPORT ANALISI AVVISO DI VENDITA IMMOBILIARE
  Generato: ${new Date().toLocaleString('it-IT')}
  Documenti analizzati: ${state.results.length}
══════════════════════════════════════════════════════════

■ GIUDIZIO FINALE
  Rischio: ${d.giudizio?.livello_rischio || 'N/D'}
  Convenienza: ${d.giudizio?.convenienza || 'N/D'}
  Sintesi: ${d.giudizio?.sintesi || 'N/D'}
  Raccomandazione: ${d.giudizio?.raccomandazione || 'N/D'}

══════════════════════════════════════════════════════════
■ DATI PROCEDURA
══════════════════════════════════════════════════════════
  Tipo:               ${p.tipo || 'N/D'}
  Tribunale:          ${p.tribunale || 'N/D'}
  N° RGE:             ${p.rge || 'N/D'}
  Giudice:            ${p.giudice || 'N/D'}
  Delegato:           ${p.delegato || 'N/D'}
  Data pubblicazione: ${p.data_pubblicazione || 'N/D'}

══════════════════════════════════════════════════════════
■ IMMOBILE
══════════════════════════════════════════════════════════
  Tipologia:          ${im.tipologia || 'N/D'}
  Ubicazione:         ${im.ubicazione || 'N/D'}
  Superficie:         ${im.superficie_catastale || 'N/D'}
  Dati catastali:     Fg. ${im.foglio || '-'} / Part. ${im.particella || '-'} / Sub. ${im.subalterno || '-'}
  Categoria:          ${im.categoria_catastale || 'N/D'}
  Rendita:            ${im.rendita_catastale || 'N/D'}
  Descrizione:        ${im.descrizione || 'N/D'}

══════════════════════════════════════════════════════════
■ ASPETTI ECONOMICI
══════════════════════════════════════════════════════════
  Valore di stima:    ${ec.valore_stima || 'N/D'}
  Base prima asta:    ${ec.prezzo_base_prima_asta || 'N/D'}
  Base seconda asta:  ${ec.prezzo_base_seconda_asta || 'N/D'}
  Offerta minima:     ${ec.offerta_minima || 'N/D'}
  Sconto:             ${ec.sconto_percentuale || 'N/D'}
  Rilanci minimi:     ${ec.rilanci_minimi || 'N/D'}
  Cauzione:           ${ec.cauzione || 'N/D'}

══════════════════════════════════════════════════════════
■ VINCOLI E ONERI
══════════════════════════════════════════════════════════
  Ipoteche:           ${vin.ipoteche || 'N/D'}
  Trascrizioni:       ${vin.trascrizioni || 'N/D'}
  Altri gravami:      ${vin.altri_gravami || 'N/D'}
  Occupanti:          ${vin.occupanti || 'N/D'}
  Sit. giuridica:     ${vin.situazione_giuridica_occupanti || 'N/D'}

══════════════════════════════════════════════════════════
■ MODALITÀ DI VENDITA
══════════════════════════════════════════════════════════
  Data prima asta:    ${mo.data_prima_asta || 'N/D'}
  Data seconda asta:  ${mo.data_seconda_asta || 'N/D'}
  Termine offerte:    ${mo.termine_offerte || 'N/D'}
  Modalità offerta:   ${mo.modalita_offerta || 'N/D'}
  Pagamento:          ${mo.modalita_pagamento || 'N/D'}

══════════════════════════════════════════════════════════
■ ANALISI LEGALE — ART. 490 C.P.C.
══════════════════════════════════════════════════════════
  ${al.completezza_490cpc || 'N/D'}
  ${al.conformita_normativa || ''}

  Criticità:
  ${(al.criticita || []).map((c, i) => `  ${i+1}. ${c}`).join('\n') || '  Nessuna criticità identificata.'}

  Elementi di attenzione:
  ${(al.elementi_attenzione || []).map((e, i) => `  ${i+1}. ${e}`).join('\n') || '  Nessun elemento segnalato.'}

══════════════════════════════════════════════════════════
■ RISCHI
══════════════════════════════════════════════════════════
${(d.rischi || []).map((r, i) => `  ${i+1}. [RISCHIO] ${r}`).join('\n') || '  Nessun rischio identificato.'}

══════════════════════════════════════════════════════════
■ OPPORTUNITÀ
══════════════════════════════════════════════════════════
${(d.opportunita || []).map((o, i) => `  ${i+1}. [OPPORTUNITÀ] ${o}`).join('\n') || '  Nessuna opportunità identificata.'}

══════════════════════════════════════════════════════════
■ VALUTAZIONE ECONOMICA
══════════════════════════════════════════════════════════
  ${d.valutazione_economica || 'N/D'}
  
  Spese stimate: ${d.spese_stimate || 'N/D'}

══════════════════════════════════════════════════════════
  Report generato da LexAsta | Non costituisce consulenza
  legale professionale ex L. 247/2012
══════════════════════════════════════════════════════════
`.trim();

  download('report_asta_immobiliare.txt', txt, 'text/plain');
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── PROGRESS HELPERS ──────────────────────────────────
function setProgress(pct, title, desc) {
  $('progressBar').style.width = pct + '%';
  if (title) $('progressTitle').textContent = title;
  if (desc) $('progressDesc').textContent = desc;
}

function addLog(msg, type = 'info') {
  const log = $('progressLog');
  const el = document.createElement('div');
  el.className = `log-entry ${type}`;
  el.textContent = `[${new Date().toLocaleTimeString('it-IT')}] ${msg}`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

// ── UTILS ─────────────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
