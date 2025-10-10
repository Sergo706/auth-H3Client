export function callOAuthProvider(name) {
  window.location.assign(`/oauth/${name}`);
}