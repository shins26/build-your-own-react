import { createRoot } from "react-dom/client";

const element = <h1 title="foo">Hello</h1>;
const container = document.getElementById("root");
if (!container) throw new Error("No root Element");

const root = createRoot(container);
root.render(element);
