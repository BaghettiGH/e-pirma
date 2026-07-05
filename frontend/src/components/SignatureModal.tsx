import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";

type Props = {
  onSubmit: (imageBase64: string, method: "drawn" | "uploaded") => void;
  onClose: () => void;
};

export default function SignatureModal({ onSubmit, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [tab, setTab] = useState<"draw" | "upload">("draw");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  useEffect(() => {
    if (tab === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = 500;
      canvas.height = 200;
      padRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255,255,255)",
      });
    }
    return () => {
      padRef.current?.off();
    };
  }, [tab]);

  const handleClear = () => padRef.current?.clear();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (tab === "draw") {
      if (!padRef.current || padRef.current.isEmpty()) {
        alert("Please draw your signature first");
        return;
      }
      const dataUrl = padRef.current.toDataURL("image/png");
      onSubmit(dataUrl, "drawn");
    } else {
      if (!uploadPreview) {
        alert("Please upload a signature image first");
        return;
      }
      onSubmit(uploadPreview, "uploaded");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 540 }}>
        <h3>Sign here</h3>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={() => setTab("draw")} style={{ fontWeight: tab === "draw" ? "bold" : "normal" }}>
            Draw
          </button>
          <button onClick={() => setTab("upload")} style={{ fontWeight: tab === "upload" ? "bold" : "normal" }}>
            Upload image
          </button>
        </div>

        {tab === "draw" ? (
          <div>
            <canvas
              ref={canvasRef}
              style={{ border: "1px solid #ccc", borderRadius: 8, touchAction: "none" }}
            />
            <div style={{ marginTop: 8 }}>
              <button onClick={handleClear}>Clear</button>
            </div>
          </div>
        ) : (
          <div>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            {uploadPreview && (
              <img
                src={uploadPreview}
                alt="preview"
                style={{ maxWidth: "100%", marginTop: 12, border: "1px solid #ccc" }}
              />
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={handleSubmit}
            style={{ background: "#111", color: "#fff", padding: "8px 16px", borderRadius: 6, border: "none" }}
          >
            Apply Signature
          </button>
        </div>
      </div>
    </div>
  );
}