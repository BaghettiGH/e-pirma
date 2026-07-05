import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Doc = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocs = () => {
    setLoading(true);
    api
      .get("/documents")
      .then((res) => setDocs(res.data.documents))
      .catch(() => setError("Failed to load documents"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted");
      return;
    }

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(/\.pdf$/i, ""));

    try {
      const res = await api.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/documents/${res.data.document.id}/place-boxes`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const statusColor: Record<string, string> = {
    draft: "#999",
    sent: "#f59e0b",
    in_progress: "#3b82f6",
    completed: "#22c55e",
    expired: "#ef4444",
    cancelled: "#ef4444",
  };

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Documents</h1>
          <p style={{ color: "#666", margin: 0 }}>Signed in as {user?.name} ({user?.email})</p>
        </div>
        <button onClick={logout} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ccc", background: "#fff" }}>
          Log out
        </button>
      </div>

      <label
        style={{
          display: "inline-block",
          padding: "12px 20px",
          background: "#111",
          color: "#fff",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 24,
        }}
      >
        {uploading ? "Uploading..." : "+ Upload PDF for signature"}
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ display: "none" }}
        />
      </label>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Loading documents...</p>
      ) : docs.length === 0 ? (
        <p style={{ color: "#666" }}>No documents yet. Upload one to get started.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
              <th style={{ padding: 8 }}>Title</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Created</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: 8 }}>{doc.title}</td>
                <td style={{ padding: 8 }}>
                  <span style={{ color: statusColor[doc.status] || "#999", fontWeight: 600 }}>
                    {doc.status}
                  </span>
                </td>
                <td style={{ padding: 8, color: "#666" }}>
                  {new Date(doc.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: 8 }}>
                  {doc.status === "draft" ? (
                    <a href={`/documents/${doc.id}/place-boxes`}>Continue setup</a>
                  ) : (
                    <a href={`/documents/${doc.id}`}>View status</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}