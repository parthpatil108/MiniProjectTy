import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  GraduationCap,
  Code,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { Button } from '../design-system/Button';
import { Input } from '../design-system/Input';
import { Badge, StatusBadge } from '../design-system/Badge';
import { TableSkeleton } from '../design-system/Skeleton';
import { useToast } from '../design-system/Toast';
import './ProfilePage.css';

interface StudentProfile {
  student_id: string;
  name: string;
  email: string;
  branch: string;
  cgpa: number;
  backlogs: number;
  attendance_percentage?: number;
  skills: string[];
  resume_url?: string;
  github_url?: string;
  linkedin_url?: string;
  placement_status?: string;
  tier_lock?: string;
}

export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [formData, setFormData] = useState<StudentProfile>({
    student_id: user?.user_id || 'STU-1001',
    name: user?.name || '',
    email: user?.email || '',
    branch: 'CSE',
    cgpa: 8.5,
    backlogs: 0,
    attendance_percentage: 85.0,
    skills: ['TypeScript', 'React', 'Node.js', 'Distributed Systems'],
    resume_url: 'https://apnileap.edu/resumes/candidate.pdf',
    github_url: 'https://github.com',
    linkedin_url: 'https://linkedin.com'
  });

  const [newSkill, setNewSkill] = useState('');

  // Load student profile from backend
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['studentProfile', user?.user_id],
    queryFn: async () => {
      try {
        const res = await apiClient<StudentProfile>(`/api/v1/ui/profile`);
        return res;
      } catch (e) {
        // Fallback to student by ID if ui/profile isn't directly responding
        return apiClient<StudentProfile>(`/api/v1/students/${user?.user_id || 'STU-1001'}`);
      }
    },
    retry: 1
  });

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        ...profile,
        skills: Array.isArray(profile.skills) ? profile.skills : prev.skills
      }));
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (updatedData: StudentProfile) => {
      return apiClient<StudentProfile>(`/api/v1/ui/profile`, {
        method: 'PUT',
        body: JSON.stringify(updatedData)
      });
    },
    onSuccess: (data) => {
      addToast({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your academic and skill profile was successfully synchronized with Team C DBMS.'
      });
      queryClient.setQueryData(['studentProfile', user?.user_id], data);
    },

    onError: (err: any) => {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Unable to update candidate profile.'
      });
    }
  });

  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (('key' in e && e.key === 'Enter') || e.type === 'click') {
      e.preventDefault();
      const trimmed = newSkill.trim();
      if (trimmed && !formData.skills.includes(trimmed)) {
        setFormData((prev) => ({
          ...prev,
          skills: [...prev.skills, trimmed]
        }));
        setNewSkill('');
      }
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="apni-profile-page">
        <h2 className="apni-page-title">Candidate Profile & Academic Ledger</h2>
        <TableSkeleton rows={4} cols={2} />
      </div>
    );
  }

  return (
    <div className="apni-profile-page">
      <div className="apni-profile-header">
        <div>
          <h2 className="apni-page-title">Candidate Academic & Skill Ledger</h2>
          <p className="apni-page-subtitle">
            Verified academic credentials used by Team A Eligibility Engine and Team B Skill Ranker
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Save size={16} />}
          isLoading={updateMutation.isPending}
          onClick={handleSubmit}
        >
          Save Changes
        </Button>
      </div>

      <div className="apni-profile-grid">
        {/* Left Column: Academic & Personal Data */}
        <div className="apni-profile-card glass-panel">
          <div className="apni-card-header">
            <GraduationCap className="apni-card-icon" size={20} />
            <h3>Academic Credentials</h3>
          </div>

          <form onSubmit={handleSubmit} className="apni-profile-form">
            <div className="apni-form-row">
              <Input
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Student ID"
                value={formData.student_id}
                disabled
                helperText="Verified Institutional UID"
              />
            </div>

            <div className="apni-form-row">
              <Input
                label="Academic Department / Branch"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                required
              />
              <Input
                label="Current CGPA"
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={formData.cgpa}
                onChange={(e) => setFormData({ ...formData, cgpa: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="apni-form-row">
              <Input
                label="Active Backlogs"
                type="number"
                min="0"
                value={formData.backlogs}
                onChange={(e) => setFormData({ ...formData, backlogs: parseInt(e.target.value, 10) || 0 })}
                required
              />
              <Input
                label="Attendance Percentage"
                type="number"
                min="0"
                max="100"
                value={formData.attendance_percentage ?? 85}
                onChange={(e) => setFormData({ ...formData, attendance_percentage: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="apni-form-row">
              <Input
                label="GitHub Profile URL"
                value={formData.github_url || ''}
                onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                placeholder="https://github.com/username"
              />
              <Input
                label="LinkedIn Profile URL"
                value={formData.linkedin_url || ''}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/username"
              />
            </div>

            <Input
              label="Resume URL / Cloud Ledger Document"
              value={formData.resume_url || ''}
              onChange={(e) => setFormData({ ...formData, resume_url: e.target.value })}
              placeholder="https://apnileap.edu/resumes/..."
            />
          </form>
        </div>

        {/* Right Column: Skills & Placement Status */}
        <div className="apni-profile-side">
          {/* Placement Status Card */}
          <div className="apni-profile-card glass-panel">
            <div className="apni-card-header">
              <ShieldCheck className="apni-card-icon" size={20} />
              <h3>Placement Status & Tier</h3>
            </div>
            <div className="apni-status-details">
              <div className="apni-status-row">
                <span>Placement Policy State:</span>
                <StatusBadge status={formData.placement_status || 'APPLIED'} />
              </div>
              <div className="apni-status-row">
                <span>Tier Lock:</span>
                <Badge variant={formData.tier_lock ? 'warning' : 'success'}>
                  {formData.tier_lock || 'Eligible for Dream & Super Dream'}
                </Badge>
              </div>
              <div className="apni-policy-note">
                <AlertCircle size={14} />
                <span>
                  Strict rule engine applies: Candidates with an accepted offer cannot apply to same or lower-tier drives.
                </span>
              </div>
            </div>
          </div>

          {/* Technical Skills Inventory */}
          <div className="apni-profile-card glass-panel">
            <div className="apni-card-header">
              <Code className="apni-card-icon" size={20} />
              <h3>Skills Graph Inventory</h3>
            </div>
            <p className="apni-skills-desc">
              Indexed in Team B Bipartite Graph for cosine/weighted similarity matching.
            </p>

            <div className="apni-skills-tags">
              {formData.skills.map((skill) => (
                <span key={skill} className="apni-skill-pill">
                  {skill}
                  <button
                    type="button"
                    className="apni-skill-remove"
                    onClick={() => handleRemoveSkill(skill)}
                    title={`Remove ${skill}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            <div className="apni-skill-add-row">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={handleAddSkill}
                placeholder="Add skill (e.g. Docker, Redis, Go)"
              />
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={handleAddSkill}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
