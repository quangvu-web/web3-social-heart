import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";

interface FriendRequestButtonProps {
  userId: string;
  currentUserId: string;
}

type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "accepted";

export const FriendRequestButton = ({ userId, currentUserId }: FriendRequestButtonProps) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<FriendshipStatus>("none");
  const [loading, setLoading] = useState(false);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);

  useEffect(() => {
    checkFriendshipStatus();
    
    // Set up realtime subscription for friendships
    const channel = supabase
      .channel('friendship-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user_id=eq.${currentUserId},friend_id=eq.${userId}`
        },
        () => {
          checkFriendshipStatus();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user_id=eq.${userId},friend_id=eq.${currentUserId}`
        },
        () => {
          checkFriendshipStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, currentUserId]);

  const checkFriendshipStatus = async () => {
    const { data, error } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status")
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUserId})`)
      .maybeSingle();

    if (error) {
      // Error checking friendship - silent fail
      return;
    }

    if (!data) {
      setStatus("none");
      setFriendshipId(null);
    } else {
      setFriendshipId(data.id);
      if (data.status === "accepted") {
        setStatus("accepted");
      } else if (data.user_id === currentUserId) {
        setStatus("pending_sent");
      } else {
        setStatus("pending_received");
      }
    }
  };

  const sendFriendRequest = async () => {
    // Guest check - show login prompt
    if (!currentUserId) {
      toast.error('Vui lòng đăng nhập để kết bạn', {
        action: { label: 'Đăng nhập', onClick: () => navigate('/auth') }
      });
      return;
    }
    
    setLoading(true);
    const { error } = await supabase
      .from("friendships")
      .insert({
        user_id: currentUserId,
        friend_id: userId,
        status: "pending"
      });

    if (error) {
      toast.error("Failed to send friend request");
    } else {
      toast.success("Friend request sent!");
      checkFriendshipStatus();
    }
    setLoading(false);
  };

  const acceptFriendRequest = async () => {
    if (!friendshipId) return;
    setLoading(true);
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);

    if (error) {
      toast.error("Failed to accept friend request");
    } else {
      toast.success("Friend request accepted!");
      checkFriendshipStatus();
    }
    setLoading(false);
  };

  const removeFriend = async () => {
    if (!friendshipId) return;
    setLoading(true);
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);

    if (error) {
      toast.error("Failed to remove friend");
    } else {
      toast.success("Friend removed");
      checkFriendshipStatus();
    }
    setLoading(false);
  };

  if (status === "none") {
    return (
      <Button 
        onClick={sendFriendRequest} 
        disabled={loading} 
        size="sm"
        variant="secondary"
      >
        <UserPlus className="w-4 h-4 mr-2 text-gold" />
        Add Friend
      </Button>
    );
  }

  if (status === "pending_sent") {
    return (
      <Button 
        onClick={removeFriend} 
        disabled={loading} 
        variant="outline" 
        size="sm"
      >
        <Clock className="w-4 h-4 mr-2 text-gold" />
        Cancel Request
      </Button>
    );
  }

  if (status === "pending_received") {
    return (
      <div className="flex gap-2">
        <Button 
          onClick={acceptFriendRequest} 
          disabled={loading} 
          size="sm"
        >
          <UserCheck className="w-4 h-4 mr-2" />
          Accept
        </Button>
        <Button 
          onClick={removeFriend} 
          disabled={loading} 
          variant="outline" 
          size="sm"
        >
          Reject
        </Button>
      </div>
    );
  }

  if (status === "accepted") {
    return (
      <Button 
        onClick={removeFriend} 
        disabled={loading} 
        variant="outline" 
        size="sm"
      >
        <UserMinus className="w-4 h-4 mr-2 text-gold" />
        Unfriend
      </Button>
    );
  }

  return null;
};
