import { useState, useEffect, useCallback } from "react";
import "./RegistrationsPage.css";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "https://grad-reservation-backend.vercel.app";

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "—";

export default function RegistrationsPage({ onBack }) {
  const [filter, setFilter]           = useState("all");
  const [rows, setRows]               = useState([]);
  const [counts, setCounts]           = useState({ all: 0, scanned: 0, unscanned: 0 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allRes, scannedRes, unscannedRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/registrations?filter=all`),
        fetch(`${API_BASE_URL}/api/registrations?filter=scanned`),
        fetch(`${API_BASE_URL}/api/registrations?filter=unscanned`),
      ]);

      if (!allRes.ok) throw new Error("Failed to fetch registrations.");

      const [allData, scannedData, unscannedData] = await Promise.all([
        allRes.json(),
        scannedRes.json(),
        unscannedRes.json(),
      ]);

      setRows(allData.data || []);
      setCounts({
        all:       allData.total       || 0,
        scanned:   scannedData.total   || 0,
        unscanned: unscannedData.total || 0,
      });
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Load SheetJS from CDN dynamically ────────────────────────────────────
  useEffect(() => {
    if (window.XLSX) return;
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);



  // ── Client-side filter + search ───────────────────────────────────────────
  const visible = rows
    .filter((r) =>
      filter === "scanned"   ? r.scanned  :
      filter === "unscanned" ? !r.scanned :
      true
    )
    .filter((r) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        (r.student_name   || "").toLowerCase().includes(q) ||
        (r.student_number || "").toLowerCase().includes(q) ||
        (r.parent_name    || "").toLowerCase().includes(q) ||
        (r.course         || "").toLowerCase().includes(q)
      );
    });

  // ── Excel export — uses SheetJS loaded from CDN via script tag ────────────
  const exportToExcel = () => {
    const XLSX = window.XLSX;
    if (!XLSX) {
      alert("Excel export is loading, please try again in a moment.");
      return;
    }

    const exportRows = visible.map((r) => ({
      "Student Name":    r.student_name,
      "Student Number":  r.student_number,
      "Course":          r.course,
      "Email":           r.email,
      "Contact Number":  r.contact_number,
      "Parent Name":     r.parent_name,
      "Slot":            r.parent_slot,
      "Status":          r.scanned ? "Scanned" : "Not Yet Scanned",
      "Scanned At":      r.scanned ? fmt(r.scanned_at) : "",
      "Registered At":   fmt(r.registered_at),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [
      { wch: 24 }, { wch: 16 }, { wch: 10 }, { wch: 28 },
      { wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 20 },
      { wch: 22 }, { wch: 22 },
    ];

    const wb = XLSX.utils.book_new();
    const sheetName =
      filter === "scanned"   ? "Scanned"          :
      filter === "unscanned" ? "Not Yet Scanned"   :
      "All Registrations";

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `lcc-graduation-${filter}-${date}.xlsx`);
  };

  const tabs = [
    { key: "all",       label: "All",             count: counts.all       },
    { key: "unscanned", label: "Not Yet Scanned",  count: counts.unscanned },
    { key: "scanned",   label: "Already Scanned",  count: counts.scanned   },
  ];

  const cols = [
    "Student Name", "Student No.", "Course",
    "Parent Name", "Slot", "Status", "Scanned At", "Registered At",
  ];

  return (
      <div className="reg-page">
        <div className="reg-inner">

          {/* Header */}
          <div className="reg-header">
            <h1 className="reg-title">🎓 Graduation Registrations</h1>
            {onBack && (
              <button className="reg-back-btn" onClick={onBack}>← Back</button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="reg-tabs">
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                className={`reg-tab${filter === key ? ` active-${key}` : ""}`}
                onClick={() => setFilter(key)}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="reg-toolbar">
            <input
              className="reg-search"
              placeholder="Search by student, parent, course…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="reg-refresh-btn" onClick={fetchData} disabled={loading}>
              {loading ? "…" : "↻ Refresh"}
            </button>
            <button
              className="reg-export-btn"
              onClick={exportToExcel}
              disabled={visible.length === 0}
            >
              ↓ Export to Excel ({visible.length})
            </button>
          </div>

          {/* Content */}
          {error ? (
            <p className="reg-error">Error: {error}</p>
          ) : loading ? (
            <p className="reg-state">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="reg-state">No records found.</p>
          ) : (
            <div className="reg-table-wrap">
              <table className="reg-table">
                <thead>
                  <tr>
                    {cols.map((c) => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={`${r.student_number}-${r.parent_slot}`}>
                      <td>{r.student_name}</td>
                      <td>{r.student_number}</td>
                      <td>{r.course}</td>
                      <td>{r.parent_name}</td>
                      <td><span className="slot-label">{r.parent_slot}</span></td>
                      <td>
                        <span className={r.scanned ? "badge-scanned" : "badge-pending"}>
                          {r.scanned ? "✓ Scanned" : "Pending"}
                        </span>
                      </td>
                      <td>{r.scanned ? fmt(r.scanned_at) : "—"}</td>
                      <td>{fmt(r.registered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="reg-footer">
            <span>Showing {visible.length} of {counts.all} total entries</span>
            {lastRefresh && <span>Last updated: {fmt(lastRefresh.toISOString())}</span>}
          </div>

        </div>
      </div>
    
  );
}