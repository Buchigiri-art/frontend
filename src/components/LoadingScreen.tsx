import { useEffect, useState } from 'react';

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-primary/80 animate-fade-in">
      <div className="text-center space-y-8 animate-scale-in">
        {/* Logo Animation */}
        <div className="relative">
          <div className="absolute inset-0 blur-3xl bg-white/20 rounded-full animate-pulse"></div>
          <div className="relative w-24 h-24 mx-auto bg-white rounded-full flex items-center justify-center shadow-2xl animate-bounce">
            <svg
              className="w-12 h-12 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
        </div>

        {/* App Title */}
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            SmartQuizAI
          </h1>
          <p className="text-white/80 text-lg font-medium">Faculty Module</p>
        </div>

        {/* Progress Bar */}
        <div className="w-64 mx-auto space-y-3">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <div
              className="h-full bg-white rounded-full transition-all duration-300 ease-out shadow-glow"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-white/90 text-sm font-medium">
            {progress < 100 ? 'Loading your workspace...' : 'Ready!'}
          </p>
        </div>

        {/* Animated Dots */}
        <div className="flex justify-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}
