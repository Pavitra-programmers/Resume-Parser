import Airtable from "airtable";

const base = new Airtable({ 
  apiKey: process.env.AIRTABEL_KEY
}).base(process.env.BASE_ID);

export const addCandidate = async (fields) => {
  try {
    const records = await base("Candidates").create([{ fields }]);
    return records[0];
  } catch (error) {
    console.error("Error adding candidate:", error);
    throw error;
  }
};

export const getCandidate = async (id) => {
  try {
    const record = await base("Candidates").find(id);
    return record.fields;
  } catch (error) {
    console.error("Error getting candidate:", error);
    throw error;
  }
};

export const getAllCandidates = async () => {
  try {
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
    const record = await base("Candidates").update(id, fields);
    return record.fields;
  } catch (error) {
    console.error("Error updating candidate:", error);
    throw error;
  }
};