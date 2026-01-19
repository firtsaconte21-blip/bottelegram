# 🛫 Bot de Marketplace de Milhas - Telegram

Bot para negociação de milhas aéreas no Telegram, desenvolvido com Node.js, TypeScript, Telegraf e Supabase.

## 📋 Funcionalidades

- ✅ Criação de anúncios de venda de milhas
- ✅ Publicação automática no grupo do Telegram
- ✅ Sistema de propostas via deep link
- ✅ Notificações para vendedor e comprador
- ✅ Aceitar/recusar propostas
- ✅ Conexão direta entre as partes

## 🚀 Instalação

### 1. Clone o repositório

```bash
cd bot-telegram
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
# Token do bot obtido via @BotFather no Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# URL do projeto Supabase
SUPABASE_URL=https://seu-projeto.supabase.co

# Service Role Key do Supabase
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# ID do grupo onde os anúncios serão publicados
TELEGRAM_GROUP_ID=-1001234567890

# Username do bot (sem @)
BOT_USERNAME=MeuBotDeMillhas_bot
```

### 4. Inicie o bot

**Desenvolvimento:**
```bash
npm run dev
```

**Produção:**
```bash
npm run build
npm start
```

## 🔧 Configuração do Telegram

### Criar o Bot

1. Abra o [@BotFather](https://t.me/BotFather) no Telegram
2. Envie `/newbot`
3. Escolha um nome e username
4. Copie o token gerado

### Criar o Grupo

1. Crie um grupo no Telegram
2. Adicione o bot como administrador
3. Obtenha o ID do grupo (veja abaixo)

### Obter ID do Grupo

1. Adicione o bot [@getidsbot](https://t.me/getidsbot) ao grupo
2. Ele mostrará o ID (começa com `-100`)
3. Remova o bot após copiar o ID

## 📁 Estrutura do Projeto

```
bot-telegram/
├── src/
│   ├── bot.ts                    # Ponto de entrada
│   ├── config/
│   │   └── index.ts              # Configurações
│   ├── handlers/
│   │   ├── start.handler.ts      # /start e menu
│   │   ├── createAd.handler.ts   # Fluxo de criação
│   │   ├── proposal.handler.ts   # Fluxo de proposta
│   │   ├── acceptProposal.handler.ts
│   │   └── myAds.handler.ts
│   ├── services/
│   │   ├── telegram.service.ts   # Envio de mensagens
│   │   ├── ads.service.ts        # Lógica de anúncios
│   │   ├── proposals.service.ts  # Lógica de propostas
│   │   └── state.service.ts      # Controle de estado
│   ├── repositories/
│   │   └── supabase.ts           # Acesso ao banco
│   └── types/
│       └── index.ts              # TypeScript types
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## 🗄 Banco de Dados

O banco já foi configurado no Supabase com as tabelas:

- **ads**: Anúncios de milhas
- **proposals**: Propostas recebidas
- **user_states**: Estado do fluxo conversacional

## 🔐 Segurança

- ✅ Token nunca exposto em logs
- ✅ Validação de entrada de dados
- ✅ Service Role Key usada apenas no backend
- ✅ Estados persistentes no banco

## 📱 Fluxo de Uso

### Para Vendedores

1. Abra o bot no privado
2. Envie `/start`
3. Clique em "Criar Anúncio"
4. Informe: companhia, quantidade, valor
5. Anúncio publicado automaticamente!

### Para Compradores

1. Veja o anúncio no grupo
2. Clique em "Fazer Proposta"
3. Bot abre no privado
4. Informe seu valor por milheiro
5. Aguarde resposta do vendedor

## 🛠 Comandos

- `/start` - Menu principal
- `/cancelar` - Cancela operação atual

## 📝 Licença

MIT
