import { getSecretData } from "./forms/getSecrets.js";
import { sendLoginData } from "./forms/login.js";
import { sendSignupData } from "./forms/signup.js";
import { getCsrf } from "./utils/csrf.js";
import { logout } from "./forms/logout.js";
import { googleOAuth } from "./forms/googleSignin.js";
import { githubOAuth } from "./forms/githubSignup.js";
import {xOAuth} from "./forms/xSignup.js"
import { linkedinOAuth } from "./forms/linkedinSignup.js";
document.addEventListener('DOMContentLoaded', async () => {
   await getSecretData();
   await sendLoginData();
   await sendSignupData();
   await logout()
   await googleOAuth()
   await githubOAuth();
   await xOAuth()
   await linkedinOAuth()
   getCsrf()
})