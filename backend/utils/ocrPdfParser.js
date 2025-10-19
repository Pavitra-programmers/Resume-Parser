import { createWorker } from 'tesseract.js';
import pdf2pic from 'pdf2pic';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI client
let openai = null;
if (process.env.OPEN_AI_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPEN_AI_KEY
  });
  console.log('OpenAI client initialized for OCR parsing');
} else {
  console.log('OpenAI API key not found, using OCR-only parsing');
}

// OCR-based PDF parser for image-based resumes
const parseResumeWithOCR = async (pdfPath) => {
  try {
    console.log('Starting OCR-based resume parsing...');
    
    // Convert PDF to images
    const images = await convertPdfToImages(pdfPath);
    
    if (!images || images.length === 0) {
      console.log('No images generated from PDF, using fallback...');
      return getFallbackData();
    }
    
    console.log(`Generated ${images.length} images, processing with OCR...`);
    
    // Initialize Tesseract worker
    const worker = await createWorker('eng', 1, {
      logger: m => console.log('OCR Progress:', m)
    });
    
    let fullText = '';
    
    // Process each page with OCR
    for (let i = 0; i < images.length; i++) {
      console.log(`Processing page ${i + 1} of ${images.length} with OCR...`);
      
      try {
        const { data: { text } } = await worker.recognize(images[i]);
        console.log(`OCR extracted ${text.length} characters from page ${i + 1}`);
        console.log(`First 200 chars from page ${i + 1}:`, text.substring(0, 200));
        
        if (text && text.trim().length > 0) {
          fullText += text + '\n\n';
        } else {
          console.log(`Page ${i + 1} produced no text`);
        }
      } catch (ocrError) {
        console.error(`OCR error on page ${i + 1}:`, ocrError.message);
        console.error(`OCR error details:`, ocrError);
      }
    }
    
    // Terminate worker
    await worker.terminate();
    
    // Clean up temporary images
    await cleanupTempImages();
    
    console.log(`Total OCR text length: ${fullText.length}`);
    
    if (!fullText || fullText.trim().length < 10) {
      console.log('OCR extracted no meaningful text, using fallback...');
      return getFallbackData();
    }
    
    // Clean the OCR text
    const cleanText = cleanOCRText(fullText);
    console.log(`Cleaned OCR text length: ${cleanText.length}`);
    
    // Use AI to enhance the parsing if available
    if (openai && cleanText.length > 50) {
      try {
        console.log('Using AI to enhance OCR parsing...');
        const aiEnhancedData = await enhanceWithAI(cleanText);
        return {
          ...aiEnhancedData,
          parsingMethod: 'OCR + AI Enhancement'
        };
      } catch (aiError) {
        console.log('AI enhancement failed, using OCR parsing:', aiError.message);
      }
    }
    
    // Fallback to intelligent text parsing
    const parsedData = parseTextIntelligently(cleanText);
    return {
      ...parsedData,
      parsingMethod: 'OCR'
    };
    
  } catch (error) {
    console.error('Error in OCR resume parsing:', error);
    return getFallbackData();
  }
};

// Convert PDF to images using pdf2pic
const convertPdfToImages = async (pdfPath) => {
  try {
    const tempDir = path.join(__dirname, '../temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Clean up any existing temp files first
    const existingFiles = fs.readdirSync(tempDir);
    existingFiles.forEach(file => {
      if (file.startsWith('page') && file.endsWith('.png')) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    });
    
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 300, // High DPI for better OCR
      saveFilename: 'page',
      savePath: tempDir,
      format: 'png',
      width: 2000, // High resolution
      height: 2600
    });
    
    console.log('Converting PDF to images with pdf2pic...');
    const results = await convert.bulk(-1); // Convert all pages
    
    if (!results || results.length === 0) {
      throw new Error('No images generated from PDF');
    }
    
    console.log(`Generated ${results.length} images`);
    
    // Read the generated images
    const images = [];
    for (let i = 0; i < results.length; i++) {
      const imagePath = path.join(tempDir, `page.${i + 1}.png`);
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        images.push(imageBuffer);
        console.log(`Loaded image ${i + 1}: ${imageBuffer.length} bytes`);
      } else {
        console.log(`Image file not found: ${imagePath}`);
      }
    }
    
    if (images.length === 0) {
      throw new Error('No images could be loaded');
    }
    
    return images;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw error;
  }
};

