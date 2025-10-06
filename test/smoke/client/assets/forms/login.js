import {sendForm} from "../utils/ajax.js"

export async function sendLoginData() {
    const status = document.getElementById("login-status");
    const form = document.getElementById("login-form");
    const btn = document.getElementById("login-btn");
    const dataDisplay = document.getElementById("login-data");

    btn.addEventListener("click", async (e) => {
        e.preventDefault()
        status.textContent = "Pending";
        status.style.color = "orange";

        try {
            const res = await sendForm("/login", form, 'POST');
            if (res) {
                status.textContent = "Success";
                status.style.color = "green";
                dataDisplay.textContent =  JSON.stringify(res);
                return;
            }
        } catch(err) {
            status.textContent = "Error";
            status.style.color = "red";
            throw err;
        }
    });
}