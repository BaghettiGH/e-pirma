import { useState, useEffect } from 'react'

import './App.css'

function App() {
  const [health, setHealth] = useState("");
    useEffect(() => {
    fetch("http://localhost:3000/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.message))
      .catch(() => setHealth("Cannot connect to backend"));
  }, []);

  return (
    <div>
      <h1>Frontend</h1>
      <p>{health}</p>
    </div>
  );
}

export default App
