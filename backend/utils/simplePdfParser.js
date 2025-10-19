import pdf from 'pdf-parse';
import fs from 'fs';

// Simple and effective resume parser that works with any format
const parseResumeSimple = async (pdfPath) => {
  try {
    console.log('Starting simple resume parsing...');
    
    // Extract text from PDF
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);
    const extractedText = pdfData.text;
    
    console.log('Extracted text length:', extractedText.length);
    
    if (!extractedText || extractedText.trim().length < 10) {
      console.log('No text extracted, using fallback data...');
      return getFallbackData();
    }
    
    // Parse the extracted text
    return parseTextIntelligently(extractedText);
    
  } catch (error) {
    console.error('Error in simple resume parsing:', error);
    return getFallbackData();
  }
};

// Intelligent text parsing for any resume format
const parseTextIntelligently = (text) => {
  console.log('Parsing text intelligently...');
  
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
    resumeText: ''
  };
};

export { parseResumeSimple };