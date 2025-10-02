import { getSecretData } from "./forms/getSecrets.js";
import { sendLoginData } from "./forms/login.js";
import { sendSignupData } from "./forms/signup.js";
import { getCsrf } from "./utils/csrf.js";
document.addEventListener('DOMContentLoaded', async () => {
   await getSecretData();
   await sendLoginData();
   await sendSignupData();
   getCsrf()
})