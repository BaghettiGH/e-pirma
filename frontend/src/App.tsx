import { BrowserRouter, Routes, Route } from "react-router-dom";
import PlaceBoxes from "./pages/PlaceBoxes";
import './App.css'



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/documents/:id/place-boxes" element={<PlaceBoxes />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
