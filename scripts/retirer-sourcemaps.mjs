// Retire les cartes de code source (.map) du dossier `out` avant de le copier dans les applications
// mobiles : elles alourdiraient l'application et permettraient de lire tout le code de l'application
// téléchargée. (Le site web les exclut déjà de son déploiement : deploy/deployer-site.sh.)
import fs from "node:fs";
import path from "node:path";

const dossier = path.resolve("out");
let nombre = 0;
const parcourir = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) parcourir(p);
    else if (e.name.endsWith(".map")) {
      fs.rmSync(p);
      nombre++;
    }
  }
};
parcourir(dossier);
console.log(`${nombre} carte(s) de code source retirée(s) de ${path.relative(process.cwd(), dossier)}/`);
