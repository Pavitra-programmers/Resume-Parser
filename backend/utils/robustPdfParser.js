import * as pdf from 'pdf-parse';
import pdf2pic from 'pdf2pic';
import fs from 'fs';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize OpenAI client
let openai = null;
if (process.env.OPEN_AI_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPEN_AI_KEY
  });
  console.log('OpenAI client initialized');
} else {
  console.log('OpenAI API key not found, using text-based parsing only');
}

// Robust PDF parser with multiple strategies
const parseResumeRobust = async (pdfPath) => {
  try {
    console.log('Starting robust resume parsing...');
    
    let extractedText = '';
    let parsingMethod = '';
    
    // Strategy 1: Try pdf-parse first (fastest)
    try {
      console.log('Attempting pdf-parse extraction...');
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await new pdf.PDFParse(dataBuffer);
      extractedText = pdfData.text || '';
      parsingMethod = 'pdf-parse';
      console.log(`pdf-parse extracted ${extractedText.length} characters`);
    } catch (error) {
      console.log('pdf-parse failed:', error.message);
    }
    
    // Strategy 2: If pdf-parse failed or extracted very little text, try image-based parsing
    if (!extractedText || extractedText.trim().length < 50) {
      try {
        console.log('Attempting image-based extraction with OpenAI Vision...');
        const imageBasedText = await extractTextFromPdfImages(pdfPath);
        if (imageBasedText && imageBasedText.trim().length > extractedText.length) {
          extractedText = imageBasedText;
          parsingMethod = 'OpenAI Vision';
          console.log(`OpenAI Vision extracted ${extractedText.length} characters`);
        }
      } catch (error) {
        console.log('Image-based extraction failed:', error.message);
      }
    }
    
    // Strategy 3: If still no text, try alternative text extraction
    if (!extractedText || extractedText.trim().length < 10) {
      try {
        console.log('Attempting alternative text extraction...');
        const alternativeText = await extractTextAlternative(pdfPath);
        if (alternativeText && alternativeText.trim().length > 0) {
          extractedText = alternativeText;
          parsingMethod = 'Alternative';
          console.log(`Alternative extraction found ${extractedText.length} characters`);
        }
      } catch (error) {
        console.log('Alternative extraction failed:', error.message);
      }
    }
    
    console.log(`Final extraction method: ${parsingMethod}, text length: ${extractedText.length}`);
    
    if (!extractedText || extractedText.trim().length < 10) {
      console.log('No text extracted from any method, using fallback data...');
      return getFallbackData();
    }
    
    // Use AI to enhance the parsing if OpenAI is available
    if (openai && extractedText.length > 50) {
      try {
        console.log('Using AI to enhance parsing...');
        const aiEnhancedData = await enhanceWithAI(extractedText);
        return {
          ...aiEnhancedData,
          parsingMethod: `${parsingMethod} + AI Enhancement`
        };
      } catch (aiError) {
        console.log('AI enhancement failed, using text parsing:', aiError.message);
      }
    }
    
    // Fallback to intelligent text parsing
    const parsedData = parseTextIntelligently(extractedText);
    return {
      ...parsedData,
      parsingMethod: parsingMethod
    };
    
  } catch (error) {
    console.error('Error in robust resume parsing:', error);
    return getFallbackData();
  }
};

// Extract text from PDF using image conversion and OpenAI Vision
const extractTextFromPdfImages = async (pdfPath) => {
  if (!openai) {
    throw new Error('OpenAI not available for image processing');
  }
  
  try {
    // Convert PDF to images
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 200, // Higher density for better text recognition
      saveFilename: "page",
      savePath: "./temp",
      format: "png",
      width: 2000,
      height: 2000
    });
    
    const results = await convert.bulk(-1); // Convert all pages
    console.log(`Converted PDF to ${results.length} images`);
    
    if (!results || results.length === 0) {
      throw new Error('No images generated from PDF');
    }

    let allText = '';
    
    // Process each page with OpenAI Vision
    for (let i = 0; i < Math.min(results.length, 3); i++) { // Limit to first 3 pages
      try {
        const imagePath = results[i].path;
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all text from this resume image. Return only the raw text content, no formatting or JSON. Include all information: name, contact details, experience, skills, education, etc."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        });
        
        const pageText = response.choices[0].message.content;
        allText += pageText + '\n\n';
        
        // Clean up the image file
        fs.unlinkSync(imagePath);
        
      } catch (pageError) {
        console.error(`Error processing page ${i + 1}:`, pageError.message);
      }
    }
    
    return allText.trim();
    
  } catch (error) {
    console.error('Error in image-based extraction:', error);
    throw error;
  }
};

