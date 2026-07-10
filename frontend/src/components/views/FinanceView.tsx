"use client";
import React, { useEffect, useState } from "react";

interface FinanceData {
  total_volume_eur: number;
  talent_total_eur: number;
  hui_total_eur: number;
  company_eur: number;
  impact_eur: number;
  innovation_eur: number;
  impact_projects_eur: number;
  impact_flex_eur: number;
  active_phase: string;
  phase_label: string;
  tx_count: number;
  month: string;
}

const T = {
  teal: "#0DC4B5",
  ink: "#141422",
  muted: "#6b7280",
  card: "#fff",
  border: "rgba(20,20,34,0.08)",
};

function fmtEur(n: number): string {
  return Math.round(n).toLocaleString("de-DE");
}

function Kachel({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 18px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || T.ink }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Bar({ label, pct, eur, color }: { label: string; pct: number; eur: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: T.muted }}>{pct}% → €{eur.toFixed(2)}</span>
      </div>
      <div style={{ height: 8, background: "rgba(20,20,34,0.06)", borderRadius: 99 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s" }} />
      </div>
    </div>
  );
}

export function FinanceView() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState(100);

  useEffect(() => {
    fetch("/api/finance")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const s = scenario;
  const hui = Math.round(s * 0.20 * 100) / 100;
  const talent = s - hui;
  const company = Math.round(hui * 0.50 * 100) / 100;
  const impact = Math.round(hui * 0.30 * 100) / 100;
  const innov = Math.round((hui - company - impact) * 100) / 100;
  const proj = Math.round(impact * 0.70 * 100) / 100;
  const flex = Math.round((impact - proj) * 100) / 100;

  return (
    <div style={{ padding: "28px 24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.ink }}>Balanced Growth v1</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.muted }}>80% Talent / 20% HUI — Unternehmensphase: <b style={{ color: T.teal }}>{data?.phase_label || "Phase 1 — Aufbau"}</b></p>
      </div>

      {/* Live KPIs */}
      {loading ? (
        <div style={{ color: T.muted, fontSize: 13 }}>Lade Live-Daten…</div>
      ) : data ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "nowrap", marginBottom: 28, overflowX: "auto" }}>
          <Kachel label="Gesamtumsatz" value={`€${fmtEur(data.total_volume_eur)}`} sub={`${data.tx_count} Transaktionen`} />
          <Kachel label="Talent-Auszahlung" value={`€${fmtEur(data.talent_total_eur)}`} sub="80% des Umsatzes" color="#22c55e" />
          <Kachel label="HUI-Anteil" value={`€${fmtEur(data.hui_total_eur)}`} sub="20% des Umsatzes" color={T.teal} />
          <Kachel label="Impact-Pool" value={`€${fmtEur(data.impact_eur)}`} sub="30% von HUI" color="#8b5cf6" />
          <Kachel label="Innovation" value={`€${fmtEur(data.innovation_eur)}`} sub="20% von HUI" color="#f59e0b" />
        </div>
      ) : (
        <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 28 }}>Keine Daten — API-Verbindung prüfen</div>
      )}

      {/* Szenario-Rechner */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "22px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>Szenario-Rechner</h2>
          <select
            value={scenario}
            onChange={e => setScenario(Number(e.target.value))}
            style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, background: "#fafafa" }}
          >
            {[100, 500, 1000, 5000, 10000, 50000, 100000].map(v => (
              <option key={v} value={v}>€{v.toLocaleString("de-DE")} Transaktion</option>
            ))}
          </select>
        </div>
        <Bar label="Talent / Creator" pct={80} eur={talent} color="#22c55e" />
        <Bar label="Unternehmen HUI" pct={10} eur={company} color={T.teal} />
        <Bar label="Impact-Pool" pct={6} eur={impact} color="#8b5cf6" />
        <Bar label="Innovation-Fonds" pct={4} eur={innov} color="#f59e0b" />
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Impact-Split</div>
          <Bar label="↳ Projekte (Rang 1–3)" pct={70} eur={proj} color="#a78bfa" />
          <Bar label="↳ Flex-Pool" pct={30} eur={flex} color="#c4b5fd" />
        </div>
      </div>

      {/* Phasenmodell */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "22px 20px" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: T.ink }}>Unternehmens-Phasenmodell</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { phase: "Phase 1", label: "Aufbau", ops: 60, profit: 20, res: 20, kpi: "Standard" },
            { phase: "Phase 2", label: "Skalierung", ops: 40, profit: 40, res: 20, kpi: "1.000 Tx/Monat" },
            { phase: "Phase 3", label: "Etabliert", ops: 20, profit: 60, res: 20, kpi: "5.000 Tx/Monat" },
          ].map(p => (
            <div key={p.phase} style={{ flex: 1, minWidth: 200, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.phase}</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: T.ink, margin: "4px 0 10px" }}>{p.label}</div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Betrieb & Technik: <b>{p.ops}%</b></div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Gewinn: <b>{p.profit}%</b></div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Rücklagen: <b>{p.res}%</b></div>
              <div style={{ fontSize: 10, color: T.teal, fontWeight: 600 }}>KPI-Trigger: {p.kpi}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
