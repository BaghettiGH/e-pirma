import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

type StatusResponse = {
  document: {
    id: string;
    title: string;
    status: string;
    sentAt: string | null;
    completedAt: string | null;
  };
  signers: {
    name: string;
    email: string;
    status: string;
    viewedAt: string | null;
    signedAt: string | null;
  }[];
};

export default function DocumentStatus() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/documents/${id}/status`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load"));
  }, [id]);

  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!data) return <p>Loading...</p>;

  return (
    <div style={{ padding: "2rem", maxWidth: 600 }}>
      <h1>{data.document.title}</h1>
      <p>
        Status: <strong>{data.document.status}</strong>
      </p>

      <h3>Signers</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {data.signers.map((s) => (
          <li
            key={s.email}
            style={{
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <strong>{s.name}</strong> ({s.email})
            <div style={{ marginTop: 4 }}>
              {s.status === "signed" && (
                <span style={{ color: "green" }}>✅ Signed {s.signedAt && new Date(s.signedAt).toLocaleString()}</span>
              )}
              {s.status === "viewed" && <span style={{ color: "orange" }}>👀 Viewed, not signed yet</span>}
              {s.status === "pending" && <span style={{ color: "#999" }}>⏳ Not viewed yet</span>}
            </div>
          </li>
        ))}
      </ul>

      {data.document.status === "completed" && (
        <a
          href={`${import.meta.env.VITE_API_URL}/documents/${id}/download`}
          style={{
            display: "inline-block",
            marginTop: 16,
            padding: "10px 20px",
            background: "#111",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          Download Signed PDF
        </a>
      )}
    </div>
  );
}