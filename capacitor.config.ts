import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.artiflow-pro.com",
  appName: "ArtiFlow-pro",
  // Dossier produit par `vite build` (voir vite.config.ts) : construire avec BASE_PATH=/ (valeur par défaut).
  webDir: "out",
  plugins: {
    LocalNotifications: {
      // Silhouette blanche du logo (android/app/src/main/res/drawable-*/ic_stat_artiflow.png).
      smallIcon: "ic_stat_artiflow",
      iconColor: "#F5B921",
    },
  },
  ios: {
    // Garde l'interface sous la barre d'état et au-dessus de l'indicateur d'accueil.
    contentInset: "always",
  },
};

export default config;
