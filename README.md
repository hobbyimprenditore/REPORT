# ⚖️ REPORT — Analisi Avvisi di Vendita Immobiliare

Strumento web per l'analisi legale e valutazione economica di aste immobiliari, powered by Claude AI (Anthropic).

## 🚀 Come pubblicare su GitHub Pages

### 1. Crea un repository
- Vai su **github.com** → "+" → "New repository"
- Nome: `report` (o `analisi-aste`)
- Lascia tutto vuoto, clicca "Create repository"

### 2. Carica i file
Carica mantenendo questa struttura:
```
report/
├── index.html
├── README.md
├── css/
│   └── style.css
└── js/
    └── app.js
```

### 3. Abilita GitHub Pages
- **Settings** → **Pages** → Branch: `main` → Cartella: `/ (root)` → **Save**
- Il sito sarà live su: `https://[username].github.io/report/`

---

## 🔄 Come aggiornare i file (sostituire il vecchio con il nuovo)

### Via browser (senza terminale):
1. Vai nel repository su GitHub
2. Clicca sul file che vuoi aggiornare (es. `index.html`)
3. Clicca l'icona **matita** ✏️ in alto a destra
4. Incolla il nuovo contenuto
5. Clicca **"Commit changes"**

### Via terminale:
```bash
# Sostituisci solo i file modificati
cp nuovo-index.html tuo-repo/index.html
cp nuovo-style.css  tuo-repo/css/style.css
cp nuovo-app.js     tuo-repo/js/app.js

cd tuo-repo
git add .
git commit -m "Aggiornamento sito REPORT"
git push
```

Il sito si aggiorna automaticamente in 1-2 minuti dopo il push.

---

## ⚠️ Avvertenza
Strumento di supporto informativo. Non costituisce consulenza legale ex L. 247/2012.
