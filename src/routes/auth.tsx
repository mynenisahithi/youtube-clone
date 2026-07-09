import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Video } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto flex items-center gap-2">
            <div className="grid h-8 w-11 place-items-center rounded-md bg-brand text-brand-foreground">
              <Video className="h-4 w-4" />
            </div>
            <span className="text-xl font-bold">MyTube</span>
          </Link>
          <CardTitle className="mt-4">Welcome</CardTitle>
          <CardDescription>Sign in or create an account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="signin"><SignIn /></TabsContent>
            <TabsContent value="signup"><SignUp /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setL] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setL(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setL(false);
    if (error) toast.error(error.message); else toast.success("Signed in");
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div><Label htmlFor="e">Email</Label><Input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label htmlFor="p">Password</Label><Input id="p" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <Button className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

function SignUp() {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); const [password, setPassword] = useState("");
  const [loading, setL] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setL(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { name, phone } },
    });
    setL(false);
    if (error) toast.error(error.message); else toast.success("Account created — you can sign in now.");
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label>Phone</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <Button className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
    </form>
  );
}
