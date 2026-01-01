// Instructor Portal - B2B Dashboard for Driving Instructors
import React, { useState, useEffect } from 'react';
import { 
  Users, GraduationCap, TrendingUp, Clock, Shield, ChevronRight, 
  Plus, Search, X, Edit, Trash2, Eye, Mail, Phone, Calendar,
  Award, AlertTriangle, CheckCircle, BarChart3, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Grade helpers
const getGrade = (score) => {
  if (score >= 95) return { grade: 'A+', color: 'text-green-400' };
  if (score >= 90) return { grade: 'A', color: 'text-green-400' };
  if (score >= 85) return { grade: 'B+', color: 'text-cyan-400' };
  if (score >= 80) return { grade: 'B', color: 'text-cyan-400' };
  if (score >= 75) return { grade: 'C+', color: 'text-yellow-400' };
  if (score >= 70) return { grade: 'C', color: 'text-yellow-400' };
  return { grade: 'D', color: 'text-orange-400' };
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, subValue, color = "text-cyan-400", trend }) => (
  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
    <div className="flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color.replace('text-', 'bg-') + '/20')}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-zinc-400">{label}</div>
      </div>
      {trend && (
        <div className={cn("ml-auto text-xs font-medium", trend > 0 ? "text-green-400" : "text-red-400")}>
          {trend > 0 ? '+' : ''}{trend}%
        </div>
      )}
    </div>
  </div>
);

