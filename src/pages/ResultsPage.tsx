import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizAPI } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, Clock, TrendingUp } from 'lucide-react';
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Quiz Results</h1>
        <p className="text-muted-foreground">
          View and manage results for all your quizzes
        </p>
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
              <CardHeader>
                <CardTitle className="flex items-start gap-2">
                  <FileText className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{quiz.title}</span>
                </CardTitle>
                {quiz.description && (
                  <CardDescription className="line-clamp-2">
                    {quiz.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {quiz.attemptCount} {quiz.attemptCount === 1 ? 'attempt' : 'attempts'}
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

                  {quiz.averageScore !== undefined && quiz.submittedCount > 0 && (
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
