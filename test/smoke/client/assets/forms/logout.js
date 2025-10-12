import { getCsrf } from "../utils/csrf.js";



export async function logout() {
    const btn = document.getElementById("logout");
    const panel = document.getElementById("logout-output")
    const status = document.getElementById("logout-status")
    const token = getCsrf();
    
    btn.addEventListener('click', async (e) => {
        e.preventDefault()
        status.textContent = "Pending";
        status.style.color = "orange";

        try {
            const res = await fetch('/logout', {    
                method: 'POST',
                headers: {
                    'X-CSRF-Token': token,
                    'Accept': 'application/json'
                }
            })
            if (res.ok) {
                const json = await res.json();
                status.textContent = "Success";
                status.style.color = "green";
                    if (json.redirectTo) {
                        window.location.assign(json.redirectTo);
                    }
                panel.textContent =  JSON.stringify(json);       
                return;
            }
        } catch(err) {
            console.log(err)
            status.textContent = "Error";
            status.style.color = "red";
            if (err.name === 'TimeoutError') {
                panel.textContent = "The server is taking too long to respond. Please check your connection and try again.";
            }
            throw err;
        }

    })
}