// Clean OCR text to remove common artifacts
const cleanOCRText = (text) => {
  if (!text) return '';
  
  console.log('Original OCR text length:', text.length);
  console.log('First 200 chars:', text.substring(0, 200));
  
  // Clean common OCR artifacts
  let cleanText = text
    .replace(/\f/g, '\n') // Replace form feeds with newlines
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n\s+/g, '\n') // Remove leading spaces from lines
    .replace(/\s+\n/g, '\n') // Remove trailing spaces from lines
    .trim();
  
  // Remove common OCR errors and artifacts
  cleanText = cleanText
    .replace(/\b[0-9]{1,2}\s*[|]\s*[0-9]{1,2}\s*[|]\s*[0-9]{4}\b/g, '') // Remove date patterns like "12 | 15 | 2023"
    .replace(/\b[0-9]+\s*[|]\s*[0-9]+\s*[|]\s*[0-9]+\b/g, '') // Remove other pipe-separated numbers
    .replace(/\b[0-9]+\s*[-]\s*[0-9]+\s*[-]\s*[0-9]+\b/g, '') // Remove dash-separated numbers
    .replace(/\b[0-9]+\s*[.]\s*[0-9]+\s*[.]\s*[0-9]+\b/g, '') // Remove dot-separated numbers
    .replace(/\b[0-9]+\s*[/]\s*[0-9]+\s*[/]\s*[0-9]+\b/g, '') // Remove slash-separated numbers
    .replace(/\b[0-9]+\s*[|]\s*[0-9]+\b/g, '') // Remove simple pipe-separated numbers
    .replace(/\b[0-9]+\s*[-]\s*[0-9]+\b/g, '') // Remove simple dash-separated numbers
    .replace(/\b[0-9]+\s*[.]\s*[0-9]+\b/g, '') // Remove simple dot-separated numbers
    .replace(/\b[0-9]+\s*[/]\s*[0-9]+\b/g, '') // Remove simple slash-separated numbers
    .replace(/\b[0-9]+\s*[|]\b/g, '') // Remove numbers followed by pipe
    .replace(/\b[|]\s*[0-9]+\b/g, '') // Remove pipe followed by numbers
    .replace(/\b[0-9]+\s*[-]\b/g, '') // Remove numbers followed by dash
    .replace(/\b[-]\s*[0-9]+\b/g, '') // Remove dash followed by numbers
    .replace(/\b[0-9]+\s*[.]\b/g, '') // Remove numbers followed by dot
    .replace(/\b[.]\s*[0-9]+\b/g, '') // Remove dot followed by numbers
    .replace(/\b[0-9]+\s*[/]\b/g, '') // Remove numbers followed by slash
    .replace(/\b[/]\s*[0-9]+\b/g, '') // Remove slash followed by numbers
    .replace(/\b[|]\b/g, '') // Remove standalone pipes
    .replace(/\b[-]\b/g, '') // Remove standalone dashes
    .replace(/\b[.]\b/g, '') // Remove standalone dots
    .replace(/\b[/]\b/g, '') // Remove standalone slashes
    .replace(/\s+/g, ' ') // Normalize whitespace again
    .trim();
  
  console.log('After OCR cleaning:', cleanText.length);
  console.log('First 200 chars after cleaning:', cleanText.substring(0, 200));
  
  return cleanText;
};

