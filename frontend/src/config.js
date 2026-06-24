// Centralizes the backend URLs so they're configurable per environment (set
// REACT_APP_API_BASE_URL / REACT_APP_DOCUMENT_INTELLIGENCE_URL at build/start time)
// instead of being hardcoded to localhost across many files.
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
export const DOCUMENT_INTELLIGENCE_URL = process.env.REACT_APP_DOCUMENT_INTELLIGENCE_URL || 'http://localhost:8000';
