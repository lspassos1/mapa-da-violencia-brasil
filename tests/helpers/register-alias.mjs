// Regista o hook de resolucao de alias "@/" para os testes (node --import).
import { register } from "node:module";

register("./alias-hook.mjs", import.meta.url);
