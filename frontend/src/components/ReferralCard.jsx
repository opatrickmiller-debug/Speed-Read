// Referral Card Component - For sharing referral links
import React, { useState, useEffect } from 'react';
import { Gift, Copy, Check, Users, Share2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getDeviceIdValue } from '@/services/tripService';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const ReferralCard = ({ className }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralStats();
  }, []);

  const loadReferralStats = async () => {
    try {
      const deviceId = getDeviceIdValue();
      const response = await fetch(`${API}/referral/stats?device_id=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading referral stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (stats?.referral_link) {
      navigator.clipboard.writeText(stats.referral_link);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLink = async () => {
    if (stats?.referral_link && navigator.share) {
      try {
        await navigator.share({
          title: 'Join DriveCoach',
          text: 'Use my referral code and we both get 1 free month! 🚗',
          url: stats.referral_link
        });
      } catch (err) {
        // User cancelled or not supported
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  if (loading) {
    return (
      <div className={cn("bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4", className)}>
        <div className="animate-pulse h-24 bg-zinc-700/50 rounded" />
      </div>
    );
  }

  return (
    <div className={cn("bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-purple-400" />
        <span className="text-sm font-semibold text-white">Invite Friends</span>
        <span className="ml-auto text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">
          Earn Rewards
        </span>
      </div>

      {/* Value Proposition */}
      <p className="text-xs text-zinc-400 mb-3">
        Share DriveCoach and you'll <span className="text-purple-300 font-medium">both get 1 free month</span> when they sign up!
      </p>

      {/* Referral Code Box */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Your Code</div>
          <div className="text-lg font-mono font-bold text-white tracking-wider">
            {stats?.referral_code || '...'}
          </div>
        </div>
        <button
          onClick={copyLink}
          className="p-3 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors"
        >
          {copied ? <Check className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5 text-white" />}
        </button>
        <button
          onClick={shareLink}
          className="p-3 bg-pink-500 hover:bg-pink-600 rounded-lg transition-colors"
        >
          <Share2 className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-purple-500/20">
          <div className="text-center">
            <div className="text-lg font-bold text-white">{stats.completed_referrals}</div>
            <div className="text-[10px] text-zinc-500">Friends Joined</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{stats.pending_referrals}</div>
            <div className="text-[10px] text-zinc-500">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-400">{stats.total_rewards_earned}</div>
            <div className="text-[10px] text-zinc-500">Months Earned</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Referral Banner - Smaller inline version for settings
export const ReferralBanner = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
        <Gift className="w-5 h-5 text-purple-400" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-white">Invite Friends, Get Rewards</div>
        <div className="text-xs text-zinc-400">Both get 1 free month</div>
      </div>
      <ChevronRight className="w-5 h-5 text-zinc-500" />
    </button>
  );
};

export default ReferralCard;
