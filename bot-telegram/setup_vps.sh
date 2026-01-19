#!/bin/bash

# 1. Instalar PM2 globalmente (se não existir)
if ! command -v pm2 &> /dev/null; then
    echo "📦 Instalando PM2..."
    npm install -g pm2
fi

# 1.1 Compilar o projeto (TypeScript -> JS)
echo "🔨 Compilando o projeto..."
npm run build

# 2. Iniciar aplicações via PM2
echo "🚀 Iniciando Bot e Ngrok com PM2..."
pm2 start ecosystem.config.js

# 3. Salvar lista de processos e gerar script de startup
echo "💾 Configurando Startup do PM2..."
pm2 save
pm2 startup | tail -n 1 > startup_script.sh
chmod +x startup_script.sh
./startup_script.sh
rm startup_script.sh

# 4. Adicionar Job de Reinício Diário no Cron (00:00)
echo "⏰ Configurando Reinício Diário (00:00)..."
(crontab -l 2>/dev/null; echo "0 0 * * * /sbin/shutdown -r now") | crontab -

echo "✅ Configuração Concluída!"
echo "O servidor irá reiniciar todos os dias à meia-noite."
echo "O PM2 irá reviver o Bot e o Ngrok automaticamente após o reinício."
