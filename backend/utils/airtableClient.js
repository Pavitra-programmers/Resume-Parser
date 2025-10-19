import Airtable from "airtable";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Airtable only if API key is available
let base = null;
if (process.env.AIRTABEL_KEY && process.env.BASE_ID) {
  base = new Airtable({ 
    apiKey: process.env.AIRTABEL_KEY
  }).base(process.env.BASE_ID);
} else {
  console.warn('Airtable API key or Base ID not found. Airtable functionality will be disabled.');
}

export const addCandidate = async (fields) => {
  try {
    if (!base) {
      console.log('Airtable not configured, returning mock data');
      return { id: 'mock_' + Date.now(), fields };
    }
    const records = await base("Candidates").create([{ fields }]);
    return records[0];
  } catch (error) {
    console.error("Error adding candidate:", error);
    throw error;
  }
};

export const getCandidate = async (id) => {
  try {
    if (!base) {
      console.log('Airtable not configured, returning mock data');
      return { Name: 'Mock Candidate', Email: 'mock@example.com' };
    }
    const record = await base("Candidates").find(id);
    return record.fields;
  } catch (error) {
    console.error("Error getting candidate:", error);
    throw error;
  }
};

export const getAllCandidates = async () => {
  try {
    if (!base) {
      console.log('Airtable not configured, returning mock data');
      return [{ id: 'mock_1', Name: 'Mock Candidate', Email: 'mock@example.com' }];
    }
    const records = await base("Candidates").select().all();
    return records.map(record => ({
      id: record.id,
      ...record.fields
    }));
  } catch (error) {
    console.error("Error getting all candidates:", error);
    throw error;
  }
};

export const updateCandidate = async (id, fields) => {
  try {
    if (!base) {
      console.log('Airtable not configured, returning mock data');
      return fields;
    }
    const record = await base("Candidates").update(id, fields);
    return record.fields;
  } catch (error) {
    console.error("Error updating candidate:", error);
    throw error;
  }
};