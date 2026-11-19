import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PwaInstall from "./PwaInstall";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><><App /><PwaInstall /></></React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then(registration => registration.update())
      .catch(error => console.error("SARINA service worker registration failed:", error));
  });
}
