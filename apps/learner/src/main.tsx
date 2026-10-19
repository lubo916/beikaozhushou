import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { queryClient } from "./api/query-client.ts";
import { App } from "./App.tsx";
import "./i18n/index.ts";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root mount element in index.html");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
