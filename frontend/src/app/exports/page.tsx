'use client';

import { useState, useCallback } from 'react';

interface Module {
  key: string;
  label: string;
  icon: string;
  desc: string;
  group: string;
}

const MODULES: Module[] = [
  // Buchhaltung
  { key:'payments',       label:'Zahlungen',         icon:'💳', desc:'Alle Transaktionen & Zahlungen',            group:'Buchhaltung' },
  { key:'orders',         label:'Bestellungen',       icon:'🛒', desc:'Bestellungen mit Status & Betrag',          group:'Buchhaltung' },
  { key:'memberships',    label:'Mitgliedschaften',   icon:'⭐', desc:'Abo-Pläne, Status & Zahlungsreferenzen',    group:'Buchhaltung' },
  // Nutzer
  { key:'profiles',       label:'Nutzerliste',        icon:'👥', desc:'Alle Profile inkl. Rollen & Mitgliedschaft', group:'Nutzer' },
  { key:'wirker_profiles',label:'Wirker Profile',     icon:'🔧', desc:'Skills, Verfügbarkeit & Stundensatz',       group:'Nutzer' },
  // Content
  { key:'works',          label:'Werke',              icon:'🎨', desc:'Alle Werke mit Status & Engagement',        group:'Content' },
  { key:'bookings',       label:'Buchungen',          icon:'📅', desc:'Buchungen mit Werk & Status',               group:'Content' },
  // Impact
  { key:'impact_pool',    label:'Impact Pool',        icon:'🌱', desc:'Monatsübersicht Pool & Ausschüttung',       group:'Impact' },
  { key:'impact_projects',label:'Impact Projekte',    icon:'🚀', desc:'Projekte, Votes & Fördersummen',            group:'Impact' },
  // System
  { key:'activity_logs',  label:'Audit Logs',         icon:'📋', desc:'Alle Admin-Aktionen & Änderungen',          group:'System' },
];

const GROUP_ORDER = ['Buchhaltung','Nutzer','Content','Impact','System'];

type ExportFormat = 'csv' | 'excel' | 'log';
type Status = 'idle'|'loading'|'done'|'error';

function toCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return '';
  const cols = Object.keys(data[0]);
  const header = cols.join(';');
  const rows = data.map(r =>
    cols.map(c => {
      const v = r[c];
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.includes(';') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';')
  );
  return [header, ...rows].join('\r\n');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toLog(allData: Record<string, Record<string, unknown>[]>, selected: string[]): string {
  const lines: string[] = [];
  const ts = new Date().toISOString();
  lines.push(`HUI Admin Export — ${ts}`);
  lines.push('='.repeat(60));
  for (const key of selected) {
    const mod = MODULES.find(m => m.key === key);
    const rows = allData[key] || [];
    lines.push('');
    lines.push(`[${mod?.icon} ${mod?.label || key}] — ${rows.length} Einträge`);
    lines.push('-'.repeat(40));
    rows.slice(0, 5).forEach((r, i) => {
      lines.push(`  #${i+1}: ${JSON.stringify(r).slice(0,120)}`);
    });
    if (rows.length > 5) lines.push(`  … und ${rows.length - 5} weitere Einträge`);
  }
  lines.push('');
  lines.push('='.repeat(60));
  lines.push(`Export abgeschlossen. Gesamt: ${selected.reduce((a,k) => a + (allData[k]?.length||0), 0)} Datensätze`);
  return lines.join('\n');
}

export default function ExportsPage() {
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [status, setStatus]       = useState<Status>('idle');
  const [message, setMessage]     = useState('');
  const [counts, setCounts]       = useState<Record<string, number>>({});

  const toggle = (key: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const selectAll   = () => setSelected(new Set(MODULES.map(m => m.key)));
  const selectGroup = (g: string) =>
    setSelected(prev => { const s = new Set(prev); MODULES.filter(m => m.group===g).forEach(m => s.add(m.key)); return s; });
  const clearAll    = () => setSelected(new Set());

  const fetchData = useCallback(async (keys: string[]): Promise<Record<string, Record<string, unknown>[]>> => {
    const res = await fetch(`/api/export?tables=${keys.join(',')}&format=json`);
    if (!res.ok) throw new Error('Export fehlgeschlagen');
    return res.json();
  }, []);

  const doExport = useCallback(async (format: ExportFormat) => {
    if (!selected.size) { setMessage('Bitte mindestens ein Modul auswählen.'); return; }
    setStatus('loading'); setMessage('');
    try {
      const keys = Array.from(selected);
      const allData = await fetchData(keys);

      // update counts
      const c: Record<string, number> = {};
      keys.forEach(k => { c[k] = allData[k]?.length || 0; });
      setCounts(c);

      const date = new Date().toISOString().slice(0,10);

      if (format === 'log') {
        const log = toLog(allData, keys);
        downloadBlob(new Blob([log], { type: 'text/plain;charset=utf-8' }), `HUI_Export_${date}.log`);
        setMessage(`✅ Log-Datei exportiert (${keys.reduce((a,k)=>a+(c[k]||0),0)} Einträge)`);
      }

      else if (format === 'csv') {
        if (keys.length === 1) {
          const k = keys[0];
          const csv = toCSV(allData[k] || []);
          const mod = MODULES.find(m => m.key === k);
          downloadBlob(new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' }), `HUI_${mod?.label||k}_${date}.csv`);
        } else {
          // Multi-table: create combined CSV with section headers
          let combined = `HUI Admin Export — ${date}\r\n\r\n`;
          for (const k of keys) {
            const mod = MODULES.find(m => m.key === k);
            combined += `=== ${mod?.icon} ${mod?.label || k} (${c[k]} Einträge) ===\r\n`;
            combined += toCSV(allData[k] || []) + '\r\n\r\n';
          }
          downloadBlob(new Blob(['\uFEFF'+combined], { type: 'text/csv;charset=utf-8' }), `HUI_Gesamt_${date}.csv`);
        }
        setMessage(`✅ CSV exportiert (${keys.reduce((a,k)=>a+(c[k]||0),0)} Einträge)`);
      }

      else if (format === 'excel') {
        // Dynamic import of xlsx (SheetJS)
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        for (const k of keys) {
          const mod = MODULES.find(m => m.key === k);
          const rows = allData[k] || [];
          const ws = XLSX.utils.json_to_sheet(rows);
          // Auto column width
          const cols = rows.length ? Object.keys(rows[0]).map(h => ({ wch: Math.max(h.length, 12) })) : [];
          ws['!cols'] = cols;
          XLSX.utils.book_append_sheet(wb, ws, (mod?.label || k).slice(0,31));
        }
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        downloadBlob(
          new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          `HUI_Export_${date}.xlsx`
        );
        setMessage(`✅ Excel exportiert — ${keys.length} Tabellenblätter (${keys.reduce((a,k)=>a+(c[k]||0),0)} Einträge)`);
      }

      setStatus('done');
    } catch (e) {
      setStatus('error');
      setMessage('❌ Export fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [selected, fetchData]);

  const grouped = GROUP_ORDER.map(g => ({ group: g, modules: MODULES.filter(m => m.group === g) }));
  const totalSelected = selected.size;

  // ── styles ──────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--card)', border: '1.5px solid var(--border)',
    borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
    transition: 'all .15s', userSelect: 'none',
  };
  const cardSelected: React.CSSProperties = {
    ...card, borderColor: 'var(--accent)', background: 'rgba(99,102,241,.07)',
  };
  const btn = (color: string, bg: string): React.CSSProperties => ({
    padding: '10px 22px', borderRadius: 8, border: 'none',
    background: bg, color, cursor: 'pointer', fontWeight: 700,
    fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 7,
    transition: 'opacity .15s',
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📥 Daten-Export</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
          Wähle Module aus und lade die Daten als CSV, Excel oder Log-Datei herunter.
          Ideal für Buchhaltung, Reporting und Archivierung.
        </p>
      </div>

      {/* Quick select */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        <button onClick={selectAll} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid var(--accent)', background:'var(--accent)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}>
          ✅ Alle auswählen
        </button>
        {GROUP_ORDER.map(g => (
          <button key={g} onClick={() => selectGroup(g)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', cursor:'pointer', fontSize:12 }}>
            {g}
          </button>
        ))}
        <button onClick={clearAll} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid var(--red)', background:'transparent', color:'var(--red)', cursor:'pointer', fontSize:12 }}>
          ✖ Auswahl leeren
        </button>
      </div>

      {/* Module grid */}
      {grouped.map(({ group, modules }) => (
        <div key={group} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            {group}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {modules.map(m => (
              <div key={m.key}
                style={selected.has(m.key) ? cardSelected : card}
                onClick={() => toggle(m.key)}
              >
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:18 }}>{m.icon}</span>
                  <span style={{ fontWeight:700, fontSize:13 }}>{m.label}</span>
                  {selected.has(m.key) && <span style={{ marginLeft:'auto', color:'var(--accent)', fontSize:16 }}>✓</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{m.desc}</div>
                {counts[m.key] !== undefined && (
                  <div style={{ marginTop:6, fontSize:11, color:'var(--accent)', fontWeight:600 }}>
                    {counts[m.key].toLocaleString('de-DE')} Einträge
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Export buttons */}
      <div style={{
        marginTop: 28, padding: '20px 24px',
        background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {totalSelected === 0
              ? 'Kein Modul ausgewählt'
              : `${totalSelected} Modul${totalSelected > 1 ? 'e' : ''} ausgewählt`}
          </div>
          {message && (
            <div style={{ marginTop: 6, fontSize: 13,
              color: message.startsWith('✅') ? 'var(--green)' : message.startsWith('❌') ? 'var(--red)' : 'var(--muted)' }}>
              {message}
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button
            disabled={status==='loading' || !totalSelected}
            onClick={() => doExport('log')}
            style={{ ...btn('#fff','var(--muted)'), opacity: (!totalSelected || status==='loading') ? .5 : 1 }}>
            {status==='loading' ? '…' : '📄 Log-Datei'}
          </button>
          <button
            disabled={status==='loading' || !totalSelected}
            onClick={() => doExport('csv')}
            style={{ ...btn('#fff','#16a34a'), opacity: (!totalSelected || status==='loading') ? .5 : 1 }}>
            {status==='loading' ? '…' : '📊 CSV Export'}
          </button>
          <button
            disabled={status==='loading' || !totalSelected}
            onClick={() => doExport('excel')}
            style={{ ...btn('#fff','#2563eb'), opacity: (!totalSelected || status==='loading') ? .5 : 1 }}>
            {status==='loading' ? '…' : '📗 Excel (.xlsx)'}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div style={{ marginTop:18, padding:'12px 16px', background:'rgba(99,102,241,.05)', border:'1px solid rgba(99,102,241,.15)', borderRadius:10, fontSize:12, color:'var(--muted)' }}>
        <strong>📌 Hinweise:</strong>&nbsp;
        CSV verwendet Semikolon-Trennzeichen (Excel-DE kompatibel) mit UTF-8 BOM.&nbsp;
        Excel erstellt ein Tabellenblatt pro Modul.&nbsp;
        Log-Datei ist für Archivierung und Audit-Zwecke geeignet.
        Alle Exporte nutzen den Service-Role-Zugang und enthalten sämtliche Datensätze ohne Limit.
      </div>
    </div>
  );
}
