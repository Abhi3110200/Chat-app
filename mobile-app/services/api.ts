import axios from "axios";

// ⚠️ Replace with your backend IP
const API = axios.create({ baseURL: "https://chat-app-tvkg.onrender.com" });

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
