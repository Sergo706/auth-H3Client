import {sendForm} from "../utils/ajax.js";


export async function sendSignupData() {
    const status = document.getElementById("signup-status");
    const form = document.getElementById("signup-form");
    const btn = document.getElementById("signup-btn");
    const dataDisplay = document.getElementById("signup-data");
    
    btn.addEventListener("click", async (e) => {
        e.preventDefault()
        status.textContent = "Pending";
        status.style.color = "orange";

        try {
            const res = await sendForm("/signup", form, 'POST');
            
            if (res) {
                status.textContent = "Success";
                status.style.color = "green";
                dataDisplay.textContent = JSON.stringify(res);
                return;
            }
            
        } catch(err) {
            status.textContent = "Error";
            status.style.color = "red";
            throw err;
        }
    });
}