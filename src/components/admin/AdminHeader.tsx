import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AdminHeader = () => {
  const navigate = useNavigate();
  const [profilePicture, setProfilePicture] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('profile_picture_url, full_name')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfilePicture(data.profile_picture_url || "");
        setFullName(data.full_name || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={() => navigate('/admin/profile')}
      className="flex items-center gap-2 hover:bg-accent"
    >
      {profilePicture ? (
        <img
          src={profilePicture}
          alt={fullName}
          className="w-10 h-10 rounded-full object-cover border-2 border-primary/20"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/10">
          <User className="w-5 h-5 text-primary" />
        </div>
      )}
      <span className="text-sm font-medium">{fullName || "Profile"}</span>
    </Button>
  );
};
