import axios from "axios";

// ⚠️ Replace with your backend IP
const API = axios.create({ baseURL: "http://192.168.1.106:8000" });

// Function to set the auth token
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete API.defaults.headers.common['Authorization'];
  }
};

export default API;
