
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical, 
  Trash2, 
  Pencil,
  Filter,
  ArrowUpDown,
  User as UserIcon,
  Loader2,
  X
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Task, User } from '../types';
import { useUser } from '../UserContext';

const TaskManagement: React.FC = () => {
  const { profile } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Form State
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'Pending' as const,
    priority: 'Medium' as const,
    due_date: new Date().toISOString().split('T')[0],
    assigned_to: ''
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [tasksRes, usersRes] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('users').select('*')
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (usersRes.data) {
        setUsers(usersRes.data.map((u: any) => ({
          id: u.id,
          name: u.full_name,
          role: u.role_name,
          branch_id: u.home_branch_name
        })));
      }
    } catch (err) {
      console.error("Task Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          ...newTask,
          assigned_to: newTask.assigned_to || null
        }])
        .select();

      if (error) throw error;
      if (data) setTasks(prev => [...prev, data[0]]);
      setIsAdding(false);
      setNewTask({
        title: '',
        description: '',
        status: 'Pending',
        priority: 'Medium',
        due_date: new Date().toISOString().split('T')[0],
        assigned_to: ''
      });
    } catch (err) {
      console.error("Create Task Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editingTask.title,
          description: editingTask.description,
          status: editingTask.status,
          priority: editingTask.priority,
          due_date: editingTask.due_date,
          assigned_to: editingTask.assigned_to || null
        })
        .eq('id', editingTask.id);

      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
      setIsEditing(false);
      setEditingTask(null);
    } catch (err) {
      console.error("Update Task Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("Delete Task Error:", err);
    }
  };

  const filteredAndSortedTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             t.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = new Date(a.due_date).getTime();
        const dateB = new Date(b.due_date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
  }, [tasks, searchQuery, statusFilter, sortOrder]);

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-slate-900" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Task Management</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Operational To-Dos & Deadlines</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          <Plus size={18} /> CREATE NEW TASK
        </button>
      </div>

      {/* Filters & Sorting */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search tasks..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <select 
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <button 
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
          >
            <ArrowUpDown size={14} /> Due Date {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedTasks.map(task => (
          <div key={task.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                task.priority === 'High' ? 'bg-rose-100 text-rose-600' :
                task.priority === 'Medium' ? 'bg-amber-100 text-amber-600' :
                'bg-emerald-100 text-emerald-600'
              }`}>
                {task.priority} Priority
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingTask(task); setIsEditing(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
            
            <h4 className="font-black text-slate-900 mb-2">{task.title}</h4>
            <p className="text-xs text-slate-500 mb-6 line-clamp-2">{task.description || 'No description provided.'}</p>
            
            <div className="space-y-3 pt-4 border-t border-slate-50">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar size={14} /> Due: {new Date(task.due_date).toLocaleDateString()}
                </div>
                <div className={`flex items-center gap-1 ${
                  task.status === 'Completed' ? 'text-emerald-500' :
                  task.status === 'In Progress' ? 'text-blue-500' :
                  'text-amber-500'
                }`}>
                  {task.status === 'Completed' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                  {task.status}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200">
                  {users.find(u => u.id === task.assigned_to)?.name.charAt(0) || <UserIcon size={12} />}
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  {users.find(u => u.id === task.assigned_to)?.name || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {(isAdding || isEditing) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">
                {isAdding ? 'Create New Task' : 'Edit Task'}
              </h4>
              <button onClick={() => { setIsAdding(false); setIsEditing(false); }} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={isAdding ? handleCreateTask : handleUpdateTask} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Task Title</label>
                <input 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={isAdding ? newTask.title : editingTask?.title}
                  onChange={e => isAdding ? setNewTask({...newTask, title: e.target.value}) : setEditingTask({...editingTask!, title: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                <textarea 
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={isAdding ? newTask.description : editingTask?.description}
                  onChange={e => isAdding ? setNewTask({...newTask, description: e.target.value}) : setEditingTask({...editingTask!, description: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Priority</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={isAdding ? newTask.priority : editingTask?.priority}
                    onChange={e => isAdding ? setNewTask({...newTask, priority: e.target.value as any}) : setEditingTask({...editingTask!, priority: e.target.value as any})}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Due Date</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={isAdding ? newTask.due_date : editingTask?.due_date}
                    onChange={e => isAdding ? setNewTask({...newTask, due_date: e.target.value}) : setEditingTask({...editingTask!, due_date: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={isAdding ? newTask.status : editingTask?.status}
                    onChange={e => isAdding ? setNewTask({...newTask, status: e.target.value as any}) : setEditingTask({...editingTask!, status: e.target.value as any})}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assignee</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={isAdding ? newTask.assigned_to : editingTask?.assigned_to}
                    onChange={e => isAdding ? setNewTask({...newTask, assigned_to: e.target.value}) : setEditingTask({...editingTask!, assigned_to: e.target.value})}
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 mt-4"
              >
                {isAdding ? 'CREATE TASK' : 'SAVE CHANGES'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManagement;
