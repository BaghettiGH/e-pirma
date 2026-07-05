import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Document, Page } from "react-pdf";
import { api } from "../api/client";

type Signer = { name: string; email: string; color: string };
type Box = {
  id: string; // local temp id
  signerEmail: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7"];
const BOX_WIDTH_PCT = 20; // default box width as % of page
const BOX_HEIGHT_PCT = 6;

export default function PlaceBoxes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [signers, setSigners] = useState<Signer[]>([
    { name: "", email: "", color: COLORS[0] },
  ]);
  const [activeSignerIdx, setActiveSignerIdx] = useState(0);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the doc's file URL on mount
  useState(() => {
    api.get(`/documents/${id}`).then((res) => setFileUrl(res.data.fileUrl));
  });

  const addSigner = () => {
    setSigners((s) => [
      ...s,
      { name: "", email: "", color: COLORS[s.length % COLORS.length] },
    ]);
  };

  const updateSigner = (idx: number, field: "name" | "email", value: string) => {
    setSigners((s) =>
      s.map((sig, i) => (i === idx ? { ...sig, [field]: value } : sig))
    );
  };

  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
      const activeSigner = signers[activeSignerIdx];
      if (!activeSigner?.email) {
        setError("Fill in the active signer's name and email first");
        return;
      }
      setError(null);

      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;

      const newBox: Box = {
        id: crypto.randomUUID(),
        signerEmail: activeSigner.email,
        page: pageNumber,
        x: Math.min(xPct, 100 - BOX_WIDTH_PCT),
        y: Math.min(yPct, 100 - BOX_HEIGHT_PCT),
        width: BOX_WIDTH_PCT,
        height: BOX_HEIGHT_PCT,
      };
      setBoxes((b) => [...b, newBox]);
    },
    [signers, activeSignerIdx]
  );

  const removeBox = (boxId: string) => {
    setBoxes((b) => b.filter((box) => box.id !== boxId));
  };

  const colorForEmail = (email: string) =>
    signers.find((s) => s.email === email)?.color || "#999";

  const handleSaveAndSend = async () => {
    setError(null);

    const validSigners = signers.filter((s) => s.name && s.email);
    if (validSigners.length === 0) {
      setError("Add at least one signer");
      return;
    }
    if (boxes.length === 0) {
      setError("Place at least one signature box");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/documents/${id}/boxes`, {
        signers: validSigners.map(({ name, email }) => ({ name, email })),
        boxes: boxes.map(({ signerEmail, page, x, y, width, height }) => ({
          signerEmail,
          page,
          x,
          y,
          width,
          height,
        })),
      });

      await api.post(`/documents/${id}/send`);

      navigate(`/documents/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save/send");
    } finally {
      setSaving(false);
    }
  };

  if (!fileUrl) return <p>Loading document...</p>;

  return (
    <div style={{ display: "flex", gap: "2rem", padding: "2rem" }}>
      {/* Sidebar: signer management */}
      <div style={{ width: 300, flexShrink: 0 }}>
        <h2>Signers</h2>
        {signers.map((s, i) => (
          <div
            key={i}
            onClick={() => setActiveSignerIdx(i)}
            style={{
              border: i === activeSignerIdx ? `2px solid ${s.color}` : "1px solid #ccc",
              borderRadius: 8,
              padding: 8,
              marginBottom: 8,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: s.color,
                borderRadius: "50%",
                display: "inline-block",
                marginRight: 6,
              }}
            />
            <input
              placeholder="Name"
              value={s.name}
              onChange={(e) => updateSigner(i, "name", e.target.value)}
              style={{ display: "block", width: "100%", marginBottom: 4 }}
            />
            <input
              placeholder="Email"
              value={s.email}
              onChange={(e) => updateSigner(i, "email", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </div>
        ))}
        <button onClick={addSigner}>+ Add signer</button>

        <hr style={{ margin: "1.5rem 0" }} />
        <p style={{ fontSize: 13, color: "#666" }}>
          Click the signer above to make them "active", then click anywhere
          on the PDF to drop a signature box for them.
        </p>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button
          onClick={handleSaveAndSend}
          disabled={saving}
          style={{
            marginTop: "1rem",
            width: "100%",
            padding: "10px",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 6,
          }}
        >
          {saving ? "Sending..." : "Save & Send for Signature"}
        </button>
      </div>

      {/* PDF viewer with clickable pages */}
      <div>
        <Document file={fileUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              style={{ position: "relative", marginBottom: 16, cursor: "crosshair" }}
              onClick={(e) => handlePageClick(e, pageNum)}
            >
              <Page pageNumber={pageNum} width={700} />
              {boxes
                .filter((b) => b.page === pageNum)
                .map((box) => (
                  <div
                    key={box.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBox(box.id);
                    }}
                    title="Click to remove"
                    style={{
                      position: "absolute",
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                      border: `2px dashed ${colorForEmail(box.signerEmail)}`,
                      background: `${colorForEmail(box.signerEmail)}33`,
                      fontSize: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#333",
                    }}
                  >
                    {box.signerEmail}
                  </div>
                ))}
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}