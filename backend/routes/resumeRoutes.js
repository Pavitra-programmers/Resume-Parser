import express from "express";
import multer from "multer";
import pdf from "pdf-parse";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { addCandidate, getCandidate, getAllCandidates, updateCandidate } from "../utils/airtableClient.js";
import { parseResumeUniversally } from "../utils/universalPdfParser.js";

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

// Advanced resume parsing with comprehensive detail extraction
const parseResumeText = (text) => {
  // Clean and normalize text
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  // Extract email - improved regex
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';
  
  // Extract phone number - much improved to handle all formats
  const phoneRegex = /(\+?[\d\s\-\(\)\.]{7,})/g;
  const phoneMatches = text.match(phoneRegex);
  let phone = '';
  if (phoneMatches) {
    // Filter out invalid phone numbers and find the best one
    const validPhones = phoneMatches.filter(p => {
      const digits = p.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    });
    
    if (validPhones.length > 0) {
      // Prefer phone numbers that start with + or have country codes
      phone = validPhones.find(p => p.startsWith('+') || p.replace(/\D/g, '').length >= 10) || validPhones[0];
      phone = phone.trim();
    }
  }
  
  // Advanced name extraction using multiple strategies
  let name = '';
  
  // Strategy 1: Look for all caps name at the beginning (like "STEVEN SORICILLO")
  if (lines.length > 0) {
    const firstFewLines = lines.slice(0, 3);
    for (const line of firstFewLines) {
      // Check if line is all caps and looks like a name (2-4 words)
      if (/^[A-Z]+(?:\s+[A-Z]+){1,3}$/.test(line) && 
          !['LINKEDIN', 'PROFILE', 'EMAIL', 'PHONE', 'ADDRESS', 'RESUME', 'CURRICULUM', 'VITAE', 'CONTACT', 'INFORMATION', 'BUSINESS', 'DEVELOPMENT', 'PROFESSIONAL', 'EXPERIENCE'].some(word => 
            line.includes(word))) {
        // Convert to proper case
        name = line.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        break;
      }
    }
  }
  
  // Strategy 2: Look for explicit name labels
  if (!name) {
    const nameLabelPatterns = [
      /Name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i,
      /Full Name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i,
      /Candidate[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i
    ];
    
    for (const pattern of nameLabelPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const candidateName = match[1].trim();
        if (!['LinkedIn', 'Profile', 'Email', 'Phone', 'Address', 'Resume', 'Curriculum', 'Vitae'].some(word => 
          candidateName.toLowerCase().includes(word.toLowerCase()))) {
          name = candidateName;
          break;
        }
      }
    }
  }
  
  // Strategy 3: Look for patterns that suggest a name at the beginning
  if (!name && lines.length > 0) {
    const firstFewLines = lines.slice(0, 5);
    for (const line of firstFewLines) {
      // Check if line looks like a name (2-4 capitalized words)
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line) && 
          !['LinkedIn', 'Profile', 'Email', 'Phone', 'Address', 'Resume', 'Curriculum', 'Vitae', 'Contact', 'Information'].some(word => 
            line.toLowerCase().includes(word.toLowerCase()))) {
        name = line;
        break;
      }
    }
  }
  
  // Strategy 4: Look for name before email
  if (!name) {
    const nameBeforeEmailPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
    const match = text.match(nameBeforeEmailPattern);
    if (match && match[1]) {
      name = match[1].trim();
    }
  }
  
  // Extract skills with comprehensive keyword matching
  const skillCategories = {
    technical: [
      'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'MongoDB', 'PostgreSQL',
      'AWS', 'Docker', 'Git', 'HTML', 'CSS', 'TypeScript', 'Angular', 'Vue', 'Express',
      'Django', 'Flask', 'Spring', 'Redis', 'Kubernetes', 'Linux', 'Machine Learning', 'AI',
      'PHP', 'C++', 'C#', '.NET', 'Ruby', 'Go', 'Swift', 'Kotlin', 'R', 'MATLAB'
    ],
    sales: [
      'Sales', 'Business Development', 'Account Management', 'Customer Relations',
      'Lead Generation', 'CRM', 'Salesforce', 'HubSpot', 'Cold Calling', 'Negotiation',
      'Presentation', 'Public Speaking', 'Market Research', 'Client Acquisition',
      'Revenue Generation', 'Pipeline Management', 'Territory Management',
      'Key Account Management', 'Revenue Growth', 'Market Analysis', 'Import/Export Sales',
      'Strategic Growth Planning', 'Partnership Development', 'Pricing Negotiations',
      'Contract Negotiations', 'Problem Resolution'
    ],
    logistics: [
      'Logistics', 'Supply Chain', 'Freight Forwarding', 'International Trade',
      'Transportation', 'Warehousing', 'Inventory Management', 'Customs',
      'Import/Export', 'Ocean Freight', 'Air Freight', 'Trucking', 'Rail',
      'Third-Party Logistics', '3PL', '4PL', 'Transpacific', 'Transatlantic',
      'Trade Lanes', 'Commodities', 'Steel', 'Machinery', 'Textiles', 'Tiles',
      'Port Operations', 'Shipping', 'Distribution', 'Procurement', 'Customs Clearance Sales'
    ],
    general: [
      'Project Management', 'Agile', 'Scrum', 'Leadership', 'Team Management',
      'Communication', 'Analytical', 'Problem Solving', 'Microsoft Office',
      'Excel', 'PowerPoint', 'Word', 'Outlook', 'Time Management', 'Management',
      'International Sales Marketing', 'Strategic Growth Planning', 'Partnership Development'
    ]
  };
  
  const allSkills = Object.values(skillCategories).flat();
  const foundSkills = allSkills.filter(skill => 
    new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
  );
  
  // Also extract skills from areas of expertise section
  let expertiseSkills = [];
  const expertisePatterns = [
    /(?:AREAS OF EXPERTISE|Areas of Expertise|Expertise|Skills|Key Skills)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is
  ];
  
  for (const pattern of expertisePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const expertiseText = match[1].trim();
      // Extract skills from bullet points or comma-separated lists
      const skillMatches = expertiseText.match(/(?:•\s*)?([A-Za-z\s\/&]+)/g);
      if (skillMatches) {
        expertiseSkills = skillMatches.map(skill => skill.replace(/^•\s*/, '').trim()).filter(skill => skill.length > 2);
      }
      break;
    }
  }
  
  // Combine found skills with expertise skills, removing duplicates
  const allFoundSkills = [...new Set([...foundSkills, ...expertiseSkills])];
  
  // Extract education with better section detection
  let education = '';
  const educationSectionPatterns = [
    /Education[:\s]*(.+?)(?=Experience|Work|Skills|Professional|Employment|Projects|Languages|Certifications|$)/is,
    /Academic[:\s]*(.+?)(?=Experience|Work|Skills|Professional|Employment|Projects|Languages|Certifications|$)/is,
    /Educational[:\s]*(.+?)(?=Experience|Work|Skills|Professional|Employment|Projects|Languages|Certifications|$)/is,
    /University[:\s]*(.+?)(?=Experience|Work|Skills|Professional|Employment|Projects|Languages|Certifications|$)/is,
    /College[:\s]*(.+?)(?=Experience|Work|Skills|Professional|Employment|Projects|Languages|Certifications|$)/is
  ];
  
  for (const pattern of educationSectionPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      education = match[1].trim().split('\n').slice(0, 4).join(' '); // Take first 4 lines
      break;
    }
  }
  
  // Extract summary/objective section
  let summary = '';
  const summaryPatterns = [
    /(?:Summary|Objective|Profile|About)[:\s]*(.+?)(?=Experience|Work|Skills|Professional|Employment|Education|$)/is,
    /(?:BUSINESS DEVELOPMENT|Business Development)[:\s]*(.+?)(?=AREAS OF EXPERTISE|Experience|Work|Skills|Professional|Employment|Education|$)/is
  ];
  
  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      summary = match[1].trim().split('\n').slice(0, 5).join(' '); // Take first 5 lines
      break;
    }
  }
  
  // Extract areas of expertise
  let areasOfExpertise = '';
  const areasOfExpertisePatterns = [
    /(?:AREAS OF EXPERTISE|Areas of Expertise|Expertise|Skills|Key Skills)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is
  ];
  
  for (const pattern of areasOfExpertisePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      areasOfExpertise = match[1].trim().split('\n').slice(0, 10).join(' '); // Take first 10 lines
      break;
    }
  }
  
  // Extract highlighted qualifications
  let qualifications = '';
  const qualificationsPatterns = [
    /(?:HIGHLIGHTED QUALIFICATIONS|Highlighted Qualifications|Qualifications|Key Qualifications)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is
  ];
  
  for (const pattern of qualificationsPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      qualifications = match[1].trim().split('\n').slice(0, 8).join(' '); // Take first 8 lines
      break;
    }
  }
  
  // Extract experience with comprehensive section detection
  let experience = '';
  const experienceSectionPatterns = [
    /(?:PROFESSIONAL EXPERIENCE|Professional Experience|Experience|Work History|Employment|Work Experience)[:\s]*(.+?)(?=Education|Skills|Projects|Languages|Certifications|$)/is,
    /Professional[:\s]*(.+?)(?=Education|Skills|Projects|Languages|Certifications|$)/is,
    /Career[:\s]*(.+?)(?=Education|Skills|Projects|Languages|Certifications|$)/is,
    /Employment[:\s]*(.+?)(?=Education|Skills|Projects|Languages|Certifications|$)/is
  ];
  
  for (const pattern of experienceSectionPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      experience = match[1].trim().split('\n').slice(0, 20).join(' '); // Take first 20 lines for comprehensive details
      break;
    }
  }
  
  // If no experience found with patterns, try to find job entries manually
  if (!experience) {
    const jobEntryPattern = /([A-Z][a-zA-Z\s&,.-]+(?:Inc|LLC|Corp|Company|Ltd|Group|Consulting|Consultant|Independent|Freelance)?)\s*\|\s*([A-Za-z\s,.-]+)\s*([0-9]{4}-(?:Present|[0-9]{4}))/g;
    const jobMatches = [...text.matchAll(jobEntryPattern)];
    
    if (jobMatches.length > 0) {
      const jobEntries = jobMatches.map(match => {
        const company = match[1].trim();
        const location = match[2].trim();
        const dates = match[3].trim();
        return `${company} | ${location} (${dates})`;
      });
      experience = jobEntries.join('; ');
    }
  }
  
  // Enhance experience with summary and qualifications if available
  let enhancedExperience = experience;
  if (summary) {
    enhancedExperience = `SUMMARY: ${summary}\n\nEXPERIENCE:\n${experience}`;
  }
  if (qualifications) {
    enhancedExperience += `\n\nQUALIFICATIONS:\n${qualifications}`;
  }
  if (areasOfExpertise) {
    enhancedExperience += `\n\nAREAS OF EXPERTISE:\n${areasOfExpertise}`;
  }
  
  // Extract location with better patterns
  let location = '';
  const locationPatterns = [
    /Location[:\s]*([^,\n]+)/i,
    /Address[:\s]*([^,\n]+)/i,
    /Based in[:\s]*([^,\n]+)/i,
    /Residing in[:\s]*([^,\n]+)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+City)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+)/i
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      location = match[1].trim();
      // Validate it's not a common word
      if (!['Email', 'Phone', 'LinkedIn', 'Profile'].some(word => 
        location.toLowerCase().includes(word.toLowerCase()))) {
        break;
      }
    }
  }
  
  // Extract LinkedIn URL
  const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9\-_]+/i);
  const linkedinUrl = linkedinMatch ? `https://${linkedinMatch[0]}` : '';
  
  // Extract salary expectations
  let expectedSalary = '';
  const salaryPatterns = [
    /Expected Salary[:\s]*([^,\n]+)/i,
    /Salary[:\s]*([^,\n]+)/i,
    /Compensation[:\s]*([^,\n]+)/i,
    /(\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per year|annually|annual|yearly))?)/i
  ];
  
  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      expectedSalary = match[1].trim();
      break;
    }
  }
  
  
  // Extract languages
  let languages = '';
  const languagePatterns = [
    /(?:Languages|Language|Fluent)[:\s]*([^,\n]+)/i,
    /(?:Fluent in|Speaks)[:\s]*([^,\n]+)/i
  ];
  
  for (const pattern of languagePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      languages = match[1].trim();
      break;
    }
  }
  
  // Extract current job title
  let currentJobTitle = '';
  const jobTitlePatterns = [
    /(?:Business Development Manager|Account Executive|Manager|Director|Senior|Lead|Principal)[^,\n]*/i
  ];
  
  for (const pattern of jobTitlePatterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      currentJobTitle = match[0].trim();
      break;
    }
  }
  
  // Extract years of experience
  let yearsOfExperience = '';
  const experienceYearsPatterns = [
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i,
    /(?:experience|exp)[:\s]*(\d+)\+?\s*(?:years?|yrs?)/i
  ];
  
  for (const pattern of experienceYearsPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      yearsOfExperience = match[1] + ' years';
      break;
    }
  }
  
  return {
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    skills: allFoundSkills.join(', '),
    education: education,
    experience: enhancedExperience,
    location: location.trim(),
    linkedinUrl: linkedinUrl.trim(),
    expectedSalary: expectedSalary.trim(),
    summary: summary,
    areasOfExpertise: areasOfExpertise,
    qualifications: qualifications,
    languages: languages,
    currentJobTitle: currentJobTitle,
    yearsOfExperience: yearsOfExperience,
    resumeText: text
  };
};

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
      
      // Use the universal parser that works with any resume format
      parsedData = await parseResumeUniversally(filePath);
      parsingMethod = 'Universal Parser';
      console.log('Universal parsing successful:', parsedData);
      
    } catch (universalError) {
      console.error('Universal parsing failed:', universalError);
      throw new Error('Failed to parse resume with universal parser');
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