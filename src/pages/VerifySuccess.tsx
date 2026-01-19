import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

const VerifySuccess = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <Card className="max-w-md w-full bg-slate-800/50 border-slate-700 text-white text-center">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <CheckCircle2 className="h-16 w-16 text-green-400" />
                    </div>
                    <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                        E-mail Verificado!
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-slate-300 text-lg">
                        Sua conta foi confirmada com sucesso. Agora você já pode voltar ao Telegram e começar a usar o bot.
                    </p>
                    <div className="space-y-4">
                        <Button
                            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-6 text-lg"
                            onClick={() => window.location.href = "https://t.me/seu_bot_username"} // Provide fallback if user needs to update
                        >
                            Voltar para o Telegram
                        </Button>
                        <p className="text-slate-500 text-sm">
                            Você já pode fechar esta aba.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default VerifySuccess;
