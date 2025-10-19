# Resume Parser and Profile Generator

A simple web application that automatically extracts information from PDF resumes and creates professional candidate profiles. Uses Airtable as the database to store candidate data.

## What it does

- Uploads PDF resumes and extracts key information like name, email, phone, skills, education, and work experience
- Creates professional profile pages for each candidate
- Stores all data in Airtable for easy management
- Provides a clean interface to view and manage candidates

## Tech Stack

**Backend:** Node.js, Express, Multer for file uploads, pdf-parse for PDF extraction, Airtable API
**Frontend:** React with TypeScript, Tailwind CSS for styling, React Router for navigation

## Quick Setup

1. **Install dependencies:**
   ```bash
   npm install
   cd frontend && npm install
   ```

2. **Set up Airtable:**
   - Create a free Airtable account
   - Create a new Base called "CandidateProfiles"
   - Create a Table called "Candidates" with these fields:
     - Name (Single line text)
     - Email (Email)
     - Phone (Phone number) 
     - Skills (Long text)
     - Education (Long text)
     - Experience (Long text)
     - PreferredRole (Single line text)
     - ExpectedSalary (Single line text)
     - Location (Single line text)
     - ResumeText (Long text)
     - ResumeFile (Single line text)
     - CreatedAt (Date)

3. **Configure Airtable:**
   - Get your Base ID from Airtable API docs
   - Update the Base ID in `backend/utils/airtableClient.js`
   - The API key is already configured

4. **Run the application:**
   ```bash
   # Start backend
   npm run dev
   
   # Start frontend (new terminal)
   cd frontend && npm start
   ```

Visit http://localhost:3000 to use the application.

## How to use

1. Go to the upload page and select a PDF resume
2. The system will automatically extract information and create a profile
3. View the candidate profile or browse all candidates
4. All data is stored in your Airtable base

## API Endpoints

- `POST /api/resume/upload` - Upload and parse a PDF resume
- `GET /api/resume/candidate/:id` - Get a specific candidate
- `GET /api/resume/candidates` - Get all candidates
- `PUT /api/resume/candidate/:id` - Update candidate information

## Common Issues

**Airtable errors:** Make sure your Base ID is correct and field names match exactly
**PDF parsing:** Only works with text-based PDFs, not scanned images
**File upload:** Maximum 5MB file size limit

## Project Structure

```
├── backend/
│   ├── routes/resumeRoutes.js
│   ├── utils/airtableClient.js
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/Navbar.tsx
│   │   ├── pages/
│   │   └── App.tsx
│   └── package.json
└── package.json
```