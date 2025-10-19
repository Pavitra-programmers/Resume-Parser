import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import UploadResume from './pages/UploadResume';
import ProfileView from './pages/ProfileView';
import CandidateList from './pages/CandidateList';
import Navbar from './components/Navbar';

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<UploadResume />} />
          <Route path="/profile/:id" element={<ProfileView />} />
          <Route path="/candidates" element={<CandidateList />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;