import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            🛫 Bot Marketplace de Milhas
          </h1>
          <p className="text-slate-400 text-lg">Telegram Bot para negociação de milhas aéreas</p>
          <div className="flex justify-center gap-2">
            <Badge variant="secondary">Node.js</Badge>
            <Badge variant="secondary">TypeScript</Badge>
            <Badge variant="secondary">Telegraf</Badge>
            <Badge variant="secondary">Supabase</Badge>
          </div>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-cyan-400">📦 Estrutura do Projeto</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-slate-300 overflow-x-auto">
{`bot-telegram/
├── src/
│   ├── bot.ts              # Entrada principal
│   ├── config/             # Configurações
│   ├── handlers/           # Comandos e callbacks
│   ├── services/           # Lógica de negócio
│   ├── repositories/       # Acesso ao banco
│   └── types/              # TypeScript types
├── .env.example
├── package.json
└── README.md`}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-green-400">🚀 Como Rodar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-300">
            <div>
              <p className="font-semibold mb-2">1. Configure o .env:</p>
              <pre className="bg-slate-900 p-3 rounded text-sm">
{`TELEGRAM_BOT_TOKEN=seu_token
SUPABASE_URL=sua_url
SUPABASE_SERVICE_ROLE_KEY=sua_key
TELEGRAM_GROUP_ID=-1001234567890
BOT_USERNAME=seu_bot`}
              </pre>
            </div>
            <div>
              <p className="font-semibold mb-2">2. Instale e execute:</p>
              <pre className="bg-slate-900 p-3 rounded text-sm">
{`cd bot-telegram
npm install
npm run dev`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-yellow-400">✨ Funcionalidades</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-slate-300">
              <li>✅ Criação de anúncios passo a passo</li>
              <li>✅ Publicação automática no grupo</li>
              <li>✅ Deep links para propostas</li>
              <li>✅ Notificações em tempo real</li>
              <li>✅ Aceitar/recusar propostas</li>
              <li>✅ Estado persistente no banco</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
