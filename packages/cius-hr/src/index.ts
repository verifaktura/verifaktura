import { fileURLToPath } from "node:url";
import { registerProfile, type ProfileDefinition } from "verifaktura";
import { hrProfileBase } from "./profile.js";

export { HR_CUSTOMIZATION_ID, hrProfileBase } from "./profile.js";

/** Hrvatski CIUS profil s lokalnim SEF-om; registruje se pri importu. */
export const hrProfile: ProfileDefinition = {
  ...hrProfileBase,
  sefPath: fileURLToPath(new URL("../sef/hr-cius-ext-ubl.sef.json", import.meta.url)),
};

registerProfile(hrProfile);

export default hrProfile;
