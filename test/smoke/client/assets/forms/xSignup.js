import { callOAuthProvider } from "../utils/oauthCaller.js";

export function xOAuth() {
  const btn = document.getElementById("oauth-x");
  if (!btn) return; 
  
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    callOAuthProvider("x");
  });
}