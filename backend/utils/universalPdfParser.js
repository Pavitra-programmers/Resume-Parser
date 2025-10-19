import pdf from 'pdf-poppler';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI client only if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// Convert PDF to images for AI processing
const convertPdfToImages = async (pdfPath) => {
  try {
    const options = {
      format: 'png',
      out_dir: path.join(__dirname, '../temp'),
      out_prefix: 'page',
      page: null // Convert all pages
    };

    console.log('Converting PDF to images for AI analysis...');
    const results = await pdf.convert(pdfPath, options);
    
    if (!results || results.length === 0) {
      throw new Error('No images generated from PDF');
    }

    console.log(`Generated ${results.length} images for AI processing`);
    
    // Read the generated images and convert to base64
    const images = [];
    for (let i = 0; i < results.length; i++) {
      const imagePath = path.join(__dirname, '../temp', `page-${i + 1}.png`);
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64 = imageBuffer.toString('base64');
        images.push(base64);
        
        // Clean up the image file immediately
        fs.unlinkSync(imagePath);
      }
    }
    
    return images;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw error;
  }
};

// AI-powered resume parsing using GPT-4 Vision
const parseResumeWithAI = async (pdfPath) => {
  try {
    if (!openai) {
      throw new Error("OpenAI client not initialized - API key not available.");
    }

    console.log('Using AI Vision for resume parsing...');
    const images = await convertPdfToImages(pdfPath);
    
    if (images.length === 0) {
      throw new Error('No images generated from PDF');
    }

    console.log(`Processing ${images.length} pages with AI...`);

    // Comprehensive prompt for any resume format
    const prompt = `
    You are an expert resume parser. Analyze this resume image and extract ALL available information in JSON format.
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
    `;

    // Process each page of the resume
    let allExtractedData = {};
    
    for (let i = 0; i < images.length; i++) {
      console.log(`Processing page ${i + 1} of ${images.length} with AI...`);
      
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // Use GPT-4 with vision capabilities
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${images[i]}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 3000,
          temperature: 0.1 // Low temperature for consistent parsing
        });

        const content = response.choices[0].message.content;
        console.log(`AI Response for page ${i + 1}:`, content.substring(0, 200) + '...');

        // Parse JSON response
        try {
          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
          let pageData;
          
          if (jsonMatch && jsonMatch[1]) {
            pageData = JSON.parse(jsonMatch[1]);
          } else {
            // If no JSON block, try to parse the whole content as JSON
            pageData = JSON.parse(content);
          }
          
          // Merge data from all pages intelligently
          allExtractedData = {
            ...allExtractedData,
            ...pageData,
            // For experience, concatenate if multiple pages
            experience: allExtractedData.experience 
              ? `${allExtractedData.experience}\n\n${pageData.experience || ''}`.trim()
              : pageData.experience || '',
            // For skills, combine and deduplicate
            skills: allExtractedData.skills 
              ? [...new Set([...allExtractedData.skills.split(','), ...(pageData.skills || '').split(',')])].filter(s => s.trim()).join(', ')
              : pageData.skills || '',
            // For education, concatenate if multiple pages
            education: allExtractedData.education 
              ? `${allExtractedData.education}\n\n${pageData.education || ''}`.trim()
              : pageData.education || ''
          };
        } catch (parseError) {
          console.error(`Error parsing JSON from page ${i + 1}:`, parseError);
          console.log('Raw content:', content);
        }
      } catch (apiError) {
        console.error(`Error processing page ${i + 1} with AI:`, apiError);
      }
    }

    return allExtractedData;

  } catch (error) {
    console.error('Error in AI resume parsing:', error);
    throw error;
  }
};

// Universal text-based parsing with advanced pattern recognition
const parseResumeText = (text) => {
  console.log('Using universal text-based parsing...');
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  // Universal name extraction with multiple strategies
  const extractName = (text, lines) => {
    // Strategy 1: Look for name patterns at the beginning
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      
      // Pattern 1: Proper case name (e.g., "John Smith")
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line) && line.length < 50) {
        return line;
      }
      
      // Pattern 2: All caps name (e.g., "JOHN SMITH")
      if (/^[A-Z]+(?:\s+[A-Z]+){1,3}$/.test(line) && 
          !['LINKEDIN', 'PROFILE', 'EMAIL', 'PHONE', 'ADDRESS', 'RESUME', 'CURRICULUM', 'VITAE', 'CONTACT', 'INFORMATION', 'BUSINESS', 'DEVELOPMENT', 'PROFESSIONAL', 'EXPERIENCE', 'OBJECTIVE', 'SUMMARY', 'SKILLS', 'EDUCATION'].some(word => 
            line.includes(word))) {
        return line.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      }
    }
    
    // Strategy 2: Extract from email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      const emailName = emailMatch[0].split('@')[0];
      if (emailName && emailName.length > 2) {
        return emailName.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }
    
    return '';
  };

  // Universal email extraction
  const extractEmail = (text) => {
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return emailMatch ? emailMatch[0] : '';
  };

  // Universal phone extraction
  const extractPhone = (text) => {
    const phoneRegex = /(\+?[\d\s\-\(\)\.]{7,})/g;
    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches) {
      const validPhones = phoneMatches.filter(p => {
        const digits = p.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15;
      });
      
      if (validPhones.length > 0) {
        return validPhones.find(p => p.startsWith('+') || p.replace(/\D/g, '').length >= 10) || validPhones[0];
      }
    }
    return '';
  };

  // Universal location extraction
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

  // Universal experience extraction
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
    return '';
  };

  // Universal skills extraction
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

  // Universal summary extraction
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

  // Universal LinkedIn URL extraction
  const extractLinkedIn = (text) => {
    const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9\-_]+/i);
    return linkedinMatch ? `https://${linkedinMatch[0]}` : '';
  };

  // Universal job title extraction
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

  // Universal years of experience extraction
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

  // Extract all data using universal methods
  const name = extractName(text, lines);
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const location = extractLocation(text);
  const experience = extractExperience(text);
  const skills = extractSkills(text);
  const summary = extractSummary(text);
  const linkedinUrl = extractLinkedIn(text);
  const currentJobTitle = extractCurrentJobTitle(text);
  const yearsOfExperience = extractYearsOfExperience(text);

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

// Main universal parsing function
const parseResumeUniversally = async (pdfPath) => {
  try {
    console.log('Starting universal resume parsing...');
    
    // First, try AI parsing if OpenAI client is available
    if (openai) {
      try {
        console.log('Attempting AI-powered parsing...');
        const aiResult = await parseResumeWithAI(pdfPath);
        console.log('AI parsing successful');
        return aiResult;
      } catch (aiError) {
        console.log('AI parsing failed, falling back to text parsing:', aiError.message);
      }
    } else {
      console.log('OpenAI API key not available, using text-based parsing...');
    }
    
    // Fallback to text-based parsing
    try {
      const pdfParse = await import('pdf-parse');
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdfParse.default(dataBuffer);
      const extractedText = pdfData.text;
      
      if (extractedText && extractedText.trim().length > 50) {
        console.log('Using text-based parsing...');
        return parseResumeText(extractedText);
      } else {
        console.log('Text extraction failed, returning minimal data...');
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
          resumeText: extractedText || ''
        };
      }
    } catch (textError) {
      console.error('Text parsing failed:', textError);
      throw new Error('Failed to parse resume with all methods');
    }
    
  } catch (error) {
    console.error('Error in universal resume parsing:', error);
    throw error;
  }
};

export { parseResumeUniversally, parseResumeWithAI, parseResumeText };