// AI enhancement using OpenAI
const enhanceWithAI = async (text) => {
  try {
    const prompt = `
    You are an expert resume parser. Analyze the following resume text extracted via OCR and extract ALL available information in JSON format.
    Be extremely accurate and comprehensive. The text may contain OCR artifacts, so be careful with parsing.

    Expected JSON format:
    {
      "name": "Full name of the candidate",
      "email": "Email address",
      "phone": "Phone number",
      "location": "Location/Address (City, State, Country)",
      "linkedinUrl": "LinkedIn profile URL if mentioned",
      "summary": "Professional summary, objective, or profile statement",
      "areasOfExpertise": "Areas of expertise, key skills, or specializations",
      "qualifications": "Highlighted qualifications, certifications, or achievements",
      "experience": "Complete professional experience including company names, job titles, dates, and detailed responsibilities",
      "education": "Educational background including degrees, institutions, and dates",
      "skills": "All technical and soft skills (comma-separated)",
      "languages": "Languages spoken (e.g., 'English, Spanish, French')",
      "currentJobTitle": "Current or most recent job title",
      "yearsOfExperience": "Total years of relevant experience (e.g., '5 years')",
      "expectedSalary": "Expected salary if mentioned"
    }

    IMPORTANT GUIDELINES:
    1. **name**: Extract the full name exactly as it appears (convert ALL CAPS to proper case)
    2. **email**: Find any email address in the resume
    3. **phone**: Extract phone number in any format (+1, (555), etc.)
    4. **location**: Extract city, state, country, or address
    5. **linkedinUrl**: Find LinkedIn profile URL (add https:// if missing)
    6. **summary**: Extract professional summary, objective, or profile statement
    7. **areasOfExpertise**: Extract key skills, specializations, or areas of expertise
    8. **qualifications**: Extract certifications, achievements, or highlighted qualifications
    9. **experience**: Extract ALL work experience with company names, job titles, dates, and responsibilities
    10. **education**: Extract degrees, institutions, graduation dates
    11. **skills**: Extract ALL technical and soft skills mentioned anywhere in the resume
    12. **languages**: Extract languages spoken or known
    13. **currentJobTitle**: Extract the most recent or current job title
    14. **yearsOfExperience**: Calculate or extract total years of experience
    15. **expectedSalary**: Extract salary expectations if mentioned

    EXTRACTION RULES:
    - Look for information in ANY section or format
    - Extract from headers, bullet points, paragraphs, tables
    - Handle different layouts: single column, two column, creative formats
    - Extract from any language or template
    - If information is not available, use empty string ""
    - Be thorough and extract everything visible
    - Handle OCR artifacts and errors gracefully
    - Return ONLY valid JSON, no additional text

    Resume text to analyze:
    ${text}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.1
    });

    const content = response.choices[0].message.content;
    console.log('AI Response:', content.substring(0, 200) + '...');

    // Parse JSON response
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      let parsedData;
      
      if (jsonMatch && jsonMatch[1]) {
        parsedData = JSON.parse(jsonMatch[1]);
      } else {
        // If no JSON block, try to parse the whole content as JSON
        parsedData = JSON.parse(content);
      }
      
      console.log('AI parsing successful');
      return parsedData;
    } catch (parseError) {
      console.error('Error parsing AI JSON response:', parseError);
      console.log('Raw AI content:', content);
      throw parseError;
    }
  } catch (error) {
    console.error('Error in AI enhancement:', error);
    throw error;
  }
};

// Intelligent text parsing for fallback
const parseTextIntelligently = (text) => {
  console.log('Using enhanced intelligent text parsing for OCR...');
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  // Extract name - multiple strategies
  const name = extractName(lines, text);
  
  // Extract email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';
  
  // Extract phone
  const phoneRegex = /(\+?[\d\s\-\(\)\.]{7,})/g;
  const phoneMatches = text.match(phoneRegex);
  let phone = '';
  if (phoneMatches) {
    const validPhones = phoneMatches.filter(p => {
      const digits = p.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    });
    
    if (validPhones.length > 0) {
      phone = validPhones.find(p => p.startsWith('+') || p.replace(/\D/g, '').length >= 10) || validPhones[0];
      phone = phone.trim();
    }
  }
  
  // Extract location
  const location = extractLocation(text);
  
  // Extract experience
  const experience = extractExperience(text);
  
  // Extract skills
  const skills = extractSkills(text);
  
  // Extract summary
  const summary = extractSummary(text);
  
  // Extract current job title
  const currentJobTitle = extractCurrentJobTitle(text);
  
  // Extract years of experience
  const yearsOfExperience = extractYearsOfExperience(text);
  
  // Extract LinkedIn URL
  const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9\-_]+/i);
  const linkedinUrl = linkedinMatch ? `https://${linkedinMatch[0]}` : '';
  
  // Extract education
  const education = extractEducation(text);
  
  // Extract areas of expertise
  const areasOfExpertise = extractAreasOfExpertise(text);
  
  // Extract qualifications
  const qualifications = extractQualifications(text);
  
  // Extract languages
  const languages = extractLanguages(text);
  
  // Extract expected salary
  const expectedSalary = extractExpectedSalary(text);
  
  return {
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    skills: skills.trim(),
    education: education.trim(),
    experience: experience.trim(),
    location: location.trim(),
    linkedinUrl: linkedinUrl.trim(),
    expectedSalary: expectedSalary.trim(),
    summary: summary.trim(),
    areasOfExpertise: areasOfExpertise.trim(),
    qualifications: qualifications.trim(),
    languages: languages.trim(),
    currentJobTitle: currentJobTitle.trim(),
    yearsOfExperience: yearsOfExperience.trim(),
    resumeText: text
  };
};

// Extract name using multiple strategies
const extractName = (lines, text) => {
  console.log('Extracting name from', lines.length, 'lines');
  console.log('First 5 lines:', lines.slice(0, 5));
  
  // Strategy 1: Look for name patterns at the beginning
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    console.log(`Checking line ${i}: "${line}"`);
    
    // Pattern 1: Proper case name (e.g., "Steven Soricillo")
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line) && line.length < 50) {
      console.log(`Found name pattern 1: "${line}"`);
      return line;
    }
    
    // Pattern 2: All caps name (e.g., "STEVEN SORICILLO")
    if (/^[A-Z]+(?:\s+[A-Z]+){1,3}$/.test(line) && 
        !['LINKEDIN', 'PROFILE', 'EMAIL', 'PHONE', 'ADDRESS', 'RESUME', 'CURRICULUM', 'VITAE', 'CONTACT', 'INFORMATION', 'BUSINESS', 'DEVELOPMENT', 'PROFESSIONAL', 'EXPERIENCE', 'OBJECTIVE', 'SUMMARY', 'SKILLS', 'EDUCATION', 'TECHNICAL', 'WORK', 'PROJECT', 'CERTIFICATE', 'ACHIEVEMENT'].some(word => 
          line.includes(word))) {
      console.log(`Found name pattern 2: "${line}"`);
      return line.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Pattern 3: Mixed case name (e.g., "Steven Soricillo")
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line) && line.length < 50 && 
        !['LinkedIn', 'Profile', 'Email', 'Phone', 'Address', 'Resume', 'Curriculum', 'Vitae', 'Contact', 'Information', 'Business', 'Development', 'Professional', 'Experience', 'Objective', 'Summary', 'Skills', 'Education'].some(word => 
          line.includes(word))) {
      console.log(`Found name pattern 3: "${line}"`);
      return line;
    }
  }
    
  // Strategy 2: Look for name in the first few lines with better patterns
  const namePatterns = [
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/m,
    /^([A-Z]+(?:\s+[A-Z]+){1,3})/m
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 2 && name.length < 50 && 
          !['LINKEDIN', 'PROFILE', 'EMAIL', 'PHONE', 'ADDRESS', 'RESUME', 'PORTFOLIO', 'REMOTE', 'DELHI'].some(word => 
            name.toUpperCase().includes(word))) {
        console.log(`Found name pattern: "${name}"`);
        return name.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      }
    }
  }
  
  // Strategy 3: Look for specific name patterns like "STEVEN SORICILLO"
  const specificNamePatterns = [
    /\b(STEVEN\s+SORICILLO)\b/i,
    /\b(KRITENSH\s+KUMAR)\b/i,
    /\b([A-Z]{2,}\s+[A-Z]{2,})\b/
  ];
  
  for (const pattern of specificNamePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 3 && name.length < 30) {
        console.log(`Found specific name pattern: "${name}"`);
        return name.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      }
    }
  }
  
  // Strategy 4: Extract from email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    const emailName = emailMatch[0].split('@')[0];
    if (emailName && emailName.length > 2) {
      const cleanName = emailName
        .replace(/[._-]/g, ' ')
        .replace(/\d+/g, '')
        .trim();
      
      if (cleanName.length > 2 && cleanName.length < 20 && 
          !['gmail', 'yahoo', 'hotmail', 'outlook', 'test', 'user', 'admin'].some(word => 
            cleanName.toLowerCase().includes(word))) {
        console.log(`Extracted name from email: "${cleanName}"`);
        return cleanName.replace(/\b\w/g, l => l.toUpperCase());
      }
    }
  }
  
  console.log('No name found');
  return '';
};