// Alternative text extraction method
const extractTextAlternative = async (pdfPath) => {
  try {
    // Try reading the PDF as binary and looking for text patterns
      const dataBuffer = fs.readFileSync(pdfPath);
    const text = dataBuffer.toString('utf8');
    
    // Look for common text patterns in PDFs
    const textMatches = text.match(/[A-Za-z0-9\s@.,\-+()]{10,}/g);
    if (textMatches && textMatches.length > 0) {
      return textMatches.join(' ').substring(0, 5000); // Limit to first 5000 chars
    }
    
    return '';
  } catch (error) {
    console.error('Alternative extraction error:', error);
    return '';
  }
};

// AI enhancement using OpenAI
const enhanceWithAI = async (text) => {
  try {
    const prompt = `
    You are an expert resume parser. Analyze the following resume text and extract ALL available information in JSON format.
    Be extremely accurate and comprehensive. Extract information from ANY resume format or template.

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
  console.log('Using intelligent text parsing...');
  
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
  
  return {
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    skills: skills.trim(),
    education: '',
    experience: experience.trim(),
    location: location.trim(),
    linkedinUrl: linkedinUrl.trim(),
    expectedSalary: '',
    summary: summary.trim(),
    areasOfExpertise: skills.trim(),
    qualifications: '',
    languages: '',
    currentJobTitle: currentJobTitle.trim(),
    yearsOfExperience: yearsOfExperience.trim(),
    resumeText: text
  };
};

// Extract name using multiple strategies
const extractName = (lines, text) => {
  // Strategy 1: Look for name patterns at the beginning
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];
    
    // Pattern 1: Proper case name (e.g., "Kritensh Kumar")
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line) && line.length < 50) {
      console.log(`Found name pattern 1: "${line}"`);
      return line;
    }
    
    // Pattern 2: All caps name (e.g., "STEVEN SORICILLO")
    if (/^[A-Z]+(?:\s+[A-Z]+){1,3}$/.test(line) && 
        !['LINKEDIN', 'PROFILE', 'EMAIL', 'PHONE', 'ADDRESS', 'RESUME', 'CURRICULUM', 'VITAE', 'CONTACT', 'INFORMATION', 'BUSINESS', 'DEVELOPMENT', 'PROFESSIONAL', 'EXPERIENCE', 'OBJECTIVE', 'SUMMARY', 'SKILLS', 'EDUCATION'].some(word => 
          line.includes(word))) {
      console.log(`Found name pattern 2: "${line}"`);
      return line.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
  }
  
  // Strategy 2: Extract from email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    const emailName = emailMatch[0].split('@')[0];
    if (emailName && emailName.length > 2) {
      console.log(`Extracted name from email: "${emailName}"`);
      return emailName.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
  
  // Strategy 3: Look for common names
  const commonNames = ['Kritensh', 'Steven', 'John', 'Sarah', 'Michael', 'David', 'Lisa', 'Robert', 'Jennifer', 'William'];
  for (const name of commonNames) {
    const namePattern = new RegExp(`\\b${name}\\b`, 'i');
    if (namePattern.test(text.substring(0, 500))) {
      console.log(`Found common name: "${name}"`);
      return name;
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
    /(?:BUSINESS DEVELOPMENT|Business Development)[:\s]*(.+?)(?=AREAS OF EXPERTISE|Experience|Work|Skills|Professional|Employment|Education|$)/is
  ];
  
  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().split('\n').slice(0, 5).join(' '); // Take first 5 lines
    }
  }
  return '';
};

  // Extract current job title
const extractCurrentJobTitle = (text) => {
  const jobTitlePatterns = [
    /(?:Backend Developer|Frontend Developer|Full Stack Developer|Software Developer|Web Developer|Data Scientist|Machine Learning Engineer|Business Development Manager|Account Executive|Manager|Director|Senior|Lead|Principal|Engineer|Analyst|Consultant|Specialist)[^,\n]*/i
  ];
  
  for (const pattern of jobTitlePatterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      return match[0].trim();
    }
  }
  return '';
};

  // Extract years of experience
const extractYearsOfExperience = (text) => {
  const experienceYearsPatterns = [
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i,
    /(?:experience|exp)[:\s]*(\d+)\+?\s*(?:years?|yrs?)/i
  ];
  
  for (const pattern of experienceYearsPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1] + ' years';
    }
  }
  return '';
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

export { parseResumeRobust };