import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (new URLSearchParams(window.location.search).has("browser-test")) {
  import("./browserTest.js").then(({ runBrowserTest }) => runBrowserTest());
}