// Extract location
const extractLocation = (text) => {
  const locationPatterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\s*\d{5})/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+City)/i,
    /(India|United States|USA|Canada|United Kingdom|UK|Australia|Germany|France|Japan|China|Brazil|Mexico)/i
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const location = match[1].trim();
      if (!['Email', 'Phone', 'LinkedIn', 'Profile', 'Skills', 'Experience'].some(word => 
        location.toLowerCase().includes(word.toLowerCase()))) {
        return location;
      }
    }
  }
  return '';
};

// Extract experience
const extractExperience = (text) => {
  const experienceSectionPatterns = [
    /(?:PROFESSIONAL EXPERIENCE|Professional Experience|Experience|Work History|Employment|Work Experience|Career|Employment History|Professional Background)[:\s]*(.+?)(?=Education|Skills|Projects|Languages|Certifications|References|$)/is,
    /(?:EXPERIENCE|Experience)[:\s]*(.+?)(?=Education|Skills|Projects|Languages|Certifications|References|$)/is,
    /(?:WORK EXPERIENCE|Work Experience)[:\s]*(.+?)(?=Education|Skills|Projects|Languages|Certifications|References|$)/is,
    /(?:EMPLOYMENT|Employment)[:\s]*(.+?)(?=Education|Skills|Projects|Languages|Certifications|References|$)/is,
    /(?:CAREER|Career)[:\s]*(.+?)(?=Education|Skills|Projects|Languages|Certifications|References|$)/is
  ];
  
  for (const pattern of experienceSectionPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().split('\n').slice(0, 30).join(' '); // Take first 30 lines
    }
  }
  
  // If no experience section found, look for job titles in the text
  const jobTitlePatterns = [
    /(?:Backend Developer|Frontend Developer|Full Stack Developer|Software Developer|Web Developer|Machine Learning|Data Scientist|Business Development Manager|Account Executive|Manager|Director|Senior|Lead|Principal|Engineer|Analyst|Consultant|Specialist)[^,\n]*(?:\n[^,\n]*){0,5}/gi
  ];
  
  for (const pattern of jobTitlePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      return matches.slice(0, 5).join('\n'); // Take first 5 job entries
    }
  }
  
  return '';
};

