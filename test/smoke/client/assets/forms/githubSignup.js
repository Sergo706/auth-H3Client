import { callOAuthProvider } from "../utils/oauthCaller.js";

export function githubOAuth() {
  const btn = document.getElementById("oauth-github");
  if (!btn) return; 
  
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    callOAuthProvider("github");
  });
}