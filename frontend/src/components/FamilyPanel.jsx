import { useState, useEffect } from "react";
import axios from "axios";
import { Users, UserPlus, Copy, LogOut, Crown, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function FamilyPanel() {
  const { isAuthenticated, user } = useAuth();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const fetchFamily = async () => {
    try {
      const response = await axios.get(`${API}/family`);
      setFamily(response.data.family);
      setMembers(response.data.members || []);
      setIsOwner(response.data.is_owner);
    } catch (error) {
      console.error("Error fetching family:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchFamily();
    else setLoading(false);
  }, [isAuthenticated]);

  const createFamily = async () => {
    if (!familyName.trim()) {
      toast.error("Enter a family name");
      return;
    }
    try {
      await axios.post(`${API}/family/create`, { name: familyName });
      toast.success("Family created!");
      setShowCreate(false);
      setFamilyName("");
      fetchFamily();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create family");
    }
  };

  const joinFamily = async () => {
    if (!inviteCode.trim()) {
      toast.error("Enter an invite code");
      return;
    }
    try {
      await axios.post(`${API}/family/join/${inviteCode}`);
      toast.success("Joined family!");
      setShowJoin(false);
      setInviteCode("");
      fetchFamily();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid invite code");
    }
  };

  const leaveFamily = async () => {
    if (!confirm(isOwner ? "This will delete the family. Continue?" : "Leave this family?")) return;
    try {
      await axios.delete(`${API}/family/leave`);
      toast.success(isOwner ? "Family deleted" : "Left family");
      setFamily(null);
      setMembers([]);
    } catch (error) {
      toast.error("Failed to leave family");
    }
  };

  const copyInviteCode = () => {
    if (family?.invite_code) {
      navigator.clipboard.writeText(family.invite_code);
      toast.success("Invite code copied!");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">Sign in to use Family Mode</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No family - show create/join options
  if (!family) {
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <Users className="w-10 h-10 text-zinc-500 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Track your family's driving habits</p>
        </div>

        {showCreate ? (
          <div className="space-y-2">
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Family name"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
              maxLength={50}
            />
            <div className="flex gap-2">
              <Button onClick={createFamily} className="flex-1 bg-sky-600 hover:bg-sky-700">Create</Button>
              <Button onClick={() => setShowCreate(false)} variant="outline" className="border-zinc-700">Cancel</Button>
            </div>
          </div>
        ) : showJoin ? (
          <div className="space-y-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white font-mono"
            />
            <div className="flex gap-2">
              <Button onClick={joinFamily} className="flex-1 bg-green-600 hover:bg-green-700">Join</Button>
              <Button onClick={() => setShowJoin(false)} variant="outline" className="border-zinc-700">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => setShowCreate(true)} className="flex-1 bg-sky-600 hover:bg-sky-700">
              <UserPlus className="w-4 h-4 mr-1" /> Create Family
            </Button>
            <Button onClick={() => setShowJoin(true)} variant="outline" className="flex-1 border-zinc-700">
              Join Family
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Has family - show members
  return (
    <div className="space-y-4">
      {/* Family Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium flex items-center gap-2">
            {family.name}
            {isOwner && <Crown className="w-4 h-4 text-yellow-400" />}
          </h3>
          <p className="text-xs text-zinc-500">{family.member_count} member{family.member_count !== 1 ? 's' : ''}</p>
        </div>
        {isOwner && family.invite_code && (
          <Button
            size="sm"
            variant="ghost"
            onClick={copyInviteCode}
            className="text-xs text-zinc-400 hover:text-white"
          >
            <Copy className="w-3 h-3 mr-1" />
            {family.invite_code}
          </Button>
        )}
      </div>

      {/* Member List */}
      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.user_id}
            className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">
                  {member.email.split('@')[0]}
                </span>
                {member.role === "owner" && (
                  <Crown className="w-3 h-3 text-yellow-400" />
                )}
              </div>
              <div className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                member.safe_trip_percentage >= 80 
                  ? "bg-green-500/20 text-green-400" 
                  : member.safe_trip_percentage >= 50 
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-red-500/20 text-red-400"
              )}>
                {member.safe_trip_percentage.toFixed(0)}% safe
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-zinc-500">Trips</p>
                <p className="text-white">{member.total_trips}</p>
              </div>
              <div>
                <p className="text-zinc-500">Miles</p>
                <p className="text-white">{member.total_distance}</p>
              </div>
              <div>
                <p className="text-zinc-500">This Week</p>
                <p className={cn(
                  member.alerts_this_week > 0 ? "text-orange-400" : "text-green-400"
                )}>
                  {member.alerts_this_week} alerts
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Leave Button */}
      <Button
        onClick={leaveFamily}
        variant="ghost"
        className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
      >
        <LogOut className="w-4 h-4 mr-1" />
        {isOwner ? "Delete Family" : "Leave Family"}
      </Button>
    </div>
  );
}
