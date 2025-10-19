import { parseResumeUniversally } from './backend/utils/universalPdfParser.js';
import fs from 'fs';

// Test the universal parser with different resume formats
const testUniversalParsing = async () => {
  try {
    console.log('=== TESTING UNIVERSAL PDF PARSING ===\n');
    
    // Test with Steven's resume
    const stevenPdfPath = './Steven resume (sales NY).pdf';
    
    if (fs.existsSync(stevenPdfPath)) {
      console.log('Testing with Steven resume...');
      const stevenResult = await parseResumeUniversally(stevenPdfPath);
      
      console.log('=== STEVEN RESUME RESULTS ===');
      console.log('Name:', stevenResult.name);
      console.log('Email:', stevenResult.email);
      console.log('Phone:', stevenResult.phone);
      console.log('Location:', stevenResult.location);
      console.log('Current Job Title:', stevenResult.currentJobTitle);
      console.log('Years of Experience:', stevenResult.yearsOfExperience);
      console.log('Skills:', stevenResult.skills?.substring(0, 100) + '...');
      console.log('Summary:', stevenResult.summary?.substring(0, 100) + '...');
      console.log('Experience:', stevenResult.experience?.substring(0, 100) + '...');
      console.log('');
    }
    
    // Test with Kritensh's resume
    const kritenshPdfPath = './backend/uploads/Kritensh Cyber.pdf';
    
    if (fs.existsSync(kritenshPdfPath)) {
      console.log('Testing with Kritensh resume...');
      const kritenshResult = await parseResumeUniversally(kritenshPdfPath);
      
      console.log('=== KRITENSH RESUME RESULTS ===');
      console.log('Name:', kritenshResult.name);
      console.log('Email:', kritenshResult.email);
      console.log('Phone:', kritenshResult.phone);
      console.log('Location:', kritenshResult.location);
      console.log('Current Job Title:', kritenshResult.currentJobTitle);
      console.log('Years of Experience:', kritenshResult.yearsOfExperience);
      console.log('Skills:', kritenshResult.skills?.substring(0, 100) + '...');
      console.log('Summary:', kritenshResult.summary?.substring(0, 100) + '...');
      console.log('Experience:', kritenshResult.experience?.substring(0, 100) + '...');
      console.log('');
    }
    
    console.log('=== UNIVERSAL PARSING TEST COMPLETE ===');
    
  } catch (error) {
    console.error('Error:', error);
  }
};

testUniversalParsing();