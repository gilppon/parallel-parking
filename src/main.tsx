import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { audio } from "./game/AudioFx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary
      gameName="Parallel Parking Master"
      accent="#a3e635"
      saveKeys={["extreme-parallel-parking-v1"]}
      onCrash={() => audio.stopMusic()}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>
);
