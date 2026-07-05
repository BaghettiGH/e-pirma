import { BrowserRouter, Routes, Route } from "react-router-dom";
import PlaceBoxes from "./pages/PlaceBoxes";
import './App.css'
import DocumentStatus from "./pages/DocumentStatus";



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/documents/:id/place-boxes" element={<PlaceBoxes />} />
        <Route path="/documents/:id" element={<DocumentStatus />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
