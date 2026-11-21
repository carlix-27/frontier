import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource/germania-one/latin-400.css";
import "./style.css";
import "./animations.css";
import "./theme.css";
import "./world.css";
import "./atlas.css";

createRoot(document.getElementById("app")!).render(<StrictMode><App /></StrictMode>);
