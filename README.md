# § LexAsta — Analisi Avvisi di Vendita Immobiliare

> Strumento AI per l'analisi legale e valutazione economica di procedure esecutive immobiliari

![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)
![AI](https://img.shields.io/badge/Powered%20by-Claude%20AI-orange)

---

## 🏛 Descrizione

**LexAsta** è un'applicazione web statica che analizza avvisi di vendita immobiliare (aste giudiziarie, fallimenti, liquidazioni coatte) utilizzando Claude AI, operando come **avvocato esperto con 20 anni di esperienza in esecuzioni forzate**.

### Funzionalità principali

- **Upload multiplo** di documenti (PDF, TXT, DOCX, immagini PNG/JPG)
- **Analisi legale completa** ex Art. 490 c.p.c.
- **Tabella dati strutturata** con tutte le informazioni chiave
- **Identificazione rischi** (evidenziati in rosso) e **opportunità** (in verde)
- **Report unificato** che consolida più documenti colmando le lacune
- **Esportazione** in HTML e TXT
- **Stampa** ottimizzata

---

## 🚀 Deploy su GitHub Pages

### Metodo 1: Fork e abilita Pages

1. Fai **Fork** di questo repository
2. Vai su **Settings → Pages**
3. Seleziona `Deploy from a branch` → `main` → `/ (root)`
4. Dopo ~2 minuti il sito sarà disponibile su:
   ```
   https://[tuo-username].github.io/[nome-repo]/
   ```

### Metodo 2: Nuovo repository

```bash
git clone https://github.com/[tuo-username]/aste-immobiliari.git
cd aste-immobiliari
# Copia i file del progetto
git add .
git commit -m "Init LexAsta"
git push origin main
```

Poi abilita GitHub Pages nelle Settings.

---

## ⚙️ Configurazione

Il sito richiede una **Anthropic API Key** per funzionare:

1. Ottieni una chiave su [console.anthropic.com](https://console.anthropic.com)
2. Inseriscila nel campo "Configurazione API" nella pagina
3. La chiave **non viene salvata** — viene usata solo in sessione

> ⚠️ **Nota**: Il sito effettua chiamate dirette all'API di Anthropic dal browser. Per un uso produttivo, considera di aggiungere un backend proxy per proteggere la chiave.

---

## 📋 Come si usa

1. **Inserisci la API Key** di Anthropic
2. **Carica uno o più file** (trascina o clicca)
   - Formati supportati: PDF, TXT, DOC, DOCX, PNG, JPG
   - Puoi caricare più avvisi della stessa procedura
3. **Avvia l'analisi** — il sistema elabora ogni documento
4. **Leggi il report unificato** suddiviso in:
   - Panoramica
   - Analisi Legale (Art. 490 c.p.c.)
   - Valutazione Economica
   - Rischi & Opportunità
   - Tabella Dati
5. **Esporta** in HTML o TXT, oppure **stampa**

---

## 🔍 Cosa analizza

### Analisi Legale
- Tipo di procedura (esecuzione immobiliare, fallimento, LCA)
- Completezza informazioni obbligatorie ex art. 490 c.p.c.
- Condizioni di vendita e modalità di partecipazione
- Vincoli, ipoteche, trascrizioni e oneri
- Termini presentazione offerta e garanzie
- Criticità per il potenziale acquirente
- Situazione occupanti e posizione giuridica

### Valutazione Economica
- Prezzo base d'asta vs valore di stima
- Sconto percentuale sul valore di mercato
- Stima spese (imposte, onorari, spese procedurali)
- Rapporto prezzo/mercato

### Tabella Strutturata
| Sezione | Dati inclusi |
|---------|-------------|
| Dati Procedura | Tribunale, RGE, Giudice, Delegato |
| Immobile | Tipologia, Ubicazione, Dati catastali |
| Aspetti Economici | Prezzi, Offerte, Cauzione |
| Vincoli e Oneri | Ipoteche, Trascrizioni, Occupanti |
| Modalità Vendita | Date aste, Termini, Pagamento |
| Criticità | Rischi, Elementi di attenzione |
| Giudizio | Rischio BASSO/MEDIO/ALTO, Convenienza |

---

## ⚖️ Avvertenza Legale

> Questo strumento è un **supporto alla due diligence** e **non costituisce consulenza legale professionale** ex L. 247/2012.  
> Per decisioni di investimento, consultare sempre un avvocato abilitato e un professionista tecnico iscritto all'albo.

---

## 🛠️ Struttura del progetto

```
aste-immobiliari/
├── index.html          # App principale
├── css/
│   └── style.css       # Stile estetica legale-editoriale
├── js/
│   └── app.js          # Logica applicazione + API Claude
└── README.md
```

---

## 📄 Licenza

MIT License — Libero uso, modifica e distribuzione.

---

*LexAsta — Powered by Claude AI (Anthropic)*
