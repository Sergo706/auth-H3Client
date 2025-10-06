

export async function getSecretData() {
    const btn = document.getElementById("get-secret");
    const panel = document.getElementById("secret-output")
    const status = document.getElementById("secret-status")
    const btn2 = document.getElementById("get-secret2");



    const request = async (useFirst) => {
        status.textContent = "Pending";
        status.style.color = "orange";
        const path = useFirst ? "/secret/data" : "/secret/data2";


        try {
            const res = await fetch(path, {
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
    }
    btn.addEventListener("click", () => request(true));
    btn2.addEventListener("click", () => request(false));
}

