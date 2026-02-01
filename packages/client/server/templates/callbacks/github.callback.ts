 
export async function githubEmailCallBack(accessToken:string): Promise<string> {
    try {
        const res = await fetch('https://api.github.com/user/emails', {
          headers: {'Authorization': `token ${accessToken}`}
        });

    const emails = await res.json() as { email: string; primary?: boolean}[] | null;

      if (!emails || emails.length === 0) {
          throw new Error( "No email is provided, an email is required to make an account.");
      }

      const primary = emails.find(e => typeof e === 'object' && e.primary);
      const email = primary?.email ?? emails[0]?.email;

      if (!email) throw new Error('Could not derive email from response.');

      return email;
      
    } catch(err) {
        throw err;
    }

}