// Student Row Component
const StudentRow = ({ student, onView, onEdit, onRemove }) => {
  const { grade, color } = getGrade(student.safety_score || 100);
  const lastSession = student.last_session_date 
    ? new Date(student.last_session_date).toLocaleDateString()
    : 'No sessions';
  
  return (
    <div className="flex items-center gap-4 p-4 bg-zinc-800/30 rounded-lg hover:bg-zinc-800/50 transition-colors">
      {/* Avatar & Name */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
        {student.name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate">{student.name}</div>
        <div className="text-xs text-zinc-500">{student.email || 'No email'}</div>
      </div>
      
      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6">
        <div className="text-center">
          <div className={cn("text-lg font-bold", color)}>{grade}</div>
          <div className="text-[10px] text-zinc-500">Grade</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{student.total_hours?.toFixed(1) || 0}</div>
          <div className="text-[10px] text-zinc-500">Hours</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{student.total_sessions || 0}</div>
          <div className="text-[10px] text-zinc-500">Sessions</div>
        </div>
      </div>
      
      {/* Status Badge */}
      <div className={cn(
        "px-2 py-1 rounded-full text-xs font-medium",
        student.state_requirement_met 
          ? "bg-green-500/20 text-green-400" 
          : "bg-orange-500/20 text-orange-400"
      )}>
        {student.state_requirement_met ? 'Ready' : 'In Progress'}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1">
        <button onClick={() => onView(student)} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
          <Eye className="w-4 h-4 text-zinc-400" />
        </button>
        <button onClick={() => onEdit(student)} className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
          <Edit className="w-4 h-4 text-zinc-400" />
        </button>
        <button onClick={() => onRemove(student)} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  );
};

// Add Student Modal
const AddStudentModal = ({ isOpen, onClose, onAdd, instructorId }) => {
  const [formData, setFormData] = useState({
    student_name: '',
    student_device_id: '',
    student_email: '',
    permit_date: '',
    target_test_date: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.student_name || !formData.student_device_id) {
      toast.error('Name and Device ID are required');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API}/instructor/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_id: instructorId,
          ...formData
        })
      });
      
      if (response.ok) {
        toast.success('Student added successfully!');
        onAdd();
        onClose();
        setFormData({ student_name: '', student_device_id: '', student_email: '', permit_date: '', target_test_date: '', notes: '' });
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to add student');
      }
    } catch (err) {
      toast.error('Error adding student');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-white">Add Student</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-700 rounded">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Student Name *</label>
            <input
              type="text"
              value={formData.student_name}
              onChange={(e) => setFormData({...formData, student_name: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              placeholder="John Smith"
            />
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Device ID / Invite Code *</label>
            <input
              type="text"
              value={formData.student_device_id}
              onChange={(e) => setFormData({...formData, student_device_id: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              placeholder="Student's device ID or invite code"
            />
            <p className="text-xs text-zinc-500 mt-1">Ask student to share their Device ID from app settings</p>
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email (optional)</label>
            <input
              type="email"
              value={formData.student_email}
              onChange={(e) => setFormData({...formData, student_email: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              placeholder="student@email.com"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Permit Date</label>
              <input
                type="date"
                value={formData.permit_date}
                onChange={(e) => setFormData({...formData, permit_date: e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Target Test Date</label>
              <input
                type="date"
                value={formData.target_test_date}
                onChange={(e) => setFormData({...formData, target_test_date: e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white h-20 resize-none"
              placeholder="Any notes about this student..."
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-cyan-600 hover:bg-cyan-700">
              {loading ? 'Adding...' : 'Add Student'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Login Form
const LoginForm = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    school_name: '',
    license_number: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const endpoint = isRegister ? '/instructor/register' : '/instructor/login';
      const body = isRegister ? formData : { email: formData.email, password: formData.password };
      
      const response = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('instructor_token', data.token);
        localStorage.setItem('instructor_id', data.instructor.id);
        localStorage.setItem('instructor_name', data.instructor.name);
        toast.success(isRegister ? 'Account created!' : 'Welcome back!');
        onLogin(data.instructor);
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Authentication failed');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">DriveCoach for Instructors</h1>
          <p className="text-zinc-400 mt-2">Track all your students in one dashboard</p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  placeholder="John Smith"
                  required={isRegister}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Driving School (optional)</label>
                <input
                  type="text"
                  value={formData.school_name}
                  onChange={(e) => setFormData({...formData, school_name: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  placeholder="ABC Driving School"
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              placeholder="instructor@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Password *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          
          <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-700">
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </Button>
          
          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-cyan-400 hover:text-cyan-300"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </form>
        
        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div>
            <Users className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <div className="text-xs text-zinc-400">Track Students</div>
          </div>
          <div>
            <BarChart3 className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <div className="text-xs text-zinc-400">Progress Reports</div>
          </div>
          <div>
            <Award className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-xs text-zinc-400">Free Forever</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Instructor Portal Component
export const InstructorPortal = () => {
  const [instructor, setInstructor] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    // Check if already logged in
    const instructorId = localStorage.getItem('instructor_id');
    const instructorName = localStorage.getItem('instructor_name');
    
    if (instructorId && instructorName) {
      setInstructor({ id: instructorId, name: instructorName });
      loadDashboard(instructorId);
    } else {
      setLoading(false);
    }
  }, []);

  const loadDashboard = async (instructorId) => {
    try {
      const response = await fetch(`${API}/instructor/dashboard?instructor_id=${instructorId}`);
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (instructorData) => {
    setInstructor(instructorData);
    loadDashboard(instructorData.id);
  };

  const handleLogout = () => {
    localStorage.removeItem('instructor_token');
    localStorage.removeItem('instructor_id');
    localStorage.removeItem('instructor_name');
    setInstructor(null);
    setDashboard(null);
  };

  const handleRemoveStudent = async (student) => {
    if (!confirm(`Remove ${student.name} from your roster?`)) return;
    
    try {
      const response = await fetch(
        `${API}/instructor/students/${student.id}?instructor_id=${instructor.id}`,
        { method: 'DELETE' }
      );
      
      if (response.ok) {
        toast.success('Student removed');
        loadDashboard(instructor.id);
      }
    } catch (err) {
      toast.error('Error removing student');
    }
  };

  // Show login if not authenticated
  if (!instructor) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Filter students by search
  const filteredStudents = dashboard?.students?.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Header */}
      <header className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-semibold text-white">DriveCoach</div>
              <div className="text-xs text-zinc-400">Instructor Portal</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-white">{dashboard?.instructor?.name}</div>
              <div className="text-xs text-zinc-400">{dashboard?.instructor?.school_name || 'Independent'}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Users}
            label="Total Students"
            value={dashboard?.total_students || 0}
            color="text-cyan-400"
          />
          <StatCard
            icon={TrendingUp}
            label="Active This Week"
            value={dashboard?.active_students || 0}
            color="text-green-400"
          />
          <StatCard
            icon={CheckCircle}
            label="Ready for Test"
            value={dashboard?.students_meeting_requirements || 0}
            color="text-purple-400"
          />
          <StatCard
            icon={Clock}
            label="Total Hours"
            value={dashboard?.total_hours_supervised?.toFixed(1) || 0}
            color="text-orange-400"
          />
        </div>

        {/* Student List */}
        <div className="bg-zinc-800/30 border border-zinc-700 rounded-xl">
          {/* List Header */}
          <div className="p-4 border-b border-zinc-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-zinc-400" />
              <span className="font-semibold text-white">Students</span>
              <span className="text-xs text-zinc-500">({filteredStudents.length})</span>
            </div>
            
            <div className="flex-1 flex items-center gap-3 sm:justify-end">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students..."
                  className="w-full sm:w-64 bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white"
                />
              </div>
              
              {/* Add Button */}
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </div>
          </div>

          {/* Student Rows */}
          <div className="p-4 space-y-2">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No students yet</p>
                <p className="text-zinc-500 text-sm mt-1">Add your first student to start tracking</p>
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 bg-cyan-600 hover:bg-cyan-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
              </div>
            ) : (
              filteredStudents.map(student => (
                <StudentRow
                  key={student.id}
                  student={student}
                  onView={(s) => setSelectedStudent(s)}
                  onEdit={(s) => toast.info('Edit coming soon')}
                  onRemove={handleRemoveStudent}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={() => loadDashboard(instructor.id)}
        instructorId={instructor.id}
      />
    </div>
  );
};

export default InstructorPortal;
