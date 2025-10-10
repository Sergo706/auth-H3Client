import { callOAuthProvider } from "../utils/oauthCaller.js";

export function googleOAuth() {
  const btn = document.getElementById("oauth-google");
  if (!btn) return; 
  
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    callOAuthProvider("google");
  });
}