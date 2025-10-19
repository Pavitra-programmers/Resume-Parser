import OpenAI from 'openai';
import pdf from 'pdf-poppler';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_KEY
});

// Convert PDF to images using pdf-poppler
const convertPdfToImages = async (pdfPath) => {
  try {
    const options = {
      format: 'png',
      out_dir: path.join(__dirname, '../temp'),
      out_prefix: 'page',
      page: null // Convert all pages
    };

    console.log('Converting PDF to images with pdf-poppler...');
    const results = await pdf.convert(pdfPath, options);
    
    if (!results || results.length === 0) {
      throw new Error('No images generated from PDF');
    }

    console.log(`Generated ${results.length} images`);
    
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

// Parse resume using AI vision
const parseResumeWithAI = async (pdfPath) => {
  try {
    console.log('Converting PDF to images...');
    const images = await convertPdfToImages(pdfPath);
    
    if (images.length === 0) {
      throw new Error('No images generated from PDF');
    }

    console.log(`Generated ${images.length} images, processing with AI...`);

    // Create a comprehensive prompt for resume parsing
    const prompt = `
    Please analyze this resume image and extract the following information in JSON format. Be very accurate and thorough:

    {
      "name": "Full name of the candidate",
      "email": "Email address",
      "phone": "Phone number",
      "location": "Location/Address",
      "summary": "Professional summary or objective",
      "areasOfExpertise": "Areas of expertise or key skills section",
      "qualifications": "Highlighted qualifications or key achievements",
      "experience": "Professional experience with job titles, companies, dates, and responsibilities",
      "education": "Education background",
      "skills": "Technical and soft skills (comma-separated)",
      "languages": "Languages spoken",
      "currentJobTitle": "Current or most recent job title",
      "yearsOfExperience": "Years of experience",
      "linkedinUrl": "LinkedIn profile URL if mentioned",
      "expectedSalary": "Expected salary if mentioned"
    }

    Important guidelines:
    1. Extract the name exactly as it appears (e.g., "STEVEN SORICILLO" should be "Steven Soricillo")
    2. For experience, include company names, job titles, dates, and key responsibilities
    3. For skills, extract from both explicit skills sections and job descriptions
    4. Be very careful with dates and numbers
    5. If information is not available, use empty string ""
    6. Return only valid JSON, no additional text
    `;

    // Process each page of the resume
    let allExtractedData = {};
    
    for (let i = 0; i < images.length; i++) {
      console.log(`Processing page ${i + 1} of ${images.length}...`);
      
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // Use GPT-4 with vision capabilities
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${images[i]}`
                  }
                }
              ]
            }
          ],
          max_tokens: 2000,
          temperature: 0.1 // Low temperature for consistent parsing
        });

        const content = response.choices[0].message.content;
        console.log(`AI Response for page ${i + 1}:`, content);

        // Parse JSON response
        try {
          const pageData = JSON.parse(content);
          
          // Merge data from all pages
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
              : pageData.skills || ''
          };
        } catch (parseError) {
          console.error(`Error parsing JSON from page ${i + 1}:`, parseError);
          console.log('Raw content:', content);
        }
      } catch (apiError) {
        console.error(`Error processing page ${i + 1} with AI:`, apiError);
      }
    }

    // Clean up temporary images
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
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }

    return allExtractedData;

  } catch (error) {
    console.error('Error in AI resume parsing:', error);
    throw error;
  }
};

// Enhanced fallback parsing with much better accuracy
const fallbackParsing = (text) => {
  console.log('Using enhanced fallback parsing...');
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  // Enhanced name extraction
  let name = '';
  
  // Strategy 1: Look for all caps name at the beginning
  if (lines.length > 0) {
    const firstFewLines = lines.slice(0, 5);
    for (const line of firstFewLines) {
      if (/^[A-Z]+(?:\s+[A-Z]+){1,3}$/.test(line) && 
          !['LINKEDIN', 'PROFILE', 'EMAIL', 'PHONE', 'ADDRESS', 'RESUME', 'CURRICULUM', 'VITAE', 'CONTACT', 'INFORMATION', 'BUSINESS', 'DEVELOPMENT', 'PROFESSIONAL', 'EXPERIENCE'].some(word => 
            line.includes(word))) {
        name = line.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        break;
      }
    }
  }
  
  // Strategy 2: Look for name before email
  if (!name) {
    const nameBeforeEmailPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
    const match = text.match(nameBeforeEmailPattern);
    if (match && match[1]) {
      name = match[1].trim();
    }
  }

  // Enhanced email extraction
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  // Enhanced phone extraction
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

  // Enhanced location extraction
  let location = '';
  const locationPatterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\s*\d{5})/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+City)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z][a-z]+)/i
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      location = match[1].trim();
      if (!['Email', 'Phone', 'LinkedIn', 'Profile'].some(word => 
        location.toLowerCase().includes(word.toLowerCase()))) {
        break;
      }
    }
  }

  // Enhanced experience extraction
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
      experience = match[1].trim().split('\n').slice(0, 20).join(' '); // Take first 20 lines
      break;
    }
  }

  // Enhanced skills extraction
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

  // Extract areas of expertise
  let areasOfExpertise = '';
  const expertisePatterns = [
    /(?:AREAS OF EXPERTISE|Areas of Expertise|Expertise|Skills|Key Skills)[:\s]*(.+?)(?=Experience|Work|Professional|Employment|Education|$)/is
  ];
  
  for (const pattern of expertisePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      areasOfExpertise = match[1].trim().split('\n').slice(0, 10).join(' '); // Take first 10 lines
      break;
    }
  }

  // Extract summary
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

  // Extract qualifications
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

  return {
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    skills: foundSkills.join(', '),
    education: '',
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

export { parseResumeWithAI, fallbackParsing };