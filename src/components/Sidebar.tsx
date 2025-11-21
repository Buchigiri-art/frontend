import { NavLink, useNavigate } from 'react-router-dom';
import { GraduationCap, LayoutDashboard, Users, FileText, Bookmark, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Student Details', path: '/students' },
  { icon: FileText, label: 'Create Quiz', path: '/create-quiz' },
  { icon: FileText, label: 'Results', path: '/results' },
  { icon: Bookmark, label: 'Bookmarks', path: '/bookmarks' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-all duration-300 animate-slide-in-right',
        isCollapsed ? 'w-16' : 'w-52 md:w-64'
      )}
    >
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-sidebar-border flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2 md:gap-3 animate-fade-in">
            <div className="w-8 h-8 md:w-10 md:h-10 gradient-primary rounded-lg flex items-center justify-center shadow-glow animate-pulse">
              <GraduationCap className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs md:text-sm">SmartQuizAI</span>
              <span className="text-[10px] md:text-xs text-sidebar-foreground/70">Faculty Module</span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hover:bg-sidebar-accent transition-all hover:scale-110"
        >
          <Menu className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>

      {/* User Profile */}
      {!isCollapsed && user && (
        <div className="p-3 md:p-4 border-b border-sidebar-border animate-fade-in">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary/20">
              <span className="text-xs md:text-sm font-semibold text-primary">
                {user.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-medium truncate">{user.name}</p>
              <p className="text-[10px] md:text-xs text-sidebar-foreground/70 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 md:p-3 space-y-1">
        {navItems.map((item, index) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-lg transition-all hover:scale-[1.02]',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive && 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-glow',
                isCollapsed && 'justify-center'
              )
            }
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <item.icon className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-xs md:text-sm">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-2 md:p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            'w-full justify-start gap-2 md:gap-3 hover:bg-destructive/10 hover:text-destructive transition-all hover:scale-[1.02] text-xs md:text-sm',
            isCollapsed && 'justify-center'
          )}
        >
          <LogOut className="h-4 w-4 md:h-5 md:w-5" />
          {!isCollapsed && <span>Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
