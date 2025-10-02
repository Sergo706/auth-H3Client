import { defineHandler, H3, serveStatic } from 'h3'

import path from 'node:path'
import { readFile, stat } from 'node:fs/promises'; 
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'client');



export function useStaticRoutes(router: H3) {
  router.use(
   async (event, next) => {
       const served = await serveStatic(event, {
        indexNames: ["/index.html"],
        fallthrough: true,
        getContents: (id) => {
          const safe = path.normalize(id).replace(/^\/+/, '');
          const fullPath = path.join(root, safe); 
          return readFile(fullPath) as Promise<BodyInit | undefined>
        },
        getMeta: async (id) => {
          const safe = path.normalize(id).replace(/^\/+/, '');
          const abs  = path.join(root, safe);
           const stats = await stat(abs).catch(() => undefined);
          if (!stats || !stats.isFile()) {
            return;
          }
             return { size: stats.size, mtime: stats.mtimeMs }
        },
      });
      if (served === false) return next();
      
      return served;
    },
  );

}



export default useStaticRoutes


