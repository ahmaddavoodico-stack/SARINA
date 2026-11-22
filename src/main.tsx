import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PwaInstall from "./PwaInstall";
import UpdateManager from "./UpdateManager";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <PwaInstall />
    <UpdateManager />
  </React.StrictMode>
);
