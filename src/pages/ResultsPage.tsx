// src/pages/ResultsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizAPI } from '@/services/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Users,
  Clock,
  TrendingUp,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface QuizWithStats {
  _id: string;
  title: string;
  description?: string;
  duration?: number;
  createdAt: string;
  attemptCount: number;
  submittedCount: number;
  averageScore?: number;
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchQuizzesWithStats();
  }, []);

  const fetchQuizzesWithStats = async () => {
    try {
      setLoading(true);
      const data = await quizAPI.getAllWithStats();
      setQuizzes(data);
    } catch (error) {
      console.error('Error fetching quiz results:', error);
      toast.error('Failed to load quiz results');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = (quizId: string) => {
    navigate(`/quiz/${quizId}/results`);
  };

  const handleDeleteQuiz = async (quizId: string, title: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this quiz?\n\n"${title}"\n\nThis will remove the quiz and all its results.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(quizId);
      await quizAPI.delete(quizId);

      setQuizzes((prev) => prev.filter((q) => q._id !== quizId));

      toast.success('Quiz deleted successfully');
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast.error('Failed to delete quiz');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Quiz Results</h1>
          <p className="text-muted-foreground">
            View and manage results for all your quizzes
          </p>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Quiz Results Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create and share quizzes to see student results here
              </p>
              <Button onClick={() => navigate('/create-quiz')}>
                Create Your First Quiz
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <Card
              key={quiz._id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleViewResults(quiz._id)}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-start gap-2">
                    <FileText className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{quiz.title}</span>
                  </CardTitle>
                  {quiz.description && (
                    <CardDescription className="line-clamp-2 mt-1">
                      {quiz.description}
                    </CardDescription>
                  )}
                </div>

                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation(); // don't trigger card click
                    handleDeleteQuiz(quiz._id, quiz.title);
                  }}
                  disabled={deletingId === quiz._id}
                  aria-label="Delete quiz"
                >
                  {deletingId === quiz._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {quiz.attemptCount}{' '}
                      {quiz.attemptCount === 1 ? 'attempt' : 'attempts'}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      {quiz.submittedCount} submitted
                    </span>
                  </div>

                  {quiz.duration && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {quiz.duration} minutes
                      </span>
                    </div>
                  )}

                  {quiz.averageScore !== undefined &&
                    quiz.submittedCount > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Avg: {quiz.averageScore.toFixed(1)}%
                        </span>
                      </div>
                    )}

                  <Button
                    className="w-full mt-4"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewResults(quiz._id);
                    }}
                  >
                    View Results
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