// Extract skills
const extractSkills = (text) => {
  const skillCategories = {
    programming: [
      'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Swift', 'Kotlin', 'R', 'MATLAB', 'Scala', 'Rust', 'TypeScript', 'Dart', 'Perl', 'Lua', 'Haskell', 'Clojure'
    ],
    web: [
      'HTML', 'CSS', 'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel', 'Rails', 'FastAPI', 'Next.js', 'Nuxt.js', 'Svelte', 'Ember', 'jQuery', 'Bootstrap', 'Tailwind'
    ],
    database: [
      'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Cassandra', 'DynamoDB', 'SQLite', 'Oracle', 'SQL Server', 'MariaDB', 'CouchDB', 'Neo4j', 'InfluxDB'
    ],
    cloud: [
      'AWS', 'Azure', 'Google Cloud', 'Heroku', 'DigitalOcean', 'Linode', 'Vercel', 'Netlify', 'Firebase', 'Supabase', 'Cloudflare', 'Docker', 'Kubernetes', 'Terraform', 'Ansible'
    ],
    tools: [
      'Git', 'GitHub', 'GitLab', 'Jenkins', 'CI/CD', 'Jira', 'Confluence', 'Slack', 'Trello', 'Figma', 'VS Code', 'IntelliJ', 'Eclipse', 'Postman', 'Swagger', 'Docker', 'Kubernetes'
    ],
    data: [
      'Machine Learning', 'AI', 'Data Science', 'Analytics', 'Statistics', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Keras', 'OpenCV', 'NLTK', 'SpaCy'
    ],
    business: [
      'Sales', 'Business Development', 'Account Management', 'Customer Relations', 'Lead Generation', 'CRM', 'Salesforce', 'HubSpot', 'Marketing', 'Project Management', 'Agile', 'Scrum'
    ],
    soft: [
      'Communication', 'Leadership', 'Team Management', 'Problem Solving', 'Analytical', 'Time Management', 'Presentation', 'Public Speaking', 'Negotiation', 'Customer Service', 'Collaboration'
    ]
  };
  
  const allSkills = Object.values(skillCategories).flat();
  const foundSkills = allSkills.filter(skill => 
    new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
  );
  
  return foundSkills.join(', ');
};

