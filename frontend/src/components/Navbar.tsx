import React from 'react';
import { Link } from 'react-router-dom';
import { FaUpload, FaUsers, FaHome } from 'react-icons/fa';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <FaHome className="h-6 w-6 text-blue-600" />
              <span className="text-xl font-bold text-gray-800">Resume Parser</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100"
            >
              <FaUpload className="h-4 w-4" />
              <span>Upload Resume</span>
            </Link>
            <Link
              to="/candidates"
              className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100"
            >
              <FaUsers className="h-4 w-4" />
              <span>Candidates</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;