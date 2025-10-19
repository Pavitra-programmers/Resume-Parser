import express from "express";
import multer from "multer";
import * as pdf from "pdf-parse";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { addCandidate, getCandidate, getAllCandidates, updateCandidate } from "../utils/airtableClient.js";
import { parseResumeUniversal } from "../utils/universalPdfParser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});


// Upload and parse resume
router.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    let parsedData = null;
    let parsingMethod = '';

    try {
      console.log('Attempting universal resume parsing...');
      
      // Use the universal parser with multiple strategies and AI capabilities
      parsedData = await parseResumeUniversal(filePath);
      parsingMethod = parsedData.parsingMethod || 'Universal Parser';
      console.log('Universal parsing successful:', parsedData);
      
    } catch (error) {
      console.error('Universal parsing failed:', error);
      throw new Error('Failed to parse resume');
    }
    
    // Extract numeric value from salary for Expected Salary field (Number type)
    let expectedSalaryValue = null;
    if (parsedData.expectedSalary) {
      // Extract numeric value from salary string (e.g., "$85,000" -> 85000)
      const salaryMatch = parsedData.expectedSalary.match(/\$?([\d,]+)/);
      if (salaryMatch) {
        expectedSalaryValue = parseInt(salaryMatch[1].replace(/,/g, ''));
      }
    }
    
    // Add to Airtable with only existing fields and correct data types
    const candidate = await addCandidate({
      Name: parsedData.name,
      Email: parsedData.email,
      Phone: parsedData.phone,
      Location: parsedData.location,
      Skills: parsedData.skills,
      Education: parsedData.education,
      Experience: parsedData.experience,
      Projects: '', // Empty for now, can be filled later
      "Preferred Role": parsedData.currentJobTitle || '', // Use current job title as preferred role
      "Expected Salary": expectedSalaryValue, // Must be a number for currency field
      "LinkedIn URL": parsedData.linkedinUrl,
      Availability: '', // Empty for now, can be filled later
      "Portfolio URL": '', // Empty for now, can be filled later
      ResumeFile: req.file.originalname, // Store original filename
      CreatedAt: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
    });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ 
      message: `Resume uploaded and parsed successfully using ${parsingMethod}`, 
      candidateId: candidate.id,
      parsingMethod: parsingMethod,
      data: parsedData
    });
  } catch (error) {
    console.error("Upload error:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      error: "Failed to process resume",
      details: error.message 
    });
  }
});

// Get candidate by ID
router.get("/candidate/:id", async (req, res) => {
  try {
    console.log("Fetching candidate with ID:", req.params.id);
    const candidate = await getCandidate(req.params.id);
    console.log("Candidate data:", candidate);
    res.json(candidate);
  } catch (error) {
    console.error("Get candidate error:", error);
    res.status(500).json({ error: "Failed to get candidate" });
  }
});

// Get all candidates
router.get("/candidates", async (req, res) => {
  try {
    const candidates = await getAllCandidates();
    res.json(candidates);
  } catch (error) {
    console.error("Get candidates error:", error);
    res.status(500).json({ error: "Failed to get candidates" });
  }
});

// Update candidate
router.put("/candidate/:id", async (req, res) => {
  try {
    const updatedCandidate = await updateCandidate(req.params.id, req.body);
    res.json(updatedCandidate);
  } catch (error) {
    console.error("Update candidate error:", error);
    res.status(500).json({ error: "Failed to update candidate" });
  }
});

export default router;