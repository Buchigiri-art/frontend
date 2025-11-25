import { useEffect, useState } from 'react';
import { Quiz } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Bookmark, TrendingUp } from 'lucide-react';
import { studentsAPI, quizAPI, bookmarksAPI } from '@/services/api';
import { toast } from 'sonner';

type BookmarkItem = {
  _id?: string;
  id?: string;
  type?: string;
  question?: any;
  quiz?: any;
};

export default function DashboardPage() {
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [totalBookmarks, setTotalBookmarks] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [recentQuizzes, setRecentQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsData, quizzesData, bookmarksData] = await Promise.all([
          studentsAPI.getAll(),   // Student[]
          quizAPI.getAll(),       // Quiz[]
          bookmarksAPI.getAll(),  // Bookmark[]
        ]);

        const studentsArr = Array.isArray(studentsData) ? studentsData : [];
        const quizzesArr = Array.isArray(quizzesData) ? quizzesData : [];
        const bookmarksArr = Array.isArray(bookmarksData) ? bookmarksData : [];

        setTotalStudents(studentsArr.length);
        setTotalQuizzes(quizzesArr.length);
        setTotalBookmarks(bookmarksArr.length);

        // Safely compute total questions
        const totalQ = quizzesArr.reduce((acc, quiz: any) => {
          const count = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
          return acc + count;
        }, 0);
        setTotalQuestions(totalQ);

        // Keep only a small recent slice to render (avoid rendering thousands)
        // Sort by createdAt desc if available
        const sortedQuizzes = [...quizzesArr].sort((a: any, b: any) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return db - da;
        });

        setRecentQuizzes(sortedQuizzes.slice(0, 5));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = [
    {
      title: 'Total Students',
      value: totalStudents,
      icon: Users,
      description: 'Uploaded student records',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Quizzes Created',
      value: totalQuizzes,
      icon: FileText,
      description: 'Saved quizzes in the system',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Bookmarked Items',
      value: totalBookmarks,
      icon: Bookmark,
      description: 'Saved questions & quizzes',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Total Questions',
      value: totalQuestions,
      icon: TrendingUp,
      description: 'Questions across all quizzes',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s an overview of your quiz management system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card
            key={stat.title}
            className="shadow-card hover:shadow-elevated transition-shadow duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/students"
            className="p-4 border rounded-lg hover:border-primary hover:shadow-md transition-all group"
          >
            <Users className="h-8 w-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-1">Manage Students</h3>
            <p className="text-sm text-muted-foreground">
              Upload and view student details
            </p>
          </a>

          <a
            href="/create-quiz"
            className="p-4 border rounded-lg hover:border-primary hover:shadow-md transition-all group"
          >
            <FileText className="h-8 w-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-1">Create Quiz</h3>
            <p className="text-sm text-muted-foreground">
              Generate and save quizzes
            </p>
          </a>

          <a
            href="/bookmarks"
            className="p-4 border rounded-lg hover:border-primary hover:shadow-md transition-all group"
          >
            <Bookmark className="h-8 w-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-1">View Bookmarks</h3>
            <p className="text-sm text-muted-foreground">
              Access saved questions & quizzes
            </p>
          </a>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {recentQuizzes.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recent Quizzes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentQuizzes.map((quiz: any) => {
                const questionsCount = Array.isArray(quiz.questions)
                  ? quiz.questions.length
                  : 0;
                const createdAt = quiz.createdAt
                  ? new Date(quiz.createdAt).toLocaleDateString()
                  : 'Unknown date';

                return (
                  <div
                    key={quiz.id || quiz._id || quiz.title}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <h4 className="font-medium">{quiz.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {questionsCount} questions • {createdAt}
                      </p>
                    </div>
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
