import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { FaEye, FaSpinner, FaUsers } from 'react-icons/fa';

interface Candidate {
  id: string;
  Name: string;
  Email: string;
  Phone: string;
  Location: string;
  Skills: string;
  "Preferred Role": string;
  "Expected Salary": string;
  Availability: string;
}

const CandidateList: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/resume/candidates');
        setCandidates(response.data);
      } catch (err) {
        setError('Failed to load candidates');
        console.error('Error fetching candidates:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading candidates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <FaUsers className="h-8 w-8 mr-3 text-blue-600" />
              All Candidates
            </h1>
            <p className="text-gray-600 mt-2">
              {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <Link
            to="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload New Resume
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {candidates.length === 0 ? (
          <div className="text-center py-12">
            <FaUsers className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No candidates yet</h3>
            <p className="text-gray-600 mb-4">Upload your first resume to get started</p>
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Resume
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {candidates.map((candidate, index) => (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {candidate.Name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {candidate["Preferred Role"] || 'Software Developer'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      Available
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {candidate.Email && (
                    <p className="text-sm text-gray-600 truncate">
                      {candidate.Email}
                    </p>
                  )}
                  {candidate.Phone && (
                    <p className="text-sm text-gray-600">
                      {candidate.Phone}
                    </p>
                  )}
                  {candidate.Location && (
                    <p className="text-sm text-gray-600">
                      {candidate.Location}
                    </p>
                  )}
                </div>

                {candidate.Skills && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {candidate.Skills.split(',').slice(0, 3).map((skill, skillIndex) => (
                        <span
                          key={skillIndex}
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                        >
                          {skill.trim()}
                        </span>
                      ))}
                      {candidate.Skills.split(',').length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          +{candidate.Skills.split(',').length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <Link
                  to={`/profile/${candidate.id}`}
                  className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <FaEye className="h-4 w-4 mr-2" />
                  View Profile
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CandidateList;