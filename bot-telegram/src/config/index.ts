import 'dotenv/config';

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];

  if (required && !value) {
    console.error(`❌ Erro: Variável de ambiente ${name} não está definida!`);
    process.exit(1);
  }

  return value || '';
}

export const config = {
  // Telegram
  telegramBotToken: getEnvVar('TELEGRAM_BOT_TOKEN'),
  telegramGroupId: getEnvVar('TELEGRAM_GROUP_ID'),
  botUsername: getEnvVar('BOT_USERNAME'),

  // Supabase
  supabaseUrl: getEnvVar('SUPABASE_URL'),
  supabaseServiceKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),

  // Mercado Pago
  mpAccessToken: getEnvVar('MERCADO_PAGO_ACCESS_TOKEN'),
  mpPublicKey: getEnvVar('MERCADO_PAGO_PUBLIC_KEY'),
  webhookUrl: getEnvVar('WEBHOOK_URL'),
} as const;

// Validação inicial
export function validateConfig(): void {
  console.log('🔍 Validando configurações...');

  if (!config.telegramBotToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
    console.error('❌ Token do Telegram inválido!');
    process.exit(1);
  }

  if (!config.supabaseUrl.startsWith('https://')) {
    console.error('❌ URL do Supabase inválida!');
    process.exit(1);
  }

  console.log('✅ Configurações validadas com sucesso!');
}
