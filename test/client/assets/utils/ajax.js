import { getCsrf } from "./csrf.js";

export async function sendForm(endpoint, form, method) {
    const token = getCsrf();
    form.addEventListener("submit", (e) => e.preventDefault());
    if (!token) {
      throw new Error(`No csrf token`)
    }
    const data = Object.fromEntries(new FormData(form));
    
    try {
    const res = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-Token': token
            },
            body: JSON.stringify(data)
        });

      if (res.ok) {
        const json = await res.json();
        return json;
      } 
    }
    catch (err) {
        console.log(err)
        throw err;
    }
}