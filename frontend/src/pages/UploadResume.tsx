import React, { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { FaUpload, FaFilePdf, FaSpinner } from 'react-icons/fa';

interface ParsedData {
  name: string;
  email: string;
  phone: string;
  skills: string;
  education: string;
  experience: string;
}

const UploadResume: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [candidateId, setCandidateId] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please select a PDF file');
        setFile(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await axios.post('http://localhost:5000/api/resume/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setCandidateId(response.data.candidateId);
      setParsedData(response.data.data);
    } catch (err) {
      setError('Failed to upload resume. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-lg shadow-lg p-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Upload Your Resume
          </h1>
          <p className="text-gray-600">
            Upload your PDF resume and we'll automatically extract your information
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <FaFilePdf className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <div className="space-y-2">
              <label htmlFor="resume" className="cursor-pointer">
                <span className="text-lg font-medium text-gray-700">
                  Choose PDF file or drag and drop
                </span>
                <input
                  id="resume"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-gray-500">
                PDF files only, up to 5MB
              </p>
            </div>
          </div>

          {file && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-blue-50 border border-blue-200 rounded-lg p-4"
            >
              <div className="flex items-center space-x-2">
                <FaFilePdf className="h-5 w-5 text-blue-600" />
                <span className="text-blue-800 font-medium">{file.name}</span>
                <span className="text-blue-600 text-sm">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-50 border border-red-200 rounded-lg p-4"
            >
              <p className="text-red-800">{error}</p>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {uploading ? (
              <>
                <FaSpinner className="animate-spin h-5 w-5" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <FaUpload className="h-5 w-5" />
                <span>Upload Resume</span>
              </>
            )}
          </button>
        </form>

        {parsedData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6"
          >
            <h3 className="text-lg font-semibold text-green-800 mb-4">
              Resume Parsed Successfully!
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-green-700">Name:</span>
                <span className="ml-2 text-green-600">{parsedData.name}</span>
              </div>
              <div>
                <span className="font-medium text-green-700">Email:</span>
                <span className="ml-2 text-green-600">{parsedData.email}</span>
              </div>
              <div>
                <span className="font-medium text-green-700">Phone:</span>
                <span className="ml-2 text-green-600">{parsedData.phone}</span>
              </div>
              <div>
                <span className="font-medium text-green-700">Skills:</span>
                <span className="ml-2 text-green-600">{parsedData.skills}</span>
              </div>
            </div>
            <div className="mt-4">
              <a
                href={`/profile/${candidateId}`}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                View Profile
              </a>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default UploadResume;