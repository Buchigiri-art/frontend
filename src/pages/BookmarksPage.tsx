import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Trash2, FileEdit, Share2, FolderPlus, Folder } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { bookmarksAPI, foldersAPI, quizAPI, studentsAPI } from '@/services/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StudentTable } from '@/components/StudentTable';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function BookmarksPage() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedQuizForShare, setSelectedQuizForShare] = useState<any>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bookmarksData, foldersData, studentsData] = await Promise.all([
        bookmarksAPI.getAll(),
        foldersAPI.getAll(),
        studentsAPI.getAll()
      ]);
      setBookmarks(bookmarksData || []);
      setFolders(foldersData || []);
      setStudents(studentsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    try {
      await bookmarksAPI.delete(id);
      setBookmarks(bookmarks.filter(b => b._id !== id));
      toast.success('Bookmark removed');
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      toast.error('Failed to delete bookmark');
    }
  };

  const handleEditInQuiz = (bookmark: any) => {
    if (bookmark.type === 'quiz') {
      navigate('/create-quiz', { state: { editQuiz: bookmark.quiz } });
    } else {
      navigate('/create-quiz', { state: { editQuestion: bookmark.question } });
    }
    toast.info('Opening in Create Quiz page');
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Folder name is required');
      return;
    }

    try {
      const newFolder = await foldersAPI.create({ name: newFolderName });
      setFolders([...folders, newFolder]);
      setNewFolderName('');
      setNewFolderDialogOpen(false);
      toast.success('Folder created');
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleShareQuiz = async () => {
    if (!selectedQuizForShare) return;

    try {
      // First save the quiz if it's from bookmarks
      const savedQuiz = await quizAPI.save({
        title: selectedQuizForShare.quiz.title,
        description: selectedQuizForShare.quiz.description,
        questions: selectedQuizForShare.quiz.questions,
        numQuestions: selectedQuizForShare.quiz.numQuestions,
        questionType: selectedQuizForShare.quiz.questionType,
        duration: selectedQuizForShare.quiz.duration,
        difficulty: selectedQuizForShare.quiz.difficulty,
        folderId: selectedQuizForShare.folderId
      } as any);

      // Share the quiz
      const studentEmails = selectedStudents.length > 0 
        ? students.filter(s => selectedStudents.includes(s.id)).map(s => s.email)
        : students.map(s => s.email);

      const result = await quizAPI.share({
        quizId: savedQuiz.quizId,
        studentEmails,
        links: []
      });

      toast.success(`Quiz shared with ${result.links?.length || 0} students`);
      setShareDialogOpen(false);
      setSelectedQuizForShare(null);
      setSelectedStudents([]);
    } catch (error) {
      console.error('Error sharing quiz:', error);
      toast.error('Failed to share quiz');
    }
  };

  const openShareDialog = (bookmark: any) => {
    setSelectedQuizForShare(bookmark);
    setShareDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="p-3 md:p-6 space-y-4 md:space-y-6 animate-fade-in max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading bookmarks...</p>
        </div>
      </div>
    );
  }

  const quizBookmarks = bookmarks.filter(b => b.type === 'quiz');
  const filteredBookmarks = quizBookmarks.filter(b => {
    if (filterType === 'all') return true;
    return b.quiz?.difficulty === filterType;
  });

  // Group bookmarks by folder
  const bookmarksByFolder = filteredBookmarks.reduce((acc: any, bookmark: any) => {
    const folderId = bookmark.folderId?._id || bookmark.folderId || 'no-folder';
    if (!acc[folderId]) {
      acc[folderId] = [];
    }
    acc[folderId].push(bookmark);
    return acc;
  }, {});

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Bookmarked Quizzes
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage your saved quizzes and share them with students
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-primary">{quizBookmarks.length}</p>
                <p className="text-xs text-muted-foreground">Total Bookmarks</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px] h-9 text-xs md:text-sm">
                  <SelectValue placeholder="Filter by difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Difficulties</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Folder
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Folder</DialogTitle>
                    <DialogDescription>
                      Organize your bookmarked quizzes into folders
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="folder-name">Folder Name</Label>
                      <Input
                        id="folder-name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="e.g., Mathematics, Science"
                      />
                    </div>
                    <Button onClick={handleCreateFolder} className="w-full">
                      Create Folder
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredBookmarks.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-16">
            <div className="text-center space-y-3">
              <Bookmark className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto opacity-50" />
              <div>
                <p className="text-base md:text-lg font-medium text-foreground">
                  No bookmarked quizzes found
                </p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  Create and bookmark quizzes to see them here
                </p>
              </div>
              <Button onClick={() => navigate('/create-quiz')} className="mt-4">
                Go to Create Quiz
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {Object.entries(bookmarksByFolder).map(([folderId, folderBookmarks]: [string, any]) => {
            const folder = folders.find(f => f._id === folderId);
            const folderName = folder?.name || 'Uncategorized';
            
            return (
              <AccordionItem key={folderId} value={folderId} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{folderName}</span>
                    <Badge variant="secondary">{folderBookmarks.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pt-4">
                  <div className="grid grid-cols-1 gap-4">
                    {folderBookmarks.map((bookmark: any) => (
                      <Card key={bookmark._id} className="shadow-card">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <CardTitle className="text-base md:text-lg">
                                {bookmark.quiz?.title || 'Untitled Quiz'}
                              </CardTitle>
                              <p className="text-xs md:text-sm text-muted-foreground">
                                {bookmark.quiz?.description || 'No description'}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline">
                                  {bookmark.quiz?.numQuestions || 0} Questions
                                </Badge>
                                <Badge variant="outline">
                                  {bookmark.quiz?.difficulty || 'medium'}
                                </Badge>
                                <Badge variant="outline">
                                  {bookmark.quiz?.duration || 30} mins
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openShareDialog(bookmark)}
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditInQuiz(bookmark)}
                              >
                                <FileEdit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteBookmark(bookmark._id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Accordion type="single" collapsible>
                            <AccordionItem value="questions">
                              <AccordionTrigger className="text-sm">
                                View All Questions ({bookmark.quiz?.questions?.length || 0})
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-3">
                                  {bookmark.quiz?.questions?.map((q: any, idx: number) => (
                                    <Card key={q.id || idx} className="p-3">
                                      <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-sm font-medium flex-1">
                                            {idx + 1}. {q.question}
                                          </p>
                                          <Badge variant="secondary" className="text-xs">
                                            {q.type}
                                          </Badge>
                                        </div>
                                        {q.options && q.options.length > 0 && (
                                          <div className="space-y-1 pl-4">
                                            {q.options.map((opt: string, i: number) => (
                                              <p key={i} className="text-xs text-muted-foreground">
                                                {String.fromCharCode(65 + i)}. {opt}
                                              </p>
                                            ))}
                                          </div>
                                        )}
                                        {q.explanation && (
                                          <p className="text-xs text-muted-foreground italic pl-4">
                                            💡 {q.explanation}
                                          </p>
                                        )}
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share Quiz with Students</DialogTitle>
            <DialogDescription>
              Select students to share "{selectedQuizForShare?.quiz?.title}" with
            </DialogDescription>
          </DialogHeader>
          <StudentTable
            students={students}
            selectedStudents={selectedStudents}
            onSelectionChange={setSelectedStudents}
          />
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleShareQuiz}>
              <Share2 className="h-4 w-4 mr-2" />
              Share Quiz
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
