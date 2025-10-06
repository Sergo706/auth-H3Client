import { getSecretData } from "./forms/getSecrets.js";
import { sendLoginData } from "./forms/login.js";
import { sendSignupData } from "./forms/signup.js";
import { getCsrf } from "./utils/csrf.js";
import { logout } from "./forms/logout.js";
document.addEventListener('DOMContentLoaded', async () => {
   await getSecretData();
   await sendLoginData();
   await sendSignupData();
   await logout()
   getCsrf()
})