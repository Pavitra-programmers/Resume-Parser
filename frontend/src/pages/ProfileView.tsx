import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { 
  FaEnvelope, 
  FaPhone, 
  FaMapMarkerAlt, 
  FaBriefcase, 
  FaSpinner,
  FaUser,
  FaBullseye,
  FaDollarSign,
  FaBuilding,
  FaTruck,
  FaGlobe,
  FaTag,
  FaChartLine,
  FaHeart
} from 'react-icons/fa';

interface Candidate {
  id: string;
  Name: string;
  Email: string;
  Phone: string;
  Location: string;
  Skills: string;
  Education: string;
  Experience: string;
  Projects: string;
  "Preferred Role": string;
  "Expected Salary": string;
  Availability: string;
  "LinkedIn URL": string;
  "Profile URL": string;
  "Portfolio URL": string;
  "Created At": string;
}

const ProfileView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchCandidate = async () => {
      try {
        console.log('Fetching candidate with ID:', id);
        const response = await axios.get(`http://localhost:5000/api/resume/candidate/${id}`);
        console.log('Candidate response:', response.data);
        setCandidate(response.data);
      } catch (err) {
        setError('Failed to load candidate profile');
        console.error('Error fetching candidate:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCandidate();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The requested profile could not be found.'}</p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const skills = candidate?.Skills ? candidate.Skills.split(',').map(skill => skill.trim()) : [];
  const initials = candidate?.Name ? candidate.Name.split(' ').map(n => n[0]).join('').toUpperCase() : 'NA';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Left Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              {/* Candidate Info */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4 relative">
                  <span className="text-white font-bold text-2xl">{initials}</span>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <h1 className="text-xl font-bold text-gray-900">{candidate?.Name || 'Unknown Name'}</h1>
                <p className="text-gray-600 text-sm">{candidate?.Email || 'No email provided'}</p>
                {candidate?.Location && (
                  <div className="flex items-center justify-center mt-2 text-gray-600 text-sm">
                    <FaMapMarkerAlt className="h-4 w-4 mr-1" />
                    {candidate.Location}
                  </div>
                )}
                <div className="mt-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
              </div>

              {/* Manager Rating */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Manager Rating</h3>
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <FaUser key={i} className="h-4 w-4 text-gray-300" />
                  ))}
                  <span className="ml-2 text-sm text-gray-600">0/5 Manager Rating</span>
                </div>
              </div>

              {/* Comments */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Comments</h3>
                <p className="text-sm text-gray-600">No comments available.</p>
              </div>

              {/* Top Skills */}
              {skills.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Top Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.slice(0, 5).map((skill, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                    {skills.length > 5 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        +{skills.length - 5} More
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Profile Button */}
              <button className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center">
                <FaUser className="h-4 w-4 mr-2" />
                Profile
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Navigation Tabs */}
            <div className="bg-white rounded-lg shadow-sm mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  <button 
                    onClick={() => setActiveTab('overview')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'overview' 
                        ? 'border-blue-500 text-blue-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Overview
                  </button>
                  <button 
                    onClick={() => setActiveTab('experience')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'experience' 
                        ? 'border-blue-500 text-blue-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Experience
                  </button>
                  <button 
                    onClick={() => setActiveTab('video')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'video' 
                        ? 'border-blue-500 text-blue-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Video
                  </button>
                  <button 
                    onClick={() => setActiveTab('availability')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'availability' 
                        ? 'border-blue-500 text-blue-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Availability
                  </button>
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <>
                {/* Professional Summary */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <div className="flex items-center mb-4">
                    <FaUser className="h-5 w-5 text-blue-600 mr-2" />
                    <h2 className="text-lg font-semibold text-gray-900">Professional Summary</h2>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Professional overview and achievements</p>
                  <p className="text-gray-700">
                    {candidate.Experience || candidate.Education || 'Professional experience and achievements will be displayed here.'}
                  </p>
                </div>

                {/* Professional Details Grid */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <div className="flex items-center mb-4">
                    <FaBullseye className="h-5 w-5 text-blue-600 mr-2" />
                    <h2 className="text-lg font-semibold text-gray-900">Professional Details</h2>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Key metrics and specializations</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <FaBuilding className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                      <div className="text-xs text-gray-600 mb-1">INDUSTRY</div>
                      <div className="text-sm font-medium">
                        {candidate?.Skills?.includes('Freight Forwarding') ? 'Freight Forwarding' :
                         candidate?.Skills?.includes('Logistics') ? 'Logistics' :
                         candidate?.Skills?.includes('Technology') ? 'Technology' : 'General Business'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <FaUser className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                      <div className="text-xs text-gray-600 mb-1">PRIMARY ROLE</div>
                      <div className="text-sm font-medium">
                        {candidate?.["Preferred Role"] || 
                         (candidate?.Skills?.includes('Sales') ? 'Sales Professional' :
                          candidate?.Skills?.includes('Developer') ? 'Developer' : 'Professional')}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <FaDollarSign className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                      <div className="text-xs text-gray-600 mb-1">EXPECTED SALARY</div>
                      <div className="text-sm font-medium">
                        {candidate?.["Expected Salary"] || 'Not specified'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <FaBullseye className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                      <div className="text-xs text-gray-600 mb-1">EXPERIENCE LEVEL</div>
                      <div className="text-sm font-medium">
                        {candidate?.Experience ? 'Experienced' : 'Entry Level'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <FaGlobe className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                      <div className="text-xs text-gray-600 mb-1">LOCATION</div>
                      <div className="text-sm font-medium">
                        {candidate?.Location || 'Not specified'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <FaTag className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                      <div className="text-xs text-gray-600 mb-1">TOP SKILL</div>
                      <div className="text-sm font-medium">
                        {skills.length > 0 ? skills[0] : 'Not specified'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <FaChartLine className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                      <div className="text-xs text-gray-600 mb-1">AVAILABILITY</div>
                      <div className="text-sm font-medium">
                        {candidate?.Availability || 'Not specified'}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <FaTruck className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                      <div className="text-xs text-gray-600 mb-1">SKILLS COUNT</div>
                      <div className="text-sm font-medium">
                        {skills.length} Skills
                      </div>
                    </div>
                  </div>
                </div>

                {/* Career Preferences */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center mb-4">
                    <FaChartLine className="h-5 w-5 text-blue-600 mr-2" />
                    <h2 className="text-lg font-semibold text-gray-900">Career Preferences</h2>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Salary expectations and preferences</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center">
                      <FaDollarSign className="h-4 w-4 text-blue-600 mr-2" />
                      <div>
                        <div className="text-xs text-gray-600">Salary Range</div>
                        <div className="text-sm font-medium">{candidate["Expected Salary"] || "Not specified"}</div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <FaMapMarkerAlt className="h-4 w-4 text-blue-600 mr-2" />
                      <div>
                        <div className="text-xs text-gray-600">Relocation</div>
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                          <span className="text-sm font-medium">No</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <FaHeart className="h-4 w-4 text-blue-600 mr-2" />
                      <div>
                        <div className="text-xs text-gray-600">Preferences</div>
                        <div className="text-sm font-medium">{candidate["Preferred Role"] || "Not specified"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'experience' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4">
                  <FaBriefcase className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Professional Experience</h2>
                </div>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-line">
                    {candidate.Experience || 'No experience information available.'}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4">
                  <FaUser className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Video Profile</h2>
                </div>
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaUser className="h-12 w-12 text-gray-400" />
                  </div>
                  <p className="text-gray-600 mb-4">No video profile available</p>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    Upload Video
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'availability' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4">
                  <FaChartLine className="h-5 w-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Availability</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">Current Status</h3>
                      <p className="text-sm text-gray-600">Available for new opportunities</p>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Available
                    </span>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Availability Details</h3>
                    <p className="text-sm text-gray-600">
                      {candidate.Availability || 'No specific availability information provided.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Share Information */}
            <div className="mt-6 text-center text-sm text-gray-500">
              This is a shared candidate profile. Full profile details are visible. Profile shared on {new Date().toLocaleDateString()}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-white py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AM</span>
                </div>
                <span className="ml-2 text-xl font-bold">AMRECCO</span>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                We help freight forwarding, logistics, SaaS logistics companies hire the top sales talent.
              </p>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center">
                  <FaEnvelope className="h-4 w-4 mr-2" />
                  info@amrecco.com
                </div>
                <div className="flex items-center">
                  <FaPhone className="h-4 w-4 mr-2" />
                  +1 315-537-8877
                </div>
                <div className="flex items-center">
                  <FaMapMarkerAlt className="h-4 w-4 mr-2" />
                  Remote - US Based Candidates
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Services</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Candidate Bench</li>
                <li>AI Sales Agents</li>
                <li>Join Our Network</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>About Us</li>
                <li>Our Process</li>
                <li>Testimonials</li>
                <li>Contact</li>
              </ul>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-400">
                © 2025 Amrecco. All rights reserved.
                <br />
                Privacy Policy Terms of Service
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;