import { useState } from 'react';
import { Edit2, Bookmark, BookmarkCheck, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Question } from '@/types';

interface QuestionEditorProps {
  question: Question;
  index: number;
  onUpdate: (question: Question) => void;
  onDelete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

export function QuestionEditor({
  question,
  index,
  onUpdate,
  onDelete,
  onToggleBookmark,
  onToggleSelect,
}: QuestionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState(question);

  const handleSave = () => {
    onUpdate(editedQuestion);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedQuestion(question);
    setIsEditing(false);
  };

  const updateOption = (optionIndex: number, value: string) => {
    const newOptions = [...(editedQuestion.options || [])];
    newOptions[optionIndex] = value;
    setEditedQuestion({ ...editedQuestion, options: newOptions });
  };

  return (
    <Card className={`p-4 transition-all ${question.isSelected ? 'border-primary/50' : 'opacity-60'}`}>
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        <Checkbox
          checked={question.isSelected}
          onCheckedChange={() => onToggleSelect(question.id)}
          className="mt-1"
        />

        <div className="flex-1 space-y-3">
          {/* Question Number & Type */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">
                Question {index + 1}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {question.type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {!isEditing && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    className="h-8 w-8"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleBookmark(question.id)}
                    className="h-8 w-8"
                  >
                    {question.isBookmarked ? (
                      <BookmarkCheck className="h-4 w-4 text-amber-500 fill-amber-500" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(question.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Question Content */}
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Question Text</label>
                <Textarea
                  value={editedQuestion.question}
                  onChange={(e) =>
                    setEditedQuestion({ ...editedQuestion, question: e.target.value })
                  }
                  className="min-h-[80px]"
                />
              </div>

              {editedQuestion.type === 'mcq' && editedQuestion.options && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Options</label>
                  <div className="space-y-2">
                    {editedQuestion.options.map((option, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-sm font-medium w-6">{String.fromCharCode(65 + i)}.</span>
                        <Input
                          value={option}
                          onChange={(e) => updateOption(i, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block">Correct Answer</label>
                <Input
                  value={editedQuestion.answer}
                  onChange={(e) =>
                    setEditedQuestion({ ...editedQuestion, answer: e.target.value })
                  }
                  placeholder={editedQuestion.type === 'mcq' ? 'e.g., A' : 'Expected answer'}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Explanation (Optional)</label>
                <Textarea
                  value={editedQuestion.explanation || ''}
                  onChange={(e) =>
                    setEditedQuestion({ ...editedQuestion, explanation: e.target.value })
                  }
                  className="min-h-[60px]"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} size="sm" className="gradient-primary">
                  <Save className="h-4 w-4 mr-1" />
                  Save Changes
                </Button>
                <Button onClick={handleCancel} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-base font-medium">{question.question}</p>

              {question.type === 'mcq' && question.options && (
                <div className="space-y-1.5 pl-4">
                  {question.options.map((option, i) => (
                    <div
                      key={i}
                      className={`text-sm p-2 rounded ${
                        question.answer === String.fromCharCode(65 + i)
                          ? 'bg-green-50 border border-green-200 font-medium'
                          : 'bg-muted/30'
                      }`}
                    >
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                      {option}
                      {question.answer === String.fromCharCode(65 + i) && (
                        <span className="ml-2 text-green-600 text-xs">✓ Correct</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {question.type === 'short-answer' && (
                <div className="bg-green-50 border border-green-200 p-3 rounded">
                  <p className="text-sm font-medium text-green-900">Expected Answer:</p>
                  <p className="text-sm text-green-800 mt-1">{question.answer}</p>
                </div>
              )}

              {question.explanation && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                  <p className="text-sm font-medium text-blue-900">Explanation:</p>
                  <p className="text-sm text-blue-800 mt-1">{question.explanation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
