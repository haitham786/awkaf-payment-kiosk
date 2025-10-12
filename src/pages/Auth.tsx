import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";


const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/admin");
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if this is first login
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_login')
        .eq('id', data.user.id)
        .single();

      if (profile?.first_login) {
        navigate("/auth/first-login");
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate("/admin");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/admin`,
        },
      });

      if (error) throw error;

      toast({
        title: "Account created!",
        description: "You can now log in with your credentials.",
      });

      // Switch to login tab
      setEmail(email);
      setPassword("");
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address to reset password.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Check if the email exists and has admin role
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (!profileData) {
        toast({
          title: "Email not found",
          description: "This email is not registered as an admin.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if user has admin or super_admin role
      const { data: roleCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profileData.id);

      const isAdmin = roleCheck?.some(r => r.role === 'admin' || r.role === 'super_admin');
      
      if (!isAdmin) {
        toast({
          title: "Access denied",
          description: "This email is not registered as an admin.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Password reset email sent",
        description: "Check your email for the password reset link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-card/95 backdrop-blur-sm shadow-elegant border-2 border-primary/20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Admin Portal
          </h1>
          <p className="text-muted-foreground">
            Kiosk Management System
          </p>
        </div>

        <div className="w-full">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>

              <Button
                type="button"
                variant="link"
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full text-sm text-muted-foreground hover:text-primary"
              >
                Forgot Password?
              </Button>
            </form>
        </div>
      </Card>
    </div>
  );
};

export default Auth;