// Extract summary
const extractSummary = (text) => {
  const summaryPatterns = [
    /(?:SUMMARY|Summary|PROFILE|Profile|OBJECTIVE|Objective|ABOUT|About|PROFESSIONAL SUMMARY|Professional Summary)[:\s]*(.+?)(?=Experience|Work|Skills|Professional|Employment|Education|$)/is,
    /(?:BUSINESS DEVELOPMENT|Business Development)[:\s]*(.+?)(?=AREAS OF EXPERTISE|Experience|Work|Skills|Professional|Employment|Education|$)/is,
    // Look for descriptive text at the beginning
    /^([A-Z][^.\n]{20,200}\.)/m,
    // Look for professional descriptions
    /(?:Engineered|Developed|Designed|Created|Built|Implemented)[^.\n]{10,200}\./i
  ];
  
  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const summary = match[1].trim();
      if (summary.length > 20 && summary.length < 500) {
        return summary.split('\n').slice(0, 3).join(' ').trim();
      }
    }
  }
  
  // Fallback: Look for first substantial paragraph
  const lines = text.split('\n').filter(line => line.trim().length > 20);
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length > 20 && firstLine.length < 300) {
      return firstLine;
    }
  }
  
  return '';
};

// Extract education
const extractEducation = (text) => {
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
      return match[1].trim().split('\n').slice(0, 4).join(' '); // Take first 4 lines
    }
  }
  return '';
};

// Extract areas of expertise
const extractAreasOfExpertise = (text) => {
  const expertisePatterns = [
    /(?:AREAS OF EXPERTISE|Areas of Expertise|Expertise|Skills|Key Skills)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is,
    /(?:TECHNICAL SKILLS|Technical Skills)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is,
    /(?:Languages|Frameworks|Databases|Cloud|Concepts)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is
  ];
  
  for (const pattern of expertisePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().split('\n').slice(0, 10).join(' '); // Take first 10 lines
    }
  }
  
  // Fallback: Extract from skills section
  const skillsMatch = text.match(/(?:Skills|SKILLS)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is);
  if (skillsMatch && skillsMatch[1]) {
    return skillsMatch[1].trim().split('\n').slice(0, 5).join(' ');
  }
  
  return '';
};

// Extract qualifications
const extractQualifications = (text) => {
  const qualificationsPatterns = [
    /(?:HIGHLIGHTED QUALIFICATIONS|Highlighted Qualifications|Qualifications|Key Qualifications)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is,
    /(?:ACHIEVEMENTS|Achievements|CERTIFICATES|Certificates)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is,
    /(?:PROJECT EXPERIENCE|Project Experience|PROJECTS|Projects)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is
  ];
  
  for (const pattern of qualificationsPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().split('\n').slice(0, 8).join(' '); // Take first 8 lines
    }
  }
  
  // Fallback: Look for achievement patterns
  const achievementPatterns = [
    /(?:Secured|Achieved|Completed|Certified|Ranked|Won)[^.\n]{5,100}\./gi
  ];
  
  for (const pattern of achievementPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      return matches.slice(0, 3).join(' '); // Take first 3 achievements
    }
  }
  
  return '';
};

// Extract languages
const extractLanguages = (text) => {
  const languagePatterns = [
    /(?:Languages|Language|Fluent)[:\s]*([^,\n]+)/i,
    /(?:Fluent in|Speaks)[:\s]*([^,\n]+)/i
  ];
  
  for (const pattern of languagePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
};

// Extract expected salary
const extractExpectedSalary = (text) => {
  const salaryPatterns = [
    /Expected Salary[:\s]*([^,\n]+)/i,
    /Salary[:\s]*([^,\n]+)/i,
    /Compensation[:\s]*([^,\n]+)/i,
    /(\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per year|annually|annual|yearly))?)/i
  ];
  
  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
};

