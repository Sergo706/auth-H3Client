
export function getCsrf() {
        const raw = document.cookie.match(/__Host-csrf=([^;]+)/);
        const token = raw ? raw[1].split(".")[0] : '';
       
        const selectorToShowValue = document.getElementById('csrf-status');
        const btn = document.getElementById('get-csrf');
        const panel = document.getElementById('csrf-output')

        btn.addEventListener('click', () => {
            btn.textContent = 'Restart';
            selectorToShowValue.textContent = `${token ? `Got value!` : `No CSRF COOKIE!`}`
            panel.textContent = token
        })


        return token;
    }