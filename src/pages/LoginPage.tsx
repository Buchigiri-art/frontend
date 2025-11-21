import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginCard } from '@/components/LoginCard';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen gradient-subtle flex items-center justify-center p-4 md:p-6 lg:p-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-10 md:-left-20 w-48 h-48 md:w-72 md:h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-10 md:-right-20 w-64 h-64 md:w-96 md:h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
      </div>
      <div className="w-full max-w-md animate-fade-in">
        <LoginCard />
      </div>
    </div>
  );
}
