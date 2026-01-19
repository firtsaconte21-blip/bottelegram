import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Verify = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleAuth = async () => {
            // Supabase handles the token in the hash/URL automatically with onAuthStateChange 
            // but we can ensure the session is active.
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                navigate("/verify-success");
            } else {
                // If no session yet, wait for a bit or check if there was an error
                const { error } = await supabase.auth.refreshSession();
                if (!error) {
                    navigate("/verify-success");
                }
            }
        };

        handleAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && session) {
                navigate("/verify-success");
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
            <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
                <h2 className="text-2xl font-semibold">Verificando sua conta...</h2>
                <p className="text-slate-400">Por favor, aguarde um momento.</p>
            </div>
        </div>
    );
};

export default Verify;