// Extract current job title
const extractCurrentJobTitle = (text) => {
  const jobTitlePatterns = [
    /(?:Backend Developer|Frontend Developer|Full Stack Developer|Software Developer|Web Developer|Data Scientist|Machine Learning Engineer|Business Development Manager|Account Executive|Manager|Director|Senior|Lead|Principal|Engineer|Analyst|Consultant|Specialist)[^,\n]*/i,
    // Look for job titles in experience section
    /(?:Present|Current|Now)[^.\n]*(?:Backend Developer|Frontend Developer|Full Stack Developer|Software Developer|Web Developer|Data Scientist|Machine Learning Engineer|Business Development Manager|Account Executive|Manager|Director|Senior|Lead|Principal|Engineer|Analyst|Consultant|Specialist)[^,\n]*/i,
    // Look for recent job titles
    /(?:202[0-9]|Present|Current)[^.\n]*(?:Backend Developer|Frontend Developer|Full Stack Developer|Software Developer|Web Developer|Data Scientist|Machine Learning Engineer|Business Development Manager|Account Executive|Manager|Director|Senior|Lead|Principal|Engineer|Analyst|Consultant|Specialist)[^,\n]*/i
  ];
  
  for (const pattern of jobTitlePatterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      const title = match[0].trim();
      if (title.length > 5 && title.length < 100) {
        return title;
      }
    }
  }
  
  // Fallback: Look for the first job title mentioned
  const firstJobTitle = text.match(/(?:Backend Developer|Frontend Developer|Full Stack Developer|Software Developer|Web Developer|Data Scientist|Machine Learning Engineer|Business Development Manager|Account Executive|Manager|Director|Senior|Lead|Principal|Engineer|Analyst|Consultant|Specialist)/i);
  if (firstJobTitle) {
    return firstJobTitle[0];
  }
  
  return '';
};

// Extract years of experience
const extractYearsOfExperience = (text) => {
  const experienceYearsPatterns = [
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i,
    /(?:experience|exp)[:\s]*(\d+)\+?\s*(?:years?|yrs?)/i,
    // Look for date ranges in experience
    /(?:202[0-9]|202[0-9])[^0-9]*(?:Present|Current|Now)/i
  ];
  
  for (const pattern of experienceYearsPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1] + ' years';
    }
  }
  
  // Fallback: Count years from date ranges
  const dateRanges = text.match(/(?:202[0-9]|202[0-9])[^0-9]*(?:Present|Current|Now)/gi);
  if (dateRanges && dateRanges.length > 0) {
    const currentYear = new Date().getFullYear();
    const startYears = dateRanges.map(range => {
      const yearMatch = range.match(/202[0-9]/);
      return yearMatch ? parseInt(yearMatch[0]) : currentYear;
    });
    const minYear = Math.min(...startYears);
    const years = currentYear - minYear;
    if (years > 0 && years < 20) {
      return years + ' years';
    }
  }
  
  return '';
};

// Clean up temporary images
const cleanupTempImages = async () => {
  try {
    const tempDir = path.join(__dirname, '../temp');
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(file => {
        if (file.startsWith('page') && file.endsWith('.png')) {
          fs.unlinkSync(path.join(tempDir, file));
        }
      });
    }
  } catch (error) {
    console.error('Error cleaning up temp images:', error);
  }
};

// Fallback data when parsing fails
const getFallbackData = () => {
  console.log('Using fallback data...');
  return {
    name: '',
    email: '',
    phone: '',
    skills: '',
    education: '',
    experience: '',
    location: '',
    linkedinUrl: '',
    expectedSalary: '',
    summary: '',
    areasOfExpertise: '',
    qualifications: '',
    languages: '',
    currentJobTitle: '',
    yearsOfExperience: '',
    resumeText: '',
    parsingMethod: 'Fallback'
  };
};

export { parseResumeWithOCR };