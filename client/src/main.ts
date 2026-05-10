import { mount } from "svelte";
import App from "./App.svelte";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/cards.css";
import "./styles/table.css";

const target = document.getElementById("app");
if (!target) throw new Error("#app not found");

mount(App, { target });
