import { callOAuthProvider } from "../utils/oauthCaller.js";

export function linkedinOAuth() {
  const btn = document.getElementById("oauth-linkedin");
  if (!btn) return; 
  
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    callOAuthProvider("linkedin");
  });
}