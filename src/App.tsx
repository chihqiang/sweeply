import { AppRouter } from "@/router";
import { ToastProvider } from "@/components/ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
