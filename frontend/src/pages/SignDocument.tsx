import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Document, Page } from "react-pdf";
import { signApi } from "../api/signClient";
import SignatureModal from "../components/SignatureModal";

type Box = {
  id: string;
  signerId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signedAt: string | null;
  isMine: boolean;
};

type SignPayload = {
  document: { id: string; title: string; status: string };
  signer: { id: string; name: string; email: string; status: string };
  fileUrl: string;
  boxes: Box[];
  signers: { name: string; status: string }[];
};

export default function SignDocument() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SignPayload | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const load = () => {
    signApi
      .get(`/sign/${token}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load document"));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleSignatureSubmit = async (imageBase64: string, method: "drawn" | "uploaded") => {
    if (!activeBoxId) return;
    try {
      await signApi.post(`/sign/${token}/boxes/${activeBoxId}`, {
        imageBase64,
        method,
      });
      setActiveBoxId(null);
      load(); // refresh state so the box shows as signed
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save signature");
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    setError(null);
    try {
      const res = await signApi.post(`/sign/${token}/complete`);
      setDoneMessage(
        res.data.allComplete
          ? "All parties have signed. Thank you!"
          : "Thanks! Your signature has been recorded. Waiting on other signers."
      );
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to complete signing");
    } finally {
      setCompleting(false);
    }
  };

  

  if (error && !data) return <p style={{ color: "red", padding: "2rem" }}>{error}</p>;
  if (!data) return <p style={{ padding: "2rem" }}>Loading...</p>;

  const myBoxes = data.boxes.filter((b) => b.isMine);
  const allMineSigned = myBoxes.every((b) => b.signedAt !== null);

  return (
    <div style={{ display: "flex", gap: "2rem", padding: "2rem" }}>
      <div style={{ width: 280, flexShrink: 0 }}>
        <h2>{data.document.title}</h2>
        <p>Hi {data.signer.name}, please sign in the highlighted boxes below.</p>

        <h4>Signing progress</h4>
        <ul>
          {data.signers.map((s) => (
            <li key={s.name}>
              {s.name}: {s.status === "signed" ? "✅ Signed" : s.status === "viewed" ? "👀 Viewing" : "⏳ Pending"}
            </li>
          ))}
        </ul>

        {error && <p style={{ color: "red" }}>{error}</p>}
        {doneMessage && <p style={{ color: "green" }}>{doneMessage}</p>}

        {data.signer.status !== "signed" && (
          <button
            onClick={handleComplete}
            disabled={!allMineSigned || completing}
            style={{
              width: "100%",
              padding: 10,
              marginTop: 12,
              background: allMineSigned ? "#111" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: 6,
            }}
          >
            {completing ? "Submitting..." : "Finish & Submit"}
          </button>
        )}
      </div>

      <div>
        <Document file={data.fileUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <div key={pageNum} style={{ position: "relative", marginBottom: 16 }}>
              <Page pageNumber={pageNum} width={700} />
              {data.boxes
                .filter((b) => b.page === pageNum)
                .map((box) => (
                  <div
                    key={box.id}
                    onClick={() => box.isMine && !box.signedAt && setActiveBoxId(box.id)}
                    style={{
                      position: "absolute",
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                      border: `2px ${box.isMine ? "solid" : "dashed"} ${
                        box.signedAt ? "#22c55e" : box.isMine ? "#ef4444" : "#999"
                      }`,
                      background: box.signedAt
                        ? "#22c55e22"
                        : box.isMine
                        ? "#ef444422"
                        : "#99999922",
                      cursor: box.isMine && !box.signedAt ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                    }}
                  >
                    {box.signedAt ? "✓ Signed" : box.isMine ? "Click to sign" : "Awaiting other signer"}
                  </div>
                ))}
            </div>
          ))}
        </Document>
      </div>

      {activeBoxId && (
        <SignatureModal onSubmit={handleSignatureSubmit} onClose={() => setActiveBoxId(null)} />
      )}
    </div>
  );
}