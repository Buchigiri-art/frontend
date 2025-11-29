import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, Suspense, lazy } from "react";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./components/DashboardLayout";
import LoadingScreen from "./components/LoadingScreen";

// 🔹 Lazy-loaded pages
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const CreateQuizPage = lazy(() => import("./pages/CreateQuizPage"));
const BookmarksPage = lazy(() => import("./pages/BookmarksPage"));
const StudentQuizPage = lazy(() => import("./pages/StudentQuizPage"));
const QuizResultsPage = lazy(() => import("./pages/QuizResultsPage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Initial splash/loading screen */}
        {isLoading && <LoadingScreen />}

        <Toaster />
        <Sonner />

        <BrowserRouter>
          {/* Suspense handles lazy-loaded routes */}
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/quiz/attempt/:token" element={<StudentQuizPage />} />

              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/create-quiz" element={<CreateQuizPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/bookmarks" element={<BookmarksPage />} />
                <Route
                  path="/quiz/:quizId/results"
                  element={<QuizResultsPage />}
                />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
