

export async function getSecretData() {
    const btn = document.getElementById("get-secret");
    const panel = document.getElementById("secret-output")
    const status = document.getElementById("secret-status")

    btn.addEventListener("click", async () => {
        status.textContent = "Pending";
        status.style.color = "orange";

        try {
            const res = await fetch('/secret/data', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            })
            if (res.ok) {
                const json = await res.json();
                status.textContent = "Success";
                status.style.color = "green";
                panel.textContent =  JSON.stringify(json);
                return;
            }

        } catch(err) {
            console.log(err)
            status.textContent = "Error";
            status.style.color = "red";
            throw err;
        }
    })
}