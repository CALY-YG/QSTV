import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Detail from './pages/Detail';
import History from './pages/History';
import { SourceProvider } from './context/SourceContext';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <SourceProvider>
        <Router>
          <div className="app-container">
            <Navbar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/play/:id" element={<Detail />} />
                <Route path="/history" element={<History />} />
              </Routes>
            </main>
          </div>
        </Router>
      </SourceProvider>
    </AuthProvider>
  );
}

export default App;
